import fs from 'node:fs/promises';
import path from 'node:path';
import {calculateScreeningEconomics} from '../screening-economics-v1.js';
import {resolveFreightEstimate,resolveDutyTaxProfile,resolveMarketplaceFeeProfile} from '../screening-assumption-profiles-v1.js';
import {validateScreeningMarketContext} from '../screening-market-context-v1.js';

const matchPath=process.argv[2]||'artifacts/match/secondary-corroborated-match.json';
const outPath=process.argv[3]||'artifacts/first-screening-economics-preflight.json';
const evidencePackPath=process.argv[4]||'data/v2-public-economics-evidence-2026-08-29.json';
const [matchDoc,evidencePack]=await Promise.all([
  fs.readFile(matchPath,'utf8').then(JSON.parse),
  fs.readFile(evidencePackPath,'utf8').then(JSON.parse)
]);
const target=matchDoc.target||{};
const match=matchDoc.match||{};
if(match.screeningEconomicsEligible!==true||Number(match.matchConfidence)<80)throw new Error('MATCH_NOT_SCREENING_ELIGIBLE');
if(String(target.amazonAsin)!=='B09K5927B5'||String(target.supplierListingKey)!=='1601573810318')throw new Error('UNEXPECTED_TARGET_PAIR');

const observed={
  marketplacePrice:{value:Number(target.marketplacePrice),currency:'USD',market:'US',evidenceClass:'PUBLIC_MARKETPLACE_LISTING_PRICE',sourceRef:`https://www.amazon.com/dp/${target.amazonAsin}`},
  supplierPrice:{value:6.89,currency:'USD',moq:100,evidenceClass:'PUBLIC_SUPPLIER_LISTING_PRICE_CONSERVATIVE_APPLICABLE_TIER',sourceRef:'https://www.alibaba.com/product-detail/Desk-Organizers-and-Accessories-5-Tier_1601573810318.html'},
  matchConfidence:Number(match.matchConfidence)
};
if(observed.marketplacePrice.value!==23.99)throw new Error(`UNEXPECTED_MARKETPLACE_PRICE:${observed.marketplacePrice.value}`);

// The business screen is Romania. A US marketplace price is retained as an external benchmark,
// never silently promoted into a Romanian sell-price observation.
const romaniaSellMarketContext=validateScreeningMarketContext({marketplaceMarket:'US',targetSellMarket:'RO',taxJurisdiction:'RO',marketplaceFeeMarket:'RO'});
const amazonUsBenchmarkContext=validateScreeningMarketContext({marketplaceMarket:'US',targetSellMarket:'US',taxJurisdiction:'US',marketplaceFeeMarket:'US'});
if(romaniaSellMarketContext.status!=='BLOCKED'||!romaniaSellMarketContext.blockers.includes('SELL_PRICE_MARKET_MISMATCH'))throw new Error('ROMANIA_MARKET_COHERENCE_GATE_FAILED');
if(amazonUsBenchmarkContext.status!=='COHERENT')throw new Error('AMAZON_US_BENCHMARK_CONTEXT_INVALID');

const fx=evidencePack?.evidence?.fx||{};
const amazonFee=evidencePack?.evidence?.amazonUsOfficeProductsReferralFee||{};
const romaniaVat=evidencePack?.evidence?.romaniaVat||{};
if(!(Number(fx.derivedUsdRon)>0)||!fx.sourceRef)throw new Error('FX_EVIDENCE_INVALID');
if(Number(amazonFee.referralFeeRate)!==0.15||amazonFee.scope!=='AMAZON_US_ONLY')throw new Error('AMAZON_US_FEE_EVIDENCE_INVALID');
if(Number(romaniaVat.standardVatRate)!==0.21||romaniaVat.scope!=='ROMANIA_STANDARD_VAT')throw new Error('ROMANIA_VAT_EVIDENCE_INVALID');

const freightResolution=resolveFreightEstimate({});
const dutyTaxResolution=resolveDutyTaxProfile({});
const marketplaceFeeResolution=resolveMarketplaceFeeProfile({});

const economicsInput={
  supplierUnitPriceRon:null,
  sellPriceGrossRon:null,
  freightPerUnitRon:null,
  insurancePerUnitRon:null,
  brokeragePerUnitRon:null,
  destinationHandlingPerUnitRon:null,
  domesticTransportPerUnitRon:null,
  packagingPerUnitRon:null,
  complianceReservePerUnitRon:null,
  importVatAdditionalBasePerUnitRon:null,
  fulfillmentPerUnitRon:null,
  dutyRate:null,
  importVatRate:null,
  sellVatRate:null,
  marketplaceCommissionRate:null,
  adsReserveRate:null,
  returnsReserveRate:null,
  warrantyReserveRate:null,
  otherReserveRate:null,
  importVatRecoverable:null,
  supplierPriceEvidenceRef:observed.supplierPrice.sourceRef,
  marketplacePriceEvidenceRef:null,
  freightAssumptionRef:null,
  dutyAssumptionRef:null,
  marketplaceFeeAssumptionRef:null,
  matchConfidence:observed.matchConfidence
};
const economics=calculateScreeningEconomics(economicsInput);
if(economics.status!=='BLOCKED')throw new Error('PREFLIGHT_MUST_REMAIN_BLOCKED_WITHOUT_LOCAL_PRICE_AND_ASSUMPTIONS');

const blockerGroups={
  marketCoherence:romaniaSellMarketContext.blockers,
  localSellPrice:['CURRENT_ROMANIA_SELL_PRICE_REQUIRED'],
  currencyNormalization:['SUPPLIER_USD_TO_RON_FX_AVAILABLE','ROMANIA_SELL_PRICE_CURRENCY_PENDING_LOCAL_PRICE'],
  freight:freightResolution.blockers||[],
  dutyTax:dutyTaxResolution.blockers||[],
  marketplaceFees:marketplaceFeeResolution.blockers||[],
  vatAndImportTreatment:['ROMANIA_STANDARD_VAT_EVIDENCE_AVAILABLE','IMPORT_VAT_RECOVERABILITY_REQUIRED'],
  otherUnitCosts:['INSURANCE_PER_UNIT_REQUIRED','BROKERAGE_PER_UNIT_REQUIRED','DESTINATION_HANDLING_PER_UNIT_REQUIRED','DOMESTIC_TRANSPORT_PER_UNIT_REQUIRED','PACKAGING_PER_UNIT_REQUIRED','COMPLIANCE_RESERVE_PER_UNIT_REQUIRED','IMPORT_VAT_ADDITIONAL_BASE_PER_UNIT_REQUIRED']
};
const report={
  schemaVersion:'MPR_FIRST_SCREENING_ECONOMICS_PREFLIGHT_V2',generatedAt:new Date().toISOString(),
  target:{amazonAsin:target.amazonAsin,supplierListingKey:String(target.supplierListingKey),marketplaceTitle:target.marketplaceTitle,supplierTitle:target.supplierTitle},
  observed,
  marketContexts:{romaniaSellScreen:romaniaSellMarketContext,amazonUsBenchmark:amazonUsBenchmarkContext},
  publicEvidence:{fx,amazonUsReferralFee:amazonFee,romaniaVat},
  assumptionResolvers:{freight:freightResolution,dutyTax:dutyTaxResolution,marketplaceFees:marketplaceFeeResolution},
  economics,
  blockerGroups,
  nextEvidenceRequired:[
    'current Romania sell-side price for the same sufficiently matched product/fingerprint',
    'freight estimate with explicit sourceRef/confidence and package weight or conservative category fallback',
    'duty/import VAT profile with explicit sourceRef/confidence and classification status',
    'Romania marketplace fee profile with commission, fulfillment and reserve assumptions plus sourceRef/confidence',
    'import VAT recoverability treatment appropriate to the Romanian selling entity',
    'explicit non-negative per-unit import/handling/packaging/compliance assumptions with provenance'
  ],
  decision:'BLOCKED_PENDING_ROMANIA_SELL_PRICE_AND_PROVENANCE_BACKED_ASSUMPTIONS',
  truthPolicy:{amazonUsPriceIsRomaniaSellPrice:false,amazonUsReferralFeeIsRomaniaMarketplaceFee:false,romaniaVatAppliedToAmazonUsBenchmark:false,matchIsConfirmedCrossMarketIdentity:false,screeningEstimateIsConfirmedLandedCost:false,publicSupplierPriceIsVerifiedQuote:false,marketplacePriceIsRealizedSale:false,unknownEqualsZero:false,syntheticTestValuesUsedAsCommercialFacts:false,paidCallsTriggered:0,providerSpendUsd:0,purchaseAuthorized:false,negotiationIncluded:false}
};
await fs.mkdir(path.dirname(outPath),{recursive:true});
await fs.writeFile(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({decision:report.decision,matchConfidence:observed.matchConfidence,romaniaMarketContext:romaniaSellMarketContext,amazonUsBenchmarkContext,fxUsdRon:fx.derivedUsdRon,romaniaVatRate:romaniaVat.standardVatRate,amazonUsOfficeProductsReferralFee:amazonFee.referralFeeRate,engineBlockers:economics.blockers,paidCallsTriggered:0,providerSpendUsd:0},null,2));

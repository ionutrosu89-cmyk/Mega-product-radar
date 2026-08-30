import fs from 'node:fs/promises';
import path from 'node:path';
import {calculateScreeningEconomics} from '../screening-economics-v1.js';
import {resolveFreightEstimate,resolveDutyTaxProfile,resolveMarketplaceFeeProfile} from '../screening-assumption-profiles-v1.js';
import {validateScreeningMarketContext} from '../screening-market-context-v1.js';
import {validateSecondaryRomaniaScreeningPrice} from '../romania-screening-price-evidence-v1.js';

const matchPath=process.argv[2]||'artifacts/match/secondary-corroborated-match.json';
const outPath=process.argv[3]||'artifacts/first-screening-with-secondary-romania-price.json';
const economicsEvidencePath=process.argv[4]||'data/v2-public-economics-evidence-2026-08-29.json';
const roPricePath=process.argv[5]||'data/v2-secondary-romania-screening-price-2026-08-30.json';
const [matchDoc,evidencePack,roPricePack]=await Promise.all([
  fs.readFile(matchPath,'utf8').then(JSON.parse),
  fs.readFile(economicsEvidencePath,'utf8').then(JSON.parse),
  fs.readFile(roPricePath,'utf8').then(JSON.parse)
]);

const target=matchDoc.target||{};
const match=matchDoc.match||{};
if(match.screeningEconomicsEligible!==true||Number(match.matchConfidence)<80)throw new Error('MATCH_NOT_SCREENING_ELIGIBLE');
if(String(target.amazonAsin)!=='B09K5927B5'||String(target.supplierListingKey)!=='1601573810318')throw new Error('UNEXPECTED_TARGET_PAIR');
if(String(roPricePack?.target?.amazonAsin)!==String(target.amazonAsin)||String(roPricePack?.target?.supplierListingKey)!==String(target.supplierListingKey))throw new Error('ROMANIA_PRICE_TARGET_MISMATCH');

const roPrice=validateSecondaryRomaniaScreeningPrice(roPricePack.observation||{}, {maxFreshnessDays:30});
if(roPrice.status!=='SCREENING_ELIGIBLE')throw new Error(`ROMANIA_SECONDARY_PRICE_NOT_ELIGIBLE:${roPrice.blockers.join(',')}`);

const fx=evidencePack?.evidence?.fx||{};
const romaniaVat=evidencePack?.evidence?.romaniaVat||{};
if(!(Number(fx.derivedUsdRon)>0)||!fx.sourceRef)throw new Error('FX_EVIDENCE_INVALID');
if(Number(romaniaVat.standardVatRate)!==0.21)throw new Error('ROMANIA_VAT_EVIDENCE_INVALID');

const supplierUsd=6.89;
const supplierUnitPriceRon=Number((supplierUsd*Number(fx.derivedUsdRon)).toFixed(4));
const marketContext=validateScreeningMarketContext({marketplaceMarket:'RO',targetSellMarket:'RO',taxJurisdiction:'RO',marketplaceFeeMarket:'RO'});
if(marketContext.status!=='COHERENT')throw new Error(`ROMANIA_MARKET_CONTEXT_INVALID:${marketContext.blockers.join(',')}`);

const freightResolution=resolveFreightEstimate({});
const dutyTaxResolution=resolveDutyTaxProfile({});
const marketplaceFeeResolution=resolveMarketplaceFeeProfile({});

const economicsInput={
  supplierUnitPriceRon,
  sellPriceGrossRon:roPrice.priceRon,
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
  sellVatRate:Number(romaniaVat.standardVatRate),
  marketplaceCommissionRate:null,
  adsReserveRate:null,
  returnsReserveRate:null,
  warrantyReserveRate:null,
  otherReserveRate:null,
  importVatRecoverable:null,
  supplierPriceEvidenceRef:'https://www.alibaba.com/product-detail/Desk-Organizers-and-Accessories-5-Tier_1601573810318.html',
  marketplacePriceEvidenceRef:roPrice.sourceRef,
  freightAssumptionRef:null,
  dutyAssumptionRef:null,
  marketplaceFeeAssumptionRef:null,
  matchConfidence:Number(match.matchConfidence)
};
const economics=calculateScreeningEconomics(economicsInput);
if(economics.status!=='BLOCKED')throw new Error('ECONOMICS_MUST_REMAIN_BLOCKED_UNTIL_COST_ASSUMPTIONS_RESOLVE');
if(economics.blockers.includes('MISSING_SELLPRICEGROSSRON')||economics.blockers.includes('MARKETPLACE_PRICE_EVIDENCE_REQUIRED'))throw new Error('ROMANIA_SELL_PRICE_BLOCKER_NOT_RESOLVED');
if(economics.blockers.includes('MISSING_SUPPLIERUNITPRICERON'))throw new Error('SUPPLIER_FX_NORMALIZATION_FAILED');

const report={
  schemaVersion:'MPR_FIRST_SCREENING_WITH_SECONDARY_ROMANIA_PRICE_V1',
  generatedAt:new Date().toISOString(),
  target:{amazonAsin:target.amazonAsin,supplierListingKey:String(target.supplierListingKey),marketplaceTitle:target.marketplaceTitle,supplierTitle:target.supplierTitle},
  observed:{supplierPriceUsd:supplierUsd,supplierUnitPriceRon,supplierFxRef:fx.sourceRef,romaniaScreeningPrice:roPrice,matchConfidence:Number(match.matchConfidence)},
  marketContext,
  economics,
  assumptionResolvers:{freight:freightResolution,dutyTax:dutyTaxResolution,marketplaceFees:marketplaceFeeResolution},
  resolvedBlockers:['CURRENT_ROMANIA_SELL_PRICE_REQUIRED','SUPPLIER_USD_TO_RON_FX_REQUIRED'],
  remainingBlockerGroups:{
    freight:freightResolution.blockers||[],
    dutyTax:dutyTaxResolution.blockers||[],
    marketplaceFees:marketplaceFeeResolution.blockers||[],
    vatAndImportTreatment:['IMPORT_VAT_RECOVERABILITY_REQUIRED'],
    otherUnitCosts:['INSURANCE_PER_UNIT_REQUIRED','BROKERAGE_PER_UNIT_REQUIRED','DESTINATION_HANDLING_PER_UNIT_REQUIRED','DOMESTIC_TRANSPORT_PER_UNIT_REQUIRED','PACKAGING_PER_UNIT_REQUIRED','COMPLIANCE_RESERVE_PER_UNIT_REQUIRED','IMPORT_VAT_ADDITIONAL_BASE_PER_UNIT_REQUIRED']
  },
  decision:'BLOCKED_PENDING_PROVENANCE_BACKED_COST_ASSUMPTIONS',
  truthPolicy:{secondaryRomaniaPriceIsDirectObservation:false,secondaryRomaniaPriceIsConfirmedPrice:false,secondaryRomaniaPriceUsedForScreeningOnly:true,screeningEstimateIsConfirmedLandedCost:false,publicSupplierPriceIsVerifiedQuote:false,unknownEqualsZero:false,paidCallsTriggered:0,providerSpendUsd:0,purchaseAuthorized:false,negotiationIncluded:false}
};
await fs.mkdir(path.dirname(outPath),{recursive:true});
await fs.writeFile(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({decision:report.decision,romaniaPriceRon:roPrice.priceRon,romaniaPriceEvidenceClass:roPrice.evidenceClass,supplierUnitPriceRon,remainingEngineBlockers:economics.blockers,paidCallsTriggered:0,providerSpendUsd:0},null,2));

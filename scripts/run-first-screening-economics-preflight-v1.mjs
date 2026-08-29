import fs from 'node:fs/promises';
import path from 'node:path';
import {calculateScreeningEconomics} from '../screening-economics-v1.js';
import {resolveFreightEstimate,resolveDutyTaxProfile,resolveMarketplaceFeeProfile} from '../screening-assumption-profiles-v1.js';

const matchPath=process.argv[2]||'artifacts/match/secondary-corroborated-match.json';
const outPath=process.argv[3]||'artifacts/first-screening-economics-preflight.json';
const matchDoc=JSON.parse(await fs.readFile(matchPath,'utf8'));
const target=matchDoc.target||{};
const match=matchDoc.match||{};
if(match.screeningEconomicsEligible!==true||Number(match.matchConfidence)<80)throw new Error('MATCH_NOT_SCREENING_ELIGIBLE');
if(String(target.amazonAsin)!=='B09K5927B5'||String(target.supplierListingKey)!=='1601573810318')throw new Error('UNEXPECTED_TARGET_PAIR');

// The real observed prices are preserved in source currency. No FX, freight, duty/tax,
// VAT treatment or marketplace fee value is fabricated here.
const observed={
  marketplacePrice:{value:Number(target.marketplacePrice),currency:'USD',evidenceClass:'PUBLIC_MARKETPLACE_LISTING_PRICE',sourceRef:`https://www.amazon.com/dp/${target.amazonAsin}`},
  supplierPrice:{value:6.89,currency:'USD',moq:100,evidenceClass:'PUBLIC_SUPPLIER_LISTING_PRICE_CONSERVATIVE_APPLICABLE_TIER',sourceRef:'https://www.alibaba.com/product-detail/Desk-Organizers-and-Accessories-5-Tier_1601573810318.html'},
  matchConfidence:Number(match.matchConfidence)
};
if(observed.marketplacePrice.value!==23.99)throw new Error(`UNEXPECTED_MARKETPLACE_PRICE:${observed.marketplacePrice.value}`);

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
  marketplacePriceEvidenceRef:observed.marketplacePrice.sourceRef,
  freightAssumptionRef:null,
  dutyAssumptionRef:null,
  marketplaceFeeAssumptionRef:null,
  matchConfidence:observed.matchConfidence
};
const economics=calculateScreeningEconomics(economicsInput);
if(economics.status!=='BLOCKED')throw new Error('PREFLIGHT_MUST_REMAIN_BLOCKED_WITHOUT_ASSUMPTIONS');

const blockerGroups={
  currencyNormalization:['SUPPLIER_USD_TO_RON_FX_REQUIRED','MARKETPLACE_USD_TO_RON_FX_REQUIRED'],
  freight:freightResolution.blockers||[],
  dutyTax: dutyTaxResolution.blockers||[],
  marketplaceFees:marketplaceFeeResolution.blockers||[],
  vatAndImportTreatment:['SELL_VAT_RATE_REQUIRED','IMPORT_VAT_RECOVERABILITY_REQUIRED'],
  otherUnitCosts:['INSURANCE_PER_UNIT_REQUIRED','BROKERAGE_PER_UNIT_REQUIRED','DESTINATION_HANDLING_PER_UNIT_REQUIRED','DOMESTIC_TRANSPORT_PER_UNIT_REQUIRED','PACKAGING_PER_UNIT_REQUIRED','COMPLIANCE_RESERVE_PER_UNIT_REQUIRED','IMPORT_VAT_ADDITIONAL_BASE_PER_UNIT_REQUIRED']
};
const report={
  schemaVersion:'MPR_FIRST_SCREENING_ECONOMICS_PREFLIGHT_V1',generatedAt:new Date().toISOString(),
  target:{amazonAsin:target.amazonAsin,supplierListingKey:String(target.supplierListingKey),marketplaceTitle:target.marketplaceTitle,supplierTitle:target.supplierTitle},
  observed,
  assumptionResolvers:{freight:freightResolution,dutyTax:dutyTaxResolution,marketplaceFees:marketplaceFeeResolution},
  economics,
  blockerGroups,
  nextEvidenceRequired:[
    'FX profile with explicit source/timestamp for USD→RON normalization',
    'freight estimate with explicit sourceRef/confidence and package weight or category fallback',
    'duty/import VAT profile with explicit sourceRef/confidence and classification status',
    'marketplace fee profile with commission, fulfillment and reserve assumptions plus sourceRef/confidence',
    'sell VAT/import VAT recoverability treatment appropriate to the intended selling market/entity',
    'explicit non-negative per-unit import/handling/packaging/compliance assumptions with provenance'
  ],
  decision:'BLOCKED_PENDING_PROVENANCE_BACKED_ASSUMPTIONS',
  truthPolicy:{matchIsConfirmedCrossMarketIdentity:false,screeningEstimateIsConfirmedLandedCost:false,publicSupplierPriceIsVerifiedQuote:false,marketplacePriceIsRealizedSale:false,unknownEqualsZero:false,syntheticTestValuesUsedAsCommercialFacts:false,paidCallsTriggered:0,providerSpendUsd:0,purchaseAuthorized:false,negotiationIncluded:false}
};
await fs.mkdir(path.dirname(outPath),{recursive:true});
await fs.writeFile(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({decision:report.decision,matchConfidence:observed.matchConfidence,marketplacePrice:observed.marketplacePrice,supplierPrice:observed.supplierPrice,engineBlockers:economics.blockers,blockerGroups,paidCallsTriggered:0,providerSpendUsd:0},null,2));

import fs from 'node:fs/promises';
import path from 'node:path';
import {calculateScreeningEconomics} from '../screening-economics-v1.js';
import {resolveFreightEstimate,resolveDutyTaxProfile,resolveMarketplaceFeeProfile} from '../screening-assumption-profiles-v1.js';
import {validateSecondaryRomaniaScreeningPrice} from '../romania-screening-price-evidence-v1.js';

const matchPath=process.argv[2]||'artifacts/match/secondary-corroborated-match.json';
const outPath=process.argv[3]||'artifacts/first-complete-conservative-screen.json';
const economicsEvidencePath=process.argv[4]||'data/v2-public-economics-evidence-2026-08-29.json';
const roPricePath=process.argv[5]||'data/v2-secondary-romania-screening-price-2026-08-30.json';
const policyPath=process.argv[6]||'data/v2-first-conservative-screening-policy-2026-08-30.json';
const [matchDoc,evidencePack,roPricePack,policy]=await Promise.all([
  fs.readFile(matchPath,'utf8').then(JSON.parse),
  fs.readFile(economicsEvidencePath,'utf8').then(JSON.parse),
  fs.readFile(roPricePath,'utf8').then(JSON.parse),
  fs.readFile(policyPath,'utf8').then(JSON.parse)
]);

const target=matchDoc.target||{};
const match=matchDoc.match||{};
if(match.screeningEconomicsEligible!==true||Number(match.matchConfidence)<80)throw new Error('MATCH_NOT_SCREENING_ELIGIBLE');
if(String(target.amazonAsin)!=='B09K5927B5'||String(target.supplierListingKey)!=='1601573810318')throw new Error('UNEXPECTED_TARGET_PAIR');
if(String(policy?.target?.amazonAsin)!==String(target.amazonAsin)||String(policy?.target?.supplierListingKey)!==String(target.supplierListingKey))throw new Error('POLICY_TARGET_MISMATCH');

const roPrice=validateSecondaryRomaniaScreeningPrice(roPricePack.observation||{}, {maxFreshnessDays:30});
if(roPrice.status!=='SCREENING_ELIGIBLE')throw new Error(`ROMANIA_PRICE_NOT_SCREENING_ELIGIBLE:${roPrice.blockers.join(',')}`);
const fx=Number(evidencePack?.evidence?.fx?.derivedUsdRon);
const fxRef=evidencePack?.evidence?.fx?.sourceRef;
const sellVatRate=Number(evidencePack?.evidence?.romaniaVat?.standardVatRate);
if(!(fx>0)||!fxRef||sellVatRate!==0.21)throw new Error('PUBLIC_ECONOMICS_EVIDENCE_INVALID');

const supplierUsd=6.89;
const supplierUnitPriceRon=Number((supplierUsd*fx).toFixed(4));
const dims=policy.freight.dimensionsCm;
const volumeCm3=Number(dims.length)*Number(dims.width)*Number(dims.height);
const airUsdPerKg=Number(policy.freight.chinaEuropeAirUsdPerKg);
const routingBuffer=Number(policy.freight.romaniaRoutingBufferMultiplier);
const ratePerKgRon=airUsdPerKg*routingBuffer*fx;
const freightSourceRef=`${policy.freight.rateSource} | ${policy.freight.volumetricDivisorSource} | MPR_ROUTING_BUFFER_${routingBuffer}X`;
const freight=resolveFreightEstimate({
  volumeCm3,
  volumetricDivisor:Number(policy.freight.volumetricDivisorCm3PerKg),
  ratePerKgRon,
  minimumPerUnitRon:0,
  sourceRef:freightSourceRef,
  confidence:policy.freight.confidence
});
if(freight.status!=='RESOLVED')throw new Error(`FREIGHT_UNRESOLVED:${freight.blockers.join(',')}`);

const dutyTax=resolveDutyTaxProfile({
  dutyRate:Number(policy.dutyTax.dutyRate),
  importVatRate:Number(policy.dutyTax.importVatRate),
  classificationRef:policy.dutyTax.classificationRef,
  classificationConfirmed:policy.dutyTax.classificationConfirmed===true,
  sourceRef:`${policy.dutyTax.dutySource} | ${policy.dutyTax.vatSource} | ${policy.dutyTax.dutyEvidenceClass}`,
  confidence:policy.dutyTax.confidence
});
if(dutyTax.status!=='RESOLVED')throw new Error(`DUTY_TAX_UNRESOLVED:${dutyTax.blockers.join(',')}`);

const marketplace=resolveMarketplaceFeeProfile({
  commissionRate:Number(policy.marketplace.commissionRate),
  fulfillmentPerUnitRon:Number(policy.marketplace.fulfillmentPerUnitRon),
  adsReserveRate:Number(policy.marketplace.adsReserveRate),
  returnsReserveRate:Number(policy.marketplace.returnsReserveRate),
  warrantyReserveRate:Number(policy.marketplace.warrantyReserveRate),
  otherReserveRate:Number(policy.marketplace.otherReserveRate),
  sourceRef:`${policy.marketplace.commissionSource} | ${policy.marketplace.fulfillmentSource} | ${policy.marketplace.reserveEvidenceClass}`,
  confidence:policy.marketplace.confidence
});
if(marketplace.status!=='RESOLVED')throw new Error(`MARKETPLACE_PROFILE_UNRESOLVED:${marketplace.blockers.join(',')}`);

const other=policy.otherUnitCosts;
const economicsInput={
  supplierUnitPriceRon,
  sellPriceGrossRon:Number(roPrice.priceRon),
  freightPerUnitRon:Number(freight.value),
  insurancePerUnitRon:Number((supplierUnitPriceRon*Number(other.insuranceRateOfSupplierCost)).toFixed(4)),
  brokeragePerUnitRon:Number(other.brokeragePerUnitRon),
  destinationHandlingPerUnitRon:Number(other.destinationHandlingPerUnitRon),
  domesticTransportPerUnitRon:Number(other.domesticTransportPerUnitRon),
  packagingPerUnitRon:Number(other.packagingPerUnitRon),
  complianceReservePerUnitRon:Number(other.complianceReservePerUnitRon),
  importVatAdditionalBasePerUnitRon:Number(other.importVatAdditionalBasePerUnitRon),
  fulfillmentPerUnitRon:Number(marketplace.value.fulfillmentPerUnitRon),
  dutyRate:Number(dutyTax.value.dutyRate),
  importVatRate:Number(dutyTax.value.importVatRate),
  sellVatRate,
  marketplaceCommissionRate:Number(marketplace.value.marketplaceCommissionRate),
  adsReserveRate:Number(marketplace.value.adsReserveRate),
  returnsReserveRate:Number(marketplace.value.returnsReserveRate),
  warrantyReserveRate:Number(marketplace.value.warrantyReserveRate),
  otherReserveRate:Number(marketplace.value.otherReserveRate),
  importVatRecoverable:policy.dutyTax.importVatRecoverable===true,
  supplierPriceEvidenceRef:'https://www.alibaba.com/product-detail/Desk-Organizers-and-Accessories-5-Tier_1601573810318.html',
  marketplacePriceEvidenceRef:roPrice.sourceRef,
  freightAssumptionRef:freight.sourceRef,
  dutyAssumptionRef:dutyTax.sourceRef,
  marketplaceFeeAssumptionRef:marketplace.sourceRef,
  matchConfidence:Number(match.matchConfidence)
};
const economics=calculateScreeningEconomics(economicsInput);
if(economics.status!=='SCREENED')throw new Error(`FIRST_COMPLETE_SCREEN_FAILED:${economics.blockers?.join(',')}`);

const conservative=economics.scenarios.conservative;
const qualifies=conservative.roi>=0.8&&conservative.netMargin>=0.25;
const report={
  schemaVersion:'MPR_FIRST_COMPLETE_CONSERVATIVE_SCREEN_V1',
  generatedAt:new Date().toISOString(),
  target:{amazonAsin:target.amazonAsin,supplierListingKey:String(target.supplierListingKey),marketplaceTitle:target.marketplaceTitle,supplierTitle:target.supplierTitle},
  inputs:{supplierUsd,supplierUnitPriceRon,romaniaScreeningPrice:roPrice,volumeCm3,freightRateUsdPerKg:airUsdPerKg,routingBuffer,fxUsdRon:fx},
  resolutions:{freight,dutyTax,marketplace,otherUnitCosts:{...other}},
  economics,
  opportunityGate:{thresholds:{roi:0.8,netMargin:0.25},qualifies,decision:qualifies?'SCREENING_OPPORTUNITY':'REJECT_CONSERVATIVE_ECONOMICS'},
  truthPolicy:{...policy.truthPolicy,secondaryRomaniaPriceIsConfirmed:false,screeningOpportunityIsFinalist:false,screeningRejectIsPermanentProductVerdict:false,verifiedSales:false,paidCallsTriggered:0,providerSpendUsd:0,purchaseAuthorized:false,negotiationIncluded:false}
};
await fs.mkdir(path.dirname(outPath),{recursive:true});
await fs.writeFile(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:economics.status,decision:report.opportunityGate.decision,sellPriceRon:roPrice.priceRon,supplierUnitPriceRon,freightPerUnitRon:freight.value,conservative,qualifies,paidCallsTriggered:0,providerSpendUsd:0},null,2));

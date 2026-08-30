import fs from 'node:fs/promises';
import path from 'node:path';
import {calculateScreeningEconomics} from '../screening-economics-v1.js';
import {resolveFreightEstimate,resolveDutyTaxProfile,resolveMarketplaceFeeProfile} from '../screening-assumption-profiles-v1.js';

const packPath=process.argv[2]||'artifacts/pack/opportunity-pack-live.json';
const evidencePath=process.argv[3]||'data/v2-public-economics-evidence-2026-08-29.json';
const defaultsPath=process.argv[4]||'data/v2-conservative-screening-defaults-v1.json';
const outPath=process.argv[5]||'artifacts/opportunity-economics-live.json';
const sourcePackRunId=process.argv[6]||null;
const [pack,evidence,defaults]=await Promise.all([fs.readFile(packPath,'utf8').then(JSON.parse),fs.readFile(evidencePath,'utf8').then(JSON.parse),fs.readFile(defaultsPath,'utf8').then(JSON.parse)]);

const common={schemaVersion:'MPR_OPPORTUNITY_ECONOMICS_LIVE_V1',generatedAt:new Date().toISOString(),target:pack.target||null,source:{opportunityPackWorkflowRunId:sourcePackRunId?Number(sourcePackRunId):null,rematchWorkflowRunId:pack?.source?.rematchWorkflowRunId??null},rankingScenario:'CONSERVATIVE',purchaseAuthorized:false,truthPolicy:{...defaults.truthPolicy,upstreamPackRequired:true,screeningOpportunityIsFinalist:false,screeningRejectIsPermanentProductVerdict:false,paidCallsTriggered:0,providerSpendUsd:0,purchaseAuthorized:false,unknownEqualsZero:false}};
if(pack.status!=='ECONOMICS_READY'||pack.economicsAllowed!==true){
  const output={...common,status:'BLOCKED_UPSTREAM_OPPORTUNITY_PACK',upstreamStatus:pack.status,upstreamBlockers:pack.blockers||[],economics:null,decision:'VALIDATE',reason:'Opportunity Pack has not passed supplier identity/dimensions/match/market gates.'};
  await fs.mkdir(path.dirname(outPath),{recursive:true});await fs.writeFile(outPath,JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({status:output.status,blockers:output.upstreamBlockers,decision:output.decision,source:output.source},null,2));
  process.exit(0);
}

const fx=Number(evidence?.evidence?.fx?.derivedUsdRon),fxRef=evidence?.evidence?.fx?.sourceRef;
const sellVatRate=Number(evidence?.evidence?.romaniaVat?.standardVatRate),vatRef=evidence?.evidence?.romaniaVat?.sourceRef;
if(!(fx>0)||!fxRef||!(sellVatRate>0)||!vatRef)throw new Error('PUBLIC_ECONOMICS_EVIDENCE_INVALID');
const supplierUsd=Number(pack?.supplier?.unitPriceUsd),sellPriceRon=Number(pack?.romaniaPrice?.grossRon);
const dims=pack?.directSupplierEvidence?.assembledDimensionsCm||{};
const length=Number(dims.lengthCm),width=Number(dims.widthCm),height=Number(dims.heightCm);
if(!(supplierUsd>0)||!(sellPriceRon>0)||!(length>0&&width>0&&height>0))throw new Error('READY_PACK_MISSING_ECONOMICS_CRITICAL_INPUT');
const supplierUnitPriceRon=Number((supplierUsd*fx).toFixed(4));
const volumeCm3=length*width*height;
const actualWeightKg=Number(pack?.directSupplierEvidence?.netWeightGrams)>0?Number(pack.directSupplierEvidence.netWeightGrams)/1000:null;
const f=defaults.freight,ratePerKgRon=Number(f.chinaEuropeAirUsdPerKg)*Number(f.romaniaRoutingBufferMultiplier)*fx;
const freight=resolveFreightEstimate({actualWeightKg,volumeCm3,volumetricDivisor:Number(f.volumetricDivisorCm3PerKg),ratePerKgRon,minimumPerUnitRon:0,sourceRef:`${f.rateSource} | ${f.volumetricDivisorSource} | MPR_ROUTING_BUFFER_${f.romaniaRoutingBufferMultiplier}X`,confidence:f.confidence});
if(freight.status!=='RESOLVED')throw new Error(`FREIGHT_UNRESOLVED:${freight.blockers.join(',')}`);
const d=defaults.dutyTax,dutyTax=resolveDutyTaxProfile({dutyRate:Number(d.dutyRate),importVatRate:Number(d.importVatRate),classificationRef:d.classificationRef,classificationConfirmed:d.classificationConfirmed===true,sourceRef:`${d.dutySource} | ${vatRef} | ${d.dutyEvidenceClass}`,confidence:d.confidence});
if(dutyTax.status!=='RESOLVED')throw new Error(`DUTY_TAX_UNRESOLVED:${dutyTax.blockers.join(',')}`);
const m=defaults.marketplace,marketplace=resolveMarketplaceFeeProfile({commissionRate:Number(m.commissionRate),fulfillmentPerUnitRon:Number(m.fulfillmentPerUnitRon),adsReserveRate:Number(m.adsReserveRate),returnsReserveRate:Number(m.returnsReserveRate),warrantyReserveRate:Number(m.warrantyReserveRate),otherReserveRate:Number(m.otherReserveRate),sourceRef:`${m.commissionSource} | ${m.fulfillmentSource} | ${m.reserveEvidenceClass}`,confidence:m.confidence});
if(marketplace.status!=='RESOLVED')throw new Error(`MARKETPLACE_PROFILE_UNRESOLVED:${marketplace.blockers.join(',')}`);
const other=defaults.otherUnitCosts;
const economics=calculateScreeningEconomics({supplierUnitPriceRon,sellPriceGrossRon:sellPriceRon,freightPerUnitRon:Number(freight.value),insurancePerUnitRon:Number((supplierUnitPriceRon*Number(other.insuranceRateOfSupplierCost)).toFixed(4)),brokeragePerUnitRon:Number(other.brokeragePerUnitRon),destinationHandlingPerUnitRon:Number(other.destinationHandlingPerUnitRon),domesticTransportPerUnitRon:Number(other.domesticTransportPerUnitRon),packagingPerUnitRon:Number(other.packagingPerUnitRon),complianceReservePerUnitRon:Number(other.complianceReservePerUnitRon),importVatAdditionalBasePerUnitRon:Number(other.importVatAdditionalBasePerUnitRon),fulfillmentPerUnitRon:Number(marketplace.value.fulfillmentPerUnitRon),dutyRate:Number(dutyTax.value.dutyRate),importVatRate:Number(dutyTax.value.importVatRate),sellVatRate,marketplaceCommissionRate:Number(marketplace.value.marketplaceCommissionRate),adsReserveRate:Number(marketplace.value.adsReserveRate),returnsReserveRate:Number(marketplace.value.returnsReserveRate),warrantyReserveRate:Number(marketplace.value.warrantyReserveRate),otherReserveRate:Number(marketplace.value.otherReserveRate),importVatRecoverable:d.importVatRecoverable===true,supplierPriceEvidenceRef:pack?.inputEvidence?.supplierPriceEvidenceClass||'SUPPLIER_EVIDENCE',marketplacePriceEvidenceRef:pack?.romaniaPriceEvidence?.source||'ROMANIA_PRICE_EVIDENCE',freightAssumptionRef:freight.sourceRef,dutyAssumptionRef:dutyTax.sourceRef,marketplaceFeeAssumptionRef:marketplace.sourceRef,matchConfidence:Number(pack?.match?.confidence)});
if(economics.status!=='SCREENED')throw new Error(`ECONOMICS_NOT_SCREENED:${(economics.blockers||[]).join(',')}`);
const conservative=economics.scenarios.conservative;
const thresholds=defaults.opportunityThresholds,qualifies=conservative.roi>=Number(thresholds.minimumConservativeRoi)&&conservative.netMargin>=Number(thresholds.minimumConservativeNetMargin);
const output={...common,status:'SCREENED',inputs:{supplierUsd,supplierUnitPriceRon,sellPriceRon,dimensionsCm:{length,width,height},actualWeightKg,volumeCm3,fxUsdRon:fx},resolutions:{freight,dutyTax,marketplace},economics,opportunityGate:{thresholds:{roi:Number(thresholds.minimumConservativeRoi),netMargin:Number(thresholds.minimumConservativeNetMargin)},qualifies,decision:qualifies?'SCREENING_OPPORTUNITY':'REJECT_CONSERVATIVE_ECONOMICS'}};
await fs.mkdir(path.dirname(outPath),{recursive:true});await fs.writeFile(outPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({status:output.status,decision:output.opportunityGate.decision,conservative,source:output.source},null,2));

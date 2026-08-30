import fs from 'node:fs/promises';
import path from 'node:path';
import {buildOpportunityPackGate} from '../opportunity-pack-gate-v1.js';
import {validateSecondaryRomaniaScreeningPrice} from '../romania-screening-price-evidence-v1.js';

const rematchPath=process.argv[2]||'artifacts/rematch/current-engine-rematch-top10.json';
const validationPath=process.argv[3]||'supplier-validation-live.json';
const roPricePath=process.argv[4]||'data/v2-secondary-romania-screening-price-2026-08-30.json';
const baseInputPath=process.argv[5]||'data/opportunity-packs/B09K5927B5.input.json';
const outputPath=process.argv[6]||'artifacts/opportunity-pack-live.json';
const sourceWorkflowRunId=process.argv[7]||null;

const [rematch,validation,roPack,base]=await Promise.all([
  fs.readFile(rematchPath,'utf8').then(JSON.parse),
  fs.readFile(validationPath,'utf8').then(JSON.parse),
  fs.readFile(roPricePath,'utf8').then(JSON.parse),
  fs.readFile(baseInputPath,'utf8').then(JSON.parse)
]);

const asin=String(base?.target?.asin||'B09K5927B5');
const supplierId=String(base?.supplier?.externalId||'1600756221959');
const row=(rematch.rows||[]).find(x=>String(x.amazonAsin)===asin&&String(x.supplierListingKey)===supplierId);
if(!row)throw new Error(`TARGET_PAIR_NOT_FOUND:${asin}:${supplierId}`);
const validationCandidate=(validation.candidates||[]).find(x=>String(x.externalId)===supplierId);
if(!validationCandidate)throw new Error(`SUPPLIER_VALIDATION_NOT_FOUND:${supplierId}`);

const identityBlockers=new Set(['FIVE_TIER_EVIDENCE_REQUIRED','DRAWER_EVIDENCE_REQUIRED','PEN_HOLDER_EVIDENCE_REQUIRED','TWO_PEN_HOLDERS_EXPLICIT_EVIDENCE_REQUIRED','ORGANIZER_IDENTITY_EVIDENCE_REQUIRED']);
const identityGaps=(validationCandidate.blockers||[]).filter(x=>identityBlockers.has(x));
const exactConfigurationConfirmed=identityGaps.length===0;
const dims=row?.supplierEvidence?.dimensions||null;
const replyOverlay=row?.supplierEvidence?.replyOverlay||null;
const roValidated=validateSecondaryRomaniaScreeningPrice(roPack.observation||{},{maxFreshnessDays:30});
if(roValidated.status!=='SCREENING_ELIGIBLE')throw new Error(`ROMANIA_PRICE_NOT_SCREENING_ELIGIBLE:${roValidated.blockers.join(',')}`);

let unitPriceUsd=Number(base?.supplier?.unitPriceUsd);
let moq=Number(base?.supplier?.moq);
let priceEvidenceClass=String(base?.supplier?.priceEvidenceClass||'HISTORICAL_DIRECT_SUPPLIER_DETAIL');
if(replyOverlay?.quote?.unitPrice&&Number(replyOverlay.quote.unitPrice)>0){
  unitPriceUsd=Number(replyOverlay.quote.unitPrice);
  if(Number(replyOverlay.quote.moq)>0)moq=Number(replyOverlay.quote.moq);
  priceEvidenceClass='SUPPLIER_DIRECT_REPLY_EVIDENCE';
}

const directSupplierEvidence={
  provenanceMatched:true,
  exactConfigurationConfirmed,
  assembledDimensionsCm:dims,
  netWeightGrams:row?.supplierEvidence?.unitWeightGrams??null,
  evidenceClass:replyOverlay?.applied?'SUPPLIER_DIRECT_REPLY_EVIDENCE':(dims?'HISTORICAL_DIRECT_SUPPLIER_DETAIL':'DIRECT_DIMENSIONS_NOT_YET_AVAILABLE'),
  source:replyOverlay?.sourceRef||'current rematch + exact supplier validation binding'
};
const input={
  target:{marketplace:'AMAZON_US',asin},
  supplier:{externalId:supplierId,supplierName:validationCandidate.supplierName||base?.supplier?.supplierName||'',unitPriceUsd,moq,priceEvidenceClass},
  directSupplierEvidence,
  match:row.match||{},
  romaniaPrice:{grossRon:roValidated.priceRon,evidenceClass:'SECONDARY_SCREENING_PRICE',source:roValidated.sourceRef},
  freight:base.freight||{},
  purchaseAuthorized:false
};
const gate=buildOpportunityPackGate(input);
const output={
  ...gate,
  schemaVersion:'MPR_OPPORTUNITY_PACK_LIVE_V1',
  updatedAt:new Date().toISOString(),
  target:input.target,
  directSupplierEvidence,
  freight:input.freight,
  romaniaPriceEvidence:{...input.romaniaPrice,validatedEvidenceClass:roValidated.evidenceClass,confidence:roValidated.confidence},
  source:{rematchWorkflowRunId:sourceWorkflowRunId?Number(sourceWorkflowRunId):null,rematchGeneratedAt:rematch.generatedAt||null,validationUpdatedAt:validation.updatedAt||null,romaniaPriceRetrievedAt:roValidated.retrievedAt||null},
  inputEvidence:{supplierPriceEvidenceClass:priceEvidenceClass,directSupplierEvidenceClass:directSupplierEvidence.evidenceClass,romaniaPriceEvidenceClass:roValidated.evidenceClass,freightEvidenceClass:input.freight.evidenceClass||null},
  identityGaps,
  purchaseAuthorized:false
};
await fs.mkdir(path.dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({status:output.status,blockers:output.blockers,supplier:output.supplier,match:output.match,inputEvidence:output.inputEvidence,source:output.source},null,2));

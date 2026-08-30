import fs from 'node:fs/promises';
import path from 'node:path';

const inputPath=process.argv[2]||'artifacts/focused-supplier-evidence-discovery.json';
const outputPath=process.argv[3]||'supplier-validation-live.json';
const source=JSON.parse(await fs.readFile(inputPath,'utf8'));

const cleanText=v=>String(v??'').trim();
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const allowedBlockers=new Set([
  'FIVE_TIER_EVIDENCE_REQUIRED','DRAWER_EVIDENCE_REQUIRED','PEN_HOLDER_EVIDENCE_REQUIRED',
  'TWO_PEN_HOLDERS_EXPLICIT_EVIDENCE_REQUIRED','ORGANIZER_IDENTITY_EVIDENCE_REQUIRED',
  'DIRECT_SUPPLIER_DETAIL_EVIDENCE_REQUIRED','DIRECT_SUPPLIER_DIMENSIONS_REQUIRED'
]);
const allowedEvidenceClasses=new Set(['PUBLIC_SUPPLIER_INDEX_CARD_EVIDENCE','PUBLIC_SUPPLIER_EMBEDDED_PRODUCT_RECORD_EVIDENCE','PUBLIC_SUPPLIER_INDEX_CORROBORATED_COMMERCIAL_EVIDENCE','PUBLIC_SUPPLIER_EXACT_TITLE_CORROBORATED_COMMERCIAL_EVIDENCE']);
const evidenceClassOf=x=>allowedEvidenceClasses.has(cleanText(x?.evidenceClass))?cleanText(x.evidenceClass):'PUBLIC_SUPPLIER_INDEX_CARD_EVIDENCE';
const candidates=(Array.isArray(source.validationQueue)?source.validationQueue:[]).slice(0,20).map(x=>({
  externalId:cleanText(x.externalId),
  platform:'ALIBABA',
  title:cleanText(x.title),
  supplierName:cleanText(x.supplierName),
  productUrl:cleanText(x.url),
  sourceUrl:cleanText(x.sourceUrl),
  publicPrice:x.publicPriceCandidate?{currency:cleanText(x.publicPriceCandidate.currency||'USD'),min:finite(x.publicPriceCandidate.min),max:finite(x.publicPriceCandidate.max)}:null,
  moq:x.moqCandidate?{value:finite(x.moqCandidate.value)}:null,
  evidenceClass:evidenceClassOf(x),
  funnelState:'VALIDATE',
  validationStatus:'EVIDENCE_INCOMPLETE_NOT_MATCHED',
  blockers:(Array.isArray(x.validationBlockers)?x.validationBlockers:[]).filter(v=>allowedBlockers.has(v)),
  missingDistinctiveEvidence:Array.isArray(x.missingDistinctiveEvidence)?x.missingDistinctiveEvidence.map(cleanText).filter(Boolean):[],
  canPromoteToMatch:false,
  canAuthorizeEconomics:false,
  purchaseAuthorized:false
})).filter(x=>x.externalId&&x.title&&x.blockers.length);

const output={
  schemaVersion:'MPR_SUPPLIER_VALIDATION_LIVE_V1',
  updatedAt:source.generatedAt||new Date().toISOString(),
  target:{marketplace:cleanText(source?.target?.marketplace),amazonAsin:cleanText(source?.target?.amazonAsin)},
  integrity:{
    evidenceClasses:[...allowedEvidenceClasses],
    indexEmbeddedOrCorroboratedEvidenceIsDirectDetail:false,
    exactTitleCorroboratedEvidenceIsDirectDetail:false,
    exactTitleCorroboratedEvidenceCanAuthorizeMatch:false,
    exactTitleCorroboratedEvidenceCanAuthorizeEconomics:false,
    validationQueueIsMatchEvidence:false,
    validationQueueCanAuthorizeEconomics:false,
    validationQueueCanAuthorizePurchase:false,
    unknownEqualsZero:false,
    matchingThresholdRelaxed:false,
    providerSpendUsd:0
  },
  candidates
};
await fs.mkdir(path.dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({schemaVersion:output.schemaVersion,candidates:candidates.length,updatedAt:output.updatedAt},null,2));

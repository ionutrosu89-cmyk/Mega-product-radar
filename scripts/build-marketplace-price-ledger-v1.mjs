import fs from 'node:fs';
import path from 'node:path';
import {adaptAmazonLiveRefreshObservation,buildMarketplacePriceLedger,normalizeMarketplaceListingSnapshot} from '../marketplace-price-ledger-v1.js';

const arg=(name,fallback=null)=>{const hit=process.argv.find(x=>x.startsWith(`--${name}=`));return hit?hit.slice(name.length+3):fallback;};
const inputs=String(arg('input','')).split(',').map(x=>x.trim()).filter(Boolean);
const out=arg('out','artifacts/marketplace-price-ledger-v1.json');
if(!inputs.length)throw new Error('INPUT_REQUIRED: --input=file.json[,file2.json]');

function rowsFromDocument(doc,file){
  if(doc?.schemaVersion==='AMAZON_LIVE_REFRESH_BATCH_V1'){
    return (doc.observations||[]).map(adaptAmazonLiveRefreshObservation);
  }
  if(doc?.schemaVersion==='MPR_MARKETPLACE_LISTING_SNAPSHOT_V1')return [doc];
  if(doc?.schemaVersion==='MPR_MARKETPLACE_PRICE_LEDGER_INPUT_V1'){
    return (doc.observations||[]).map(normalizeMarketplaceListingSnapshot);
  }
  throw new Error(`UNSUPPORTED_INPUT_SCHEMA: ${file}: ${doc?.schemaVersion||'UNKNOWN'}`);
}

const rows=[];
const sourceFiles=[];
for(const file of inputs){
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  const extracted=rowsFromDocument(doc,file);
  rows.push(...extracted);
  sourceFiles.push({file:path.normalize(file),schemaVersion:doc.schemaVersion||null,inputRows:extracted.length});
}
const ledger=buildMarketplacePriceLedger(rows);
const payload={
  ...ledger,
  generatedAt:new Date().toISOString(),
  sourceFiles,
  policy:{
    adapterOnly:true,
    networkCallsTriggered:0,
    paidCallsTriggered:0,
    providerSpendUsd:0,
    discoveryOnlyArtifactsPromotedToPriceEvidence:false,
    reviewOrRankEqualsVerifiedSales:false,
    purchaseAuthorized:false
  }
};
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify({out,sourceFiles:sourceFiles.length,inputRows:rows.length,listingCount:payload.listingCount,snapshotCount:payload.snapshotCount,rejectedCount:payload.rejectedCount,unresolvedCanonicalListingCount:payload.unresolvedCanonicalListingCount},null,2));

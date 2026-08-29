import fs from 'node:fs';
import path from 'node:path';
import {buildSupplierPriceLedger,normalizeSupplierCandidatePriceSnapshot} from '../supplier-price-ledger-v1.js';

const arg=(name,fallback=null)=>{const hit=process.argv.find(x=>x.startsWith(`--${name}=`));return hit?hit.slice(name.length+3):fallback;};
const inputs=String(arg('input','')).split(',').map(x=>x.trim()).filter(Boolean);
const out=arg('out','artifacts/supplier-price-ledger-v1.json');
if(!inputs.length)throw new Error('INPUT_REQUIRED: --input=file.json[,file2.json]');

function extract(doc,file){
  if(doc?.schemaVersion==='MPR_SUPPLIER_CANDIDATE_PRICE_SNAPSHOT_V1')return [doc];
  if(doc?.schemaVersion==='MPR_SUPPLIER_PRICE_LEDGER_INPUT_V1')return (doc.observations||[]).map(normalizeSupplierCandidatePriceSnapshot);
  if(doc?.schemaVersion==='REAL_PUBLIC_SEED_1000_V2'){
    const alibaba=(doc.observations||[]).filter(x=>String(x?.platform||'').toUpperCase()==='ALIBABA');
    if(alibaba.length)throw new Error(`DISCOVERY_ONLY_INPUT_REFUSED: ${file}: REAL_PUBLIC_SEED_1000_V2 has Alibaba catalogue URLs but no verified public price/MOQ payload; refusing evidence upgrade`);
    return [];
  }
  throw new Error(`UNSUPPORTED_INPUT_SCHEMA: ${file}: ${doc?.schemaVersion||'UNKNOWN'}`);
}

const rows=[];const sourceFiles=[];
for(const file of inputs){
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  const extracted=extract(doc,file);
  rows.push(...extracted);
  sourceFiles.push({file:path.normalize(file),schemaVersion:doc.schemaVersion||null,inputRows:extracted.length});
}
const ledger=buildSupplierPriceLedger(rows);
const payload={...ledger,generatedAt:new Date().toISOString(),sourceFiles,policy:{networkCallsTriggered:0,paidCallsTriggered:0,providerSpendUsd:0,catalogueDiscoveryWithoutPricePromoted:false,verifiedQuote:false,landedCostConfirmed:false,negotiatedPriceIncluded:false,purchaseAuthorized:false}};
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify({out,sourceFiles:sourceFiles.length,inputRows:rows.length,supplierListingCount:payload.supplierListingCount,snapshotCount:payload.snapshotCount,linkedMarketplaceCanonicalProductCount:payload.linkedMarketplaceCanonicalProductCount,rejectedCount:payload.rejectedCount},null,2));

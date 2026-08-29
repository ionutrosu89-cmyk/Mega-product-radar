import fs from 'node:fs';
import path from 'node:path';
import {assessPricePairReadiness} from '../price-pair-readiness-v1.js';

const arg=(name,fallback)=>process.argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3)||fallback;
const root=path.resolve(arg('root','data'));
const outPath=path.resolve(arg('out','artifacts/price-pair-readiness-v1.json'));
const matchPath=arg('matches',null);

function walk(dir){
  if(!fs.existsSync(dir))return[];
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(full));
    else if(entry.isFile()&&entry.name.endsWith('.json'))out.push(full);
  }
  return out;
}

const marketplaceDocuments=[];
const supplierDocuments=[];
const diagnostics=[];
for(const file of walk(root)){
  try{
    const doc=JSON.parse(fs.readFileSync(file,'utf8'));
    if(doc?.schemaVersion==='MPR_MARKETPLACE_PRICE_LEDGER_V1')marketplaceDocuments.push(doc);
    if(doc?.schemaVersion==='MPR_SUPPLIER_PRICE_LEDGER_V1')supplierDocuments.push(doc);
  }catch{diagnostics.push({file:path.relative(process.cwd(),file),status:'JSON_PARSE_FAILED'});}
}
let matchRecords=[];
if(matchPath){
  const doc=JSON.parse(fs.readFileSync(path.resolve(matchPath),'utf8'));
  matchRecords=Array.isArray(doc)?doc:(Array.isArray(doc?.rows)?doc.rows:[]);
}
const readiness=assessPricePairReadiness({marketplaceDocuments,supplierDocuments,matchRecords});
const output={...readiness,generatedAt:new Date().toISOString(),scanRoot:path.relative(process.cwd(),root)||'.',marketplaceLedgerDocuments:marketplaceDocuments.length,supplierLedgerDocuments:supplierDocuments.length,matchRecordCount:matchRecords.length,diagnostics,paidCallsTriggered:0,providerSpend:0,externalExecutionTriggered:false};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({out:path.relative(process.cwd(),outPath),marketplaceLedgers:output.marketplaceLedgerDocuments,supplierLedgers:output.supplierLedgerDocuments,marketplacePriceReady:output.marketplace.priceReady,supplierPriceReady:output.supplier.priceReady,pricePairs:output.pairs.pricePairCount,screeningReady:output.pairs.screeningEconomicsReadyCount,blockerCounts:output.blockerCounts},null,2));

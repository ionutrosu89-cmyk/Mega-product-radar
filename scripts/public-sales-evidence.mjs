import fs from 'node:fs/promises';
import path from 'node:path';
import {publicSalesEstimateV1} from '../public-sales-estimation-v1.js';

const MARKET='market-intelligence-live.json';
const DIR='data/public-sales-evidence';
const OUT='public-sales-estimation-live.json';
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const read=async(p,f)=>{try{return JSON.parse(await fs.readFile(p,'utf8'));}catch{return f;}};
const market=await read(MARKET,{products:[]});
let files=[];try{files=(await fs.readdir(DIR)).filter(x=>x.endsWith('.json'));}catch{}
const evidence=[];
for(const file of files){const e=await read(path.join(DIR,file),null);if(e)evidence.push({...e,__file:path.join(DIR,file)});}
const items=[];
for(const e of evidence){
  const result=publicSalesEstimateV1(e);
  const p=(market.products||[]).find(x=>norm(x.name)===norm(e.productCanonicalKey)||norm(x.name)===norm(e.productTitle));
  if(p&&['ESTIMATED_HIGH_CONFIDENCE','ESTIMATED_MEDIUM_CONFIDENCE'].includes(result.status)){
    const existing=p.salesEstimation||{};
    const protectedActual=String(existing.status||'')==='ACTUAL_OBSERVED';
    const existingProvider=String(existing.method||'').includes('AMAZON_BOUGHT_PAST_MONTH')&&Number(existing.confidence||0)>=Number(result.confidence||0);
    if(!protectedActual&&!existingProvider){
      p.salesEstimation={...result,version:'PUBLIC_1.0',evidenceFile:e.__file,sourceClass:e.sourceClass,updatedAt:new Date().toISOString()};
    }
  }
  items.push({productCanonicalKey:e.productCanonicalKey,evidenceFile:e.__file,...result});
}
market.publicSalesEstimation={version:'1.0',updatedAt:new Date().toISOString(),items:items.length,highConfidence:items.filter(x=>x.status==='ESTIMATED_HIGH_CONFIDENCE').length,policy:'Public third-party sales estimates can raise estimated demand confidence but never create verified competitor sales.'};
market.updatedAt=new Date().toISOString();
await fs.writeFile(MARKET,JSON.stringify(market,null,2)+'\n');
await fs.writeFile(OUT,JSON.stringify({version:'1.0',updatedAt:new Date().toISOString(),items,policy:market.publicSalesEstimation.policy},null,2)+'\n');
console.log(`Public sales estimation: ${items.length} evidence sets · ${market.publicSalesEstimation.highConfidence} high-confidence estimates.`);

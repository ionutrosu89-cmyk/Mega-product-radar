import fs from 'node:fs/promises';
const FILE='discovery-live.json';
const data=JSON.parse(await fs.readFile(FILE,'utf8'));
const keys=[['alibabaCN','Alibaba'],['1688CN','1688'],['madeInChina','Made-in-China'],['globalSources','Global Sources']];
for(const p of data.products||[]){
  const found=[];
  for(const [key,label] of keys){
    const s=p.signals?.[key];
    if(!s?.present) continue;
    found.push({platform:label,resultProxy:Number(s.resultCount||0),links:(s.links||[]).slice(0,3),searchUrl:s.searchUrl||'',commercialTermsVerified:false});
  }
  const sourceCount=found.length;
  p.supplierHunter={version:'2.0',sourceCount,readiness:sourceCount>=3?'STRONG':sourceCount>=2?'MEDIUM':sourceCount===1?'WEAK':'NONE',sources:found,requiresManualCommercialCheck:true,note:'Supplier Hunter confirms web sourcing presence only. Price, MOQ, rating, Trade Assurance, certifications and sample terms require manual verification before BUY.'};
}
data.supplierHunter={version:'2.0',updatedAt:new Date().toISOString(),platforms:keys.map(x=>x[1])};
await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');
console.log('Supplier Hunter enriched',data.products?.length||0);

import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd(),out=path.join(root,'_site');
await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(out,{recursive:true});
const copy=async(source,target=source)=>fs.copyFile(path.join(root,source),path.join(out,target));
const writePatched=async(source,target,patcher)=>{const text=await fs.readFile(path.join(root,source),'utf8');await fs.writeFile(path.join(out,target),patcher(text));};

await copy('home5.html','index.html');
await writePatched('index.html','radar.html',text=>text
  .replace('<title>Mega Product Radar 4.5</title>','<title>Mega Product Radar 5.0 • Opportunity Radar</title>')
  .replace('<span class="version">4.5</span>','<span class="version">5.0</span>')
  .replace('Data Quality • Supplier Verification • Landed Cost Real • Purchase Manager','Opportunity Radar • Data Quality • Supplier Verification • Buying Engine')
  .replace('<nav class="quicklinks">','<nav class="quicklinks"><a href="discovery-inbox.html">🔎 Discovery 5.0</a>'));
await writePatched('app.js','app.js',text=>text
  .replace('n(product.megaScore||product.score)>=82&&e.profit>=50','n(product.megaScore||product.score)>=84&&e.profit>=50')
  .replace("n(p.marketScout?.checks)>=3&&n(p.marketScout?.foreignPresence)>=1","n(p.marketScout?.checks)>=5&&n(p.marketScout?.foreignPresence)>=1")
  .replace("score>=82?'BUY':score>=76?'TEST':'WATCH'","score>=84?'BUY':score>=76?'TEST':'WATCH'")
  .replace('<small>MEGA 4.2</small>','<small>MEGA 5.0</small>'));
for(const file of [
  'home5.js','data-quality.js','manifest.json','products.json','radar-live.json','radar-history.json','scan-status.json',
  'purchase-manager.html','purchase-manager.js','landed-cost.html','landed-cost.js',
  'discovery-inbox.html','discovery-inbox.js','discovery-engine.js','discovery-live.json'
]) await copy(file);
await fs.writeFile(path.join(out,'.nojekyll'),'');
console.log('Mega Product Radar 5.0 static site built in _site/ with aligned BUY=84 and LIVE checks=5.');

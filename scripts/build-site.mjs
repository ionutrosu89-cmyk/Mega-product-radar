import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd(),out=path.join(root,'_site');
await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(out,{recursive:true});
const copy=async(source,target=source)=>fs.copyFile(path.join(root,source),path.join(out,target));
await copy('home5.html','index.html');
await copy('index.html','radar.html');
for(const file of [
  'home5.js','app.js','data-quality.js','manifest.json','products.json','radar-live.json','radar-history.json','scan-status.json',
  'purchase-manager.html','purchase-manager.js','landed-cost.html','landed-cost.js',
  'discovery-inbox.html','discovery-inbox.js','discovery-engine.js','discovery-live.json'
]) await copy(file);
await fs.writeFile(path.join(out,'.nojekyll'),'');
console.log('Mega Product Radar 5.0 static site built in _site/');

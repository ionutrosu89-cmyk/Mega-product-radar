import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'_site');
await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(out,{recursive:true});
const copy=async(source,target=source)=>fs.copyFile(path.join(root,source),path.join(out,target));
const copyIfExists=async source=>{try{await copy(source);}catch(e){if(e?.code!=='ENOENT')throw e;}};
const writePatched=async(source,target,patcher)=>{const text=await fs.readFile(path.join(root,source),'utf8');await fs.writeFile(path.join(out,target),patcher(text));};
await copy('index.html');
await copy('radar.html');
await writePatched('app.js','app.js',text=>text
  .replace('n(product.megaScore||product.score)>=82&&e.profit>=50','n(product.megaScore||product.score)>=84&&e.profit>=50')
  .replace("n(p.marketScout?.checks)>=3&&n(p.marketScout?.foreignPresence)>=1","n(p.marketScout?.checks)>=5&&n(p.marketScout?.foreignPresence)>=1")
  .replace("score>=82?'BUY':score>=76?'TEST':'WATCH'","score>=84?'BUY':score>=76?'TEST':'WATCH'")
  .replace('<small>MEGA 4.2</small>','<small>MEGA 7.0</small>'));
for(const file of [
  'home5.js','alerts.js','sw.js','data-quality.js','manifest.json','products.json','radar-live.json','radar-history.json','scan-status.json',
  'v6-core.js','source-connectors.js','executive-dashboard.html','executive-dashboard.js','supplier-intelligence.html','supplier-intelligence.js',
  'purchase-manager.html','purchase-manager.js','landed-cost.html','landed-cost.js','discovery-inbox.html','discovery-inbox.js','discovery-engine.js','discovery-live.json','discovery-history.json','discovery-history.js','review-intelligence.js','data-vault.html','data-vault.js',
  'saas-config.js','supabase-client.js','workspace-client.js','billing-plans.js','billing-client.js','saas-shell.js','premium-ui.css','login.html','login.js','account.html','account.js',
  'golden-pipeline.html','commercial-validation.html','commercial-validation.js','commercial-hardening-live.json','commercial-observations.json','golden-pipeline-live.json','paid-budget-live.json',
  'home.html','home.js','onboarding.html','onboarding.js','seller-preferences.js','journey-events.js',
  'discover.html','discover.js','commercial-radar.html','commercial-radar.js','commercial-launch.html','commercial-launch.js',
  'pricing.html','pricing.js','beta.html','feedback.html','feedback.js','privacy.html','terms.html',
  'beta-analytics.html','beta-analytics.js','deployment-readiness.html','deployment-readiness.js','STRIPE_SANDBOX_RUNBOOK.md'
]) await copyIfExists(file);
await fs.writeFile(path.join(out,'.nojekyll'),'');
console.log('Mega Product Radar 7.0 static site built: Radar 6 engine + SaaS Foundation 7.0 + Golden Pipeline + Commercial Hardening + Commercial SaaS pages.');

import {access,readFile,readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=process.cwd();
const requiredFiles=[
  'index.html','home5.js','alerts.js','sw.js','radar.html','app.js','manifest.json','package.json','products.json',
  'v6-core.js','source-connectors.js','executive-dashboard.html','executive-dashboard.js','supplier-intelligence.html','supplier-intelligence.js','purchase-manager.html','purchase-manager.js','landed-cost.html','landed-cost.js','data-vault.html','data-vault.js','data-quality.js',
  'discovery-inbox.html','discovery-inbox.js','discovery-engine.js','discovery-catalogue.json','discovery-themes.json','discovery-live.json','discovery-history.json','discovery-history.js','review-intelligence.js',
  'market-intelligence.html','scripts/market-intelligence-postprocess.mjs',
  'saas-config.js','supabase-client.js','workspace-client.js','billing-plans.js','free-beta-mode.js','saas-shell.js','login.html','login.js','account.html','account.js','pricing.html','pricing.js','beta.html','sources.html','privacy.html','terms.html','deployment-readiness.html','deployment-readiness.js','supabase/schema.sql','supabase/README.md',
  'customer-ui.css','customer-shell.js','scripts/build-site.mjs','scripts/qa-mobile.mjs','scripts/discovery-scan.mjs','scripts/discovery-v6-expand.mjs','scripts/data-quality-postprocess.mjs','scripts/run-github-scan.mjs'
];
for(const file of requiredFiles)await access(path.join(root,file),constants.R_OK);
for(const file of ['manifest.json','package.json','products.json','discovery-catalogue.json','discovery-themes.json','discovery-live.json','discovery-history.json'])JSON.parse(await readFile(path.join(root,file),'utf8'));
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));if(pkg.version!=='7.0.0')throw new Error('package.json must be Radar 7.0.0');
const index=await readFile(path.join(root,'index.html'),'utf8'),login=await readFile(path.join(root,'login.html'),'utf8'),account=await readFile(path.join(root,'account.html'),'utf8'),schema=await readFile(path.join(root,'supabase/schema.sql'),'utf8'),market=await readFile(path.join(root,'market-intelligence.html'),'utf8');
if(!index.includes('Mega Product Radar')||!index.includes('Live intelligence')||!index.includes('login.html'))throw new Error('index.html must expose the current Radar intelligence workspace and login');
if(!market.includes('Black Box RO')||!market.includes('Xray RO'))throw new Error('market-intelligence.html must expose Black Box RO and Xray RO');
if(!login.includes('Radar 7 Login')&&!login.includes('Mega Product Radar 7.0'))throw new Error('login.html missing Radar 7 identity');
if(!account.includes('Contul meu'))throw new Error('account.html missing customer account identity');
for(const needle of ['id="plan"','id="billingState"','id="cancelBilling"','id="resumeBilling"','id="workspace"','id="cloudPush"','id="cloudPull"','Setări avansate de sincronizare'])if(!account.includes(needle))throw new Error(`account.html missing required account capability: ${needle}`);
for(const needle of ['enable row level security','workspace_members','create_personal_workspace'])if(!schema.includes(needle))throw new Error(`Supabase schema missing ${needle}`);
const syntaxFiles=['home5.js','alerts.js','sw.js','app.js','v6-core.js','source-connectors.js','executive-dashboard.js','supplier-intelligence.js','purchase-manager.js','landed-cost.js','data-vault.js','data-quality.js','discovery-inbox.js','discovery-engine.js','discovery-history.js','review-intelligence.js','saas-config.js','supabase-client.js','workspace-client.js','billing-plans.js','free-beta-mode.js','free-beta-scorecard-v1.js','saas-shell.js','login.js','pricing.js','account.js','deployment-readiness.js','customer-shell.js','scripts/build-site.mjs','scripts/qa-mobile.mjs','scripts/discovery-scan.mjs','scripts/discovery-v6-expand.mjs','scripts/data-quality-postprocess.mjs','scripts/market-intelligence-postprocess.mjs','scripts/run-github-scan.mjs','scripts/web-radar-scan.mjs'];
for(const file of syntaxFiles){const r=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||`Syntax check failed: ${file}`);}
const fnDir=path.join(root,'netlify/functions');try{const legacyFns=(await readdir(fnDir)).filter(x=>x.endsWith('.mjs')).length;console.log(`Legacy Netlify functions retained but non-required: ${legacyFns}.`);}catch{}
console.log(`Project check passed: Mega Product Radar 7.0 intelligence workspace + customer account, ${syntaxFiles.length} syntax-checked modules.`);

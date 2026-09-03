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
for(const file of[
  'home5.js','alerts.js','sw.js','data-quality.js','manifest.json','products.json','radar-live.json','radar-history.json','scan-status.json',
  'v6-core.js','domain-contracts-v1.js','portfolio-store.js','feedback-store.js','source-connectors.js','executive-dashboard.html','executive-ro.html','executive-dashboard.js','supplier-intelligence.html','supplier-intelligence.js','supplier-quote-verifier.js','supplier-negotiation-engine.js','rfq-economics-envelope.js','sourcing-ops.html','sourcing-ops.js','rfq-dispatch-state.js',
  'test-execution.html','test-execution.js','test-execution-engine.js','test-execution-client.js',
  'purchase-manager.html','purchase-manager.js','landed-cost.html','landed-cost.js','landed-cost-evidence.js','discovery-inbox.html','discovery-inbox.js','discovery-engine.js','discovery-live.json','organic-rising-live.json','discovery-history.json','discovery-history.js','review-intelligence.js','data-vault.html','data-vault.js',
  'saas-config.js','supabase-client.js','workspace-client.js','cloud-sync.js','billing-plans.js','billing-client.js','free-beta-mode.js','saas-shell.js','commercial-access.js','commercial-decision-client.js','commercial-decision-engine.js','profit-engine-v2.js','product-ro.js','opportunity-v5.js','opportunity-ux-v1.js','premium-ui.css','contrast-fix.css','customer-ui.css','customer-navigation-access.js','customer-shell.js','login.html','login.js','account.html','account.js',
  'golden-pipeline.html','commercial-validation.html','commercial-validation.js','commercial-hardening-live.json','commercial-observations.json','golden-pipeline-live.json','opportunity-shortlist-live.json','paid-budget-live.json',
  'home.html','home.js','onboarding.html','onboarding.js','plan-recommendation-v1.js','seller-preferences.js','journey-events.js','free-demand.js',
  'top25.html','top25.js','top25-evidence.js','top25-movement.js','free-top25-data.js','free-top25-expanded-registry.js','free-cross-market-registry.js','free-shortlist.js','brand-policy-v1.js',
  'discover.html','discover.js','discover-ranking.js','commercial-radar.html','commercial-radar.js','commercial-product.html','commercial-product.js','commercial-watchlist.html','commercial-watchlist.js','commercial-watchlist-page.js','commercial-launch.html','commercial-launch.js','academy.html','academy.js',
  'pricing.html','pricing.js','beta.html','beta.js','feedback.html','feedback.js','beta-feedback.html','beta-feedback.js','privacy.html','terms.html','sources.html',
  'beta-analytics.html','beta-analytics.js','beta-ops.html','beta-ops.js','beta-participants.html','beta-participants.js','launch-readiness.html','launch-readiness.js','deployment-readiness.html','deployment-readiness.js','STRIPE_SANDBOX_RUNBOOK.md','BETA_LAUNCH_CHECKLIST.md'
])await copyIfExists(file);

// P0 policy: supplier candidates, RFQ dispatch payloads, manual evidence and negotiation dossiers are private server-side data.
// Never copy supplier-candidates/, supplier-rfq-dispatch/, supplier-evidence/ or docs/rfq-* into the customer static bundle.
for(const required of['commercial-watchlist-page.js','commercial-watchlist.js','commercial-decision-client.js','commercial-decision-engine.js','profit-engine-v2.js','opportunity-v5.js','opportunity-ux-v1.js','supplier-quote-verifier.js','supplier-negotiation-engine.js','rfq-economics-envelope.js','landed-cost-evidence.js','sourcing-ops.html','sourcing-ops.js','rfq-dispatch-state.js','test-execution.html','test-execution.js','test-execution-engine.js','test-execution-client.js','customer-ui.css','customer-navigation-access.js','customer-shell.js','academy.html','academy.js','plan-recommendation-v1.js','executive-ro.html','executive-dashboard.js','portfolio-store.js','feedback-store.js','domain-contracts-v1.js'])await fs.access(path.join(out,required));
for(const forbidden of['supplier-candidates','supplier-rfq-dispatch','supplier-evidence']){
  try{await fs.access(path.join(out,forbidden));throw new Error(`PRIVATE_STATIC_ARTIFACT_EXPOSED:${forbidden}`);}catch(error){if(error?.code!=='ENOENT')throw error;}
}

const lightBodyPattern=/body\s*\{[^}]*background\s*:\s*(?:var\(--bg\)|#f[0-9a-f]{5}|#fff(?:fff)?|white)/i;
const customerPages=new Set(['home.html','onboarding.html','top25.html','discover.html','commercial-radar.html','commercial-product.html','commercial-watchlist.html','commercial-launch.html','academy.html','account.html']);
for(const entry of await fs.readdir(out)){
  if(!entry.endsWith('.html'))continue;
  const target=path.join(out,entry);let html=await fs.readFile(target,'utf8');
  if(lightBodyPattern.test(html))html=html.replace(/<body(\s[^>]*)?>/i,(match,attrs='')=>/\bclass\s*=/.test(attrs)?match.replace(/class=(['"])(.*?)\1/i,(_,q,classes)=>`class=${q}${classes} app-light${q}`):`<body${attrs} class="app-light">`);
  if(!/contrast-fix\.css/i.test(html))html=html.replace(/<\/head>/i,'<link rel="stylesheet" href="contrast-fix.css"></head>');
  if(customerPages.has(entry)&&!/customer-ui\.css/i.test(html))html=html.replace(/<\/head>/i,'<link rel="stylesheet" href="customer-ui.css"></head>');
  if(customerPages.has(entry)&&!/customer-shell\.js/i.test(html))html=html.replace(/<\/body>/i,'<script type="module" src="customer-shell.js"></script></body>');
  await fs.writeFile(target,html);
}
await fs.writeFile(path.join(out,'.nojekyll'),'');
console.log('Mega Product Radar static site built: Netlify production bundle with private commercial artifacts excluded.');

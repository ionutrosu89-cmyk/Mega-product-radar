import fs from 'node:fs/promises';
import {buildOffStrongCatalogPlan,validateOffStrongCatalogPlan} from '../off-strong-catalog-plan-v1.js';
import {expectedWriteConfirmation} from '../off-controlled-production-writer-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...r]=x.replace(/^--/,'').split('=');return[k,r.join('=')||true];}));
const bundlePath=String(args.bundle||process.env.MPR_OFF_PERSISTENCE_BUNDLE_PATH||'artifacts/off-official-stream-pilot-v1/persistence-bundle.json');
const targetProducts=Math.max(1,Number(args.target||process.env.MPR_OFF_WRITE_TARGET||10000));
const batchSize=Math.max(1,Math.min(500,Number(args.batchSize||process.env.MPR_OFF_WRITE_BATCH_SIZE||500)));
const expectedBundleSha256=String(process.env.MPR_OFF_EXPECTED_BUNDLE_SHA256||'');
const confirmation=String(process.env.MPR_OFF_WRITE_CONFIRMATION||'');
const token=String(process.env.MPR_GITHUB_OIDC_TOKEN||'');
const gatewayUrl=String(process.env.MPR_CATALOG_GATEWAY_URL||'');
const workspaceId=String(process.env.MPR_CATALOG_WORKSPACE_ID||'');
const expectedSha=String(process.env.GITHUB_SHA||'');
if(!token||!gatewayUrl||!workspaceId||!expectedSha)throw new Error('OIDC_GATEWAY_CONFIGURATION_REQUIRED');

const bundle=JSON.parse(await fs.readFile(bundlePath,'utf8'));
if(bundle.bundleSha256!==expectedBundleSha256)throw new Error('SOURCE_BUNDLE_HASH_MISMATCH');
if(confirmation!==expectedWriteConfirmation({bundleSha256:bundle.bundleSha256,targetProducts}))throw new Error('WRITE_CONFIRMATION_MISMATCH');
const plan=buildOffStrongCatalogPlan(bundle,{maxProducts:targetProducts,batchSize});
const validation=validateOffStrongCatalogPlan(plan,{minProducts:targetProducts});
if(!validation.valid||plan.selectedProducts!==targetProducts)throw new Error(`INVALID_STRONG_PLAN:${validation.reasons.join(',')}`);

const receipts=[];
for(const [index,batch] of plan.batches.entries()){
  const response=await fetch(gatewayUrl,{
    method:'POST',
    headers:{'content-type':'application/json','authorization':`Bearer ${token}`},
    body:JSON.stringify({workspaceId,expectedSha,batch})
  });
  const text=await response.text();
  if(!response.ok)throw new Error(`OIDC_CATALOG_WRITE_FAILED:${index}:${response.status}:${text.slice(0,1000)}`);
  const receipt=JSON.parse(text);
  if(receipt?.ok!==true||receipt?.batchSha256!==batch.batchSha256)throw new Error(`OIDC_RECEIPT_INVALID:${index}`);
  receipts.push({index,batchSha256:batch.batchSha256,receipt:receipt.receipt});
}

const out={
  schema:'MPR_OFF_OIDC_PRODUCTION_WRITE_RECEIPT_V1',
  sourceBundleSha256:bundle.bundleSha256,
  targetProducts,
  batchSize,
  batchCount:plan.batchCount,
  completedBatchCount:receipts.length,
  productionWritePerformed:receipts.length===plan.batchCount,
  productionScaleAuthorized:false,
  commercialUseAuthorized:false,
  providerDataSpendEur:0,
  paidDataCallsTriggered:0,
  purchaseAuthorized:false,
  verifiedSalesRows:0,
  salesEvidenceClass:'NOT_VERIFIED_SALES',
  gatewayClass:'GITHUB_ACTIONS_OIDC_PINNED_BATCH_ALLOWLIST',
  receipts
};
console.log(JSON.stringify(out,null,2));

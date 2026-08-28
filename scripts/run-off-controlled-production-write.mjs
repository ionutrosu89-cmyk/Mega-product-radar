import fs from 'node:fs/promises';
import {executeControlledOffWrite,expectedWriteConfirmation} from '../off-controlled-production-writer-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...r]=x.replace(/^--/,'').split('=');return[k,r.join('=')||true];}));
const bundlePath=String(args.bundle||process.env.MPR_OFF_PERSISTENCE_BUNDLE_PATH||'artifacts/off-official-stream-pilot-v1/persistence-bundle.json');
const targetProducts=Math.max(1,Number(args.target||process.env.MPR_OFF_WRITE_TARGET||10000));
const batchSize=Math.max(1,Math.min(1000,Number(args.batchSize||process.env.MPR_OFF_WRITE_BATCH_SIZE||500)));
const startBatch=Math.max(0,Number(args.startBatch||process.env.MPR_OFF_WRITE_START_BATCH||0));
const writeEnabled=String(process.env.MPR_SUPABASE_CATALOG_WRITE_ENABLED||'false').toLowerCase()==='true';
const expectedBundleSha256=String(process.env.MPR_OFF_EXPECTED_BUNDLE_SHA256||'');
const confirmation=String(process.env.MPR_OFF_WRITE_CONFIRMATION||'');

const bundle=JSON.parse(await fs.readFile(bundlePath,'utf8'));
const expectedConfirmation=expectedWriteConfirmation({bundleSha256:bundle.bundleSha256,targetProducts});
const receipt=await executeControlledOffWrite(bundle,{
  targetProducts,batchSize,startBatch,writeEnabled,expectedBundleSha256,confirmation,
  supabaseUrl:process.env.SUPABASE_URL,
  serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY,
  workspaceId:process.env.MPR_CATALOG_WORKSPACE_ID
});
console.log(JSON.stringify({
  schema:receipt.schema,
  sourceBundleSha256:receipt.sourceBundleSha256,
  targetProducts:receipt.targetProducts,
  batchCount:receipt.batchCount,
  completedBatchCount:receipt.completedBatchCount,
  productionWritePerformed:receipt.productionWritePerformed,
  productionScaleAuthorized:receipt.productionScaleAuthorized,
  commercialUseAuthorized:receipt.commercialUseAuthorized,
  expectedConfirmation:writeEnabled?undefined:expectedConfirmation,
  providerDataSpendEur:receipt.providerDataSpendEur,
  paidDataCallsTriggered:receipt.paidDataCallsTriggered,
  purchaseAuthorized:receipt.purchaseAuthorized,
  verifiedSalesRows:receipt.verifiedSalesRows,
  salesEvidenceClass:receipt.salesEvidenceClass,
  receiptSha256:receipt.receiptSha256
},null,2));

import {createHash} from 'node:crypto';
import {buildOffStrongCatalogPlan,validateOffStrongCatalogPlan} from './off-strong-catalog-plan-v1.js';
import {persistSupabaseCatalogBatch} from './supabase-catalog-persistence-v1.js';

const sha256=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');

export function expectedWriteConfirmation({bundleSha256,targetProducts}){
  return `WRITE_OFF_STRONG_GTIN:${bundleSha256}:${targetProducts}`;
}

export function validateControlledWriteRequest(bundle={},options={}){
  const targetProducts=Math.max(1,Number(options.targetProducts||10000));
  const batchSize=Math.max(1,Math.min(1000,Number(options.batchSize||500)));
  const expectedBundleSha256=String(options.expectedBundleSha256||'');
  const writeEnabled=String(options.writeEnabled??false).toLowerCase()==='true';
  const confirmation=String(options.confirmation||'');
  const plan=buildOffStrongCatalogPlan(bundle,{batchSize,maxProducts:targetProducts});
  const planValidation=validateOffStrongCatalogPlan(plan,{minProducts:targetProducts});
  const reasons=[...planValidation.reasons];
  if(!expectedBundleSha256||bundle.bundleSha256!==expectedBundleSha256)reasons.push('SOURCE_BUNDLE_SHA_MISMATCH');
  if(plan.selectedProducts!==targetProducts)reasons.push('EXACT_TARGET_REQUIRED');
  const expectedConfirmation=expectedWriteConfirmation({bundleSha256:bundle.bundleSha256,targetProducts});
  if(writeEnabled&&confirmation!==expectedConfirmation)reasons.push('EXPLICIT_WRITE_CONFIRMATION_REQUIRED');
  return{
    schema:'MPR_OFF_CONTROLLED_WRITE_REQUEST_V1',
    valid:reasons.length===0,
    reasons,
    writeEnabled,
    targetProducts,
    batchSize,
    expectedConfirmation,
    sourceBundleSha256:bundle.bundleSha256||null,
    plan
  };
}

export async function executeControlledOffWrite(bundle={},options={}){
  const request=validateControlledWriteRequest(bundle,options);
  if(!request.valid)throw new Error(`CONTROLLED_WRITE_REJECTED:${request.reasons.join(',')}`);
  const startBatch=Math.max(0,Number(options.startBatch||0));
  if(startBatch>=request.plan.batchCount)throw new Error('START_BATCH_OUT_OF_RANGE');
  const receipts=[];
  for(let i=startBatch;i<request.plan.batches.length;i++){
    const batch=request.plan.batches[i];
    const receipt=await persistSupabaseCatalogBatch(batch,{
      enabled:request.writeEnabled,
      supabaseUrl:options.supabaseUrl,
      serviceRoleKey:options.serviceRoleKey,
      workspaceId:options.workspaceId,
      fetchImpl:options.fetchImpl
    });
    receipts.push({batchIndex:i,batchSha256:batch.batchSha256,receipt});
    if(request.writeEnabled&&receipt.productionWritePerformed!==true)throw new Error(`BATCH_WRITE_NOT_CONFIRMED:${i}`);
  }
  const payload={
    schema:'MPR_OFF_CONTROLLED_WRITE_RECEIPT_V1',
    sourceBundleSha256:request.sourceBundleSha256,
    planSha256:request.plan.planSha256,
    targetProducts:request.targetProducts,
    batchSize:request.batchSize,
    batchCount:request.plan.batchCount,
    startBatch,
    completedBatchCount:receipts.length,
    productionWritePerformed:request.writeEnabled&&receipts.length>0&&receipts.every(x=>x.receipt.productionWritePerformed===true),
    productionScaleAuthorized:false,
    commercialUseAuthorized:false,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    receipts
  };
  return{...payload,receiptSha256:sha256(payload)};
}

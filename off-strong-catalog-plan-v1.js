import {createHash} from 'node:crypto';
import {buildSupabaseCatalogPersistenceBatch,validateSupabaseCatalogPersistenceBatch} from './supabase-catalog-persistence-v1.js';

const sha256=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const keyOf=x=>String(x?.canonical_key||x?.canonicalKey||'');

export function buildOffStrongCatalogPlan(bundle={},options={}){
  const batchSize=Math.max(1,Math.min(1000,Number(options.batchSize||500)));
  const maxProducts=Math.max(1,Number(options.maxProducts||10000));
  const strongKeys=new Set((bundle.identities||[])
    .filter(x=>String(x.namespace)==='GTIN'&&Number(x.confidence||0)>=1&&keyOf(x).startsWith('GTIN:'))
    .map(keyOf));
  const products=(bundle.products||[])
    .filter(p=>strongKeys.has(keyOf(p))&&keyOf(p).startsWith('GTIN:'))
    .sort((a,b)=>keyOf(a).localeCompare(keyOf(b)))
    .slice(0,maxProducts);
  const selected=new Set(products.map(keyOf));
  const sourceRecords=(bundle.sourceRecords||[]).filter(x=>selected.has(keyOf(x)));
  const claims=(bundle.claims||[]).filter(x=>selected.has(keyOf(x)));
  const identities=(bundle.identities||[]).filter(x=>selected.has(keyOf(x))&&String(x.namespace)==='GTIN');
  const batches=[];
  for(let i=0;i<products.length;i+=batchSize){
    const slice=products.slice(i,i+batchSize);
    const keys=new Set(slice.map(keyOf));
    const sub={
      products:slice,
      identities:identities.filter(x=>keys.has(keyOf(x))),
      sourceRecords:sourceRecords.filter(x=>keys.has(keyOf(x))),
      claims:claims.filter(x=>keys.has(keyOf(x)))
    };
    const batch=buildSupabaseCatalogPersistenceBatch(sub,{maxProducts:batchSize});
    const validation=validateSupabaseCatalogPersistenceBatch(batch);
    if(!validation.valid)throw new Error(`INVALID_STRONG_BATCH:${validation.reasons.join(',')}`);
    batches.push(batch);
  }
  const payload={
    schema:'MPR_OFF_STRONG_CATALOG_PLAN_V1',
    sourceBundleSha256:bundle.bundleSha256||null,
    selectedProducts:products.length,
    selectedIdentities:identities.length,
    selectedSourceRecords:sourceRecords.length,
    selectedClaims:claims.length,
    batchSize,
    batchCount:batches.length,
    canonicalKeyClass:'STRONG_GTIN_ONLY',
    productionWriteAuthorized:false,
    productionScaleAuthorized:false,
    commercialUseAuthorized:false,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    batchHashes:batches.map(x=>x.batchSha256)
  };
  return{...payload,planSha256:sha256(payload),batches};
}

export function validateOffStrongCatalogPlan(plan={},options={}){
  const minProducts=Math.max(1,Number(options.minProducts||10000));
  const reasons=[];
  if(plan.schema!=='MPR_OFF_STRONG_CATALOG_PLAN_V1')reasons.push('INVALID_SCHEMA');
  if(Number(plan.selectedProducts||0)<minProducts)reasons.push('STRONG_PRODUCTS_BELOW_TARGET');
  if(plan.selectedProducts!==plan.selectedIdentities)reasons.push('IDENTITY_COVERAGE_INCOMPLETE');
  if(plan.selectedProducts!==plan.selectedSourceRecords)reasons.push('PROVENANCE_COVERAGE_INCOMPLETE');
  if(plan.batchCount!==plan.batches?.length)reasons.push('BATCH_COUNT_MISMATCH');
  if(plan.batches?.some(b=>!validateSupabaseCatalogPersistenceBatch(b).valid))reasons.push('INVALID_BATCH');
  if(plan.productionWriteAuthorized!==false||plan.productionScaleAuthorized!==false||plan.commercialUseAuthorized!==false)reasons.push('UNAUTHORIZED_STATE');
  if(plan.providerDataSpendEur!==0||plan.paidDataCallsTriggered!==0||plan.purchaseAuthorized!==false||plan.verifiedSalesRows!==0||plan.salesEvidenceClass!=='NOT_VERIFIED_SALES')reasons.push('POLICY_INVARIANT_FAILED');
  return{schema:'MPR_OFF_STRONG_CATALOG_PLAN_VALIDATION_V1',valid:reasons.length===0,reasons};
}

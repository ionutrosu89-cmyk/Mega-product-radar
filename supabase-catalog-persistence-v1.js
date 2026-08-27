import {createHash} from 'node:crypto';

function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}

function sha256(value){
  return createHash('sha256').update(typeof value==='string'?value:JSON.stringify(stable(value))).digest('hex');
}

function truthPolicy(){
  return {
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  };
}

export function buildSupabaseCatalogPersistenceBatch(bundle={}, options={}){
  const maxProducts=Number.isInteger(options.maxProducts)?options.maxProducts:100;
  if(maxProducts<1 || maxProducts>1000) throw new Error('INVALID_MAX_PRODUCTS');
  if(!bundle || typeof bundle!=='object') throw new Error('PERSISTENCE_BUNDLE_REQUIRED');

  const products=(bundle.products||[]).slice(0,maxProducts).map(p=>({
    canonicalKey:String(p.canonicalKey||p.canonical_key||''),
    title:String(p.title||p.canonicalName||''),
    brand:p.brand??null,
    category:p.category??null,
    imageUrl:null
  }));
  if(products.some(p=>!p.canonicalKey || !p.title)) throw new Error('PRODUCT_IDENTITY_REQUIRED');
  const allowed=new Set(products.map(p=>p.canonicalKey));

  const identities=(bundle.identities||[]).filter(x=>allowed.has(x.canonicalKey)).map(x=>({
    canonicalKey:x.canonicalKey,
    namespace:String(x.namespace||''),
    valueNorm:String(x.valueNorm||x.value_norm||''),
    confidence:Number.isFinite(Number(x.confidence))?Number(x.confidence):1,
    sourceKey:x.sourceKey??null
  }));

  const sourceRecords=(bundle.sourceRecords||[]).filter(x=>allowed.has(x.canonicalKey)).map(x=>({
    canonicalKey:x.canonicalKey,
    sourceKey:String(x.sourceKey||''),
    sourceRecordId:String(x.sourceRecordId||''),
    observedAt:x.observedAt??null,
    evidenceClass:'CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY',
    rightsDecision:x.rightsDecision||'HOLD',
    identityStrength:x.identityStrength??null,
    rawPayload:x.rawPayload||{},
    contentSha256:x.contentSha256||sha256(x.rawPayload||{})
  }));

  const claims=(bundle.claims||[]).filter(x=>allowed.has(x.canonicalKey)).map(x=>({
    canonicalKey:x.canonicalKey,
    sourceKey:String(x.sourceKey||''),
    sourceRecordId:String(x.sourceRecordId||''),
    fieldName:String(x.fieldName||''),
    fieldValue:x.fieldValue??null,
    observedAt:x.observedAt??null,
    rightsDecision:x.rightsDecision||'HOLD',
    evidenceClass:'CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY',
    confidence:Number.isFinite(Number(x.confidence))?Number(x.confidence):0,
    claimSha256:x.claimSha256||sha256({canonicalKey:x.canonicalKey,sourceKey:x.sourceKey,sourceRecordId:x.sourceRecordId,fieldName:x.fieldName,fieldValue:x.fieldValue})
  }));

  const ingestionRun=bundle.ingestionRun?{
    ...bundle.ingestionRun,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  }:null;

  const batch={
    schema:'MPR_SUPABASE_CATALOG_PERSISTENCE_BATCH_V1',
    products,identities,sourceRecords,claims,ingestionRun,
    policy:truthPolicy()
  };
  return {...batch,batchSha256:sha256(batch)};
}

export function validateSupabaseCatalogPersistenceBatch(batch={}){
  const reasons=[];
  if(batch.schema!=='MPR_SUPABASE_CATALOG_PERSISTENCE_BATCH_V1') reasons.push('INVALID_SCHEMA');
  if(!Array.isArray(batch.products)||batch.products.length<1) reasons.push('PRODUCTS_REQUIRED');
  if(batch.products?.some(p=>!p.canonicalKey||!p.title)) reasons.push('PRODUCT_IDENTITY_REQUIRED');
  const policy=batch.policy||{};
  if(policy.providerDataSpendEur!==0) reasons.push('PROVIDER_SPEND_FORBIDDEN');
  if(policy.paidDataCallsTriggered!==0) reasons.push('PAID_CALLS_FORBIDDEN');
  if(policy.purchaseAuthorized!==false) reasons.push('PURCHASE_AUTHORIZATION_FORBIDDEN');
  if(policy.verifiedSalesRows!==0) reasons.push('VERIFIED_SALES_ROWS_FORBIDDEN');
  if(policy.salesEvidenceClass!=='NOT_VERIFIED_SALES') reasons.push('SALES_EVIDENCE_CLASS_FORBIDDEN');
  const check={...batch}; delete check.batchSha256;
  if(batch.batchSha256!==sha256(check)) reasons.push('BATCH_HASH_MISMATCH');
  return {schema:'MPR_SUPABASE_CATALOG_PERSISTENCE_VALIDATION_V1',valid:reasons.length===0,reasons};
}

export async function persistSupabaseCatalogBatch(batch, options={}){
  const validation=validateSupabaseCatalogPersistenceBatch(batch);
  if(!validation.valid) throw new Error(`INVALID_CATALOG_BATCH:${validation.reasons.join(',')}`);
  const enabled=String(options.enabled??process.env.MPR_SUPABASE_CATALOG_WRITE_ENABLED??'false').toLowerCase()==='true';
  if(!enabled) return {schema:'MPR_SUPABASE_CATALOG_PERSISTENCE_CLIENT_RECEIPT_V1',writeEnabled:false,productionWritePerformed:false,validation,policy:truthPolicy()};

  const url=options.supabaseUrl||process.env.SUPABASE_URL;
  const serviceRoleKey=options.serviceRoleKey||process.env.SUPABASE_SERVICE_ROLE_KEY;
  const workspaceId=options.workspaceId||process.env.MPR_CATALOG_WORKSPACE_ID;
  const fetchImpl=options.fetchImpl||globalThis.fetch;
  if(!url||!serviceRoleKey||!workspaceId||typeof fetchImpl!=='function') throw new Error('SUPABASE_PERSISTENCE_CONFIGURATION_REQUIRED');

  const response=await fetchImpl(`${url.replace(/\/$/,'')}/rest/v1/rpc/mpr_persist_catalog_batch_v1`,{
    method:'POST',
    headers:{'content-type':'application/json','apikey':serviceRoleKey,'authorization':`Bearer ${serviceRoleKey}`},
    body:JSON.stringify({p_workspace_id:workspaceId,p_batch:batch})
  });
  if(!response.ok) throw new Error(`SUPABASE_CATALOG_WRITE_FAILED:${response.status}:${await response.text()}`);
  const receipt=await response.json();
  return {schema:'MPR_SUPABASE_CATALOG_PERSISTENCE_CLIENT_RECEIPT_V1',writeEnabled:true,productionWritePerformed:true,batchSha256:batch.batchSha256,receipt,policy:truthPolicy()};
}

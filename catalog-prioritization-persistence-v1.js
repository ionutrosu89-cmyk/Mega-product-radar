import {prioritizeCatalog} from './catalog-prioritization-v1.js';

const clean=value=>String(value??'').trim();

export const PERSISTENCE_PRIORITIZATION_SCHEMA='MPR_PERSISTENCE_PRIORITIZATION_V1';

export function persistenceBundleToCandidates(bundle={}){
  if(bundle.schema!=='MPR_CATALOG_PERSISTENCE_BUNDLE_V1')throw new TypeError('catalog persistence bundle required');
  if(bundle.writeAuthorized!==false)throw new Error('PERSISTENCE_WRITE_AUTHORIZATION_INVALID');
  if(bundle.policy?.purchaseAuthorized!==false)throw new Error('PURCHASE_POLICY_INVALID');
  if(bundle.policy?.salesEvidenceClass!=='NOT_VERIFIED_SALES'||Number(bundle.policy?.verifiedSalesRows)!==0)throw new Error('SALES_TRUTH_POLICY_INVALID');

  const identitiesByKey=new Map();
  for(const id of bundle.identities||[]){
    const key=clean(id.canonical_key);
    if(!key)continue;
    if(!identitiesByKey.has(key))identitiesByKey.set(key,[]);
    identitiesByKey.get(key).push({namespace:clean(id.namespace).toUpperCase(),valueNorm:clean(id.value_norm)});
  }
  const sourceByKey=new Map();
  for(const s of bundle.sourceRecords||[]){
    const key=clean(s.canonical_key);
    if(key&&!sourceByKey.has(key))sourceByKey.set(key,s);
  }

  return (bundle.products||[]).map(product=>{
    const key=clean(product.canonical_key);
    const source=sourceByKey.get(key)||{};
    return{
      fingerprint:clean(source.record_fingerprint)||key||null,
      identityKeys:identitiesByKey.get(key)||[],
      title:clean(product.title)||clean(product.canonical_name)||null,
      brand:clean(product.brand)||null,
      category:clean(product.category)||clean(product.canonical_category)||null,
      model:null,
      sourceKey:clean(source.source_key)||clean(bundle.run?.source_key)||null,
      sourceRecordId:clean(source.source_record_id)||null,
      observedAt:source.observed_at||bundle.run?.retrieved_at||null
    };
  });
}

export function prioritizePersistenceBundle(bundle={},options={}){
  const candidates=persistenceBundleToCandidates(bundle);
  const prioritized=prioritizeCatalog(candidates,options);
  return{
    ...prioritized,
    schema:PERSISTENCE_PRIORITIZATION_SCHEMA,
    sourceBundleSha256:bundle.bundleSha256||null,
    sourceProductCount:Number(bundle.counts?.products)||candidates.length,
    writeAuthorized:false,
    policy:{...prioritized.policy,providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false},
    note:'Prioritization consumes a deterministic catalog persistence bundle and selects records for later evidence collection only. No catalog write or commercial validation is performed.'
  };
}

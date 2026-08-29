import crypto from 'node:crypto';

const clean=value=>String(value??'').trim();
const stable=value=>{
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
};
const sha=value=>crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

export const CATALOG_PERSISTENCE_SCHEMA='MPR_CATALOG_PERSISTENCE_BUNDLE_V1';

function canonicalKey(candidate={}){
  const strong=(candidate.identityKeys||[]).find(k=>['GTIN','EPREL','ASIN','ICECAT'].includes(k.namespace));
  if(strong)return `${strong.namespace}:${strong.valueNorm}`;
  return `FINGERPRINT:${candidate.fingerprint}`;
}

function sourceRecordLookupKey(sourceKey,sourceRecordId){
  return `${String(sourceKey??'')}\u0000${String(sourceRecordId??'')}`;
}

export function buildCatalogPersistenceBundle(ingestion={}){
  if(ingestion.schema!=='MPR_BULK_CATALOG_INGESTION_V1')throw new TypeError('bulk ingestion evidence required');
  if(ingestion.decision!=='INGESTION_ACCOUNTED')throw new TypeError('ingestion must be fully accounted');
  const products=[];
  const identities=[];
  const sourceRecords=[];
  const claims=[];
  const canonicalKeyBySourceRecord=new Map();
  for(const c of ingestion.accepted||[]){
    const key=canonicalKey(c);
    const lookupKey=sourceRecordLookupKey(c.sourceKey,c.sourceRecordId);
    if(!canonicalKeyBySourceRecord.has(lookupKey))canonicalKeyBySourceRecord.set(lookupKey,key);
    products.push({
      canonical_key:key,
      title:clean(c.title)||'Untitled product',
      brand:clean(c.brand)||null,
      category:clean(c.category)||null,
      image_url:null,
      status:'CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY',
      evidence_confidence:c.identityStrength==='STRONG_GTIN'?1:0.7,
      priority_score:0,
      canonical_name:clean(c.title)||null,
      canonical_category:clean(c.category)||null,
      identity_status:c.identityStrength||'FALLBACK'
    });
    for(const k of c.identityKeys||[]){
      identities.push({canonical_key:key,namespace:k.namespace,value_norm:k.valueNorm,confidence:['GTIN','EPREL','ASIN','ICECAT'].includes(k.namespace)?1:0.9,source_key:c.sourceKey});
    }
    sourceRecords.push({source_key:c.sourceKey,source_record_id:c.sourceRecordId,canonical_key:key,observed_at:c.observedAt||null,rights_decision:c.rightsDecision,evidence_class:c.evidenceClass,record_fingerprint:c.fingerprint,payload:c.raw});
  }
  for(const claim of ingestion.claims||[]){
    const key=canonicalKeyBySourceRecord.get(sourceRecordLookupKey(claim.sourceKey,claim.sourceRecordId))||null;
    claims.push({...claim,canonical_key:key});
  }
  const run={
    source_key:ingestion.manifest.sourceKey,
    manifest_sha256:ingestion.manifest.manifestSha256,
    records_sha256:ingestion.manifest.recordsSha256,
    retrieved_at:ingestion.manifest.retrievedAt,
    input_count:ingestion.stats.input,
    accepted_count:ingestion.stats.accepted,
    held_count:ingestion.stats.held,
    logical_duplicate_count:ingestion.stats.logicalDuplicates,
    silent_drop_count:ingestion.stats.silentDrops,
    checkpoint_sha256:ingestion.checkpoint.checkpointSha256,
    decision:ingestion.decision,
    provider_data_spend_eur:0,
    paid_data_calls_triggered:0,
    purchase_authorized:false,
    sales_evidence_class:'NOT_VERIFIED_SALES',
    verified_sales_rows:0
  };
  const payload={products,identities,sourceRecords,claims,run};
  return{
    schema:CATALOG_PERSISTENCE_SCHEMA,
    target:{canonicalTable:'canonical_products',identityTable:'product_identity_keys_v2',sourceRecordTable:'catalog_source_records_v1',claimTable:'product_claims_v1',runTable:'bulk_ingestion_runs_v1'},
    ...payload,
    counts:{products:products.length,identities:identities.length,sourceRecords:sourceRecords.length,claims:claims.length},
    bundleSha256:sha(payload),
    policy:{providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0},
    writeAuthorized:false,
    note:'This bundle is deterministic persistence input. It does not perform a production write and cannot establish scale readiness by itself.'
  };
}

export function verifyCatalogPersistenceReplay(a={},b={}){
  const valid=a.schema===CATALOG_PERSISTENCE_SCHEMA&&b.schema===CATALOG_PERSISTENCE_SCHEMA;
  const equal=valid&&a.bundleSha256===b.bundleSha256&&a.run?.manifest_sha256===b.run?.manifest_sha256;
  return{schema:'MPR_CATALOG_PERSISTENCE_REPLAY_V1',replayDeterministic:equal,firstBundleSha256:a.bundleSha256||null,secondBundleSha256:b.bundleSha256||null,decision:equal?'REPLAY_VERIFIED':'HOLD_REPLAY'};
}

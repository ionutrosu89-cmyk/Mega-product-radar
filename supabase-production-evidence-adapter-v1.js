const clean=value=>String(value??'').trim();

function requireConfig(options={}){
  const url=clean(options.url||process.env.SUPABASE_URL);
  const key=clean(options.serviceRoleKey||process.env.SUPABASE_SERVICE_ROLE_KEY);
  const enabled=String(options.remoteEnabled??process.env.MPR_PRODUCTION_EVIDENCE_REMOTE_ENABLED??'false').toLowerCase()==='true';
  if(!enabled)throw new Error('PRODUCTION_EVIDENCE_REMOTE_DISABLED');
  if(!/^https:\/\//i.test(url))throw new Error('SUPABASE_URL_REQUIRED');
  if(!key)throw new Error('SUPABASE_SERVICE_ROLE_KEY_REQUIRED');
  return{url:url.replace(/\/$/,''),key};
}

export function createSupabaseCheckpointStorageAdapter(options={}){
  const fetchImpl=options.fetchImpl||globalThis.fetch;
  if(typeof fetchImpl!=='function')throw new Error('FETCH_REQUIRED');
  return{
    kind:'PRODUCTION_DATABASE',
    async put(key,value){
      const cfg=requireConfig(options);
      const checkpointKey=clean(key);
      const body={
        checkpoint_key:checkpointKey,
        run_id:clean(value?.runId)||null,
        sequence:Math.max(0,Number(value?.sequence||0)),
        processed_count:Math.max(0,Number(value?.processedCount||0)),
        canonical_count:Math.max(0,Number(value?.canonicalCount||0)),
        cursor_value:clean(value?.cursor)||null,
        ingestion_fingerprint:clean(value?.ingestionFingerprint)||null,
        artifact_content_sha256:clean(value?.artifactContentSha256).toLowerCase()||null,
        checkpoint_fingerprint:clean(value?.checkpointFingerprint)||'PENDING_RECEIPT_FINGERPRINT',
        payload:value||{},
        updated_at:new Date().toISOString()
      };
      const res=await fetchImpl(`${cfg.url}/rest/v1/production_ingestion_checkpoints_v1?on_conflict=checkpoint_key`,{
        method:'POST',headers:{apikey:cfg.key,Authorization:`Bearer ${cfg.key}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body)
      });
      if(!res.ok)throw new Error(`SUPABASE_CHECKPOINT_WRITE_${res.status}`);
      return{key:checkpointKey,remote:true};
    },
    async get(key){
      const cfg=requireConfig(options);
      const checkpointKey=clean(key);
      const res=await fetchImpl(`${cfg.url}/rest/v1/production_ingestion_checkpoints_v1?checkpoint_key=eq.${encodeURIComponent(checkpointKey)}&select=payload&limit=1`,{
        headers:{apikey:cfg.key,Authorization:`Bearer ${cfg.key}`}
      });
      if(!res.ok)throw new Error(`SUPABASE_CHECKPOINT_READ_${res.status}`);
      const rows=await res.json();
      return Array.isArray(rows)&&rows[0]?rows[0].payload:null;
    },
    async delete(){throw new Error('PRODUCTION_CHECKPOINT_DELETE_FORBIDDEN');}
  };
}

export function productionEvidenceRemoteDefaults(){
  return{remoteEnabled:false,providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES'};
}

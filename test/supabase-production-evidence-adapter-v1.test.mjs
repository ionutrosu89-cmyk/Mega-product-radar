import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseCheckpointStorageAdapter,productionEvidenceRemoteDefaults} from '../supabase-production-evidence-adapter-v1.js';

test('remote production evidence adapter is disabled by default',async()=>{
  const adapter=createSupabaseCheckpointStorageAdapter({fetchImpl:async()=>({ok:true,json:async()=>[]})});
  await assert.rejects(()=>adapter.put('k',{runId:'r'}),/PRODUCTION_EVIDENCE_REMOTE_DISABLED/);
  assert.deepEqual(productionEvidenceRemoteDefaults(),{remoteEnabled:false,providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES'});
});

test('enabled adapter performs deterministic upsert and read using injected fetch',async()=>{
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options});
    if(options.method==='POST')return{ok:true,status:201,json:async()=>[]};
    return{ok:true,status:200,json:async()=>[{payload:{runId:'r1',canonicalCount:100}}]};
  };
  const adapter=createSupabaseCheckpointStorageAdapter({url:'https://example.supabase.co',serviceRoleKey:'test-key',remoteEnabled:true,fetchImpl});
  const write=await adapter.put('checkpoint/main',{runId:'r1',canonicalCount:100});
  const read=await adapter.get('checkpoint/main');
  assert.equal(write.remote,true);
  assert.equal(read.runId,'r1');
  assert.equal(calls.length,2);
  assert.match(calls[0].url,/production_ingestion_checkpoints_v1/);
  assert.equal(calls[0].options.headers.apikey,'test-key');
});

test('production checkpoint deletion is forbidden',async()=>{
  const adapter=createSupabaseCheckpointStorageAdapter({url:'https://example.supabase.co',serviceRoleKey:'test-key',remoteEnabled:true,fetchImpl:async()=>({ok:true,json:async()=>[]})});
  await assert.rejects(()=>adapter.delete('x'),/PRODUCTION_CHECKPOINT_DELETE_FORBIDDEN/);
});

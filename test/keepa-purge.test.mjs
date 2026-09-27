import test from 'node:test';
import assert from 'node:assert/strict';
import {createKeepaPurgeHandler} from '../netlify/functions/keepa-purge.mjs';

const baseEnv={CONTEXT:'production',MPR_INTERNAL_REFRESH_SECRET:'internal-test',MPR_KEEPA_PURGE_ENABLED:'true',MPR_KEEPA_SUBSCRIPTION_ACTIVE:'false',MPR_KEEPA_COLLECTION_ENABLED:'false',MPR_PAID_PROVIDER_CALLS_ENABLED:'false',SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'service-test'};
const request=(mode='DRY_RUN',extra={},secret='internal-test')=>new Request('https://mpr.example/api/internal/keepa-purge',{method:'POST',headers:{'x-mpr-internal-secret':secret,'content-type':'application/json'},body:JSON.stringify({mode,...extra})});
function fixture({keys=['candidates/2026-09-25/BIROU_ORGANIZARE','receipts/2026-09-25/BIROU_ORGANIZARE','budget/2026-09-25'],snapshots=2}={}){
  const blobs=new Set(keys),calls=[];
  let count=snapshots;
  const store={async list(){return {blobs:[...blobs].map(key=>({key}))};},async delete(key){blobs.delete(key);},async setJSON(key){if(blobs.has(key))return {modified:false};blobs.add(key);return {modified:true};},async get(key){return blobs.has(key)?{state:'LOCKED'}:null;}};
  const fetchImpl=async(url,options)=>{
    calls.push({url:String(url),options});
    assert.equal(new URL(url).searchParams.get('source_key'),'eq.KEEPA_BEST_SELLERS');
    if(options.method==='HEAD')return new Response(null,{headers:{'Content-Range':`*/${count}`}});
    if(options.method==='DELETE'){count=0;return new Response(null,{status:204});}
    throw Error('unexpected method');
  };
  return {store,fetchImpl,calls,blobs,get count(){return count;}};
}

test('dry run counts only, with no deletion or paid provider call',async()=>{
  const data=fixture();
  const handler=createKeepaPurgeHandler({env:baseEnv,storeFactory:()=>data.store,fetchImpl:data.fetchImpl});
  const response=await handler(request());
  assert.deepEqual(await response.json(),{ok:true,status:'DRY_RUN',blobCount:3,snapshotCount:2,unexpectedKeys:0});
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(data.blobs.size,3);
  assert.equal(data.count,2);
  assert.deepEqual(data.calls.map(call=>call.options.method),['HEAD']);
});

test('execution requires production, disabled collection, an explicit switch and reviewed inventory',async()=>{
  const data=fixture();
  const changes=[{CONTEXT:'deploy-preview'},{MPR_KEEPA_PURGE_ENABLED:'false'},{MPR_KEEPA_SUBSCRIPTION_ACTIVE:'true'},{MPR_KEEPA_COLLECTION_ENABLED:'true'},{MPR_PAID_PROVIDER_CALLS_ENABLED:'true'}];
  for(const change of changes){
    const handler=createKeepaPurgeHandler({env:{...baseEnv,...change},storeFactory:()=>{throw Error('store touched');},fetchImpl:()=>{throw Error('network touched');}});
    assert.equal((await (await handler(request('EXECUTE',{confirmation:'DELETE_KEEPA_DATA',expectedBlobCount:3,expectedSnapshotCount:2}))).json()).status,'PURGE_DISABLED');
  }
  const handler=createKeepaPurgeHandler({env:baseEnv,storeFactory:()=>data.store,fetchImpl:data.fetchImpl});
  assert.equal((await (await handler(request('EXECUTE'))).json()).status,'CONFIRMATION_REQUIRED');
  assert.equal((await (await handler(request('EXECUTE',{confirmation:'DELETE_KEEPA_DATA',expectedBlobCount:2,expectedSnapshotCount:2}))).json()).status,'INVENTORY_CHANGED');
  assert.equal(data.blobs.size,3);
  assert.equal(data.count,2);
  assert.deepEqual(data.calls.map(call=>call.options.method),['HEAD']);
});

test('purge deletes only Keepa rows and dedicated-store keys, then verifies zero remaining',async()=>{
  const data=fixture();
  const handler=createKeepaPurgeHandler({env:baseEnv,storeFactory:()=>data.store,fetchImpl:data.fetchImpl});
  const response=await handler(request('EXECUTE',{confirmation:'DELETE_KEEPA_DATA',expectedBlobCount:3,expectedSnapshotCount:2}));
  assert.deepEqual(await response.json(),{ok:true,status:'PURGE_VERIFIED',deletedBlobCount:3,deletedSnapshotCount:2,remainingBlobCount:0,remainingSnapshotCount:0});
  assert.deepEqual([...data.blobs],['control/purge-lock']);
  assert.equal(data.count,0);
  assert.deepEqual(data.calls.map(call=>call.options.method),['HEAD','HEAD','DELETE','HEAD']);
});

test('unexpected keys, failed deletion and failed verification never produce a success receipt',async()=>{
  const unknown=fixture({keys:['unrelated/data']});
  const handler=createKeepaPurgeHandler({env:baseEnv,storeFactory:()=>unknown.store,fetchImpl:unknown.fetchImpl});
  assert.equal((await (await handler(request('EXECUTE',{confirmation:'DELETE_KEEPA_DATA',expectedBlobCount:1,expectedSnapshotCount:2}))).json()).status,'UNEXPECTED_STORE_KEYS');
  assert.equal(unknown.blobs.size,1);
  const broken=fixture();
  const failing=createKeepaPurgeHandler({env:baseEnv,storeFactory:()=>broken.store,fetchImpl:async(url,options)=>options.method==='DELETE'?new Response(null,{status:503}):broken.fetchImpl(url,options)});
  assert.equal((await (await failing(request('EXECUTE',{confirmation:'DELETE_KEEPA_DATA',expectedBlobCount:3,expectedSnapshotCount:2}))).json()).status,'SNAPSHOT_DELETE_FAILED');
  assert.equal(broken.blobs.size,4);
  const racing=fixture();
  const store={...racing.store,async delete(key){await racing.store.delete(key);if(key==='budget/2026-09-25')racing.blobs.add('candidates/2026-09-26/BIROU_ORGANIZARE');}};
  const raceHandler=createKeepaPurgeHandler({env:baseEnv,storeFactory:()=>store,fetchImpl:racing.fetchImpl});
  assert.equal((await (await raceHandler(request('EXECUTE',{confirmation:'DELETE_KEEPA_DATA',expectedBlobCount:3,expectedSnapshotCount:2}))).json()).status,'PURGE_NOT_VERIFIED');
});

test('missing secret never opens the store or queries the database',async()=>{
  const handler=createKeepaPurgeHandler({env:baseEnv,storeFactory:()=>{throw Error('store touched');},fetchImpl:()=>{throw Error('network touched');}});
  assert.equal((await handler(request('DRY_RUN',{},'wrong'))).status,401);
});


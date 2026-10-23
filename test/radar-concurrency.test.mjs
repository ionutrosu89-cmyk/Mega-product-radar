import test from 'node:test';
import assert from 'node:assert/strict';
import {claimRadarScan,transitionRadarScan,readRadarState,SCAN_LEASE_MS} from '../netlify/functions/_radar-state.mjs';
function memoryStore(){const rows=new Map();let version=0;return {
 async getWithMetadata(key){return structuredClone(rows.get(key)||null);},
 async setJSON(key,data,options){const old=rows.get(key);if(options.onlyIfNew&&old||options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)return {modified:false};const etag=String(++version);rows.set(key,{data:structuredClone(data),etag});return {modified:true,etag};}
};}
test('concurrent scan claims permit one provider dispatch per workspace',async()=>{
 const store=memoryStore(),now=Date.now();
 const claims=await Promise.all(Array.from({length:20},(_,i)=>claimRadarScan(store,'workspace-a',{scanId:`s${i}`,status:'queued'},now)));
 assert.equal(claims.filter(c=>c.ok).length,1);
 assert.equal((await claimRadarScan(store,'workspace-b',{scanId:'b',status:'queued'},now)).ok,true);
});
test('expired workers cannot overwrite newer status or results; duplicate delivery is rejected',async()=>{
 const store=memoryStore(),now=Date.now();
 await claimRadarScan(store,'a',{scanId:'old',status:'queued'},now);
 assert.equal(await transitionRadarScan(store,'a','old',{status:'running'},null,now),true);
 assert.equal(await transitionRadarScan(store,'a','old',{status:'running'},null,now),false);
 await claimRadarScan(store,'a',{scanId:'new',status:'queued'},now+SCAN_LEASE_MS+1);
 assert.equal(await transitionRadarScan(store,'a','old',{status:'completed'},{products:['wrong']},now+SCAN_LEASE_MS+2),false);
 assert.equal(await transitionRadarScan(store,'a','new',{status:'running'},null,now+SCAN_LEASE_MS+2),true);
 assert.equal(await transitionRadarScan(store,'a','new',{status:'completed'},{products:['right']},now+SCAN_LEASE_MS+3),true);
 assert.deepEqual((await readRadarState(store,'a')).data.latest.products,['right']);
 assert.equal(await readRadarState(store,'b'),null);
});

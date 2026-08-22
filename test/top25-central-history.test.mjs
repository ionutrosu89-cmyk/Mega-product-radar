import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {FREE_TOP25_NICHES} from '../free-top25-data.js';
import {TOP25_EVIDENCE_REVIEWED_AT} from '../top25-evidence.js';
import {buildTop25Snapshot,prepareTop25MovementCentral} from '../top25-movement.js';
import {createTop25HistoryHandler} from '../netlify/functions/top25-history.mjs';

const niche=FREE_TOP25_NICHES[0];

test('migration keeps central Top 25 history server-only behind RLS',async()=>{
  const sql=await fs.readFile(new URL('../supabase/migrations/20260822_top25_central_history.sql',import.meta.url),'utf8');
  assert.match(sql,/create table if not exists public\.top25_snapshots/i);
  assert.match(sql,/enable row level security/i);
  assert.doesNotMatch(sql,/create policy/i,'browser/anon policies must not expose central history table directly');
});

test('central endpoint fails closed to local fallback when service role is unavailable',async()=>{
  const handler=createTop25HistoryHandler({fetch:async()=>{throw new Error('should not call');},env:{SUPABASE_URL:'https://example.supabase.co'}});
  const response=await handler(new Request(`https://example.test/api/top25/history?niche=${encodeURIComponent(niche.id)}`));
  const body=await response.json();
  assert.equal(response.status,503);
  assert.equal(body.fallback,'LOCAL');
});

test('central endpoint inserts current review once and returns previous global review',async()=>{
  const current=buildTop25Snapshot(niche,TOP25_EVIDENCE_REVIEWED_AT);
  const previous={...current,reviewedAt:'2026-08-21',products:current.products.map((p,index)=>({...p,internalRank:index===0?2:p.internalRank}))};
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url:String(url),options});
    if(options.method==='POST') return new Response(null,{status:201});
    return Response.json([{niche_id:previous.nicheId,reviewed_at:previous.reviewedAt,products:previous.products}]);
  };
  const handler=createTop25HistoryHandler({fetch:fetchImpl,env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-secret'}});
  const response=await handler(new Request(`https://example.test/api/top25/history?niche=${encodeURIComponent(niche.id)}`));
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.mode,'CENTRAL');
  assert.equal(body.previousReviewedAt,'2026-08-21');
  assert.equal(calls.length,2);
  assert.match(calls[0].url,/top25_snapshots/);
  assert.equal(calls[0].options.method,undefined);
  assert.match(calls[1].url,/top25_snapshots\?on_conflict=/);
  assert.equal(calls[1].options.method,'POST');
  assert.equal(calls[1].options.headers.authorization,'Bearer service-secret');
});

test('central endpoint does not write again when current review already exists',async()=>{
  const current=buildTop25Snapshot(niche,TOP25_EVIDENCE_REVIEWED_AT);
  let writes=0;
  const fetchImpl=async(url,options={})=>{
    if(options.method==='POST')writes++;
    return Response.json([{niche_id:current.nicheId,reviewed_at:current.reviewedAt,products:current.products}]);
  };
  const handler=createTop25HistoryHandler({fetch:fetchImpl,env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-secret'}});
  const response=await handler(new Request(`https://example.test/api/top25/history?niche=${encodeURIComponent(niche.id)}`));
  assert.equal(response.status,200);
  assert.equal(writes,0);
});

test('browser movement uses central previous snapshot when endpoint is available',async()=>{
  const current=buildTop25Snapshot(niche,TOP25_EVIDENCE_REVIEWED_AT);
  const previous={...current,reviewedAt:'2026-08-21',products:current.products.map((p,index)=>({...p,internalRank:index===0?2:p.internalRank}))};
  const tracking=await prepareTop25MovementCentral(niche,TOP25_EVIDENCE_REVIEWED_AT,{
    fetchImpl:async()=>Response.json({ok:true,mode:'CENTRAL',current,previous}),
    storage:null
  });
  assert.equal(tracking.historyMode,'CENTRAL');
  assert.equal(tracking.previousReviewedAt,'2026-08-21');
  assert.equal(tracking.movements.get(current.products[0].key).status,'UP');
});

test('browser movement falls back locally when central endpoint fails',async()=>{
  const memory=new Map();
  const storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)};
  const tracking=await prepareTop25MovementCentral(niche,TOP25_EVIDENCE_REVIEWED_AT,{
    fetchImpl:async()=>new Response('no',{status:503}),storage
  });
  assert.equal(tracking.historyMode,'LOCAL');
  assert.equal(tracking.trackingStatus,'BASELINE');
});

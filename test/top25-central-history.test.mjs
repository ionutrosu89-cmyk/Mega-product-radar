import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {FREE_TOP25_NICHES} from '../free-top25-data.js';
import {TOP25_EVIDENCE_REVIEWED_AT} from '../top25-evidence.js';
import {buildTop25Snapshot,prepareTop25MovementCentral} from '../top25-movement.js';
import {createTop25HistoryHandler} from '../netlify/functions/top25-history.mjs';

const niche=FREE_TOP25_NICHES[0];

const row=snapshot=>({niche_id:snapshot.nicheId,reviewed_at:snapshot.reviewedAt,products:snapshot.products});

function refreshRow(){
  return [{checked_at:'2026-08-23T05:15:00.000Z',status:'SUCCESS',sources_checked:12,sources_ok:11,niches_changed:2}];
}

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

test('central endpoint seeds baseline only when no global snapshot exists',async()=>{
  const current=buildTop25Snapshot(niche,TOP25_EVIDENCE_REVIEWED_AT);
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    const value=String(url);calls.push({url:value,options});
    if(value.includes('/top25_refresh_runs'))return Response.json([]);
    if(options.method==='POST')return new Response(null,{status:201});
    return Response.json([]);
  };
  const handler=createTop25HistoryHandler({fetch:fetchImpl,env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-secret'}});
  const response=await handler(new Request(`https://example.test/api/top25/history?niche=${encodeURIComponent(niche.id)}`));
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.mode,'CENTRAL');
  assert.equal(body.current.reviewedAt,current.reviewedAt);
  assert.equal(body.previousReviewedAt,null);
  const writes=calls.filter(call=>call.options.method==='POST');
  assert.equal(writes.length,1);
  assert.match(writes[0].url,/top25_snapshots\?on_conflict=/);
  assert.equal(writes[0].options.headers.authorization,'Bearer service-secret');
});

test('central endpoint serves latest two automated reviews without rewriting history',async()=>{
  const seed=buildTop25Snapshot(niche,TOP25_EVIDENCE_REVIEWED_AT);
  const older={...seed,reviewedAt:'2026-08-22'};
  const latest={...seed,reviewedAt:'2026-08-23',products:seed.products.map((p,index)=>({...p,sourceRank:index===0?3:p.sourceRank}))};
  let writes=0;
  const fetchImpl=async(url,options={})=>{
    const value=String(url);
    if(options.method==='POST'){writes++;return new Response(null,{status:201});}
    if(value.includes('/top25_refresh_runs'))return Response.json(refreshRow());
    return Response.json([row(latest),row(older)]);
  };
  const handler=createTop25HistoryHandler({fetch:fetchImpl,env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-secret'}});
  const response=await handler(new Request(`https://example.test/api/top25/history?niche=${encodeURIComponent(niche.id)}`));
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.current.reviewedAt,'2026-08-23');
  assert.equal(body.previousReviewedAt,'2026-08-22');
  assert.equal(body.lastCheckedAt,'2026-08-23T05:15:00.000Z');
  assert.deepEqual(body.refreshSources,{ok:11,total:12});
  assert.equal(writes,0);
});

test('central endpoint with one existing review returns baseline without duplicate write',async()=>{
  const current=buildTop25Snapshot(niche,TOP25_EVIDENCE_REVIEWED_AT);
  let writes=0;
  const fetchImpl=async(url,options={})=>{
    const value=String(url);
    if(options.method==='POST'){writes++;return new Response(null,{status:201});}
    if(value.includes('/top25_refresh_runs'))return Response.json([]);
    return Response.json([row(current)]);
  };
  const handler=createTop25HistoryHandler({fetch:fetchImpl,env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-secret'}});
  const response=await handler(new Request(`https://example.test/api/top25/history?niche=${encodeURIComponent(niche.id)}`));
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.current.reviewedAt,current.reviewedAt);
  assert.equal(body.previousReviewedAt,null);
  assert.equal(writes,0);
});

test('browser movement uses central previous snapshot when endpoint is available',async()=>{
  const current=buildTop25Snapshot(niche,TOP25_EVIDENCE_REVIEWED_AT);
  const previous={...current,reviewedAt:'2026-08-21',products:current.products.map((p,index)=>({...p,internalRank:index===0?2:p.internalRank}))};
  const tracking=await prepareTop25MovementCentral(niche,TOP25_EVIDENCE_REVIEWED_AT,{
    fetchImpl:async()=>Response.json({ok:true,mode:'CENTRAL',current,previous,lastCheckedAt:'2026-08-23T05:15:00Z',refreshStatus:'SUCCESS',refreshSources:{ok:10,total:10}}),
    storage:null
  });
  assert.equal(tracking.historyMode,'CENTRAL');
  assert.equal(tracking.previousReviewedAt,'2026-08-21');
  assert.equal(tracking.movements.get(current.products[0].key).status,'UP');
  assert.equal(tracking.refreshStatus,'SUCCESS');
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

import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {planRecordUpserts,selectLatestSyncBatchRows} from '../cloud-sync.js';

test('latest complete sync batch remains readable during migration compatibility',()=>{
  const rows=[
    {payload:{name:'legacy'}},
    {sync_batch_id:'a',sync_batch_at:'2026-08-26T10:00:00Z',payload:{name:'old-1'}},
    {sync_batch_id:'b',sync_batch_at:'2026-08-26T11:00:00Z',payload:{name:'new-1'}},
    {sync_batch_id:'b',sync_batch_at:'2026-08-26T11:00:00Z',payload:{name:'new-2'}}
  ];
  assert.deepEqual(selectLatestSyncBatchRows(rows),[{name:'new-1'},{name:'new-2'}]);
});

test('record sync plans independent inserts and compare-and-swap updates',()=>{
  const cloud=[
    {sync_record_id:'a',sync_version:3,payload:{name:'A'}},
    {sync_record_id:'b',sync_version:7,payload:{name:'B'}}
  ];
  const local=[
    {__cloudRecordId:'a',__cloudVersion:3,name:'A2'},
    {__cloudRecordId:'c',name:'C'}
  ];
  assert.deepEqual(planRecordUpserts(local,cloud).map(x=>({kind:x.kind,id:x.recordId,expected:x.expectedVersion,next:x.nextVersion})),[
    {kind:'UPDATE',id:'a',expected:3,next:4},
    {kind:'INSERT',id:'c',expected:0,next:1}
  ]);
});

test('stale writer fails closed instead of overwriting a newer record version',()=>{
  assert.throws(
    ()=>planRecordUpserts([{__cloudRecordId:'a',__cloudVersion:2,name:'stale'}],[{sync_record_id:'a',sync_version:3,payload:{name:'new'}}]),
    error=>error?.code==='CLOUD_SYNC_VERSION_CONFLICT'&&error.expectedVersion===2&&error.actualVersion===3
  );
});

test('cloud push has no workspace-wide destructive delete and scopes CAS to workspace + record + version',async()=>{
  const source=await readFile(new URL('../cloud-sync.js',import.meta.url),'utf8');
  const fn=source.split('export async function pushDatasetToCloud')[1].split('export async function pullDatasetFromCloud')[0];
  assert.doesNotMatch(fn,/\.delete\s*\(/);
  assert.match(fn,/\.eq\('workspace_id',workspace\.id\)\.eq\('sync_record_id',op\.recordId\)\.eq\('sync_version',op\.expectedVersion\)/);
  assert.match(fn,/mode:'RECORD_UPSERT_CAS'/);
});

test('record sync migration creates stable IDs, positive versions, and workspace-scoped uniqueness for every autosynced table',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260826_record_upsert_optimistic_concurrency_v1.sql',import.meta.url),'utf8');
  for(const table of ['suppliers','supplier_offers','rfq_dispatch_states','landed_costs','purchases','portfolio_items','feedback_events','discovery_candidates'])assert.match(sql,new RegExp(`'${table}'`));
  assert.match(sql,/ADD COLUMN IF NOT EXISTS sync_record_id text/);
  assert.match(sql,/ADD COLUMN IF NOT EXISTS sync_version bigint NOT NULL DEFAULT 1/);
  assert.match(sql,/CHECK \(sync_version > 0\)/);
  assert.match(sql,/CREATE UNIQUE INDEX IF NOT EXISTS %I ON public\.%I\(workspace_id, sync_record_id\)/);
});

test('missing local records are preserved remotely until an explicit tombstone protocol exists',async()=>{
  const source=await readFile(new URL('../cloud-sync.js',import.meta.url),'utf8');
  const fn=source.split('export async function pushDatasetToCloud')[1].split('export async function pullDatasetFromCloud')[0];
  assert.match(fn,/No delete on missing local rows/);
  assert.doesNotMatch(fn,/\.delete\s*\(/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {selectLatestSyncBatchRows} from '../cloud-sync.js';

test('latest complete sync batch wins over legacy and older batches',()=>{
  const rows=[
    {payload:{name:'legacy'}},
    {sync_batch_id:'a',sync_batch_at:'2026-08-26T10:00:00Z',payload:{name:'old-1'}},
    {sync_batch_id:'b',sync_batch_at:'2026-08-26T11:00:00Z',payload:{name:'new-1'}},
    {sync_batch_id:'b',sync_batch_at:'2026-08-26T11:00:00Z',payload:{name:'new-2'}}
  ];
  assert.deepEqual(selectLatestSyncBatchRows(rows),[{name:'new-1'},{name:'new-2'}]);
});

test('legacy rows remain readable before migration-era batches exist',()=>{
  const rows=[{payload:{name:'one'}},{payload:{name:'two'}}];
  assert.deepEqual(selectLatestSyncBatchRows(rows),[{name:'one'},{name:'two'}]);
});

test('cloud push persists replacement rows before any destructive cleanup',async()=>{
  const source=await readFile(new URL('../cloud-sync.js',import.meta.url),'utf8');
  const fn=source.split('export async function pushDatasetToCloud')[1].split('export async function pullDatasetFromCloud')[0];
  const insertAt=fn.indexOf('.insert(rows)');
  const deleteAt=fn.indexOf('.delete()');
  assert.ok(insertAt>=0&&deleteAt>insertAt,'replacement batch must be inserted before cleanup');
  assert.match(fn,/\.lt\('sync_batch_at',batch\.at\)/);
  assert.match(fn,/\.is\('sync_batch_at',null\)/);
  assert.doesNotMatch(fn,/delete\(\)\.eq\('workspace_id',workspace\.id\);if\(delError\)/);
});

test('migration adds batch metadata to every autosynced workspace table',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260826_cloud_sync_batch_safety.sql',import.meta.url),'utf8');
  for(const table of ['suppliers','supplier_offers','rfq_dispatch_states','landed_costs','purchases','portfolio_items','feedback_events','discovery_candidates']){
    assert.match(sql,new RegExp(`alter table if exists public\\.${table} add column if not exists sync_batch_id text`));
    assert.match(sql,new RegExp(`alter table if exists public\\.${table} add column if not exists sync_batch_at timestamptz`));
  }
});

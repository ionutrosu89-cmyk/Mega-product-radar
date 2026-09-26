import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';

test('current Top25 schema is reproducible and service-role only',async()=>{
  const sql=await fs.readFile(new URL('../supabase/migrations/20260920090000_current_top25_live_pipeline_v1.sql',import.meta.url),'utf8');
  assert.match(sql,/create table if not exists public\.current_top25_snapshots_v1/i);
  assert.match(sql,/unique\s*\(niche_id,platform,market,window_days,window_end\)/i);
  assert.match(sql,/product_count=jsonb_array_length\(products\)/i);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on public\.current_top25_snapshots_v1 from public,anon,authenticated/i);
  assert.match(sql,/grant all on public\.current_top25_snapshots_v1 to service_role/i);
  assert.match(sql,/Historical archive data must not be stored here/i);
});

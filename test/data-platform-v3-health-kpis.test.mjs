import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Data Platform V3 health KPIs measure freshness and budget without browser exposure',async()=>{
  const sql=await fs.readFile('supabase/migrations/20260823_data_platform_v3_health_kpis.sql','utf8');
  assert.match(sql,/data_platform_product_health_v3/);
  assert.match(sql,/data_platform_health_v3/);
  assert.match(sql,/freshness_status/);
  assert.match(sql,/incurred_at >= date_trunc\('month', now\(\)\)/);
  assert.match(sql,/soft_stop_eur/);
  assert.match(sql,/monthly_hard_cap_eur/);
  assert.match(sql,/revoke all on public\.data_platform_product_health_v3 from anon, authenticated/);
  assert.match(sql,/revoke all on public\.data_platform_health_v3 from anon, authenticated/);
  assert.match(sql,/grant select on public\.data_platform_health_v3 to service_role/);
});

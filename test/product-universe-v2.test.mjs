import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonicalProductKey,normalizeMarketplaceSnapshot,dedupeMarketplaceSnapshots,productUniverseBatchStats} from '../product-universe-engine.js';

test('canonical identity prefers source external id over unstable titles',()=>{
  assert.equal(canonicalProductKey({source:'amazon-us',externalId:'B0ABC123',title:'Any title'}),'amazon-us:b0abc123');
  assert.equal(canonicalProductKey({source:'amazon-us',externalId:'B0ABC123',title:'Changed title'}),'amazon-us:b0abc123');
});

test('missing numeric values remain unknown instead of becoming zero',()=>{
  const r=normalizeMarketplaceSnapshot({source:'amazon-us',externalId:'B1',title:'Desk Hook',observedAt:'2026-08-24T12:00:00Z',price:null,reviews:'',rank:null});
  assert.equal(r.valid,true);
  assert.equal(r.record.price,null);
  assert.equal(r.record.reviews,null);
  assert.equal(r.record.rank,null);
});

test('estimated sales can never be labeled verified sales',()=>{
  const r=normalizeMarketplaceSnapshot({source:'amazon-us',externalId:'B2',title:'Product',observedAt:'2026-08-24T12:00:00Z',estimatedUnits:500,salesEvidenceClass:'VERIFIED'});
  assert.equal(r.valid,false);
  assert.match(r.errors.join(' '),/verified sales cannot be stored in estimatedUnits/i);
});

test('snapshot dedupe is source external-id timestamp scoped and keeps history',()=>{
  const base={source:'amazon-us',externalId:'B3',title:'Product',salesEvidenceClass:'UNKNOWN'};
  const out=dedupeMarketplaceSnapshots([
    {...base,observedAt:'2026-08-24T10:00:00Z',price:10},
    {...base,observedAt:'2026-08-24T10:00:00Z',price:10},
    {...base,observedAt:'2026-08-25T10:00:00Z',price:11}
  ]);
  assert.equal(out.length,2);
});

test('batch stats are intelligence-only and expose coverage without purchase action',()=>{
  const stats=productUniverseBatchStats([
    {source:'amazon-us',externalId:'B4',title:'A',observedAt:'2026-08-24T10:00:00Z',url:'https://example.com/a',rank:1,categoryKey:'desk-organization'},
    {source:'amazon-us',externalId:'B5',title:'B',observedAt:'2026-08-24T10:00:00Z',categoryKey:'desk-organization'}
  ]);
  assert.equal(stats.validCount,2);
  assert.equal(stats.uniqueProductCount,2);
  assert.equal(stats.directUrlCoveragePct,50);
  assert.equal(stats.observedRankCoveragePct,50);
  assert.equal(stats.purchaseAuthorized,false);
  assert.equal(stats.commercialAction,null);
});

test('Product Universe migration stores append-only marketplace history and server-side ingest runs',()=>{
  const sql=fs.readFileSync(new URL('../supabase/migrations/20260824_product_universe_v2.sql',import.meta.url),'utf8');
  assert.match(sql,/marketplace_product_snapshots/i);
  assert.match(sql,/unique\(source_key, external_id, observed_at\)/i);
  assert.match(sql,/product_universe_ingest_runs/i);
  assert.match(sql,/revoke all on public\.product_universe_ingest_runs from anon, authenticated/i);
});

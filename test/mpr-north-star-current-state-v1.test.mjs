import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {buildAmazonRound2Plan} from '../amazon-round2-orchestrator-v1.js';

const read=async p=>JSON.parse(await fs.readFile(new URL(`../${p}`,import.meta.url),'utf8'));

test('current DATA foundation is exactly 1K universe with 255 first live Amazon observations',async()=>{
  const universe=await read('data/real-products-1000.compact.json');
  assert.equal(universe.products.length,1000);
  const payloads=await Promise.all(['data/live-snapshots/amazon-2026-08-25-batch-000.compact.json','data/live-snapshots/amazon-round1-remaining.compact.json','data/live-snapshots/amazon-round1-missing-retry.compact.json'].map(read));
  const plan=buildAmazonRound2Plan(payloads,'2026-08-25T12:00:00.000Z',24);
  assert.equal(plan.capturedCount,255);
  assert.equal(plan.eligibleCount,0);
  assert.equal(plan.blockedCount,255);
  assert.equal(plan.purchaseAuthorized,false);
});

test('current Romania evidence remains lower-bound and cannot be called exact comparable competition',async()=>{
  const batch=await read('data/romania-public-market-evidence-batch-v1.json');
  const text=JSON.stringify(batch);
  for(const known of ['656','512','1636'])assert.match(text,new RegExp(known));
  assert.match(text,/lower/i);
  assert.doesNotMatch(text,/"lowerBoundIsExactCount"\s*:\s*true/);
});

test('current supplier seed has no manually verified quote and authorizes no purchase',async()=>{
  const quotes=await read('supplier-evidence/seed-manual-quotes-2026-08-24.json');
  assert.equal(quotes.records.filter(x=>x.evidenceLevel==='MANUALLY_VERIFIED').length,0);
  assert.equal(quotes.records.some(x=>x.purchaseAuthorized===true),false);
});

test('Launch Academy contains ten operational modules and explicit verified-agent positioning',async()=>{
  const md=await fs.readFile(new URL('../LAUNCH_ACADEMY_V1.md',import.meta.url),'utf8');
  assert.equal((md.match(/^## Modul /gm)||[]).length,10);
  assert.match(md,/agent testat\/verificat de noi/i);
  assert.match(md,/serviciile efective ale agentului se contractează separat/i);
});

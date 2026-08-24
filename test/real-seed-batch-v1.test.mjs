import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {bridgeCollectorBatches} from '../public-collector-universe-bridge.js';

const batch=JSON.parse(fs.readFileSync(new URL('../seed/real/2026-08-24-office-cable-management-alibaba.json',import.meta.url),'utf8'));

test('first real cable-management batch contains ten public Alibaba observations',()=>{
  assert.equal(batch.records.length,10);
  assert.equal(batch.sourceKey,'ALIBABA_TOP_RANKING');
  assert.equal(batch.paidCallsTriggered,0);
  assert.ok(batch.records.every(x=>x.sourceKey==='ALIBABA_TOP_RANKING'));
  assert.ok(batch.records.every(x=>/^160\d+$/.test(x.externalId)));
  assert.ok(batch.records.every(x=>x.url.includes(x.externalId)));
});

test('real batch enters universe without invented sales or purchase authority',()=>{
  const out=bridgeCollectorBatches([{sourceKey:batch.sourceKey,records:batch.records,rejected:[]}]);
  assert.equal(out.universe.uniqueProductObservationCount,10);
  assert.equal(out.universe.rejectedCount,0);
  assert.equal(out.milestone.current,10);
  assert.equal(out.paidCallsTriggered,0);
  assert.equal(out.externalExecutionTriggered,false);
  assert.equal(out.purchaseAuthorized,false);
  assert.ok(out.universe.products.every(x=>x.salesEvidenceClass==='NOT_VERIFIED_SALES'));
});

test('real batch has exact source identities suitable for future snapshot dedupe',()=>{
  const out=bridgeCollectorBatches([{sourceKey:batch.sourceKey,records:batch.records}]);
  const ids=new Set(out.universe.products.map(x=>x.externalId));
  assert.equal(ids.size,10);
  assert.ok(out.universe.products.every(x=>x.platform==='ALIBABA'));
});

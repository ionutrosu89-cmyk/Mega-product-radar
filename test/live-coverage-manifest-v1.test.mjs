import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildLiveCoverageManifest,evaluateSecondObservationEligibility} from '../live-coverage-manifest.js';

const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const bootstrap=read('../data/real-products-1000.compact.json');
const first=read('../data/live-snapshots/amazon-2026-08-25-batch-000.compact.json');
const partial=read('../data/live-snapshots/amazon-round1-remaining.compact.json');
const retry=read('../data/live-snapshots/amazon-round1-missing-retry.compact.json');

const manifest=buildLiveCoverageManifest({bootstrap,liveCompacts:[first,partial,retry],minObservationHours:24});

test('coverage manifest reports exactly 255 captured and 745 missing ASINs',()=>{
  assert.equal(manifest.universeCount,1000);
  assert.equal(manifest.capturedCount,255);
  assert.equal(manifest.missingCount,745);
  assert.equal(manifest.coveragePct,25.5);
  assert.equal(new Set(manifest.captured).size,255);
  assert.equal(new Set(manifest.missing).size,745);
  assert.equal(manifest.rejected.length,0);
});

test('captured and missing sets partition the bootstrap universe without overlap',()=>{
  const captured=new Set(manifest.captured);
  assert.ok(manifest.missing.every(x=>!captured.has(x)));
  assert.equal(new Set([...manifest.captured,...manifest.missing]).size,1000);
});

test('second observation remains blocked before 24h and does not authorize execution',()=>{
  const before=evaluateSecondObservationEligibility(manifest,'2026-08-25T12:00:00Z');
  assert.equal(before.eligibleCount,0);
  assert.equal(before.blockedCount,255);
  assert.equal(before.executionAuthorized,false);
  assert.equal(manifest.secondObservationExecutionAuthorized,false);
  assert.equal(manifest.trendReadyCount,0);
});

test('time gate can mark products eligible but never auto-authorizes execution',()=>{
  const later=evaluateSecondObservationEligibility(manifest,'2026-08-27T12:00:00Z');
  assert.equal(later.eligibleCount,255);
  assert.equal(later.blockedCount,0);
  assert.equal(later.executionAuthorized,false);
  assert.equal(later.paidCallsTriggered,0);
  assert.equal(later.purchaseAuthorized,false);
});

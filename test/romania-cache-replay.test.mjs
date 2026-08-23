import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Romania cache replay reuses fresh paid evidence without new provider calls',async()=>{
  const src=await fs.readFile('scripts/replay-romania-keyword-cache.mjs','utf8');
  assert.match(src,/dataforseo-cache\.json/);
  assert.match(src,/Fresh cached Romania evidence is free to reuse/);
  assert.match(src,/costUsd:0/);
  assert.equal(src.includes('api.dataforseo.com'),false);
  assert.equal(src.includes('fetch('),false);
});

test('Radar replays Romania cache before history and intelligence ecosystem',async()=>{
  const workflow=await fs.readFile('.github/workflows/radar-scan.yml','utf8');
  const replay=workflow.indexOf('node scripts/replay-romania-keyword-cache.mjs');
  const history=workflow.indexOf('node scripts/market-intelligence-history.mjs');
  const ecosystem=workflow.indexOf('node scripts/intelligence-ecosystem-v25.mjs');
  assert.ok(replay>0&&history>replay&&ecosystem>replay);
});

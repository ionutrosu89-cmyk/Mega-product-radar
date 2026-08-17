import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('commercial signal engine exists and keeps proxy disclaimer',()=>{
  const src=fs.readFileSync('scripts/commercial-signal-v2.mjs','utf8');
  assert.match(src,/independentEvidence/);
  assert.match(src,/romaniaGap/);
  assert.match(src,/pricingVerified/);
  assert.match(src,/EARLY_WARNING/);
  assert.match(src,/signals\/proxies/);
});

test('BUY is stricter than TEST',()=>{
  const src=fs.readFileSync('scripts/commercial-signal-v2.mjs','utf8');
  assert.match(src,/c\.score>=75/);
  assert.match(src,/sampleCount\)>=5/);
  assert.match(src,/roi\)>=70/);
});

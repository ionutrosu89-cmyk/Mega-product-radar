import assert from 'node:assert/strict';
import test from 'node:test';
import {confirmCrossPlatformTrend} from '../cross-platform-trend-confirmation.js';

const s=(identity,platform,signal,confidence=80)=>({identity,platform,signal,trendConfidence:confidence,lastSeenAt:'2026-08-24T00:00:00Z'});

test('two manually reviewed independent platforms confirm a positive trend',()=>{
  const out=confirmCrossPlatformTrend([
    s('AMAZON:ID:A','AMAZON','RISING_FAST',85),
    s('EBAY:ID:B','EBAY','NEW_AND_ACCELERATING',75)
  ],[{canonicalKey:'PRODUCT-1',reviewStatus:'MANUALLY_REVIEWED',identities:['AMAZON:ID:A','EBAY:ID:B']}]);
  assert.equal(out.rows[0].status,'CONFIRMED');
  assert.equal(out.rows[0].platformCount,2);
  assert.equal(out.rows[0].autoMerged,false);
  assert.equal(out.purchaseAuthorized,false);
  assert.equal(out.paidCallsTriggered,0);
});

test('mixed rising and cooling evidence is conflicting, not confirmed',()=>{
  const out=confirmCrossPlatformTrend([
    s('AMAZON:ID:A','AMAZON','RISING_FAST'),
    s('EBAY:ID:B','EBAY','COOLING')
  ],[{canonicalKey:'PRODUCT-2',reviewStatus:'MANUALLY_REVIEWED',identities:['AMAZON:ID:A','EBAY:ID:B']}]);
  assert.equal(out.rows[0].status,'CONFLICTING');
  assert.equal(out.rows[0].conflict,true);
});

test('unreviewed cross-platform similarity is rejected and never auto-merged',()=>{
  const out=confirmCrossPlatformTrend([
    s('AMAZON:ID:A','AMAZON','RISING_FAST'),
    s('EBAY:ID:B','EBAY','RISING_FAST')
  ],[{canonicalKey:'PRODUCT-3',reviewStatus:'AUTO_HINT',identities:['AMAZON:ID:A','EBAY:ID:B']}]);
  assert.equal(out.rows.length,0);
  assert.equal(out.rejected[0].error,'MANUAL_REVIEW_REQUIRED');
  assert.equal(out.autoMergePerformed,false);
});

test('duplicate evidence from the same platform counts once',()=>{
  const out=confirmCrossPlatformTrend([
    s('AMAZON:ID:A1','AMAZON','RISING_FAST',90),
    s('AMAZON:ID:A2','AMAZON','RISING_FAST',70),
    s('EBAY:ID:B','EBAY','RISING_FAST',80)
  ],[{canonicalKey:'PRODUCT-4',reviewStatus:'MANUALLY_REVIEWED',identities:['AMAZON:ID:A1','AMAZON:ID:A2','EBAY:ID:B']}]);
  assert.equal(out.rows[0].platformCount,2);
  assert.equal(out.rows[0].status,'CONFIRMED');
});

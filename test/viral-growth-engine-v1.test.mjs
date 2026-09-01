import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalConceptKey,viralGrowthSignal} from '../viral-growth-engine.js';

test('viral evidence fails closed without history and cross-platform confirmation',()=>{
  assert.equal(viralGrowthSignal({observationCount:1}).reason,'INSUFFICIENT_HISTORY');
  assert.equal(viralGrowthSignal({observationCount:4,platforms:['TIKTOK']}).reason,'NEEDS_CROSS_PLATFORM_CONFIRMATION');
});

test('established brands stop before scoring',()=>{
  const out=viralGrowthSignal({observationCount:9,platforms:['TIKTOK','META'],brandPolicyClass:'ESTABLISHED_EXCLUDE'});
  assert.equal(out.reason,'STOP_BRAND_GATE');
  assert.equal(out.score,null);
});

test('accelerating foreign concept enters Romania validation but not commercial funnel without local evidence',()=>{
  const out=viralGrowthSignal({observationCount:7,platforms:['TIKTOK','META','GOOGLE_TRENDS','AMAZON'],countries:['US','GB','DE'],tiktokVelocityScore:95,metaAdMomentumScore:80,googleAccelerationScore:90,amazonDemandScore:75,romaniaScarcityScore:100});
  assert.equal(out.stage,'ACCELERATING');
  assert.equal(out.eligibleForRomaniaValidation,true);
  assert.equal(out.eligibleForCommercialValidation,false);
  assert.equal(out.eligibleForFinalist,false);
});

test('all hard gates are required for finalist eligibility',()=>{
  const base={observationCount:8,platforms:['TIKTOK','META','GOOGLE_TRENDS','AMAZON'],countries:['US','GB','DE','FR','IT'],tiktokVelocityScore:100,metaAdMomentumScore:100,googleAccelerationScore:100,amazonDemandScore:100,romaniaScarcityScore:100,romaniaEvidenceClass:'VALIDATED',importabilityPass:true,supplierVerified:true,economicsConfirmed:true};
  assert.equal(viralGrowthSignal(base).eligibleForFinalist,true);
  assert.equal(viralGrowthSignal({...base,economicsConfirmed:false}).eligibleForFinalist,false);
});

test('concept identity is generic and deterministic',()=>{
  assert.equal(canonicalConceptKey({category:'Pet Care',conceptName:'Portable Dog Paw Cleaner'}),'pet-care:portable-dog-paw-cleaner');
});

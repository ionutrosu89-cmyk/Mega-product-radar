import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyRomaniaListingComparability,classifyRomaniaListingsComparability,THREE_RING_ROUND_BINDER_PROFILE_V2} from '../romania-semantic-comparability-v2.js';

test('explicit two-ring title is a direct contradiction for three-ring binder profile',()=>{
 const r=classifyRomaniaListingComparability({title:'Binder A4 2 Inele albastru'},THREE_RING_ROUND_BINDER_PROFILE_V2);
 assert.equal(r.classification,'NOT_COMPARABLE');
 assert.equal(r.evidenceClass,'DIRECT_OBSERVED');
 assert.match(r.reasons.join('|'),/ATTRIBUTE_CONTRADICTION:ringCount:2!=3/);
});

test('explicit three-ring binder title can be exact when product type signal exists',()=>{
 const r=classifyRomaniaListingComparability({title:'Binder A4 cu 3 inele rotunde'},THREE_RING_ROUND_BINDER_PROFILE_V2);
 assert.equal(r.classification,'EXACT');
 assert.equal(r.manualReviewRequired,false);
});

test('generic binder title without ring count remains only comparable',()=>{
 const r=classifyRomaniaListingComparability({title:'Binder A4 premium pentru documente'},THREE_RING_ROUND_BINDER_PROFILE_V2);
 assert.equal(r.classification,'COMPARABLE');
 assert.equal(r.manualReviewRequired,true);
});

test('unrelated vague title stays unknown instead of being forced into competition count',()=>{
 const r=classifyRomaniaListingComparability({title:'Organizator documente premium'},THREE_RING_ROUND_BINDER_PROFILE_V2);
 assert.equal(r.classification,'UNKNOWN');
});

test('explicit mechanism exclusion wins even if title says three rings',()=>{
 const r=classifyRomaniaListingComparability({title:'Mecanism metalic 3 inele pentru biblioraft'},THREE_RING_ROUND_BINDER_PROFILE_V2);
 assert.equal(r.classification,'NOT_COMPARABLE');
 assert.match(r.reasons.join('|'),/EXCLUDED_PHRASE:mecanism/);
});

test('structured attribute can establish exact without parsing title number',()=>{
 const r=classifyRomaniaListingComparability({title:'Binder office premium',observedAttributes:{ringCount:3},attributeEvidenceClass:{ringCount:'MANUALLY_VERIFIED'}},THREE_RING_ROUND_BINDER_PROFILE_V2);
 assert.equal(r.classification,'EXACT');
});

test('batch report preserves unknowns and never authorizes purchase',()=>{
 const r=classifyRomaniaListingsComparability([
  {title:'Binder 2 inele'},
  {title:'Binder 3 inele'},
  {title:'Organizator documente'}
 ],THREE_RING_ROUND_BINDER_PROFILE_V2);
 assert.equal(r.counts.NOT_COMPARABLE,1);
 assert.equal(r.counts.EXACT,1);
 assert.equal(r.counts.UNKNOWN,1);
 assert.equal(r.purchaseAuthorized,false);
 assert.equal(r.paidCallsTriggered,0);
});

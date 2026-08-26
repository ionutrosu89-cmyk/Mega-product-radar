import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLeaderImportabilityPretriage} from '../leader-importability-pretriage-v1.js';

test('marks liquid title for review but never auto-blocks or passes',()=>{
  const r=buildLeaderImportabilityPretriage({leaders:[{asin:'A',title:'Premium Liquid Flocculant',reviewDelta:2}]});
  assert.equal(r.rows[0].pretriageStatus,'REVIEW_FIRST');
  assert.ok(r.rows[0].flags.includes('TITLE_SUGGESTS_LIQUID_OR_CHEMICAL_REVIEW'));
  assert.equal(r.rows[0].importabilityPassed,false);
  assert.equal(r.rows[0].supplierSourcingAuthorized,false);
});

test('title with no known risk signal remains unknown not passed',()=>{
  const r=buildLeaderImportabilityPretriage({leaders:[{asin:'B',title:'Small Craft Bells',reviewDelta:1}]});
  assert.equal(r.rows[0].pretriageStatus,'NO_TITLE_RISK_SIGNAL');
  assert.equal(r.rows[0].importabilityPassed,false);
});

test('ingestible title is regulatory review only',()=>{
  const r=buildLeaderImportabilityPretriage({leaders:[{asin:'C',title:'Omega-3 240 Softgels'}]});
  assert.ok(r.rows[0].flags.includes('TITLE_SUGGESTS_INGESTIBLE_REGULATORY_REVIEW'));
  assert.equal(r.purchaseAuthorized,false);
  assert.equal(r.paidCallsTriggered,0);
});

test('cream horn molds does not become a liquid false positive',()=>{
  const r=buildLeaderImportabilityPretriage({leaders:[{asin:'D',title:'Stainless Steel Cream Horn Molds Pack of 12'}]});
  assert.equal(r.rows[0].flags.includes('TITLE_SUGGESTS_LIQUID_OR_CHEMICAL_REVIEW'),false);
  assert.ok(r.rows[0].flags.includes('TITLE_SUGGESTS_WEIGHT_REVIEW'));
});

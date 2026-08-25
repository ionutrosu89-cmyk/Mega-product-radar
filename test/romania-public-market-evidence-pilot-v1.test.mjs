import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const pilot=JSON.parse(readFileSync(new URL('../data/romania-public-market-evidence-pilot-v1.json',import.meta.url),'utf8'));

test('pilot stores real reviewed eMAG and Trendyol Romania evidence without sales claims',()=>{
  assert.equal(pilot.nicheKey,'office:cable-management');
  assert.equal(pilot.observations.length,2);
  assert.deepEqual(pilot.observations.map(x=>x.platform).sort(),['EMAG','TRENDYOL']);
  assert.ok(pilot.observations.every(x=>x.market==='RO'));
  assert.equal(pilot.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(pilot.paidCallsTriggered,0);
  assert.equal(pilot.approvedSpendEur,0);
  assert.equal(pilot.purchaseAuthorized,false);
});

test('Trendyol 12+ stays a lower bound and is never promoted to an exact listing count',()=>{
  const x=pilot.observations.find(x=>x.platform==='TRENDYOL');
  assert.equal(x.listingCountLowerBound,12);
  assert.equal(x.listingCount,null);
  assert.equal(x.comparableScopeConfirmed,true);
  assert.equal(x.freshnessClass,'SOURCE_PAGE_EXPLICIT_LAST_UPDATED');
});

test('eMAG product presence cannot masquerade as category saturation',()=>{
  const x=pilot.observations.find(x=>x.platform==='EMAG');
  assert.equal(x.listingCount,null);
  assert.equal(x.sellerCount,null);
  assert.equal(x.observedAt,null);
  assert.equal(x.comparableScopeConfirmed,false);
});

test('Romania Gap competition remains blocked until comparable eMAG market evidence exists',()=>{
  assert.equal(pilot.gate.status,'PARTIAL_LOCAL_EVIDENCE');
  assert.equal(pilot.gate.romaniaGapCompetitionReady,false);
  assert.ok(pilot.gate.blockers.includes('EMAG_COMPARABLE_MARKET_COUNT_MISSING'));
  assert.ok(pilot.gate.blockers.includes('EXACT_CROSS_MARKET_SCOPE_NOT_YET_CONFIRMED'));
});

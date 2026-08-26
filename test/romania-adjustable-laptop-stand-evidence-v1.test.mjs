import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const d=JSON.parse(fs.readFileSync(new URL('../data/romania-adjustable-laptop-stand-evidence-v1.json',import.meta.url),'utf8'));

test('adjustable laptop stand pilot stores direct canonical Trendyol presence',()=>{
  assert.equal(d.canonicalNicheKey,'ADJUSTABLE_LAPTOP_STANDS');
  assert.equal(d.directCanonicalPresence.length,2);
  for(const row of d.directCanonicalPresence){
    assert.equal(row.canonicalMatch,true);
    assert.match(row.url,/^https:\/\/www\.trendyol\.com\/ro\//);
  }
});

test('1636+ broad Trendyol surface cannot become canonical Romania competition',()=>{
  assert.equal(d.broadSurface.surfaceItemCountLowerBound,1636);
  assert.equal(d.broadSurface.scopeStatus,'CONTAMINATED_BROAD_SURFACE');
  assert.equal(d.broadSurface.canonicalListingCount,null);
  assert.equal(d.broadSurface.canonicalListingCountLowerBound,null);
  assert.equal(d.broadSurface.comparableScopeConfirmed,false);
  assert.equal(d.romaniaGapExactGateSatisfied,false);
});

test('presence evidence remains non-sales zero-spend and non-purchasing',()=>{
  assert.equal(d.evidenceClass,'DIRECT_PUBLIC_LISTING_PRESENCE');
  assert.equal(d.verifiedSales,false);
  assert.equal(d.policy.paidCallsTriggered,0);
  assert.equal(d.policy.providerSpend,0);
  assert.equal(d.policy.purchaseAuthorized,false);
});

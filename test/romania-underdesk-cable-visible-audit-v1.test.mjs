import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const d=JSON.parse(fs.readFileSync(new URL('../data/romania-underdesk-cable-visible-audit-v1.json',import.meta.url),'utf8'));

test('reviewed Trendyol surface preserves 12 visible listings and only 2 canonical matches',()=>{
  assert.equal(d.visibleListingCount,12);
  assert.equal(d.listings.length,12);
  assert.equal(d.listings.filter(x=>x.canonical===true).length,2);
  assert.equal(d.canonicalVisibleCount,2);
});

test('12+ surface cannot become surface-exact or Romania exact evidence',()=>{
  assert.equal(d.declaredSurfaceCount,'12+');
  assert.equal(d.surfaceExact,false);
  assert.equal(d.marketComparableExact,false);
  assert.ok(d.blockers.includes('DECLARED_COUNT_IS_LOWER_BOUND_PLUS'));
  assert.ok(d.blockers.includes('EXHAUSTIVE_PAGINATION_NOT_PROVEN'));
});

test('visible audit remains zero-spend non-sales non-purchase evidence',()=>{
  assert.equal(d.verifiedSales,false);
  assert.equal(d.paidCallsTriggered,0);
  assert.equal(d.providerSpend,0);
  assert.equal(d.purchaseAuthorized,false);
});

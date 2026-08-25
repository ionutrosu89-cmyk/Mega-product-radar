import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const queue=JSON.parse(fs.readFileSync(new URL('../data/romania-comparable-evidence-review-queue-v1.json',import.meta.url),'utf8'));

test('review queue stays zero-spend and decision-only',()=>{
  assert.equal(queue.version,'1.0');
  assert.deepEqual(queue.policy.requiredLocalPlatforms,['EMAG','TRENDYOL']);
  assert.equal(queue.policy.lowerBoundIsExactCount,false);
  assert.equal(queue.policy.sellerOrStoreScopedAllowed,false);
  assert.equal(queue.policy.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(queue.policy.purchaseAuthorized,false);
  assert.equal(queue.policy.paidCallsTriggered,0);
  assert.equal(queue.policy.approvedSpendEur,0);
});

test('three canonical MPR niches are prioritized and blocked until comparable evidence exists',()=>{
  assert.deepEqual(queue.items.map(x=>x.nicheKey),[
    'travel:packing-cubes',
    'automotive:trunk-organization',
    'office:laptop-accessories'
  ]);
  assert.deepEqual(queue.items.map(x=>x.priority),[1,2,3]);
  for(const item of queue.items){
    assert.ok(item.comparabilityKey);
    assert.ok(item.canonicalDefinition.length>30);
    assert.ok(item.queries.EMAG);
    assert.ok(item.queries.TRENDYOL);
    assert.equal(item.knownEvidence.EMAG.listingCount,null);
    assert.equal(item.knownEvidence.TRENDYOL.listingCount,null);
    assert.match(item.promotionStatus,/^BLOCKED_/);
    assert.ok(item.requiredBeforePromotion.includes('SAME_CANONICAL_DEFINITION_CONFIRMED'));
    assert.ok(item.requiredBeforePromotion.includes('OBSERVED_AT_ON_BOTH_PLATFORMS'));
  }
});

test('known Trendyol quantities remain lower bounds and are never promoted to exact counts',()=>{
  const [packing,trunk,laptop]=queue.items;
  assert.equal(packing.knownEvidence.TRENDYOL.listingCountLowerBound,656);
  assert.equal(trunk.knownEvidence.TRENDYOL.listingCountLowerBound,512);
  assert.equal(laptop.knownEvidence.TRENDYOL.listingCountLowerBound,1636);
  assert.equal(packing.knownEvidence.TRENDYOL.status,'LOWER_BOUND_ONLY');
  assert.equal(trunk.knownEvidence.TRENDYOL.status,'LOWER_BOUND_ONLY');
  assert.equal(laptop.knownEvidence.TRENDYOL.status,'BROAD_SCOPE_REVIEW_REQUIRED');
});

test('packing cubes remains the first promotion candidate',()=>{
  const first=queue.items[0];
  assert.equal(first.nicheKey,'travel:packing-cubes');
  assert.equal(first.comparabilityKey,'PACKING_CUBES_SET');
  assert.equal(first.promotionStatus,'BLOCKED_AWAITING_COMPARABLE_EXACT_COUNTS');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {loadRealProductBootstrap,realProductBootstrapSummary} from '../real-product-bootstrap.js';

const compact=JSON.parse(fs.readFileSync(new URL('../data/real-products-1000.compact.json',import.meta.url),'utf8'));

test('real product bootstrap contains exactly 1000 unique native Amazon identities',()=>{
  const out=loadRealProductBootstrap(compact);
  assert.equal(out.ok,true,JSON.stringify(out.errors));
  assert.equal(out.uniqueProductCount,1000);
  assert.equal(new Set(out.products.map(x=>x.externalId)).size,1000);
  assert.equal(new Set(out.products.map(x=>x.url)).size,1000);
  assert.equal(out.rejected.length,0);
});

test('all bootstrap URLs are canonical ASIN URLs and are never ranking or verified-sales claims',()=>{
  const out=loadRealProductBootstrap(compact);
  for(const p of out.products){
    assert.match(p.externalId,/^[A-Z0-9]{10}$/);
    assert.equal(p.url,`https://www.amazon.com/dp/${p.externalId}`);
    assert.equal(p.sourceRank,null);
    assert.equal(p.rankEvidenceClass,'NOT_A_RANKING_OBSERVATION');
    assert.equal(p.salesEvidenceClass,'NOT_VERIFIED_SALES');
    assert.equal(p.freshnessClass,'BOOTSTRAP_SNAPSHOT_NOT_LIVE');
    assert.equal(p.purchaseAuthorized,false);
  }
});

test('bootstrap reaches the first real Product Universe milestone without paid calls',()=>{
  const s=realProductBootstrapSummary(compact);
  assert.equal(s.ok,true);
  assert.equal(s.uniqueProductCount,1000);
  assert.equal(s.milestone.milestones.find(x=>x.target===1000).reached,true);
  assert.equal(s.milestone.next.target,5000);
  assert.equal(s.milestone.next.remaining,4000);
  assert.equal(s.paidCallsTriggered,0);
  assert.equal(s.purchaseAuthorized,false);
  assert.equal(s.rankingEvidence,false);
});

test('bootstrap keeps source-data URL inconsistencies visible while canonical identity remains clean',()=>{
  const out=loadRealProductBootstrap(compact);
  assert.ok(out.integrity.sourceUrlIdentityMismatchCount>0);
  assert.equal(out.integrity.canonicalUrlMismatchCount,0);
  assert.equal(out.products.filter(x=>x.sourceUrlIdentityMatch===false).length,out.integrity.sourceUrlIdentityMismatchCount);
});

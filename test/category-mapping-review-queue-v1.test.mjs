import assert from 'node:assert/strict';
import test from 'node:test';
import {flattenCategoryUniverse,buildCategoryMappingReviewQueue,validateMarketplaceCategoryMapping,approvedMappingsForSeed} from '../category-mapping-review-queue.js';

const taxonomy={departments:[{key:'electronics-office',label:'Electronice & Birou',children:[{key:'office',label:'Birou',niches:['desk-organization','headphone-accessories']}]},{key:'automotive',label:'Auto',children:[{key:'car-interior',label:'Interior auto',niches:['visor-accessories']}]}]};

const approved={mprCategory:'office:desk-organization',amazon:{categoryPath:'office-products',markets:['US'],surfaces:['BEST_SELLERS']},alibaba:{categorySlug:'desk-organizer'},ebay:{categoryId:'159907'},approved:true,approvalEvidence:'manual review against marketplace category surfaces',reviewedBy:'MPR_ADMIN',reviewedAt:'2026-08-24T18:00:00Z'};

test('taxonomy flattens department category and niche identities deterministically',()=>{
  const rows=flattenCategoryUniverse(taxonomy);
  assert.equal(rows.length,3);
  assert.equal(rows[0].mprCategory,'office:desk-organization');
  assert.equal(rows[2].mprCategory,'car-interior:visor-accessories');
});

test('review queue separates approved, needs review and unmapped niches',()=>{
  const queue=buildCategoryMappingReviewQueue({taxonomy,mappings:[approved,{mprCategory:'office:headphone-accessories',amazon:{categoryPath:'electronics-accessories'},approved:false}]});
  assert.equal(queue.totalNiches,3);
  assert.equal(queue.approved,1);
  assert.equal(queue.needsReview,1);
  assert.equal(queue.unmapped,1);
  assert.equal(queue.rows.find(x=>x.mprCategory==='office:desk-organization').executable,true);
  assert.equal(queue.purchaseAuthorized,false);
});

test('approved mappings fail closed without approval evidence or review date',()=>{
  const bad=validateMarketplaceCategoryMapping({mprCategory:'office:desk-organization',amazon:{categoryPath:'office-products'},approved:true});
  assert.equal(bad.ok,false);
  assert.ok(bad.errors.includes('APPROVAL_EVIDENCE_REQUIRED'));
  assert.ok(bad.errors.includes('REVIEWED_AT_REQUIRED'));
  assert.equal(bad.executable,false);
});

test('eBay category id must be explicit numeric evidence',()=>{
  const bad=validateMarketplaceCategoryMapping({mprCategory:'car-interior:visor-accessories',ebay:{categoryId:'maybe-auto'},approved:false});
  assert.equal(bad.ok,false);
  assert.ok(bad.errors.includes('EBAY_CATEGORY_ID_INVALID'));
});

test('only valid mappings inside canonical taxonomy can enter seed manifest',()=>{
  const out=approvedMappingsForSeed({taxonomy,mappings:[approved,{...approved,mprCategory:'unknown:fake'}]});
  assert.equal(out.approvedCount,1);
  assert.equal(out.rejectedCount,1);
  assert.equal(out.approved[0].mprCategory,'office:desk-organization');
  assert.equal(out.externalExecutionTriggered,false);
  assert.equal(out.paidCallsTriggered,0);
});

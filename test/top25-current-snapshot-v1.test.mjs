import assert from 'node:assert/strict';
import test from 'node:test';
import {currentTop25Coverage,normalizeCurrentTop25Snapshot,publicDisplayApprovalKey} from '../top25-current-snapshot-v1.js';

const products=(count=25,observedAt='2026-09-20T06:00:00Z')=>Array.from({length:count},(_,i)=>({
  name:`Product ${i+1}`,externalId:`EPID-${i+1}`,rank:i+1,sourceUrl:`https://www.ebay.com/p/EPID-${i+1}`,observedAt,
  sourceLabel:'eBay Buy Marketing API',evidenceClass:'DIRECT'
}));

test('current snapshot accepts exactly 25 fresh unique official ranking rows',()=>{
  const result=normalizeCurrentTop25Snapshot({nicheId:'AUTO',platform:'EBAY',market:'EBAY_US',sourceKey:'EBAY_BUY_MARKETING_BEST_SELLING',products:products()},{now:new Date('2026-09-20T07:00:00Z'),rightsApproved:true});
  assert.equal(result.ok,true);
  assert.equal(result.snapshot.product_count,25);
  assert.equal(result.snapshot.source_rights_status,'APPROVED');
  assert.equal(result.snapshot.products[0].salesEvidenceClass,'PLATFORM_RANK_NOT_UNIT_SALES');
  assert.equal(result.snapshot.products[0].rankingBasis,'BEST_SELLING');
});

test('current snapshot fails closed on rights, stale data, incomplete rows and duplicates',()=>{
  const base={nicheId:'AUTO',platform:'EBAY',market:'EBAY_US',sourceKey:'EBAY_BUY_MARKETING_BEST_SELLING'};
  assert.equal(normalizeCurrentTop25Snapshot({...base,products:products()},{now:new Date('2026-09-20T07:00:00Z')}).code,'PUBLIC_DISPLAY_RIGHTS_REQUIRED');
  assert.equal(normalizeCurrentTop25Snapshot({...base,products:products(24)},{now:new Date('2026-09-20T07:00:00Z'),rightsApproved:true}).code,'EXACTLY_25_PRODUCTS_REQUIRED');
  assert.equal(normalizeCurrentTop25Snapshot({...base,products:products(25,'2026-09-10T06:00:00Z')},{now:new Date('2026-09-20T07:00:00Z'),rightsApproved:true}).code,'INVALID_OR_STALE_PRODUCT');
  const duplicate=products();duplicate[1].externalId=duplicate[0].externalId;
  assert.equal(normalizeCurrentTop25Snapshot({...base,products:duplicate},{now:new Date('2026-09-20T07:00:00Z'),rightsApproved:true}).code,'DUPLICATE_EXTERNAL_ID');
});

test('coverage counts only complete, approved and current snapshots',()=>{
  const accepted={niche_id:'AUTO',platform:'EBAY',product_count:25,source_rights_status:'APPROVED',freshness_status:'CURRENT'};
  const coverage=currentTop25Coverage([accepted,{...accepted,niche_id:'CASA',source_rights_status:'REVIEW_REQUIRED'}]);
  assert.equal(coverage.coveredNicheCount,1);
  assert.equal(coverage.coveredPositions,25);
  assert.equal(coverage.allNichesCovered,false);
  assert.equal(publicDisplayApprovalKey('AMAZON_DE'),'MPR_AMAZON_PUBLIC_DISPLAY_APPROVED');
});

test('supporting signals cannot be published as product rankings',()=>{
  for(const platform of ['GOOGLE','TIKTOK','ROMANIA']){
    const result=normalizeCurrentTop25Snapshot({nicheId:'AUTO',platform,market:'RO',sourceKey:'SUPPORTING_SIGNAL',products:products()},{now:new Date('2026-09-20T07:00:00Z'),rightsApproved:true});
    assert.equal(result.code,'PLATFORM_NOT_ALLOWED');
  }
});

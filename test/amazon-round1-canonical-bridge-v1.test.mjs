import test from 'node:test';
import assert from 'node:assert/strict';
import {amazonRound1CompactToObservations,buildAmazonRound1CanonicalBridge} from '../amazon-round1-canonical-bridge-v1.js';

const sample={
  schemaVersion:'MPR_AMAZON_LIVE_ROUND1_REMAINING_V1',
  uniqueLiveSnapshots:2,
  coverage:{withPrice:1,withRating:2,withReviews:1},
  productSetSha256:'abc123',
  fields:['asin','title','price','currency','rating','reviewCount','observedAt','statusCode','htmlBytes'],
  products:[
    ['B000000001','Desk organizer',19.99,'USD',4.6,123,'2026-08-30T16:00:00Z',200,12345],
    ['B000000002','Storage rack',null,null,4.2,null,'2026-08-30T16:01:00Z',200,23456]
  ],
  policy:{salesEvidenceClass:'NOT_VERIFIED_SALES',providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false,trendAuthorized:false}
};

test('converts compact Amazon rows into compatible canonical observations',()=>{
  const rows=amazonRound1CompactToObservations(sample,{sourceRunId:'33322314894'});
  assert.equal(rows.length,2);
  assert.equal(rows[0].platform,'AMAZON');
  assert.equal(rows[0].marketplace,'AMAZON');
  assert.equal(rows[0].externalId,'B000000001');
  assert.equal(rows[0].salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(rows[0].trendAuthorized,false);
  assert.equal(rows[0].purchaseAuthorized,false);
  assert.equal(rows[0].provenance.sourceRunId,'33322314894');
  assert.equal(rows[0].provenance.statusCode,200);
});

test('builds a zero-rejection canonical batch without cross-platform promotion',()=>{
  const result=buildAmazonRound1CanonicalBridge(sample,{sourceRunId:'33322314894'});
  assert.equal(result.manifest.canonicalCount,2);
  assert.equal(result.manifest.rejectedCount,0);
  assert.equal(result.manifest.logicalDuplicateCount,0);
  assert.deepEqual(result.source.coverage,{withPrice:1,withRating:2,withReviews:1});
  assert.equal(result.accepted[0].canonicalKey,'AMAZON:AMAZON:B000000001');
  assert.equal(result.policy.crossPlatformAutoMerge,false);
  assert.equal(result.policy.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(result.policy.trendAuthorized,false);
  assert.equal(result.policy.purchaseAuthorized,false);
});

test('fails closed on unsafe or inconsistent source contracts',()=>{
  assert.throws(()=>amazonRound1CompactToObservations({...sample,policy:{...sample.policy,purchaseAuthorized:true}}),/PURCHASE_AUTHORIZATION_FORBIDDEN/);
  assert.throws(()=>amazonRound1CompactToObservations({...sample,policy:{...sample.policy,salesEvidenceClass:'VERIFIED_SALES'}}),/VERIFIED_SALES_FORBIDDEN/);
  const bad={...sample,products:[...sample.products]};bad.products[0]=[...bad.products[0]];bad.products[0][7]=403;
  assert.throws(()=>amazonRound1CompactToObservations(bad),/STATUS_NOT_200/);
});

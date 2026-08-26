import test from 'node:test';
import assert from 'node:assert/strict';
import {measureCompactBootstrapSource,planCanonicalBootstrapResolution} from '../bootstrap-source-coverage-v1.js';

const fields=['asin','title','brand','categoryLabel','price','currency','rating','reviewCount','observedAt','sourceUrlIdentityMatch'];
const dataset={fields,products:[
 ['B001','One','Brand','Office',10,'USD',4.5,100,'2024-01-01',true],
 ['B002','Two','Brand','Home',null,'USD',4.2,50,'2024-01-01',false]
]};

test('source coverage is measured without pretending canonical coverage exists',()=>{
 const r=measureCompactBootstrapSource(dataset);
 assert.equal(r.sourceProductCount,2);assert.equal(r.coverage.sourceIdentityCoveragePct,100);assert.equal(r.coverage.priceCoveragePct,50);assert.equal(r.coverage.reviewCoveragePct,100);
 assert.equal(r.canonicalBinding.measured,false);assert.equal(r.canonicalBinding.canonicalProducts,null);assert.equal(r.scaleAuthorized,false);assert.equal(r.purchaseAuthorized,false);
});

test('canonical bootstrap plan uses exact source aliases and requires server resolution',()=>{
 const r=planCanonicalBootstrapResolution(dataset);
 assert.equal(r.items.length,2);assert.equal(r.items[0].stagingCanonicalKey,'source:AMAZON:B001');assert.equal(r.serverResolutionRequired,true);assert.equal(r.clientGeneratedCanonicalUuid,false);assert.equal(r.titleAutoMergeAllowed,false);assert.equal(r.automaticExecutionAllowed,false);
});

test('duplicate ASIN is rejected instead of creating duplicate canonical work',()=>{
 const r=planCanonicalBootstrapResolution({fields,products:[dataset.products[0],dataset.products[0]]});
 assert.equal(r.items.length,1);assert.equal(r.rejected[0].reason,'DUPLICATE_ASIN');
});

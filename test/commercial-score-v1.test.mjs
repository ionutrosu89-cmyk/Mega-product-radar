import test from 'node:test';
import assert from 'node:assert/strict';
import {commercialScoreV1} from '../commercial-score-v1.js';

test('commercial score calculates only with all hard dimensions present',()=>{
 const r=commercialScoreV1({demandScore:80,romaniaGapScore:75,trendScore:85,supplierScore:90,economicsScore:88,logisticsScore:80,complianceScore:85,capitalEfficiencyScore:70});
 assert.equal(r.status,'CALCULATED');
 assert.ok(r.score>75);
 assert.equal(r.purchaseAuthorized,false);
});

test('missing economics fails closed and cannot be ranked',()=>{
 const r=commercialScoreV1({demandScore:80,romaniaGapScore:75,supplierScore:90,logisticsScore:80,complianceScore:85});
 assert.equal(r.status,'UNKNOWN_FAIL_CLOSED');
 assert.equal(r.score,null);
 assert.ok(r.blockers.includes('MISSING_ECONOMICS_SCORE'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {publicSalesEstimateV1} from '../public-sales-estimation-v1.js';

const evidence={
 sourceClass:'THIRD_PARTY_ESTIMATED_MONTHLY_SALES',sourceProvider:'Example',sourceIndependenceCount:1,comparableMatch:'HIGH',
 temporalSnapshots:[
  {month:'2026-03',estimatedUnits30d:9000},{month:'2026-04',estimatedUnits30d:9000},{month:'2026-05',estimatedUnits30d:9000},
  {month:'2026-06',estimatedUnits30d:9000},{month:'2026-07',estimatedUnits30d:7000},{month:'2026-08',estimatedUnits30d:9000}
 ],
 recentCategorySnapshots:[{top10AverageEstimatedUnits30d:2300},{top10AverageEstimatedUnits30d:2600}],
 recentComparablePeers:[{estimatedUnits30d:9000,match:'HIGH'},{estimatedUnits30d:2000,match:'HIGH'},{estimatedUnits30d:3000,match:'HIGH'}]
};

test('consistent public third-party peer history may reach high estimated confidence without becoming verified sales',()=>{
 const r=publicSalesEstimateV1(evidence);
 assert.equal(r.status,'ESTIMATED_HIGH_CONFIDENCE');
 assert.ok(r.confidence>=75&&r.confidence<=82);
 assert.equal(r.estimatedUnits30d,2725);
 assert.equal(r.verifiedCompetitorSales,false);
 assert.equal(r.actualObservedSales,false);
});

test('sparse third-party evidence fails closed',()=>{
 const r=publicSalesEstimateV1({...evidence,temporalSnapshots:[{month:'2026-08',estimatedUnits30d:9000}]});
 assert.equal(r.status,'INSUFFICIENT_DATA');
});

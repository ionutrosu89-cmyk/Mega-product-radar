import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const d=JSON.parse(fs.readFileSync(new URL('../data/amazon-priority-live-candidate-v1.json',import.meta.url),'utf8'));

test('B0CHYDX91L is the single strict target-niche match in the 1K identity universe and is not live yet',()=>{
 assert.equal(d.candidate.asin,'B0CHYDX91L');
 assert.equal(d.candidate.canonicalNicheKey,'ADJUSTABLE_LAPTOP_STANDS');
 assert.equal(d.candidate.canonicalMatch,true);
 assert.equal(d.candidate.hasFirstLiveObservation,false);
 assert.equal(d.coverageContext.strictTargetNicheMatchesInFull1000,1);
 assert.equal(d.coverageContext.strictTargetNicheMatchesMissingFirstLive,1);
 assert.equal(d.coverageContext.strictTargetNicheMatchesInCurrentLive255,0);
});

test('priority identity cannot masquerade as live evidence or Romania exact evidence',()=>{
 assert.equal(d.candidate.amazonEvidenceStatus,'IDENTITY_ONLY_NOT_LIVE');
 assert.equal(d.candidate.round2Eligible,false);
 assert.equal(d.romaniaContext.exactComparableCount,null);
 assert.equal(d.romaniaContext.romaniaGapExactGateSatisfied,false);
 assert.equal(d.verifiedSales,false);
 assert.equal(d.rankEvidence,false);
});

test('priority record stays zero-spend and non-purchasing',()=>{
 assert.equal(d.paidCallsTriggered,0);
 assert.equal(d.providerSpend,0);
 assert.equal(d.purchaseAuthorized,false);
});

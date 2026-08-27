import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRankingEligibility,evaluateAggregateRankingTrust,applyRankingTrustCap} from '../ranking-eligibility-v1.js';

const sha='a'.repeat(64);
const trusted={
  policyDecision:'ACCEPT',
  evidenceClass:'EXPLICIT_PRODUCT_BEST_SELLERS_RANK',
  analysisAllowed:true,
  exactIdentity:true,
  hasProvenance:true
};

test('trusted ranking signal requires policy accept, rights, identity and provenance',()=>{
  const r=evaluateRankingEligibility(trusted);
  assert.equal(r.trustedEligible,true);
  assert.equal(r.decision,'RANKING_ELIGIBLE');
});

test('policy HOLD cannot become ranking evidence',()=>{
  const r=evaluateRankingEligibility({...trusted,policyDecision:'HOLD'});
  assert.equal(r.trustedEligible,false);
  assert.ok(r.reasons.includes('POLICY_KERNEL_ACCEPT_REQUIRED'));
});

test('catalogue bootstrap evidence is never a ranking signal',()=>{
  const r=evaluateRankingEligibility({...trusted,evidenceClass:'OPEN_PUBLIC_DATASET_PRODUCT'});
  assert.equal(r.trustedEligible,false);
  assert.ok(r.reasons.includes('CATALOGUE_EVIDENCE_NOT_RANKING_SIGNAL'));
});

test('envelope-derived exact identity and provenance can satisfy boundary',()=>{
  const r=evaluateRankingEligibility({
    policy:{decision:'ACCEPT'},
    envelope:{
      evidenceClass:'VERIFIED_SEARCH_DEMAND',
      expectedIdentity:{externalId:'abc'},
      observedIdentity:{externalId:'ABC'},
      sourceRights:{analysisAllowed:true},
      provenance:{collector:'c',runId:'r',contentSha256:sha}
    }
  });
  assert.equal(r.trustedEligible,true);
});

test('legacy product remains research ordering only and is capped below priority tier',()=>{
  const trust=evaluateAggregateRankingTrust({launchScore:{enoughEvidence:true},evidenceCoverage:{concreteRows:3}});
  assert.equal(trust.trustedEligible,false);
  assert.equal(trust.legacyResearchOrderingAllowed,true);
  assert.equal(applyRankingTrustCap(91,trust),67);
});

test('untrusted product is capped below validation tier',()=>{
  const trust=evaluateAggregateRankingTrust({});
  assert.equal(trust.trustedEligible,false);
  assert.equal(trust.legacyResearchOrderingAllowed,false);
  assert.equal(applyRankingTrustCap(91,trust),54);
});

test('trusted aggregate signal is not capped',()=>{
  const trust=evaluateAggregateRankingTrust({rankingEvidence:[trusted]});
  assert.equal(trust.trustedEligible,true);
  assert.equal(applyRankingTrustCap(91,trust),91);
});

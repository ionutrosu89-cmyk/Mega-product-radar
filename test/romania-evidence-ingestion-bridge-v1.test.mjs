import assert from 'node:assert/strict';
import test from 'node:test';
import {emagProbeObservationToSnapshot,ingestEmagProbeArtifact,buildPromotionInputFromLedger} from '../romania-evidence-ingestion-bridge-v1.js';

const at='2026-08-25T07:00:00Z';

test('eMAG probe becomes lower-bound snapshot and never trusts declared count automatically',()=>{
  const x=emagProbeObservationToSnapshot({
    nicheKey:'travel:packing-cubes',comparabilityKey:'PACKING_CUBES_SET',observedAt:at,
    sourceUrl:'https://www.emag.ro/search/organizator%2Bvaliza%2Bset',usable:true,blocked:false,
    productLinkLowerBound:24,declaredResultCountCandidate:999,statusCode:200,htmlBytes:12345
  });
  assert.equal(x.listingCount,null);
  assert.equal(x.listingCountLowerBound,24);
  assert.equal(x.provenance.declaredResultCountCandidate,999);
  assert.equal(x.provenance.declaredResultCountTrusted,false);
  assert.equal(x.manualReviewed,false);
  assert.equal(x.comparableScopeConfirmed,false);
  assert.equal(x.purchaseAuthorized,false);
});

test('diagnostic or blocked eMAG probe is not appended to ledger',()=>{
  const artifact={observations:[{
    nicheKey:'travel:packing-cubes',comparabilityKey:'PACKING_CUBES_SET',observedAt:at,
    sourceUrl:'https://www.emag.ro/search/x',usable:false,blocked:true,productLinkLowerBound:0
  }]};
  const x=ingestEmagProbeArtifact({artifact});
  assert.equal(x.appended,0);
  assert.equal(x.diagnosticsSkipped,1);
  assert.equal(x.ledger.observations.length,0);
});

test('usable probe is appended once and exact duplicate is skipped',()=>{
  const observation={
    nicheKey:'automotive:trunk-organization',comparabilityKey:'CAR_TRUNK_ORGANIZERS',observedAt:at,
    sourceUrl:'https://www.emag.ro/search/organizator%2Bportbagaj%2Bauto',usable:true,blocked:false,productLinkLowerBound:18
  };
  const first=ingestEmagProbeArtifact({artifact:{observations:[observation]}});
  assert.equal(first.appended,1);
  const second=ingestEmagProbeArtifact({artifact:{observations:[observation]},ledger:first.ledger});
  assert.equal(second.duplicates,1);
  assert.equal(second.ledger.observations.length,1);
});

test('raw probe ledger remains blocked from promotion until manual review and exact comparable counts exist',()=>{
  const queueItems=[{nicheKey:'travel:packing-cubes',comparabilityKey:'PACKING_CUBES_SET'}];
  const artifact={observations:[{
    nicheKey:'travel:packing-cubes',comparabilityKey:'PACKING_CUBES_SET',observedAt:at,
    sourceUrl:'https://www.emag.ro/search/organizator%2Bvaliza%2Bset',usable:true,blocked:false,productLinkLowerBound:20
  }]};
  const ingested=ingestEmagProbeArtifact({artifact});
  const result=buildPromotionInputFromLedger({
    queueItems,ledger:ingested.ledger,
    trendyolEvidenceByNiche:{'travel:packing-cubes':{
      nicheKey:'travel:packing-cubes',comparabilityKey:'PACKING_CUBES_SET',scope:'MARKET_WIDE',manualReviewed:true,
      comparableScopeConfirmed:true,observedAt:at,listingCount:null,listingCountLowerBound:656,salesEvidenceClass:'NOT_VERIFIED_SALES'
    }}
  });
  assert.equal(result.promotable,0);
  assert.equal(result.blocked,1);
  assert.ok(result.rows[0].blockers.includes('EMAG_LOWER_BOUND_NOT_EXACT'));
  assert.ok(result.rows[0].blockers.includes('EMAG_MANUAL_REVIEW_REQUIRED'));
  assert.ok(result.rows[0].blockers.includes('TRENDYOL_LOWER_BOUND_NOT_EXACT'));
});

test('bridge is zero-spend and never authorizes purchase',()=>{
  const x=ingestEmagProbeArtifact({artifact:{observations:[]}});
  assert.equal(x.paidCallsTriggered,0);
  assert.equal(x.approvedSpendEur,0);
  assert.equal(x.purchaseAuthorized,false);
});

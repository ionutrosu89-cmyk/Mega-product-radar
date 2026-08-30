import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeEnrichmentReachability,buildReachableEnrichmentQueue} from '../enrichment-reachability-v1.js';

const row=({confidence=65,hard=[],technical='MATCH',title=.75,dimensions='UNKNOWN',category='UNKNOWN',weight='UNKNOWN'}={})=>({
  amazonAsin:'A1',supplierListingKey:'S1',marketplaceTitle:'Exact organizer with drawer and pen holders',supplierTitle:'Exact organizer with drawer and pen holders',
  match:{matchConfidence:confidence,matchClass:'POSSIBLE_MATCH_REVIEW_REQUIRED',hardMismatches:hard,observedFeatureWeight:70,semanticTitleSimilarity:title,evidence:[
    {feature:'category',weight:10,status:category,similarity:category==='UNKNOWN'?null:1,points:category==='UNKNOWN'?0:10},
    {feature:'productType',weight:15,status:'MATCH',similarity:1,points:15},
    {feature:'primaryFunction',weight:8,status:'MATCH',similarity:1,points:8},
    {feature:'packCount',weight:15,status:'MATCH',similarity:1,points:15},
    {feature:'material',weight:15,status:'MATCH',similarity:1,points:15},
    {feature:'dimensions',weight:15,status:dimensions,similarity:dimensions==='UNKNOWN'?null:1,points:dimensions==='UNKNOWN'?0:15},
    {feature:'unitWeightGrams',weight:5,status:weight,similarity:weight==='UNKNOWN'?null:1,points:weight==='UNKNOWN'?0:5},
    {feature:'formFactor',weight:5,status:'MATCH',similarity:1,points:5},
    {feature:'technicalSpecs',weight:7,status:technical,similarity:technical==='PARTIAL'?.5:1,points:technical==='PARTIAL'?3.5:7},
    {feature:'semanticTitle',weight:5,status:'PARTIAL',similarity:title,points:Number((5*title).toFixed(2))}
  ]}
});

test('hard mismatches can never become reachable via enrichment',()=>{
  const x=analyzeEnrichmentReachability(row({hard:['DIMENSION_MISMATCH']}));
  assert.equal(x.reachableUnderOptimisticEvidence,false);
  assert.equal(x.optimisticMatchConfidence,0);
});

test('single missing supplier dimension can be minimum evidence needed to cross 80',()=>{
  const x=analyzeEnrichmentReachability(row());
  assert.equal(x.reachableUnderOptimisticEvidence,true);
  assert.ok(x.minimumEvidenceSet.length>=1);
  assert.ok(x.minimumEvidenceSet.some(e=>e.feature==='dimensions'||e.feature==='category'||e.feature==='unitWeightGrams'));
  assert.equal(x.truthPolicy.optimisticConfidenceIsNotObservedMatch,true);
});

test('queue prioritizes candidate without distinctive technical-spec risk',()=>{
  const clean=row({confidence:65,technical:'MATCH',title:.76});clean.supplierListingKey='CLEAN';
  const risky=row({confidence:79,technical:'PARTIAL',title:.58});risky.supplierListingKey='RISKY';risky.match.observedFeatureWeight=85;
  const q=buildReachableEnrichmentQueue([risky,clean]);
  assert.equal(q.queue[0].supplierListingKey,'CLEAN');
  assert.equal(q.queue[0].distinctiveSpecRisk,false);
  assert.equal(q.queue[1].distinctiveSpecRisk,true);
});

test('queue truth policy never promotes optimistic ceiling to screening evidence',()=>{
  const q=buildReachableEnrichmentQueue([row()]);
  assert.equal(q.truthPolicy.optimisticCeilingIsNotMatchEvidence,true);
  assert.equal(q.truthPolicy.queueEntryIsNotScreeningEligible,true);
  assert.equal(q.truthPolicy.matchingThresholdRelaxed,false);
  assert.equal(q.truthPolicy.paidCallsTriggered,0);
});

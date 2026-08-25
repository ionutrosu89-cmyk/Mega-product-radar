import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {qualifyRomaniaComparableQuery} from '../romania-query-qualification-v1.js';

const audit=JSON.parse(fs.readFileSync(new URL('../data/romania-query-candidate-audit-v1.json',import.meta.url),'utf8'));

test('real foldable trunk candidates fail closed under query qualification',()=>{
  assert.equal(audit.candidates.length,3);
  for(const c of audit.candidates){
    const out=qualifyRomaniaComparableQuery(c);
    assert.equal(out.qualifiedForComparableCountCandidate,false);
    assert.equal(out.canonicalListingCountLowerBoundCandidate,null);
    assert.ok(out.blockers.length>0);
    assert.equal(out.salesEvidenceClass,'NOT_VERIFIED_SALES');
    assert.equal(out.purchaseAuthorized,false);
    assert.equal(out.paidCallsTriggered,0);
  }
});

test('broad Trendyol category count is explicitly rejected as not query scoped',()=>{
  const c=audit.candidates.find(x=>x.platform==='TRENDYOL'&&x.query==='organizator portbagaj auto pliabil');
  const out=qualifyRomaniaComparableQuery(c);
  assert.equal(out.sampleSize,20);
  assert.equal(out.canonicalMatches,5);
  assert.equal(out.purity,0.25);
  assert.ok(out.blockers.includes('SAMPLE_PURITY_BELOW_THRESHOLD'));
  assert.ok(out.blockers.includes('DECLARED_COUNT_NOT_QUERY_SCOPED'));
});

test('eMAG public result surface is rejected because exact query count is unavailable',()=>{
  const c=audit.candidates.find(x=>x.platform==='EMAG');
  const out=qualifyRomaniaComparableQuery(c);
  assert.equal(out.sampleSize,20);
  assert.equal(out.canonicalMatches,8);
  assert.equal(out.purity,0.4);
  assert.ok(out.blockers.includes('SAMPLE_PURITY_BELOW_THRESHOLD'));
  assert.ok(out.blockers.includes('DECLARED_COUNT_MISSING_OR_INVALID'));
  assert.ok(out.blockers.includes('DECLARED_COUNT_NOT_QUERY_SCOPED'));
});

test('narrower 3-compartment wording still fails when platform resolves to broad category',()=>{
  const c=audit.candidates.find(x=>x.candidateId==='FOLDABLE_TRUNK_3_COMPARTMENTS_V1');
  const out=qualifyRomaniaComparableQuery(c);
  assert.equal(out.sampleSize,10);
  assert.equal(out.canonicalMatches,3);
  assert.equal(out.purity,0.3);
  assert.ok(out.blockers.includes('SAMPLE_PURITY_BELOW_THRESHOLD'));
  assert.ok(out.blockers.includes('DECLARED_COUNT_NOT_QUERY_SCOPED'));
});

test('audit chooses packing cubes as next candidate and never authorizes spend or purchase',()=>{
  assert.equal(audit.nextCandidate.candidateId,'PACKING_CUBES_6_PIECE_SET_V1');
  assert.equal(audit.paidCallsTriggered,0);
  assert.equal(audit.approvedSpendEur,0);
  assert.equal(audit.purchaseAuthorized,false);
  assert.equal(audit.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

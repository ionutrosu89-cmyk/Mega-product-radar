import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluateEditorialFreeBeta} from '../editorial-free-beta-gate-v1.js';
import {evaluateFreeGoLive} from '../free-go-live-gate-v1.js';

const now=new Date('2026-09-28T12:00:00Z');
const candidate=index=>({
  id:`BO-${String(index).padStart(2,'0')}`,nicheId:'BIROU_ORGANIZARE',
  title:`Concept generic ${index}`,need:'Organizarea obiectelor de pe birou.',
  rationale:'Concept de cercetare, fără afirmații despre vânzări.',
  brandReview:{status:'GENERIC_CONCEPT_REVIEWED',reviewer:'Reviewer MPR',reviewedAt:'2026-09-27T10:00:00Z'},
  publication:{status:'APPROVED_RESEARCH',rightsBasis:'ORIGINAL_MPR_SUMMARY_AND_LINKS',reviewer:'Reviewer MPR',reviewedAt:'2026-09-27T11:00:00Z'},
  evidence:[
    {type:'IDENTITY',sourceName:'Sursa de referință',sourceUrl:`https://example.com/product/${index}`,observedAt:'2026-09-27T09:00:00Z',retrievedAt:'2026-09-27T10:00:00Z',summary:'Identitatea conceptului generic a fost observată în listarea de referință.',usage:'LINK_WITH_ORIGINAL_SUMMARY',verification:'OBSERVED'},
    {type:'RO_COMPARABLE',sourceName:'Ofertă RO',sourceUrl:`https://example.com/product/${index}`,observedAt:'2026-09-27T09:00:00Z',retrievedAt:'2026-09-27T10:00:00Z',summary:'O ofertă românească analogă a fost observată la data verificării.',usage:'LINK_WITH_ORIGINAL_SUMMARY',verification:'OBSERVED'},
    {type:'DEMAND',demandScope:'PRODUCT_SPECIFIC',sourceName:'Interes independent',sourceUrl:`https://trends.google.com/trends/explore?geo=RO&q=concept-${index}`,observedAt:'2026-09-27T09:00:00Z',retrievedAt:'2026-09-27T10:00:00Z',summary:'Interesul pentru expresia precisă a produsului a fost observat; nu dovedește vânzări.',usage:'LINK_WITH_ORIGINAL_SUMMARY',verification:'OBSERVED'}
  ],
});
const candidates=products=>({schema:'MPR_EDITORIAL_CANDIDATES_V1',products});
const study={status:'PASS',participants:5,productFlowSessions:5,understandingPct:80,usefulnessPct:60,watchlistPct:80};
const evidence={editorialBetaScopeApproved:true,sourceDisplayRightsVerified:true,pilotProductFlowConfirmed:true,twoWorkspaceJourneyPassed:true,physicalPhonePassed:true,publicDomainAndRecoveryPassed:true,supportAndRestorePassed:true,criticalIssues:0};
const complete={editorialCandidates:candidates(Array.from({length:10},(_,index)=>candidate(index+1))),scope:{nicheId:'BIROU_ORGANIZARE'},study,evidence};
const evaluate=input=>evaluateEditorialFreeBeta(input,{now});

test('ten current reviewed cards in one niche only reach human review after real beta evidence',()=>{
  const result=evaluate(complete);
  assert.equal(result.status,'READY_FOR_HUMAN_REVIEW');
  assert.equal(result.reviewedCardCount,10);
  assert.equal(result.betaEligibleCardCount,10);
  assert.deepEqual(result.blockers,[]);
  assert.equal(result.automaticLaunchAllowed,false);
  assert.equal(result.paidBillingEnabled,false);
  assert.ok(evaluateFreeGoLive({study,evidence}).blockers.includes('CURATED_25_X_25_REQUIRED'));
});

test('drafts, another niche and a ninth card cannot fill the limited beta',()=>{
  const nine=complete.editorialCandidates.products.slice(0,9);
  for(const products of [nine,[...nine,{...candidate(10),publication:{status:'DRAFT'}}],[...nine,{...candidate(10),nicheId:'AUTO'}]]){
    const result=evaluate({...complete,editorialCandidates:candidates(products)});
    assert.equal(result.status,'NO_GO');
    assert.ok(result.blockers.includes('ONE_NICHE_TEN_TO_TWENTY_FIVE_REVIEWED_CARDS_REQUIRED'));
  }
});

test('stale, malformed or unreviewed cards cannot clear catalog coverage',()=>{
  const original=complete.editorialCandidates.products;
  const variants=[
    {...original[0],evidence:[{...original[0].evidence[0],observedAt:'2026-07-01T09:00:00Z'}]},
    {...original[0],brandReview:{...original[0].brandReview,status:'PENDING'}},
    {...original[0],evidence:[{...original[0].evidence[0],sourceUrl:'javascript:alert(1)'}]},
  ];
  for(const bad of variants){
    const result=evaluate({...complete,editorialCandidates:candidates([bad,...original.slice(1)])});
    assert.equal(result.status,'NO_GO');
    assert.ok(result.blockers.includes('EDITORIAL_CATALOG_INVALID'));
  }
});

test('technical coverage does not bypass human scope, rights, phone and study gates',()=>{
  const result=evaluate({...complete,study:{status:'INCOMPLETE',participants:0},evidence:{criticalIssues:0}});
  for(const code of ['EDITORIAL_BETA_SCOPE_NOT_APPROVED','SOURCE_DISPLAY_RIGHTS_UNVERIFIED','PHYSICAL_PHONE_TEST_MISSING','REAL_BETA_THRESHOLDS_UNMET'])assert.ok(result.blockers.includes(code));
  assert.equal(result.status,'NO_GO');
});

test('ten reviewed identity-only cards cannot clear the beta quality threshold',()=>{
  const thin=complete.editorialCandidates.products.map(row=>({...row,evidence:row.evidence.filter(item=>item.type==='IDENTITY')}));
  const result=evaluate({...complete,editorialCandidates:candidates(thin)});
  assert.equal(result.reviewedCardCount,10);
  assert.equal(result.betaEligibleCardCount,0);
  assert.ok(result.blockers.includes('EACH_CARD_NEEDS_PRODUCT_INTEREST_AND_RO_COMPARABLE'));
});

test('niche-level interest or same-site demand is not independent product interest',()=>{
  const first=complete.editorialCandidates.products[0];
  const nicheInterest={...first,evidence:first.evidence.map(row=>row.type==='DEMAND'?{...row,demandScope:'NICHE_CONTEXT'}:row)};
  const sameSite={...first,evidence:first.evidence.map(row=>row.type==='DEMAND'?{...row,sourceUrl:'https://example.com/reviews/product-1'}:row)};
  const merchantSubdomain={...first,evidence:first.evidence.map(row=>row.type==='DEMAND'?{...row,sourceUrl:'https://reviews.example.com/product-1'}:row)};
  for(const bad of [nicheInterest,sameSite,merchantSubdomain]){
    const result=evaluate({...complete,editorialCandidates:candidates([bad,...complete.editorialCandidates.products.slice(1)])});
    assert.equal(result.betaEligibleCardCount,9);
    assert.ok(result.blockers.includes('EACH_CARD_NEEDS_PRODUCT_INTEREST_AND_RO_COMPARABLE'));
  }
});

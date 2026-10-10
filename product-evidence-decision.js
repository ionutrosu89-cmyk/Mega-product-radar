import {evaluateStageFacts} from './evidence-stage-policy.js';
import {productEvidenceFreshness} from './evidence-freshness.js';
export function productEvidenceDecision(p={},now=Date.now()){
 const fusion=p.amazonTrendFusion||p.trendFusion||p.trendEvidence||{};
 const ro=p.romaniaGap||{};const supplier=p.supplierEvidence||p.supplier||{};
 const e=p.economics||{};const decision=p.testBuyDecision||{};
 const freshness=productEvidenceFreshness(p,now);
 const n=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
 const landed=decision.landedCostConfirmed===true||p.landedCost?.confirmed===true||p.profitEngineV2?.landedCostConfirmed===true;
 const margin=n(e.margin??decision.economics?.margin),roi=n(e.roi??decision.economics?.roi),profit=n(e.profit??decision.economics?.profit);
 const facts={
  promising:n(p.opportunityRanking?.score??p.score)>=50||p.evidenceCoverage?.evidenceReady===true,
  marketQualified:true,confidence:n(p.dataConfidence?.overall??p.confidence),
  trendConfirmed:fusion.signal==='CONFIRMED_ACCELERATION'&&fusion.evidenceClass==='FUSED_LONGITUDINAL_PUBLIC_TREND'&&fusion.trendEvidenceLevel==='RANK_PLUS_REVIEW_LONGITUDINAL'&&fusion.demandEvidenceConfirmed===true,
  romaniaExact:ro.status==='READY'&&(ro.romaniaGapExactGateSatisfied===true||ro.exactComparableCount===true),
  supplierVerified:supplier.verifiedQuote===true||supplier.evidenceClass==='MANUALLY_VERIFIED',
  economicsConfirmed:landed&&margin!==null&&roi!==null&&profit!==null&&margin>=20&&roi>=45&&profit>0,
  importabilityPassed:p.importability?.gateStatus==='PASS'||p.importability?.status==='PASS',
  fresh:freshness.status==='CURRENT',
  testGatesPassed:decision.gateCount>=9&&Object.keys(decision.gates||{}).length>=9&&Object.values(decision.gates||{}).every(x=>x===true)&&!(decision.blockers||[]).length,
  measuredTestPassed:decision.buyGate?.completedRealTest===true&&Boolean(decision.buyGate?.measuredAt)&&decision.buyGate?.testOutcome==='TEST_PASS_CANDIDATE'
 };
 return {...evaluateStageFacts(facts),freshness,facts};
}

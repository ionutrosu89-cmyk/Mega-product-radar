import {canonicalRomaniaComparabilityKey} from './romania-comparability-key-registry-v1.js';
import {ingestEmagProbeArtifact} from './romania-evidence-ingestion-bridge-v1.js';
import {ingestTrendyolReviewedEvidence,buildRomaniaLocalEvidenceByNiche} from './trendyol-romania-evidence-ingestion-v1.js';
import {validateRomaniaEvidencePromotion} from './romania-evidence-promotion-validator-v1.js';

const priority=v=>Number.isFinite(Number(v))?Number(v):999;
const blockerSet=rows=>[...new Set(rows.filter(Boolean))];

function reportState({emag={},trendyol={},validation={}}={}){
  if(validation.promotable===true)return 'PROMOTABLE';
  const bothObserved=Boolean(emag.observedAt&&trendyol.observedAt);
  const needsHuman=validation.blockers?.some(x=>/MANUAL_REVIEW|SCOPE_NOT_CONFIRMED|NOT_MARKET_WIDE/.test(x));
  return bothObserved&&needsHuman?'REVIEW_READY':'BLOCKED';
}

export function buildRomaniaEvidencePromotionReport({
  queueItems=[],
  reviewedBatch={},
  emagArtifact=null,
  existingLedger={version:'1.0',observations:[]}
}={}){
  const emagArtifactPresent=Boolean(emagArtifact&&Array.isArray(emagArtifact.observations));
  const emagIngest=emagArtifactPresent
    ?ingestEmagProbeArtifact({artifact:emagArtifact,ledger:existingLedger})
    :{ledger:existingLedger,appended:0,duplicates:0,diagnosticsSkipped:0};
  const trendyolIngest=ingestTrendyolReviewedEvidence({ledger:emagIngest.ledger,batch:reviewedBatch});
  const evidenceByNiche=buildRomaniaLocalEvidenceByNiche({ledger:trendyolIngest.ledger,queueItems});

  const rows=(queueItems||[]).map(item=>{
    const evidence=evidenceByNiche[item.nicheKey]||{};
    const emag=evidence.EMAG||{};
    const trendyol=evidence.TRENDYOL||{};
    const validation=validateRomaniaEvidencePromotion({queueItem:item,emagProbe:emag,trendyolEvidence:trendyol});
    const operationalBlockers=[];
    if(!emagArtifactPresent)operationalBlockers.push('EMAG_PROBE_ARTIFACT_MISSING');
    if(emagArtifactPresent&&!emag.observedAt)operationalBlockers.push('EMAG_USABLE_OBSERVATION_MISSING');
    if(!trendyol.observedAt)operationalBlockers.push('TRENDYOL_REVIEWED_OBSERVATION_MISSING');
    if(trendyol.listingCount==null&&trendyol.listingCountLowerBound!=null)operationalBlockers.push('TRENDYOL_EXACT_COUNT_MISSING');
    if(emag.listingCount==null&&emag.listingCountLowerBound!=null)operationalBlockers.push('EMAG_EXACT_COUNT_MISSING');
    const blockers=blockerSet([...operationalBlockers,...(validation.blockers||[])]);
    return {
      priority:priority(item.priority),
      nicheKey:item.nicheKey||null,
      comparabilityKey:canonicalRomaniaComparabilityKey(item.comparabilityKey)||null,
      queueStatus:item.status||null,
      status:reportState({emag,trendyol,validation}),
      promotable:validation.promotable===true,
      blockers,
      evidence:{EMAG:emag,TRENDYOL:trendyol},
      exactCompetition:validation.exactCompetition,
      nextAction:validation.promotable===true
        ?'PROMOTE_TO_COMPARABLE_LOCAL_EVIDENCE'
        :!emagArtifactPresent
          ?'RUN_ZERO_COST_EMAG_PUBLIC_PROBE_AND_REVIEW_ARTIFACT'
          :'MANUALLY_REVIEW_SCOPE_AND_CONFIRM_EXACT_COMPARABLE_COUNTS',
      salesEvidenceClass:'NOT_VERIFIED_SALES',
      purchaseAuthorized:false
    };
  }).sort((a,b)=>a.priority-b.priority||String(a.nicheKey).localeCompare(String(b.nicheKey)));

  return {
    version:'1.0',
    total:rows.length,
    promotable:rows.filter(x=>x.status==='PROMOTABLE').length,
    reviewReady:rows.filter(x=>x.status==='REVIEW_READY').length,
    blocked:rows.filter(x=>x.status==='BLOCKED').length,
    emagArtifactPresent,
    ingestion:{
      emag:{appended:emagIngest.appended||0,duplicates:emagIngest.duplicates||0,diagnosticsSkipped:emagIngest.diagnosticsSkipped||0},
      trendyol:{appended:trendyolIngest.appended||0,duplicates:trendyolIngest.duplicates||0,rejected:trendyolIngest.rejected||0}
    },
    rows,
    policy:'OFFLINE_REVIEW_REPORT_ONLY; NO_NETWORK; NO_AUTO_PROMOTION; LOWER_BOUND_IS_NOT_EXACT; FAIL_CLOSED',
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    paidCallsTriggered:0,
    approvedSpendEur:0,
    purchaseAuthorized:false
  };
}

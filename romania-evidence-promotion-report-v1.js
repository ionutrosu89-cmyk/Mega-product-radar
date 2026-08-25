import {canonicalRomaniaComparabilityKey} from './romania-comparability-key-registry-v1.js';
import {latestRomaniaMarketSnapshots} from './romania-market-snapshot-ledger-v1.js';
import {validateRomaniaEvidencePromotion} from './romania-evidence-promotion-validator-v1.js';

const priority=v=>{if(v===null||v===undefined||v==='')return 999;const x=Number(v);return Number.isFinite(x)?x:999;};
const blockerSet=rows=>[...new Set(rows.filter(Boolean))];

function reportState({emag={},trendyol={},validation={}}={}){
  if(validation.promotable===true)return 'PROMOTABLE';
  const bothObserved=Boolean(emag.observedAt&&trendyol.observedAt);
  const needsHuman=validation.blockers?.some(x=>/MANUAL_REVIEW|SCOPE_NOT_CONFIRMED|NOT_MARKET_WIDE/.test(x));
  return bothObserved&&needsHuman?'REVIEW_READY':'BLOCKED';
}

export function buildEvidenceFromUnifiedLedger({ledger={observations:[]},queueItems=[]}={}){
  const latest=latestRomaniaMarketSnapshots(ledger);
  const out={};
  for(const item of queueItems||[]){
    const expectedKey=canonicalRomaniaComparabilityKey(item.comparabilityKey);
    const matching=latest.filter(x=>x.nicheKey===item.nicheKey&&canonicalRomaniaComparabilityKey(x.comparabilityKey)===expectedKey);
    out[item.nicheKey]={
      EMAG:matching.find(x=>x.platform==='EMAG')||{},
      TRENDYOL:matching.find(x=>x.platform==='TRENDYOL')||{}
    };
  }
  return out;
}

export function buildRomaniaPromotionReportFromLedger({queueItems=[],ledger={version:'1.2',observations:[]}}={}){
  const evidenceByNiche=buildEvidenceFromUnifiedLedger({ledger,queueItems});
  const rows=(queueItems||[]).map(item=>{
    const evidence=evidenceByNiche[item.nicheKey]||{};
    const emag=evidence.EMAG||{};
    const trendyol=evidence.TRENDYOL||{};
    const validation=validateRomaniaEvidencePromotion({queueItem:item,emagProbe:emag,trendyolEvidence:trendyol});
    const operationalBlockers=[];
    if(!emag.observedAt)operationalBlockers.push('EMAG_LEDGER_OBSERVATION_MISSING');
    if(!trendyol.observedAt)operationalBlockers.push('TRENDYOL_LEDGER_OBSERVATION_MISSING');
    if(trendyol.listingCount==null)operationalBlockers.push('TRENDYOL_EXACT_COUNT_MISSING');
    if(emag.listingCount==null)operationalBlockers.push('EMAG_EXACT_COUNT_MISSING');
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
        :!emag.observedAt
          ?'INGEST_EMAG_EVIDENCE_INTO_CANONICAL_LEDGER'
          :!trendyol.observedAt
            ?'INGEST_TRENDYOL_EVIDENCE_INTO_CANONICAL_LEDGER'
            :'MANUALLY_REVIEW_SCOPE_AND_CONFIRM_EXACT_COMPARABLE_COUNTS',
      evidenceSource:'CANONICAL_ROMANIA_MARKET_SNAPSHOT_LEDGER',
      salesEvidenceClass:'NOT_VERIFIED_SALES',
      purchaseAuthorized:false
    };
  }).sort((a,b)=>a.priority-b.priority||String(a.nicheKey).localeCompare(String(b.nicheKey)));

  return {
    version:'1.2',
    total:rows.length,
    promotable:rows.filter(x=>x.status==='PROMOTABLE').length,
    reviewReady:rows.filter(x=>x.status==='REVIEW_READY').length,
    blocked:rows.filter(x=>x.status==='BLOCKED').length,
    ledgerObservationCount:Array.isArray(ledger.observations)?ledger.observations.length:0,
    rows,
    policy:'OFFLINE_REVIEW_REPORT_ONLY; LEDGER_ONLY_PROMOTION_INPUT; LATEST_CANONICAL_SNAPSHOT_PER_PLATFORM; NO_SIDE_CHANNEL_EVIDENCE; NO_NETWORK; NO_AUTO_PROMOTION; LOWER_BOUND_IS_NOT_EXACT; FAIL_CLOSED',
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    paidCallsTriggered:0,
    approvedSpendEur:0,
    purchaseAuthorized:false
  };
}

export function buildRomaniaEvidencePromotionReport({queueItems=[],ledger={version:'1.2',observations:[]}}={}){
  return buildRomaniaPromotionReportFromLedger({queueItems,ledger});
}

import { appendRomaniaMarketSnapshot, latestRomaniaMarketSnapshots } from './romania-market-snapshot-ledger-v1.js';
import { validateRomaniaEvidencePromotion } from './romania-evidence-promotion-validator-v1.js';
import { canonicalComparabilityKey } from './romania-comparability-key-registry-v1.js';

const txt=v=>String(v??'').trim();

export function extractTrendyolSnapshotsFromReviewedBatch(batch={}){
  const rows=[];
  for(const niche of batch.niches||[]){
    for(const obs of niche.observations||[]){
      if(String(obs.platform||'').toUpperCase()!=='TRENDYOL') continue;
      if(!obs.sourceUrl || !obs.observedAt) continue;
      rows.push({
        nicheKey:niche.nicheKey,
        platform:'TRENDYOL',
        market:obs.market||'RO',
        comparabilityKey:canonicalComparabilityKey(niche.comparabilityKey),
        observedAt:obs.observedAt,
        sourceUrl:obs.sourceUrl,
        scope:obs.scope,
        evidenceType:obs.evidenceType,
        manualReviewed:obs.manualReviewed===true,
        comparableScopeConfirmed:obs.comparableScopeConfirmed===true,
        listingCount:obs.listingCount,
        listingCountLowerBound:obs.listingCountLowerBound,
        sellerCount:obs.sellerCount,
        salesEvidenceClass:'NOT_VERIFIED_SALES'
      });
    }
  }
  return rows;
}

export function ingestTrendyolReviewedEvidence({ledger={version:'1.0',observations:[]},batch={}}={}){
  let next=ledger;
  const results=[];
  for(const row of extractTrendyolSnapshotsFromReviewedBatch(batch)){
    const appended=appendRomaniaMarketSnapshot(next,row);
    results.push({nicheKey:row.nicheKey,status:appended.append?.status||'UNKNOWN'});
    next={...appended};
    delete next.append;
  }
  return {
    ledger:next,
    results,
    appended:results.filter(x=>x.status==='APPENDED').length,
    duplicates:results.filter(x=>x.status==='DUPLICATE_SKIPPED').length,
    rejected:results.filter(x=>x.status.startsWith('REJECTED')).length,
    paidCallsTriggered:0,
    approvedSpendEur:0,
    purchaseAuthorized:false
  };
}

export function buildRomaniaLocalEvidenceByNiche({ledger={observations:[]},queueItems=[],emagEvidenceByNiche={}}={}){
  const latest=latestRomaniaMarketSnapshots(ledger);
  const out={};
  for(const item of queueItems||[]){
    const key=canonicalComparabilityKey(item.comparabilityKey);
    const trendyol=latest.find(x=>x.nicheKey===item.nicheKey&&x.platform==='TRENDYOL'&&canonicalComparabilityKey(x.comparabilityKey)===key);
    out[item.nicheKey]={
      EMAG:emagEvidenceByNiche[item.nicheKey]||{},
      TRENDYOL:trendyol||{}
    };
  }
  return out;
}

export function validateRomaniaQueueAgainstUnifiedLedger({ledger={observations:[]},queueItems=[],emagEvidenceByNiche={}}={}){
  const evidenceByNiche=buildRomaniaLocalEvidenceByNiche({ledger,queueItems,emagEvidenceByNiche});
  const rows=(queueItems||[]).map(queueItem=>validateRomaniaEvidencePromotion({
    queueItem,
    emagProbe:evidenceByNiche[queueItem.nicheKey]?.EMAG||{},
    trendyolEvidence:evidenceByNiche[queueItem.nicheKey]?.TRENDYOL||{}
  }));
  return {
    total:rows.length,
    promotable:rows.filter(x=>x.promotable).length,
    blocked:rows.filter(x=>!x.promotable).length,
    rows,
    policy:'UNIFIED_LOCAL_LEDGER; FAIL_CLOSED; LOWER_BOUNDS_ARE_NOT_EXACT; NO_VERIFIED_SALES_CLAIM',
    paidCallsTriggered:0,
    purchaseAuthorized:false
  };
}

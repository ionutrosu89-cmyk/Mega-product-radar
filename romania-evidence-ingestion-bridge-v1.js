import {appendRomaniaMarketSnapshot,latestRomaniaMarketSnapshots} from './romania-market-snapshot-ledger-v1.js';
import {validateRomaniaEvidenceBatch} from './romania-evidence-promotion-validator-v1.js';

const t=v=>String(v??'').trim();
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};

export function emagProbeObservationToSnapshot(row={}){
  const usable=row.usable===true&&row.blocked!==true;
  const lower=n(row.productLinkLowerBound);
  return {
    nicheKey:t(row.nicheKey),
    platform:'EMAG',
    market:'RO',
    comparabilityKey:t(row.comparabilityKey),
    observedAt:row.observedAt||null,
    sourceUrl:t(row.sourceUrl),
    scope:'PUBLIC_MARKET_SURFACE',
    evidenceType:usable?'PUBLIC_MARKET_SIGNAL':'DIAGNOSTIC_ONLY',
    manualReviewed:false,
    comparableScopeConfirmed:false,
    listingCount:null,
    listingCountLowerBound:usable&&lower!==null&&lower>0?lower:null,
    sellerCount:null,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    purchaseAuthorized:false,
    paidCallsTriggered:0,
    approvedSpendEur:0,
    provenance:{
      sourceSchema:'MPR_EMAG_DIRECT_PUBLIC_SEARCH_PROBE_V1',
      statusCode:row.statusCode??null,
      htmlBytes:n(row.htmlBytes),
      declaredResultCountCandidate:n(row.declaredResultCountCandidate),
      declaredResultCountTrusted:false,
      productLinkLowerBound:lower,
      blocked:row.blocked===true,
      usable
    }
  };
}

export function ingestEmagProbeArtifact({artifact={},ledger={version:'1.0',observations:[]}}={}){
  const observations=Array.isArray(artifact.observations)?artifact.observations:[];
  let next=ledger;
  const results=[];
  for(const raw of observations){
    const snapshot=emagProbeObservationToSnapshot(raw);
    if(snapshot.provenance.usable!==true){
      results.push({nicheKey:snapshot.nicheKey,status:'DIAGNOSTIC_SKIPPED'});
      continue;
    }
    next=appendRomaniaMarketSnapshot(next,snapshot);
    results.push({nicheKey:snapshot.nicheKey,status:next.append?.status||'UNKNOWN'});
  }
  return {
    version:'1.0',
    ledger:next,
    results,
    appended:results.filter(x=>x.status==='APPENDED').length,
    duplicates:results.filter(x=>x.status==='DUPLICATE_SKIPPED').length,
    diagnosticsSkipped:results.filter(x=>x.status==='DIAGNOSTIC_SKIPPED').length,
    policy:'PROBE_ARTIFACT_TO_APPEND_ONLY_LEDGER; DECLARED_COUNTS_NEVER_TRUSTED_AUTOMATICALLY; LOWER_BOUND_IS_NOT_EXACT_COUNT',
    salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false,paidCallsTriggered:0,approvedSpendEur:0
  };
}

export function buildPromotionInputFromLedger({queueItems=[],ledger={observations:[]},trendyolEvidenceByNiche={}}={}){
  const latest=latestRomaniaMarketSnapshots(ledger);
  const emagByNiche=Object.fromEntries(latest.filter(x=>x.platform==='EMAG').map(x=>[x.nicheKey,x]));
  const evidenceByNiche={};
  for(const item of queueItems||[]){
    evidenceByNiche[item.nicheKey]={
      EMAG:emagByNiche[item.nicheKey]||{},
      TRENDYOL:trendyolEvidenceByNiche[item.nicheKey]||{}
    };
  }
  return validateRomaniaEvidenceBatch({queueItems,evidenceByNiche});
}

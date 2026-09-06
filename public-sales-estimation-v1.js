const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const n=v=>finite(v)?Number(v):null;
const clamp=v=>Math.max(0,Math.min(100,Number(v)));
const round=(v,d=1)=>Number(Number(v).toFixed(d));
const median=a=>{const x=a.filter(finite).map(Number).sort((a,b)=>a-b);if(!x.length)return null;const i=Math.floor(x.length/2);return x.length%2?x[i]:(x[i-1]+x[i])/2;};

export function publicSalesEstimateV1(evidence={}){
  const snaps=Array.isArray(evidence.temporalSnapshots)?evidence.temporalSnapshots.filter(x=>n(x.estimatedUnits30d)>0):[];
  const categories=Array.isArray(evidence.recentCategorySnapshots)?evidence.recentCategorySnapshots.filter(x=>n(x.top10AverageEstimatedUnits30d)>0):[];
  const peers=Array.isArray(evidence.recentComparablePeers)?evidence.recentComparablePeers.filter(x=>n(x.estimatedUnits30d)>0&&String(x.match||'').toUpperCase()==='HIGH'):[];
  const blockers=[];
  if(String(evidence.sourceClass||'')!=='THIRD_PARTY_ESTIMATED_MONTHLY_SALES')blockers.push('THIRD_PARTY_ESTIMATE_SOURCE_CLASS_REQUIRED');
  if(String(evidence.comparableMatch||'').toUpperCase()!=='HIGH')blockers.push('HIGH_COMPARABLE_MATCH_REQUIRED');
  if(snaps.length<3)blockers.push('TEMPORAL_SNAPSHOTS_MIN_3');
  if(peers.length<2)blockers.push('COMPARABLE_PEERS_MIN_2');
  if(blockers.length)return Object.freeze({schemaVersion:'MPR_PUBLIC_SALES_ESTIMATE_V1',status:'INSUFFICIENT_DATA',confidence:0,estimatedUnits30d:null,blockers:Object.freeze(blockers),verifiedCompetitorSales:false});

  const anchor=snaps.map(x=>n(x.estimatedUnits30d));
  const anchorMedian=median(anchor);
  const min=Math.min(...anchor),max=Math.max(...anchor);
  const spread=anchorMedian>0?(max-min)/anchorMedian:1;
  const temporalConsistency=clamp(100-spread*100);
  const categoryMedian=median(categories.map(x=>n(x.top10AverageEstimatedUnits30d)));
  const peerMedian=median(peers.map(x=>n(x.estimatedUnits30d)));
  const conservativeBase=median([categoryMedian,peerMedian].filter(finite));
  const recencyMonths=new Set(snaps.map(x=>String(x.month||''))).size;
  const sourceCount=Math.max(1,n(evidence.sourceIndependenceCount)||1);

  let confidence=35;
  confidence+=Math.min(20,recencyMonths*3);
  confidence+=Math.min(15,peers.length*5);
  confidence+=temporalConsistency>=75?15:temporalConsistency>=50?10:5;
  confidence+=sourceCount>=2?10:0;
  confidence=clamp(confidence);
  // One third-party provider can support strong estimated demand, but cannot reach near-verified confidence.
  if(sourceCount===1)confidence=Math.min(confidence,82);

  const estimate=Math.round(conservativeBase||anchorMedian||0);
  const high=confidence>=75;
  return Object.freeze({
    schemaVersion:'MPR_PUBLIC_SALES_ESTIMATE_V1',
    status:high?'ESTIMATED_HIGH_CONFIDENCE':'ESTIMATED_MEDIUM_CONFIDENCE',
    confidence:round(confidence),
    estimatedUnits30d:estimate||null,
    rangeLow:estimate?Math.max(1,Math.round(estimate*(high?.65:.5))):null,
    rangeHigh:estimate?Math.round(estimate*(high?1.35:1.6)):null,
    method:'PUBLIC_THIRD_PARTY_PEER_TEMPORAL_ESTIMATE',
    sourceProvider:String(evidence.sourceProvider||'').trim()||null,
    sourceIndependenceCount:sourceCount,
    temporalSnapshotCount:snaps.length,
    temporalConsistencyPct:round(temporalConsistency),
    anchorMedianEstimatedUnits30d:anchorMedian,
    categoryTop10MedianEstimatedUnits30d:categoryMedian,
    comparablePeerMedianEstimatedUnits30d:peerMedian,
    verifiedCompetitorSales:false,
    actualObservedSales:false,
    policy:'High confidence here means high confidence in peer/category demand estimation, not verified competitor sales. Third-party monthly sales estimates never become actual observed sales and cannot independently authorize BUY.'
  });
}

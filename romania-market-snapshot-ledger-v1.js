const up=v=>String(v??'').trim().toUpperCase();
const txt=v=>String(v??'').trim();
const num=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
const iso=v=>{const ms=Date.parse(String(v??''));return Number.isFinite(ms)?new Date(ms).toISOString():null;};

function observationId(row){
  return [row.nicheKey,row.platform,row.comparabilityKey,row.observedAt,row.sourceUrl].map(txt).join('|');
}

export function normalizeRomaniaMarketSnapshot(row={}){
  const normalized={
    nicheKey:txt(row.nicheKey),
    platform:up(row.platform),
    market:up(row.market||'RO'),
    comparabilityKey:up(row.comparabilityKey),
    observedAt:iso(row.observedAt),
    sourceUrl:txt(row.sourceUrl),
    scope:up(row.scope||row.evidenceScope),
    evidenceType:up(row.evidenceType||row.type),
    manualReviewed:row.manualReviewed===true,
    comparableScopeConfirmed:row.comparableScopeConfirmed===true,
    listingCount:num(row.listingCount),
    listingCountLowerBound:num(row.listingCountLowerBound),
    sellerCount:num(row.sellerCount),
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    purchaseAuthorized:false,
    paidCallsTriggered:0,
    approvedSpendEur:0
  };
  normalized.id=observationId(normalized);
  normalized.valid=Boolean(normalized.nicheKey&&normalized.platform&&normalized.market==='RO'&&normalized.observedAt&&normalized.sourceUrl&&normalized.comparabilityKey);
  return normalized;
}

export function appendRomaniaMarketSnapshot(ledger={version:'1.0',observations:[]},raw={}){
  const row=normalizeRomaniaMarketSnapshot(raw);
  const current=Array.isArray(ledger.observations)?ledger.observations.map(normalizeRomaniaMarketSnapshot):[];
  if(!row.valid)return {...ledger,observations:current,append:{status:'REJECTED_INVALID_OBSERVATION',id:row.id}};
  if(current.some(x=>x.id===row.id))return {...ledger,observations:current,append:{status:'DUPLICATE_SKIPPED',id:row.id}};
  return {
    version:'1.0',
    policy:'APPEND_ONLY; NO_OVERWRITE; LOWER_BOUND_IS_NOT_EXACT_COUNT; NOT_VERIFIED_SALES; NO_PURCHASE_AUTHORIZATION',
    observations:[...current,row],
    append:{status:'APPENDED',id:row.id}
  };
}

export function buildRomaniaMarketSnapshotHistory(ledger={observations:[]}){
  const rows=(ledger.observations||[]).map(normalizeRomaniaMarketSnapshot).filter(x=>x.valid).sort((a,b)=>a.observedAt.localeCompare(b.observedAt));
  const groups=new Map();
  for(const row of rows){
    const key=`${row.nicheKey}|${row.platform}|${row.comparabilityKey}`;
    const arr=groups.get(key)||[];arr.push(row);groups.set(key,arr);
  }
  const histories=[...groups.entries()].map(([key,items])=>{
    const first=items[0],latest=items.at(-1);
    const exact=items.filter(x=>x.listingCount!==null);
    return {
      key,
      nicheKey:latest.nicheKey,
      platform:latest.platform,
      comparabilityKey:latest.comparabilityKey,
      observations:items.length,
      firstObservedAt:first.observedAt,
      latestObservedAt:latest.observedAt,
      latestListingCount:latest.listingCount,
      latestListingCountLowerBound:latest.listingCountLowerBound,
      exactCountObservations:exact.length,
      exactCountDelta:exact.length>=2?exact.at(-1).listingCount-exact.at(-2).listingCount:null,
      comparableScopeConfirmed:latest.comparableScopeConfirmed
    };
  });
  return {
    version:'1.0',
    totalObservations:rows.length,
    histories,
    policy:'HISTORY_ONLY; NO_TREND_CLAIM_FROM_SINGLE_OBSERVATION; LOWER_BOUND_IS_NOT_EXACT_COUNT',
    purchaseAuthorized:false,
    paidCallsTriggered:0
  };
}

export function latestRomaniaMarketSnapshots(ledger={observations:[]}){
  const rows=(ledger.observations||[]).map(normalizeRomaniaMarketSnapshot).filter(x=>x.valid);
  const latest=new Map();
  for(const row of rows){
    const key=`${row.nicheKey}|${row.platform}|${row.comparabilityKey}`;
    const prev=latest.get(key);
    if(!prev||row.observedAt>prev.observedAt)latest.set(key,row);
  }
  return [...latest.values()];
}

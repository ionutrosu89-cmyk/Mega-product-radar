import {canonicalRomaniaComparabilityKey} from './romania-comparability-key-registry-v1.js';
import {normalizeRomaniaMarketSnapshot} from './romania-market-snapshot-ledger-v1.js';
import {romanianScopeAuditFor} from './romania-scope-count-semantics-v1.js';

const txt=v=>String(v??'').trim();
const up=v=>txt(v).toUpperCase();
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null;};
const isIso=v=>Number.isFinite(Date.parse(txt(v)));
const directHost=(platform,url)=>{
  try{
    const h=new URL(url).hostname.toLowerCase();
    if(platform==='EMAG')return h==='emag.ro'||h.endsWith('.emag.ro');
    if(platform==='TRENDYOL')return h==='trendyol.com'||h.endsWith('.trendyol.com');
    return false;
  }catch{return false;}
};
const searchUrl=(platform,q)=>platform==='EMAG'
  ?`https://www.emag.ro/search/${encodeURIComponent(q)}`
  :`https://www.trendyol.com/ro/sr?q=${encodeURIComponent(q)}`;

export function buildRomaniaManualReviewPack({queueItems=[]}={}){
  const tasks=[];
  for(const item of [...queueItems].sort((a,b)=>(Number(a.priority)||999)-(Number(b.priority)||999))){
    const comparabilityKey=canonicalRomaniaComparabilityKey(item.comparabilityKey);
    for(const platform of ['EMAG','TRENDYOL']){
      const known=item.knownEvidence?.[platform]||{};
      const audit=romanianScopeAuditFor({nicheKey:item.nicheKey,platform,comparabilityKey});
      const surfaceLower=audit?.surfaceItemCountLowerBound??num(known.listingCountLowerBound);
      const canonicalLower=audit?.canonicalScopeConfirmed===false?null:num(known.listingCountLowerBound);
      tasks.push({
        priority:Number(item.priority)||999,
        nicheKey:txt(item.nicheKey),
        platform,
        comparabilityKey,
        canonicalDefinition:txt(item.canonicalDefinition),
        query:txt(item.queries?.[platform]),
        searchUrl:searchUrl(platform,txt(item.queries?.[platform])),
        knownListingCountLowerBound:canonicalLower,
        knownSurfaceItemCountLowerBound:surfaceLower,
        knownExactListingCount:num(known.listingCount),
        knownStatus:txt(known.status)||'UNKNOWN',
        scopeAuditStatus:audit?.scopeStatus||null,
        review:{
          observedAt:null,
          sourceUrl:null,
          scope:null,
          listingCount:null,
          listingCountLowerBound:canonicalLower,
          surfaceItemCountLowerBound:surfaceLower,
          manualReviewed:false,
          comparableScopeConfirmed:false,
          reviewerNote:null
        },
        requiredChecks:[
          'OPEN_DIRECT_MARKETPLACE_SURFACE',
          'APPLY_CANONICAL_DEFINITION',
          'EXCLUDE_CONTAMINANTS',
          'RECORD_OBSERVED_AT',
          'RECORD_DIRECT_SOURCE_URL',
          'DO_NOT_CONVERT_SURFACE_COUNT_TO_CANONICAL_COUNT',
          'CONFIRM_SCOPE_ONLY_AFTER_HUMAN_REVIEW'
        ],
        salesEvidenceClass:'NOT_VERIFIED_SALES',
        purchaseAuthorized:false
      });
    }
  }
  return {
    version:'1.1',
    generatedAt:null,
    totalTasks:tasks.length,
    tasks,
    policy:'MANUAL_REVIEW_ONLY; DIRECT_MARKETPLACE_SURFACE_REQUIRED; SURFACE_COUNT_IS_NOT_CANONICAL_COUNT; LOWER_BOUND_IS_NOT_EXACT; NO_VERIFIED_SALES; NO_AUTO_PROMOTION; NO_PURCHASE_AUTHORIZATION',
    paidCallsTriggered:0,
    approvedSpendEur:0,
    purchaseAuthorized:false
  };
}

export function validateRomaniaManualReviewRow(row={}){
  const platform=up(row.platform);
  const blockers=[];
  if(!txt(row.nicheKey))blockers.push('NICHE_KEY_MISSING');
  if(!['EMAG','TRENDYOL'].includes(platform))blockers.push('PLATFORM_UNSUPPORTED');
  if(!canonicalRomaniaComparabilityKey(row.comparabilityKey))blockers.push('COMPARABILITY_KEY_MISSING');
  if(!isIso(row.observedAt))blockers.push('OBSERVED_AT_INVALID');
  if(!directHost(platform,txt(row.sourceUrl)))blockers.push('DIRECT_MARKETPLACE_SOURCE_REQUIRED');
  if(row.manualReviewed!==true)blockers.push('MANUAL_REVIEW_REQUIRED');
  if(row.comparableScopeConfirmed!==true)blockers.push('COMPARABLE_SCOPE_NOT_CONFIRMED');
  if(up(row.scope)!=='MARKET_WIDE')blockers.push('MARKET_WIDE_SCOPE_REQUIRED');
  const listingCount=num(row.listingCount);
  const lower=num(row.listingCountLowerBound);
  if(row.listingCount!==null&&row.listingCount!==undefined&&row.listingCount!==''&&listingCount===null)blockers.push('EXACT_LISTING_COUNT_INVALID');
  if(row.listingCountLowerBound!==null&&row.listingCountLowerBound!==undefined&&row.listingCountLowerBound!==''&&lower===null)blockers.push('LOWER_BOUND_INVALID');
  if(listingCount===null)blockers.push('EXACT_LISTING_COUNT_MISSING');
  if(listingCount!==null&&lower!==null&&listingCount<lower)blockers.push('EXACT_COUNT_BELOW_OBSERVED_LOWER_BOUND');
  return {
    validForExactComparableEvidence:blockers.length===0,
    blockers,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    purchaseAuthorized:false,
    paidCallsTriggered:0
  };
}

export function reviewedRomaniaRowToSnapshot(row={}){
  const validation=validateRomaniaManualReviewRow(row);
  const snapshot=normalizeRomaniaMarketSnapshot({
    nicheKey:row.nicheKey,
    platform:row.platform,
    market:'RO',
    comparabilityKey:row.comparabilityKey,
    observedAt:row.observedAt,
    sourceUrl:row.sourceUrl,
    scope:row.scope,
    evidenceType:'MANUALLY_REVIEWED_PUBLIC_MARKET',
    manualReviewed:row.manualReviewed===true,
    comparableScopeConfirmed:row.comparableScopeConfirmed===true,
    listingCount:row.listingCount,
    listingCountLowerBound:row.listingCountLowerBound,
    surfaceItemCountLowerBound:row.surfaceItemCountLowerBound,
    sellerCount:row.sellerCount
  });
  return {
    validation,
    snapshot,
    promotableAsExactComparableEvidence:validation.validForExactComparableEvidence&&snapshot.valid,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    purchaseAuthorized:false,
    paidCallsTriggered:0
  };
}

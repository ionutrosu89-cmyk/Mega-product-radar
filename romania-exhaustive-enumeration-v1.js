const up=v=>String(v??'').trim().toUpperCase();
const bool=v=>v===true;

export function evaluateRomaniaEnumeration(input={}){
  const platform=up(input.platform);
  const pages=Array.isArray(input.pages)?input.pages:[];
  const query=String(input.query??'').trim();
  const allPagesReviewed=bool(input.allPagesReviewed);
  const terminalPageConfirmed=bool(input.terminalPageConfirmed);
  const queryScopeConfirmed=bool(input.queryScopeConfirmed);
  const manualCanonicalReview=bool(input.manualCanonicalReview);
  const aliasesComplete=bool(input.aliasesComplete);
  const seen=new Map();
  for(const page of pages){
    for(const row of Array.isArray(page?.listings)?page.listings:[]){
      const id=String(row?.listingId??row?.url??'').trim();
      if(!id) continue;
      seen.set(id,{...row,canonicalMatch:row?.canonicalMatch===true});
    }
  }
  const unique=[...seen.values()];
  const canonical=unique.filter(x=>x.canonicalMatch);
  const blockers=[];
  if(!['EMAG','TRENDYOL'].includes(platform)) blockers.push('UNSUPPORTED_PLATFORM');
  if(!query) blockers.push('QUERY_REQUIRED');
  if(!allPagesReviewed) blockers.push('ALL_PAGES_NOT_REVIEWED');
  if(!terminalPageConfirmed) blockers.push('TERMINAL_PAGE_NOT_CONFIRMED');
  if(!manualCanonicalReview) blockers.push('MANUAL_CANONICAL_REVIEW_REQUIRED');
  const surfaceExact=blockers.length===0;
  const marketComparableExact=surfaceExact&&queryScopeConfirmed&&aliasesComplete;
  if(surfaceExact&&!queryScopeConfirmed) blockers.push('QUERY_SCOPE_NOT_CONFIRMED');
  if(surfaceExact&&!aliasesComplete) blockers.push('CANONICAL_ALIAS_COVERAGE_INCOMPLETE');
  return {
    version:'1.0',platform,query,
    uniqueListingCount:unique.length,
    canonicalSurfaceCount:surfaceExact?canonical.length:null,
    surfaceExact,
    marketComparableExact,
    evidenceClass:marketComparableExact?'EXACT_COMPARABLE_CANONICAL_QUERY_UNION':surfaceExact?'SURFACE_EXACT_MANUALLY_REVIEWED':'INCOMPLETE',
    blockers:[...new Set(blockers)],
    verifiedSales:false,
    purchaseAuthorized:false,
    paidCallsTriggered:0,
    policy:'SURFACE_EXACT_IS_NOT_MARKET_EXACT; MARKET_COMPARABLE_EXACT_REQUIRES_EXHAUSTIVE_PAGINATION+MANUAL_CANONICAL_REVIEW+CONFIRMED_QUERY_SCOPE+COMPLETE_ALIAS_COVERAGE'
  };
}

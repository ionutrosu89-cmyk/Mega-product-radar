const txt=v=>String(v??'').trim();
const up=v=>txt(v).toUpperCase();
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};

export function qualifyRomaniaComparableQuery({
  platform,
  query,
  declaredCount=null,
  countScope='UNKNOWN',
  sampleResults=[],
  minSampleSize=10,
  minPurity=0.9
}={}){
  const p=up(platform);
  const blockers=[];
  const rows=(sampleResults||[]).map(r=>({
    title:txt(r.title),
    canonicalMatch:r.canonicalMatch===true,
    exclusionReason:txt(r.exclusionReason)||null
  })).filter(r=>r.title);
  const sampleSize=rows.length;
  const canonicalMatches=rows.filter(r=>r.canonicalMatch).length;
  const contaminants=sampleSize-canonicalMatches;
  const purity=sampleSize?canonicalMatches/sampleSize:null;
  const declared=num(declaredCount);
  const scope=up(countScope);

  if(!['EMAG','TRENDYOL'].includes(p)) blockers.push('PLATFORM_UNSUPPORTED');
  if(!txt(query)) blockers.push('QUERY_MISSING');
  if(sampleSize<minSampleSize) blockers.push('SAMPLE_TOO_SMALL');
  if(purity===null||purity<minPurity) blockers.push('SAMPLE_PURITY_BELOW_THRESHOLD');
  if(declared===null||declared<0) blockers.push('DECLARED_COUNT_MISSING_OR_INVALID');
  if(scope!=='QUERY_SCOPED') blockers.push('DECLARED_COUNT_NOT_QUERY_SCOPED');

  const qualifiedForComparableCountCandidate=blockers.length===0;
  return {
    version:'1.0',
    platform:p,
    query:txt(query),
    sampleSize,
    canonicalMatches,
    contaminants,
    purity,
    purityThreshold:minPurity,
    declaredCount:declared,
    countScope:scope,
    qualifiedForComparableCountCandidate,
    blockers,
    canonicalListingCountLowerBoundCandidate:qualifiedForComparableCountCandidate?declared:null,
    exactComparableCount:false,
    manualExactReviewRequired:true,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    paidCallsTriggered:0,
    purchaseAuthorized:false
  };
}

export function buildRomaniaQueryQualificationReport({candidates=[]}={}){
  const rows=(candidates||[]).map(qualifyRomaniaComparableQuery);
  return {
    version:'1.0',
    total:rows.length,
    qualified:rows.filter(r=>r.qualifiedForComparableCountCandidate).length,
    blocked:rows.filter(r=>!r.qualifiedForComparableCountCandidate).length,
    rows,
    policy:'QUERY_PURITY_REQUIRED_BEFORE_CANONICAL_COUNT_CANDIDATE; CATEGORY_OR_SURFACE_TOTALS_ARE_NOT_QUERY_COUNTS; EXACT_COUNT_REQUIRES_MANUAL_REVIEW; UNKNOWN_IS_NOT_ZERO; NO_VERIFIED_SALES; NO_PURCHASE_AUTHORITY',
    paidCallsTriggered:0,
    approvedSpendEur:0,
    purchaseAuthorized:false
  };
}

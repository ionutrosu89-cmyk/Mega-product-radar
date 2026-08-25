const uniq=a=>[...new Set(a)];
export function buildRomaniaCanonicalQueryUnion(input={}){
 const platform=String(input.platform??'').trim().toUpperCase();
 const nicheKey=String(input.nicheKey??'').trim();
 const requiredAliases=uniq((input.requiredAliases||[]).map(x=>String(x).trim()).filter(Boolean));
 const rows=Array.isArray(input.queryEnumerations)?input.queryEnumerations:[];
 const byAlias=new Map(rows.map(r=>[String(r.alias??'').trim(),r]));
 const missingAliases=requiredAliases.filter(a=>!byAlias.has(a));
 const nonExactAliases=requiredAliases.filter(a=>byAlias.has(a)&&byAlias.get(a)?.surfaceExact!==true);
 const allListingIds=[];
 for(const alias of requiredAliases){
   const row=byAlias.get(alias);
   if(row?.surfaceExact!==true) continue;
   for(const id of Array.isArray(row.canonicalListingIds)?row.canonicalListingIds:[]) if(String(id).trim()) allListingIds.push(String(id).trim());
 }
 const canonicalListingIds=uniq(allListingIds);
 const aliasCoverageComplete=requiredAliases.length>0&&missingAliases.length===0&&nonExactAliases.length===0;
 const blockers=[];
 if(!['EMAG','TRENDYOL'].includes(platform)) blockers.push('UNSUPPORTED_PLATFORM');
 if(!nicheKey) blockers.push('NICHE_KEY_REQUIRED');
 if(requiredAliases.length===0) blockers.push('REQUIRED_ALIASES_EMPTY');
 if(missingAliases.length) blockers.push('MISSING_REQUIRED_ALIASES');
 if(nonExactAliases.length) blockers.push('NON_EXACT_ALIAS_ENUMERATION');
 if(input.aliasSetManuallyApproved!==true) blockers.push('ALIAS_SET_NOT_MANUALLY_APPROVED');
 if(input.marketCoverageConfirmed!==true) blockers.push('MARKET_COVERAGE_NOT_CONFIRMED');
 const marketComparableExact=blockers.length===0&&aliasCoverageComplete;
 return {version:'1.0',platform,nicheKey,requiredAliases,missingAliases,nonExactAliases,aliasCoverageComplete,canonicalListingIds,canonicalListingCount:marketComparableExact?canonicalListingIds.length:null,marketComparableExact,evidenceClass:marketComparableExact?'EXACT_COMPARABLE_CANONICAL_QUERY_UNION':'INCOMPLETE_QUERY_UNION',blockers,verifiedSales:false,purchaseAuthorized:false,paidCallsTriggered:0,policy:'EXACT_REQUIRES_MANUALLY_APPROVED_COMPLETE_ALIAS_SET+SURFACE_EXACT_ENUMERATION_FOR_EVERY_ALIAS+CONFIRMED_MARKET_COVERAGE; UNION_DEDUPES_CROSS_QUERY_LISTINGS'};
}

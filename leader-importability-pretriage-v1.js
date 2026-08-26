const text=v=>String(v??'').trim();
const lower=v=>text(v).toLowerCase();

export function buildLeaderImportabilityPretriage({leaders=[]}={}){
  const rows=(Array.isArray(leaders)?leaders:[]).map((r,index)=>{
    const title=text(r.title); const t=lower(title); const flags=[];
    if(/liquid|dye|clarifier|flocculant|oil|spray|gel|cream/.test(t)) flags.push('TITLE_SUGGESTS_LIQUID_OR_CHEMICAL_REVIEW');
    if(/litter box|shade sail|chair|towel|towels|binder|3 ring binder|bakeware set/.test(t)) flags.push('TITLE_SUGGESTS_VOLUME_OR_DIMENSION_REVIEW');
    if(/torque wrench|stainless steel/.test(t)) flags.push('TITLE_SUGGESTS_WEIGHT_REVIEW');
    if(/meter|multimeter/.test(t)) flags.push('TITLE_SUGGESTS_ELECTRICAL_COMPLIANCE_REVIEW');
    if(/omega-3|softgels|supplement/.test(t)) flags.push('TITLE_SUGGESTS_INGESTIBLE_REGULATORY_REVIEW');
    const obviousReview=flags.length>0;
    return {
      asin:text(r.asin||r.externalId).toUpperCase()||null,title,sourceIndex:index,
      reviewDelta:Number.isFinite(Number(r.reviewDelta))?Number(r.reviewDelta):null,
      flags,
      pretriageStatus:obviousReview?'REVIEW_FIRST':'NO_TITLE_RISK_SIGNAL',
      evidenceClass:'TITLE_HEURISTIC_ONLY',
      importabilityPassed:false,
      supplierSourcingAuthorized:false,
      purchaseAuthorized:false
    };
  });
  return {
    schemaVersion:'MPR_LEADER_IMPORTABILITY_PRETRIAGE_V1',
    total:rows.length,
    reviewFirstCount:rows.filter(r=>r.pretriageStatus==='REVIEW_FIRST').length,
    noTitleRiskSignalCount:rows.filter(r=>r.pretriageStatus==='NO_TITLE_RISK_SIGNAL').length,
    rows,
    policy:'HEURISTIC_TRIAGE_ONLY; TITLE_SIGNAL_IS_NOT_PRODUCT_FACT; NEVER_AUTO_PASS; NEVER_AUTO_BLOCK; FINAL_IMPORTABILITY_REQUIRES CANDIDATE_SPECIFIC_CONFIRMED_FACTS; NO_PURCHASE_AUTHORITY',
    paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false
  };
}

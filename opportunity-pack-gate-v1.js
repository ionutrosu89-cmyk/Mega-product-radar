const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const text=v=>String(v??'').trim();
export function buildOpportunityPackGate(input={}){
  const blockers=[];
  const supplier=input.supplier||{};
  const match=input.match||{};
  const roPrice=input.romaniaPrice||{};
  const freight=input.freight||{};
  const direct=input.directSupplierEvidence||{};
  if(direct.provenanceMatched!==true)blockers.push('DIRECT_SUPPLIER_PROVENANCE_REQUIRED');
  if(!direct.assembledDimensionsCm)blockers.push('DIRECT_SUPPLIER_DIMENSIONS_REQUIRED');
  if(direct.exactConfigurationConfirmed!==true)blockers.push('EXACT_SUPPLIER_CONFIGURATION_REQUIRED');
  if(Array.isArray(match.hardMismatches)&&match.hardMismatches.length)blockers.push('MATCH_HARD_MISMATCH');
  if(finite(match.matchConfidence)===null||finite(match.matchConfidence)<80)blockers.push('MATCH_CONFIDENCE_80_REQUIRED');
  if(match.screeningEconomicsEligible!==true)blockers.push('MATCH_ECONOMICS_ELIGIBILITY_REQUIRED');
  if(finite(roPrice.grossRon)===null)blockers.push('ROMANIA_PRICE_EVIDENCE_REQUIRED');
  if(!['DIRECT_CURRENT_RO_PRICE','SECONDARY_SCREENING_PRICE'].includes(text(roPrice.evidenceClass)))blockers.push('ROMANIA_PRICE_CLASS_REQUIRED');
  if(finite(freight.usdPerKg)===null&&finite(freight.ronPerUnit)===null)blockers.push('FREIGHT_EVIDENCE_REQUIRED');
  if(finite(supplier.unitPriceUsd)===null)blockers.push('SUPPLIER_UNIT_PRICE_REQUIRED');
  const ready=blockers.length===0;
  return {
    schemaVersion:'MPR_OPPORTUNITY_PACK_GATE_V1',
    status:ready?'ECONOMICS_READY':'BLOCKED',
    blockers:[...new Set(blockers)],
    economicsAllowed:ready,
    rankingScenario:'CONSERVATIVE',
    supplier:{externalId:text(supplier.externalId),supplierName:text(supplier.supplierName),unitPriceUsd:finite(supplier.unitPriceUsd),moq:finite(supplier.moq)},
    match:{confidence:finite(match.matchConfidence),screeningEconomicsEligible:match.screeningEconomicsEligible===true,hardMismatches:Array.isArray(match.hardMismatches)?match.hardMismatches:[]},
    romaniaPrice:{grossRon:finite(roPrice.grossRon),evidenceClass:text(roPrice.evidenceClass)},
    truthPolicy:{blockedPackCannotRunEconomics:true,screeningThreshold:80,hardMismatchForcesBlock:true,unknownEqualsZero:false,purchaseAuthorized:false}
  };
}
export const OpportunityPackGateTruthPolicy=Object.freeze({
  economicsRequiresMatchAtLeast80:true,
  hardMismatchForcesBlock:true,
  directSupplierDimensionsRequired:true,
  romaniaPriceEvidenceRequired:true,
  freightEvidenceRequired:true,
  conservativeIsRankingScenario:true,
  purchaseAuthorized:false,
  unknownEqualsZero:false
});

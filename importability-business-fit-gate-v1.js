const text=v=>String(v??'').trim();
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);

export function buildImportabilityBusinessFit({candidateAsin,profile={}}={}){
  const asin=text(candidateAsin).toUpperCase();
  const sameCandidate=text(profile.candidateAsin).toUpperCase()===asin;
  const facts=sameCandidate?(profile.facts||{}):{};
  const weightKg=num(facts.unitWeightKg);
  const volumeCm3=num(facts.packedVolumeCm3);
  const acquisitionCostRon=num(facts.estimatedAcquisitionCostRon);
  const targetSalePriceRon=num(facts.targetSalePriceRon);
  const isLiquid=facts.isLiquid;
  const hasBattery=facts.hasBattery;
  const regulated=facts.regulatedOrSpecialAuthorization;
  const airFreightSuitable=facts.airFreightSuitable;
  const dimensionsConfirmed=facts.dimensionsConfirmed===true;
  const weightConfirmed=facts.weightConfirmed===true;
  const productTypeConfirmed=facts.productTypeConfirmed===true;

  const hardBlockers=[];
  if(isLiquid===true) hardBlockers.push('LIQUID_PRODUCT');
  if(regulated===true) hardBlockers.push('REGULATED_OR_SPECIAL_AUTHORIZATION');
  if(airFreightSuitable===false) hardBlockers.push('AIR_FREIGHT_UNSUITABLE');
  if(weightKg!==null&&weightKg>2) hardBlockers.push('UNIT_WEIGHT_ABOVE_2KG');
  if(volumeCm3!==null&&volumeCm3>15000) hardBlockers.push('PACKED_VOLUME_ABOVE_15000CM3');

  const unknowns=[];
  if(!sameCandidate) unknowns.push('SAME_CANDIDATE_PROFILE_MISSING');
  if(!productTypeConfirmed) unknowns.push('PRODUCT_TYPE_UNCONFIRMED');
  if(isLiquid===undefined||isLiquid===null) unknowns.push('LIQUID_STATUS_UNKNOWN');
  if(regulated===undefined||regulated===null) unknowns.push('REGULATORY_STATUS_UNKNOWN');
  if(airFreightSuitable===undefined||airFreightSuitable===null) unknowns.push('AIR_FREIGHT_SUITABILITY_UNKNOWN');
  if(!weightConfirmed||weightKg===null) unknowns.push('UNIT_WEIGHT_UNCONFIRMED');
  if(!dimensionsConfirmed||volumeCm3===null) unknowns.push('PACKED_DIMENSIONS_UNCONFIRMED');
  if(hasBattery===undefined||hasBattery===null) unknowns.push('BATTERY_STATUS_UNKNOWN');
  if(acquisitionCostRon===null) unknowns.push('ACQUISITION_COST_UNKNOWN');
  if(targetSalePriceRon===null) unknowns.push('TARGET_SALE_PRICE_UNKNOWN');

  const grossMultiple=acquisitionCostRon!==null&&acquisitionCostRon>0&&targetSalePriceRon!==null
    ? Number((targetSalePriceRon/acquisitionCostRon).toFixed(3)):null;
  const warnings=[];
  if(grossMultiple!==null&&grossMultiple<3) warnings.push('TARGET_GROSS_MULTIPLE_BELOW_3X');
  if(hasBattery===true) warnings.push('BATTERY_LOGISTICS_REVIEW_REQUIRED');

  let status='UNKNOWN_FAIL_CLOSED';
  if(hardBlockers.length) status='IMPORTABILITY_BLOCKED';
  else if(unknowns.length===0&&warnings.length===0) status='IMPORTABILITY_PASS';
  else if(unknowns.length===0) status='IMPORTABILITY_REVIEW';

  return {
    schemaVersion:'MPR_IMPORTABILITY_BUSINESS_FIT_V1',candidateAsin:asin||null,status,
    sameCandidate,hardBlockers,unknowns,warnings,grossMultiple,
    importabilityPassed:status==='IMPORTABILITY_PASS',
    supplierSourcingEligible:status==='IMPORTABILITY_PASS'||status==='IMPORTABILITY_REVIEW',
    purchaseAuthorized:false,paidCallsTriggered:0,providerSpendEur:0,
    policy:'FAIL_CLOSED_ON_UNKNOWN; SAME_CANDIDATE_ONLY; LIQUIDS_AND_REGULATED_PRODUCTS_BLOCK; AIR_FREIGHT_FIT_REQUIRED; WEIGHT_VOLUME_AND_ECONOMICS_REQUIRE CONFIRMED FACTS; BUSINESS_FIT_DOES_NOT_AUTHORIZE_PURCHASE'
  };
}

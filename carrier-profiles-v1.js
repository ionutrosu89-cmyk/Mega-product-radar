export const CARRIER_PROFILES_V1=Object.freeze({
  DHL_EXPRESS:Object.freeze({
    code:'DHL_EXPRESS',
    name:'DHL Express',
    market:'RO',
    mode:'EXPRESS_AIR',
    volumetricDivisorCm3PerKg:5000,
    roundingPolicy:'SERVICE_RATE_RULES_APPLY',
    sourceUrl:'https://dct.dhl.com/help',
    verifiedAt:'2026-09-06',
    sourceClass:'OFFICIAL_CARRIER',
    note:'DHL states a standard volumetric divisor of 5000 for kg/cm.'
  }),
  UPS:Object.freeze({
    code:'UPS',
    name:'UPS',
    market:'RO',
    mode:'EXPRESS_AIR',
    volumetricDivisorCm3PerKg:5000,
    roundingPolicy:'ROUND_DIMENSIONS_TO_NEAREST_CM_AND_WEIGHT_UP_PER_PUBLISHED_RULES',
    sourceUrl:'https://www.ups.com/ro/ro/support/shipping-support/shipping-dimensions-weight',
    verifiedAt:'2026-09-06',
    sourceClass:'OFFICIAL_CARRIER',
    note:'UPS Romania publishes dimensional weight as cubic centimetres divided by 5000 and uses the greater of actual and dimensional weight.'
  }),
  FEDEX:Object.freeze({
    code:'FEDEX',
    name:'FedEx',
    market:'RO',
    mode:'EXPRESS_AIR',
    volumetricDivisorCm3PerKg:5000,
    roundingPolicy:'SERVICE_RATE_RULES_APPLY',
    sourceUrl:'https://www.fedex.com/ro-ro/how-to/calculate-costs/dimensional-weight.html',
    verifiedAt:'2026-09-06',
    sourceClass:'OFFICIAL_CARRIER',
    note:'FedEx Romania presents 5000 as the common/default example and warns that the divisor can vary by carrier/country/customer; verify contracted service terms before final confirmation.'
  })
});

export function getCarrierProfile(code=''){
  const key=String(code||'').trim().toUpperCase();
  return CARRIER_PROFILES_V1[key]||null;
}

export function resolveCarrierDivisor(code='',override=null){
  const n=Number(override);
  if(Number.isFinite(n)&&n>0)return {divisor:n,source:'EXPLICIT_OVERRIDE',profile:getCarrierProfile(code)};
  const profile=getCarrierProfile(code);
  if(!profile)return {divisor:null,source:'UNKNOWN_CARRIER',profile:null};
  return {divisor:profile.volumetricDivisorCm3PerKg,source:'OFFICIAL_CARRIER_PROFILE',profile};
}

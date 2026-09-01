const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));

export const VIRAL_PLATFORM_WEIGHTS=Object.freeze({
  TIKTOK:25,
  META:15,
  GOOGLE_TRENDS:20,
  AMAZON:15,
  COUNTRY_SPREAD:10,
  ROMANIA_SCARCITY:15
});

export function viralGrowthSignal(input={}){
  const observations=Number(input.observationCount)||0;
  const platforms=new Set((input.platforms||[]).map(x=>String(x).toUpperCase()));
  const countries=new Set((input.countries||[]).map(x=>String(x).toUpperCase()).filter(x=>x!=='RO'));
  const establishedBrand=input.brandPolicyClass==='ESTABLISHED_EXCLUDE';
  const romaniaValidated=input.romaniaEvidenceClass==='VALIDATED';
  const supplierEconomicsReady=input.supplierVerified===true&&input.economicsConfirmed===true;

  if(establishedBrand)return fail('STOP_BRAND_GATE');
  if(observations<2)return fail('INSUFFICIENT_HISTORY');
  if(platforms.size<2)return fail('NEEDS_CROSS_PLATFORM_CONFIRMATION');

  const components={
    tiktok:clamp(input.tiktokVelocityScore)*.25,
    meta:clamp(input.metaAdMomentumScore)*.15,
    google:clamp(input.googleAccelerationScore)*.20,
    amazon:clamp(input.amazonDemandScore)*.15,
    countrySpread:clamp(countries.size/5*100)*.10,
    romaniaScarcity:romaniaValidated?clamp(input.romaniaScarcityScore)*.15:0
  };
  const score=Math.round(Object.values(components).reduce((a,b)=>a+b,0));
  const stage=score>=80?'VIRAL':score>=60?'ACCELERATING':score>=35?'EARLY':'WATCH';
  const eligibleForRomaniaValidation=score>=60&&countries.size>=2;
  const eligibleForCommercialValidation=eligibleForRomaniaValidation&&romaniaValidated;
  return {
    eligible:true,score,stage,components,
    eligibleForRomaniaValidation,
    eligibleForCommercialValidation,
    eligibleForFinalist:eligibleForCommercialValidation&&input.importabilityPass===true&&supplierEconomicsReady,
    purchaseAuthorized:false,
    claimsSales:false
  };
}

function fail(reason){
  return {eligible:false,reason,score:null,stage:'UNVERIFIED',eligibleForRomaniaValidation:false,eligibleForCommercialValidation:false,eligibleForFinalist:false,purchaseAuthorized:false,claimsSales:false};
}

export function canonicalConceptKey({conceptName='',category=''}){
  const clean=value=>String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,'-');
  return `${clean(category)||'uncategorized'}:${clean(conceptName)||'unknown'}`;
}

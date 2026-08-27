import {evaluateSourceUse} from './source-rights-registry-v2.js';
import {normalizeGtin,isValidGtin,strongIdentityKeys,productFingerprint} from './canonical-identity-v2.js';

const clean=value=>String(value??'').trim();
const finite=value=>Number.isFinite(Number(value))?Number(value):null;

function baseCandidate(sourceKey,row={}){
  const rights=evaluateSourceUse(sourceKey,{intendedUse:'analysis'});
  return{
    sourceKey,
    rightsDecision:rights.decision,
    rightsReasons:rights.reasons,
    sourceRights:rights.profile,
    evidenceClass:'CATALOGUE_BOOTSTRAP_ANALYSIS_ONLY',
    rankingEligible:false,
    commercialEligible:false,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    verifiedSalesRows:0,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    sourceRecordId:null,
    observedAt:null,
    title:null,
    brand:null,
    category:null,
    gtin:null,
    invalidGtin:null,
    mpn:null,
    model:null,
    eprelId:null,
    imageRefs:[],
    attributes:{},
    raw:row
  };
}

function vettedGtin(value){
  const normalized=normalizeGtin(value);
  if(!normalized)return{gtin:null,invalidGtin:null};
  return isValidGtin(normalized)?{gtin:normalized,invalidGtin:null}:{gtin:null,invalidGtin:normalized};
}

export function adaptOpenFactsRecord(row={},options={}){
  const sourceKey=options.sourceKey||'OPEN_FOOD_FACTS';
  const c=baseCandidate(sourceKey,row);
  const vetted=vettedGtin(row.code||row.barcode||row.gtin);
  c.sourceRecordId=clean(row._id||row.id||row.code)||null;
  c.observedAt=clean(options.observedAt||row.last_modified_t||row.last_modified_datetime)||null;
  c.title=clean(row.product_name||row.product_name_en||row.generic_name)||null;
  c.brand=clean(row.brands||row.brand_owner)||null;
  c.category=clean(row.categories||row.categories_tags?.[0])||null;
  c.gtin=vetted.gtin;
  c.invalidGtin=vetted.invalidGtin;
  c.imageRefs=[row.image_front_url,row.image_url].map(clean).filter(Boolean);
  c.attributes={quantity:clean(row.quantity)||null,countries:clean(row.countries)||null,nutriscoreGrade:clean(row.nutriscore_grade)||null};
  c.identityKeys=strongIdentityKeys(c);
  c.identityStrength=c.gtin?'STRONG_GTIN':'FALLBACK';
  c.canonicalCandidate=Boolean(c.title&&(c.gtin||c.brand));
  c.fingerprint=productFingerprint(c);
  return c;
}

export function adaptEprelRecord(row={},options={}){
  const c=baseCandidate('EPREL_PUBLIC',row);
  const vetted=vettedGtin(row.gtin||row.GTIN);
  c.sourceRecordId=clean(row.registrationNumber||row.eprelRegistrationNumber||row.id)||null;
  c.eprelId=c.sourceRecordId;
  c.observedAt=clean(options.observedAt||row.lastUpdated||row.updatedAt)||null;
  c.title=clean(row.commercialName||row.modelName||row.modelIdentifier)||null;
  c.brand=clean(row.supplierName||row.brand)||null;
  c.category=clean(row.productGroup||row.productGroupName)||null;
  c.model=clean(row.modelIdentifier)||null;
  c.gtin=vetted.gtin;
  c.invalidGtin=vetted.invalidGtin;
  c.mpn=clean(row.mpn||row.manufacturerPartNumber)||null;
  c.imageRefs=[row.modelImage,row.imageUrl].map(clean).filter(Boolean);
  c.attributes={energyClass:clean(row.energyEfficiencyClass)||null,annualEnergyConsumption:finite(row.annualEnergyConsumption)};
  c.identityKeys=strongIdentityKeys(c);
  c.identityStrength=c.gtin?'STRONG_GTIN':(c.eprelId?'STRONG_SOURCE_REGISTRY':'FALLBACK');
  c.canonicalCandidate=Boolean(c.title&&(c.gtin||c.eprelId||c.model));
  c.fingerprint=productFingerprint(c);
  return c;
}

export function buildCatalogBatch(records=[],adapter,options={}){
  if(typeof adapter!=='function')throw new TypeError('adapter required');
  const accepted=[],held=[],seen=new Set();
  for(const row of records){
    const c=adapter(row,options);
    if(c.rightsDecision!=='ACCEPT'||!c.canonicalCandidate){held.push(c);continue;}
    const strong=(c.identityKeys||[]).find(k=>['GTIN','EPREL','ASIN','ICECAT'].includes(k.namespace));
    const key=strong?`${strong.namespace}:${strong.valueNorm}`:c.fingerprint;
    if(seen.has(key)){held.push({...c,holdReason:'LOGICAL_DUPLICATE'});continue;}
    seen.add(key);accepted.push(c);
  }
  return{
    schema:'MPR_CATALOG_SOURCE_BATCH_V1',
    accepted,held,
    stats:{
      input:records.length,
      accepted:accepted.length,
      held:held.length,
      logicalDuplicates:held.filter(x=>x.holdReason==='LOGICAL_DUPLICATE').length,
      invalidGtinCount:[...accepted,...held].filter(x=>x.invalidGtin).length
    },
    policy:{providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,salesEvidenceClass:'NOT_VERIFIED_SALES',verifiedSalesRows:0}
  };
}

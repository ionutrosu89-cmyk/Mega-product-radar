import {isCanonicalProductId,requireCanonicalProductId} from './domain-contracts-v1.js';

const text=v=>String(v??'').trim();
const legacyKey=value=>text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

export function canonicalCommercialKey(canonicalProductId){
  return `canonical:${requireCanonicalProductId(canonicalProductId)}`;
}

export function normalizeCommercialIdentity({canonicalProductId=null,productName=null}={}){
  const id=isCanonicalProductId(canonicalProductId)?requireCanonicalProductId(canonicalProductId):null;
  return Object.freeze({
    canonicalProductId:id,
    productName:text(productName)||null,
    identityStatus:id?'CANONICAL':'LEGACY_LABEL_ONLY',
    decisionEligible:Boolean(id)
  });
}

export function attachCanonicalCommercialIdentity(record={},identity={}){
  const normalized=normalizeCommercialIdentity(identity);
  const productName=normalized.productName ?? (text(record.productName)||null);
  return Object.freeze({...record,canonicalProductId:normalized.canonicalProductId,productName,identityStatus:normalized.identityStatus,decisionEligible:normalized.decisionEligible});
}

export function readCommercialRecord(records={},identity={}){
  const normalized=normalizeCommercialIdentity(identity);
  if(normalized.canonicalProductId){
    const key=canonicalCommercialKey(normalized.canonicalProductId);
    if(records&&records[key])return {record:records[key],key,source:'CANONICAL',decisionEligible:true};
  }
  const legacy=legacyKey(normalized.productName);
  if(legacy&&records&&records[legacy])return {record:records[legacy],key:legacy,source:'LEGACY_LABEL_FALLBACK',decisionEligible:false};
  return {record:null,key:normalized.canonicalProductId?canonicalCommercialKey(normalized.canonicalProductId):legacy||null,source:'MISSING',decisionEligible:false};
}

export function writeCanonicalCommercialRecord(records={},identity={},record={}){
  const normalized=normalizeCommercialIdentity(identity);
  if(!normalized.canonicalProductId){const e=new Error('CANONICAL_PRODUCT_ID_REQUIRED_FOR_COMMERCIAL_WRITE');e.code='CANONICAL_PRODUCT_ID_REQUIRED_FOR_COMMERCIAL_WRITE';throw e;}
  const key=canonicalCommercialKey(normalized.canonicalProductId);
  return {...records,[key]:attachCanonicalCommercialIdentity(record,normalized)};
}

export function commercialRecordCanSatisfyDecisionGate(record){
  return Boolean(record&&isCanonicalProductId(record.canonicalProductId)&&record.decisionEligible===true);
}

export const COMMERCIAL_IDENTITY_POLICY=Object.freeze({
  canonicalWrite:'DECISION_CRITICAL_COMMERCIAL_WRITES_REQUIRE_CANONICAL_PRODUCT_ID',
  legacyRead:'LEGACY_PRODUCT_NAME_KEYS_ARE_READ_ONLY_COMPATIBILITY_AND_NEVER_DECISION_ELIGIBLE',
  title:'PRODUCT_NAME_IS_DISPLAY_LABEL_ONLY'
});

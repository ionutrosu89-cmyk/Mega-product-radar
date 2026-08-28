import {buildSupabaseCatalogPersistenceBatch,validateSupabaseCatalogPersistenceBatch} from './supabase-catalog-persistence-v1.js';
import {isValidGtin} from './canonical-identity-v2.js';

const keyOf=x=>String(x?.canonicalKey||x?.canonical_key||'');
const nsOf=x=>String(x?.namespace||'').toUpperCase();
const valOf=x=>String(x?.valueNorm||x?.value_norm||'');
const rightsOf=x=>String(x?.rightsDecision||x?.rights_decision||'HOLD').toUpperCase();
const strengthOf=x=>String(x?.identityStrength||x?.identity_strength||'').toUpperCase();

export function buildStrongGtinPersistencePilot(bundle={},options={}){
  const maxProducts=Number.isInteger(options.maxProducts)?options.maxProducts:100;
  if(maxProducts<1||maxProducts>1000)throw new Error('INVALID_MAX_PRODUCTS');
  const gtinKeys=new Set((bundle.identities||[])
    .filter(x=>nsOf(x)==='GTIN'&&isValidGtin(valOf(x)))
    .map(keyOf));
  const eligibleSourceKeys=new Set((bundle.sourceRecords||[])
    .filter(x=>rightsOf(x)==='ACCEPT'&&strengthOf(x)==='STRONG_GTIN')
    .map(keyOf));
  const eligibleKeys=new Set([...gtinKeys].filter(k=>eligibleSourceKeys.has(k)));
  const products=(bundle.products||[]).filter(x=>eligibleKeys.has(keyOf(x))).slice(0,maxProducts);
  if(products.length<1)throw new Error('STRONG_GTIN_PRODUCTS_REQUIRED');
  const allowed=new Set(products.map(keyOf));
  const strongBundle={
    ...bundle,
    products,
    identities:(bundle.identities||[]).filter(x=>allowed.has(keyOf(x))&&nsOf(x)==='GTIN'&&isValidGtin(valOf(x))),
    sourceRecords:(bundle.sourceRecords||[]).filter(x=>allowed.has(keyOf(x))&&rightsOf(x)==='ACCEPT'&&strengthOf(x)==='STRONG_GTIN'),
    claims:(bundle.claims||[]).filter(x=>allowed.has(keyOf(x))&&rightsOf(x)==='ACCEPT')
  };
  const batch=buildSupabaseCatalogPersistenceBatch(strongBundle,{maxProducts});
  const validation=validateStrongGtinPersistencePilot(batch);
  if(!validation.valid)throw new Error(`INVALID_STRONG_GTIN_PILOT:${validation.reasons.join(',')}`);
  return batch;
}

export function validateStrongGtinPersistencePilot(batch={}){
  const base=validateSupabaseCatalogPersistenceBatch(batch);
  const reasons=[...base.reasons];
  const byProduct=new Map((batch.products||[]).map(p=>[p.canonicalKey,0]));
  for(const identity of batch.identities||[]){
    if(nsOf(identity)!=='GTIN')reasons.push('NON_GTIN_IDENTITY_PRESENT');
    if(nsOf(identity)==='GTIN'&&!isValidGtin(valOf(identity)))reasons.push('INVALID_GTIN_CHECKSUM');
    if(byProduct.has(identity.canonicalKey))byProduct.set(identity.canonicalKey,byProduct.get(identity.canonicalKey)+1);
  }
  if([...byProduct.values()].some(count=>count<1))reasons.push('PRODUCT_WITHOUT_GTIN_IDENTITY');
  if((batch.sourceRecords||[]).some(x=>rightsOf(x)!=='ACCEPT'))reasons.push('SOURCE_RIGHTS_NOT_ACCEPTED');
  if((batch.sourceRecords||[]).some(x=>strengthOf(x)!=='STRONG_GTIN'))reasons.push('SOURCE_IDENTITY_NOT_STRONG_GTIN');
  if((batch.claims||[]).some(x=>rightsOf(x)!=='ACCEPT'))reasons.push('CLAIM_RIGHTS_NOT_ACCEPTED');
  return{schema:'MPR_STRONG_GTIN_PERSISTENCE_PILOT_VALIDATION_V1',valid:reasons.length===0,reasons:[...new Set(reasons)]};
}

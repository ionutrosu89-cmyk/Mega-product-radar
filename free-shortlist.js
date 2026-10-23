import {accountBrowserStorageKey} from './account-browser-storage.js';
export const FREE_SHORTLIST_STORAGE_KEY='mpr_free_shortlist_v1';
const clean=value=>String(value??'').trim();
const validKey=value=>typeof value==='string'&&value.trim().length>0&&value.length<=220&&!value.startsWith('AMAZON_ARCHIVE:');
export function freeShortlistStorageKey(userId){
  return accountBrowserStorageKey(FREE_SHORTLIST_STORAGE_KEY,userId);
}

export function freeProductKey(product={},platform='LIVE'){
  const externalId=clean(product.externalId||product.asin||product.productId);
  return externalId?`${clean(platform).toUpperCase()}:${externalId.toUpperCase()}`:null;
}

export function readFreeShortlist(storage,userId=null){
  try{
    storage=storage??globalThis.localStorage;
    const storageKey=freeShortlistStorageKey(userId),values=JSON.parse(storage.getItem(storageKey)||'[]');
    const safe=Array.isArray(values)?values.filter(validKey).slice(0,100):[];
    if(Array.isArray(values)&&safe.length!==values.length){try{storage.setItem(storageKey,JSON.stringify(safe));}catch{}}
    return new Set(safe);
  }catch{return new Set();}
}

export function writeFreeShortlist(values,storage,userId=null){
  try{
    storage=storage??globalThis.localStorage;
    const safe=[...values];
    if(safe.length>100||!safe.every(validKey))return false;
    storage.setItem(freeShortlistStorageKey(userId),JSON.stringify(safe));
    return true;
  }catch{return false;}
}

export function toggleFreeShortlist(values,key,storage,userId=null){
  const next=new Set(values),safe=clean(key);
  if(!validKey(safe))return {values:next,added:false,changed:false,reason:'INVALID_KEY'};
  const added=!next.has(safe);
  if(added){if(next.size>=100)return {values:next,added:false,changed:false,reason:'LIMIT_REACHED'};next.add(safe);}else next.delete(safe);
  if(!writeFreeShortlist(next,storage,userId))return {values:new Set(values),added:false,changed:false,reason:'STORAGE_UNAVAILABLE'};
  return {values:next,added,changed:true,reason:null};
}

export function toggleComparison(values,key,limit=3){
  const next=new Set(values),safe=clean(key);
  if(!safe)return {values:next,added:false,changed:false,limitReached:false};
  if(next.has(safe)){next.delete(safe);return {values:next,added:false,changed:true,limitReached:false};}
  if(next.size>=limit)return {values:next,added:false,changed:false,limitReached:true};
  next.add(safe);return {values:next,added:true,changed:true,limitReached:false};
}

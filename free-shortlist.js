export const FREE_SHORTLIST_STORAGE_KEY='mpr_free_shortlist_v1';
const clean=value=>String(value??'').trim();

export function freeProductKey(product={},platform='AMAZON_ARCHIVE'){
  const externalId=clean(product.externalId||product.asin||product.productId);
  return externalId?`${clean(platform).toUpperCase()}:${externalId.toUpperCase()}`:null;
}

export function readFreeShortlist(storage=globalThis.localStorage){
  try{
    const values=JSON.parse(storage.getItem(FREE_SHORTLIST_STORAGE_KEY)||'[]');
    return new Set(Array.isArray(values)?values.filter(value=>typeof value==='string'&&value.length<=220).slice(0,100):[]);
  }catch{return new Set();}
}

export function writeFreeShortlist(values,storage=globalThis.localStorage){
  try{
    const safe=[...values].filter(value=>typeof value==='string'&&value.length<=220).slice(0,100);
    storage.setItem(FREE_SHORTLIST_STORAGE_KEY,JSON.stringify(safe));
    return true;
  }catch{return false;}
}

export function toggleFreeShortlist(values,key,storage=globalThis.localStorage){
  const next=new Set(values),safe=clean(key);
  if(!safe)return {values:next,added:false,changed:false};
  const added=!next.has(safe);
  if(added){if(next.size>=100)return {values:next,added:false,changed:false};next.add(safe);}else next.delete(safe);
  writeFreeShortlist(next,storage);
  return {values:next,added,changed:true};
}

export function toggleComparison(values,key,limit=3){
  const next=new Set(values),safe=clean(key);
  if(!safe)return {values:next,added:false,changed:false,limitReached:false};
  if(next.has(safe)){next.delete(safe);return {values:next,added:false,changed:true,limitReached:false};}
  if(next.size>=limit)return {values:next,added:false,changed:false,limitReached:true};
  next.add(safe);return {values:next,added:true,changed:true,limitReached:false};
}

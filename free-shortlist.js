export const FREE_SHORTLIST_STORAGE_KEY='mpr_free_shortlist_v1';
const clean=value=>String(value??'').trim();
export function freeShortlistStorageKey(userId){
  const id=clean(userId).toLowerCase();
  if(!id)return FREE_SHORTLIST_STORAGE_KEY;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))throw new TypeError('Invalid shortlist user ID');
  return `${FREE_SHORTLIST_STORAGE_KEY}:user:${id}`;
}

export function freeProductKey(product={},platform='LIVE'){
  const externalId=clean(product.externalId||product.asin||product.productId);
  return externalId?`${clean(platform).toUpperCase()}:${externalId.toUpperCase()}`:null;
}

export function readFreeShortlist(storage=globalThis.localStorage,userId=null){
  try{
    const storageKey=freeShortlistStorageKey(userId),values=JSON.parse(storage.getItem(storageKey)||'[]');
    const safe=Array.isArray(values)?values.filter(value=>typeof value==='string'&&value.length<=220&&!value.startsWith('AMAZON_ARCHIVE:')).slice(0,100):[];
    if(Array.isArray(values)&&safe.length!==values.length){try{storage.setItem(storageKey,JSON.stringify(safe));}catch{}}
    return new Set(safe);
  }catch{return new Set();}
}

export function writeFreeShortlist(values,storage=globalThis.localStorage,userId=null){
  try{
    const safe=[...values].filter(value=>typeof value==='string'&&value.length<=220).slice(0,100);
    storage.setItem(freeShortlistStorageKey(userId),JSON.stringify(safe));
    return true;
  }catch{return false;}
}

export function toggleFreeShortlist(values,key,storage=globalThis.localStorage,userId=null){
  const next=new Set(values),safe=clean(key);
  if(!safe)return {values:next,added:false,changed:false};
  const added=!next.has(safe);
  if(added){if(next.size>=100)return {values:next,added:false,changed:false};next.add(safe);}else next.delete(safe);
  writeFreeShortlist(next,storage,userId);
  return {values:next,added,changed:true};
}

export function toggleComparison(values,key,limit=3){
  const next=new Set(values),safe=clean(key);
  if(!safe)return {values:next,added:false,changed:false,limitReached:false};
  if(next.has(safe)){next.delete(safe);return {values:next,added:false,changed:true,limitReached:false};}
  if(next.size>=limit)return {values:next,added:false,changed:false,limitReached:true};
  next.add(safe);return {values:next,added:true,changed:true,limitReached:false};
}

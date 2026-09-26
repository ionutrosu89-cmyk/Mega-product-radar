export function accountBrowserStorageKey(base,userId){
  const id=String(userId??'').trim().toLowerCase();
  if(!id)return base;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))throw new TypeError('Invalid account ID');
  return `${base}:user:${id}`;
}

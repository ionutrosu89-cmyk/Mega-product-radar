export function betaProductFlowTested(product,watchlistStatus){
  return Boolean(String(product??'').trim())&&['yes','no'].includes(String(watchlistStatus??'').trim());
}

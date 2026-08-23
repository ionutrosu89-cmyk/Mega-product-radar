export function normalizeProductKey(value=''){
  return String(value||'')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

export function applyPaidAllowlist(data={},targets=[]){
  const products=Array.isArray(data.products)?data.products:[];
  const cleanTargets=(Array.isArray(targets)?targets:[])
    .filter(t=>t&&['PROMISING','VALIDATE'].includes(String(t.status||'')))
    .map((t,index)=>({
      ...t,
      canonical_key:normalizeProductKey(t.canonical_key||t.title),
      paidDataPriority:index+1
    }))
    .filter(t=>t.canonical_key);
  const byKey=new Map(cleanTargets.map(t=>[t.canonical_key,t]));
  let eligible=0;
  for(const product of products){
    const key=normalizeProductKey(product?.canonicalKey||product?.name||'');
    const target=byKey.get(key);
    product.goldenPipeline={...(product.goldenPipeline||{})};
    product.goldenPipeline.paidDataEligible=Boolean(target);
    product.goldenPipeline.paidDataPriority=target?target.paidDataPriority:999999;
    product.goldenPipeline.budgetBrainSource='SUPABASE_STAGE0';
    if(target){
      eligible++;
      product.goldenPipeline.budgetBrainEstimatedCostEur=Number(target.estimated_cost_eur||0)||0;
      product.goldenPipeline.budgetBrainInformationValue=Number(target.information_value||0)||0;
    }else{
      delete product.goldenPipeline.budgetBrainEstimatedCostEur;
      delete product.goldenPipeline.budgetBrainInformationValue;
    }
  }
  return {
    data,
    targets:cleanTargets,
    stats:{products:products.length,eligible,blocked:Math.max(0,products.length-eligible)}
  };
}

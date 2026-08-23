export function normalizeProductKey(value=''){
  return String(value||'')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

function n(v,fallback=0){return Number.isFinite(Number(v))?Number(v):fallback;}
function romaniaDemandReady(product={}){
  const ro=product?.romaniaDemand||product?.providerIntelligence?.romaniaDemand||{};
  return ro?.readyForTestDemandGate===true||ro?.providerVerified===true||['PROVIDER_VERIFIED','MARKET_EVIDENCE_READY'].includes(String(ro?.status||''));
}
function salesConfidenceReady(product={}){
  const s=product?.salesEstimation||{};
  return s?.status==='ACTUAL_OBSERVED'||(s?.status==='ESTIMATED_HIGH_CONFIDENCE'&&n(s?.confidence)>=75)||n(s?.confidence)>=75;
}
function targetStageRank(product={}){return String(product?.goldenPipeline?.budgetBrainTargetStatus||'')==='VALIDATE'?0:1;}
function commercialScore(product={}){
  return Math.max(
    n(product?.goldenPipeline?.score),
    n(product?.opportunityScore),
    n(product?.launchScore?.score)
  );
}

export function applyNextBestEvidenceRouting(data={}){
  const products=Array.isArray(data.products)?data.products:[];
  const keyword=[],deepSales=[],complete=[];
  for(const product of products){
    product.goldenPipeline={...(product.goldenPipeline||{})};
    const eligible=product.goldenPipeline.paidDataEligible===true;
    const roReady=romaniaDemandReady(product);
    const salesReady=salesConfidenceReady(product);
    let need='NONE';
    if(eligible&&!roReady)need='ROMANIA_DEMAND';
    else if(eligible&&!salesReady)need='SALES_CONFIDENCE';
    else if(eligible)need='COMMERCIAL_EVIDENCE';
    product.goldenPipeline.nextEvidenceNeed=need;
    product.goldenPipeline.keywordDataEligible=need==='ROMANIA_DEMAND';
    product.goldenPipeline.deepSalesDataEligible=need==='SALES_CONFIDENCE';
    product.goldenPipeline.keywordDataPriority=999999;
    product.goldenPipeline.deepSalesDataPriority=999999;
    if(need==='ROMANIA_DEMAND')keyword.push(product);
    else if(need==='SALES_CONFIDENCE')deepSales.push(product);
    else if(need==='COMMERCIAL_EVIDENCE')complete.push(product);
  }
  keyword.sort((a,b)=>n(a?.goldenPipeline?.paidDataPriority,999999)-n(b?.goldenPipeline?.paidDataPriority,999999));
  deepSales.sort((a,b)=>{
    const stage=targetStageRank(a)-targetStageRank(b);if(stage)return stage;
    const score=commercialScore(b)-commercialScore(a);if(score)return score;
    const iv=n(b?.goldenPipeline?.budgetBrainInformationValue)-n(a?.goldenPipeline?.budgetBrainInformationValue);if(iv)return iv;
    return n(a?.goldenPipeline?.paidDataPriority,999999)-n(b?.goldenPipeline?.paidDataPriority,999999);
  });
  keyword.forEach((p,i)=>p.goldenPipeline.keywordDataPriority=i+1);
  deepSales.forEach((p,i)=>p.goldenPipeline.deepSalesDataPriority=i+1);
  return {
    data,
    stats:{
      paidEligible:products.filter(p=>p?.goldenPipeline?.paidDataEligible===true).length,
      keywordTargets:keyword.length,
      deepSalesTargets:deepSales.length,
      commercialEvidenceNext:complete.length
    },
    keywordOrder:keyword.map(p=>({name:p?.name||'',priority:p.goldenPipeline.keywordDataPriority})),
    deepSalesOrder:deepSales.map(p=>({name:p?.name||'',priority:p.goldenPipeline.deepSalesDataPriority,targetStatus:p.goldenPipeline.budgetBrainTargetStatus||null,score:commercialScore(p)}))
  };
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
      product.goldenPipeline.budgetBrainTargetStatus=String(target.status||'');
      product.goldenPipeline.budgetBrainEstimatedCostEur=Number(target.estimated_cost_eur||0)||0;
      product.goldenPipeline.budgetBrainInformationValue=Number(target.information_value||0)||0;
    }else{
      delete product.goldenPipeline.budgetBrainTargetStatus;
      delete product.goldenPipeline.budgetBrainEstimatedCostEur;
      delete product.goldenPipeline.budgetBrainInformationValue;
    }
  }
  const routed=applyNextBestEvidenceRouting(data);
  return {
    data:routed.data,
    targets:cleanTargets,
    stats:{products:products.length,eligible,blocked:Math.max(0,products.length-eligible),...routed.stats},
    routing:{keywordOrder:routed.keywordOrder,deepSalesOrder:routed.deepSalesOrder}
  };
}

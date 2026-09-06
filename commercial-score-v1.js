const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const clamp=v=>Math.max(0,Math.min(100,Number(v)));
const val=(v)=>finite(v)?clamp(v):null;

export function commercialScoreV1(input={}){
  const dimensions={
    demand:val(input.demandScore),
    romaniaGap:val(input.romaniaGapScore),
    trend:val(input.trendScore),
    supplier:val(input.supplierScore),
    economics:val(input.economicsScore),
    logistics:val(input.logisticsScore),
    compliance:val(input.complianceScore),
    capitalEfficiency:val(input.capitalEfficiencyScore)
  };
  const required=['demand','romaniaGap','supplier','economics','logistics','compliance'];
  const missing=required.filter(k=>dimensions[k]===null);
  if(missing.length)return Object.freeze({schemaVersion:'MPR_COMMERCIAL_SCORE_V1',status:'UNKNOWN_FAIL_CLOSED',score:null,grade:null,dimensions:Object.freeze(dimensions),blockers:Object.freeze(missing.map(x=>`MISSING_${x.toUpperCase()}_SCORE`)),decisionEligible:false,purchaseAuthorized:false});
  const weights={demand:.18,romaniaGap:.14,trend:.08,supplier:.14,economics:.24,logistics:.08,compliance:.08,capitalEfficiency:.06};
  let total=0,weight=0;
  for(const [k,w] of Object.entries(weights)){if(dimensions[k]!==null){total+=dimensions[k]*w;weight+=w;}}
  const score=weight?Number((total/weight).toFixed(1)):null;
  const grade=score>=85?'A':score>=75?'B':score>=65?'C':score>=50?'D':'E';
  return Object.freeze({schemaVersion:'MPR_COMMERCIAL_SCORE_V1',status:'CALCULATED',score,grade,dimensions:Object.freeze(dimensions),weights:Object.freeze(weights),blockers:Object.freeze([]),decisionEligible:true,purchaseAuthorized:false,policy:'Commercial Score ranks fully evidenced commercial attractiveness only. It cannot override any hard TEST/BUY gate and never authorizes purchase.'});
}

export function deriveCommercialScoreInputs({product={},decision={},quantityEconomics=null}={}){
  const q=quantityEconomics?.recommendation?quantityEconomics.rows.find(x=>x.quantity===quantityEconomics.recommendation.quantity):null;
  const econ=q&&q.status==='CALCULATED'?Math.max(0,Math.min(100,(q.marginPct-10)*2+(q.roiPct-20)*.45)):null;
  const capital=q&&q.capitalRequiredRon>0?Math.max(0,Math.min(100,100-Math.log10(Math.max(1,q.capitalRequiredRon))*18)):null;
  const trend=String(product?.trendIntelligence?.status||'').toUpperCase();
  return {
    demandScore:product?.romaniaDemand?.score??product?.demand?.score??null,
    romaniaGapScore:product?.marketGap?.score??null,
    trendScore:trend==='ACCELERATING'?95:trend==='RISING'?80:trend==='STABLE'?55:trend==='DECLINING'?20:null,
    supplierScore:decision?.gates?.supplierVerified?85:null,
    economicsScore:econ,
    logisticsScore:q?85:null,
    complianceScore:decision?.gates?.supplierVerified?80:null,
    capitalEfficiencyScore:capital
  };
}

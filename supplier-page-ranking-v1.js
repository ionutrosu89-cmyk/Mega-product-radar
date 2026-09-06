const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const clamp=v=>Math.max(0,Math.min(100,Number(v)));
const round=(v,d=1)=>Number(Number(v).toFixed(d));

function priceScore(price,min,max){
  if(!finite(price))return null;
  if(!finite(min)||!finite(max)||max<=min)return 80;
  return clamp(100-((Number(price)-min)/(max-min))*70);
}
function moqScore(moq){
  if(!finite(moq)||Number(moq)<=0)return null;
  const q=Number(moq);
  if(q<=2)return 100;if(q<=10)return 90;if(q<=20)return 80;if(q<=50)return 65;if(q<=100)return 50;return 30;
}
function maturityScore(years,rating){
  const ys=finite(years)?clamp(Number(years)/10*100):null;
  const rs=finite(rating)?clamp((Number(rating)-3.5)/1.5*100):null;
  if(ys===null&&rs===null)return null;
  if(ys===null)return rs;if(rs===null)return ys;
  return ys*.55+rs*.45;
}
function completenessScore(x={}){
  const checks=[
    Boolean(x.material),
    Boolean(x.productDimensions),
    finite(x.leadTimeDays)||finite(x.leadTimeDaysMin),
    Array.isArray(x.publicPriceTiers)&&x.publicPriceTiers.length>0,
    Boolean(x.supplierProfileUrl),
    finite(x.supplierYearsObserved),
    finite(x.supplierRatingObserved),
    Boolean(x.package)
  ];
  return checks.filter(Boolean).length/checks.length*100;
}

export function rankSupplierPagesV1(candidates=[]){
  const valid=(Array.isArray(candidates)?candidates:[]).filter(x=>x?.pageBackedScreeningReady===true&&String(x?.productMatch||'').toUpperCase()==='HIGH');
  const prices=valid.map(x=>finite(x.observedPriceMaxUsd)?Number(x.observedPriceMaxUsd):null).filter(finite);
  const min=prices.length?Math.min(...prices):null,max=prices.length?Math.max(...prices):null;
  const weights={price:25,moq:15,maturity:25,completeness:20,match:15};
  const rows=valid.map(x=>{
    const dims={
      price:priceScore(x.observedPriceMaxUsd,min,max),
      moq:moqScore(x.observedMoq),
      maturity:maturityScore(x.supplierYearsObserved,x.supplierRatingObserved),
      completeness:completenessScore(x),
      match:100
    };
    let sum=0,known=0;
    for(const [k,w] of Object.entries(weights)){if(dims[k]!==null){sum+=dims[k]*w;known+=w;}}
    const raw=known?sum/known:0;
    const confidence=known/100;
    const adjusted=raw*(0.7+0.3*confidence);
    return Object.freeze({
      supplierName:x.supplierName,
      sourceUrl:x.sourceUrl,
      publicUnitPriceUsd:finite(x.observedPriceMaxUsd)?Number(x.observedPriceMaxUsd):null,
      publicMoq:finite(x.observedMoq)?Number(x.observedMoq):null,
      score:round(adjusted),
      evidenceConfidencePct:round(confidence*100),
      dimensions:Object.freeze(Object.fromEntries(Object.entries(dims).map(([k,v])=>[k,v===null?null:round(v)]))),
      decisionClass:confidence>=.8?'STRONG_PAGE_EVIDENCE':confidence>=.6?'MEDIUM_PAGE_EVIDENCE':'LIMITED_PAGE_EVIDENCE',
      supplierContactRequired:false,
      purchaseAuthorized:false
    });
  }).sort((a,b)=>b.score-a.score||b.evidenceConfidencePct-a.evidenceConfidencePct);
  return Object.freeze({
    schemaVersion:'MPR_SUPPLIER_PAGE_RANKING_V1',
    status:rows.length?'RANKED':'NO_DIRECT_PAGE_CANDIDATES',
    ranked:Object.freeze(rows),
    leader:rows[0]||null,
    policy:'Ranks direct page-backed supplier candidates only. Missing public fields reduce evidence confidence; they are not invented and do not trigger supplier outreach. Ranking never authorizes purchase.'
  });
}

const n=v=>Number.isFinite(Number(v))?Number(v):null;
const clean=arr=>arr.map(n).filter(v=>v!==null);
const round=(v,d=4)=>Number.isFinite(Number(v))?Number(Number(v).toFixed(d)):null;
const median=values=>{const a=clean(values).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
const pct=(part,total)=>total>0?round(part/total*100,1):null;

export function benchmarkSupplierQuotes(records=[]){
  const groups=new Map();
  for(const r of records){
    const key=String(r?.productKey||'').trim();
    if(!key)continue;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(r);
  }

  return [...groups.entries()].map(([productKey,rows])=>{
    const complete=rows.filter(r=>n(r.ddpUnit)!==null);
    const unitPrices=rows.map(r=>r.unitPrice);
    const ddpUnits=complete.map(r=>r.ddpUnit);
    const ddpTotals=complete.map(r=>r.ddpTotal);
    const shippingShares=complete.map(r=>{
      const s=n(r.ddpShipping),t=n(r.ddpTotal);
      return s!==null&&t>0?s/t*100:null;
    });
    const documentary=rows.filter(r=>['DOCUMENTED','MANUALLY_VERIFIED'].includes(r.evidenceLevel)).length;
    const customsReady=rows.filter(r=>r.mrnPromised===true&&r.vatProofPromised===true).length;
    const tradeAssurance=rows.filter(r=>r.tradeAssurance===true).length;
    const inspection=rows.filter(r=>r.preShipmentInspectionAccepted===true).length;

    const med=median(ddpUnits);
    const scored=complete.map(r=>({
      supplierKey:r.supplierKey,
      ddpUnit:round(r.ddpUnit),
      varianceVsMedianPct:med&&med>0?round((Number(r.ddpUnit)-med)/med*100,1):null,
      evidenceLevel:r.evidenceLevel||'UNVERIFIED'
    })).sort((a,b)=>a.ddpUnit-b.ddpUnit);

    return {
      productKey,
      quoteCount:rows.length,
      completeDdpQuoteCount:complete.length,
      unitPrice:{min:clean(unitPrices).length?Math.min(...clean(unitPrices)):null,median:round(median(unitPrices))},
      ddpUnit:{min:ddpUnits.length?round(Math.min(...ddpUnits)):null,median:round(med),max:ddpUnits.length?round(Math.max(...ddpUnits)):null},
      ddpTotal:{median:round(median(ddpTotals))},
      shippingSharePct:{median:round(median(shippingShares),1)},
      evidence:{documentaryPct:pct(documentary,rows.length),customsDocsPromisedPct:pct(customsReady,rows.length),tradeAssurancePct:pct(tradeAssurance,rows.length),inspectionAcceptedPct:pct(inspection,rows.length)},
      rankedQuotes:scored,
      confidence:complete.length>=5?'MEDIUM':complete.length>=3?'LOW_MEDIUM':'LOW',
      decisionUse:'INTELLIGENCE_ONLY',
      purchaseAuthorized:false
    };
  });
}

export function classifyQuoteAgainstBenchmark(quote,benchmark){
  const q=n(quote?.ddpUnit),m=n(benchmark?.ddpUnit?.median);
  if(q===null||m===null||m<=0)return{classification:'INSUFFICIENT_DATA',variancePct:null};
  const variance=(q-m)/m*100;
  let classification='NORMAL';
  if(variance<=-15)classification='CHEAP_VS_SAMPLE';
  else if(variance>=15)classification='EXPENSIVE_VS_SAMPLE';
  return{classification,variancePct:round(variance,1)};
}

const n=v=>{
  if(v===null||v===undefined)return null;
  if(typeof v==='string'&&v.trim()==='')return null;
  const x=Number(v);
  return Number.isFinite(x)?x:null;
};
const text=v=>String(v??'').trim();
const round=(v,d=1)=>v===null?null:Number(Number(v).toFixed(d));

function aggregate(records,keyField){
  const groups=new Map();
  for(const r of records){
    const key=text(r[keyField]);
    if(!key)continue;
    if(!groups.has(key))groups.set(key,{key,productKeys:new Set(),estimatedRevenue:0,estimatedUnits:0,reviews:0,knownRevenueRows:0,knownUnitsRows:0,confidenceSum:0,confidenceRows:0});
    const g=groups.get(key);
    if(r.productKey)g.productKeys.add(r.productKey);
    const revenue=n(r.estimatedRevenue);
    const units=n(r.estimatedUnits);
    const reviews=n(r.reviews);
    const confidence=n(r.sourceConfidence);
    if(revenue!==null){g.estimatedRevenue+=revenue;g.knownRevenueRows++;}
    if(units!==null){g.estimatedUnits+=units;g.knownUnitsRows++;}
    if(reviews!==null)g.reviews+=reviews;
    if(confidence!==null){g.confidenceSum+=confidence;g.confidenceRows++;}
  }
  return [...groups.values()].map(g=>({
    key:g.key,
    productCount:g.productKeys.size,
    estimatedRevenue:g.knownRevenueRows?round(g.estimatedRevenue,2):null,
    estimatedUnits:g.knownUnitsRows?round(g.estimatedUnits,2):null,
    reviewCount:g.reviews,
    averageSourceConfidence:g.confidenceRows?round(g.confidenceSum/g.confidenceRows,1):null,
    revenueCoverageRows:g.knownRevenueRows,
    unitsCoverageRows:g.knownUnitsRows
  }));
}

export function buildSellerBrandGraph(records=[]){
  const sellers=aggregate(records,'seller').map(x=>({...x,type:'SELLER'}));
  const brands=aggregate(records,'brand').map(x=>({...x,type:'BRAND'}));
  const edges=[];
  for(const r of records){
    const productKey=text(r.productKey);
    if(!productKey)continue;
    if(text(r.seller))edges.push({from:`SELLER:${text(r.seller)}`,to:`PRODUCT:${productKey}`,type:'SELLS'});
    if(text(r.brand))edges.push({from:`BRAND:${text(r.brand)}`,to:`PRODUCT:${productKey}`,type:'BRANDS'});
  }
  return {sellers,brands,edges};
}

export function rankMarketEntities(records=[],{type='SELLER',limit=25}={}){
  const field=type==='BRAND'?'brand':'seller';
  const rows=aggregate(records,field);
  rows.sort((a,b)=>(b.estimatedRevenue??-1)-(a.estimatedRevenue??-1)||(b.estimatedUnits??-1)-(a.estimatedUnits??-1)||b.productCount-a.productCount||b.reviewCount-a.reviewCount);
  return rows.slice(0,Math.max(1,Math.min(Number(limit||25),100))).map((r,i)=>({...r,rank:i+1,type,metricBasis:r.estimatedRevenue!==null?'ESTIMATED_REVENUE':r.estimatedUnits!==null?'ESTIMATED_UNITS':'PRODUCT_COUNT'}));
}

export function categoryConcentration(records=[]){
  const sellers=aggregate(records,'seller');
  const revenueTotal=sellers.reduce((s,x)=>s+(x.estimatedRevenue??0),0);
  const usableRevenue=sellers.filter(x=>x.estimatedRevenue!==null);
  let basis='PRODUCT_COUNT';
  let shares=[];
  if(revenueTotal>0&&usableRevenue.length){
    basis='ESTIMATED_REVENUE';
    shares=usableRevenue.map(x=>({key:x.key,share:x.estimatedRevenue/revenueTotal*100}));
  }else{
    const total=sellers.reduce((s,x)=>s+x.productCount,0);
    shares=total?sellers.map(x=>({key:x.key,share:x.productCount/total*100})):[];
  }
  shares.sort((a,b)=>b.share-a.share);
  const top3Share=shares.slice(0,3).reduce((s,x)=>s+x.share,0);
  const top10Share=shares.slice(0,10).reduce((s,x)=>s+x.share,0);
  const hhi=shares.reduce((s,x)=>s+Math.pow(x.share/100,2),0)*10000;
  const level=hhi>=2500?'HIGH':hhi>=1500?'MEDIUM':'LOW';
  return {
    sellerCount:sellers.length,
    basis,
    top3SharePct:shares.length?round(top3Share,1):null,
    top10SharePct:shares.length?round(top10Share,1):null,
    hhi:shares.length?round(hhi,0):null,
    concentration:shares.length?level:'UNKNOWN',
    evidencePolicy:basis==='ESTIMATED_REVENUE'?'Revenue concentration is derived from explicitly estimated revenue and is not verified seller revenue.':'Revenue coverage is insufficient; concentration falls back to observed product-count share.'
  };
}

export function sellerBrandSummary(records=[]){
  const graph=buildSellerBrandGraph(records);
  return {
    sellerCount:graph.sellers.length,
    brandCount:graph.brands.length,
    productSellerEdges:graph.edges.filter(x=>x.type==='SELLS').length,
    productBrandEdges:graph.edges.filter(x=>x.type==='BRANDS').length,
    topSellers:rankMarketEntities(records,{type:'SELLER',limit:25}),
    topBrands:rankMarketEntities(records,{type:'BRAND',limit:25}),
    concentration:categoryConcentration(records),
    purchaseAuthorized:false
  };
}

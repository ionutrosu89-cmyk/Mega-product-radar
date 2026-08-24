const n=v=>{
  if(v===null||v===undefined)return null;
  if(typeof v==='string'&&v.trim()==='')return null;
  const x=Number(v);
  return Number.isFinite(x)?x:null;
};
const round=(v,d=1)=>v===null?null:Number(Number(v).toFixed(d));
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export const MARKET_SCORE_WEIGHTS={
  estimatedUnits:30,
  estimatedRevenue:20,
  reviews:15,
  sourceRank:15,
  reviewGrowth30d:10,
  sourceConfidence:10
};

function normalize(values,value,{inverse=false}={}){
  const clean=values.map(n).filter(v=>v!==null);
  const x=n(value);
  if(x===null||!clean.length)return null;
  const min=Math.min(...clean),max=Math.max(...clean);
  if(min===max)return 50;
  const raw=(x-min)/(max-min)*100;
  return clamp(inverse?100-raw:raw);
}

export function buildTopProducts(records=[],options={}){
  const limit=Math.max(1,Math.min(Number(options.limit||100),100));
  const nicheKey=String(options.nicheKey||'').trim()||null;
  const pool=nicheKey?records.filter(r=>r.nicheKey===nicheKey):records.slice();
  const vectors={
    estimatedUnits:pool.map(r=>r.estimatedUnits),
    estimatedRevenue:pool.map(r=>r.estimatedRevenue),
    reviews:pool.map(r=>r.reviews),
    sourceRank:pool.map(r=>r.sourceRank),
    reviewGrowth30d:pool.map(r=>r.reviewGrowth30d),
    sourceConfidence:pool.map(r=>r.sourceConfidence)
  };

  const ranked=pool.map(r=>{
    const components={
      estimatedUnits:normalize(vectors.estimatedUnits,r.estimatedUnits),
      estimatedRevenue:normalize(vectors.estimatedRevenue,r.estimatedRevenue),
      reviews:normalize(vectors.reviews,r.reviews),
      sourceRank:normalize(vectors.sourceRank,r.sourceRank,{inverse:true}),
      reviewGrowth30d:normalize(vectors.reviewGrowth30d,r.reviewGrowth30d),
      sourceConfidence:normalize(vectors.sourceConfidence,r.sourceConfidence)
    };
    let weighted=0,availableWeight=0;
    for(const [key,weight] of Object.entries(MARKET_SCORE_WEIGHTS)){
      if(components[key]===null)continue;
      weighted+=components[key]*weight;
      availableWeight+=weight;
    }
    const coveragePct=availableWeight;
    const base=availableWeight?weighted/availableWeight:0;
    const coveragePenalty=coveragePct/100;
    const marketScore=round(base*coveragePenalty,1);
    return {
      productKey:r.productKey||null,
      title:r.title||null,
      brand:r.brand||null,
      seller:r.seller||null,
      marketplace:r.marketplace||null,
      nicheKey:r.nicheKey||null,
      price:n(r.price),
      currency:r.currency||null,
      rating:n(r.rating),
      reviews:n(r.reviews),
      sourceRank:n(r.sourceRank),
      estimatedUnits:n(r.estimatedUnits),
      estimatedRevenue:n(r.estimatedRevenue),
      salesEvidenceClass:String(r.salesEvidenceClass||'UNKNOWN').toUpperCase(),
      sourceConfidence:n(r.sourceConfidence),
      marketScore,
      metricCoveragePct:coveragePct,
      components,
      directSourceUrl:/^https:\/\//i.test(String(r.url||''))?r.url:null
    };
  });

  ranked.sort((a,b)=>b.marketScore-a.marketScore||b.metricCoveragePct-a.metricCoveragePct||(a.sourceRank??Number.MAX_SAFE_INTEGER)-(b.sourceRank??Number.MAX_SAFE_INTEGER));
  return ranked.slice(0,limit).map((r,i)=>({...r,mprRank:i+1}));
}

export function topProductsSummary(records=[],options={}){
  const ranking=buildTopProducts(records,options);
  const verifiedSales=ranking.filter(r=>r.salesEvidenceClass==='VERIFIED').length;
  const estimatedSales=ranking.filter(r=>r.salesEvidenceClass==='ESTIMATED').length;
  const medianScore=ranking.length?round([...ranking].map(r=>r.marketScore).sort((a,b)=>a-b)[Math.floor(ranking.length/2)],1):null;
  return {
    nicheKey:String(options.nicheKey||'').trim()||null,
    requestedLimit:Math.max(1,Math.min(Number(options.limit||100),100)),
    returned:ranking.length,
    verifiedSales,
    estimatedSales,
    medianMarketScore:medianScore,
    ranking,
    policy:'MPR rank is an internal evidence-weighted market ranking; estimated sales remain explicitly ESTIMATED and are never presented as verified sales.'
  };
}

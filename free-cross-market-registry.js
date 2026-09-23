const DAY_MS=86_400_000;
const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();

export const FREE_CROSS_MARKET_PLATFORMS=Object.freeze([
  Object.freeze({id:'CONSENSUS',label:'Consensus',shortLabel:'Consensus',emoji:'✦',kind:'DERIVED',rankingBasis:'MULTI_PLATFORM_CONFIRMATION',sourceLabel:'Mega Product Radar',officialUrl:'https://mega-product-radar.netlify.app/sources.html',freshnessDays:7}),
  Object.freeze({id:'ALIEXPRESS',label:'AliExpress Hot Products',shortLabel:'AliExpress',emoji:'🛍️',kind:'LIVE',rankingBasis:'HOT_PRODUCTS',sourceLabel:'AliExpress Open Platform',officialUrl:'https://developer.alibaba.com/docs/api.htm?apiId=45794',freshnessDays:3}),
  Object.freeze({id:'EBAY',label:'eBay Best Selling',shortLabel:'eBay',emoji:'🏷️',kind:'LIVE',rankingBasis:'BEST_SELLING',sourceLabel:'eBay Marketing API',officialUrl:'https://developer.ebay.com/api-docs/buy/marketing/overview.html',freshnessDays:3}),
  Object.freeze({id:'AMAZON_US',label:'Amazon US Live',shortLabel:'Amazon US',emoji:'🇺🇸',kind:'LIVE',rankingBasis:'OFFICIAL_RANK_OR_BSR',sourceLabel:'Amazon official/licensed data',officialUrl:'https://webservices.amazon.com/paapi5/documentation/',freshnessDays:3}),
  Object.freeze({id:'AMAZON_DE',label:'Amazon DE Live',shortLabel:'Amazon DE',emoji:'🇩🇪',kind:'LIVE',rankingBasis:'OFFICIAL_RANK_OR_BSR',sourceLabel:'Amazon official/licensed data',officialUrl:'https://webservices.amazon.com/paapi5/documentation/',freshnessDays:3}),
  Object.freeze({id:'TIKTOK',label:'TikTok Shop & Ads',shortLabel:'TikTok',emoji:'♪',kind:'SIGNAL',rankingBasis:'AD_MOMENTUM_ONLY',sourceLabel:'TikTok official access',officialUrl:'https://developers.tiktok.com/',freshnessDays:7}),
  Object.freeze({id:'GOOGLE',label:'Google Search Demand',shortLabel:'Google',emoji:'G',kind:'SIGNAL',rankingBasis:'SEARCH_DEMAND_ONLY',sourceLabel:'Google Ads Keyword Planner',officialUrl:'https://developers.google.com/google-ads/api/docs/keyword-planning/overview',freshnessDays:35}),
  Object.freeze({id:'ROMANIA',label:'Oferta din România',shortLabel:'România',emoji:'🇷🇴',kind:'SIGNAL',rankingBasis:'COMPARABLE_OFFERS_ONLY',sourceLabel:'MPR Romania evidence',officialUrl:'https://mega-product-radar.netlify.app/sources.html',freshnessDays:7})
]);

const BY_ID=new Map(FREE_CROSS_MARKET_PLATFORMS.map(platform=>[platform.id,platform]));
export const crossMarketSnapshotKey=(platform,nicheId)=>`XMARKET:${upper(platform)}:${upper(nicheId)}`;

export function parseCrossMarketSnapshotKey(value){
  const match=clean(value).match(/^XMARKET:([A-Z0-9_]+):([A-Z0-9_]+)$/i);
  if(!match||!BY_ID.has(upper(match[1])))return null;
  return {platform:upper(match[1]),nicheId:upper(match[2])};
}

function accessState(platform,accessByPlatform={}){
  if(platform.kind==='SIGNAL')return 'SUPPORTING_SIGNAL_ONLY';
  if(platform.id==='CONSENSUS')return 'WAITING_FOR_TWO_LIVE_PLATFORMS';
  const status=upper(accessByPlatform[platform.id]);
  return ['ACCESS_REQUIRED','TERMS_REVIEW_REQUIRED','PUBLIC_DISPLAY_RIGHTS_REQUIRED','READY_TO_COLLECT'].includes(status)?status:'ACCESS_REQUIRED';
}

function https(value){try{return new URL(clean(value)).protocol==='https:';}catch{return false;}}

export function normalizeCrossMarketProduct(raw,index,{platform,rankingBasis}={}){
  const row=raw&&typeof raw==='object'?raw:{};
  const name=clean(row.name||row.title).slice(0,220);
  const externalId=clean(row.externalId||row.asin||row.productId).slice(0,120);
  const sourceUrl=clean(row.sourceUrl).slice(0,500);
  const observedAt=clean(row.observedAt);
  const rank=Number(row.rank??index+1);
  if(!name||!externalId||rank!==index+1||!https(sourceUrl)||!Number.isFinite(Date.parse(observedAt)))return null;
  return {
    name,externalId,rank,platform,sourceUrl,observedAt,
    conceptKey:upper(row.conceptKey||row.canonicalProductId).slice(0,160)||null,
    sourceKey:clean(row.sourceKey).slice(0,100)||null,
    sourceLabel:clean(row.sourceLabel).slice(0,160)||BY_ID.get(platform)?.sourceLabel||platform,
    rankingBasis:clean(row.rankingBasis).slice(0,120)||rankingBasis,
    market:upper(row.market).slice(0,20)||null,
    price:Number.isFinite(Number(row.price))&&Number(row.price)>=0?Number(row.price):null,
    currency:upper(row.currency).slice(0,8)||null,
    rating:Number.isFinite(Number(row.rating))&&Number(row.rating)>=0&&Number(row.rating)<=5?Number(row.rating):null,
    reviewCount:Number.isInteger(Number(row.reviewCount))&&Number(row.reviewCount)>=0?Number(row.reviewCount):null,
    sourceMetric:row.sourceMetric&&typeof row.sourceMetric==='object'?row.sourceMetric:null,
    evidenceClass:['DIRECT','LICENSED','DERIVED'].includes(upper(row.evidenceClass))?upper(row.evidenceClass):'DIRECT',
    salesEvidenceClass:'PLATFORM_RANK_NOT_UNIT_SALES',
    commercialGate:clean(row.commercialGate).slice(0,80)||'BRAND_REVIEW_REQUIRED'
  };
}

export function normalizeCrossMarketSnapshot(raw,{now=new Date()}={}){
  const explicitPlatform=upper(raw?.platform),explicitNiche=upper(raw?.niche_id);
  const key=BY_ID.has(explicitPlatform)?{platform:explicitPlatform,nicheId:explicitNiche}:parseCrossMarketSnapshotKey(raw?.niche_id);
  if(!key||BY_ID.get(key.platform)?.kind!=='LIVE')return null;
  if(explicitPlatform&&(!explicitNiche||raw?.product_count!==25||upper(raw?.source_rights_status)!=='APPROVED'||upper(raw?.freshness_status)!=='CURRENT'))return null;
  const platform=BY_ID.get(key.platform);
  const reviewedAt=clean(raw?.window_end||raw?.reviewed_at);
  const reviewedDate=new Date(reviewedAt.length===10?`${reviewedAt}T23:59:59Z`:reviewedAt);
  const ageMs=now.getTime()-reviewedDate.getTime();
  if(!Number.isFinite(ageMs)||ageMs<0||ageMs>platform.freshnessDays*DAY_MS)return null;
  const source=Array.isArray(raw?.products)?raw.products:[];
  if(source.length!==25)return null;
  const products=source.map((product,index)=>normalizeCrossMarketProduct(product,index,{platform:key.platform,rankingBasis:platform.rankingBasis})).filter(Boolean);
  if(products.length!==25||new Set(products.map(p=>p.externalId)).size!==25)return null;
  if(products.some(p=>now.getTime()-Date.parse(p.observedAt)<0||now.getTime()-Date.parse(p.observedAt)>platform.freshnessDays*DAY_MS))return null;
  return {...key,reviewedAt,products,evidenceMode:'LIVE_PLATFORM_EVIDENCE'};
}

function deriveConsensusRankings(rankings,now){
  const byNiche=new Map();
  for(const ranking of rankings){
    if(!byNiche.has(ranking.nicheId))byNiche.set(ranking.nicheId,[]);
    byNiche.get(ranking.nicheId).push(ranking);
  }
  const consensus=[];
  for(const [nicheId,nicheRankings] of byNiche){
    const concepts=new Map();
    for(const ranking of nicheRankings){
      for(const product of ranking.products){
        if(!product.conceptKey)continue;
        if(!concepts.has(product.conceptKey))concepts.set(product.conceptKey,new Map());
        concepts.get(product.conceptKey).set(ranking.platform,product);
      }
    }
    const confirmed=[...concepts.entries()].map(([conceptKey,platformRows])=>({conceptKey,rows:[...platformRows.values()]})).filter(row=>row.rows.length>=2).sort((a,b)=>a.rows.reduce((sum,row)=>sum+row.rank,0)/a.rows.length-b.rows.reduce((sum,row)=>sum+row.rank,0)/b.rows.length||a.conceptKey.localeCompare(b.conceptKey));
    if(confirmed.length<25)continue;
    const products=confirmed.slice(0,25).map(({conceptKey,rows},index)=>({
      name:rows[0].name,externalId:`CONSENSUS:${conceptKey}`,conceptKey,rank:index+1,platform:'CONSENSUS',sourceUrl:rows[0].sourceUrl,observedAt:rows.map(row=>row.observedAt).sort().at(-1),sourceKey:'MPR_CROSS_MARKET_CONSENSUS',sourceLabel:`${rows.length} platforme independente`,rankingBasis:'MULTI_PLATFORM_CONFIRMATION',market:null,price:null,currency:null,rating:null,reviewCount:null,sourceMetric:{label:'Platforme independente',value:rows.length,unit:'platforms'},evidenceClass:'DERIVED',salesEvidenceClass:'NOT_UNIT_SALES',commercialGate:'BRAND_REVIEW_REQUIRED',platformConfirmations:rows.map(row=>row.platform).sort()
    }));
    consensus.push({platform:'CONSENSUS',nicheId,reviewedAt:now.toISOString().slice(0,10),products,evidenceMode:'DERIVED_MULTI_PLATFORM_EVIDENCE'});
  }
  return consensus;
}

export function buildFreeCrossMarketExperience({snapshots=[],accessByPlatform={},now=new Date()}={}){
  const normalized=snapshots.map(row=>normalizeCrossMarketSnapshot(row,{now})).filter(Boolean);
  const latest=new Map();
  for(const row of normalized){
    const key=`${row.platform}:${row.nicheId}`,previous=latest.get(key);
    if(!previous||row.reviewedAt>previous.reviewedAt)latest.set(key,row);
  }
  const liveRankings=[...latest.values()];
  const consensusRankings=deriveConsensusRankings(liveRankings,now);
  const rankings=[...liveRankings,...consensusRankings];
  const publishedByPlatform={};
  for(const row of rankings)publishedByPlatform[row.platform]=(publishedByPlatform[row.platform]||0)+1;
  const livePlatforms=Object.entries(publishedByPlatform).filter(([id,count])=>id!=='CONSENSUS'&&count>0).map(([id])=>id);
  const platforms=FREE_CROSS_MARKET_PLATFORMS.map(platform=>{
    const publishedNiches=publishedByPlatform[platform.id]||0;
    let status=publishedNiches>0?'LIVE':accessState(platform,accessByPlatform);
    if(platform.id==='CONSENSUS')status=consensusRankings.length>0?'LIVE':'WAITING_FOR_TWO_LIVE_PLATFORMS';
    return {...platform,status,publishedNiches,publishedPositions:publishedNiches*25};
  });
  return {
    schema:'MPR_FREE_CROSS_MARKET_V1',generatedAt:now.toISOString(),
    platforms,
    rankings,
    coverage:{platformCount:platforms.length,livePlatformCount:livePlatforms.length,liveNicheRankings:liveRankings.length,livePositions:liveRankings.length*25,consensusNicheRankings:consensusRankings.length,consensusPositions:consensusRankings.length*25,consensusReady:consensusRankings.length>0},
    policy:{noSyntheticRankings:true,minimumProductsPerPublishedRanking:25,liveFreshnessRequired:true,salesClaimsRequireExplicitEvidence:true,establishedBrandsBlockedFromCommercialFunnel:true,paidCallsTriggered:0,purchaseAuthorized:false}
  };
}

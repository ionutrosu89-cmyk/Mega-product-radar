const t=v=>String(v??'').trim();

export const MARKETPLACE_SOURCE_EXPANSION=Object.freeze({
  AMAZON_PUBLIC_RANKINGS:{platform:'AMAZON',role:'RANKING_SEED',signalRole:'DEMAND',access:'PUBLIC_PAGE',status:'READY',rankingEvidence:true,catalogueDiscovery:true,demandEvidence:true,supplyEvidence:false,marketWideEvidence:true,sellerScoped:false,storeScoped:false,credentialsRequired:false,paid:false,autoExecute:false},
  ALIBABA_TOP_RANKING:{platform:'ALIBABA',role:'SUPPLY_DISCOVERY',signalRole:'SUPPLY',access:'PUBLIC_PAGE',status:'READY',rankingEvidence:false,catalogueDiscovery:true,demandEvidence:false,supplyEvidence:true,marketWideEvidence:false,sellerScoped:false,storeScoped:false,credentialsRequired:false,paid:false,autoExecute:false},
  EBAY_BEST_SELLING:{platform:'EBAY',role:'RANKING_SEED',signalRole:'DEMAND',access:'OFFICIAL_API',status:'READY_WITH_CREDENTIALS',rankingEvidence:true,catalogueDiscovery:true,demandEvidence:true,supplyEvidence:false,marketWideEvidence:true,sellerScoped:false,storeScoped:false,credentialsRequired:true,credentialEnv:['EBAY_OAUTH_TOKEN'],paid:false,autoExecute:false},
  EMAG_MARKETPLACE_SELLER_API:{platform:'EMAG',role:'LOCAL_MARKET_SELLER_DATA',signalRole:'ROMANIA_SELLER',access:'OFFICIAL_API',status:'READY_WITH_CREDENTIALS',rankingEvidence:false,catalogueDiscovery:true,demandEvidence:false,supplyEvidence:false,marketWideEvidence:false,sellerScoped:true,storeScoped:false,credentialsRequired:true,credentialEnv:['EMAG_API_USERNAME','EMAG_API_PASSWORD'],paid:false,autoExecute:false},
  EMAG_PUBLIC_MARKET:{platform:'EMAG',role:'ROMANIA_PUBLIC_MARKET_SIGNAL',signalRole:'ROMANIA_MARKET',access:'REVIEWED_PUBLIC_PAGE',status:'REVIEW_REQUIRED',rankingEvidence:false,catalogueDiscovery:true,demandEvidence:true,supplyEvidence:false,marketWideEvidence:true,sellerScoped:false,storeScoped:false,credentialsRequired:false,paid:false,autoExecute:false},
  ALIEXPRESS_OFFICIAL_API:{platform:'ALIEXPRESS',role:'HYBRID_DISCOVERY',signalRole:'DEMAND_SUPPLY_HYBRID',access:'OFFICIAL_API',status:'READY_WITH_APP_ACCESS',rankingEvidence:false,catalogueDiscovery:true,demandEvidence:true,supplyEvidence:true,marketWideEvidence:true,sellerScoped:false,storeScoped:false,credentialsRequired:true,credentialEnv:['ALIEXPRESS_APP_KEY','ALIEXPRESS_APP_SECRET'],paid:false,autoExecute:false},
  SHOPIFY_STOREFRONT:{platform:'SHOPIFY',role:'DTC_STORE_CATALOGUE',signalRole:'DTC_CONFIRMATION',access:'OFFICIAL_API',status:'READY_WITH_STORE_ACCESS',rankingEvidence:false,catalogueDiscovery:true,demandEvidence:false,supplyEvidence:false,marketWideEvidence:false,sellerScoped:false,storeScoped:true,credentialsRequired:true,credentialEnv:['SHOPIFY_STOREFRONT_TOKEN'],paid:false,autoExecute:false},
  ETSY_OPEN_API:{platform:'ETSY',role:'CATALOGUE_DISCOVERY',signalRole:'CATALOGUE',access:'OFFICIAL_API',status:'READY_WITH_APP_ACCESS',rankingEvidence:false,catalogueDiscovery:true,demandEvidence:false,supplyEvidence:false,marketWideEvidence:true,sellerScoped:false,storeScoped:false,credentialsRequired:true,paid:false,autoExecute:false},
  WALMART_CATALOG_SEARCH:{platform:'WALMART',role:'CATALOGUE_DISCOVERY',signalRole:'CATALOGUE',access:'OFFICIAL_API',status:'READY_WITH_CREDENTIALS',rankingEvidence:false,catalogueDiscovery:true,demandEvidence:false,supplyEvidence:false,marketWideEvidence:true,sellerScoped:false,storeScoped:false,credentialsRequired:true,paid:false,autoExecute:false,maxKeywordResults:40},
  ALIEXPRESS_RESEARCH:{platform:'ALIEXPRESS',role:'RESEARCH_ONLY',signalRole:'RESEARCH',access:'UNCONFIRMED',status:'RESEARCH_REQUIRED',rankingEvidence:false,catalogueDiscovery:false,demandEvidence:false,supplyEvidence:false,marketWideEvidence:false,sellerScoped:false,storeScoped:false,credentialsRequired:null,paid:null,autoExecute:false},
  TEMU_RESEARCH:{platform:'TEMU',role:'RESEARCH_ONLY',signalRole:'RESEARCH',access:'UNCONFIRMED',status:'RESEARCH_REQUIRED',rankingEvidence:false,catalogueDiscovery:false,demandEvidence:false,supplyEvidence:false,marketWideEvidence:false,sellerScoped:false,storeScoped:false,credentialsRequired:null,paid:null,autoExecute:false}
});

export function sourceExpansionReadiness(){
  const rows=Object.entries(MARKETPLACE_SOURCE_EXPANSION).map(([key,x])=>({key,...x}));
  return {
    rankingSeeds:rows.filter(x=>x.rankingEvidence===true),
    catalogueDiscovery:rows.filter(x=>x.catalogueDiscovery===true&&!x.rankingEvidence),
    demandSources:rows.filter(x=>x.demandEvidence===true),
    supplySources:rows.filter(x=>x.supplyEvidence===true),
    scopedSources:rows.filter(x=>x.sellerScoped===true||x.storeScoped===true),
    researchOnly:rows.filter(x=>x.role==='RESEARCH_ONLY'),
    automaticExecutionAllowed:false,
    paidCallsTriggered:0
  };
}

export function buildSourceExpansionPlan({rankingTargetPct=70,catalogueTargetPct=30}={}){
  const ranking=Math.max(0,Number(rankingTargetPct)||0),catalogue=Math.max(0,Number(catalogueTargetPct)||0),total=ranking+catalogue||100;
  const ready=sourceExpansionReadiness();
  return {
    allocation:{rankingSeedPct:Number((ranking/total*100).toFixed(1)),catalogueDiscoveryPct:Number((catalogue/total*100).toFixed(1))},
    rankingSources:ready.rankingSeeds.map(x=>x.key),
    catalogueSources:ready.catalogueDiscovery.map(x=>x.key),
    demandSources:ready.demandSources.map(x=>x.key),
    supplySources:ready.supplySources.map(x=>x.key),
    scopedSources:ready.scopedSources.map(x=>x.key),
    researchQueue:ready.researchOnly.map(x=>x.key),
    rule:'RANKINGS_BUILD_TOPS_CATALOGUE_SEARCH_BUILDS_BREADTH_SCOPED_DATA_NEVER_MASQUERADES_AS_MARKET_WIDE',
    executeAutomatically:false,
    purchaseAuthorized:false
  };
}

export function classifySourceObservation({sourceKey,hasExplicitRank=false,claimMarketWide=false}={}){
  const key=t(sourceKey).toUpperCase(),source=MARKETPLACE_SOURCE_EXPANSION[key];
  if(!source)return{ok:false,error:'UNKNOWN_SOURCE'};
  if(hasExplicitRank&&source.rankingEvidence!==true)return{ok:false,error:'SOURCE_NOT_APPROVED_FOR_RANKING'};
  if(claimMarketWide&&source.marketWideEvidence!==true)return{ok:false,error:'SOURCE_NOT_APPROVED_FOR_MARKET_WIDE_CLAIM'};
  return{ok:true,evidenceClass:source.rankingEvidence?'RANKING_OBSERVATION':'CATALOGUE_DISCOVERY_OBSERVATION',salesEvidenceClass:'NOT_VERIFIED_SALES',platform:source.platform,signalRole:source.signalRole,marketWideEvidence:source.marketWideEvidence,purchaseAuthorized:false};
}

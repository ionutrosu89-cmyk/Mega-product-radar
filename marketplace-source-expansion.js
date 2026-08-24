const t=v=>String(v??'').trim();

export const MARKETPLACE_SOURCE_EXPANSION=Object.freeze({
  AMAZON_PUBLIC_RANKINGS:{platform:'AMAZON',role:'RANKING_SEED',access:'PUBLIC_PAGE',status:'READY',rankingEvidence:true,catalogueDiscovery:true,credentialsRequired:false,paid:false,autoExecute:false},
  ALIBABA_TOP_RANKING:{platform:'ALIBABA',role:'RANKING_SEED',access:'PUBLIC_PAGE',status:'READY',rankingEvidence:true,catalogueDiscovery:true,credentialsRequired:false,paid:false,autoExecute:false},
  EBAY_BEST_SELLING:{platform:'EBAY',role:'RANKING_SEED',access:'OFFICIAL_API',status:'READY_WITH_CREDENTIALS',rankingEvidence:true,catalogueDiscovery:true,credentialsRequired:true,paid:false,autoExecute:false},
  ETSY_OPEN_API:{platform:'ETSY',role:'CATALOGUE_DISCOVERY',access:'OFFICIAL_API',status:'READY_WITH_APP_ACCESS',rankingEvidence:false,catalogueDiscovery:true,credentialsRequired:true,paid:false,autoExecute:false},
  WALMART_CATALOG_SEARCH:{platform:'WALMART',role:'CATALOGUE_DISCOVERY',access:'OFFICIAL_API',status:'READY_WITH_CREDENTIALS',rankingEvidence:false,catalogueDiscovery:true,credentialsRequired:true,paid:false,autoExecute:false,maxKeywordResults:40},
  ALIEXPRESS_RESEARCH:{platform:'ALIEXPRESS',role:'RESEARCH_ONLY',access:'UNCONFIRMED',status:'RESEARCH_REQUIRED',rankingEvidence:false,catalogueDiscovery:false,credentialsRequired:null,paid:null,autoExecute:false},
  TEMU_RESEARCH:{platform:'TEMU',role:'RESEARCH_ONLY',access:'UNCONFIRMED',status:'RESEARCH_REQUIRED',rankingEvidence:false,catalogueDiscovery:false,credentialsRequired:null,paid:null,autoExecute:false}
});

export function sourceExpansionReadiness(){
  const rows=Object.entries(MARKETPLACE_SOURCE_EXPANSION).map(([key,x])=>({key,...x}));
  return {
    rankingSeeds:rows.filter(x=>x.rankingEvidence===true),
    catalogueDiscovery:rows.filter(x=>x.catalogueDiscovery===true&&!x.rankingEvidence),
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
    researchQueue:ready.researchOnly.map(x=>x.key),
    rule:'RANKINGS_BUILD_TOPS_CATALOGUE_SEARCH_BUILDS_BREADTH',
    executeAutomatically:false,
    purchaseAuthorized:false
  };
}

export function classifySourceObservation({sourceKey,hasExplicitRank=false}={}){
  const key=t(sourceKey).toUpperCase(),source=MARKETPLACE_SOURCE_EXPANSION[key];
  if(!source)return{ok:false,error:'UNKNOWN_SOURCE'};
  if(hasExplicitRank&&source.rankingEvidence!==true)return{ok:false,error:'SOURCE_NOT_APPROVED_FOR_RANKING'};
  return{ok:true,evidenceClass:source.rankingEvidence?'RANKING_OBSERVATION':'CATALOGUE_DISCOVERY_OBSERVATION',salesEvidenceClass:'NOT_VERIFIED_SALES',platform:source.platform,purchaseAuthorized:false};
}

import {normalizeMarketObservation} from './market-observation-v1.js';
import {isCanonicalProductId} from './domain-contracts-v1.js';

const text=v=>String(v??'').trim();
const upper=v=>text(v).toUpperCase();
const aliasKey=(platform,externalId)=>`${upper(platform)}::${text(externalId)}`;

export function buildExactAliasIndex(aliases=[]){
  const map=new Map();
  for(const a of aliases||[]){
    const platform=upper(a.platform),externalId=text(a.externalId||a.external_id),id=text(a.canonicalProductId||a.canonical_product_id).toLowerCase();
    if(!platform||!externalId||!isCanonicalProductId(id))continue;
    const key=aliasKey(platform,externalId),existing=map.get(key);
    if(existing&&existing!==id){const e=new Error('SOURCE_ALIAS_COLLISION');e.code='SOURCE_ALIAS_COLLISION';e.sourceKey=key;throw e;}
    map.set(key,id);
  }
  return map;
}

const bind=(index,platform,externalId)=>index.get(aliasKey(platform,externalId))||null;
const accept=(input,out,rejected)=>{const n=normalizeMarketObservation(input);if(n.ok)out.push(n.observation);else rejected.push({input,errors:n.errors});};

export function adaptAmazonPublicRankingSnapshot(dataset={},aliases=[]){
  const observations=[],rejected=[],index=buildExactAliasIndex(aliases),observedAt=dataset.generatedAt||dataset.observedAt;
  const surface=upper(dataset.categoryKey||dataset.categoryLabel||'PUBLIC_RANKING_SURFACE');
  for(const pair of dataset.rankPairs||[]){
    const rank=Array.isArray(pair)?pair[0]:pair.rank,asin=Array.isArray(pair)?pair[1]:pair.asin;
    if(!asin){rejected.push({input:pair,errors:['ASIN_REQUIRED']});continue;}
    accept({canonicalProductId:bind(index,'AMAZON',asin),platform:'AMAZON',externalId:asin,observedAt,sourceKey:'AMAZON_PUBLIC_RANKINGS',surface,categoryLabel:dataset.categoryLabel,sourceUrl:dataset.sourceUrl,sourceRank:rank,evidenceClass:'DIRECT_OBSERVED'},observations,rejected);
  }
  return {schemaVersion:'MPR_REAL_DATA_ADAPTER_RESULT_V1',adapter:'AMAZON_PUBLIC_RANKING',observations,rejected,boundCount:observations.filter(x=>x.canonicalProductId).length,unboundCount:observations.filter(x=>!x.canonicalProductId).length,paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false};
}

export function adaptAmazonExplicitBsrSnapshot(dataset={},aliases=[]){
  const observations=[],rejected=[],index=buildExactAliasIndex(aliases),observedAt=dataset.observedAt||dataset.generatedAt;
  for(const row of dataset.observations||[]){
    const asin=text(row.asin);if(!asin){rejected.push({input:row,errors:['ASIN_REQUIRED']});continue;}
    for(const entry of row.bsrEntries||[]){
      const category=text(entry.category);if(!category){rejected.push({input:entry,errors:['BSR_CATEGORY_REQUIRED']});continue;}
      accept({canonicalProductId:bind(index,'AMAZON',asin),platform:'AMAZON',externalId:asin,observedAt,sourceKey:'AMAZON_EXPLICIT_BSR',surface:`BSR_CATEGORY::${category}`,categoryLabel:category,sourceRank:entry.rank,evidenceClass:'DIRECT_OBSERVED'},observations,rejected);
    }
  }
  return {schemaVersion:'MPR_REAL_DATA_ADAPTER_RESULT_V1',adapter:'AMAZON_EXPLICIT_BSR',observations,rejected,boundCount:observations.filter(x=>x.canonicalProductId).length,unboundCount:observations.filter(x=>!x.canonicalProductId).length,paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false};
}

export function adaptAbsoluteProductSnapshot(dataset={},aliases=[],{platform='AMAZON',sourceKey='PUBLIC_PRODUCT_SNAPSHOT',surface='PRODUCT_DETAIL'}={}){
  const observations=[],rejected=[],index=buildExactAliasIndex(aliases),rows=dataset.rows||dataset.products||dataset.items||dataset.observations||[],defaultObservedAt=dataset.observedAt||dataset.generatedAt;
  for(const row of rows){
    const externalId=text(row.externalId||row.asin||row.id),observedAt=row.observedAt||defaultObservedAt;
    if(!externalId){rejected.push({input:row,errors:['EXTERNAL_ID_REQUIRED']});continue;}
    const hasAbsolute=['price','reviewCount','rating','sourceRank','rank'].some(k=>row[k]!==undefined&&row[k]!==null&&row[k]!=='');
    if(!hasAbsolute){rejected.push({input:row,errors:['ABSOLUTE_MARKET_METRIC_REQUIRED','DERIVED_DELTAS_ARE_NOT_OBSERVATIONS']});continue;}
    accept({canonicalProductId:bind(index,platform,externalId),platform,externalId,observedAt,sourceKey,surface,title:row.title,brand:row.brand,seller:row.seller,categoryLabel:row.categoryLabel||row.category,sourceUrl:row.sourceUrl||row.url,price:row.price,currency:row.currency,rating:row.rating,reviewCount:row.reviewCount,sourceRank:row.sourceRank??row.rank,evidenceClass:'DIRECT_OBSERVED'},observations,rejected);
  }
  return {schemaVersion:'MPR_REAL_DATA_ADAPTER_RESULT_V1',adapter:'ABSOLUTE_PRODUCT_SNAPSHOT',observations,rejected,boundCount:observations.filter(x=>x.canonicalProductId).length,unboundCount:observations.filter(x=>!x.canonicalProductId).length,paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false};
}

export const REAL_DATA_ADAPTER_POLICY=Object.freeze({identity:'EXACT_PLATFORM_EXTERNAL_ID_ALIAS_BINDING_ONLY; TITLE_NEVER_BINDS',truth:'ONLY_ABSOLUTE_OBSERVED_METRICS_BECOME_MARKET_OBSERVATIONS; DERIVED_DELTAS_STAY_DERIVED',rank:'CATEGORY_OR_RANKING_SURFACE_IS_PART_OF_SERIES_IDENTITY; NO_PRIMARY_BSR_IS_INVENTED',sales:'NO_VERIFIED_SALES_INFERENCE',spend:'NO_NETWORK_OR_PAID_PROVIDER_EXECUTION'});

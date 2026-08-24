import {seedGlobalProductUniverse,buildUniverseMilestoneStatus,planSourceMix} from './global-product-universe-seeder.js';

function asRaw(record={}){
  return {
    sourceKey:record.sourceKey,externalId:record.externalId,url:record.url,title:record.title,brand:record.brand,seller:record.seller,
    categoryLabel:record.categoryLabel,sourceCategoryId:record.sourceCategoryId,sourceRank:record.sourceRank,price:record.price,currency:record.currency,
    rating:record.rating,reviewCount:record.reviewCount,imageUrl:record.imageUrl,observedAt:record.observedAt
  };
}

export function bridgeCollectorBatches(batches=[]){
  const accepted=[];const batchDiagnostics=[];
  for(const batch of batches||[]){
    const records=Array.isArray(batch?.records)?batch.records:[];
    accepted.push(...records.map(asRaw));
    batchDiagnostics.push({sourceKey:batch?.sourceKey||null,accepted:records.length,rejected:Array.isArray(batch?.rejected)?batch.rejected.length:0});
  }
  const universe=seedGlobalProductUniverse(accepted);
  const counts=universe.stats?.byPlatform||{};
  return {
    batchDiagnostics,
    universe,
    milestone:buildUniverseMilestoneStatus(universe,[1000,5000,10000,50000,100000]),
    sourceMix:planSourceMix({amazon:counts.AMAZON||0,ebay:counts.EBAY||0,alibaba:counts.ALIBABA||0,target:10000}),
    paidCallsTriggered:0,
    externalExecutionTriggered:false,
    purchaseAuthorized:false
  };
}

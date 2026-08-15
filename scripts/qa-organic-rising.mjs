import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile('organic-rising-live.json','utf8'));
const cfg=JSON.parse(await fs.readFile('organic-rising-config.json','utf8'));
const fatal=[];
const degraded=[];
if(!data||data.engine!=='Organic Rising Products')fatal.push('engine');
if(Number(data.maxReviews)!==10)fatal.push('maxReviews');
if(Number(data.maxOrganicPage)!==2)fatal.push('maxOrganicPage');
if(!data.marketStatus||typeof data.marketStatus!=='object')fatal.push('marketStatus');
if(data.qualityPostprocess?.exactListingReviewGate!==true)fatal.push('exactListingReviewGate');
if(data.qualityPostprocess?.missingReviewIsNotZero!==true)fatal.push('missingReviewIsNotZero');
if(data.qualityPostprocess?.categoryRelevanceGate!==true)fatal.push('categoryRelevanceGate');
if(data.qualityPostprocess?.imagePlaceholderFilter!==true)fatal.push('imagePlaceholderFilter');
const markets=Object.values(data.marketStatus||{});
const required=(cfg.markets||[]).filter(m=>m.requiredForOperational!==false);
const optional=(cfg.markets||[]).filter(m=>m.requiredForOperational===false);
if(Number(data.totalObserved||0)<1)fatal.push('noObservedProducts');
if(!markets.length)fatal.push('noMarketStatus');
if(Number(data.successfulPages||0)<4)fatal.push('insufficientLiveMarketplaceCoverage');
for(const m of required){
  const s=data.marketStatus?.[m.key];
  if(!s)fatal.push(`requiredMarket:${m.label||m.key}:missingStatus`);
  else if(Number(s.successful||0)<2||Number(s.items||0)<1)degraded.push(`requiredMarket:${m.label||m.key}:under2pages`);
}
for(const m of optional){const s=data.marketStatus?.[m.key];if(!s||Number(s.successful||0)<2)degraded.push(`optionalMarket:${m.label||m.key}:under2pages`);}
for(const [i,p] of (data.feed||[]).entries()){
  if(p.reviewCount===null||!Number.isInteger(Number(p.reviewCount))||Number(p.reviewCount)>10)fatal.push(`feed[${i}].reviewCount`);
  if(p.reviewStatus!=='OBSERVAT_PE_LISTAREA_SURSA')fatal.push(`feed[${i}].reviewSource`);
  if(Number(p.organicPage)<1||Number(p.organicPage)>2)fatal.push(`feed[${i}].organicPage`);
  if(p.promoted)fatal.push(`feed[${i}].promoted`);
  if(Number(p.observedSellerCount)>Number(data.maxObservedSellers||8))fatal.push(`feed[${i}].sellerGate`);
  if(p.categoryRelevant!==true)fatal.push(`feed[${i}].categoryRelevant`);
  if(p.eligibleForFeed!==true)fatal.push(`feed[${i}].eligibleForFeed`);
  if(p.qualityGate?.exactSourceReview!==true)fatal.push(`feed[${i}].qualityGate`);
  if(p.image&&(/\.svg(?:$|\?)/i.test(p.image)||/01rrzVoKd5L|sprite|transparent|pixel|spacer|loading|placeholder/i.test(p.image)))fatal.push(`feed[${i}].imagePlaceholder`);
}
if(fatal.length)throw new Error(`Organic Rising QA failed: ${[...new Set(fatal)].join(', ')}`);
if(degraded.length)console.warn(`Organic Rising QA DEGRADED EXTERNAL COVERAGE: ${[...new Set(degraded)].join(', ')}. Feed gates remain strict; undercovered marketplaces cannot promote unknown evidence.`);
console.log(`Organic Rising QA passed: feed ${(data.feed||[]).length}, observed ${Number(data.totalObserved||0)}, successful pages ${Number(data.successfulPages||0)}${degraded.length?' · DEGRADED external coverage':''}.`);

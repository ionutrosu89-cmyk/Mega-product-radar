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
const configured=Array.isArray(cfg.markets)?cfg.markets:[];
const foreign=configured.filter(m=>m.kind==='foreign');
const romania=configured.filter(m=>m.kind==='romania');
const op=cfg.operationalPolicy||{};
const minTotal=Number(op.minSuccessfulPagesTotal||4);
const minForeignMarkets=Number(op.minForeignMarkets||1);
const minForeignPages=Number(op.minSuccessfulPagesPerForeignMarket||1);
const minRomaniaPages=Number(op.minRomaniaSuccessfulPages||2);
const requireRomaniaItems=op.requireRomaniaItems!==false;
if(Number(data.totalObserved||0)<1)fatal.push('noObservedProducts');
if(!markets.length)fatal.push('noMarketStatus');
if(Number(data.successfulPages||0)<minTotal)fatal.push('insufficientLiveMarketplaceCoverage');
const healthyForeign=foreign.filter(m=>Number(data.marketStatus?.[m.key]?.successful||0)>=minForeignPages&&Number(data.marketStatus?.[m.key]?.items||0)>0);
const healthyRomania=romania.filter(m=>Number(data.marketStatus?.[m.key]?.successful||0)>=minRomaniaPages&&(!requireRomaniaItems||Number(data.marketStatus?.[m.key]?.items||0)>0));
if(healthyForeign.length<minForeignMarkets)fatal.push(`foreignCoverage:${healthyForeign.length}/${minForeignMarkets}`);
if(romania.length&&healthyRomania.length<1)fatal.push('romaniaCoverage');
for(const m of configured){
  const s=data.marketStatus?.[m.key];
  if(!s||Number(s.successful||0)<1)degraded.push(`market:${m.label||m.key}:noSuccessfulPage`);
}
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
if(degraded.length)console.warn(`Organic Rising QA DEGRADED EXTERNAL COVERAGE: ${[...new Set(degraded)].join(', ')}. Feed gates remain strict; an unavailable marketplace is tolerated only while minimum foreign + Romania coverage remains healthy.`);
console.log(`Organic Rising QA passed: feed ${(data.feed||[]).length}, observed ${Number(data.totalObserved||0)}, successful pages ${Number(data.successfulPages||0)}, foreign healthy ${healthyForeign.map(m=>m.key).join(',')||'none'}, Romania healthy ${healthyRomania.map(m=>m.key).join(',')||'none'}${degraded.length?' · DEGRADED external coverage':''}.`);

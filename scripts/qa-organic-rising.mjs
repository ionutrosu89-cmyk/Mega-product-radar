import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile('organic-rising-live.json','utf8'));
const fatal=[];
const degraded=[];
if(!data||data.engine!=='Organic Rising Products')fatal.push('engine');
if(Number(data.maxReviews)!==10)fatal.push('maxReviews');
if(Number(data.maxOrganicPage)!==2)fatal.push('maxOrganicPage');
if(!data.marketStatus||typeof data.marketStatus!=='object')fatal.push('marketStatus');
const markets=Object.values(data.marketStatus||{});
if(Number(data.totalObserved||0)<1)degraded.push('noObservedProducts');
if(!markets.length)fatal.push('noMarketStatus');
if(Number(data.successfulPages||0)<2)degraded.push('noLiveMarketplaceCoverage');
for(const m of markets){
  if(Number(m.attempted||0)>0&&Number(m.successful||0)<2)degraded.push(`market:${m.label||'unknown'}:under2pages`);
}
for(const [i,p] of (data.feed||[]).entries()){
  if(p.reviewCount===null||!Number.isInteger(Number(p.reviewCount))||Number(p.reviewCount)>10)fatal.push(`feed[${i}].reviewCount`);
  if(Number(p.organicPage)>2)fatal.push(`feed[${i}].organicPage`);
  if(p.promoted)fatal.push(`feed[${i}].promoted`);
  if(Number(p.observedSellerCount)>Number(data.maxObservedSellers||8))fatal.push(`feed[${i}].sellerGate`);
  if(p.image&&(/\.svg(?:$|\?)/i.test(p.image)||/01rrzVoKd5L|sprite|transparent|pixel|spacer/i.test(p.image)))fatal.push(`feed[${i}].imagePlaceholder`);
}
if(fatal.length)throw new Error(`Organic Rising QA failed: ${[...new Set(fatal)].join(', ')}`);
if(degraded.length){
  console.warn(`Organic Rising QA DEGRADED: ${[...new Set(degraded)].join(', ')}. External marketplace coverage is insufficient; strict product gates remain enforced and operational=false must be respected.`);
  process.exit(0);
}
console.log(`Organic Rising QA passed: feed ${(data.feed||[]).length}, observed ${Number(data.totalObserved||0)}, successful pages ${Number(data.successfulPages||0)}.`);
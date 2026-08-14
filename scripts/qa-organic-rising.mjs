import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile('organic-rising-live.json','utf8'));
const errors=[];
if(!data||data.engine!=='Organic Rising Products')errors.push('engine');
if(Number(data.maxReviews)!==10)errors.push('maxReviews');
if(Number(data.maxOrganicPage)!==2)errors.push('maxOrganicPage');
if(!data.marketStatus||typeof data.marketStatus!=='object')errors.push('marketStatus');
for(const [i,p] of (data.feed||[]).entries()){
  if(p.reviewCount===null||!Number.isInteger(Number(p.reviewCount))||Number(p.reviewCount)>10)errors.push(`feed[${i}].reviewCount`);
  if(Number(p.organicPage)>2)errors.push(`feed[${i}].organicPage`);
  if(p.promoted)errors.push(`feed[${i}].promoted`);
  if(Number(p.observedSellerCount)>Number(data.maxObservedSellers||8))errors.push(`feed[${i}].sellerGate`);
  if(p.image&&(/\.svg(?:$|\?)/i.test(p.image)||/01rrzVoKd5L|sprite|transparent|pixel|spacer/i.test(p.image)))errors.push(`feed[${i}].imagePlaceholder`);
}
if(errors.length)throw new Error(`Organic Rising QA failed: ${[...new Set(errors)].join(', ')}`);
console.log(`Organic Rising QA passed: feed ${(data.feed||[]).length}, observed ${Number(data.totalObserved||0)}, successful pages ${Number(data.successfulPages||0)}.`);
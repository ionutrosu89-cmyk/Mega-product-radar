import fs from 'node:fs/promises';
import path from 'node:path';
import {classifyPublicBrandGate} from '../brand-policy-v1.js';

const input=process.argv.find(arg=>arg.startsWith('--input='))?.slice(8)||'artifacts/amazon-niche-slices-latest.json';
const out=process.argv.find(arg=>arg.startsWith('--out='))?.slice(6)||'artifacts/amazon-pilot-triage-latest.json';
const [snapshot,review]=await Promise.all([
  fs.readFile(input,'utf8').then(JSON.parse),
  fs.readFile(new URL('../data/amazon-pilot-title-exclusions-v1.json',import.meta.url),'utf8').then(JSON.parse)
]);
if(snapshot.schema!=='MPR_AMAZON_NICHE_SLICES_LOCAL_V1')throw new Error('Amazon category-slice snapshot required');
if(review.status!=='NO_PRODUCT_APPROVALS')throw new Error('Pilot title review must not approve products');

const exclusions=new Map();
for(const item of review.exclusions){
  const key=`${item.nicheId}|${item.asin}`;
  if(exclusions.has(key)||!review.pilotNicheIds.includes(item.nicheId)||!item.reason)throw new Error(`Invalid or duplicate title exclusion: ${key}`);
  exclusions.set(key,item);
}
const rows=[];
for(const nicheId of review.pilotNicheIds){
  const source=snapshot.results.find(result=>result.nicheId===nicheId);
  if(!source)throw new Error(`Missing pilot niche: ${nicheId}`);
  const top30=source.observations.filter(item=>item.sourceRank>=1&&item.sourceRank<=30);
  if(top30.length!==30||new Set(top30.map(item=>item.sourceRank)).size!==30)throw new Error(`Incomplete first 30 ranks: ${nicheId}`);
  for(const item of top30){
    const brand=classifyPublicBrandGate({name:item.title});
    const exclusion=exclusions.get(`${nicheId}|${item.externalId}`);
    rows.push({nicheId,sourceRank:item.sourceRank,asin:item.externalId,title:item.title,sourceUrl:item.sourceUrl,observedAt:item.observedAt,
      status:brand.brandPolicyClass==='ESTABLISHED_EXCLUDE'?'EXCLUDED_ESTABLISHED_BRAND':exclusion?'EXCLUDED_WRONG_NICHE':'PENDING_BRAND_AND_NICHE_REVIEW',
      reason:brand.brandPolicyClass==='ESTABLISHED_EXCLUDE'?`Established brand phrase: ${brand.matchedBrand}`:exclusion?.reason||'Title alone cannot confirm real brand, niche fit, market demand or supplier identity.'});
  }
}
for(const key of exclusions.keys())if(!rows.some(item=>`${item.nicheId}|${item.asin}`===key))throw new Error(`Title exclusion not found in current top 30: ${key}`);

const counts=Object.fromEntries([...new Set(rows.map(item=>item.status))].map(status=>[status,rows.filter(item=>item.status===status).length]));
const result={schema:'MPR_AMAZON_PILOT_TRIAGE_LOCAL_V1',observedAt:snapshot.observedAt,triagedAt:new Date().toISOString(),market:'AMAZON_US',status:'INTERNAL_NEGATIVE_TRIAGE_NO_APPROVED_PRODUCTS',pilotNicheIds:review.pilotNicheIds,reviewedRankCount:rows.length,counts,approvedCount:0,policy:{titleExclusionsOnly:true,brandUnknownIsNotApproved:true,sourceRankIsNotSales:true,sourceCategoryIsNotNiche:true,publicDisplayRightsNotGranted:true},rows};
const cell=value=>{const raw=String(value??'');return `"${(/^[\s]*[=+\-@]/.test(raw)?`'${raw}`:raw).replace(/"/g,'""')}"`;};
const columns=['nicheId','sourceRank','asin','title','status','reason','sourceUrl','observedAt'];
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(result,null,2));
await fs.writeFile(out.replace(/\.json$/i,'.csv'),[columns.join(','),...rows.map(row=>columns.map(column=>cell(row[column])).join(','))].join('\n')+'\n');
console.log(JSON.stringify({reviewedRankCount:result.reviewedRankCount,counts:result.counts,approvedCount:0,out}));

import fs from 'node:fs/promises';
import path from 'node:path';
import {normalizeCurrentSearchSignal} from '../current-search-product-signal-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(value=>{const [key,...rest]=value.replace(/^--/,'').split('=');return [key,rest.join('=')||true];}));
const out=String(args.out||'artifacts/google-trends-ro-current.json');
const sourceUrl='https://trends.google.com/trending/rss?geo=RO';
const observedAt=new Date().toISOString();

const decode=value=>String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
const tag=(xml,name)=>decode(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'))?.[1]||'');
const approxTraffic=value=>{
  const text=String(value||'').toUpperCase().replace(/[,+\s]/g,'');
  const match=text.match(/^([0-9]+(?:\.[0-9]+)?)([KMB])?$/);if(!match)return null;
  const n=Number(match[1]);const scale=match[2]==='K'?1e3:match[2]==='M'?1e6:match[2]==='B'?1e9:1;
  return Number.isFinite(n)?Math.round(n*scale):null;
};

const response=await fetch(sourceUrl,{headers:{accept:'application/rss+xml,application/xml,text/xml;q=0.9','user-agent':'MegaProductRadar/1.0 current-search-signal'},signal:AbortSignal.timeout(15000)});
if(!response.ok)throw new Error(`GOOGLE_TRENDS_RSS_HTTP_${response.status}`);
const xml=await response.text();
if(!/<rss[\s>]/i.test(xml)||!/<channel[\s>]/i.test(xml))throw new Error('GOOGLE_TRENDS_RSS_INVALID');
const itemMatches=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(match=>match[1]);
if(itemMatches.length<1)throw new Error('GOOGLE_TRENDS_RSS_EMPTY');

const raw=itemMatches.map((item,index)=>{
  const queryText=tag(item,'title');
  const traffic=tag(item,'ht:approx_traffic')||tag(item,'approx_traffic');
  return {queryText,rank:index+1,traffic,searchVolumeLowerBound:approxTraffic(traffic)};
});
const accepted=[];
for(const item of raw){
  const normalized=normalizeCurrentSearchSignal({
    queryText:item.queryText,
    windowDays:1,
    observedAt,
    signalType:'TRENDING_NOW',
    market:'RO',
    sourceKey:'GOOGLE_TRENDS_RSS_RO',
    sourceUrl,
    rank:item.rank,
    searchVolumeLowerBound:item.searchVolumeLowerBound,
    rightsStatus:'APPROVED_OFFICIAL_PUBLIC_EXPORT'
  });
  if(normalized)accepted.push(normalized);
}

const payload={
  schemaVersion:'MPR_GOOGLE_TRENDS_RO_RSS_CURRENT_V1',
  generatedAt:observedAt,
  sourceUrl,
  market:'RO',
  rawTrendCount:raw.length,
  productRelevantCount:accepted.length,
  signals:accepted,
  policy:{providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false,verifiedSales:false,salesEvidenceClass:'SEARCH_INTEREST_NOT_SALES',historicalFallback:false}
};
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(payload,null,2));
console.log(JSON.stringify({rawTrendCount:payload.rawTrendCount,productRelevantCount:payload.productRelevantCount,source:sourceUrl},null,2));

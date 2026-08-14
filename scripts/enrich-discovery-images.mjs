import fs from 'node:fs/promises';

const FILE='discovery-live.json';
const MAX_ENRICH=12;
const TIMEOUT_MS=4500;

const safeHttp=value=>{try{const u=new URL(String(value||''));return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return'';}};

async function fetchPreviewImage(pageUrl=''){
  const source=safeHttp(pageUrl);
  if(!source)return'';
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const res=await fetch(source,{signal:controller.signal,redirect:'follow',headers:{'user-agent':'Mozilla/5.0 MegaProductRadarImageEnricher/1.0','accept':'text/html,application/xhtml+xml','accept-language':'en-US,en;q=0.8'}});
    if(!res.ok)return'';
    const type=res.headers.get('content-type')||'';
    if(!type.includes('text/html')&&!type.includes('application/xhtml+xml'))return'';
    const html=(await res.text()).slice(0,500000);
    const patterns=[
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i
    ];
    for(const re of patterns){
      const m=html.match(re);
      if(!m?.[1])continue;
      const raw=m[1].replace(/&amp;/g,'&').trim();
      try{const u=new URL(raw,res.url);if(['http:','https:'].includes(u.protocol))return u.href;}catch{}
    }
    return'';
  }catch{return'';}finally{clearTimeout(timer);}
}

function candidateSources(product){
  const urls=[];
  const push=u=>{const safe=safeHttp(u);if(safe&&!urls.includes(safe))urls.push(safe);};
  push(product.openDiscovery?.url);
  for(const signal of Object.values(product.signals||{}))for(const link of signal?.links||[])push(link?.url);
  return urls.slice(0,6);
}

const payload=JSON.parse(await fs.readFile(FILE,'utf8'));
const products=Array.isArray(payload.products)?payload.products:[];
let checked=0,enriched=0;
for(const product of products){
  if(enriched>=MAX_ENRICH)break;
  if(safeHttp(product.imageUrl))continue;
  const sources=candidateSources(product);
  if(!sources.length)continue;
  for(const source of sources){
    checked++;
    const imageUrl=await fetchPreviewImage(source);
    if(imageUrl){product.imageUrl=imageUrl;product.imageSourceUrl=source;product.imageCheckedAt=new Date().toISOString();enriched++;break;}
  }
}
payload.imageEnrichment={updatedAt:new Date().toISOString(),checked,enriched,maxPerRun:MAX_ENRICH,policy:'REAL_SOURCE_OG_IMAGE_ONLY'};
await fs.writeFile(FILE,JSON.stringify(payload,null,2)+'\n');
console.log(`Discovery image enrichment: checked ${checked}, enriched ${enriched}.`);

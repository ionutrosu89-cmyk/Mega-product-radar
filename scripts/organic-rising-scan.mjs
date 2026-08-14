import fs from 'node:fs/promises';

const CONFIG='organic-rising-config.json', LIVE='organic-rising-live.json', HISTORY='organic-rising-history.json';
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1 MegaProductRadar/1.0';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const decodeEntities=s=>String(s||'').replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10))).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&nbsp;/g,' ');
const clean=s=>decodeEntities(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
const key=s=>clean(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}

let lastReaderRequestAt=0;
async function directFetch(url){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),12000);
  try{
    const r=await fetch(url,{signal:c.signal,headers:{'user-agent':ua,'accept-language':'en-US,en;q=0.8,ro;q=0.7'}});
    return {ok:r.ok,status:r.status,url:r.url,html:r.ok?await r.text():'',source:'DIRECT'};
  }catch(e){return{ok:false,status:0,url,error:String(e?.message||e),html:'',source:'DIRECT'};}
  finally{clearTimeout(t);}
}
async function readerFetch(url){
  const wait=Math.max(0,3300-(Date.now()-lastReaderRequestAt));
  if(wait)await delay(wait);
  lastReaderRequestAt=Date.now();
  const c=new AbortController(),t=setTimeout(()=>c.abort(),45000);
  try{
    const readerUrl=`https://r.jina.ai/${url}`;
    const r=await fetch(readerUrl,{signal:c.signal,headers:{
      'user-agent':ua,
      'accept-language':'en-US,en;q=0.8,ro;q=0.7',
      'x-respond-with':'html',
      'x-engine':'browser',
      'x-timeout':'25',
      'x-no-cache':'true',
      'x-max-tokens':'50000',
      'x-retain-images':'all'
    }});
    return {ok:r.ok,status:r.status,url,html:r.ok?await r.text():'',source:'JINA_READER'};
  }catch(e){return{ok:false,status:0,url,error:String(e?.message||e),html:'',source:'JINA_READER'};}
  finally{clearTimeout(t);}
}
async function fetchHtml(url){
  const direct=await directFetch(url);
  if(direct.ok&&direct.html.length>1500)return direct;
  const blocked=[0,401,403,407,408,429,451,500,502,503,504,511].includes(Number(direct.status||0));
  if(!blocked&&direct.html.length>1500)return direct;
  const reader=await readerFetch(url);
  if(reader.ok&&reader.html.length>1500)return reader;
  return {...direct,readerStatus:reader.status||0,readerError:reader.error||'',source:'DIRECT+JINA_FAILED'};
}

function first(block,res){for(const re of res){const m=block.match(re);if(m)return clean(m[1]||m[0]);}return'';}
function parseCount(raw){
  const s=String(raw||'').trim().replace(/\s/g,'');
  if(!s)return null;
  const compact=s.replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(/,(?=\d{3}(?:\D|$))/g,'');
  if(/[.,]\d{1,2}$/.test(compact))return null;
  const digits=compact.replace(/[^0-9]/g,'');
  if(!digits)return null;
  const n=Number(digits);
  return Number.isFinite(n)&&Number.isInteger(n)&&n>=0?n:null;
}
function numReview(text,market){
  const html=String(text||'');
  const patterns=market.key.startsWith('amazon')?[
    /href=["'][^"']*(?:customerReviews|product-reviews)[^"']*["'][^>]*>[\s\S]{0,220}?<span[^>]*>([\d.,\s]+)<\/span>/i,
    /class=["'][^"']*s-underline-text[^"']*["'][^>]*>([\d.,\s]+)<\/span>/i,
    /aria-label=["']([\d.,\s]+)\s+(?:ratings?|reviews?)["']/i
  ]:market.key.startsWith('ebay')?[
    /([\d.,\s]+)\s+(?:product\s+ratings?|ratings?|reviews?)/i,
    /class=["'][^"']*(?:reviews?|rating-count)[^"']*["'][^>]*>\s*([\d.,\s]+)/i
  ]:[
    /([\d.,\s]+)\s+(?:review-uri|reviewuri|recenzii|evaluări|evaluari)/i,
    /class=["'][^"']*(?:review-count|rating-count)[^"']*["'][^>]*>\s*([\d.,\s]+)/i
  ];
  for(const re of patterns){const m=html.match(re);if(!m)continue;const n=parseCount(m[1]);if(n!==null)return n;}
  return null;
}
function hrefFrom(block,base){const m=block.match(/<a[^>]+href=["']([^"'#]+)["']/i);if(!m)return'';try{return new URL(decodeEntities(m[1]),base).href;}catch{return'';}}
function validImage(u){const s=decodeEntities(u).trim();if(!/^https?:\/\//i.test(s))return false;if(/\.svg(?:$|\?)/i.test(s)||/sprite|transparent|pixel|spacer|01rrzVoKd5L|loading|placeholder/i.test(s))return false;return /\.(?:jpe?g|png|webp)(?:$|\?)/i.test(s)||/m\.media-amazon\.com\/images\/I\//i.test(s);}
function imgFrom(block){
  const attrs=[...String(block).matchAll(/<img[^>]+(?:src|data-src|srcset)=["']([^"']+)["']/gi)].flatMap(m=>decodeEntities(m[1]).split(',').map(x=>x.trim().split(/\s+/)[0]));
  return attrs.find(validImage)||'';
}
function blocks(html,market){if(market.key.startsWith('amazon'))return html.split(/(?=<div[^>]+data-component-type=["']s-search-result["'])/i).slice(1);if(market.key.startsWith('ebay'))return html.split(/(?=<li[^>]+class=["'][^"']*s-item[^"']*["'])/i).slice(1);if(market.key==='emagRO')return html.split(/(?=<div[^>]+class=["'][^"']*(?:card-item|product|card-v2)[^"']*["'])/i).slice(1);return[];}
function pageCapacity(market){if(market.key.startsWith('amazon'))return 48;if(market.key.startsWith('ebay'))return 60;return 60;}
function parseBlock(block,market,rank,page,base){
  const sponsored=/\bSponsored\b|\bPromoted\b|\bpromovat\b|\bsponsorizat\b/i.test(clean(block).slice(0,2400));
  let title='';
  if(market.key.startsWith('amazon'))title=first(block,[/<h2[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i,/class=["'][^"']*a-size-base-plus[^"']*["'][^>]*>([\s\S]*?)<\//i]);
  else if(market.key.startsWith('ebay'))title=first(block,[/class=["'][^"']*s-item__title[^"']*["'][^>]*>([\s\S]*?)<\//i,/class=["'][^"']*s-item__title--tagblock[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i]);
  else title=first(block,[/class=["'][^"']*(?:card-v2-title|product-title|card-item-title)[^"']*["'][^>]*>([\s\S]*?)<\//i,/<a[^>]+title=["']([^"']+)["']/i]);
  if(!title||title.length<8||/Shop on eBay|Results|Sponsored/i.test(title))return null;
  return {title,url:hrefFrom(block,base),image:imgFrom(block),reviewCount:numReview(block,market),sponsored,organicRank:rank,page,market:market.key,marketLabel:market.label};
}
async function scanPage(market,query,page){
  let url;
  if(market.key.startsWith('amazon'))url=`${market.base}${encodeURIComponent(query)}&page=${page}`;
  else if(market.key.startsWith('ebay'))url=`${market.base}${encodeURIComponent(query)}&_pgn=${page}`;
  else url=`${market.base}${encodeURIComponent(query)}?ref=effective_search&page[limit]=60&page[offset]=${(page-1)*60}`;
  const r=await fetchHtml(url);
  if(!r.ok)return{ok:false,status:r.status,url,items:[],error:r.error||r.readerError||'',source:r.source||'UNKNOWN',readerStatus:r.readerStatus||0};
  const raw=blocks(r.html,market),items=[];let organic=0;
  for(const b of raw.slice(0,90)){
    const sponsored=/\bSponsored\b|\bPromoted\b|\bpromovat\b|\bsponsorizat\b/i.test(clean(b).slice(0,2400));
    if(!sponsored)organic++;
    const globalRank=(page-1)*pageCapacity(market)+organic,x=parseBlock(b,market,globalRank,page,url);
    if(x&&!x.sponsored)items.push(x);
  }
  return{ok:true,status:r.status,url,items,source:r.source||'UNKNOWN'};
}
function similar(a,b){const A=new Set(key(a).split(' ').filter(x=>x.length>2)),B=new Set(key(b).split(' ').filter(x=>x.length>2));if(!A.size||!B.size)return false;let i=0;for(const x of A)if(B.has(x))i++;return i/Math.min(A.size,B.size)>=0.65;}
function historyDelta(points,rank,market){const prev=[...points].reverse().find(p=>p.sourceMarket===market&&Number.isFinite(p.organicRank));return prev?prev.organicRank-rank:null;}
function score(x,maxReviews=10){let s=0;if(x.reviewCount!==null&&x.reviewCount<=maxReviews)s+=25;else if(x.reviewCount!==null&&x.reviewCount<=25)s+=8;if(x.organicPage===1)s+=20;else if(x.organicPage===2)s+=12;if(x.observedSellerCount<=3)s+=15;else if(x.observedSellerCount<=8)s+=8;if(x.crossMarketCount>=3)s+=18;else if(x.crossMarketCount===2)s+=12;if(x.rankDelta!==null){if(x.rankDelta>=15)s+=20;else if(x.rankDelta>=5)s+=12;else if(x.rankDelta>0)s+=6;else if(x.rankDelta<=-10)s-=10;}else s+=6;if(x.romaniaCompetition<=3)s+=15;else if(x.romaniaCompetition<=8)s+=8;if(x.daysSinceFirstSeen<=14)s+=8;else if(x.daysSinceFirstSeen<=30)s+=4;if(x.image)s+=2;return clamp(s);}

const cfg=await readJson(CONFIG,{categories:[],markets:[]}),old=await readJson(LIVE,{products:[]}),history=await readJson(HISTORY,{version:'1.0',products:{}});
const slot=Math.floor(Date.now()/(6*3600*1000)),category=cfg.categories[slot%Math.max(1,cfg.categories.length)]||cfg.categories[0],queries=category?.queries||[],all=[];
let successfulPages=0;const marketStatus={};
for(const q of queries){
  for(const m of cfg.markets){
    marketStatus[m.key]=marketStatus[m.key]||{label:m.label,attempted:0,successful:0,items:0,statuses:[],sources:[]};
    for(let page=1;page<=cfg.maxOrganicPage;page++){
      const r=await scanPage(m,q,page);
      marketStatus[m.key].attempted++;
      marketStatus[m.key].statuses.push(r.status||0);
      marketStatus[m.key].sources.push(r.source||'UNKNOWN');
      if(r.ok){successfulPages++;marketStatus[m.key].successful++;marketStatus[m.key].items+=r.items.length;}
      for(const item of r.items.slice(0,cfg.maxProductsPerMarketQuery||60))all.push({...item,query:q,category:category?.name||'General',fetchSource:r.source||'UNKNOWN'});
      await delay(250);
    }
  }
}
const groups=[];
for(const item of all){let g=groups.find(x=>similar(x.title,item.title));if(!g){g={title:item.title,category:item.category,query:item.query,items:[]};groups.push(g);}g.items.push(item);}
const previous=new Map((old.products||[]).map(p=>[p.key,p]));const now=new Date().toISOString(),products=[];
for(const g of groups){
  const foreign=g.items.filter(i=>i.market!=='emagRO'),ro=g.items.filter(i=>i.market==='emagRO');if(!foreign.length)continue;
  const best=[...foreign].sort((a,b)=>a.organicRank-b.organicRank)[0],k=key(g.title),points=history.products?.[k]?.points||[],rankDelta=historyDelta(points,best.organicRank,best.market),marketKeys=[...new Set(foreign.map(i=>i.market))],reviewKnown=foreign.filter(i=>i.reviewCount!==null).map(i=>i.reviewCount),reviewCount=reviewKnown.length?Math.min(...reviewKnown):null,observedSellerCount=Math.max(1,foreign.length),romaniaCompetition=ro.length,firstSeenAt=previous.get(k)?.firstSeenAt||now,daysSinceFirstSeen=Math.max(0,Math.floor((Date.now()-new Date(firstSeenAt).getTime())/86400000));
  const eligibleReview=reviewCount!==null&&Number.isInteger(reviewCount)&&reviewCount<=Number(cfg.maxReviews||10),eligibleSellers=observedSellerCount<=Number(cfg.maxObservedSellers||8),eligiblePage=best.page<=Number(cfg.maxOrganicPage||2);
  const p={key:k,name:clean(g.title),category:g.category,query:g.query,firstSeenAt,lastSeenAt:now,daysSinceFirstSeen,newnessStatus:'PRIMA_APARITIE_OBSERVATA_DE_RADAR',image:best.image||foreign.find(i=>i.image)?.image||'',sourceUrl:best.url,sourceMarket:best.marketLabel,sourceMarketKey:best.market,organicRank:best.organicRank,organicPage:best.page,reviewCount,reviewStatus:reviewCount===null?'NECUNOSCUT':'OBSERVAT',promoted:false,observedSellerCount,sellerCountStatus:'PROXY_DIN_LISTARI_SIMILARE',crossMarketCount:marketKeys.length,markets:marketKeys,romaniaCompetition,romaniaCompetitionStatus:'PROXY_DIN_REZULTATE_EMAG',rankDelta,rankStatus:rankDelta===null?'ISTORIC_INSUFICIENT':'COMPARAT_CU_ACELASI_MARKETPLACE',eligibleForFeed:eligibleReview&&eligibleSellers&&eligiblePage,evidence:g.items.slice(0,12),validation:'Poziția este observată în primele 2 pagini publice ale marketplace-ului. Când accesul direct din GitHub este blocat, aceeași pagină este randată prin Jina Reader și ordinea DOM rezultată este folosită ca poziție observată. Sponsored/Promoted este exclus când marcajul este detectabil. Review-urile sunt acceptate doar ca număr întreg asociat explicit cu reviews/ratings, nu ca scor de stele. Sellerii și competiția RO sunt proxy-uri din listări similare, nu număr comercial verificat.'};
  p.organicRiseScore=score(p,Number(cfg.maxReviews||10));
  p.signal=!p.eligibleForFeed?'⚪ NU TRECE GATE-UL':p.organicRiseScore>=80?'🔥 URCARE PUTERNICĂ':p.organicRiseScore>=65?'🟢 PROMIȚĂTOR':p.organicRiseScore>=55?'🟡 DE URMĂRIT':'⚪ SLAB';
  products.push(p);
  const next=[...points,{at:now,sourceMarket:best.market,organicRank:p.organicRank,page:p.organicPage,reviewCount:p.reviewCount,score:p.organicRiseScore,markets:p.crossMarketCount,romaniaCompetition:p.romaniaCompetition}].slice(-40);
  history.products=history.products||{};history.products[k]={name:p.name,points:next};
}
products.sort((a,b)=>Number(b.eligibleForFeed)-Number(a.eligibleForFeed)||b.organicRiseScore-a.organicRiseScore||((b.rankDelta||0)-(a.rankDelta||0)));
history.version='1.3';history.updatedAt=now;
const threshold=Number(cfg.minScoreForFeed||55),feed=products.filter(p=>p.eligibleForFeed&&p.organicRiseScore>=threshold).slice(0,30),payload={version:'1.3',engine:'Organic Rising Products',updatedAt:now,category:category?.name||null,queries,successfulPages,marketStatus,totalObserved:all.length,totalClusters:groups.length,feedThreshold:threshold,maxReviews:Number(cfg.maxReviews||10),maxOrganicPage:Number(cfg.maxOrganicPage||2),maxObservedSellers:Number(cfg.maxObservedSellers||8),products:products.slice(0,120),feed,policy:'Gate obligatoriu: review-uri observate și validate ca număr întreg <=10, poziție organică în max. pagina 2 și competiție observată redusă. Accesul direct este preferat; Jina Reader este fallback de randare pentru aceeași pagină când marketplace-ul blochează IP-ul GitHub. Ratingul în stele nu este acceptat ca număr de review-uri. Câmpurile necunoscute nu sunt inventate.'};
await Promise.all([fs.writeFile(LIVE,JSON.stringify(payload,null,2)+'\n'),fs.writeFile(HISTORY,JSON.stringify(history,null,2)+'\n')]);
console.log(`Organic Rising v1.3: ${category?.name||'General'}; pages ${successfulPages}; observed ${all.length}; clusters ${groups.length}; eligible ${products.filter(p=>p.eligibleForFeed).length}; feed ${feed.length}.`,JSON.stringify(marketStatus));

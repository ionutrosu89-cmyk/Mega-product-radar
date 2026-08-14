import fs from 'node:fs/promises';

const LIVE='organic-rising-live.json';
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1 MegaProductRadar/1.0';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const read=async(path,fallback)=>{try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}};
const decode=s=>String(s||'').replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10))).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&nbsp;/g,' ');
function parseCount(raw){if(raw===null||raw===undefined)return null;const s=String(raw).trim().replace(/\s/g,'');if(!s)return null;const compact=s.replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(/,(?=\d{3}(?:\D|$))/g,'');if(/[.,]\d{1,2}$/.test(compact))return null;const digits=compact.replace(/[^0-9]/g,'');if(!digits)return null;const n=Number(digits);return Number.isInteger(n)&&n>=0?n:null;}
function reviewCountFromPage(html=''){
  const src=decode(html);
  const patterns=[
    /data-hook=["']total-review-count["'][^>]*>\s*([\d.,\s]+)/i,
    /id=["']acrCustomerReviewText["'][^>]*>\s*([\d.,\s]+)\s+(?:ratings?|reviews?)/i,
    /([\d.,\s]+)\s+(?:global\s+ratings?|ratings?|reviews?)\b/i,
    /aria-label=["'][^"']*?([\d.,\s]+)\s+(?:ratings?|reviews?)["']/i,
    /([\d.,\s]+)\s+(?:recensioni|valutazioni|recenzii|evaluări|evaluari)\b/i
  ];
  for(const re of patterns){const m=src.match(re);if(!m)continue;const n=parseCount(m[1]);if(n!==null)return n;}
  return null;
}
async function fetchText(url,timeout=18000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,redirect:'follow',headers:{'user-agent':ua,'accept-language':'en-US,en;q=0.9,ro;q=0.7'}});return r.ok?await r.text():'';}catch{return'';}finally{clearTimeout(t);}}
async function fetchProductPage(url){
  if(!/^https?:\/\//i.test(String(url||'')))return{html:'',source:'NONE'};
  const direct=await fetchText(url);if(direct.length>2500)return{html:direct,source:'DIRECT'};
  const reader=await fetchText(`https://r.jina.ai/${url}`,30000);if(reader.length>1200)return{html:reader,source:'JINA_READER'};
  return{html:'',source:'FAILED'};
}
function exactEvidence(p){const list=Array.isArray(p.evidence)?p.evidence:[];return list.find(e=>String(e.url||'')===String(p.sourceUrl||''))||null;}
const data=await read(LIVE,{products:[]});const products=Array.isArray(data.products)?data.products:[];
const candidates=products.filter(p=>p&&p.sourceUrl&&p.promoted!==true&&Number(p.organicPage||99)<=2&&Number(p.observedSellerCount||99)<=8).sort((a,b)=>Number(a.organicRank||999)-Number(b.organicRank||999)).slice(0,24);
let attempted=0,enriched=0;
for(const p of candidates){const e=exactEvidence(p);if(e&&Number.isInteger(Number(e.reviewCount))&&e.reviewCount!==null)continue;attempted++;const r=await fetchProductPage(p.sourceUrl);const n=reviewCountFromPage(r.html);p.reviewPageSource=r.source;if(n!==null){p.reviewCount=n;p.reviewStatus='OBSERVAT_PE_PAGINA_PRODUS';if(e)e.reviewCount=n;enriched++;}await delay(450);}
data.products=products;data.reviewEnrichment={version:'1.0',at:new Date().toISOString(),attempted,enriched,policy:'Numărul de review-uri lipsă din pagina de rezultate este verificat suplimentar pe pagina exactă a produsului. Lipsa dovezii rămâne NECUNOSCUT.'};
await fs.writeFile(LIVE,JSON.stringify(data,null,2)+'\n');
console.log(`Organic Rising review enrich: ${enriched}/${attempted} produse completate.`);

import fs from 'node:fs/promises';
import { discoveryScore, suggestedDiscoveryStage } from '../discovery-engine.js';

const CATALOGUE_FILE='discovery-catalogue.json',LIVE_FILE='discovery-live.json',RADAR_FILE='radar-live.json',MAX_SCAN=10,MAX_INBOX=100;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const slug=s=>clean(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const n=(v,min=0,max=10000)=>{const x=Number(v);return Number.isFinite(x)?Math.max(min,Math.min(max,x)):0};
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
function landedEstimate(p){const mid=(n(p.chinaMin)+n(p.chinaMax))/2;return Math.round((mid+Math.max(12,mid*.55)+3)*100)/100;}
const markets=[
  {key:'amazonDE',domain:'amazon.de',kind:'foreign',label:'Amazon DE'},
  {key:'allegroPL',domain:'allegro.pl',kind:'foreign',label:'Allegro PL'},
  {key:'trendyolTR',domain:'trendyol.com',kind:'foreign',label:'Trendyol TR'},
  {key:'emagRO',domain:'emag.ro',kind:'romania',label:'eMAG RO'},
  {key:'alibabaCN',domain:'alibaba.com',kind:'china',label:'Alibaba'},
  {key:'1688CN',domain:'1688.com',kind:'china',label:'1688'},
  {key:'tiktok',domain:'tiktok.com',kind:'social',label:'TikTok'},
  {key:'pinterest',domain:'pinterest.com',kind:'social',label:'Pinterest'},
  {key:'youtube',domain:'youtube.com',kind:'social',label:'YouTube'}
];
async function ddgQuery(term,market){const url=`https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:${market.domain} "${term}"`)}`,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);try{const res=await fetch(url,{signal:controller.signal,headers:{'user-agent':'Mozilla/5.0 MegaProductRadarDiscovery/5.0','accept-language':'en-US,en;q=0.8'}});if(!res.ok)return{ok:false,present:false,resultCount:0,status:res.status};const html=await res.text(),resultCount=(html.match(/result__a/g)||[]).length+(html.match(/result-link/g)||[]).length;return{ok:true,present:resultCount>0&&html.toLowerCase().includes(market.domain),resultCount:Math.min(10,resultCount)};}catch(error){return{ok:false,present:false,resultCount:0,error:String(error?.message||error).slice(0,120)};}finally{clearTimeout(timer);}}
function sourcingLinks(name){const q=encodeURIComponent(name);return[{market:'Alibaba',url:`https://www.alibaba.com/trade/search?SearchText=${q}`,verified:false},{market:'1688',url:`https://s.1688.com/selloffer/offer_search.htm?keywords=${q}`,verified:false}];}

const catalogue=await readJson(CATALOGUE_FILE,[]),radar=await readJson(RADAR_FILE,{products:[]}),old=await readJson(LIVE_FILE,{products:[]}),radarNames=new Set((radar.products||[]).map(p=>slug(p.name))),oldByName=new Map((old.products||[]).map(p=>[slug(p.name),p])),eligible=catalogue.filter(p=>!radarNames.has(slug(p.name))),day=Math.floor(Date.now()/86400000);
const ordered=[...eligible].sort((a,b)=>slug(a.name).localeCompare(slug(b.name))),start=ordered.length?(day*MAX_SCAN)%ordered.length:0,selected=[];
for(let i=0;i<Math.min(MAX_SCAN,ordered.length);i++)selected.push(ordered[(start+i)%ordered.length]);
let successfulChecks=0;
for(const seed of selected){const term=clean(seed.name),results=await Promise.all(markets.map(m=>ddgQuery(term,m))),signals={};let checks=0,foreignPresence=0,romaniaPresence=0,chinaPresence=0,socialPresence=0,foreignResults=0,romaniaResults=0,chinaResults=0,socialResults=0;
  results.forEach((r,i)=>{const m=markets[i];signals[m.key]={label:m.label,ok:!!r.ok,present:!!r.present,resultCount:Number(r.resultCount||0)};if(r.ok){checks++;successfulChecks++;}if(r.present){if(m.kind==='foreign')foreignPresence++;else if(m.kind==='romania')romaniaPresence++;else if(m.kind==='china')chinaPresence++;else if(m.kind==='social')socialPresence++;}if(m.kind==='foreign')foreignResults+=Number(r.resultCount||0);else if(m.kind==='romania')romaniaResults+=Number(r.resultCount||0);else if(m.kind==='china')chinaResults+=Number(r.resultCount||0);else if(m.kind==='social')socialResults+=Number(r.resultCount||0);});
  const candidate={...seed,landedEstimate:landedEstimate(seed),checkedAt:new Date().toISOString(),checks,foreignPresence,romaniaPresence,chinaPresence,socialPresence,foreignResults,romaniaResults,chinaResults,socialResults,signals,sourcing:sourcingLinks(seed.name),sourceType:'DISCOVERY_POOL + LIVE WEB VALIDATION',validation:'Counts are web-search proxies. Sales, seller counts, supplier terms, MOQ, certifications and exact prices are not verified.'};
  const analysis=discoveryScore(candidate);candidate.discoveryAnalysis=analysis;candidate.suggestedStage=suggestedDiscoveryStage(candidate);candidate.sourceStatus=analysis.quality.level==='LIVE'?'WEB_SIGNAL':'PARTIAL';candidate.evidence=`${foreignPresence} piețe externe prezente • ${chinaPresence} surse China prezente • ${romaniaPresence} semnal RO • ${socialPresence} semnale social. Proxy web, nu volum de vânzări.`;
  oldByName.set(slug(seed.name),{...(oldByName.get(slug(seed.name))||{}),...candidate,firstDiscoveredAt:oldByName.get(slug(seed.name))?.firstDiscoveredAt||candidate.checkedAt});
  await delay(250);
}
const products=[...oldByName.values()].filter(p=>!radarNames.has(slug(p.name))).sort((a,b)=>Number(b.discoveryAnalysis?.score||0)-Number(a.discoveryAnalysis?.score||0)).slice(0,MAX_INBOX),payload={version:'5.0',engine:'Product Discovery Engine 5.0',updatedAt:new Date().toISOString(),scanSize:selected.length,successfulChecks,validation:'Discovery uses a broad rotating candidate universe plus current web-presence validation. Results are candidates, not verified sales claims.',products};
await fs.writeFile(LIVE_FILE,JSON.stringify(payload,null,2)+'\n');
console.log(`Product Discovery 5.0: scanned ${selected.length}, successful checks ${successfulChecks}, inbox ${products.length}.`);

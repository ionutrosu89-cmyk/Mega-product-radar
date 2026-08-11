import fs from 'node:fs/promises';

const FILE='radar-live.json';
const MAX_PRODUCTS=6;
const delay=ms=>new Promise(r=>setTimeout(r,ms));

async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
function clean(s){return String(s||'').replace(/\s+/g,' ').trim();}
function slug(s){return clean(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}

const markets=[
  {key:'amazonDE',label:'Amazon DE',domain:'amazon.de',weight:2},
  {key:'allegroPL',label:'Allegro PL',domain:'allegro.pl',weight:2},
  {key:'trendyolTR',label:'Trendyol TR',domain:'trendyol.com',weight:1},
  {key:'emagRO',label:'eMAG RO',domain:'emag.ro',weight:-2},
  {key:'alibabaCN',label:'Alibaba CN',domain:'alibaba.com',weight:2}
];

async function ddgPresence(name,market){
  const q=`site:${market.domain} "${name}"`;
  const url=`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  try{
    const res=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 MegaProductRadar/1.0','accept-language':'en-US,en;q=0.8'}});
    if(!res.ok)return{ok:false,present:false,status:res.status};
    const html=await res.text();
    const resultCount=(html.match(/result__a/g)||[]).length+(html.match(/result-link/g)||[]).length;
    const domainMention=html.toLowerCase().includes(market.domain.toLowerCase());
    return{ok:true,present:resultCount>0&&domainMention,resultCount:Math.min(resultCount,10),query:q};
  }catch(error){return{ok:false,present:false,error:String(error?.message||error).slice(0,120)};}
}

const live=await readJson(FILE,{live:false,products:[]});
if(!Array.isArray(live.products)||!live.products.length){
  console.log('Market scout: no live products yet; nothing to enrich.');
  process.exit(0);
}

const candidates=live.products.filter(p=>/IPOTEZĂ AI LOCALĂ|CANDIDAT LIVE|PARTIAL/i.test(`${p.status||''} ${p.sourceStatus||''}`)).slice(0,MAX_PRODUCTS);
if(!candidates.length){
  console.log('Market scout: no new AI candidates requiring live signals.');
  process.exit(0);
}

const updates=new Map();
for(const product of candidates){
  const signals={};
  let foreign=0,romania=0,sourcing=0,delta=0,checks=0;
  for(const market of markets){
    const result=await ddgPresence(product.name,market);
    signals[market.key]={label:market.label,present:!!result.present,resultCount:Number(result.resultCount||0),ok:!!result.ok};
    if(result.ok)checks++;
    if(result.present){
      if(market.key==='emagRO')romania++;
      else if(market.key==='alibabaCN')sourcing++;
      else foreign++;
      delta+=market.weight;
    }
    await delay(650);
  }
  const signalScore=Math.max(0,Math.min(100,50+foreign*10+sourcing*12-romania*14));
  const adjusted=Math.max(0,Math.min(100,Math.round(Number(product.score||0)+Math.max(-6,Math.min(6,delta)))));
  const positives=Object.values(signals).filter(x=>x.present).map(x=>x.label);
  const note=checks?`Semnale web gratuite: ${positives.length?positives.join(', '):'fără rezultate suficient de clare'}. Acestea indică doar prezență în rezultate de căutare, nu vânzări sau volum.`:'Scout web indisponibil la această rulare; necesită validare manuală.';
  updates.set(slug(product.name),{
    ...product,
    score:adjusted,
    marketScout:{checkedAt:new Date().toISOString(),checks,foreignPresence:foreign,romaniaPresence:romania,chinaSourcingPresence:sourcing,signalScore,signals},
    sourceStatus:checks>=3&&foreign>=1?'WEB_SIGNAL':'PARTIAL',
    status:checks>=3&&foreign>=1?'SEMNAL WEB + AI':'IPOTEZĂ AI LOCALĂ',
    evidence:`${clean(product.evidence)} | ${note}`
  });
}

live.products=live.products.map(p=>updates.get(slug(p.name))||p).sort((a,b)=>Number(b.score||0)-Number(a.score||0));
live.marketScoutUpdatedAt=new Date().toISOString();
live.marketScoutProducts=updates.size;
await fs.writeFile(FILE,JSON.stringify(live,null,2)+'\n');
console.log(`Market scout: enriched ${updates.size} products with best-effort live search signals.`);

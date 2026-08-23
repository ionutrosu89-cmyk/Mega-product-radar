import fs from 'node:fs/promises';
import {roProductName} from '../product-ro.js';

const MARKET='market-intelligence-live.json';
const CACHE='dataforseo-cache.json';
const ttlDays=Math.max(1,Number(process.env.DATAFORSEO_CACHE_TTL_DAYS||7)||7);
const now=new Date();

const SPECIAL_VARIANTS={
  'Under desk headphone hanger clamp':['suport căști','suport căști birou','suport căști sub birou','suport căști cu clemă'],
  'Car sunglasses magnetic visor holder':['suport ochelari auto','suport ochelari parasolar','suport magnetic ochelari','suport ochelari mașină'],
  'Car trunk side storage net':['organizator portbagaj auto','plasă portbagaj auto','plasă depozitare portbagaj','plasă laterală portbagaj'],
  'Reusable furniture moving sliders kit':['mutare mobilă','glisiere mobilă','discuri mobilă','mutat mobilă'],
  'Car headrest hidden hook premium':['cârlig tetieră auto','cârlig auto tetieră','suport tetieră auto','cârlig scaun auto'],
  'Shoe washing laundry bag structured':['sac spălat adidași','sac spălat pantofi','husă spălat pantofi','pantofi mașina de spălat'],
  'Kids bed bedside organizer felt':['organizator pat','buzunar pat','organizator pat copii','buzunar lateral pat'],
  'Desk drawer organizer modular trays':['organizator sertar','organizator sertar birou','separatoare sertar','tăvi organizare sertar'],
  'Shower corner shelf adhesive no drill':['raft baie','raft duș','etajeră baie','raft colț baie'],
  'Dog car door protector set':['protecție portieră auto','protecție portieră câine','husă portieră auto','protecție ușă mașină câine'],
  'Kids car seat snack tray age 3 plus':['tavă copii mașină','tavă scaun auto copii','măsuță auto copii','tavă călătorie copii'],
  'Kids portable drawing board storage bag':['tablă desen copii','tablă copii','tablă portabilă copii','geantă desen copii'],
  'Kids visual timer board non electronic':['timer copii','timer vizual copii','ceas vizual copii','ceas copii timp'],
  'Car cup holder expander adjustable':['suport pahar auto','suport pahare auto','adaptor suport pahar','suport cană auto']
};

function clean(value=''){return String(value||'').replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,80);}
function key(value=''){return clean(value).toLocaleLowerCase('ro-RO');}
function num(v){return Number.isFinite(Number(v))?Number(v):null;}
function fresh(row){const at=new Date(row?.checkedAt||0);return Number.isFinite(at.getTime())&&now-at<ttlDays*86400000;}
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}

function variants(product){
  const ro=clean(roProductName(product?.name||''));
  return [...(SPECIAL_VARIANTS[product?.name]||[]),ro].map(clean).filter(Boolean);
}

const data=await readJson(MARKET,null);
const cache=await readJson(CACHE,{keywords:{}});
if(!data||!Array.isArray(data.products)){
  console.log('Romania cache replay: market dataset missing; skipped.');
  process.exit(0);
}

let replayedRows=0,replayedProducts=0;
for(const product of data.products){
  const rows=[];
  const seen=new Set();
  for(const variant of variants(product)){
    const k=key(variant);
    if(!k||seen.has(k))continue;
    seen.add(k);
    const row=cache?.keywords?.[k];
    if(!row||!fresh(row))continue;
    rows.push({
      keyword:row.keyword||variant,
      searchVolume:num(row.searchVolume??row.search_volume),
      competition:row.competition||null,
      competitionIndex:num(row.competitionIndex??row.competition_index),
      cpc:num(row.cpc),
      lowTopOfPageBid:num(row.lowTopOfPageBid??row.low_top_of_page_bid),
      highTopOfPageBid:num(row.highTopOfPageBid??row.high_top_of_page_bid),
      monthlySearches:Array.isArray(row.monthlySearches)?row.monthlySearches:Array.isArray(row.monthly_searches)?row.monthly_searches:[],
      provider:'DATAFORSEO_GOOGLE_ADS_CACHE',
      checkedAt:row.checkedAt
    });
  }
  if(!rows.length)continue;
  rows.sort((a,b)=>(b.searchVolume||0)-(a.searchVolume||0));
  product.providerIntelligence={...(product.providerIntelligence||{}),romaniaKeywords:rows.slice(0,8)};
  const best=rows[0];
  product.keywordDemand={...(product.keywordDemand||{}),provider:best.provider,verifiedSearchVolume:best.searchVolume!==null,keyword:best.keyword,searchVolume:best.searchVolume,competition:best.competition,competitionIndex:best.competitionIndex,cpc:best.cpc,lowTopOfPageBid:best.lowTopOfPageBid,highTopOfPageBid:best.highTopOfPageBid,monthlySearches:best.monthlySearches,checkedAt:best.checkedAt,note:'Fresh Romania keyword evidence replayed from already-paid DataForSEO cache; no new provider call.'};
  replayedRows+=rows.length;
  replayedProducts++;
}

data.providerReadiness={...(data.providerReadiness||{}),romaniaCacheReplay:{version:'1.0',updatedAt:now.toISOString(),ttlDays,replayedProducts,replayedRows,costUsd:0,policy:'Fresh cached Romania evidence is free to reuse for all matching products. Paid allowlists govern only new provider requests, never cache visibility.'}};
await fs.writeFile(MARKET,JSON.stringify(data,null,2)+'\n');
console.log(`Romania cache replay: products=${replayedProducts}, rows=${replayedRows}, cost=$0.`);

import fs from 'node:fs/promises';

const LIVE_FILE='radar-live.json';
const BASE_FILE='products.json';
const MAX_CHECKS=12;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
const round=value=>Math.round(Number(value)||0);

const markets=[
  {key:'amazonDE',label:'Amazon DE',domain:'amazon.de',kind:'foreign'},
  {key:'allegroPL',label:'Allegro PL',domain:'allegro.pl',kind:'foreign'},
  {key:'trendyolTR',label:'Trendyol TR',domain:'trendyol.com',kind:'foreign'},
  {key:'emagRO',label:'eMAG RO',domain:'emag.ro',kind:'romania'},
  {key:'alibabaCN',label:'Alibaba',domain:'alibaba.com',kind:'china'}
];

const catalogue=[
  ['Vacuum storage bags with hand pump','Organizare casă',22,55,129],['Under sink sliding organizer','Organizare casă',28,68,149],['Expandable drawer divider set','Organizare casă',20,48,109],['Rotating refrigerator organizer turntable','Bucătărie',24,55,119],['Reusable silicone air fryer liner set','Bucătărie',18,42,89],['Magnetic spice rack for refrigerator','Bucătărie',28,65,139],['Travel compression packing cubes','Travel',32,75,169],['Foldable travel shoe organizer','Travel',22,52,119],['Car seat gap organizer set','Auto',28,68,149],['Car trunk collapsible organizer','Auto',35,85,179],['Pet paw cleaner cup','Pet',20,45,99],['Pet car seat cover hammock','Pet',42,95,199],['Dog slow feeder lick mat set','Pet',18,45,99],['Balcony railing planter holder adjustable','Grădină & balcon',28,70,159],['Self watering plant spikes set','Grădină & balcon',15,38,79],['Garden tool organizer wall mount','Grădină & balcon',32,75,169],['Cable management box desk set','Birou',22,55,119],['Under desk cable tray clamp on','Birou',28,68,149],['Laptop vertical stand adjustable','Birou',30,72,159],['Headphone stand desk organizer','Birou',24,58,129],['Wardrobe shelf divider set','Organizare garderobă',20,48,109],['Handbag purse organizer insert','Organizare garderobă',22,55,119],['Hat organizer hanger for closet','Organizare garderobă',18,45,99],['Sports ball storage rack','Sport & hobby',38,90,199],['Resistance band wall storage organizer','Sport & hobby',25,62,139],['Board game storage bags organizer','Sport & hobby',20,50,109],['Kids car travel tray age 3 plus','Kids 3–6 • Travel',35,85,179],['Kids toy storage bag play mat','Kids 3–6 • Organizare',30,72,159],['Preschool visual routine chart reusable','Kids 3–6 • Educațional',20,48,109],['Kids art supply organizer portable','Kids 3–6 • Organizare',25,62,139]
].map(([name,cat,chinaMin,chinaMax,sell])=>({name,searchTerm:name,cat,chinaMin,chinaMax,sell}));

async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
function clean(s){return String(s||'').replace(/\s+/g,' ').trim();}
function slug(s){return clean(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function n(v,min=0,max=10000){const x=Number(v);return Number.isFinite(x)?Math.max(min,Math.min(max,x)):0;}
function landedEstimate(p){const mid=(n(p.chinaMin)+n(p.chinaMax))/2;return Math.round((mid+Math.max(12,mid*.55)+3)*100)/100;}
function economics(sell,landed){
  const grossNoVat=sell/1.21;
  const marketplace=sell*.17;
  const ads=sell*.08;
  const profit=grossNoVat-marketplace-ads-landed;
  return {profit,margin:sell?profit/sell*100:0,roi:landed?profit/landed*100:0,marketplace,ads,grossNoVat};
}
function searchLinks(name){const q=encodeURIComponent(String(name));return[{market:'Alibaba',label:`Caută ${name} pe Alibaba`,url:`https://www.alibaba.com/trade/search?SearchText=${q}`,price:'de verificat',moq:'de verificat',verified:false},{market:'1688',label:`Caută ${name} pe 1688`,url:`https://s.1688.com/selloffer/offer_search.htm?keywords=${q}`,price:'de verificat',moq:'de verificat',verified:false}];}

async function ddgPresence(term,market){
  const q=`site:${market.domain} "${term}"`;const url=`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),6000);
  try{const res=await fetch(url,{signal:controller.signal,headers:{'user-agent':'Mozilla/5.0 MegaProductRadar/3.0','accept-language':'en-US,en;q=0.8'}});if(!res.ok)return{ok:false,present:false,status:res.status,resultCount:0};const html=await res.text();const resultCount=(html.match(/result__a/g)||[]).length+(html.match(/result-link/g)||[]).length;return{ok:true,present:resultCount>0&&html.toLowerCase().includes(market.domain.toLowerCase()),resultCount:Math.min(10,resultCount)};}catch(error){return{ok:false,present:false,resultCount:0,error:String(error?.message||error).slice(0,120)};}finally{clearTimeout(timer);}
}

function signalTotal(signals,kind){return markets.filter(m=>m.kind===kind).reduce((sum,m)=>sum+n(signals?.[m.key]?.resultCount,0,10),0);}
function demandScore(signals,foreign,checks){
  if(checks<2)return 45;
  const foreignResults=signalTotal(signals,'foreign');
  return clamp(25+foreign*18+foreignResults*2.2);
}
function trendScore(signals,previousScout){
  const current=signalTotal(signals,'foreign');
  const prior=signalTotal(previousScout?.signals,'foreign');
  if(!prior)return {score:55,velocityPct:null,label:'NEW SIGNAL'};
  const velocityPct=((current-prior)/Math.max(1,prior))*100;
  const score=clamp(50+velocityPct*.65);
  const label=velocityPct>=35?'RISING FAST':velocityPct>=10?'RISING':velocityPct<=-25?'DECLINING':velocityPct<=-8?'COOLING':'STABLE';
  return {score:round(score),velocityPct:Math.round(velocityPct*10)/10,label};
}
function romaniaGapScore({foreign,romania,china,signals}){
  const foreignResults=signalTotal(signals,'foreign');
  const roResults=signalTotal(signals,'romania');
  return clamp(35+foreign*15+foreignResults*1.8+china*8-romania*24-roResults*2.2);
}
function saturationScore(signals,romania){
  const roResults=signalTotal(signals,'romania');
  if(!romania)return 92;
  return clamp(82-roResults*7);
}
function marginScore(sell,landed){
  const e=economics(sell,landed);
  return clamp(e.margin*1.55+e.roi*.28+Math.min(25,Math.max(0,e.profit)/4));
}
function supplierScore(china,signals,sourcing){
  const chinaResults=signalTotal(signals,'china');
  const sourceCount=Array.isArray(sourcing)?sourcing.length:0;
  return clamp(35+china*28+chinaResults*2.5+sourceCount*4);
}
function lifecycleFrom({trend,demand,saturation}){
  if(trend.label==='DECLINING')return 'DECLINING';
  if(saturation<45&&demand>65)return 'SATURATED';
  if(trend.score>=72&&saturation>=60)return 'GROWING';
  if(demand>=78&&saturation>=50)return 'HOT';
  if(demand<58&&saturation>=70)return 'EARLY';
  return 'WATCH';
}
function megaAnalysis(product,{signals,foreign,romania,china,checks}){
  const landed=n(product.landed)||landedEstimate(product),sell=n(product.sell);
  const demand=round(demandScore(signals,foreign,checks));
  const trend=trendScore(signals,product.marketScout);
  const gap=round(romaniaGapScore({foreign,romania,china,signals}));
  const saturation=round(saturationScore(signals,romania));
  const margin=round(marginScore(sell,landed));
  const supplier=round(supplierScore(china,signals,product.sourcing));
  const logistics=round(n(product.logistics,0,100)||78);
  const compliance=round(n(product.compliance,0,100)||78);
  const score=round(demand*.20+trend.score*.15+gap*.20+saturation*.10+margin*.20+supplier*.05+logistics*.05+compliance*.05);
  const e=economics(sell,landed);
  const kids=String(product.cat||'').startsWith('Kids');
  const liveEnough=checks>=3&&foreign>=1;
  let action='WATCH';
  if(score>=84&&gap>=70&&e.profit>=50&&e.margin>=20&&liveEnough&&(!kids||product.kidsGate==='PASS'))action='BUY';
  else if(score>=76&&e.profit>=35&&liveEnough)action='TEST';
  else if(score<58||e.profit<10||e.margin<10)action='REJECT';
  const lifecycle=lifecycleFrom({trend,demand,saturation});
  const testUnits=action==='BUY'?30:action==='TEST'?10:0;
  return {
    score,action,lifecycle,
    components:{demand,trend:trend.score,romaniaGap:gap,saturation,margin,supplier,logistics,compliance},
    trendVelocity:{percent:trend.velocityPct,label:trend.label},
    economics:{...e,landed,sell,breakEvenAds:Math.max(0,e.profit+e.ads)},
    testPlan:testUnits?{units:testUnits,investment:Math.round(landed*testUnits*100)/100,revenuePotential:Math.round(sell*testUnits*100)/100,profitPotential:Math.round(e.profit*testUnits*100)/100}:null,
    methodology:'MEGA Score 2.0 uses web-presence signals plus economics. It does not claim verified sales volume.'
  };
}

const base=await readJson(BASE_FILE,[]),oldLive=await readJson(LIVE_FILE,{products:[]});const previous=Array.isArray(oldLive.products)&&oldLive.products.length?oldLive.products:(Array.isArray(base)?base:[]);const byName=new Map(previous.filter(x=>x?.name).map(x=>[slug(x.name),x]));
const day=Math.floor(Date.now()/86400000);const dailyCatalogue=[];for(let i=0;i<8;i++)dailyCatalogue.push(catalogue[(day*8+i)%catalogue.length]);let newCandidates=0;
for(const seed of dailyCatalogue){const key=slug(seed.name);if(byName.has(key))continue;const landed=landedEstimate(seed),kids=String(seed.cat).startsWith('Kids');byName.set(key,{...seed,landed,score:68,megaScore:68,status:'CANDIDAT WEB • VALIDARE ÎN CURS',verdict:'WATCH',action:'WATCH',risk:'Scăzut',sourceStatus:'PARTIAL',evidence:'Candidat din universul Radar. Prețurile sunt estimări; semnalele live se verifică automat.',sourcing:searchLinks(seed.name),lastChecked:null,...(kids?{age:'3–6',kidsGate:'PENDING'}:{})});newCandidates++;}
const all=[...byName.values()];const stale=[...all].sort((a,b)=>new Date(a.lastChecked||0)-new Date(b.lastChecked||0)).slice(0,MAX_CHECKS);const updated=new Map();let successfulChecks=0;
for(const product of stale){
  const term=clean(product.searchTerm||product.name);const results=await Promise.all(markets.map(m=>ddgPresence(term,m)));const signals={};let foreign=0,romania=0,china=0,checks=0;
  results.forEach((r,i)=>{const market=markets[i];signals[market.key]={label:market.label,present:!!r.present,resultCount:Number(r.resultCount||0),ok:!!r.ok};if(r.ok){checks++;successfulChecks++;}if(r.present){if(market.kind==='foreign')foreign++;else if(market.kind==='romania')romania++;else if(market.kind==='china')china++;}});
  const sourcing=Array.isArray(product.sourcing)&&product.sourcing.length?product.sourcing:searchLinks(product.name);
  const analysis=megaAnalysis({...product,sourcing},{signals,foreign,romania,china,checks});
  const positives=Object.values(signals).filter(x=>x.present).map(x=>x.label);
  updated.set(slug(product.name),{
    ...product,sourcing,landed:analysis.economics.landed,score:analysis.score,megaScore:analysis.score,action:analysis.action,verdict:analysis.action,lifecycle:analysis.lifecycle,megaAnalysis:analysis,lastChecked:new Date().toISOString(),
    marketScout:{checkedAt:new Date().toISOString(),checks,foreignPresence:foreign,romaniaPresence:romania,chinaSourcingPresence:china,signalScore:analysis.components.demand,signals},
    sourceStatus:checks>=3&&foreign>=1?'WEB_SIGNAL':'PARTIAL',status:checks>=3&&foreign>=1?'MEGA SCORE 2.0 • SEMNAL LIVE':'VALIDARE PARȚIALĂ',
    evidence:`Semnale web automate: ${positives.length?positives.join(', '):'fără prezență suficient de clară'}. MEGA Score 2.0 combină cererea web, viteza semnalului, Romania Gap, saturația estimată și economia produsului. Nu reprezintă volum de vânzări confirmat.`
  });
  await delay(350);
}
const products=all.map(p=>updated.get(slug(p.name))||p).sort((a,b)=>Number(b.megaScore||b.score||0)-Number(a.megaScore||a.score||0)).slice(0,150);
const payload={live:successfulChecks>=3,updatedAt:new Date().toISOString(),bucket:'Romania Arbitrage Engine • web market signals',newCandidates,model:'MEGA Score 2.0',engine:'Romania Arbitrage Engine v2',successfulChecks,validation:'Web-signal estimates only; prices, sales volumes, MOQ and supplier terms require confirmation',products};
await fs.writeFile(LIVE_FILE,JSON.stringify(payload,null,2)+'\n');
console.log(`Mega Product Radar v2 scan: checked ${stale.length}; successful web checks ${successfulChecks}; new candidates ${newCandidates}; total ${products.length}.`);

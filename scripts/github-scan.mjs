import fs from 'node:fs/promises';

const MODEL = process.env.RADAR_MODEL || 'openai/gpt-4o';
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error('GITHUB_TOKEN is missing. GitHub Actions must grant models: read.');

const buckets = [
  'home organization, cleaning tools, kitchen non-electric, travel accessories',
  'pet accessories non-medical, car organization, outdoor practical accessories',
  'kids age 3-6 non-electronic organization, travel, preschool and room products',
  'sports accessories non-medical, hobby storage, outdoor practical accessories',
  'beauty organization only, fashion accessories, wardrobe organization',
  'garden, balcony, DIY organization, seasonal household problem-solvers',
  'office, desk organization, content-creator accessories without batteries/electronics'
];

const SYSTEM = `You are a severe ecommerce product-research analyst for Romania. Produce a conservative shortlist of generic product opportunities suitable for importing from China. IMPORTANT: you do NOT have live web browsing in this workflow. Never claim that a product, price, ranking, sales count, supplier page, MOQ, certification, or Romanian listing has been live-verified. Treat all market signals as hypotheses that require validation. Exclude branded/counterfeit goods, batteries, power banks, complex electrical goods, cosmetics, supplements, medical devices/claims, ingestibles, hazardous chemicals, weapons, adult products, fragile glass and app-dependent products. Prefer small/light products, low returns, low compliance complexity, China source-cost hypothesis 20-150 RON, Romanian retail hypothesis 70-800 RON.`;

const day = Math.floor(Date.now() / 86400000);
const bucket = buckets[day % buckets.length];

const prompt = `Create 5-8 strong product hypotheses for this universe: ${bucket}.
Return ONLY valid JSON, no markdown, in exactly this shape:
{"candidates":[{"name":"","category":"","isKids":false,"age":"","chinaMin":0,"chinaMax":0,"sellTarget":0,"gap":0,"velocity":0,"demand":0,"competition":0,"logistics":0,"returns":0,"compliance":0,"social":0,"supplier":0,"risk":"Scăzut|Mediu|Ridicat","evidence":"","markets":{"US":0,"DE":0,"TR":0,"PL":0,"TikTok":0,"RO":0}}]}
All numeric scores are integers 0-100, except markets which are integers 0-5. "competition" means 100 = favorable/low Romanian competition. evidence must explicitly say it is an AI hypothesis requiring live validation. Do not include URLs.`;

const response = await fetch('https://models.github.ai/inference/chat/completions', {
  method: 'POST',
  headers: {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2026-03-10'
  },
  body: JSON.stringify({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 5000
  })
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`GitHub Models HTTP ${response.status}: ${body.slice(0, 900)}`);
}

const api = await response.json();
let raw = api?.choices?.[0]?.message?.content;
if (Array.isArray(raw)) raw = raw.map(x => x?.text || x?.content || '').join('');
raw = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
if (!raw) throw new Error('GitHub Models returned an empty response');

let parsed;
try { parsed = JSON.parse(raw); }
catch { throw new Error(`GitHub Models returned invalid JSON: ${raw.slice(0, 800)}`); }

function n(v, min=0, max=100) { const x=Number(v); return Number.isFinite(x)?Math.max(min,Math.min(max,x)):0; }
function landedEstimate(p){ const mid=(n(p.chinaMin,0,10000)+n(p.chinaMax,0,10000))/2; const inbound=Math.max(12,mid*.55); return Math.round((mid+inbound+3)*100)/100; }
function econScore(sell,landed){ if(!landed||sell<=landed)return 0; const profit=sell/1.21-sell*.17-sell*.08-landed; return Math.max(0,Math.min(100,profit/landed*100)); }
function finalScore(p,landed){ const econ=econScore(p.sellTarget,landed); return Math.round(n(p.gap)*.25+n(p.velocity)*.15+n(p.demand)*.10+n(p.competition)*.10+n(p.logistics)*.10+n(p.returns)*.05+n(p.compliance)*.05+n(p.social)*.05+n(p.supplier)*.05+econ*.10); }
function slug(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
async function readJson(path,fallback){ try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;} }
function searchLinks(name){
  const q=encodeURIComponent(String(name));
  return [
    {market:'Alibaba',label:`Caută ${name} pe Alibaba`,url:`https://www.alibaba.com/trade/search?SearchText=${q}`,price:'de verificat',moq:'de verificat',verified:false},
    {market:'1688',label:`Caută ${name} pe 1688`,url:`https://s.1688.com/selloffer/offer_search.htm?keywords=${q}`,price:'de verificat',moq:'de verificat',verified:false}
  ];
}

const fresh=(Array.isArray(parsed?.candidates)?parsed.candidates:[]).map(p=>{
  const chinaMin=n(p.chinaMin,0,10000), chinaMax=n(p.chinaMax,0,10000), sellTarget=n(p.sellTarget,0,10000);
  const normalized={...p,chinaMin,chinaMax,sellTarget,gap:n(p.gap),velocity:n(p.velocity),demand:n(p.demand),competition:n(p.competition),logistics:n(p.logistics),returns:n(p.returns),compliance:n(p.compliance),social:n(p.social),supplier:n(p.supplier)};
  const landed=landedEstimate(normalized), score=finalScore(normalized,landed), kids=!!p.isKids;
  const evidence=`${String(p.evidence||'Ipoteză AI pentru validare live.')} | NEVALIDAT LIVE: verifică cererea, concurența RO, prețurile și furnizorul înainte de comandă.`;
  return {
    name:String(p.name||'').trim(), cat:kids?`Kids 3–6 • ${String(p.category||'Diverse')}`:String(p.category||'Diverse'),
    chinaMin, chinaMax, landed, sell:Math.round(sellTarget*100)/100,
    gap:n(p.gap), velocity:n(p.velocity), demand:n(p.demand), competition:n(p.competition), logistics:n(p.logistics), returns:n(p.returns), compliance:n(p.compliance), social:n(p.social), supplier:n(p.supplier),
    markets:p.markets||{}, status:'IPOTEZĂ AI • VALIDARE NECESARĂ', evidence, supplierUrl:'', roUrl:'', risk:['Scăzut','Mediu','Ridicat'].includes(p.risk)?p.risk:'Mediu', score,
    verdict:score>=88?'TEST DE VALIDARE':score>=82?'BUY ZONE CANDIDAT':score>=76?'SAMPLE':score>=70?'VALIDATE':'WATCH',
    sourcing:searchLinks(p.name), lastChecked:new Date().toISOString(), sourceStatus:'PARTIAL',
    ...(kids?{age:String(p.age||'3–6'),kidsGate:'PENDING'}:{})
  };
}).filter(p=>p.name&&p.chinaMin>=15&&p.chinaMax<=180&&p.sell>=70&&p.sell<=900&&p.score>=65&&p.risk!=='Ridicat');

const existingLive=await readJson('radar-live.json',{products:[]});
const fallback=await readJson('products.json',[]);
const previous=(existingLive.products?.length?existingLive.products:fallback);
const byName=new Map(previous.map(x=>[slug(x.name),x]));
for(const item of fresh){ const key=slug(item.name); const old=byName.get(key); if(!old||(item.score||0)>=(old.score||0))byName.set(key,item); }
const products=[...byName.values()].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,150);
const payload={live:true,updatedAt:new Date().toISOString(),bucket,newCandidates:fresh.length,model:MODEL,engine:'GitHub Models',validation:'AI hypotheses; live market validation required',products};
await fs.writeFile('radar-live.json',JSON.stringify(payload,null,2)+'\n');
console.log(`Mega Product Radar: ${fresh.length} fresh hypotheses; ${products.length} total; model=${MODEL}`);

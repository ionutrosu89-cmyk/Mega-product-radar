import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const CLI = process.env.LLAMA_CLI || './llama.cpp/build/bin/llama-cli';
const MODEL = process.env.LOCAL_MODEL || 'Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q4_K_M';
const buckets = [
  'home organization, cleaning tools, kitchen non-electric, travel accessories',
  'pet accessories non-medical, car organization, outdoor practical accessories',
  'kids age 3-6 non-electronic organization, travel, preschool and room products',
  'sports accessories non-medical, hobby storage, outdoor practical accessories',
  'beauty organization only, fashion accessories, wardrobe organization',
  'garden, balcony, DIY organization, seasonal household problem-solvers',
  'office, desk organization, content-creator accessories without batteries/electronics'
];

const day=Math.floor(Date.now()/86400000);
const bucket=buckets[day%buckets.length];
const prompt=`You are a strict ecommerce product analyst for Romania. You are running locally without live web browsing, so NEVER claim live verification, exact sales, rankings, certifications, supplier facts or current Romanian listings. Generate 5 strong generic import-product hypotheses for: ${bucket}. Prefer small/light products, low return risk, low compliance complexity, plausible China source-cost hypothesis 20-150 RON and Romanian retail hypothesis 70-800 RON. Exclude branded/counterfeit goods, batteries, complex electrical goods, cosmetics, supplements, medical devices/claims, ingestibles, hazardous chemicals, weapons, adult products, fragile glass and app-dependent products.
Return ONLY one valid JSON object, no markdown, no explanation, exactly in this shape:
{"candidates":[{"name":"","category":"","isKids":false,"age":"","chinaMin":0,"chinaMax":0,"sellTarget":0,"gap":0,"velocity":0,"demand":0,"competition":0,"logistics":0,"returns":0,"compliance":0,"social":0,"supplier":0,"risk":"Scăzut","evidence":"Ipoteză AI locală; necesită validare live.","markets":{"US":0,"DE":0,"TR":0,"PL":0,"TikTok":0,"RO":0}}]}
Scores gap/velocity/demand/competition/logistics/returns/compliance/social/supplier are integers 0-100. competition 100 means favorable/low competition. markets values are integers 0-5. risk must be Scăzut, Mediu or Ridicat.`;

function runModel(){
  return new Promise((resolve,reject)=>{
    const child=spawn(CLI,['-hf',MODEL,'-p',prompt,'-n','1800','--temp','0.2','--simple-io'],{stdio:['ignore','pipe','pipe']});
    let stdout='', stderr='';
    const MAX_OUT=8*1024*1024, MAX_ERR=512*1024;
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Local model timeout after 10 minutes'));},10*60*1000);
    child.stdout.on('data',chunk=>{
      if(stdout.length<MAX_OUT) stdout+=chunk.toString('utf8').slice(0,MAX_OUT-stdout.length);
    });
    child.stderr.on('data',chunk=>{
      const text=chunk.toString('utf8');
      process.stderr.write(text);
      if(stderr.length<MAX_ERR) stderr=(stderr+text).slice(-MAX_ERR);
    });
    child.on('error',err=>{clearTimeout(timer);reject(err);});
    child.on('close',code=>{
      clearTimeout(timer);
      if(code!==0) return reject(new Error(`Local model failed with exit ${code}: ${stderr.slice(-1200)}`));
      resolve(stdout.trim());
    });
  });
}

let raw=await runModel();
const first=raw.indexOf('{'), last=raw.lastIndexOf('}');
if(first<0||last<=first) throw new Error(`Local model returned no JSON: ${raw.slice(0,900)}`);
raw=raw.slice(first,last+1);
let parsed;
try{parsed=JSON.parse(raw);}catch{throw new Error(`Local model returned invalid JSON: ${raw.slice(0,1200)}`);}

function n(v,min=0,max=100){const x=Number(v);return Number.isFinite(x)?Math.max(min,Math.min(max,x)):0;}
function landedEstimate(p){const mid=(n(p.chinaMin,0,10000)+n(p.chinaMax,0,10000))/2;const inbound=Math.max(12,mid*.55);return Math.round((mid+inbound+3)*100)/100;}
function econScore(sell,landed){if(!landed||sell<=landed)return 0;const profit=sell/1.21-sell*.17-sell*.08-landed;return Math.max(0,Math.min(100,profit/landed*100));}
function finalScore(p,landed){const econ=econScore(p.sellTarget,landed);return Math.round(n(p.gap)*.25+n(p.velocity)*.15+n(p.demand)*.10+n(p.competition)*.10+n(p.logistics)*.10+n(p.returns)*.05+n(p.compliance)*.05+n(p.social)*.05+n(p.supplier)*.05+econ*.10);}
function slug(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
function searchLinks(name){const q=encodeURIComponent(String(name));return[
 {market:'Alibaba',label:`Caută ${name} pe Alibaba`,url:`https://www.alibaba.com/trade/search?SearchText=${q}`,price:'de verificat',moq:'de verificat',verified:false},
 {market:'1688',label:`Caută ${name} pe 1688`,url:`https://s.1688.com/selloffer/offer_search.htm?keywords=${q}`,price:'de verificat',moq:'de verificat',verified:false}
];}

const fresh=(Array.isArray(parsed?.candidates)?parsed.candidates:[]).map(p=>{
 const normalized={...p,chinaMin:n(p.chinaMin,0,10000),chinaMax:n(p.chinaMax,0,10000),sellTarget:n(p.sellTarget,0,10000)};
 const landed=landedEstimate(normalized),score=finalScore(normalized,landed),kids=!!p.isKids;
 return {name:String(p.name||'').trim(),cat:kids?`Kids 3–6 • ${String(p.category||'Diverse')}`:String(p.category||'Diverse'),chinaMin:normalized.chinaMin,chinaMax:normalized.chinaMax,landed,sell:normalized.sellTarget,gap:n(p.gap),velocity:n(p.velocity),demand:n(p.demand),competition:n(p.competition),logistics:n(p.logistics),returns:n(p.returns),compliance:n(p.compliance),social:n(p.social),supplier:n(p.supplier),markets:p.markets||{},status:'IPOTEZĂ AI LOCALĂ',evidence:`${String(p.evidence||'Ipoteză AI locală.')} | NEVALIDAT LIVE: verifică piața și furnizorul înainte de comandă.`,supplierUrl:'',roUrl:'',risk:['Scăzut','Mediu','Ridicat'].includes(p.risk)?p.risk:'Mediu',score,verdict:score>=88?'TEST DE VALIDARE':score>=82?'BUY ZONE CANDIDAT':score>=76?'SAMPLE':score>=70?'VALIDATE':'WATCH',sourcing:searchLinks(p.name),lastChecked:new Date().toISOString(),sourceStatus:'PARTIAL',...(kids?{age:String(p.age||'3–6'),kidsGate:'PENDING'}:{})};
}).filter(p=>p.name&&p.chinaMin>=15&&p.chinaMax<=180&&p.sell>=70&&p.sell<=900&&p.score>=60&&p.risk!=='Ridicat');

const existingLive=await readJson('radar-live.json',{products:[]});
const fallback=await readJson('products.json',[]);
const previous=existingLive.products?.length?existingLive.products:fallback;
const byName=new Map(previous.map(x=>[slug(x.name),x]));
for(const item of fresh){const key=slug(item.name),old=byName.get(key);if(!old||(item.score||0)>=(old.score||0))byName.set(key,item);}
const products=[...byName.values()].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,150);
const payload={live:true,updatedAt:new Date().toISOString(),bucket,newCandidates:fresh.length,model:MODEL,engine:'Local open-source AI on GitHub Actions',validation:'AI hypotheses; live market validation required',products};
await fs.writeFile('radar-live.json',JSON.stringify(payload,null,2)+'\n');
console.log(`Mega Product Radar: ${fresh.length} local-AI hypotheses; ${products.length} total; model=${MODEL}`);

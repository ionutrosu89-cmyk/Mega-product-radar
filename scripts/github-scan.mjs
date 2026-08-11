import fs from 'node:fs/promises';
import OpenAI from 'openai';

const MODEL = process.env.RADAR_MODEL || 'gpt-5-mini';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const buckets = [
  'home organization, cleaning tools, kitchen non-electric, travel accessories',
  'pet accessories non-medical, car organization, outdoor practical accessories',
  'kids age 3-6 non-electronic organization, travel, preschool and room products',
  'sports accessories non-medical, hobby storage, outdoor practical accessories',
  'beauty organization only, fashion accessories, wardrobe organization',
  'garden, balcony, DIY organization, seasonal household problem-solvers',
  'office, desk organization, content-creator accessories without batteries/electronics'
];

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name','category','isKids','age','chinaMin','chinaMax','sellTarget','gap','velocity','demand','competition','logistics','returns','compliance','social','supplier','risk','evidence','roListingsEst','roPriceMin','roPriceMax','sourceStatus','markets','sourcing'],
        properties: {
          name:{type:'string'}, category:{type:'string'}, isKids:{type:'boolean'}, age:{type:'string'},
          chinaMin:{type:'number',minimum:0}, chinaMax:{type:'number',minimum:0}, sellTarget:{type:'number',minimum:0},
          gap:{type:'integer',minimum:0,maximum:100}, velocity:{type:'integer',minimum:0,maximum:100}, demand:{type:'integer',minimum:0,maximum:100}, competition:{type:'integer',minimum:0,maximum:100}, logistics:{type:'integer',minimum:0,maximum:100}, returns:{type:'integer',minimum:0,maximum:100}, compliance:{type:'integer',minimum:0,maximum:100}, social:{type:'integer',minimum:0,maximum:100}, supplier:{type:'integer',minimum:0,maximum:100},
          risk:{type:'string',enum:['Scăzut','Mediu','Ridicat']}, evidence:{type:'string'}, roListingsEst:{type:'string'}, roPriceMin:{type:'number',minimum:0}, roPriceMax:{type:'number',minimum:0}, sourceStatus:{type:'string',enum:['VERIFIED','PARTIAL']},
          markets:{type:'object',additionalProperties:false,required:['US','DE','TR','PL','TikTok','RO'],properties:{US:{type:'integer',minimum:0,maximum:5},DE:{type:'integer',minimum:0,maximum:5},TR:{type:'integer',minimum:0,maximum:5},PL:{type:'integer',minimum:0,maximum:5},TikTok:{type:'integer',minimum:0,maximum:5},RO:{type:'integer',minimum:0,maximum:5}}},
          sourcing:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['market','label','url','price','moq','verified'],properties:{market:{type:'string',enum:['Alibaba','1688','AliExpress','Other China']},label:{type:'string'},url:{type:'string'},price:{type:'string'},moq:{type:'string'},verified:{type:'boolean'}}}}
        }
      }
    }
  }
};

const SYSTEM = `You are a severe ecommerce product-research analyst for Romania. Reject weak opportunities. Find generic products demonstrably selling abroad but less mature in Romania. Prioritize sourcing from China, small/light products, source cost 20-150 RON, retail 70-800 RON, low returns and low compliance complexity. Exclude branded/counterfeit goods, batteries, power banks, complex electrical goods, cosmetics, supplements, medical devices/claims, ingestibles, hazardous chemicals, weapons, adult products, fragile glass and app-dependent products. Use evidence, not assumptions. Do not fabricate URLs, rankings, sales counts, certifications, MOQ or supplier facts.`;

function landedEstimate(p){
  const mid=(Number(p.chinaMin)+Number(p.chinaMax))/2;
  const inbound=Math.max(12,mid*0.55);
  return Math.round((mid+inbound+3)*100)/100;
}
function econScore(sell,landed){
  if(!landed||sell<=landed)return 0;
  const profit=sell/1.21-sell*.17-sell*.08-landed;
  return Math.max(0,Math.min(100,profit/landed*100));
}
function finalScore(p,landed){
  const econ=econScore(p.sellTarget,landed);
  return Math.round(p.gap*.25+p.velocity*.15+p.demand*.10+p.competition*.10+p.logistics*.10+p.returns*.05+p.compliance*.05+p.social*.05+p.supplier*.05+econ*.10);
}
function slug(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}

if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing from GitHub Actions secrets');

const day=Math.floor(Date.now()/86400000);
const bucket=buckets[day%buckets.length];
const response=await client.responses.create({
  model:MODEL,
  store:false,
  tools:[{type:'web_search',search_context_size:'low'}],
  input:[
    {role:'system',content:SYSTEM},
    {role:'user',content:`Research this universe today: ${bucket}. Compare demand signals from foreign markets (Amazon US/DE, TikTok Shop, Etsy, Walmart, eBay, Allegro, Kaufland, Trendyol Turkey, Temu/AliExpress and relevant alternatives) against Romania (eMAG, Trendyol Romania, Infinity and other Romanian ecommerce results). Find concrete China sourcing evidence, prioritizing Alibaba and 1688-compatible products. Return at most 8 strong candidates, preferring fewer high-quality candidates. Competition score: 100 means favorable/low Romanian competition. VERIFIED requires at least one real, specific China sourcing URL with a visible price signal; otherwise PARTIAL.`}
  ],
  text:{format:{type:'json_schema',name:'mega_radar_candidates',strict:true,schema}}
});

const parsed=JSON.parse(response.output_text);
const fresh=(parsed.candidates||[]).map(p=>{
  const landed=landedEstimate(p); const score=finalScore(p,landed); const kids=!!p.isKids;
  return {
    name:p.name, cat:kids?`Kids 3–6 • ${p.category}`:p.category,
    chinaMin:Math.round(p.chinaMin*100)/100, chinaMax:Math.round(p.chinaMax*100)/100,
    landed, sell:Math.round(p.sellTarget*100)/100, gap:p.gap, velocity:p.velocity, demand:p.demand,
    competition:p.competition, logistics:p.logistics, returns:p.returns, compliance:p.compliance, social:p.social, supplier:p.supplier,
    markets:p.markets, status:p.sourceStatus==='VERIFIED'?'VERIFICAT WEB+CN':'CANDIDAT LIVE',
    evidence:`${p.evidence} | RO listări est.: ${p.roListingsEst}; interval preț RO observat: ${p.roPriceMin}-${p.roPriceMax} lei.`,
    supplierUrl:p.sourcing?.[0]?.url||'', roUrl:'', risk:p.risk, score,
    verdict:score>=88?'TEST BUY':score>=82?'BUY ZONE':score>=76?'SAMPLE':score>=70?'VALIDATE':'WATCH',
    sourcing:p.sourcing, lastChecked:new Date().toISOString(), sourceStatus:p.sourceStatus,
    ...(kids?{age:p.age||'3–6',kidsGate:'PENDING'}:{})
  };
}).filter(p=>p.chinaMin>=15&&p.chinaMax<=180&&p.sell>=70&&p.sell<=900&&p.score>=68&&p.risk!=='Ridicat');

const existingLive=await readJson('radar-live.json',{products:[]});
const fallback=await readJson('products.json',[]);
const previous=(existingLive.products?.length?existingLive.products:fallback);
const byName=new Map(previous.map(x=>[slug(x.name),x]));
for(const item of fresh){const key=slug(item.name);const old=byName.get(key);if(!old||(item.score||0)>=(old.score||0))byName.set(key,item);}
const products=[...byName.values()].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,150);
const payload={live:true,updatedAt:new Date().toISOString(),bucket,newCandidates:fresh.length,model:MODEL,products};
await fs.writeFile('radar-live.json',JSON.stringify(payload,null,2)+'\n');
console.log(`Mega Product Radar: ${fresh.length} fresh candidates; ${products.length} total; model=${MODEL}`);

import fs from 'node:fs/promises';

const PIPELINE='golden-pipeline-live.json';
const OUT='finalist-evidence-queue-live.json';
const now=new Date().toISOString();

async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
const data=await readJson(PIPELINE,{items:[]});
const items=Array.isArray(data.items)?data.items:[];

function num(v){return Number.isFinite(Number(v))?Number(v):0;}
function classify(p){
  const validate=String(p?.stage||'')==='VALIDATE';
  const roReady=['PROVIDER_VERIFIED','MARKET_EVIDENCE_READY'].includes(String(p?.romaniaDemandStatus||''));
  const salesReady=['ESTIMATED_HIGH_CONFIDENCE','ACTUAL_OBSERVED'].includes(String(p?.salesEstimateStatus||'')) && num(p?.salesEstimateConfidence)>=75;
  let nextGate='NOT_ELIGIBLE';
  if(validate&&!roReady)nextGate='RO_DEMAND';
  else if(validate&&roReady&&!salesReady)nextGate='SALES_EVIDENCE';
  else if(validate&&roReady&&salesReady)nextGate='SUPPLIER_QUOTE';
  return {validate,roReady,salesReady,nextGate};
}

const candidates=items
  .map(p=>({...p,...classify(p)}))
  .filter(p=>p.validate)
  .sort((a,b)=>{
    const gateWeight={SUPPLIER_QUOTE:3,SALES_EVIDENCE:2,RO_DEMAND:1,NOT_ELIGIBLE:0};
    const d=(gateWeight[b.nextGate]||0)-(gateWeight[a.nextGate]||0);
    if(d)return d;
    return num(b.opportunityScore)-num(a.opportunityScore) || num(a.rank)-num(b.rank);
  })
  .slice(0,3)
  .map(p=>({
    canonicalKey:String(p.name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''),
    title:p.name,
    category:p.cat,
    goldenRank:p.rank,
    opportunityScore:num(p.opportunityScore),
    romaniaDemandStatus:p.romaniaDemandStatus||'INSUFFICIENT',
    salesEstimateStatus:p.salesEstimateStatus||'INSUFFICIENT_DATA',
    salesEstimateConfidence:num(p.salesEstimateConfidence),
    nextGate:p.nextGate,
    supplierIntelligenceAuthorized:p.nextGate==='SUPPLIER_QUOTE',
    requiredSupplierEvidence:p.nextGate==='SUPPLIER_QUOTE'?[
      'supplier name and direct source URL',
      'quoted unit price and currency',
      'MOQ',
      'sample cost',
      'lead time',
      'shipping quote/terms to Romania',
      'relevant certifications/compliance documents where applicable',
      'manual verification timestamp'
    ]:[],
    blockers:Array.isArray(p.blockers)?p.blockers:[]
  }));

const supplierAuthorized=candidates.filter(x=>x.supplierIntelligenceAuthorized);
const out={
  version:'1.0',
  updatedAt:now,
  stats:{validateProducts:items.filter(x=>x.stage==='VALIDATE').length,queueSize:candidates.length,supplierAuthorized:supplierAuthorized.length},
  candidates,
  nextAction:supplierAuthorized.length?`Start verified supplier quote collection for ${supplierAuthorized[0].title}.`:'Do not spend on supplier sourcing yet. Resolve the highest-value RO demand or sales-evidence blocker first.',
  policy:'Supplier Intelligence is authorized only for VALIDATE products that have Romania demand ready and sales confidence >=75 (or actual observed sales). This queue never promotes TEST/BUY, never invents supplier quotes, and never confirms landed cost.'
};
await fs.writeFile(OUT,JSON.stringify(out,null,2)+'\n');
console.log(`Finalist Evidence Queue: ${candidates.length} candidates, ${supplierAuthorized.length} authorized for supplier quote collection.`);

import fs from 'node:fs/promises';

const PIPELINE='golden-pipeline-live.json';
const OUT='finalist-evidence-queue-live.json';
const now=new Date().toISOString();

async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
const data=await readJson(PIPELINE,{items:[]});
const items=Array.isArray(data.items)?data.items:[];

function num(v){return Number.isFinite(Number(v))?Number(v):0;}
function classify(p){
  const stage=String(p?.stage||'');
  const deepStage=['VALIDATE','FINALIST'].includes(stage);
  const finalist=stage==='FINALIST';
  const roReady=['PROVIDER_VERIFIED','MARKET_EVIDENCE_READY'].includes(String(p?.romaniaDemandStatus||''));
  const salesReady=['ESTIMATED_HIGH_CONFIDENCE','ACTUAL_OBSERVED'].includes(String(p?.salesEstimateStatus||'')) && num(p?.salesEstimateConfidence)>=75;
  let nextGate='NOT_ELIGIBLE';
  if(deepStage&&!roReady)nextGate='RO_DEMAND';
  else if(deepStage&&roReady&&!salesReady)nextGate='SALES_EVIDENCE';
  else if(finalist&&roReady&&salesReady)nextGate='LANDED_ECONOMICS';
  else if(stage==='VALIDATE'&&roReady&&salesReady)nextGate='SUPPLIER_PAGE_EVIDENCE';
  return {deepStage,finalist,roReady,salesReady,nextGate};
}

const candidates=items
  .map(p=>({...p,...classify(p)}))
  .filter(p=>p.deepStage)
  .sort((a,b)=>{
    const gateWeight={LANDED_ECONOMICS:4,SUPPLIER_PAGE_EVIDENCE:3,SALES_EVIDENCE:2,RO_DEMAND:1,NOT_ELIGIBLE:0};
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
    supplierIntelligenceAuthorized:p.nextGate==='SUPPLIER_PAGE_EVIDENCE',
    requiredSupplierEvidence:p.nextGate==='SUPPLIER_PAGE_EVIDENCE'?[
      'direct product page URL',
      'supplier name / supplier page when public',
      'public price or price range',
      'public MOQ',
      'standard material/dimensions/weight when public'
    ]:[],
    blockers:Array.isArray(p.blockers)?p.blockers:[]
  }));

const supplierAuthorized=candidates.filter(x=>x.supplierIntelligenceAuthorized);
const out={
  version:'1.0',
  updatedAt:now,
  stats:{validateProducts:items.filter(x=>x.stage==='VALIDATE').length,finalistProducts:items.filter(x=>x.stage==='FINALIST').length,queueSize:candidates.length,supplierAuthorized:supplierAuthorized.length,landedEconomicsReady:candidates.filter(x=>x.nextGate==='LANDED_ECONOMICS').length},
  candidates,
  nextAction:candidates.find(x=>x.nextGate==='LANDED_ECONOMICS')?`Complete independent landed economics for ${candidates.find(x=>x.nextGate==='LANDED_ECONOMICS').title} using page-backed supplier cost plus carrier/customs evidence.`:supplierAuthorized.length?`Collect direct product/supplier page evidence for ${supplierAuthorized[0].title}; do not contact suppliers.`:'Resolve the highest-value RO demand or sales-evidence blocker first.',
  policy:'The evidence queue retains both VALIDATE and FINALIST products. Page-backed Supplier Intelligence is authorized only when supplier-page evidence is the next gate. FINALIST products advance to independent LANDED_ECONOMICS. No supplier outreach is required; this queue never promotes TEST/BUY or invents landed cost.'
};
await fs.writeFile(OUT,JSON.stringify(out,null,2)+'\n');
console.log(`Finalist Evidence Queue: ${candidates.length} candidates · page-backed supplier ${supplierAuthorized.length} · landed economics ${candidates.filter(x=>x.nextGate==='LANDED_ECONOMICS').length}.`);

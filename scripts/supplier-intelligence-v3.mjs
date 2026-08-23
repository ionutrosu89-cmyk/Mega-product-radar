import fs from 'node:fs/promises';

const QUEUE='finalist-evidence-queue-live.json';
const OUT='supplier-intelligence-v3-live.json';
const now=new Date().toISOString();

async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
const queue=await readJson(QUEUE,{candidates:[]});
const candidates=Array.isArray(queue.candidates)?queue.candidates:[];

const authorized=candidates
  .filter(x=>x?.supplierIntelligenceAuthorized===true&&x?.nextGate==='SUPPLIER_QUOTE')
  .slice(0,3);

function caseFor(p){
  return {
    canonicalKey:p.canonicalKey,
    title:p.title,
    category:p.category||null,
    goldenRank:p.goldenRank??null,
    status:'AWAITING_REAL_QUOTES',
    targetOfferCount:5,
    minimumComparableOffers:3,
    evidencePolicy:'Only direct supplier evidence and manually verified commercial terms may advance this case. Search pages, estimates and inferred values never count as a verified quote.',
    requiredFields:[
      'supplier_name','platform','direct_source_url','unit_price','currency','moq','sample_cost','lead_time_days','incoterm','shipping_quote_or_terms_to_romania','certifications_or_compliance_docs_when_applicable','quoted_at','manual_verification_at'
    ],
    comparisonDimensions:[
      'unit_price','moq','sample_cost','lead_time_days','shipping_to_romania','incoterm','supplier_history','trade_assurance_or_equivalent','certification_fit','communication_quality'
    ],
    hardBlocks:[
      'missing direct supplier source URL',
      'missing quoted unit price/currency',
      'missing MOQ',
      'missing Romania shipping terms or quote',
      'missing lead time',
      'required compliance evidence missing where applicable',
      'quote not manually verified'
    ],
    landedCostEligible:false,
    testGateEligible:false,
    buyGateEligible:false
  };
}

const cases=authorized.map(caseFor);
const out={
  version:'3.0',
  updatedAt:now,
  source:'FINALIST_EVIDENCE_QUEUE',
  status:cases.length?'READY_FOR_REAL_SUPPLIER_COLLECTION':'BLOCKED_NO_AUTHORIZED_FINALIST',
  stats:{queueCandidates:candidates.length,authorizedProducts:authorized.length,openSupplierCases:cases.length,targetOffers:cases.reduce((s,x)=>s+x.targetOfferCount,0)},
  cases,
  nextAction:cases.length?`Collect 3–5 real comparable supplier quotes for ${cases[0].title}; do not calculate confirmed landed cost until at least one complete quote is manually verified.`:'Do not start supplier sourcing yet. Wait for a VALIDATE product with Romania demand ready and sales confidence >=75.',
  policy:'Supplier Intelligence V3 never fabricates suppliers, quotes, certifications, shipping or landed cost. It cannot promote TEST or BUY. Confirmed landed cost remains blocked until a complete real supplier quote is manually verified.'
};

await fs.writeFile(OUT,JSON.stringify(out,null,2)+'\n');
console.log(`Supplier Intelligence V3: status=${out.status}, cases=${cases.length}, target offers=${out.stats.targetOffers}.`);

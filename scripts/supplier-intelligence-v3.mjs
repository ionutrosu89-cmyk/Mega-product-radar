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
    status:'READY_FOR_SUPPLIER_PAGE_SCREENING',
    targetOfferCount:5,
    minimumComparableOffers:3,
    evidencePolicy:'Exact supplier product-page data may be used for screening and estimated landed economics without waiting for a supplier reply. It does not become a verified quote and cannot satisfy the strict Supplier Gate.',
    pageScreeningFields:[
      'direct_source_url','displayed_unit_price_or_range','currency','displayed_moq','product_dimensions','product_weight','carton_dimensions','carton_weight','lead_time_if_shown','shipping_terms_if_shown','compliance_claims_if_shown'
    ],
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
    pageBackedScreeningEligible:true,
    pageEvidenceClass:'SUPPLIER_PAGE_OBSERVED',
    commercialConfirmationRequiredForScreening:false,
    commercialApprovalRequiredBeforeSampleOrOrder:true,
    testGateEligible:false,
    buyGateEligible:false
  };
}

const cases=authorized.map(caseFor);
const out={
  version:'3.1',
  updatedAt:now,
  source:'FINALIST_EVIDENCE_QUEUE',
  status:cases.length?'READY_FOR_PAGE_BACKED_SUPPLIER_SCREENING':'BLOCKED_NO_AUTHORIZED_FINALIST',
  stats:{queueCandidates:candidates.length,authorizedProducts:authorized.length,openSupplierCases:cases.length,targetOffers:cases.reduce((s,x)=>s+x.targetOfferCount,0)},
  cases,
  nextAction:cases.length?`Capture exact supplier-page evidence for ${cases[0].title} and continue screening; direct supplier confirmation is only required later for the strict Supplier Gate or a real commercial action.`:'Do not start supplier sourcing yet. Wait for an eligible product.',
  policy:'Supplier Intelligence V3.1 never fabricates suppliers, quotes, certifications, shipping or landed cost. Exact supplier-page data can support labelled screening estimates, but it never promotes itself into a verified quote, TEST or BUY. Any sample, negotiation, order or purchase requires explicit user approval.'
};

await fs.writeFile(OUT,JSON.stringify(out,null,2)+'\n');
console.log(`Supplier Intelligence V3.1: status=${out.status}, cases=${cases.length}, target offers=${out.stats.targetOffers}.`);

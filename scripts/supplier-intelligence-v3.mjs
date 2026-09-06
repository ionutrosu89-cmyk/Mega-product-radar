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
    status:'READY_FOR_SUPPLIER_PAGE_EVIDENCE',
    targetOfferCount:3,
    minimumComparableOffers:1,
    evidencePolicy:'Use the commercial data visibly published on the exact supplier product page for screening: source URL, displayed unit-price tier, MOQ, dimensions/weight, pack/carton data, lead-time or shipping terms when shown, and compliance claims/documents when shown. Missing non-critical page fields do not block screening; keep them UNKNOWN or estimated with provenance. Direct supplier confirmation is not required before screening.',
    requiredFields:[
      'direct_source_url','displayed_unit_price_or_range','currency','displayed_moq'
    ],
    optionalFields:[
      'product_dimensions','product_weight','carton_dimensions','carton_weight','lead_time','shipping_terms','compliance_claims_or_docs'
    ],
    comparisonDimensions:[
      'displayed_unit_price','moq','shipping_estimate','chargeable_weight','lead_time_if_shown','supplier_history','trade_assurance_or_equivalent','compliance_fit_if_shown'
    ],
    hardBlocks:[
      'missing exact supplier product page URL',
      'no usable displayed price on the product page',
      'no usable displayed MOQ or quantity tier'
    ],
    landedCostEligible:true,
    evidenceClass:'SUPPLIER_PAGE_OBSERVED',
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
  nextAction:cases.length?`Capture the exact supplier-page data for ${cases[0].title} and continue landed-cost screening. Do not wait for a supplier reply unless a sample/order/negotiation decision is being made.`:'Do not start supplier sourcing yet. Wait for an eligible product.',
  policy:'Supplier Intelligence V3.1 treats exact supplier product-page data as sufficient for sourcing and landed-cost screening. Unknown fields remain UNKNOWN and estimates must be labelled. Supplier outreach is not a screening prerequisite. Any sample, order, negotiation or purchase still requires explicit user approval.'
};

await fs.writeFile(OUT,JSON.stringify(out,null,2)+'\n');
console.log(`Supplier Intelligence V3.1: status=${out.status}, cases=${cases.length}, target offers=${out.stats.targetOffers}.`);

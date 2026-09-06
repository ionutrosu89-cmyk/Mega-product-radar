import fs from 'node:fs/promises';

const QUEUE='finalist-evidence-queue-live.json';
const OUT='supplier-intelligence-v3-live.json';
const now=new Date().toISOString();

async function readJson(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
const queue=await readJson(QUEUE,{candidates:[]});
const candidates=Array.isArray(queue.candidates)?queue.candidates:[];

const authorized=candidates
  .filter(x=>x?.supplierIntelligenceAuthorized===true&&['SUPPLIER_QUOTE','SUPPLIER_PAGE_EVIDENCE','SUPPLIER_SCREENING'].includes(x?.nextGate))
  .slice(0,3);

function caseFor(p){
  return {
    canonicalKey:p.canonicalKey,
    title:p.title,
    category:p.category||null,
    goldenRank:p.goldenRank??null,
    status:'PAGE_BACKED_COLLECTION',
    targetOfferCount:5,
    minimumComparableOffers:3,
    evidencePolicy:'Use direct product pages and supplier pages only. Public price, MOQ, standard specifications and supplier profile data may advance screening. Missing public fields remain UNKNOWN. Supplier outreach is disabled.',
    requiredFields:[
      'supplier_name','platform','direct_product_url','public_unit_price_or_range','currency','public_moq','standard_material_when_public','standard_dimensions_when_public','supplier_profile_url','supplier_history_when_public'
    ],
    comparisonDimensions:[
      'public_unit_price','public_moq','product_match','supplier_history','supplier_rating','public_sales_or_review_signal','standard_material','standard_dimensions','page_completeness'
    ],
    hardBlocks:[
      'missing direct product page URL',
      'missing public price/currency',
      'missing public MOQ',
      'product match not high confidence'
    ],
    landedCostEligible:false,
    screeningEconomicsEligible:true,
    testGateEligible:false,
    buyGateEligible:false
  };
}

const cases=authorized.map(caseFor);
const out={
  version:'3.0',
  updatedAt:now,
  source:'FINALIST_EVIDENCE_QUEUE',
  status:cases.length?'READY_FOR_PAGE_BACKED_SUPPLIER_COLLECTION':'BLOCKED_NO_AUTHORIZED_FINALIST',
  stats:{queueCandidates:candidates.length,authorizedProducts:authorized.length,openSupplierCases:cases.length,targetOffers:cases.reduce((s,x)=>s+x.targetOfferCount,0)},
  cases,
  nextAction:cases.length?`Collect 3–5 comparable direct product/supplier pages for ${cases[0].title}. Use public standard data only; do not contact suppliers. Missing fields remain UNKNOWN.`:'Do not start supplier sourcing yet. Wait for a VALIDATE product with Romania demand ready and sales confidence >=75.',
  policy:'Supplier Intelligence V3 is page-backed only: no supplier outreach. It never fabricates suppliers, prices, specifications, shipping or landed cost. Public page values may feed conservative screening economics; confirmed TEST/BUY remains governed by independent landed-cost and approval gates.'
};

await fs.writeFile(OUT,JSON.stringify(out,null,2)+'\n');
console.log(`Supplier Intelligence V3: status=${out.status}, cases=${cases.length}, target offers=${out.stats.targetOffers}.`);

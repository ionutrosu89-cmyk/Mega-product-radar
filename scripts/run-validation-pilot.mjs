import fs from 'node:fs/promises';
import {productEvidenceDecision} from '../product-evidence-decision.js';
const data=JSON.parse(await fs.readFile('market-intelligence-live.json','utf8'));
const input=JSON.parse(await fs.readFile('data/stabilization-pilot-review.json','utf8'));
const reviewedAt=input.reviewedAt;
const items=input.items.map(review=>{
 const p=data.products.find(p=>p.name===review.name);
 if(!p)throw new Error(`PILOT_PRODUCT_MISSING:${review.name}`);
 const decision=productEvidenceDecision(p,Date.parse(reviewedAt));
 return {...review,applicationStage:decision.stage,applicationBlockers:decision.blockers,freshness:decision.freshness,
   manualDecision:'HOLD_FOR_EVIDENCE',comparison:['FINALIST','TEST_READY','BUY_READY'].includes(decision.stage)?'DISAGREEMENT_REQUIRES_REVIEW':'AGREES_DO_NOT_ADVANCE',
   confirmedDemand:false,exactRomaniaComparison:false,verifiedSupplierQuote:false,confirmedLandedCost:false,purchaseAuthorized:false};
});
const report={version:1,reviewedAt,generatedAt:new Date().toISOString(),niche:'Accesorii de birou',method:'DESK_REVIEW_PUBLIC_SOURCES_NOT_SUPPLIER_CONFIRMATION',
 warning:'Prezența unei listări nu dovedește vânzări. Rezultatele indexate nu sunt verificări curente de preț sau stoc. HOLD respinge avansarea, nu demonstrează că produsul este neprofitabil.',
 stats:{products:items.length,advanced:0,held:items.length,disagreements:items.filter(x=>x.comparison.startsWith('DISAGREEMENT')).length},items};
await fs.writeFile('validation-pilot-live.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.stats));

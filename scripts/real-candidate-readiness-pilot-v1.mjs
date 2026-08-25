import fs from 'node:fs/promises';
import {buildOpportunityShortlistV4} from '../opportunity-engine-v4.js';

const pilot=JSON.parse(await fs.readFile(new URL('../data/real-candidate-readiness-pilot-v1.json',import.meta.url),'utf8'));
const shortlist=buildOpportunityShortlistV4(pilot.candidates||[]);
const output={
  version:'1.0',
  observedAt:pilot.observedAt,
  total:shortlist.total,
  discovered:shortlist.rows.filter(x=>x.funnelStage==='DISCOVERED').length,
  promising:shortlist.promising,
  validate:shortlist.validate,
  finalists:shortlist.finalists,
  rows:shortlist.rows,
  blockingEvidence:pilot.blockingEvidence,
  policy:'REAL_EVIDENCE_ONLY; SAMPLED_ROMANIA_DOES_NOT_REPLACE_TREND_OR_EXACT_GAP; UNKNOWN_IS_NOT_ZERO; NOT_VERIFIED_SALES; NO_PURCHASE_AUTHORITY',
  salesEvidenceClass:'NOT_VERIFIED_SALES',
  paidCallsTriggered:0,
  approvedSpendEur:0,
  purchaseAuthorized:false
};
await fs.mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../artifacts/real-candidate-readiness-pilot-v1.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({total:output.total,discovered:output.discovered,promising:output.promising,validate:output.validate,finalists:output.finalists}));

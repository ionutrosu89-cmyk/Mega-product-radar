import fs from 'node:fs/promises';
import {deriveRomaniaSampledCompetition,combineRomaniaSampledCompetition} from '../romania-sampled-competition-v1.js';

const pilot=JSON.parse(await fs.readFile(new URL('../data/romania-sampled-competition-pilot-v1.json',import.meta.url),'utf8'));
const rows=(pilot.rows||[]).map(row=>({
  nicheKey:row.nicheKey,
  candidateId:row.candidateId,
  sourceUrl:row.sourceUrl,
  ...deriveRomaniaSampledCompetition(row)
}));
const byNiche={};
for(const row of pilot.rows||[]){
  (byNiche[row.nicheKey]??=[]).push(row);
}
const nicheSummaries=Object.entries(byNiche).map(([nicheKey,nicheRows])=>({
  nicheKey,
  ...combineRomaniaSampledCompetition(nicheRows)
}));
const output={
  version:'1.0',
  observedAt:pilot.observedAt,
  totalRows:rows.length,
  eligibleRows:rows.filter(x=>x.eligibleForSampledSignal).length,
  rows,
  nicheSummaries,
  limitations:pilot.limitations||[],
  policy:'SAMPLED_ESTIMATE_ONLY; DISCOVERED_OR_PROMISING_ONLY; NEVER_REPLACES_EXACT_ROMANIA_GAP_GATE; UNKNOWN_IS_NOT_ZERO; NOT_VERIFIED_SALES; NO_PURCHASE_AUTHORITY',
  salesEvidenceClass:'NOT_VERIFIED_SALES',
  paidCallsTriggered:0,
  approvedSpendEur:0,
  purchaseAuthorized:false
};
await fs.mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../artifacts/romania-sampled-competition-v1.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({totalRows:output.totalRows,eligibleRows:output.eligibleRows,niches:nicheSummaries.map(x=>({nicheKey:x.nicheKey,status:x.status,estimate:x.estimatedCanonicalListings}))}));

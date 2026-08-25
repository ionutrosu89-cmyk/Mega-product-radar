import fs from 'node:fs/promises';
import {qualifyRomaniaComparableQuery} from '../romania-query-qualification-v1.js';

const audit=JSON.parse(await fs.readFile(new URL('../data/romania-query-candidate-audit-v1.json',import.meta.url),'utf8'));
const rows=audit.candidates.map(candidate=>({
  candidateId:candidate.candidateId,
  nicheKey:candidate.nicheKey,
  platform:candidate.platform,
  sourceUrl:candidate.sourceUrl,
  sourceQualification:candidate.sourceQualification,
  ...qualifyRomaniaComparableQuery(candidate)
}));
const output={
  version:'1.0',
  observedAt:audit.observedAt,
  total:rows.length,
  qualified:rows.filter(x=>x.qualifiedForComparableCountCandidate).length,
  rejected:rows.filter(x=>!x.qualifiedForComparableCountCandidate).length,
  rows,
  nextCandidate:audit.nextCandidate,
  policy:audit.policy,
  salesEvidenceClass:'NOT_VERIFIED_SALES',
  paidCallsTriggered:0,
  approvedSpendEur:0,
  purchaseAuthorized:false
};
await fs.mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../artifacts/romania-query-candidate-audit-v1.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({total:output.total,qualified:output.qualified,rejected:output.rejected,nextCandidate:output.nextCandidate.candidateId}));

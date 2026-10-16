import {readFile} from 'node:fs/promises';
import {EDITORIAL_EVIDENCE_TYPES,EDITORIAL_INPUT_SCHEMA,buildEditorialRadarFeed,normalizeEditorialEvidence} from '../editorial-radar-v1.js';

const now=new Date();
const source=new URL('../data/editorial-radar-candidates-v1.json',import.meta.url);

try{
  const input=JSON.parse(await readFile(source,'utf8'));
  if(input?.schema!==EDITORIAL_INPUT_SCHEMA||!Array.isArray(input.products))throw new Error('EDITORIAL_INPUT_INVALID');
  const feed=buildEditorialRadarFeed(input,{now});
  const candidateIds=new Set();
  const candidates=input.products.map(candidate=>{
    const id=String(candidate?.id||'').trim();
    if(!id||candidateIds.has(id))throw new Error(`EDITORIAL_DUPLICATE_OR_MISSING_ID:${id||'UNKNOWN'}`);
    candidateIds.add(id);
    const evidence=Array.isArray(candidate.evidence)?candidate.evidence:[];
    const current=evidence.map(row=>normalizeEditorialEvidence(row,{now})).filter(Boolean);
    const leadCount=evidence.filter(row=>row?.type==='LEAD_ONLY').length;
    const present=new Set(current.map(row=>row.type));
    return {
      id,
      nicheId:candidate.nicheId,
      publication: candidate.publication?.status||'UNKNOWN',
      brandReview: candidate.brandReview?.status||'UNKNOWN',
      currentEvidence:current.length,
      distinctSourceUrls:new Set(current.map(row=>row.sourceUrl)).size,
      leadCount,
      staleOrInvalidEvidenceCount:evidence.length-current.length-leadCount,
      missingEvidence:Object.keys(EDITORIAL_EVIDENCE_TYPES).filter(type=>!present.has(type)),
    };
  });
  const report={
    schema:'MPR_EDITORIAL_PIPELINE_REPORT_V1',
    generatedAt:now.toISOString(),
    nicheCount:feed.niches.length,
    candidateCount:candidates.length,
    approvedPublicCount:feed.products.length,
    draftCount:candidates.filter(row=>row.publication==='DRAFT').length,
    candidates,
  };
  console.log(JSON.stringify(report,null,2));
}catch(error){
  console.error(`Unable to report editorial pipeline: ${error.message}`);
  process.exitCode=2;
}

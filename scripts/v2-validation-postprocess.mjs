import fs from 'node:fs/promises';
const FILE='radar-live.json';
const n=v=>Number(v)||0;
const txt=v=>String(v||'').toUpperCase();
const data=JSON.parse(await fs.readFile(FILE,'utf8'));
for(const p of data.products||[]){
  const ms=p.marketScout||{}, si=p.supplierIntel||{}, ri=p.reviewIntel||{}, ci=p.competitorIntel||{};
  const checks=n(ms.checks), foreign=n(ms.foreignPresence), supplierCoverage=n(si.coverage), reviews=n(ri.sourceCount);
  const live=txt(p.sourceStatus)==='WEB_SIGNAL'&&checks>=5&&foreign>=1;
  const supplierEvidence=supplierCoverage>=2?'STRONG':supplierCoverage===1?'PARTIAL':'NONE';
  const reviewEvidence=reviews>=2?'MULTI_SOURCE':reviews===1?'SINGLE_SOURCE':'NONE';
  const competitionEvidence=n(ci.resultProxy)>0?'OBSERVED':'NO_SIGNAL';
  const evidencePoints=(live?40:10)+(supplierCoverage>=2?25:supplierCoverage===1?12:0)+(reviews>=2?20:reviews===1?10:0)+(competitionEvidence==='OBSERVED'?15:0);
  const evidenceScore=Math.min(100,evidencePoints);
  p.v2Validation={
    at:new Date().toISOString(),
    evidenceScore,
    confidence:evidenceScore>=80?'HIGH':evidenceScore>=55?'MEDIUM':'LOW',
    marketLive:live,
    supplierEvidence,
    reviewEvidence,
    competitionEvidence,
    blockers:[
      ...(!live?['MARKET_DATA_NOT_LIVE']:[]),
      ...(supplierCoverage<2?['SUPPLIER_EVIDENCE_WEAK']:[]),
      ...(reviews<1?['REVIEW_EVIDENCE_MISSING']:[])
    ],
    note:'Evidence confidence reflects observed web signals only; commercial supplier terms still require manual confirmation before payment.'
  };
}
data.v2Validation={version:'2.1',updatedAt:new Date().toISOString(),policy:'Evidence first: BUY requires strong live evidence; never fabricate supplier/review confirmation.'};
await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');
console.log('V2 validation enriched',data.products?.length||0);

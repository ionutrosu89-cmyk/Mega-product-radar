import {importRiskGate} from './import-risk.js';
import {profitEngineV2} from './profit-engine-v2.js';
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,n(v)));
const txt=v=>String(v||'').toUpperCase();
const isKids=p=>/KIDS|COPII|3.?6|0.?6/i.test(`${p?.cat||''} ${p?.age||''}`);

export function strictAuditProduct(p){
  const a=p.megaAnalysis||{},c=a.components||{},dq=p.dataQuality||{},ms=p.marketScout||{},si=p.supplierIntel||{},ri=p.reviewIntel||{},ci=p.competitorIntel||{},hist=p.historySummary||{},v=p.v2Validation||{};
  const riskGate=importRiskGate(p),e=profitEngineV2(p);
  const dataLive=v.marketLive===true||txt(dq.level)==='LIVE'||txt(p.sourceStatus)==='WEB_SIGNAL';
  const checks=n(dq.checks||ms.checks),foreign=n(ms.foreignPresence),supplierCoverage=n(si.coverage),supplierEvidence=txt(v.supplierEvidence||'NONE');
  const supplierReady=supplierEvidence==='STRONG'||['MEDIUM','STRONG','READY','GOOD'].some(x=>txt(si.readiness).includes(x))||supplierCoverage>=2;
  const supplierPartial=supplierEvidence==='PARTIAL'||supplierCoverage===1,reviewSources=n(ri.sourceCount),reviewEvidence=txt(v.reviewEvidence||'NONE'),competitorQuality=txt(ci.quality);
  const evidenceScore=n(v.evidenceScore)||clamp((reviewSources?65:20)+(competitorQuality==='LIVE'?20:competitorQuality==='PARTIAL'?8:0)+(n(hist.totalScans)>=3?15:n(hist.totalScans)*4));
  const kidsPass=!isKids(p)||txt(p.kidsGate)==='PASS';
  const dataScore=clamp((dataLive?65:20)+Math.min(checks,8)*4+Math.min(foreign,3)*6);
  const economicsScore=clamp(e.robustness||((n(e.margin)-10)*2+n(e.roi)*.2));
  const marketScore=clamp(n(c.demand)*.28+n(c.trend)*.24+n(c.romaniaGap)*.30+n(c.saturation)*.18);
  const supplierScore=clamp(n(c.supplier)*.50+supplierCoverage*14+(supplierReady?25:supplierPartial?10:0));
  const safetyScore=clamp(n(c.compliance)*.55+n(c.logistics)*.30+(kidsPass?15:0)-(riskGate.level==='HIGH'?25:riskGate.level==='MEDIUM'?8:0));
  let score=Math.round(dataScore*.18+economicsScore*.24+marketScore*.19+supplierScore*.13+safetyScore*.11+evidenceScore*.15);
  const blockers=[];
  if(!dataLive)blockers.push('DATA_PARTIAL');if(checks<5)blockers.push('INSUFFICIENT_CHECKS');if(foreign<1)blockers.push('NO_FOREIGN_SIGNAL');
  if(!supplierReady)blockers.push(supplierPartial?'SUPPLIER_PARTIAL':'SUPPLIER_UNVERIFIED');if(reviewEvidence==='NONE'&&reviewSources<1)blockers.push('NO_REVIEW_EVIDENCE');if(evidenceScore<55)blockers.push('EVIDENCE_LOW');
  if(!kidsPass)blockers.push('KIDS_GATE');if(riskGate.decision==='BLOCK')blockers.push('IMPORT_RISK_BLOCK');else if(riskGate.level==='HIGH')blockers.push('IMPORT_RISK_REVIEW');
  if(!e.priceComplete)blockers.push('PRICE_DATA_MISSING');else{if(n(e.profit)<25)blockers.push('LOW_NET_PROFIT');if(n(e.margin)<18)blockers.push('LOW_NET_MARGIN');if(n(e.roi)<45)blockers.push('LOW_ROI');}
  if(n(c.compliance)<80)blockers.push('COMPLIANCE_RISK');
  if(!dataLive)score-=12;if(evidenceScore<55)score-=10;if(!supplierReady&&!supplierPartial)score-=7;if(!kidsPass)score-=25;if(riskGate.level==='HIGH')score-=12;if(!e.priceComplete)score-=15;score=Math.round(clamp(score));
  const riskAllowsBuy=riskGate.level==='LOW'||riskGate.decision==='DOCUMENT CHECK';
  const hardBuy=dataLive&&checks>=5&&foreign>=1&&evidenceScore>=80&&supplierReady&&reviewSources>=1&&kidsPass&&riskAllowsBuy&&e.priceComplete&&n(e.profit)>=45&&n(e.margin)>=22&&n(e.roi)>=75&&n(c.compliance)>=85&&score>=80;
  const smallTest=dataLive&&checks>=5&&foreign>=1&&evidenceScore>=55&&(supplierReady||supplierPartial)&&kidsPass&&riskGate.decision!=='BLOCK'&&e.priceComplete&&n(e.profit)>=25&&n(e.margin)>=18&&n(e.roi)>=45&&n(c.compliance)>=80&&score>=64;
  let decision='WAIT';if(hardBuy)decision='BUY';else if(smallTest)decision='TEST';if((e.priceComplete&&n(e.profit)<8)||n(c.compliance)<60||!kidsPass||riskGate.decision==='BLOCK')decision='REJECT';
  const confidence=txt(v.confidence)||(!dataLive?'LOW':evidenceScore>=80?'HIGH':evidenceScore>=55?'MEDIUM':'LOW');
  const lifecycle=txt(a.lifecycle||p.lifecycle||'EARLY'),trendVelocity=n(a.trendVelocity?.percent),earlyWarning=dataLive&&evidenceScore>=55&&n(c.romaniaGap)>=60&&n(c.trend)>=65&&n(c.saturation)>=65&&(trendVelocity>0||lifecycle.includes('EARLY'));
  const testUnits=decision==='BUY'?20:decision==='TEST'?8:0;
  return{name:p.name,category:p.cat||'—',score,decision,confidence,evidenceScore,blockers,earlyWarning,importRisk:riskGate,economics:e,signals:{dataLive,checks,foreign,supplierReady,supplierPartial,supplierCoverage,supplierEvidence,reviewSources,reviewEvidence,competitorQuality,romaniaGap:n(c.romaniaGap),trend:n(c.trend),saturation:n(c.saturation),compliance:n(c.compliance)},testPlan:testUnits?{units:testUnits,investment:testUnits*n(e.landed),revenue:testUnits*n(e.sell),profitPotential:testUnits*n(e.profit)}:null};
}

export function buildStrictAudit(products=[]){const audited=(Array.isArray(products)?products:[]).map(strictAuditProduct).sort((a,b)=>b.score-a.score||b.evidenceScore-a.evidenceScore),top10=audited.slice(0,10),buy=audited.filter(x=>x.decision==='BUY'),test=audited.filter(x=>x.decision==='TEST'),top3=[...buy,...test].sort((a,b)=>b.score-a.score||b.evidenceScore-a.evidenceScore).slice(0,3),earlyWarnings=audited.filter(x=>x.earlyWarning).slice(0,10);return{audited,top10,top3,buy,test,earlyWarnings,summary:{total:audited.length,buy:buy.length,test:test.length,wait:audited.filter(x=>x.decision==='WAIT').length,reject:audited.filter(x=>x.decision==='REJECT').length,highConfidence:audited.filter(x=>x.confidence==='HIGH').length}};}

import {importRiskGate} from './import-risk.js';
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,n(v)));
const txt=v=>String(v||'').toUpperCase();
const isKids=p=>/KIDS|COPII|3.?6|0.?6/i.test(`${p?.cat||''} ${p?.age||''}`);

function economics(p){
  const sell=n(p.sell), landed=n(p.landed);
  const netSale=sell/1.21;
  const marketplace=sell*.17;
  const ads=sell*.08;
  const returns=sell*.03;
  const fulfillment=6;
  const packaging=2;
  const profit=netSale-marketplace-ads-returns-fulfillment-packaging-landed;
  return {profit,margin:sell?profit/sell*100:0,roi:landed?profit/landed*100:0};
}

export function strictAuditProduct(p){
  const a=p.megaAnalysis||{};
  const c=a.components||{};
  const e=a.economics||economics(p);
  const dq=p.dataQuality||{};
  const ms=p.marketScout||{};
  const si=p.supplierIntel||{};
  const ri=p.reviewIntel||{};
  const ci=p.competitorIntel||{};
  const hist=p.historySummary||{};
  const v=p.v2Validation||{};
  const riskGate=importRiskGate(p);

  const dataLive=v.marketLive===true||txt(dq.level)==='LIVE'||txt(p.sourceStatus)==='WEB_SIGNAL';
  const checks=n(dq.checks||ms.checks);
  const foreign=n(ms.foreignPresence);
  const supplierCoverage=n(si.coverage);
  const supplierEvidence=txt(v.supplierEvidence||'NONE');
  const supplierReady=supplierEvidence==='STRONG'||['MEDIUM','STRONG','READY','GOOD'].some(x=>txt(si.readiness).includes(x))||supplierCoverage>=2;
  const supplierPartial=supplierEvidence==='PARTIAL'||supplierCoverage===1;
  const reviewSources=n(ri.sourceCount);
  const reviewEvidence=txt(v.reviewEvidence||'NONE');
  const competitorQuality=txt(ci.quality);
  const evidenceScore=n(v.evidenceScore)||clamp((reviewSources?65:20)+(competitorQuality==='LIVE'?20:competitorQuality==='PARTIAL'?8:0)+(n(hist.totalScans)>=3?15:n(hist.totalScans)*4));
  const kidsPass=!isKids(p)||txt(p.kidsGate)==='PASS';

  const dataScore=clamp((dataLive?65:20)+Math.min(checks,8)*4+Math.min(foreign,3)*6);
  const economicsScore=clamp((n(e.margin)-10)*2.2+n(e.roi)*.22+Math.min(n(e.profit),100)*.22);
  const marketScore=clamp(n(c.demand)*.28+n(c.trend)*.24+n(c.romaniaGap)*.30+n(c.saturation)*.18);
  const supplierScore=clamp(n(c.supplier)*.50+supplierCoverage*14+(supplierReady?25:supplierPartial?10:0));
  const safetyScore=clamp(n(c.compliance)*.55+n(c.logistics)*.30+(kidsPass?15:0)-(riskGate.level==='HIGH'?25:riskGate.level==='MEDIUM'?8:0));

  let score=Math.round(dataScore*.19+economicsScore*.22+marketScore*.19+supplierScore*.13+safetyScore*.12+evidenceScore*.15);

  const blockers=[];
  if(!dataLive) blockers.push('DATA_PARTIAL');
  if(checks<5) blockers.push('INSUFFICIENT_CHECKS');
  if(foreign<1) blockers.push('NO_FOREIGN_SIGNAL');
  if(!supplierReady) blockers.push(supplierPartial?'SUPPLIER_PARTIAL':'SUPPLIER_UNVERIFIED');
  if(reviewEvidence==='NONE'&&reviewSources<1) blockers.push('NO_REVIEW_EVIDENCE');
  if(evidenceScore<55) blockers.push('EVIDENCE_LOW');
  if(!kidsPass) blockers.push('KIDS_GATE');
  if(riskGate.decision==='BLOCK') blockers.push('IMPORT_RISK_BLOCK');
  else if(riskGate.level==='HIGH') blockers.push('IMPORT_RISK_REVIEW');
  if(n(e.profit)<25) blockers.push('LOW_PROFIT');
  if(n(e.margin)<20) blockers.push('LOW_MARGIN');
  if(n(c.compliance)<80) blockers.push('COMPLIANCE_RISK');

  if(!dataLive) score-=12;
  if(evidenceScore<55) score-=10;
  if(!supplierReady&&!supplierPartial) score-=7;
  if(!kidsPass) score-=25;
  if(riskGate.level==='HIGH') score-=12;
  score=Math.round(clamp(score));

  const riskAllowsBuy=riskGate.level==='LOW'||riskGate.decision==='DOCUMENT CHECK';
  const hardBuy=dataLive&&checks>=5&&foreign>=1&&evidenceScore>=80&&supplierReady&&reviewSources>=1&&kidsPass&&riskAllowsBuy&&n(e.profit)>=40&&n(e.margin)>=24&&n(e.roi)>=70&&n(c.compliance)>=85&&score>=80;
  const smallTest=dataLive&&checks>=5&&foreign>=1&&evidenceScore>=55&&(supplierReady||supplierPartial)&&kidsPass&&riskGate.decision!=='BLOCK'&&n(e.profit)>=25&&n(e.margin)>=20&&n(e.roi)>=45&&n(c.compliance)>=80&&score>=64;

  let decision='WAIT';
  if(hardBuy) decision='BUY';
  else if(smallTest) decision='TEST';
  if(n(e.profit)<10||n(c.compliance)<60||!kidsPass||riskGate.decision==='BLOCK') decision='REJECT';

  const confidence=txt(v.confidence)||(!dataLive?'LOW':evidenceScore>=80?'HIGH':evidenceScore>=55?'MEDIUM':'LOW');
  const lifecycle=txt(a.lifecycle||p.lifecycle||'EARLY');
  const trendVelocity=n(a.trendVelocity?.percent);
  const earlyWarning=dataLive&&evidenceScore>=55&&n(c.romaniaGap)>=60&&n(c.trend)>=65&&n(c.saturation)>=65&&(trendVelocity>0||lifecycle.includes('EARLY'));

  const testUnits=decision==='BUY'?20:decision==='TEST'?8:0;
  return {
    name:p.name,
    category:p.cat||'—',
    score,
    decision,
    confidence,
    evidenceScore,
    blockers,
    earlyWarning,
    importRisk:riskGate,
    economics:{profit:n(e.profit),margin:n(e.margin),roi:n(e.roi),landed:n(p.landed),sell:n(p.sell)},
    signals:{dataLive,checks,foreign,supplierReady,supplierPartial,supplierCoverage,supplierEvidence,reviewSources,reviewEvidence,competitorQuality,romaniaGap:n(c.romaniaGap),trend:n(c.trend),saturation:n(c.saturation),compliance:n(c.compliance)},
    testPlan:testUnits?{units:testUnits,investment:testUnits*n(p.landed),revenue:testUnits*n(p.sell),profitPotential:testUnits*n(e.profit)}:null
  };
}

export function buildStrictAudit(products=[]){
  const audited=(Array.isArray(products)?products:[]).map(strictAuditProduct).sort((a,b)=>b.score-a.score||b.evidenceScore-a.evidenceScore);
  const top10=audited.slice(0,10);
  const buy=audited.filter(x=>x.decision==='BUY');
  const test=audited.filter(x=>x.decision==='TEST');
  const top3=[...buy,...test].sort((a,b)=>b.score-a.score||b.evidenceScore-a.evidenceScore).slice(0,3);
  const earlyWarnings=audited.filter(x=>x.earlyWarning).slice(0,10);
  return {audited,top10,top3,buy,test,earlyWarnings,summary:{total:audited.length,buy:buy.length,test:test.length,wait:audited.filter(x=>x.decision==='WAIT').length,reject:audited.filter(x=>x.decision==='REJECT').length,highConfidence:audited.filter(x=>x.confidence==='HIGH').length}};
}

import {isCanonicalProductId} from './domain-contracts-v1.js';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):0));
const norm=s=>String(s||'').trim().toLowerCase();
const canonicalId=v=>isCanonicalProductId(v)?String(v).toLowerCase():null;
export const V6_VERSION='6.0';
export const V6_STORAGE={portfolio:'megaRadarPortfolioV6',feedback:'megaRadarFeedbackV6',supplierMatrix:'megaRadarSupplierMatrixV6',capitalPlan:'megaRadarCapitalPlanV6'};

const LOCALE_EXPANSIONS={
  en:['best selling','viral','new trend','problem solving'],
  de:['bestseller','trend produkt','neuheit','praktisch'],
  pl:['bestseller','trend','nowosc','praktyczny'],
  tr:['cok satan','trend urun','yeni urun','pratik'],
  ro:['produs viral','produs nou','bestseller','util'],
  zh:['爆款','新款','热卖','实用']
};
export function expandDiscoveryQueries(term,{locales=['en','de','pl','tr','ro','zh'],max=24}={}){
  const base=String(term||'').trim(); if(!base)return[];
  const out=[]; for(const locale of locales){for(const suffix of LOCALE_EXPANSIONS[locale]||[]){out.push({locale,query:`${base} ${suffix}`});if(out.length>=max)return out;}}
  return out;
}
export function canonicalProductName(value=''){
  return norm(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b(202[0-9]|new|neu|nowy|yeni|viral|bestseller|best seller|premium)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
export function dedupeCandidates(items=[]){
  const seen=new Map(); for(const item of items){const key=canonicalProductName(item?.name);if(!key)continue;const prev=seen.get(key);if(!prev||clamp(item?.score)>clamp(prev?.score))seen.set(key,item);}return[...seen.values()];
}

export function supplierRisk(s={}){
  let risk=50; const rating=clamp(s.rating,0,5),years=clamp(s.years,0,50),moq=clamp(s.moq,0,1e7);
  if(rating>=4.8)risk-=18; else if(rating>=4.5)risk-=12; else if(rating>=4.3)risk-=6; else risk+=15;
  risk-=Math.min(12,years*2); if(s.tradeAssurance)risk-=10; if(Array.isArray(s.certifications)&&s.certifications.length)risk-=8;
  if(!s.sampleCost&&Number(s.sampleCost)!==0)risk+=5; if(!moq)risk+=12; if(!s.url)risk+=8; return clamp(risk);
}
export function rankSuppliers(suppliers=[],{targetQty=0,targetUnitCost=Infinity}={}){
  return suppliers.map(s=>{const price=Number(s.quotedPrice||0),moq=Number(s.moq||0),risk=supplierRisk(s);const qtyFit=!targetQty||!moq||targetQty>=moq?100:Math.max(0,100-(moq-targetQty)/Math.max(1,moq)*100);const priceFit=!Number.isFinite(targetUnitCost)||targetUnitCost<=0||!price?50:clamp((targetUnitCost/price)*100);const score=clamp(100-risk*.55+qtyFit*.2+Math.min(100,priceFit)*.25);return{...s,risk,score,qtyFit:Math.round(qtyFit),priceFit:Math.round(Math.min(100,priceFit))};}).sort((a,b)=>b.score-a.score);
}

export function allocateCapital(items=[],budget=0,{maxPerProductPct=35,minCashReservePct=10}={}){
  const total=Math.max(0,Number(budget)||0),reserve=total*clamp(minCashReservePct,0,90)/100,deployable=Math.max(0,total-reserve),cap=deployable*clamp(maxPerProductPct,1,100)/100;
  const eligible=items.map(i=>{const unit=Math.max(0,Number(i.unitCost||i.landed||0)),profit=Math.max(0,Number(i.profitPerUnit||i.profit||0)),readiness=clamp(i.readiness||i.buyingReadiness),risk=clamp(i.risk||i.killScore),score=clamp(i.score||i.megaScore);const utility=(profit/Math.max(1,unit))*0.45+readiness*.003+score*.002-risk*.002;return{...i,unit,profit,readiness,risk,utility};}).filter(i=>i.unit>0&&i.profit>0&&i.readiness>=55&&i.risk<70).sort((a,b)=>b.utility-a.utility);
  let remaining=deployable;const allocations=[];for(const i of eligible){if(remaining<i.unit)continue;const desired=Math.min(cap,remaining),qty=Math.max(1,Math.floor(desired/i.unit)),capital=qty*i.unit;if(capital<=0||capital>remaining)continue;allocations.push({name:i.name,qty,unitCost:i.unit,capital:Math.round(capital*100)/100,expectedProfit:Math.round(qty*i.profit*100)/100,utility:Math.round(i.utility*1000)/1000});remaining-=capital;}
  return{budget:total,reserve:Math.round((reserve+remaining)*100)/100,deployed:Math.round((total-reserve-remaining)*100)/100,expectedProfit:Math.round(allocations.reduce((a,x)=>a+x.expectedProfit,0)*100)/100,allocations};
}

export function portfolioMetrics(records=[]){
  const rows=records.map(r=>{const id=canonicalId(r.canonicalProductId);return{name:r.name||'Produs',canonicalProductId:id,decisionEligible:Boolean(id),stock:Math.max(0,Number(r.stock||0)),sold30:Math.max(0,Number(r.sold30||0)),unitCost:Math.max(0,Number(r.unitCost||0)),sellPrice:Math.max(0,Number(r.sellPrice||0)),returnsRate:clamp(r.returnsRate,0,100)};});
  const capital=rows.reduce((a,r)=>a+r.stock*r.unitCost,0),revenue30=rows.reduce((a,r)=>a+r.sold30*r.sellPrice,0),gross30=rows.reduce((a,r)=>a+r.sold30*Math.max(0,r.sellPrice-r.unitCost),0);
  const actions=rows.map(r=>{const days=r.sold30>0?r.stock/(r.sold30/30):999;if(!r.decisionEligible)return{...r,daysOfStock:Math.round(days),action:'IDENTITY_REQUIRED'};let action='HOLD';if(days<18&&r.sold30>0)action='REORDER';else if(days>120||r.returnsRate>=12)action='STOP/REDUCE';return{...r,daysOfStock:Math.round(days),action};});
  return{capitalBlocked:Math.round(capital*100)/100,revenue30:Math.round(revenue30*100)/100,grossProfit30:Math.round(gross30*100)/100,reorder:actions.filter(x=>x.action==='REORDER').length,stop:actions.filter(x=>x.action==='STOP/REDUCE').length,identityBlocked:actions.filter(x=>x.action==='IDENTITY_REQUIRED').length,actions};
}

export function feedbackCalibration(entries=[]){
  const canonical=entries.filter(e=>canonicalId(e.canonicalProductId));
  const valid=canonical.filter(e=>Number.isFinite(Number(e.predictedScore))&&Number.isFinite(Number(e.actualMargin)));
  if(!valid.length)return{sample:0,totalEntries:Array.isArray(entries)?entries.length:0,identityBlocked:(Array.isArray(entries)?entries.length:0)-canonical.length,scoreBias:0,marginMedian:0,returnPenalty:0,confidence:'LOW'};
  const biases=valid.map(e=>Number(e.actualOutcomeScore??Math.min(100,Math.max(0,Number(e.actualMargin)*2)))-Number(e.predictedScore)).sort((a,b)=>a-b),margins=valid.map(e=>Number(e.actualMargin)).sort((a,b)=>a-b),median=a=>a[Math.floor(a.length/2)]||0,returnPenalty=valid.reduce((a,e)=>a+Math.max(0,Number(e.returnRate||0)-5),0)/valid.length;
  return{sample:valid.length,totalEntries:Array.isArray(entries)?entries.length:0,identityBlocked:(Array.isArray(entries)?entries.length:0)-canonical.length,scoreBias:Math.round(median(biases)*10)/10,marginMedian:Math.round(median(margins)*10)/10,returnPenalty:Math.round(returnPenalty*10)/10,confidence:valid.length>=20?'HIGH':valid.length>=8?'MEDIUM':'LOW'};
}
export function calibratedScore(baseScore,calibration={}){return clamp(Number(baseScore||0)+Number(calibration.scoreBias||0)-Number(calibration.returnPenalty||0)*.35);}

export function executiveActions({radar=[],discovery=[],portfolio=[]}={}){
  const buy=radar.filter(p=>String(p.buyingDecision?.label||p.decision||'').includes('ORDER NOW')).slice(0,5);
  const test=discovery.filter(p=>['TEST','BUY CANDIDATE'].includes(p.suggestedStage)&&p.discoveryAnalysis?.quality?.level==='LIVE').slice(0,5);
  const pm=portfolioMetrics(portfolio);
  return{buy,test,reorder:pm.actions.filter(x=>x.action==='REORDER').slice(0,5),stop:pm.actions.filter(x=>x.action==='STOP/REDUCE').slice(0,5),portfolio:pm};
}

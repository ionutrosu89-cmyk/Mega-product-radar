import {normalizeMarketObservation} from './market-observation-v1.js';

export const HISTORICAL_WINDOWS_V1=Object.freeze([
  Object.freeze({key:'24H',hours:24,priority:1}),
  Object.freeze({key:'7D',hours:24*7,priority:2}),
  Object.freeze({key:'30D',hours:24*30,priority:3}),
  Object.freeze({key:'90D',hours:24*90,priority:4})
]);

const text=v=>String(v??'').trim();
const validIso=v=>{const t=Date.parse(text(v));return Number.isFinite(t)?new Date(t).toISOString():null;};
const scopeOf=x=>`${x.platform}|${x.externalId}|${text(x.surface)||'DEFAULT'}`;

function normalizedSeries(history=[]){
  const groups=new Map();
  for(const raw of history||[]){
    const n=normalizeMarketObservation(raw);
    if(!n.ok)continue;
    const x=n.observation,k=scopeOf(x);
    if(!groups.has(k))groups.set(k,[]);
    groups.get(k).push(x);
  }
  return [...groups.entries()].map(([scopeKey,rows])=>({scopeKey,rows:rows.sort((a,b)=>a.observedAt.localeCompare(b.observedAt))}));
}

function lastSatisfiedWindow(rows=[],windowHours){
  if(rows.length<2)return null;
  const latestAt=Date.parse(rows.at(-1).observedAt);
  let candidate=null;
  for(const row of rows.slice(0,-1)){
    const hours=(latestAt-Date.parse(row.observedAt))/3600000;
    if(hours>=windowHours)candidate=row;
  }
  return candidate;
}

export function buildHistoricalSchedule(history=[],{now=new Date().toISOString(),windows=HISTORICAL_WINDOWS_V1}={}){
  const nowIso=validIso(now);
  if(!nowIso){const e=new Error('SCHEDULER_NOW_INVALID');e.code='SCHEDULER_NOW_INVALID';throw e;}
  const nowMs=Date.parse(nowIso),items=[];
  for(const {scopeKey,rows} of normalizedSeries(history)){
    const latest=rows.at(-1),latestMs=Date.parse(latest.observedAt);
    for(const window of windows){
      const dueAt=new Date(latestMs+window.hours*3600000).toISOString();
      const satisfiedBy=lastSatisfiedWindow(rows,window.hours);
      const due=nowMs>=Date.parse(dueAt)&&!satisfiedBy;
      items.push(Object.freeze({
        scopeKey,canonicalProductId:latest.canonicalProductId||null,decisionEligible:Boolean(latest.canonicalProductId),platform:latest.platform,externalId:latest.externalId,surface:latest.surface||null,
        window:window.key,windowHours:window.hours,priority:window.priority,lastObservedAt:latest.observedAt,dueAt,status:satisfiedBy?'WINDOW_SATISFIED':due?'DUE':'WAITING',
        satisfiedByObservedAt:satisfiedBy?.observedAt||null,automaticExecutionAllowed:false,paidCallsTriggered:0,purchaseAuthorized:false
      }));
    }
  }
  const dueItems=items.filter(x=>x.status==='DUE').sort((a,b)=>a.priority-b.priority||a.dueAt.localeCompare(b.dueAt)||a.scopeKey.localeCompare(b.scopeKey));
  return Object.freeze({
    schemaVersion:'MPR_HISTORICAL_SCHEDULER_V1',generatedAt:nowIso,windows:Object.freeze(windows.map(x=>({...x}))),seriesCount:new Set(items.map(x=>x.scopeKey)).size,totalItems:items.length,dueCount:dueItems.length,
    dueItems:Object.freeze(dueItems),items:Object.freeze(items),policy:'SAME_PLATFORM_EXTERNAL_ID_SURFACE_ONLY; 24H_7D_30D_90D_WINDOWS; SCHEDULE_DOES_NOT_EXECUTE_PROVIDER_CALLS; TITLE_NEVER_BINDS_HISTORY',
    automaticExecutionAllowed:false,providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false
  });
}

export function nextHistoricalDue(schedule={}){
  const waiting=(schedule.items||[]).filter(x=>x.status==='WAITING').sort((a,b)=>a.dueAt.localeCompare(b.dueAt)||a.priority-b.priority);
  return waiting[0]||null;
}

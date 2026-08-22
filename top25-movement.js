import {hardenTop25Evidence} from './top25-evidence.js';

const STORAGE_KEY='mpro_top25_snapshots_v1';
const MAX_SNAPSHOTS_PER_NICHE=8;

export function top25ProductKey(product){
  return String(product?.name||'')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

export function buildTop25Snapshot(niche,reviewedAt){
  const products=Array.isArray(niche?.products)?niche.products.slice(0,25):[];
  return {
    nicheId:String(niche?.id||''),
    reviewedAt:String(reviewedAt||''),
    products:products.map((raw,index)=>{
      const p=hardenTop25Evidence(raw);
      return {
        key:top25ProductKey(raw),
        name:String(raw?.name||''),
        internalRank:Number.isInteger(raw?.rank)?raw.rank:index+1,
        sourceRank:p.sourceRankObserved&&Number.isInteger(p.sourceRank)?p.sourceRank:null
      };
    })
  };
}

export function compareTop25Snapshots(current,previous){
  const previousProducts=new Map((previous?.products||[]).map(p=>[p.key,p]));
  const hasPrevious=Boolean(previous&&Array.isArray(previous.products));
  const movements=new Map();

  for(const product of current?.products||[]){
    const before=previousProducts.get(product.key);
    if(!hasPrevious){
      movements.set(product.key,{status:'BASELINE',delta:null,previousRank:null,sourceDelta:null,previousSourceRank:null});
      continue;
    }
    if(!before){
      movements.set(product.key,{status:'NEW',delta:null,previousRank:null,sourceDelta:null,previousSourceRank:null});
      continue;
    }
    const delta=Number(before.internalRank)-Number(product.internalRank);
    const status=delta>0?'UP':delta<0?'DOWN':'STABLE';
    const sourceComparable=Number.isInteger(before.sourceRank)&&Number.isInteger(product.sourceRank);
    const sourceDelta=sourceComparable?Number(before.sourceRank)-Number(product.sourceRank):null;
    movements.set(product.key,{
      status,
      delta,
      previousRank:before.internalRank,
      sourceDelta,
      previousSourceRank:sourceComparable?before.sourceRank:null
    });
  }
  return movements;
}

export function movementDisplay(movement){
  if(!movement||movement.status==='BASELINE')return {label:'BAZĂ',tone:'base',detail:'Prima observație'};
  if(movement.status==='NEW')return {label:'NEW',tone:'new',detail:'Intrare nouă în Top 25'};
  if(movement.status==='UP')return {label:`↑ ${Math.abs(movement.delta)}`,tone:'up',detail:`A urcat ${Math.abs(movement.delta)} poziții`};
  if(movement.status==='DOWN')return {label:`↓ ${Math.abs(movement.delta)}`,tone:'down',detail:`A coborât ${Math.abs(movement.delta)} poziții`};
  return {label:'MENȚINUT',tone:'stable',detail:'Poziție menținută'};
}

export function sourceMovementDisplay(movement){
  if(!movement||!Number.isFinite(movement.sourceDelta))return null;
  if(movement.sourceDelta>0)return `↑ ${Math.abs(movement.sourceDelta)}`;
  if(movement.sourceDelta<0)return `↓ ${Math.abs(movement.sourceDelta)}`;
  return 'menținut';
}

export function upsertTop25SnapshotHistory(history,current){
  const rows=Array.isArray(history)?history.filter(Boolean):[];
  const withoutSame=rows.filter(x=>!(x.nicheId===current.nicheId&&x.reviewedAt===current.reviewedAt));
  const next=[...withoutSame,current];
  const byNiche=new Map();
  for(const row of next){
    const arr=byNiche.get(row.nicheId)||[];
    arr.push(row);
    byNiche.set(row.nicheId,arr);
  }
  return Array.from(byNiche.values()).flatMap(arr=>arr
    .sort((a,b)=>String(a.reviewedAt).localeCompare(String(b.reviewedAt)))
    .slice(-MAX_SNAPSHOTS_PER_NICHE));
}

function readHistory(storage){
  try{
    const raw=storage?.getItem?.(STORAGE_KEY);
    const parsed=raw?JSON.parse(raw):[];
    return Array.isArray(parsed)?parsed:[];
  }catch{return [];}
}

function writeHistory(storage,history){
  try{storage?.setItem?.(STORAGE_KEY,JSON.stringify(history));}catch{}
}

export function prepareTop25Movement(niche,reviewedAt,storage=globalThis?.localStorage){
  const current=buildTop25Snapshot(niche,reviewedAt);
  const history=readHistory(storage);
  const previous=history
    .filter(x=>x.nicheId===current.nicheId&&x.reviewedAt!==current.reviewedAt)
    .sort((a,b)=>String(b.reviewedAt).localeCompare(String(a.reviewedAt)))[0]||null;
  const movements=compareTop25Snapshots(current,previous);
  const nextHistory=upsertTop25SnapshotHistory(history,current);
  writeHistory(storage,nextHistory);
  return {
    movements,
    previousReviewedAt:previous?.reviewedAt||null,
    currentReviewedAt:current.reviewedAt,
    trackingStatus:previous?'TRACKING':'BASELINE',
    historyMode:'LOCAL'
  };
}

export async function prepareTop25MovementCentral(niche,reviewedAt,{fetchImpl=globalThis?.fetch,storage=globalThis?.localStorage}={}){
  const current=buildTop25Snapshot(niche,reviewedAt);
  if(typeof fetchImpl!=='function') return prepareTop25Movement(niche,reviewedAt,storage);
  try{
    const response=await fetchImpl(`/api/top25/history?niche=${encodeURIComponent(current.nicheId)}`,{headers:{accept:'application/json'},cache:'no-store'});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload=await response.json();
    if(!payload?.ok||payload.mode!=='CENTRAL') throw new Error('Central history unavailable');
    const serverCurrent=payload.current&&Array.isArray(payload.current.products)?payload.current:current;
    const previous=payload.previous&&Array.isArray(payload.previous.products)?payload.previous:null;
    return {
      movements:compareTop25Snapshots(serverCurrent,previous),
      previousReviewedAt:previous?.reviewedAt||null,
      currentReviewedAt:serverCurrent.reviewedAt||current.reviewedAt,
      trackingStatus:previous?'TRACKING':'BASELINE',
      historyMode:'CENTRAL'
    };
  }catch{
    return prepareTop25Movement(niche,reviewedAt,storage);
  }
}

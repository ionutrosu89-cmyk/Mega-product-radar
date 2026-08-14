import fs from 'node:fs/promises';

const LIVE='market-intelligence-live.json';
const HISTORY='market-intelligence-history.json';
const OUTPUT='watchlist-live.json';
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const round=v=>Math.round(num(v)*10)/10;

async function read(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}

function previousSnapshot(history,name){
  const key=String(name||'').trim().toLowerCase();
  const snaps=history?.products?.[key]?.snapshots;
  if(!Array.isArray(snaps)||snaps.length<2)return null;
  return snaps[snaps.length-2];
}

function actionFor(p,delta){
  const r=p?.opportunityRanking||{};
  const t=p?.trendIntelligence||{};
  const blockers=Array.isArray(r.blockers)?r.blockers:[];
  if(r.tier==='TOP OPORTUNITATE'&&p?.launchScore?.enoughEvidence)return 'VERIFICĂ PENTRU TEST';
  if(['ACCELERATING','RISING'].includes(t.status)&&delta.launch>0)return 'URMĂREȘTE ACUM';
  if(blockers.some(x=>String(x).includes('preț')))return 'VALIDEAZĂ PREȚUL';
  if(blockers.some(x=>String(x).includes('competi')))return 'VALIDEAZĂ COMPETIȚIA RO';
  if(blockers.some(x=>String(x).includes('istoric')))return 'MAI AȘTEAPTĂ DATE';
  if(r.tier==='DE VALIDAT')return 'COMPLETEAZĂ DOVEZILE';
  return 'MONITORIZEAZĂ';
}

function urgency(p,delta){
  const r=p?.opportunityRanking||{};
  const t=p?.trendIntelligence||{};
  let score=num(r.score)*0.65+Math.max(-20,Math.min(20,num(t.score)))*0.8;
  score+=Math.max(-15,Math.min(15,delta.launch))*1.2;
  score+=Math.max(-15,Math.min(15,delta.demand))*0.8;
  if(r.tier==='TOP OPORTUNITATE')score+=12;
  else if(r.tier==='URMĂREȘTE PRIORITAR')score+=7;
  if(['COOLING','DECLINING'].includes(t.status))score-=8;
  return round(Math.max(0,Math.min(100,score)));
}

const live=await read(LIVE,{products:[]});
const history=await read(HISTORY,{products:{}});
const rows=(Array.isArray(live.products)?live.products:[]).map(p=>{
  const prev=previousSnapshot(history,p.name);
  const delta={
    launch:prev?round(num(p?.launchScore?.score)-num(prev.launch)):0,
    demand:prev?round(num(p?.demand?.score)-num(prev.demand)):0,
    marketGap:prev?round(num(p?.marketGap?.score)-num(prev.marketGap)):0,
    competition:prev?round(num(p?.competition?.pressure)-num(prev.competitionPressure)):0,
    sourcing:prev?round(num(p?.sourcing?.score)-num(prev.sourcing)):0,
    margin:prev?round(num(p?.economics?.margin)-num(prev.margin)):0,
    roi:prev?round(num(p?.economics?.roi)-num(prev.roi)):0
  };
  const changed=Boolean(prev)&&Object.values(delta).some(v=>Math.abs(num(v))>=0.5);
  return {
    name:p.name,cat:p.cat,imageUrl:p.imageUrl||'',checkedAt:p.checkedAt||live.updatedAt||null,
    rank:num(p?.opportunityRanking?.rank),opportunityScore:num(p?.opportunityRanking?.score),tier:p?.opportunityRanking?.tier||'DE CERCETAT',
    launchScore:num(p?.launchScore?.score),verdict:p?.launchScore?.verdict||'CERCETEAZĂ',trend:p?.trendIntelligence?.status||'INSUFICIENT',trendScore:num(p?.trendIntelligence?.score),
    reasons:Array.isArray(p?.opportunityRanking?.reasons)?p.opportunityRanking.reasons:[],blockers:Array.isArray(p?.opportunityRanking?.blockers)?p.opportunityRanking.blockers:[],
    delta,changed,hasPrevious:Boolean(prev),action:actionFor(p,delta),urgency:0
  };
}).map(x=>({...x,urgency:urgency(x,x.delta)}));

rows.sort((a,b)=>b.urgency-a.urgency||a.rank-b.rank);
const selected=rows.filter(x=>['TOP OPORTUNITATE','URMĂREȘTE PRIORITAR','DE VALIDAT'].includes(x.tier)||x.changed||['ACCELERATING','RISING'].includes(x.trend)).slice(0,10);
const fallback=selected.length?selected:rows.slice(0,10);
const output={
  version:'1.0',updatedAt:new Date().toISOString(),sourceUpdatedAt:live.updatedAt||null,
  policy:'Watchlist-ul prioritizează atenția și schimbările dintre scanări. Nu schimbă verdictul TEST/CUMPĂRĂ și nu reprezintă probabilitate de succes.',
  stats:{total:fallback.length,changed:fallback.filter(x=>x.changed).length,urgent:fallback.filter(x=>x.urgency>=65).length,needsValidation:fallback.filter(x=>x.action.includes('VALIDEAZĂ')||x.action.includes('DOVEZILE')).length},
  items:fallback
};
await fs.writeFile(OUTPUT,JSON.stringify(output,null,2)+'\n');
console.log(`Smart Watchlist: ${output.stats.total} produse, ${output.stats.changed} schimbate, ${output.stats.urgent} urgente.`);

import fs from 'node:fs/promises';

const LIVE='market-intelligence-live.json';
const HISTORY='market-intelligence-history.json';

async function read(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
const round=v=>Math.round(Number(v||0)*10)/10;
const clamp=(n,min=-100,max=100)=>Math.max(min,Math.min(max,Number.isFinite(Number(n))?Number(n):0));

function slope(snaps,key){
  if(!Array.isArray(snaps)||snaps.length<2)return null;
  const pts=snaps.slice(-8).map((s,i)=>({x:i,y:Number(s?.[key])})).filter(p=>Number.isFinite(p.y));
  if(pts.length<2)return null;
  const n=pts.length, sx=pts.reduce((a,p)=>a+p.x,0), sy=pts.reduce((a,p)=>a+p.y,0);
  const sxy=pts.reduce((a,p)=>a+p.x*p.y,0), sx2=pts.reduce((a,p)=>a+p.x*p.x,0);
  const den=n*sx2-sx*sx;
  return den?round((n*sxy-sx*sy)/den):0;
}

function trendFor(rec){
  const snaps=Array.isArray(rec?.snapshots)?rec.snapshots:[];
  if(snaps.length<2)return {status:'INSUFICIENT',score:0,confidence:'SCĂZUTĂ',sampleCount:snaps.length,signals:[],note:'Sunt necesare cel puțin 2 observații pentru direcție.'};
  const latest=snaps[snaps.length-1], prev=snaps[snaps.length-2];
  const launchSlope=slope(snaps,'launch')??0;
  const demandSlope=slope(snaps,'demand')??0;
  const gapSlope=slope(snaps,'marketGap')??0;
  const competitionSlope=slope(snaps,'competitionPressure')??0;
  const sourcingSlope=slope(snaps,'sourcing')??0;
  const evidenceSlope=slope(snaps,'evidenceCoverage')??0;
  let score=launchSlope*2.2+demandSlope*1.6+gapSlope*1.2+sourcingSlope*0.8+evidenceSlope*0.6-competitionSlope*1.2;
  score=round(clamp(score));
  const signals=[];
  if(demandSlope>=2)signals.push('cerere în accelerare');
  if(gapSlope>=2)signals.push('gap în creștere');
  if(competitionSlope<=-2)signals.push('presiune RO în scădere');
  if(competitionSlope>=2)signals.push('presiune RO în creștere');
  if(sourcingSlope>=2)signals.push('sourcing se îmbunătățește');
  if(evidenceSlope>=2)signals.push('acoperire dovezi în creștere');
  const deltaLaunch=round(Number(latest?.launch||0)-Number(prev?.launch||0));
  const deltaDemand=round(Number(latest?.demand||0)-Number(prev?.demand||0));
  let status='STABIL';
  if(score>=12)status='ACCELERATING';
  else if(score>=4)status='RISING';
  else if(score<=-12)status='DECLINING';
  else if(score<=-4)status='COOLING';
  const confidence=snaps.length>=6?'RIDICATĂ':snaps.length>=3?'MEDIE':'SCĂZUTĂ';
  return {status,score,confidence,sampleCount:snaps.length,deltaLaunch,deltaDemand,slopes:{launch:launchSlope,demand:demandSlope,marketGap:gapSlope,competition:competitionSlope,sourcing:sourcingSlope,evidence:evidenceSlope},signals,note:'Trend calculat exclusiv din istoricul intern al Radarului; nu reprezintă volum de vânzări.'};
}

const live=await read(LIVE,{products:[]});
const history=await read(HISTORY,{products:{}});
for(const p of Array.isArray(live.products)?live.products:[]){
  const key=String(p?.name||'').trim().toLowerCase();
  p.trendIntelligence=trendFor(history?.products?.[key]);
}
live.stats=live.stats||{};
live.stats.accelerating=(live.products||[]).filter(p=>p?.trendIntelligence?.status==='ACCELERATING').length;
live.stats.rising=(live.products||[]).filter(p=>['ACCELERATING','RISING'].includes(p?.trendIntelligence?.status)).length;
live.stats.cooling=(live.products||[]).filter(p=>['COOLING','DECLINING'].includes(p?.trendIntelligence?.status)).length;
live.trendPolicy='Trend Intelligence folosește numai snapshoturile istorice interne și nu modifică verdictul TEST/CUMPĂRĂ.';
await fs.writeFile(LIVE,JSON.stringify(live,null,2)+'\n');
console.log(`Trend Intelligence: ${live.stats.accelerating||0} accelerating, ${live.stats.rising||0} rising, ${live.stats.cooling||0} cooling.`);

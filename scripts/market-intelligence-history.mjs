import fs from 'node:fs/promises';

const LIVE='market-intelligence-live.json';
const HISTORY='market-intelligence-history.json';
const MAX_SNAPSHOTS=120;

async function read(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
const live=await read(LIVE,{products:[]});
const history=await read(HISTORY,{version:'1.0',updatedAt:null,products:{}});
const now=live.updatedAt||new Date().toISOString();
history.version='1.0';
history.updatedAt=now;
history.products=history.products&&typeof history.products==='object'?history.products:{};

for(const p of Array.isArray(live.products)?live.products:[]){
  const key=String(p.name||'').trim().toLowerCase();
  if(!key)continue;
  const rec=history.products[key]||{name:p.name,cat:p.cat||'Altele',firstSeenAt:now,snapshots:[]};
  rec.name=p.name;
  rec.cat=p.cat||rec.cat||'Altele';
  const snapshot={
    at:now,
    launch:Number(p?.launchScore?.score||0),
    verdict:p?.launchScore?.verdict||'CERCETEAZĂ',
    demand:Number(p?.demand?.score||0),
    demandConfidence:p?.demand?.confidence||'SCĂZUTĂ',
    marketGap:Number(p?.marketGap?.score||0),
    marketGapLabel:p?.marketGap?.label||'DATE INSUFICIENTE',
    competitionPressure:Number(p?.competition?.pressure||0),
    competitorSaturation:Number(p?.competitors?.saturationScore||0),
    romaniaDomains:Number(p?.competitors?.romania?.domainCount||0),
    foreignDomains:Number(p?.competitors?.foreign?.domainCount||0),
    sourcing:Number(p?.sourcing?.score||0),
    margin:Number(p?.economics?.margin||0),
    roi:Number(p?.economics?.roi||0),
    profit:Number(p?.economics?.profit||0),
    evidenceCoverage:Number(p?.evidenceCoverage?.coverageScore||0),
    keywordProvider:p?.keywordDemand?.provider||'OPEN_WEB_PROXY',
    keywordVolume:p?.keywordDemand?.searchVolume??null
  };
  const last=Array.isArray(rec.snapshots)&&rec.snapshots.length?rec.snapshots[rec.snapshots.length-1]:null;
  const materiallySame=last&&['launch','verdict','demand','marketGap','competitionPressure','competitorSaturation','romaniaDomains','foreignDomains','sourcing','margin','roi','keywordProvider','keywordVolume'].every(k=>JSON.stringify(last[k])===JSON.stringify(snapshot[k]));
  if(!materiallySame){
    rec.snapshots=[...(Array.isArray(rec.snapshots)?rec.snapshots:[]),snapshot].slice(-MAX_SNAPSHOTS);
  }else if(last){
    last.at=now;
  }
  rec.lastSeenAt=now;
  rec.snapshotCount=rec.snapshots.length;
  history.products[key]=rec;
}

await fs.writeFile(HISTORY,JSON.stringify(history,null,2)+'\n');
console.log(`Market Intelligence history: ${Object.keys(history.products).length} produse urmărite.`);

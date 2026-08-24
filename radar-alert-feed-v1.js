const num=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
const text=v=>String(v??'').trim();

const PRIORITY={CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3};

function alertFromRow(row={}){
  const productKey=row.productKey||row.identity||null;
  const title=row.title||row.name||productKey||'Produs';
  const signal=text(row.signal).toUpperCase();
  const tier=text(row.tier).toUpperCase();
  const marketScore=num(row.marketOpportunityScore??row.trendScore);
  const gapScore=num(row.romaniaGapScore??row.romaniaGap?.score);
  const alerts=[];

  if(tier==='BREAKOUT_CANDIDATE')alerts.push({type:'BREAKOUT_CANDIDATE',priority:'CRITICAL',productKey,title,score:marketScore,reason:'Trend global puternic + Romania Gap ridicat',action:'OPEN_RADAR_DOSSIER'});
  else if(tier==='HIGH_OPPORTUNITY')alerts.push({type:'HIGH_OPPORTUNITY',priority:'HIGH',productKey,title,score:marketScore,reason:'Oportunitate de piață peste pragul prioritar',action:'ADD_TO_WATCHLIST'});

  if(signal==='NEW_AND_ACCELERATING')alerts.push({type:'NEW_AND_ACCELERATING',priority:'HIGH',productKey,title,score:marketScore,reason:'Produs nou cu accelerație pozitivă în istoricul public',action:'OPEN_TREND_HISTORY'});
  else if(signal==='RISING_FAST')alerts.push({type:'RISING_FAST',priority:'MEDIUM',productKey,title,score:marketScore,reason:'Rank-ul public se îmbunătățește rapid',action:'OPEN_TREND_HISTORY'});
  else if(signal==='COOLING')alerts.push({type:'COOLING',priority:'MEDIUM',productKey,title,score:marketScore,reason:'Semnalul de trend se deteriorează',action:'REVIEW_WATCHLIST'});

  if(gapScore!==null&&gapScore>=80)alerts.push({type:'ROMANIA_GAP_VERY_HIGH',priority:'HIGH',productKey,title,score:gapScore,reason:'Cerere/semnal extern bun cu saturație locală relativ redusă',action:'OPEN_ROMANIA_GAP'});

  return alerts;
}

export function buildRadarAlertFeed(rows=[],{maxAlerts=50,previousAlertKeys=[]}={}){
  const seenPrevious=new Set((previousAlertKeys||[]).map(String));
  const raw=[];
  for(const row of rows||[])raw.push(...alertFromRow(row));

  const deduped=[];const seen=new Set();
  for(const a of raw){
    const key=`${a.productKey||'UNKNOWN'}:${a.type}`;
    if(seen.has(key))continue;
    seen.add(key);
    deduped.push({...a,key,isNew:!seenPrevious.has(key)});
  }

  deduped.sort((a,b)=>(PRIORITY[a.priority]??9)-(PRIORITY[b.priority]??9)||(b.score??-1)-(a.score??-1)||String(a.title).localeCompare(String(b.title)));
  const limit=Math.max(1,Math.min(200,Number(maxAlerts)||50));
  const alerts=deduped.slice(0,limit);
  return {
    generated:raw.length,
    unique:deduped.length,
    returned:alerts.length,
    newCount:alerts.filter(x=>x.isNew).length,
    byPriority:Object.fromEntries(['CRITICAL','HIGH','MEDIUM','LOW'].map(p=>[p,alerts.filter(x=>x.priority===p).length])),
    alerts,
    policy:'ALERTS_ARE_EXPLAINABLE_INTELLIGENCE_NOT_SALES_OR_PURCHASE_INSTRUCTIONS',
    paidCallsTriggered:0,
    externalNotificationsSent:0,
    purchaseAuthorized:false
  };
}

export function alertKeys(feed={}){
  return (feed.alerts||[]).map(x=>x.key).filter(Boolean);
}

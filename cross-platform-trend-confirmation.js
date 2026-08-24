const text=v=>String(v??'').replace(/\s+/g,' ').trim();
const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null;};
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

const POSITIVE=new Set(['NEW_AND_ACCELERATING','RISING_FAST','PERSISTENT_BESTSELLER']);
const NEGATIVE=new Set(['COOLING']);

function latestByIdentity(signals=[]){
  const map=new Map();
  for(const row of signals||[]){
    const identity=text(row?.identity);if(!identity)continue;
    const observed=Date.parse(row?.observedAt??row?.lastSeenAt??'');
    const current=map.get(identity);
    if(!current||(!Number.isFinite(current._t)&&Number.isFinite(observed))||(Number.isFinite(observed)&&observed>current._t))map.set(identity,{...row,_t:observed});
  }
  return map;
}

function platformOf(row={}){
  const explicit=text(row.platform).toUpperCase();
  if(explicit)return explicit;
  const identity=text(row.identity);
  const prefix=identity.includes(':')?identity.split(':')[0]:'';
  return prefix.toUpperCase()||'UNKNOWN';
}

export function confirmCrossPlatformTrend(signals=[],reviewedMappings=[]){
  const latest=latestByIdentity(signals);
  const rows=[];const rejected=[];
  for(const mapping of reviewedMappings||[]){
    const canonicalKey=text(mapping?.canonicalKey);
    const identities=[...new Set((mapping?.identities||[]).map(text).filter(Boolean))];
    if(!canonicalKey||identities.length<2){rejected.push({mapping,error:'REVIEWED_MAPPING_REQUIRES_CANONICAL_KEY_AND_2_IDENTITIES'});continue;}
    if(mapping?.reviewStatus!=='MANUALLY_REVIEWED'){rejected.push({mapping,error:'MANUAL_REVIEW_REQUIRED'});continue;}
    const evidence=identities.map(id=>latest.get(id)).filter(Boolean).map(row=>({...row,platform:platformOf(row)}));
    const byPlatform=new Map();
    for(const row of evidence){
      const current=byPlatform.get(row.platform);
      const confidence=n(row.trendConfidence??row.confidence)??0;
      const currentConfidence=n(current?.trendConfidence??current?.confidence)??-1;
      if(!current||confidence>currentConfidence)byPlatform.set(row.platform,row);
    }
    const independent=[...byPlatform.values()];
    const positive=independent.filter(x=>POSITIVE.has(text(x.signal).toUpperCase()));
    const negative=independent.filter(x=>NEGATIVE.has(text(x.signal).toUpperCase()));
    const conflict=positive.length>0&&negative.length>0;
    let status='UNCONFIRMED';
    if(conflict)status='CONFLICTING';
    else if(positive.length>=3)status='STRONGLY_CONFIRMED';
    else if(positive.length>=2)status='CONFIRMED';
    else if(negative.length>=2)status='CONFIRMED_COOLING';
    const avgConfidence=independent.length?independent.reduce((s,x)=>s+(n(x.trendConfidence??x.confidence)??0),0)/independent.length:0;
    const breadthScore=clamp(independent.length>=4?100:independent.length/4*100);
    const agreementBase=independent.length?Math.max(positive.length,negative.length)/independent.length*100:0;
    const confirmationScore=Number((breadthScore*0.45+agreementBase*0.35+clamp(avgConfidence)*0.20).toFixed(1));
    rows.push({canonicalKey,status,confirmationScore,platformCount:independent.length,positivePlatforms:positive.map(x=>x.platform),negativePlatforms:negative.map(x=>x.platform),conflict,platformSignals:independent.map(x=>({identity:x.identity,platform:x.platform,signal:x.signal,trendConfidence:n(x.trendConfidence??x.confidence)})),mappingEvidence:'MANUALLY_REVIEWED_CANONICAL_GROUP',autoMerged:false,salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false});
  }
  const priority={STRONGLY_CONFIRMED:0,CONFIRMED:1,CONFIRMED_COOLING:2,CONFLICTING:3,UNCONFIRMED:4};
  rows.sort((a,b)=>(priority[a.status]??9)-(priority[b.status]??9)||b.confirmationScore-a.confirmationScore);
  return{groupsReviewed:rows.length,confirmed:rows.filter(x=>x.status==='CONFIRMED'||x.status==='STRONGLY_CONFIRMED').length,conflicting:rows.filter(x=>x.status==='CONFLICTING').length,rejected,rows,semantics:'CROSS_PLATFORM_CONFIRMATION_REQUIRES_MANUALLY_REVIEWED_CANONICAL_MAPPING',autoMergePerformed:false,paidCallsTriggered:0,externalExecutionTriggered:false,purchaseAuthorized:false};
}

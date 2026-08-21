const AMAZON_KEYS=['amazonDE','amazonUS','amazonIT','amazonFR'];
const PLATFORM_LABELS={amazonDE:'Amazon DE',amazonUS:'Amazon US',amazonIT:'Amazon IT',amazonFR:'Amazon FR',tiktok:'TikTok'};

const num=v=>Number(v||0);
const signal=(p,key)=>p?.signals?.[key]||{};

export function evidenceClassOf(p={}){
  const values=Object.values(p?.signals||{}).map(s=>String(s?.evidenceClass||'').toUpperCase());
  if(values.includes('VERIFIED')||String(p?.risingSignal?.evidenceClass||'').toUpperCase()==='VERIFIED')return 'VERIFIED';
  if(values.includes('ESTIMATED'))return 'ESTIMATED';
  return 'DERIVED';
}

export function bestEvidence(p={}){
  for(const key of [...AMAZON_KEYS,'tiktok']){
    const s=signal(p,key);
    if(!s?.present)continue;
    const link=(Array.isArray(s.links)?s.links:[]).find(x=>x?.url);
    return {
      platform:key.startsWith('amazon')?'AMAZON':'TIKTOK',
      market:PLATFORM_LABELS[key]||String(s.label||key),
      evidenceClass:String(s.evidenceClass||'DERIVED').toUpperCase(),
      url:String(link?.url||s.searchUrl||''),
      title:String(link?.title||''),
      observed:true
    };
  }
  if(p?.risingSignal?.eligible){
    return {
      platform:'RISING',
      market:String(p.risingSignal.sourceMarket||'Marketplace extern'),
      evidenceClass:String(p.risingSignal.evidenceClass||'VERIFIED').toUpperCase(),
      url:'',title:'',observed:true
    };
  }
  return {platform:'NONE',market:'Fără sursă verificată',evidenceClass:evidenceClassOf(p),url:'',title:'',observed:false};
}

export function evidencePriority(p={}){
  const best=bestEvidence(p);
  const klass=best.evidenceClass==='VERIFIED'?3000:best.evidenceClass==='ESTIMATED'?2000:1000;
  const platform=best.platform==='AMAZON'?500:best.platform==='TIKTOK'?400:best.platform==='RISING'?300:0;
  const rising=p?.risingSignal?.eligible?200:0;
  const source=String(p.origin||'')==='ORGANIC_RISING'?150:0;
  return klass+platform+rising+source+num(p?.discoveryAnalysis?.score||p?.score);
}

export function sortDiscoverProducts(list=[],mode='BEST'){
  return [...list].sort((a,b)=>{
    if(mode==='RISING')return (num(b?.risingSignal?.score)||num(b?.trendWindows?.d7?.scoreDelta))-(num(a?.risingSignal?.score)||num(a?.trendWindows?.d7?.scoreDelta));
    if(mode==='NEW')return Date.parse(b.firstDiscoveredAt||0)-Date.parse(a.firstDiscoveredAt||0);
    if(mode==='SCORE')return num(b?.discoveryAnalysis?.score||b?.score)-num(a?.discoveryAnalysis?.score||a?.score);
    return evidencePriority(b)-evidencePriority(a);
  });
}

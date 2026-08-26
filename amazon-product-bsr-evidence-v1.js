const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const decode=s=>String(s??'')
  .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/&nbsp;/gi,' ').replace(/&#34;/gi,'"').replace(/&#39;/gi,"'")
  .replace(/&#(\d+);/g,(_,n)=>{const x=Number(n);return Number.isFinite(x)?String.fromCodePoint(x):_;});

function htmlToText(html=''){
  return clean(decode(String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')));
}

export function extractAmazonBestSellerRanks(html,{asin=null}={}){
  const source=String(html??'');
  const text=htmlToText(source);
  const blocked=/robot check|enter the characters you see below|sorry! something went wrong/i.test(text);
  const identity=String(asin??'').trim().toUpperCase();
  const identityConfirmed=!identity||source.toUpperCase().includes(identity);
  if(blocked)return{ok:false,status:'BLOCKED_PAGE',identityConfirmed,entries:[],rankEvidenceCount:0};
  if(!identityConfirmed)return{ok:false,status:'IDENTITY_NOT_CONFIRMED',identityConfirmed:false,entries:[],rankEvidenceCount:0};

  const marker=/best sellers rank/i.exec(text);
  if(!marker)return{ok:true,status:'BSR_BLOCK_NOT_OBSERVED',identityConfirmed,entries:[],rankEvidenceCount:0};
  let window=text.slice(marker.index,marker.index+2400);
  const stop=window.search(/(?:date first available|customer reviews|product warranty|feedback)/i);
  if(stop>0)window=window.slice(0,stop);

  const entries=[];const seen=new Set();
  const re=/#\s*([0-9][0-9,]*)\s+in\s+(.+?)(?=\s+#\s*[0-9]|\s*\(see top|\s*date first available|\s*customer reviews|$)/gi;
  for(const m of window.matchAll(re)){
    const rank=Number(String(m[1]).replace(/,/g,''));
    let category=clean(m[2]).replace(/\s*\(.*$/,'').trim();
    category=category.replace(/\s+(?:See Top.*)$/i,'').trim();
    category=category.replace(/\s+ASIN\s+B[0-9A-Z]{9}(?:\s.*)?$/i,'').trim();
    if(!Number.isInteger(rank)||rank<1||rank>100000000||!category)continue;
    const key=`${rank}|${category.toLowerCase()}`;
    if(seen.has(key))continue;
    seen.add(key);
    entries.push({rank,category,rankEvidenceClass:'EXPLICIT_PRODUCT_BEST_SELLERS_RANK',salesEvidenceClass:'NOT_VERIFIED_SALES'});
  }
  return{
    ok:true,
    status:entries.length?'EXPLICIT_BSR_EVIDENCE_CAPTURED':'BSR_BLOCK_WITHOUT_PARSEABLE_EXPLICIT_RANK',
    identityConfirmed,
    entries,
    rankEvidenceCount:entries.length,
    sourceRank:null,
    policy:'ALL_EXPLICIT_BSR_CATEGORY_RANKS_PRESERVED; NO_ARBITRARY_PRIMARY_RANK; HTML_POSITION_IS_NOT_RANK; RANK_IS_NOT_VERIFIED_SALES'
  };
}

export function buildComparableBsrHistory(observations=[],{minimumHours=24}={}){
  const min=Math.max(24,Number(minimumHours)||24);
  const rows=[];
  for(const obs of observations||[]){
    const asin=String(obs?.asin||obs?.externalId||'').trim().toUpperCase();
    const at=Date.parse(String(obs?.observedAt||''));
    if(!asin||!Number.isFinite(at))continue;
    for(const e of obs?.bsrEntries||[]){
      const rank=Number(e?.rank);const category=clean(e?.category);
      if(!Number.isInteger(rank)||rank<1||!category)continue;
      rows.push({asin,observedAt:new Date(at).toISOString(),at,category,categoryKey:category.toLowerCase(),rank});
    }
  }
  const groups=new Map();
  for(const r of rows){const k=`${r.asin}|${r.categoryKey}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
  const histories=[];
  for(const list of groups.values()){
    list.sort((a,b)=>a.at-b.at);
    const first=list[0],last=list[list.length-1];
    const elapsedHours=(last.at-first.at)/3600000;
    const eligible=list.length>=2&&elapsedHours>=min;
    histories.push({
      asin:first.asin,category:first.category,observationCount:list.length,
      firstObservedAt:first.observedAt,latestObservedAt:last.observedAt,
      firstRank:first.rank,latestRank:last.rank,elapsedHours:Math.round(elapsedHours*1000)/1000,
      rankImprovement:eligible?first.rank-last.rank:null,
      rankVelocityPerDay:eligible?Math.round(((first.rank-last.rank)/(elapsedHours/24))*1000)/1000:null,
      eligibleForRankTrend:eligible,
      salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false
    });
  }
  return{minimumHours:min,histories,trendReadyCount:histories.filter(x=>x.eligibleForRankTrend).length,salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false};
}

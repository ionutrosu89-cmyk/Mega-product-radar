const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

function decodeHtml(value=''){
  return String(value)
    .replace(/&quot;/g,'"').replace(/&#34;/g,'"').replace(/&#39;/g,"'")
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&nbsp;/g,' ');
}

function parseRon(text){
  const raw=clean(text).replace(/\u00a0/g,' ');
  const m=raw.match(/([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:lei|ron)\b/i);
  if(!m)return null;
  let token=m[1].replace(/\s/g,'');
  if(token.includes(','))token=token.replace(/\./g,'').replace(',','.');
  const value=Number(token);
  return Number.isFinite(value)&&value>0?value:null;
}

function normalizeProductUrl(raw){
  if(!raw)return null;
  let value=decodeHtml(raw).trim();
  if(value.startsWith('//'))value=`https:${value}`;
  if(value.startsWith('/'))value=`https://www.emag.ro${value}`;
  if(!/^https:\/\/www\.emag\.ro\//i.test(value))return null;
  try{
    const u=new URL(value);
    u.search='';u.hash='';
    return u.toString();
  }catch{return null;}
}

function scoreTitle(title,targetTitle){
  const a=new Set(norm(title).split(/[^a-z0-9]+/).filter(x=>x.length>=3));
  const b=new Set(norm(targetTitle).split(/[^a-z0-9]+/).filter(x=>x.length>=3));
  if(!a.size||!b.size)return 0;
  let hit=0;for(const t of b)if(a.has(t))hit++;
  return hit/b.size;
}

function hardSignals(title){
  const x=norm(title);
  return {
    fiveTier:/\b5\b|cinci/.test(x)&&/(nivel|tier|tav|strat)/.test(x),
    drawer:/sertar|drawer/.test(x),
    twoPenHolders:/(2|doua|doi).{0,20}(suport|holder).{0,20}(pix|pen)/.test(x),
    mesh:/plasa|mesh/.test(x),
    officeOrganizer:/organizator.{0,20}birou|desk.{0,20}organizer/.test(x)
  };
}

export function evaluateRomaniaSellCandidate(candidate={},target={}){
  const title=clean(candidate.title);
  const targetTitle=clean(target.title);
  const priceRon=Number(candidate.priceRon);
  const signals=hardSignals(title);
  const titleCoverage=scoreTitle(title,targetTitle);
  const required=['fiveTier','drawer','twoPenHolders','mesh','officeOrganizer'];
  const matchedHard=required.filter(k=>signals[k]).length;
  const hardCoverage=matchedHard/required.length;
  const comparable=Number.isFinite(priceRon)&&priceRon>0&&titleCoverage>=0.72&&hardCoverage>=0.8;
  return {
    comparable,
    titleCoverage:Number(titleCoverage.toFixed(4)),
    hardCoverage:Number(hardCoverage.toFixed(4)),
    signals,
    blockers:[
      ...(!Number.isFinite(priceRon)||priceRon<=0?['RON_PRICE_REQUIRED']:[]),
      ...(titleCoverage<0.72?['TITLE_COVERAGE_BELOW_THRESHOLD']:[]),
      ...(hardCoverage<0.8?['IDENTITY_SIGNAL_COVERAGE_BELOW_THRESHOLD']:[])
    ]
  };
}

export function parseEmagRomaniaSellSearchHtml(html,target={}){
  const source=String(html??'');
  const lower=source.toLowerCase();
  const blocked=/captcha|access denied|verify you are human|robot|temporarily unavailable/.test(lower);
  const candidates=[];
  const seen=new Set();

  for(const m of source.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{
      const parsed=JSON.parse(decodeHtml(m[1]));
      const nodes=Array.isArray(parsed)?parsed:[parsed];
      const walk=node=>{
        if(!node||typeof node!=='object')return;
        if(Array.isArray(node)){for(const x of node)walk(x);return;}
        const type=String(node['@type']??'').toLowerCase();
        if(type==='product'){
          const offers=Array.isArray(node.offers)?node.offers[0]:node.offers||{};
          const price=Number(String(offers?.price??offers?.lowPrice??'').replace(',','.'));
          const currency=String(offers?.priceCurrency??'').toUpperCase();
          const url=normalizeProductUrl(node.url||offers?.url);
          const title=clean(node.name);
          if(title&&url&&Number.isFinite(price)&&price>0&&(currency==='RON'||currency==='')){
            const key=`${url}|${price}`;if(!seen.has(key)){seen.add(key);candidates.push({title,url,priceRon:price,currency:'RON',source:'JSON_LD'});}
          }
        }
        for(const value of Object.values(node))if(value&&typeof value==='object')walk(value);
      };
      for(const n of nodes)walk(n);
    }catch{}
  }

  const cardPattern=/<a[^>]+href=["']([^"']*\/pd\/[A-Za-z0-9]+\/?[^"']*)["'][^>]*>([\s\S]{0,900}?)<\/a>[\s\S]{0,1200}?([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:lei|ron)\b/gi;
  for(const m of source.matchAll(cardPattern)){
    const url=normalizeProductUrl(m[1]);
    const title=clean(decodeHtml(m[2]).replace(/<[^>]+>/g,' '));
    const priceRon=parseRon(`${m[3]} lei`);
    if(!url||!title||!priceRon)continue;
    const key=`${url}|${priceRon}`;if(seen.has(key))continue;
    seen.add(key);candidates.push({title,url,priceRon,currency:'RON',source:'HTML_CARD'});
  }

  const evaluated=candidates.map(c=>({...c,match:evaluateRomaniaSellCandidate(c,target)}));
  const comparable=evaluated.filter(x=>x.match.comparable).sort((a,b)=>b.match.titleCoverage-a.match.titleCoverage||a.priceRon-b.priceRon);
  const selected=comparable[0]||null;
  return {
    schemaVersion:'MPR_ROMANIA_SELL_PRICE_EVIDENCE_V1',
    market:'RO',marketplace:'EMAG',blocked,
    target:{title:clean(target.title)||null,amazonAsin:target.amazonAsin??null,supplierListingKey:target.supplierListingKey??null},
    candidates:evaluated,
    selected,
    status:!blocked&&selected?'PRICE_OBSERVED_COMPARABLE':'BLOCKED',
    blockers:[...(blocked?['SOURCE_BLOCKED']:[]),...(!selected?['NO_COMPARABLE_CURRENT_RON_PRICE']:[])],
    truthPolicy:{publicListingPriceIsRealizedSale:false,searchResultIsVerifiedIdentity:false,unknownEqualsZero:false,purchaseAuthorized:false}
  };
}

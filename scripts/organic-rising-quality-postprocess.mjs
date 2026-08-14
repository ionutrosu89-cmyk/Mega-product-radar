import fs from 'node:fs/promises';

const LIVE='organic-rising-live.json', CONFIG='organic-rising-config.json';
const read=async(path,fallback)=>{try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}};
const clean=s=>String(s||'').replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10))).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/\s+/g,' ').trim();
const norm=s=>clean(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
function unwrapImage(raw){
  const s=clean(raw);if(!s)return'';
  try{const u=new URL(s);const original=u.searchParams.get('u');if(original&&/^https?:\/\//i.test(original))return original;}catch{}
  return s;
}
function imageOk(raw){const s=unwrapImage(raw);return /^https?:\/\//i.test(s)&&!/\.svg(?:$|\?)/i.test(s)&&!/sprite|transparent|pixel|spacer|loading|placeholder|01rrzVoKd5L/i.test(s);}
const CATEGORY_RULES={
  'Casă & organizare':/organizer|storage|shelf|drawer|closet|home|space saving|holder|rack|bathroom|bed|sofa|furniture/i,
  'Bucătărie':/kitchen|food|pan|pot|fridge|sink|bottle|strainer|cooking|spice|cutting|dish|container/i,
  'Auto':/car|vehicle|auto|seat|headrest|trunk|visor|cup holder|dashboard|windshield/i,
  'Travel':/travel|luggage|suitcase|airplane|passport|packing|trip|flight/i,
  'Copii 3-6':/kids?|child|children|activity|learning|sticker|drawing|toy|car seat|snack tray/i,
  'Baby':/baby|infant|stroller|diaper|feeding|bottle|pacifier|nursery/i,
  'Pet':/pet|dog|cat|puppy|kitten|leash|litter|animal/i,
  'Beauty accesorii':/beauty|makeup|cosmetic|hair|jewelry|nail|brush|skin|face/i,
  'Fitness & recuperare':/fitness|workout|exercise|pilates|yoga|gym|resistance band|massage|muscle|recovery|stretch|training/i
};
function categoryRelevant(p){const re=CATEGORY_RULES[p.category];return re?re.test(`${p.name||''} ${p.query||''}`):true;}
function exactSourceEvidence(p){const list=Array.isArray(p.evidence)?p.evidence:[];const targetUrl=String(p.sourceUrl||'');const targetMarket=String(p.sourceMarketKey||'');
  return list.find(e=>targetUrl&&String(e.url||'')===targetUrl)||list.find(e=>targetMarket&&String(e.market||'')===targetMarket&&norm(e.title)===norm(p.name))||null;
}
function safeInt(v){const n=Number(v);return Number.isInteger(n)&&n>=0?n:null;}
function scoreProduct(p,maxReviews){let s=0;const reviews=safeInt(p.reviewCount);if(reviews!==null&&reviews<=maxReviews)s+=25;if(Number(p.organicPage)===1)s+=20;else if(Number(p.organicPage)===2)s+=12;const sellers=Number(p.observedSellerCount||0);if(sellers<=3)s+=15;else if(sellers<=8)s+=8;const cross=Number(p.crossMarketCount||0);if(cross>=3)s+=18;else if(cross===2)s+=12;const d=p.rankDelta===null||p.rankDelta===undefined?null:Number(p.rankDelta);if(d===null)s+=6;else if(d>=15)s+=20;else if(d>=5)s+=12;else if(d>0)s+=6;else if(d<=-10)s-=10;const ro=Number(p.romaniaCompetition||0);if(ro<=3)s+=15;else if(ro<=8)s+=8;const days=Number(p.daysSinceFirstSeen||0);if(days<=14)s+=8;else if(days<=30)s+=4;if(imageOk(p.image))s+=2;return Math.max(0,Math.min(100,s));}

const data=await read(LIVE,{products:[]}),cfg=await read(CONFIG,{}),maxReviews=Number(cfg.maxReviews||10),maxPage=Number(cfg.maxOrganicPage||2),maxSellers=Number(cfg.maxObservedSellers||8),threshold=Number(cfg.minScoreForFeed||55);
const products=(Array.isArray(data.products)?data.products:[]).map(original=>{
  const p={...original,name:clean(original.name)};const exact=exactSourceEvidence(p);const exactReview=safeInt(exact?.reviewCount);
  p.reviewCount=exactReview;p.reviewStatus=exactReview===null?'NECUNOSCUT':'OBSERVAT_PE_LISTAREA_SURSA';
  p.image=imageOk(p.image)?unwrapImage(p.image):(imageOk(exact?.image)?unwrapImage(exact.image):'');
  p.categoryRelevant=categoryRelevant(p);p.categoryRelevanceStatus=p.categoryRelevant?'POTRIVIRE_CATEGORIE':'NEPOTRIVIRE_CATEGORIE';
  const eligibleReview=exactReview!==null&&exactReview<=maxReviews;const eligiblePage=Number(p.organicPage)>=1&&Number(p.organicPage)<=maxPage;const eligibleSellers=Number(p.observedSellerCount||0)>=1&&Number(p.observedSellerCount||0)<=maxSellers;const notPromoted=p.promoted!==true;
  p.eligibleForFeed=eligibleReview&&eligiblePage&&eligibleSellers&&notPromoted&&p.categoryRelevant;
  p.organicRiseScore=scoreProduct(p,maxReviews);
  p.signal=!p.eligibleForFeed?'⚪ BLOCAT DE FILTRU':p.organicRiseScore>=80?'🔥 URCARE PUTERNICĂ':p.organicRiseScore>=65?'🟢 PROMIȚĂTOR':p.organicRiseScore>=55?'🟡 DE URMĂRIT':'⚪ SLAB';
  p.qualityGate={reviewMax:maxReviews,reviewObserved:eligibleReview,topTwoPages:eligiblePage,lowCompetition:eligibleSellers,notPromoted,categoryRelevant:p.categoryRelevant,exactSourceReview:true};
  return p;
});
products.sort((a,b)=>Number(b.eligibleForFeed)-Number(a.eligibleForFeed)||Number(b.organicRiseScore)-Number(a.organicRiseScore)||Number(b.rankDelta||0)-Number(a.rankDelta||0));
const feed=products.filter(p=>p.eligibleForFeed&&Number(p.organicRiseScore)>=threshold).slice(0,30);
const output={...data,version:'1.5',updatedAt:data.updatedAt||new Date().toISOString(),maxReviews,maxOrganicPage:maxPage,maxObservedSellers:maxSellers,products,feed,feedCount:feed.length,qualityPostprocess:{version:'1.0',at:new Date().toISOString(),exactListingReviewGate:true,categoryRelevanceGate:true,imagePlaceholderFilter:true},policy:'Gate obligatoriu pe listarea sursă: review-uri observate ca număr întreg <=10, poziție organică în maximum pagina 2, rezultat nepromovat când marcajul este detectabil, competiție observată redusă și potrivire cu nișa scanată. Sellerii și competiția RO rămân proxy-uri explicite; câmpurile necunoscute nu sunt inventate.'};
await fs.writeFile(LIVE,JSON.stringify(output,null,2)+'\n');
console.log(`Organic Rising quality gate: ${feed.length}/${products.length} produse în feed strict.`);

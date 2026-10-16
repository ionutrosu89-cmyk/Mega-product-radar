const clean=value=>String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&amp;/g,'&').replace(/[^a-z0-9&+]+/g,' ').replace(/\s+/g,' ');

// Human-reviewed denylist for the public Free funnel. Matching is deliberately
// conservative: a name is blocked only when a reviewed brand phrase is present.
export const ESTABLISHED_BRAND_PHRASES=Object.freeze([
  'adidas','amazon basics','amazon essentials','amazonbasics','avery','barbie','belkin','black decker','bosch','brother','camco','canon','catit','closetmaid','crayola','cricut','delta children','dewalt','dremel','ecotools','felco','fisher price','gaiam','gearit','gerber','hasbro','herschel','honey can do','honeywell','iris usa','jansport','kensington','kidkraft','learning resources','lego','litter genie','liquitex','logitech','makita','marvel','mattel','melissa doug','milwaukee','munchkin','new balance','nike','north face','osprey','park tool','petmate','petsafe','philips','pilot','puma','rain design','rawlings','reebok','rotring','rubbermaid','samsonite','samsung','sanus','sharpie','skechers','skip hop','smith','sony','stanley','steelseries','sterilite','swingline','targus','tessan','travelpro','triggerpoint','tumi','ugreen','valeo','vtech','wagner','wall control','whitmor'
]);

const boundaryMatch=(text,phrase)=>` ${text} `.includes(` ${phrase} `);
const upper=value=>String(value??'').trim().toUpperCase();
export const PUBLIC_BRAND_REVIEW_MAX_AGE_DAYS=30;

function currentBrandReview(review,now){
  const at=Date.parse(review?.reviewedAt||'');
  let evidence;try{evidence=new URL(String(review?.evidenceUrl||''));}catch{return false;}
  return Boolean(String(review?.reviewer||'').trim())&&evidence.protocol==='https:'&&
    Number.isFinite(now.getTime())&&Number.isFinite(at)&&at<=now.getTime()&&
    now.getTime()-at<=PUBLIC_BRAND_REVIEW_MAX_AGE_DAYS*86_400_000;
}

export function classifyPublicBrandGate(product={},options={}){
  const classes=[upper(product.brandPolicyClass),upper(product.commercialGate)];
  if(classes.some(value=>['ESTABLISHED_EXCLUDE','STOP_BRAND_GATE'].includes(value)))return {brandPolicyClass:'ESTABLISHED_EXCLUDE',commercialEligible:false,reason:'Brand consacrat exclus din strategia comercială MPR.'};
  const haystack=clean(`${product.brand||''} ${product.name||''} ${product.title||''}`);
  const matchedBrand=ESTABLISHED_BRAND_PHRASES.find(phrase=>boundaryMatch(haystack,phrase));
  if(matchedBrand)return {brandPolicyClass:'ESTABLISHED_EXCLUDE',commercialEligible:false,matchedBrand,reason:'Brand consacrat exclus; nu îl promovăm ca oportunitate de import.'};
  const now=options?.now instanceof Date?options.now:new Date(options?.now??Date.now());
  const reviewed=upper(product.brandPolicyClass||product.commercialGate)==='GENERIC_PRIVATE_LABEL'&&
    !classes.includes('BRAND_REVIEW_REQUIRED')&&currentBrandReview(product.brandReview,now);
  return {brandPolicyClass:reviewed?'GENERIC_PRIVATE_LABEL':'UNKNOWN_REVIEW',commercialEligible:reviewed,matchedBrand:null,reason:reviewed?'Produs fără brand consacrat, cu revizie documentată recentă.':'Brand neverificat: păstrat doar pentru cercetare privată, exclus din catalogul public.'};
}

export function publicCommerciallyEligible(product={},options={}){
  return classifyPublicBrandGate(product,options).commercialEligible;
}

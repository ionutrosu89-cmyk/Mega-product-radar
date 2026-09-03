const clean=value=>String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&amp;/g,'&').replace(/[^a-z0-9&+]+/g,' ').replace(/\s+/g,' ');

// Human-reviewed denylist for the public Free funnel. Matching is deliberately
// conservative: a name is blocked only when a reviewed brand phrase is present.
export const ESTABLISHED_BRAND_PHRASES=Object.freeze([
  'adidas','amazon basics','amazon essentials','amazonbasics','avery','barbie','belkin','black decker','bosch','brother','camco','canon','catit','closetmaid','crayola','cricut','delta children','dewalt','dremel','ecotools','felco','fisher price','gaiam','gearit','gerber','hasbro','herschel','honey can do','honeywell','iris usa','jansport','kensington','kidkraft','learning resources','lego','litter genie','liquitex','logitech','makita','marvel','mattel','melissa doug','milwaukee','munchkin','new balance','nike','north face','osprey','park tool','petmate','petsafe','philips','pilot','puma','rain design','rawlings','reebok','rotring','rubbermaid','samsonite','samsung','sanus','sharpie','skechers','skip hop','smith','sony','stanley','steelseries','swingline','targus','travelpro','triggerpoint','tumi','ugreen','valeo','vtech','wagner','wall control','whitmor'
]);

const boundaryMatch=(text,phrase)=>` ${text} `.includes(` ${phrase} `);

export function classifyPublicBrandGate(product={}){
  const explicit=String(product.brandPolicyClass||product.commercialGate||'').toUpperCase();
  if(explicit==='ESTABLISHED_EXCLUDE'||explicit==='STOP_BRAND_GATE')return {brandPolicyClass:'ESTABLISHED_EXCLUDE',commercialEligible:false,reason:'Brand consacrat exclus din strategia comercială MPR.'};
  const haystack=clean(`${product.brand||''} ${product.name||product.title||''}`);
  const matchedBrand=ESTABLISHED_BRAND_PHRASES.find(phrase=>boundaryMatch(haystack,phrase));
  if(matchedBrand)return {brandPolicyClass:'ESTABLISHED_EXCLUDE',commercialEligible:false,matchedBrand,reason:'Brand consacrat exclus; nu îl promovăm ca oportunitate de import.'};
  return {brandPolicyClass:explicit==='GENERIC_PRIVATE_LABEL'?'GENERIC_PRIVATE_LABEL':'UNKNOWN_REVIEW',commercialEligible:true,matchedBrand:null,reason:'Generic, brand mic sau brand încă neclasificat; verificarea rămâne obligatorie înainte de sourcing.'};
}

export function publicCommerciallyEligible(product={}){
  return classifyPublicBrandGate(product).commercialEligible;
}

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

const TARGET_SIGNALS=[
  ['5 niveluri','5 nivele','5-tier','5 tier'],
  ['sertar','1 sertar','drawer'],
  ['2 suporturi pentru stilouri','2 suporturi pentru pixuri','doua suporturi pentru pixuri','2 pen holders'],
  ['metal'],
  ['plasa','mesh']
];
const BLOCK_SIGNALS=['captcha','access denied','verify you are human','are you a robot','confirm you are human','forbidden','unusual traffic'];

const hasAny=(text,variants)=>variants.some(v=>norm(text).includes(norm(v)));

function parseRonPrices(text){
  const source=clean(text).replace(/\u00a0/g,' ');
  const found=[];
  for(const m of source.matchAll(/(?:pret\s*)?(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:ron|lei)\b/gi)){
    const value=Number(m[1].replace(',','.'));
    if(Number.isFinite(value)&&value>0)found.push(value);
  }
  return found;
}

export function evaluateJoomRomaniaCandidate(input={}){
  const title=clean(input.title);
  const description=clean(input.description);
  const text=`${title} ${description}`;
  const missingSignals=TARGET_SIGNALS.filter(v=>!hasAny(text,v)).map(v=>v[0]);
  const organizer=/(organizator|organizatoare)/.test(norm(text))&&/(birou|office)/.test(norm(text));
  const priceRon=Number(input.priceRon)>0?Number(input.priceRon):null;
  const comparable=organizer&&missingSignals.length===0&&priceRon!==null;
  return {
    schemaVersion:'MPR_ROMANIA_JOOM_CANDIDATE_V1',
    comparable,
    title:title||null,
    priceRon,
    missingSignals,
    organizer,
    sourceUrl:input.sourceUrl||null,
    evidenceClass:comparable?'DIRECT_OBSERVED_ROMANIA_PUBLIC_MARKETPLACE_PRICE':'DIAGNOSTIC_ONLY',
    truthPolicy:{publicListingPriceIsRealizedSale:false,localizedMarketplaceListingIsVerifiedCanonicalIdentity:false,unknownEqualsZero:false,purchaseAuthorized:false}
  };
}

export function parseJoomRomaniaHtml(html,sourceUrl){
  const source=String(html??'');
  const n=norm(source);
  const blockerSignal=BLOCK_SIGNALS.find(signal=>n.includes(signal))||null;
  if(blockerSignal)return {schemaVersion:'MPR_ROMANIA_JOOM_PRICE_EVIDENCE_V1',market:'RO',marketplace:'JOOM_RO',status:'BLOCKED',blockers:['SOURCE_BLOCKED'],blockerSignal,selected:null,candidates:[],truthPolicy:{publicListingPriceIsRealizedSale:false,localizedMarketplaceListingIsVerifiedCanonicalIdentity:false,unknownEqualsZero:false,purchaseAuthorized:false}};

  const plain=clean(source.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' '));
  const np=norm(plain);
  const anchors=['organizatoare de birou din metal cu plasa cu 5 niveluri','organizator de birou din metal cu plasa cu 5 niveluri'];
  let idx=-1;
  for(const a of anchors){idx=np.indexOf(norm(a));if(idx>=0)break;}
  if(idx<0)return {schemaVersion:'MPR_ROMANIA_JOOM_PRICE_EVIDENCE_V1',market:'RO',marketplace:'JOOM_RO',status:'BLOCKED',blockers:['TARGET_PRODUCT_NOT_FOUND'],blockerSignal:null,selected:null,candidates:[],truthPolicy:{publicListingPriceIsRealizedSale:false,localizedMarketplaceListingIsVerifiedCanonicalIdentity:false,unknownEqualsZero:false,purchaseAuthorized:false}};

  const excerpt=plain.slice(Math.max(0,idx-120),idx+1000);
  const prices=parseRonPrices(excerpt);
  const candidate=evaluateJoomRomaniaCandidate({title:excerpt.slice(0,700),description:excerpt,priceRon:prices[0]??null,sourceUrl});
  return {
    schemaVersion:'MPR_ROMANIA_JOOM_PRICE_EVIDENCE_V1',market:'RO',marketplace:'JOOM_RO',status:candidate.comparable?'OBSERVED':'BLOCKED',
    blockers:candidate.comparable?[]:['NO_COMPARABLE_CURRENT_RON_PRICE'],blockerSignal:null,selected:candidate.comparable?candidate:null,candidates:[candidate],
    truthPolicy:{publicListingPriceIsRealizedSale:false,localizedMarketplaceListingIsVerifiedCanonicalIdentity:false,unknownEqualsZero:false,purchaseAuthorized:false}
  };
}

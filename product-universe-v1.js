import {isCanonicalProductId,requireCanonicalProductId} from './domain-contracts-v1.js';

const text=v=>String(v??'').trim();
const upper=v=>text(v).toUpperCase();
const finite=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);

function aliasKey(alias={}){return `${upper(alias.platform)}::${text(alias.externalId)}`;}
function observationCanonicalId(o={}){return text(o.canonicalProductId||o.canonical_product_id).toLowerCase();}

export function buildProductUniverse({products=[],aliases=[],observations=[]}={}){
  const productById=new Map();
  for(const product of products||[]){
    const id=requireCanonicalProductId(product.canonicalProductId||product.canonical_product_id);
    if(productById.has(id)){const e=new Error('DUPLICATE_CANONICAL_PRODUCT_ID');e.code='DUPLICATE_CANONICAL_PRODUCT_ID';e.canonicalProductId=id;throw e;}
    productById.set(id,Object.freeze({...product,canonicalProductId:id,title:text(product.title||product.name)||null}));
  }

  const aliasBySource=new Map();
  const aliasesByProduct=new Map();
  for(const alias of aliases||[]){
    const id=requireCanonicalProductId(alias.canonicalProductId||alias.canonical_product_id);
    if(!productById.has(id)){const e=new Error('ALIAS_CANONICAL_PRODUCT_NOT_FOUND');e.code='ALIAS_CANONICAL_PRODUCT_NOT_FOUND';e.canonicalProductId=id;throw e;}
    const platform=upper(alias.platform),externalId=text(alias.externalId||alias.external_id);
    if(!platform||!externalId){const e=new Error('ALIAS_SOURCE_IDENTITY_REQUIRED');e.code='ALIAS_SOURCE_IDENTITY_REQUIRED';throw e;}
    const key=`${platform}::${externalId}`;
    const existing=aliasBySource.get(key);
    if(existing&&existing.canonicalProductId!==id){const e=new Error('SOURCE_ALIAS_COLLISION');e.code='SOURCE_ALIAS_COLLISION';e.sourceKey=key;e.firstCanonicalProductId=existing.canonicalProductId;e.secondCanonicalProductId=id;throw e;}
    const normalized=Object.freeze({...alias,canonicalProductId:id,platform,externalId});
    aliasBySource.set(key,normalized);
    const list=aliasesByProduct.get(id)||[];list.push(normalized);aliasesByProduct.set(id,list);
  }

  const observationsByProduct=new Map();
  let boundObservationCount=0,unboundObservationCount=0;
  for(const observation of observations||[]){
    const id=observationCanonicalId(observation);
    if(id&&isCanonicalProductId(id)&&productById.has(id)){
      boundObservationCount++;
      const list=observationsByProduct.get(id)||[];list.push(observation);observationsByProduct.set(id,list);
    }else unboundObservationCount++;
  }

  const rows=[];
  for(const [id,product] of productById){
    const sourceAliases=aliasesByProduct.get(id)||[];
    const obs=observationsByProduct.get(id)||[];
    const latest=obs.slice().sort((a,b)=>Date.parse(b.observedAt||b.observed_at||0)-Date.parse(a.observedAt||a.observed_at||0))[0]||null;
    const price=finite(latest?.price??latest?.metrics?.price);
    const reviews=finite(latest?.reviewCount??latest?.reviews??latest?.metrics?.reviewCount);
    const category=text(product.category||latest?.category)||null;
    rows.push(Object.freeze({
      canonicalProductId:id,
      title:product.title,
      category,
      aliasCount:sourceAliases.length,
      sourcePlatforms:Object.freeze([...new Set(sourceAliases.map(a=>a.platform))].sort()),
      observationCount:obs.length,
      hasDirectSourceIdentity:sourceAliases.length>0,
      hasPriceObservation:price!==null,
      hasReviewObservation:reviews!==null,
      hasCategory:Boolean(category),
      decisionEligible:sourceAliases.length>0
    }));
  }

  const count=rows.length||1;
  const pct=n=>Number(((n/count)*100).toFixed(2));
  const metrics={
    canonicalProducts:rows.length,
    aliases:aliasBySource.size,
    boundObservations:boundObservationCount,
    unboundObservations:unboundObservationCount,
    sourceIdentityCoveragePct:pct(rows.filter(r=>r.hasDirectSourceIdentity).length),
    priceCoveragePct:pct(rows.filter(r=>r.hasPriceObservation).length),
    reviewCoveragePct:pct(rows.filter(r=>r.hasReviewObservation).length),
    categoryCoveragePct:pct(rows.filter(r=>r.hasCategory).length),
    twoPlusObservationsPct:pct(rows.filter(r=>r.observationCount>=2).length),
    threePlusObservationsPct:pct(rows.filter(r=>r.observationCount>=3).length),
    duplicateCanonicalProductIds:0,
    sourceAliasCollisions:0
  };

  return Object.freeze({
    schemaVersion:'MPR_PRODUCT_UNIVERSE_V1',
    products:Object.freeze(rows),
    metrics:Object.freeze(metrics),
    decisionPolicy:'CANONICAL_UUID_REQUIRED; EXACT_PLATFORM_EXTERNAL_ID_ALIAS_DEDUP; TITLE_NEVER_AUTO_MERGES; UNBOUND_OBSERVATIONS_STAY_NON_DECISIONAL',
    purchaseAuthorized:false,
    paidCallsTriggered:0,
    providerSpendEur:0
  });
}

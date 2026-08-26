const text=v=>String(v??'').trim();
const upper=v=>text(v).toUpperCase();
const norm=v=>text(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

export const SEMANTIC_COMPARABILITY_CLASSES=Object.freeze(['EXACT','COMPARABLE','NOT_COMPARABLE','UNKNOWN']);

function phraseMatch(haystack,phrase){
  const h=` ${norm(haystack)} `,p=norm(phrase);
  return Boolean(p&&h.includes(` ${p} `));
}

function extractNumericAttribute(title,rule={}){
  const src=text(title);
  const patterns=Array.isArray(rule.patterns)?rule.patterns:[];
  for(const raw of patterns){
    try{
      const re=new RegExp(raw,'i'),m=src.match(re);
      if(m&&m[1]!==undefined){const n=Number(m[1]);if(Number.isFinite(n))return {value:n,evidenceClass:'DIRECT_OBSERVED',source:'TITLE_EXPLICIT_NUMERIC_ATTRIBUTE'};}
    }catch{}
  }
  return null;
}

function observedAttribute(listing,key,profileRule){
  const explicit=listing?.observedAttributes?.[key];
  if(explicit!==undefined&&explicit!==null&&explicit!=='')return {value:explicit,evidenceClass:upper(listing?.attributeEvidenceClass?.[key])||'DIRECT_OBSERVED',source:'STRUCTURED_ATTRIBUTE'};
  if(profileRule?.type==='number')return extractNumericAttribute(listing?.title,profileRule);
  return null;
}

export function classifyRomaniaListingComparability(listing={},profile={}){
  const comparabilityKey=text(profile.comparabilityKey)||null;
  if(!comparabilityKey)return Object.freeze({classification:'UNKNOWN',confidence:0,reasons:['COMPARABILITY_KEY_REQUIRED'],comparabilityKey:null,evidenceClass:'UNKNOWN'});

  const title=text(listing.title);
  const reasons=[],facts={};
  let directContradiction=false,requiredKnown=0,requiredMatched=0;

  for(const phrase of profile.excludedPhrases||[]){
    if(phraseMatch(title,phrase)){directContradiction=true;reasons.push(`EXCLUDED_PHRASE:${norm(phrase)}`);}
  }

  const required=profile.requiredAttributes||{};
  for(const [key,rule] of Object.entries(required)){
    const obs=observedAttribute(listing,key,rule);
    if(!obs){facts[key]=null;continue;}
    requiredKnown++;
    facts[key]=obs;
    const expected=rule?.equals;
    const same=rule?.type==='number'?Number(obs.value)===Number(expected):norm(obs.value)===norm(expected);
    if(same)requiredMatched++;
    else {directContradiction=true;reasons.push(`ATTRIBUTE_CONTRADICTION:${key}:${obs.value}!=${expected}`);}
  }

  if(directContradiction){
    return Object.freeze({classification:'NOT_COMPARABLE',confidence:95,reasons:Object.freeze(reasons),comparabilityKey,facts:Object.freeze(facts),evidenceClass:'DIRECT_OBSERVED',manualReviewRequired:false});
  }

  const requiredCount=Object.keys(required).length;
  const allRequiredKnown=requiredCount>0&&requiredKnown===requiredCount;
  const allRequiredMatched=allRequiredKnown&&requiredMatched===requiredCount;
  const typePhrases=profile.inclusionPhrases||[];
  const inclusionMatches=typePhrases.filter(p=>phraseMatch(title,p));

  if(allRequiredMatched&&(!typePhrases.length||inclusionMatches.length>0)){
    return Object.freeze({classification:'EXACT',confidence:90,reasons:Object.freeze(['ALL_REQUIRED_ATTRIBUTES_MATCH','PRODUCT_TYPE_SIGNAL_PRESENT']),comparabilityKey,facts:Object.freeze(facts),evidenceClass:'DIRECT_OBSERVED',manualReviewRequired:false});
  }

  if(requiredMatched>0||inclusionMatches.length>0){
    return Object.freeze({classification:'COMPARABLE',confidence:60,reasons:Object.freeze(['PARTIAL_SEMANTIC_MATCH','MANUAL_CONFIRMATION_REQUIRED']),comparabilityKey,facts:Object.freeze(facts),evidenceClass:'DERIVED',manualReviewRequired:true});
  }

  return Object.freeze({classification:'UNKNOWN',confidence:20,reasons:Object.freeze(['INSUFFICIENT_SEMANTIC_EVIDENCE']),comparabilityKey,facts:Object.freeze(facts),evidenceClass:'UNKNOWN',manualReviewRequired:true});
}

export function classifyRomaniaListingsComparability(listings=[],profile={}){
  const rows=(listings||[]).map(listing=>Object.freeze({...listing,semanticComparability:classifyRomaniaListingComparability(listing,profile)}));
  const counts=Object.fromEntries(SEMANTIC_COMPARABILITY_CLASSES.map(k=>[k,rows.filter(x=>x.semanticComparability.classification===k).length]));
  return Object.freeze({schemaVersion:'MPR_ROMANIA_SEMANTIC_COMPARABILITY_V2',comparabilityKey:text(profile.comparabilityKey)||null,rows:Object.freeze(rows),counts:Object.freeze(counts),policy:'EXPLICIT_ATTRIBUTE_CONTRADICTION_CAN_EXCLUDE; TITLE_SIMILARITY_ALONE_NEVER_PROVES_EXACT; PARTIAL_MATCH_REQUIRES_REVIEW; UNKNOWN_STAYS_UNKNOWN',paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false});
}

export const THREE_RING_ROUND_BINDER_PROFILE_V2=Object.freeze({
  comparabilityKey:'THREE_RING_ROUND_RING_BINDERS',
  requiredAttributes:Object.freeze({ringCount:Object.freeze({type:'number',equals:3,patterns:Object.freeze(['(?:^|\\s)([0-9]+)\\s*(?:inele|inel|rings?|ring)(?:\\s|$)'])})}),
  inclusionPhrases:Object.freeze(['binder','biblioraft','dosar']),
  excludedPhrases:Object.freeze(['mecanism','mechanism','lever arch','mecanism cu levier','zippered organizer','organizator cu fermoar'])
});

import {CANONICAL_RULES} from './amazon-romania-candidate-scanner-v1.js';

const norm=v=>String(v??'').toLowerCase().replace(/&amp;/g,'&').replace(/&#34;/g,'"').replace(/[^a-z0-9]+/g,' ').trim();

function asinsFromSnapshot(doc={}){
  const fields=doc.fields||[];
  const ix=fields.indexOf('asin')>=0?fields.indexOf('asin'):fields.indexOf('externalId');
  if(ix<0) throw new Error('snapshot missing asin/externalId');
  const rows=doc.products||doc.snapshots||[];
  return rows.map(r=>r[ix]).filter(Boolean);
}

export function buildAmazonTargetNicheCoverage(catalogueDoc={},snapshotDocs=[]){
  const fields=catalogueDoc.fields||[];
  const ia=fields.indexOf('asin'), it=fields.indexOf('title');
  if(ia<0||it<0) throw new Error('catalogue missing asin/title fields');
  const live=new Set(snapshotDocs.flatMap(x=>asinsFromSnapshot(x.doc)));
  const matches=[];
  for(const row of catalogueDoc.products||[]){
    const asin=row[ia], title=row[it];
    const t=norm(title);
    for(const rule of CANONICAL_RULES){
      if(rule.test(t)) matches.push({
        asin,title,canonicalNicheKey:rule.nicheKey,
        hasFirstLiveObservation:live.has(asin),
        liveObservationPriority:live.has(asin)?'ALREADY_LIVE':'PRIORITIZE_FIRST_LIVE',
        matchReason:'STRICT_TITLE_RULE'
      });
    }
  }
  const byNiche={};
  for(const rule of CANONICAL_RULES){
    const rows=matches.filter(x=>x.canonicalNicheKey===rule.nicheKey);
    byNiche[rule.nicheKey]={catalogueMatches:rows.length,liveMatches:rows.filter(x=>x.hasFirstLiveObservation).length,missingLiveMatches:rows.filter(x=>!x.hasFirstLiveObservation).length};
  }
  return {
    version:'1.0',catalogueSize:(catalogueDoc.products||[]).length,liveObservedUniqueAsins:live.size,
    targetNicheCount:CANONICAL_RULES.length,totalStrictMatches:matches.length,
    liveStrictMatches:matches.filter(x=>x.hasFirstLiveObservation).length,
    missingLiveStrictMatches:matches.filter(x=>!x.hasFirstLiveObservation).length,
    byNiche,matches,
    verifiedSales:false,rankInferred:false,paidCallsTriggered:0,providerSpend:0,purchaseAuthorized:false,
    policy:'BOOTSTRAP_TITLES_ARE_IDENTITY_ONLY; STRICT_CANONICAL_MATCHES_MAY_PRIORITIZE_ZERO_COST_FIRST_LIVE_COLLECTION; NO_RANK_OR_VERIFIED_SALES_INFERENCE; NO_AUTO_EXECUTION; NO_PURCHASE_AUTHORITY'
  };
}

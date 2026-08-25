const norm=v=>String(v??'').toLowerCase().replace(/&amp;/g,'&').replace(/&#34;/g,'"').replace(/[^a-z0-9]+/g,' ').trim();

export const CANONICAL_RULES=[
  {nicheKey:'PACKING_CUBES_SET',test:t=>/\bpacking cubes?\b/.test(t)||/\bluggage packing cubes?\b/.test(t)||/\btravel packing cubes?\b/.test(t)},
  {nicheKey:'CAR_TRUNK_ORGANIZERS',test:t=>/\btrunk organizer\b/.test(t)||(/\bcargo organizer\b/.test(t)&&/\b(car|auto|vehicle|trunk)\b/.test(t))},
  {nicheKey:'UNDER_DESK_CABLE_MANAGEMENT_TRAY',test:t=>/\bunder desk cable\b/.test(t)||/\bcable management tray\b/.test(t)||(/\bcable organizer\b/.test(t)&&/\bdesk\b/.test(t))},
  {nicheKey:'ADJUSTABLE_LAPTOP_STANDS',test:t=>/\b(adjustable )?laptop stand\b/.test(t)||/\bnotebook stand\b/.test(t)}
];

export function titleMapFromCatalogue(doc={}){
  const fields=doc.fields||[];
  const ia=fields.indexOf('asin'), it=fields.indexOf('title');
  if(ia<0||it<0) throw new Error('catalogue missing asin/title fields');
  return new Map((doc.products||[]).map(r=>[r[ia],r[it]]));
}

function rowsFromSnapshot(doc,sourceFile,titleMap){
  const fields=doc.fields||[];
  const list=doc.products||doc.snapshots||[];
  const asinIx=fields.indexOf('asin')>=0?fields.indexOf('asin'):fields.indexOf('externalId');
  const titleIx=fields.indexOf('title');
  const observedAtIx=fields.indexOf('observedAt');
  if(asinIx<0||observedAtIx<0) throw new Error(`snapshot missing identity fields: ${sourceFile}`);
  return list.map(r=>{
    const asin=r[asinIx];
    const title=titleIx>=0?r[titleIx]:titleMap.get(asin);
    if(!title) throw new Error(`catalogue title missing for live ASIN ${asin}`);
    return {asin,title,observedAt:r[observedAtIx],sourceFile,titleSource:titleIx>=0?'LIVE_PRODUCT_PAGE':'BOOTSTRAP_IDENTITY_CATALOGUE'};
  });
}

export function scanAmazonRomaniaCandidates(snapshotDocs=[],catalogueDoc={}){
  const titleMap=titleMapFromCatalogue(catalogueDoc);
  const all=[];
  for(const x of snapshotDocs) all.push(...rowsFromSnapshot(x.doc,x.sourceFile,titleMap));
  const byAsin=new Map();
  for(const r of all){
    const prev=byAsin.get(r.asin);
    if(!prev||String(r.observedAt)>String(prev.observedAt)) byAsin.set(r.asin,r);
  }
  const matches=[];
  for(const row of byAsin.values()){
    const t=norm(row.title);
    for(const rule of CANONICAL_RULES){
      if(rule.test(t)) matches.push({asin:row.asin,title:row.title,firstObservedAt:row.observedAt,sourceSnapshotFile:row.sourceFile,titleSource:row.titleSource,canonicalNicheKey:rule.nicheKey,canonicalMatch:true,matchReason:'STRICT_TITLE_RULE'});
    }
  }
  return {
    version:'1.1',
    scannedUniqueLiveAsins:byAsin.size,
    matchCount:matches.length,
    matches:matches.sort((a,b)=>a.canonicalNicheKey.localeCompare(b.canonicalNicheKey)||a.asin.localeCompare(b.asin)),
    verifiedSales:false,
    rankInferred:false,
    paidCallsTriggered:0,
    providerSpend:0,
    purchaseAuthorized:false,
    policy:'STRICT_TITLE_MATCH_ONLY; BOOTSTRAP_TITLE_MAY_ENRICH_IDENTITY_BUT_NOT_LIVE_OR_RANK_EVIDENCE; LIVE_PRODUCT_PAGE_EVIDENCE_IS_NOT_RANK_OR_VERIFIED_SALES; ZERO_MATCH_IS_VALID; NO_PURCHASE_AUTHORITY'
  };
}

const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const finite=v=>Number.isFinite(Number(v));

const REQUIRED_GROUPS=[
  ['organizator','organizatoare'],
  ['birou','dosare'],
  ['5 niveluri','5 nivele'],
  ['sertar'],
  ['2 suporturi pentru pixuri','doua suporturi pentru pixuri','2 suporturi pixuri'],
  ['metal']
];

export function validateSecondaryRomaniaScreeningPrice(input={},options={}){
  const blockers=[];
  const market=clean(input.market).toUpperCase();
  const currency=clean(input.currency).toUpperCase();
  const evidenceClass=clean(input.evidenceClass).toUpperCase();
  const title=clean(input.title);
  const details=clean(input.details);
  const text=norm(`${title} ${details}`);
  const freshnessUpperBoundDays=finite(input.freshnessUpperBoundDays)?Number(input.freshnessUpperBoundDays):null;
  const maxFreshnessDays=finite(options.maxFreshnessDays)?Number(options.maxFreshnessDays):30;
  const priceRon=finite(input.priceRon)?Number(input.priceRon):null;

  if(market!=='RO')blockers.push('ROMANIA_MARKET_REQUIRED');
  if(currency!=='RON')blockers.push('RON_CURRENCY_REQUIRED');
  if(!(priceRon>0))blockers.push('POSITIVE_RON_PRICE_REQUIRED');
  if(evidenceClass!=='SECONDARY_PUBLIC_SEARCH_INDEX')blockers.push('SECONDARY_INDEX_EVIDENCE_CLASS_REQUIRED');
  if(!clean(input.sourceRef))blockers.push('SOURCE_REF_REQUIRED');
  if(!clean(input.retrievedAt))blockers.push('RETRIEVED_AT_REQUIRED');
  if(!(freshnessUpperBoundDays!==null&&freshnessUpperBoundDays>=0&&freshnessUpperBoundDays<=maxFreshnessDays))blockers.push('SECONDARY_PRICE_TOO_STALE_OR_UNKNOWN');

  const missingSignals=REQUIRED_GROUPS.filter(group=>!group.some(signal=>text.includes(norm(signal)))).map(group=>group[0]);
  if(missingSignals.length)blockers.push('INSUFFICIENT_PRODUCT_COMPARABILITY');

  return {
    schemaVersion:'MPR_ROMANIA_SCREENING_PRICE_EVIDENCE_V1',
    status:blockers.length?'BLOCKED':'SCREENING_ELIGIBLE',
    blockers:[...new Set(blockers)],
    market:market||null,
    currency:currency||null,
    priceRon:priceRon>0?priceRon:null,
    evidenceClass:evidenceClass||null,
    confidence:blockers.length?'LOW':'MEDIUM',
    freshnessUpperBoundDays,
    maxFreshnessDays,
    missingSignals,
    sourceRef:clean(input.sourceRef)||null,
    retrievedAt:clean(input.retrievedAt)||null,
    title:title||null,
    truthPolicy:{secondaryIndexIsDirectMarketplaceObservation:false,secondaryIndexIsVerifiedCanonicalIdentity:false,secondaryIndexIsRealizedSale:false,screeningEligibleIsConfirmedPrice:false,unknownEqualsZero:false,purchaseAuthorized:false}
  };
}

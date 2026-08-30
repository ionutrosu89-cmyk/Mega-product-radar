const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const lower = v => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const REQUIRED_SIGNALS = [
  ['5 niveluri','5 nivele'],
  ['sertar'],
  ['2 suporturi pentru pixuri','doua suporturi pentru pixuri','2 suporturi pixuri'],
  ['metal','plasa']
];

function hasSignal(text, variants) {
  const hay = lower(text);
  return variants.some(v => hay.includes(lower(v)));
}

function parseRonPrice(text) {
  const source = clean(text).replace(/\u00a0/g, ' ');
  const matches = [...source.matchAll(/(?:^|\s)(\d{1,4}(?:[.,]\d{2})?)\s*(?:lei|ron)\b/gi)];
  if (!matches.length) return null;
  const values = matches.map(m => Number(m[1].replace(',', '.'))).filter(Number.isFinite);
  return values.length ? Math.min(...values) : null;
}

export function evaluateRomaniaPublicRetailerCandidate(input={}) {
  const title = clean(input.title);
  const description = clean(input.description);
  const text = `${title} ${description}`;
  const normalizedText = lower(text);
  const missingSignals = REQUIRED_SIGNALS
    .map((variants, index) => ({index, variants, ok: hasSignal(text, variants)}))
    .filter(x => !x.ok)
    .map(x => x.variants[0]);
  const officeOrganizer = /organizator/.test(normalizedText) && /(birou|dosare|hartie)/.test(normalizedText);
  const priceRon = Number.isFinite(Number(input.priceRon)) ? Number(input.priceRon) : parseRonPrice(input.priceText || text);
  const comparable = officeOrganizer && missingSignals.length === 0 && Number(priceRon) > 0;
  return {
    schemaVersion:'MPR_ROMANIA_PUBLIC_RETAILER_CANDIDATE_V1',
    comparable,
    priceRon: Number(priceRon) > 0 ? Number(priceRon) : null,
    missingSignals,
    officeOrganizer,
    title:title || null,
    sourceUrl:input.sourceUrl || null,
    evidenceClass: comparable ? 'DIRECT_OBSERVED_ROMANIA_PUBLIC_RETAIL_PRICE' : 'DIAGNOSTIC_ONLY',
    truthPolicy:{publicListingPriceIsRealizedSale:false,retailerListingIsVerifiedCanonicalIdentity:false,unknownEqualsZero:false,purchaseAuthorized:false}
  };
}

export function parseUnchilipirCategoryHtml(html, sourceUrl='https://unchilipir.ro/accesorii-de-birou-si-produse-de-depozitare/') {
  const source = String(html ?? '');
  const blocked = /captcha|access denied|verify you are human|robot/.test(source.toLowerCase());
  if (blocked) return {blocked:true,candidates:[],selected:null,status:'BLOCKED',blockers:['SOURCE_BLOCKED']};

  const text = clean(source.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' '));
  const normalizedText = lower(text);
  const anchor = normalizedText.indexOf('organizator birou cu suport pixuri si sertar');
  if (anchor < 0) return {blocked:false,candidates:[],selected:null,status:'BLOCKED',blockers:['TARGET_PRODUCT_NOT_FOUND']};
  const excerpt = text.slice(anchor, anchor + 1200);
  const priceRon = parseRonPrice(excerpt);
  const candidate = evaluateRomaniaPublicRetailerCandidate({
    title:'Organizator birou cu suport pixuri si sertar',
    description:excerpt,
    priceRon,
    sourceUrl
  });
  return {
    schemaVersion:'MPR_ROMANIA_PUBLIC_RETAILER_PRICE_EVIDENCE_V1',
    market:'RO',
    retailer:'UNCHILIPIR',
    blocked:false,
    candidates:[candidate],
    selected:candidate.comparable ? candidate : null,
    status:candidate.comparable ? 'OBSERVED' : 'BLOCKED',
    blockers:candidate.comparable ? [] : ['NO_COMPARABLE_CURRENT_RON_PRICE'],
    truthPolicy:{publicListingPriceIsRealizedSale:false,retailerListingIsVerifiedCanonicalIdentity:false,unknownEqualsZero:false,purchaseAuthorized:false}
  };
}

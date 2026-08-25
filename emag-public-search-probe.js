const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();

export const EMAG_PUBLIC_SEARCH_TARGETS = Object.freeze([
  {
    nicheKey: 'travel:packing-cubes',
    comparabilityKey: 'TRAVEL_PACKING_CUBES_AND_SUITCASE_ORGANIZERS',
    query: 'organizator valiza set'
  },
  {
    nicheKey: 'automotive:trunk-organization',
    comparabilityKey: 'AUTO_TRUNK_ORGANIZERS',
    query: 'organizator portbagaj auto'
  },
  {
    nicheKey: 'office:laptop-accessories',
    comparabilityKey: 'ADJUSTABLE_LAPTOP_STANDS',
    query: 'suport laptop reglabil'
  }
]);

export function buildEmagSearchUrl(query) {
  const q = clean(query);
  if (!q) throw new Error('EMAG_SEARCH_QUERY_REQUIRED');
  return `https://www.emag.ro/search/${encodeURIComponent(q)}`;
}

function normalizeEmagProductUrl(raw) {
  if (!raw) return null;
  let value = String(raw).replace(/&amp;/g, '&').trim();
  if (value.startsWith('//')) value = `https:${value}`;
  if (value.startsWith('/')) value = `https://www.emag.ro${value}`;
  if (!value.startsWith('https://www.emag.ro/')) return null;
  if (!/\/pd\/[A-Za-z0-9]+\/?/i.test(value)) return null;
  try {
    const u = new URL(value);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

function parseCountToken(token) {
  const digits = String(token ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}

export function parseEmagSearchHtml(html, target = {}) {
  const source = String(html ?? '');
  const lower = source.toLowerCase();
  const blocked = /captcha|access denied|verify you are human|robot|temporarily unavailable/.test(lower);

  const productUrls = new Set();
  for (const match of source.matchAll(/href=["']([^"']*\/pd\/[A-Za-z0-9]+\/?[^"']*)["']/gi)) {
    const url = normalizeEmagProductUrl(match[1]);
    if (url) productUrls.add(url);
  }

  const countPatterns = [
    /([0-9][0-9.\s]*)\s+produse\b/i,
    /([0-9][0-9.\s]*)\s+rezultate\b/i,
    /([0-9][0-9.\s]*)\s+de\s+produse\b/i
  ];
  let declaredResultCountCandidate = null;
  for (const pattern of countPatterns) {
    const token = source.match(pattern)?.[1];
    const parsed = parseCountToken(token);
    if (parsed !== null) {
      declaredResultCountCandidate = parsed;
      break;
    }
  }

  const title = clean(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, ' ')) || null;

  return {
    platform: 'EMAG',
    market: 'RO',
    nicheKey: target.nicheKey ?? null,
    comparabilityKey: target.comparabilityKey ?? null,
    query: target.query ?? null,
    blocked,
    title,
    productLinkLowerBound: productUrls.size,
    productUrls: [...productUrls],
    declaredResultCountCandidate,
    declaredResultCountTrusted: false,
    sellerCount: null,
    salesEvidenceClass: 'NOT_VERIFIED_SALES',
    purchaseAuthorized: false,
    policy: 'PUBLIC_SEARCH_PAGE_PROBE_ONLY; PRODUCT_LINK_COUNT_IS_A_PAGE_LOWER_BOUND; DECLARED_RESULT_COUNT_REQUIRES_MANUAL_SCOPE_REVIEW'
  };
}

const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();

export const TRENDYOL_PUBLIC_SEARCH_TARGETS = Object.freeze([
  {
    nicheKey: 'office:three-ring-binders',
    comparabilityKey: 'THREE_RING_ROUND_RING_BINDERS',
    query: 'binder 3 inele'
  }
]);

export function buildTrendyolSearchUrl(query) {
  const q = clean(query);
  if (!q) throw new Error('TRENDYOL_SEARCH_QUERY_REQUIRED');
  return `https://www.trendyol.com/sr?q=${encodeURIComponent(q)}`;
}

function normalizeTrendyolProductUrl(raw) {
  if (!raw) return null;
  let value = String(raw).replace(/&amp;/g, '&').trim();
  if (value.startsWith('//')) value = `https:${value}`;
  if (value.startsWith('/')) value = `https://www.trendyol.com${value}`;
  if (!value.startsWith('https://www.trendyol.com/')) return null;
  if (!/-p-\d+(?:\?|\/|$)/i.test(value)) return null;
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

export function parseTrendyolSearchHtml(html, target = {}) {
  const source = String(html ?? '');
  const lower = source.toLowerCase();
  const blocked = /captcha|access denied|verify you are human|robot|temporarily unavailable/.test(lower);

  const productUrls = new Set();
  for (const match of source.matchAll(/href=["']([^"']*-p-\d+[^"']*)["']/gi)) {
    const url = normalizeTrendyolProductUrl(match[1]);
    if (url) productUrls.add(url);
  }

  const countPatterns = [
    /([0-9][0-9.\s]*)\s+(?:ürün|urun)\b/i,
    /([0-9][0-9.\s]*)\s+(?:sonuç|sonuc)\b/i
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

  return {
    platform: 'TRENDYOL',
    market: 'RO',
    nicheKey: target.nicheKey ?? null,
    comparabilityKey: target.comparabilityKey ?? null,
    query: target.query ?? null,
    blocked,
    productLinkLowerBound: productUrls.size,
    productUrls: [...productUrls],
    declaredResultCountCandidate,
    declaredResultCountTrusted: false,
    sellerCount: null,
    marketWideReviewed: false,
    salesEvidenceClass: 'NOT_VERIFIED_SALES',
    purchaseAuthorized: false,
    policy: 'PUBLIC_SEARCH_PAGE_PROBE_ONLY; PRODUCT_LINK_COUNT_IS_A_PAGE_LOWER_BOUND; DECLARED_RESULT_COUNT_REQUIRES_MANUAL_SCOPE_REVIEW'
  };
}

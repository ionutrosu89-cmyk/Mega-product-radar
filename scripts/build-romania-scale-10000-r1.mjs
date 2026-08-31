import fs from 'node:fs';
import crypto from 'node:crypto';

const CURRENT = process.argv[2] || 'data/real-products-1000.compact.json';
const EXPANSION = process.argv[3] || 'amazon-canonical-new-9000-r1.json';
const OUTPUT = process.argv[4] || 'romania-scale-10000-r1.json';
const SUMMARY = process.argv[5] || 'romania-scale-10000-summary.json';
const EXPECTED_COMBINED_ASIN_SHA256 = '7cbd46e5fd861c8ccecd4533ba853d6189447c48df09a55621522fb25e87259c';

const current = JSON.parse(fs.readFileSync(CURRENT, 'utf8'));
const expansion = JSON.parse(fs.readFileSync(EXPANSION, 'utf8'));
if (current?.schemaVersion !== 'MPR_REAL_PRODUCT_BOOTSTRAP_1000_V1' || current?.uniqueProductCount !== 1000) throw new Error('CURRENT_SOURCE_CONTRACT_REJECTED');
if (expansion?.schemaVersion !== 'MPR_AMAZON_CANONICAL_SCALE_9000_R1' || !Array.isArray(expansion.rows) || expansion.rows.length !== 9000) throw new Error('EXPANSION_CONTRACT_REJECTED');

const fields = current.fields || [];
const ix = Object.fromEntries(fields.map((name, i) => [name, i]));
for (const required of ['asin','title','categoryLabel']) if (!(required in ix)) throw new Error(`CURRENT_REQUIRED_FIELD_MISSING:${required}`);

function parseCategory(rawCategory) {
  const text = String(rawCategory ?? '').trim();
  if (!text) return { breadcrumb: [], family: 'UNKNOWN_CATEGORY' };
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length) {
      const breadcrumb = parsed.map((x) => String(x).trim()).filter(Boolean);
      return { breadcrumb, family: breadcrumb.slice(0,2).join(' > ') || breadcrumb[0] || 'UNKNOWN_CATEGORY' };
    }
  } catch {}
  return { breadcrumb:[text], family:text };
}

const existingProducts = current.products.map((row) => {
  const category = parseCategory(row[ix.categoryLabel]);
  return {
    asin: String(row[ix.asin] ?? '').trim().toUpperCase(),
    title: String(row[ix.title] ?? '').trim(),
    brand: 'brand' in ix ? String(row[ix.brand] ?? '').trim() || null : null,
    categoryFamily: category.family,
    categoryBreadcrumb: category.breadcrumb,
    sourceUrl: 'sourceUrl' in ix ? String(row[ix.sourceUrl] ?? '').trim() || null : null,
    identitySource: 'BRIGHTDATA_AMAZON_PUBLIC_SAMPLE',
    freshnessClass: 'HISTORICAL_BOOTSTRAP_NOT_LIVE',
  };
});

const newProducts = expansion.rows.map((row) => {
  if (row.platform !== 'AMAZON' || !/^[A-Z0-9]{10}$/.test(String(row.externalId || '')) || !String(row.title || '').trim()) throw new Error('EXPANSION_ROW_IDENTITY_REJECTED');
  if (row.sourceSha256 !== '77fd690fc627b05ca68bd0ba3e7217b7a401e364d96eb6308d502ace92c737e9') throw new Error('EXPANSION_SOURCE_SHA_REJECTED');
  return {
    asin: String(row.externalId),
    title: String(row.title).trim(),
    brand: null,
    categoryFamily: 'UNKNOWN_CATEGORY',
    categoryBreadcrumb: [],
    sourceUrl: null,
    identitySource: 'THE_MARKUP_HISTORICAL_PUBLIC_RESEARCH_DATASET',
    freshnessClass: 'HISTORICAL_IDENTITY_BOOTSTRAP_NOT_LIVE',
  };
});

const products = [...existingProducts, ...newProducts];
if (products.length !== 10000) throw new Error(`PRODUCT_COUNT_REJECTED:${products.length}`);
const asinSet = new Set(products.map((p) => p.asin));
if (asinSet.size !== 10000) throw new Error(`DUPLICATE_ASIN_REJECTED:${products.length - asinSet.size}`);
const combinedDigest = crypto.createHash('sha256').update([...asinSet].sort().join('\n')).digest('hex');
if (combinedDigest !== EXPECTED_COMBINED_ASIN_SHA256) throw new Error(`COMBINED_ASIN_DIGEST_REJECTED:${combinedDigest}`);
products.forEach((p, i) => { p.scaleIndex = i + 1; });

const surfaces = [
  { key: 'EMAG_RO', role: 'PRIMARY_MARKETPLACE', hardGapEvidence: true },
  { key: 'TRENDYOL_RO', role: 'SECONDARY_MARKETPLACE', hardGapEvidence: true },
  { key: 'RO_RETAIL_WEB', role: 'CORROBORATION', hardGapEvidence: false },
];

const slots = [];
for (const product of products) {
  for (const surface of surfaces) {
    slots.push({
      asin: product.asin,
      scaleIndex: product.scaleIndex,
      categoryFamily: product.categoryFamily,
      surfaceKey: surface.key,
      surfaceRole: surface.role,
      hardGapEvidence: surface.hardGapEvidence,
      evidenceState: 'UNKNOWN',
      identityStatus: 'UNKNOWN',
      comparabilityStatus: 'UNKNOWN',
      comparabilityConfidence: null,
      freshnessClass: 'UNKNOWN',
      observedAt: null,
      listingCount: null,
      listingCountSemantics: 'UNKNOWN',
      sellerCount: null,
      priceRon: null,
      sourceUrl: null,
      evidenceClass: 'UNKNOWN',
      verifiedSales: false,
      notes: ['UNHYDRATED_SCALE_SLOT'],
    });
  }
}

const knownCategoryProducts = products.filter((p) => p.categoryFamily !== 'UNKNOWN_CATEGORY').length;
const result = {
  schemaVersion: 'MPR_ROMANIA_SCALE_10000_R1_V1',
  combinedAsinSetSha256: combinedDigest,
  productCount: products.length,
  existingIdentityProducts: existingProducts.length,
  newIdentityProducts: newProducts.length,
  knownCategoryProducts,
  unknownCategoryProducts: products.length - knownCategoryProducts,
  surfaces,
  slotCount: slots.length,
  policy: {
    unknownRemainsUnknown: true,
    missingAsZeroForbidden: true,
    similarTitleIsNotIdentity: true,
    lowerBoundIsNotExact: true,
    thirdSurfaceCannotProveGap: true,
    historicalIdentityIsNotLiveEvidence: true,
    verifiedSales: false,
    providerSpendEur: 0,
    paidCallsTriggered: 0,
    purchaseAuthorized: false,
  },
  products,
  slots,
};
const summary = {
  schemaVersion: result.schemaVersion,
  combinedAsinSetSha256: combinedDigest,
  productCount: result.productCount,
  surfaceCount: surfaces.length,
  slotCount: slots.length,
  unknownSlots: slots.length,
  unknownRate: 1,
  knownCategoryProducts,
  unknownCategoryProducts: result.unknownCategoryProducts,
  providerSpendEur: 0,
  paidCallsTriggered: 0,
  purchaseAuthorized: false,
};
fs.writeFileSync(OUTPUT, JSON.stringify(result) + '\n');
fs.writeFileSync(SUMMARY, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));

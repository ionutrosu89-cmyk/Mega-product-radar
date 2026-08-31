import fs from 'node:fs';

const INPUT = process.argv[2] || 'data/real-products-1000.compact.json';
const OUTPUT = process.argv[3] || 'romania-scale-1000-r1.json';
const SUMMARY = process.argv[4] || 'romania-scale-1000-summary.json';

const dataset = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
if (dataset?.schemaVersion !== 'MPR_REAL_PRODUCT_BOOTSTRAP_1000_V1') throw new Error('SOURCE_SCHEMA_REJECTED');
if (dataset?.uniqueProductCount !== 1000) throw new Error('SOURCE_COUNT_REJECTED');

const fields = dataset.fields || [];
const ix = Object.fromEntries(fields.map((name, i) => [name, i]));
for (const required of ['asin','title','categoryLabel']) if (!(required in ix)) throw new Error(`REQUIRED_FIELD_MISSING:${required}`);

const surfaces = [
  { key: 'EMAG_RO', role: 'PRIMARY_MARKETPLACE', hardGapEvidence: true },
  { key: 'TRENDYOL_RO', role: 'SECONDARY_MARKETPLACE', hardGapEvidence: true },
  { key: 'RO_RETAIL_WEB', role: 'CORROBORATION', hardGapEvidence: false },
];

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

const products = dataset.products.map((row, i) => {
  const category = parseCategory(row[ix.categoryLabel]);
  return {
    scaleIndex: i + 1,
    asin: String(row[ix.asin] ?? '').trim(),
    title: String(row[ix.title] ?? '').trim(),
    brand: 'brand' in ix ? String(row[ix.brand] ?? '').trim() || null : null,
    categoryFamily: category.family,
    categoryBreadcrumb: category.breadcrumb,
    sourceUrl: 'sourceUrl' in ix ? String(row[ix.sourceUrl] ?? '').trim() || null : null,
  };
});

if (products.length !== 1000) throw new Error('ROW_COUNT_REJECTED');
if (new Set(products.map((p) => p.asin)).size !== 1000) throw new Error('DUPLICATE_ASIN_REJECTED');

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

const categoryFamilies = [...new Set(products.map((p) => p.categoryFamily))];
const result = {
  schemaVersion: 'MPR_ROMANIA_SCALE_1000_R1_V1',
  sourceSchemaVersion: dataset.schemaVersion,
  sourceProductSetSha256: dataset.productSetSha256,
  productCount: products.length,
  categoryFamilyCount: categoryFamilies.length,
  surfaces,
  slotCount: slots.length,
  policy: {
    unknownRemainsUnknown: true,
    missingAsZeroForbidden: true,
    similarTitleIsNotIdentity: true,
    lowerBoundIsNotExact: true,
    thirdSurfaceCannotProveGap: true,
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
  productCount: result.productCount,
  categoryFamilyCount: result.categoryFamilyCount,
  surfaceCount: surfaces.length,
  slotCount: result.slotCount,
  unknownSlots: slots.filter((s) => s.evidenceState === 'UNKNOWN').length,
  unknownRate: slots.filter((s) => s.evidenceState === 'UNKNOWN').length / slots.length,
  providerSpendEur: 0,
  paidCallsTriggered: 0,
  purchaseAuthorized: false,
};

fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + '\n');
fs.writeFileSync(SUMMARY, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));

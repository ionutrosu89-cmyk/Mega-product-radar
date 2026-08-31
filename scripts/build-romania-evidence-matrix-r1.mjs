import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const source = process.argv[2] || 'data/real-products-1000.compact.json';
const benchmarkPath = process.argv[3] || 'romania-benchmark-r1.json';
const outputPath = process.argv[4] || 'romania-evidence-matrix-r1.json';

execFileSync(process.execPath, ['scripts/select-romania-benchmark-r1.mjs', source, benchmarkPath], { stdio: 'inherit' });
const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
if (benchmark.schemaVersion !== 'MPR_ROMANIA_BENCHMARK_R1_V2') throw new Error('BENCHMARK_SCHEMA_REJECTED');
if (benchmark.selectedCount !== 100) throw new Error('BENCHMARK_COUNT_REJECTED');

const surfaces = [
  { key: 'EMAG_RO', role: 'PRIMARY_MARKETPLACE', canProveRomaniaGap: true },
  { key: 'TRENDYOL_RO', role: 'SECONDARY_MARKETPLACE', canProveRomaniaGap: true },
  { key: 'ROMANIA_RETAIL_WEB', role: 'CORROBORATION_ONLY', canProveRomaniaGap: false },
];

const rows = [];
for (const p of benchmark.products) {
  for (const surface of surfaces) {
    rows.push({
      benchmarkIndex: p.benchmarkIndex,
      asin: p.asin,
      title: p.title,
      brand: p.brand,
      categoryFamily: p.categoryFamily,
      surfaceKey: surface.key,
      surfaceRole: surface.role,
      canProveRomaniaGap: surface.canProveRomaniaGap,
      evidenceStatus: 'UNKNOWN',
      identityStatus: 'UNKNOWN',
      comparabilityStatus: 'UNKNOWN',
      comparabilityConfidence: null,
      observedAt: null,
      freshnessClass: 'UNKNOWN',
      listingCount: null,
      listingCountSemantics: 'UNKNOWN',
      sellerCount: null,
      priceRon: null,
      sourceUrl: null,
      evidenceClass: null,
      notes: null,
    });
  }
}

const unknownSlots = rows.filter((r) => r.evidenceStatus === 'UNKNOWN').length;
const result = {
  schemaVersion: 'MPR_ROMANIA_EVIDENCE_MATRIX_R1_V1',
  benchmarkSchemaVersion: benchmark.schemaVersion,
  benchmarkSelectedAsinDigest: benchmark.selectedAsinDigest,
  productCount: benchmark.selectedCount,
  normalizedCategoryCount: benchmark.categoryCount,
  surfaceCount: surfaces.length,
  totalSlots: rows.length,
  knownSlots: rows.length - unknownSlots,
  unknownSlots,
  unknownRate: unknownSlots / rows.length,
  freshnessKnownSlots: rows.filter((r) => r.freshnessClass !== 'UNKNOWN').length,
  comparableKnownSlots: rows.filter((r) => r.comparabilityStatus !== 'UNKNOWN').length,
  providerSpendEur: 0,
  paidCallsTriggered: 0,
  purchaseAuthorized: false,
  policy: {
    unknownRemainsUnknown: true,
    missingIsNotZero: true,
    sameTitleIsNotIdentity: true,
    retailWebCannotProveRomaniaGap: true,
    noAutomaticPromotion: true,
  },
  surfaces,
  rows,
};

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({
  schemaVersion: result.schemaVersion,
  productCount: result.productCount,
  normalizedCategoryCount: result.normalizedCategoryCount,
  surfaceCount: result.surfaceCount,
  totalSlots: result.totalSlots,
  knownSlots: result.knownSlots,
  unknownSlots: result.unknownSlots,
  unknownRate: result.unknownRate,
  providerSpendEur: 0,
  paidCallsTriggered: 0,
  purchaseAuthorized: false,
}, null, 2));

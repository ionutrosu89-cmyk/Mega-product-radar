import fs from 'node:fs';
import crypto from 'node:crypto';

const INPUT = process.argv[2] || 'data/real-products-1000.compact.json';
const OUTPUT = process.argv[3] || 'data/romania-benchmark-r1.json';
const TARGET = 100;

const raw = fs.readFileSync(INPUT, 'utf8');
const dataset = JSON.parse(raw);
if (dataset?.schemaVersion !== 'MPR_REAL_PRODUCT_BOOTSTRAP_1000_V1') throw new Error('SOURCE_SCHEMA_REJECTED');
if (dataset?.uniqueProductCount !== 1000) throw new Error('SOURCE_COUNT_REJECTED');

const fields = dataset.fields || [];
const ix = Object.fromEntries(fields.map((name, i) => [name, i]));
for (const required of ['asin', 'title', 'categoryLabel']) {
  if (!(required in ix)) throw new Error(`REQUIRED_FIELD_MISSING:${required}`);
}

const products = (dataset.products || []).map((row) => ({
  asin: String(row[ix.asin] ?? '').trim(),
  title: String(row[ix.title] ?? '').trim(),
  brand: 'brand' in ix ? String(row[ix.brand] ?? '').trim() || null : null,
  categoryLabel: String(row[ix.categoryLabel] ?? '').trim() || 'UNKNOWN_CATEGORY',
  sourceUrl: 'sourceUrl' in ix ? String(row[ix.sourceUrl] ?? '').trim() || null : null,
}));
if (products.length !== 1000) throw new Error('ROW_COUNT_REJECTED');
if (new Set(products.map((p) => p.asin)).size !== 1000) throw new Error('DUPLICATE_ASIN_REJECTED');

const byCategory = new Map();
for (const p of products) {
  const arr = byCategory.get(p.categoryLabel) || [];
  arr.push(p);
  byCategory.set(p.categoryLabel, arr);
}
for (const arr of byCategory.values()) arr.sort((a, b) => a.asin.localeCompare(b.asin));

const categories = [...byCategory.entries()]
  .map(([category, rows]) => ({ category, rows }))
  .sort((a, b) => b.rows.length - a.rows.length || a.category.localeCompare(b.category));

const selected = [];
let round = 0;
while (selected.length < TARGET) {
  let added = 0;
  for (const group of categories) {
    const p = group.rows[round];
    if (!p) continue;
    selected.push(p);
    added++;
    if (selected.length === TARGET) break;
  }
  if (!added) break;
  round++;
}
if (selected.length !== TARGET) throw new Error(`BENCHMARK_SIZE_REJECTED:${selected.length}`);

const categoryCounts = Object.fromEntries([...new Set(selected.map((p) => p.categoryLabel))].sort().map((c) => [c, selected.filter((p) => p.categoryLabel === c).length]));
const selectedAsinDigest = crypto.createHash('sha256').update(selected.map((p) => p.asin).join('\n')).digest('hex');
const result = {
  schemaVersion: 'MPR_ROMANIA_BENCHMARK_R1_V1',
  generatedFrom: INPUT,
  sourceProductSetSha256: dataset.productSetSha256,
  selectionMethod: 'DETERMINISTIC_ROUND_ROBIN_BY_CATEGORY_THEN_ASIN',
  targetCount: TARGET,
  selectedCount: selected.length,
  categoryCount: Object.keys(categoryCounts).length,
  categoryCounts,
  selectedAsinDigest,
  policy: {
    providerSpendEur: 0,
    paidCallsTriggered: 0,
    purchaseAuthorized: false,
    sameTitleIsNotIdentity: true,
    unknownRemainsUnknown: true
  },
  products: selected.map((p, index) => ({ benchmarkIndex: index + 1, ...p }))
};
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({schemaVersion:result.schemaVersion,selectedCount:result.selectedCount,categoryCount:result.categoryCount,selectedAsinDigest,providerSpendEur:0,paidCallsTriggered:0,purchaseAuthorized:false}, null, 2));

import fs from 'node:fs';
import path from 'node:path';
import { buildSupplierVerificationPackets } from '../supplier-manual-verification-packet-v1.js';

const input = process.argv[2] || 'supplier-evidence/seed-manual-quotes-2026-08-24.json';
const output = process.argv[3] || 'supplier-evidence/manual-verification-packets-v1.json';

if (!fs.existsSync(input)) {
  console.error(`SUPPLIER_EVIDENCE_INPUT_MISSING:${input}`);
  process.exit(2);
}

const parsed = JSON.parse(fs.readFileSync(input, 'utf8'));
const records = Array.isArray(parsed.records) ? parsed.records : [];
if (records.length === 0) {
  console.error('SUPPLIER_EVIDENCE_RECORDS_EMPTY');
  process.exit(3);
}

const result = buildSupplierVerificationPackets(records);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ ...result, generatedAt: new Date().toISOString(), sourceFile: input }, null, 2) + '\n');
console.log(JSON.stringify(result.stats));

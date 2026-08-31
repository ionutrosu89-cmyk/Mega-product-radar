#!/usr/bin/env python3
import csv, json, hashlib, sys, lzma, re
from pathlib import Path

csv.field_size_limit(16 * 1024 * 1024)
SOURCE = Path(sys.argv[1] if len(sys.argv) > 1 else 'amazon-markup-products.csv.xz')
CURRENT = Path(sys.argv[2] if len(sys.argv) > 2 else 'data/real-products-1000.compact.json')
OUT_ROWS = Path(sys.argv[3] if len(sys.argv) > 3 else 'amazon-canonical-new-9000-r1.json')
OUT_RECEIPT = Path(sys.argv[4] if len(sys.argv) > 4 else 'amazon-canonical-10k-build-receipt-r1.json')
EXPECTED_SOURCE_SHA256 = '77fd690fc627b05ca68bd0ba3e7217b7a401e364d96eb6308d502ace92c737e9'
TARGET_TOTAL = 10000
TARGET_NEW = 9000
BATCH_SIZE = 250
ASIN_RE = re.compile(r'^[A-Z0-9]{10}$')

if not SOURCE.exists() or not CURRENT.exists():
    raise SystemExit('INPUT_MISSING')
source_sha = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
if source_sha != EXPECTED_SOURCE_SHA256:
    raise SystemExit(f'SOURCE_SHA256_MISMATCH:{source_sha}')

current = json.loads(CURRENT.read_text(encoding='utf-8'))
if current.get('schemaVersion') != 'MPR_REAL_PRODUCT_BOOTSTRAP_1000_V1' or current.get('uniqueProductCount') != 1000:
    raise SystemExit('CURRENT_DATASET_CONTRACT_REJECTED')
fields = current.get('fields') or []
ix = {name:i for i,name in enumerate(fields)}
if 'asin' not in ix:
    raise SystemExit('CURRENT_ASIN_FIELD_MISSING')
current_asins = {str(r[ix['asin']]).strip().upper() for r in current.get('products', [])}
if len(current_asins) != 1000 or any(not ASIN_RE.match(x) for x in current_asins):
    raise SystemExit('CURRENT_ASIN_IDENTITY_REJECTED')

candidates = {}
with lzma.open(SOURCE, 'rt', encoding='utf-8-sig', newline='') as f:
    reader = csv.DictReader(f)
    headers = reader.fieldnames or []
    if 'asin' not in headers or 'title' not in headers:
        raise SystemExit('SOURCE_FIELDS_REJECTED')
    for row in reader:
        asin = str(row.get('asin') or '').strip().upper()
        title = str(row.get('title') or '').strip()
        if not ASIN_RE.match(asin) or not title or asin in current_asins:
            continue
        if asin not in candidates:
            candidates[asin] = title

if len(candidates) < TARGET_NEW:
    raise SystemExit(f'INSUFFICIENT_NEW_ASINS:{len(candidates)}')

selected_asins = sorted(candidates)[:TARGET_NEW]
rows = [{
    'platform': 'AMAZON',
    'externalId': asin,
    'title': candidates[asin],
    'brand': None,
    'categoryLabel': None,
    'market': 'US',
    'sourceUrl': None,
    'evidenceClass': 'HISTORICAL_PUBLIC_RESEARCH_DATASET',
    'sourceDataset': 'the-markup/investigation-amazon-brands:data/output/datasets/products.csv.xz',
    'sourceSha256': source_sha,
    'verifiedSales': False,
    'freshnessClass': 'HISTORICAL_IDENTITY_BOOTSTRAP_NOT_LIVE'
} for asin in selected_asins]

def canonical_row(row):
    return json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(',', ':'))

canonical_lines = '\n'.join(canonical_row(r) for r in rows)
new_digest = hashlib.sha256(canonical_lines.encode('utf-8')).hexdigest()
combined_asins = sorted(current_asins | set(selected_asins))
combined_digest = hashlib.sha256(('\n'.join(combined_asins)).encode('utf-8')).hexdigest()
batches = [rows[i:i+BATCH_SIZE] for i in range(0, len(rows), BATCH_SIZE)]
batch_digests = [hashlib.sha256(('\n'.join(canonical_row(r) for r in batch)).encode('utf-8')).hexdigest() for batch in batches]
if len(batches) != 36 or any(len(b) != BATCH_SIZE for b in batches):
    raise SystemExit('BATCH_CONTRACT_REJECTED')

payload = {
    'schemaVersion': 'MPR_AMAZON_CANONICAL_SCALE_9000_R1',
    'source': {
        'repository': 'the-markup/investigation-amazon-brands',
        'path': 'data/output/datasets/products.csv.xz',
        'sha256': source_sha,
        'licenseNoticeRequired': True,
        'freshnessClass': 'HISTORICAL_IDENTITY_BOOTSTRAP_NOT_LIVE'
    },
    'selectionMethod': 'STRICT_ASIN_FORMAT_EXCLUDE_CURRENT_SORT_ASC_FIRST_9000',
    'currentCount': len(current_asins),
    'newCount': len(rows),
    'combinedCount': len(combined_asins),
    'batchSize': BATCH_SIZE,
    'batchCount': len(batches),
    'batchDigestsSha256': batch_digests,
    'newRowsSha256': new_digest,
    'combinedAsinSetSha256': combined_digest,
    'firstSelectedAsin': selected_asins[0],
    'lastSelectedAsin': selected_asins[-1],
    'policy': {
        'sameTitleIsNotIdentity': True,
        'identityKey': 'AMAZON_ASIN',
        'unknownRemainsUnknown': True,
        'verifiedSales': False,
        'providerSpendEur': 0,
        'paidCallsTriggered': 0,
        'purchaseAuthorized': False,
        'databaseWrites': 0
    }
}

OUT_ROWS.write_text(json.dumps({'schemaVersion':'MPR_AMAZON_CANONICAL_SCALE_9000_R1','rows':rows}, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
OUT_RECEIPT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(payload, ensure_ascii=False, indent=2))

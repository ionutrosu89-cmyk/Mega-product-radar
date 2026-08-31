#!/usr/bin/env python3
import csv, json, hashlib, sys
from pathlib import Path

# Public product datasets can contain long description/features fields. Raise the
# parser ceiling only; identity and schema gates below remain unchanged.
csv.field_size_limit(16 * 1024 * 1024)

SOURCE = Path(sys.argv[1] if len(sys.argv) > 1 else 'amazon-public-candidate.csv')
CURRENT = Path(sys.argv[2] if len(sys.argv) > 2 else 'data/real-products-1000.compact.json')
OUT = Path(sys.argv[3] if len(sys.argv) > 3 else 'amazon-10k-source-preflight.json')
TARGET = 10000

if not SOURCE.exists():
    raise SystemExit('SOURCE_FILE_MISSING')
if not CURRENT.exists():
    raise SystemExit('CURRENT_DATASET_MISSING')

current = json.loads(CURRENT.read_text(encoding='utf-8'))
if current.get('schemaVersion') != 'MPR_REAL_PRODUCT_BOOTSTRAP_1000_V1':
    raise SystemExit('CURRENT_SCHEMA_REJECTED')
fields = current.get('fields') or []
if 'asin' not in fields:
    raise SystemExit('CURRENT_ASIN_FIELD_MISSING')
ix_asin = fields.index('asin')
current_asins = {str(r[ix_asin]).strip().upper() for r in current.get('products', []) if str(r[ix_asin]).strip()}
if len(current_asins) != 1000:
    raise SystemExit(f'CURRENT_ASIN_COUNT_REJECTED:{len(current_asins)}')

with SOURCE.open('r', encoding='utf-8-sig', newline='') as f:
    reader = csv.DictReader(f)
    headers = reader.fieldnames or []
    normalized = {h.strip().lower(): h for h in headers}
    asin_key = next((normalized[k] for k in ['asin','product_asin','product_id'] if k in normalized), None)
    title_key = next((normalized[k] for k in ['title','product_title','name'] if k in normalized), None)
    url_key = next((normalized[k] for k in ['url','product_url'] if k in normalized), None)
    category_key = next((normalized[k] for k in ['categories','category','breadcrumbs'] if k in normalized), None)
    if not asin_key or not title_key:
        raise SystemExit('SOURCE_REQUIRED_FIELDS_MISSING')

    row_count = 0
    invalid_asin_rows = 0
    duplicate_asin_rows = 0
    seen = set()
    sample = []
    for row in reader:
        row_count += 1
        asin = str(row.get(asin_key) or '').strip().upper()
        title = str(row.get(title_key) or '').strip()
        if not asin or not title or len(asin) < 8:
            invalid_asin_rows += 1
            continue
        if asin in seen:
            duplicate_asin_rows += 1
            continue
        seen.add(asin)
        if len(sample) < 5:
            sample.append({
                'asin': asin,
                'title': title[:200],
                'sourceUrl': (str(row.get(url_key) or '').strip() if url_key else None),
                'categoryRaw': (str(row.get(category_key) or '').strip()[:500] if category_key else None),
            })

new_asins = seen - current_asins
overlap = seen & current_asins
combined = current_asins | seen
source_sha256 = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
status = 'QUALIFIED_FOR_10K_BUILD' if len(combined) >= TARGET and len(new_asins) >= TARGET - len(current_asins) else 'INSUFFICIENT_DISTINCT_ASINS'

receipt = {
    'schemaVersion': 'MPR_AMAZON_10K_PUBLIC_SOURCE_PREFLIGHT_V1',
    'status': status,
    'sourceFile': SOURCE.name,
    'sourceSha256': source_sha256,
    'sourceRowCount': row_count,
    'sourceDistinctValidAsins': len(seen),
    'sourceInvalidRows': invalid_asin_rows,
    'sourceDuplicateAsinRows': duplicate_asin_rows,
    'currentDistinctAsins': len(current_asins),
    'overlapWithCurrent': len(overlap),
    'newDistinctAsins': len(new_asins),
    'combinedDistinctAsins': len(combined),
    'targetDistinctAsins': TARGET,
    'neededNewAsins': TARGET - len(current_asins),
    'eligibleNewAsinsForNextBuild': min(len(new_asins), TARGET - len(current_asins)),
    'sample': sample,
    'policy': {
        'publicSourceOnly': True,
        'sameTitleIsNotIdentity': True,
        'identityKey': 'ASIN',
        'unknownRemainsUnknown': True,
        'verifiedSales': False,
        'providerSpendEur': 0,
        'paidCallsTriggered': 0,
        'purchaseAuthorized': False,
        'databaseWrites': 0
    }
}
OUT.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=False, indent=2))

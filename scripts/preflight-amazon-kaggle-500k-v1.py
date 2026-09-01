#!/usr/bin/env python3
import csv, json, os, re, sys, zipfile
from pathlib import Path

ZIP = Path(os.environ.get('KAGGLE_ZIP','/tmp/amazon-products-2023.zip'))
OUT = Path(os.environ.get('PREFLIGHT_OUT','/tmp/amazon-kaggle-500k-preflight.json'))
ASIN_RE = re.compile(r'^[A-Z0-9]{10}$')

if not ZIP.exists():
    raise SystemExit(f'MISSING_ZIP:{ZIP}')

with zipfile.ZipFile(ZIP) as z:
    csv_names = [n for n in z.namelist() if n.endswith('amazon_products.csv') or n.endswith('/amazon_products.csv')]
    if len(csv_names) != 1:
        raise SystemExit(f'EXPECTED_ONE_AMAZON_PRODUCTS_CSV found={csv_names}')
    name = csv_names[0]
    with z.open(name) as raw:
        import io
        text = io.TextIOWrapper(raw, encoding='utf-8-sig', newline='')
        reader = csv.DictReader(text)
        fields = reader.fieldnames or []
        asin_field = next((f for f in fields if f.lower() == 'asin'), None)
        if not asin_field:
            raise SystemExit(f'MISSING_ASIN_COLUMN fields={fields}')
        total = valid = invalid = 0
        unique = set()
        sample = []
        for row in reader:
            total += 1
            asin = (row.get(asin_field) or '').strip().upper()
            if ASIN_RE.fullmatch(asin):
                valid += 1
                unique.add(asin)
                if len(sample) < 5:
                    sample.append(asin)
            else:
                invalid += 1

receipt = {
    'schema':'MPR_AMAZON_KAGGLE_500K_PREFLIGHT_V1',
    'source':{
        'provider':'Kaggle',
        'dataset':'asaniczka/amazon-products-dataset-2023-1-4m-products',
        'license':'ODC-By',
        'snapshot':'2023-09',
        'truthClass':'HISTORICAL_CATALOG_NOT_LIVE',
        'verifiedSales':False
    },
    'file':name,
    'fields':fields,
    'totalRows':total,
    'validAsinRows':valid,
    'invalidAsinRows':invalid,
    'uniqueValidAsins':len(unique),
    'sampleAsins':sample,
    'targetQualified': len(unique) >= 500000,
    'providerSpendEur':0,
    'paidCallsTriggered':0,
    'purchaseAuthorized':False
}
OUT.write_text(json.dumps(receipt, indent=2, sort_keys=True) + '\n', encoding='utf-8')
print(json.dumps(receipt, indent=2, sort_keys=True))
if not receipt['targetQualified']:
    raise SystemExit(f'UNIQUE_ASIN_TARGET_NOT_MET:{len(unique)}')

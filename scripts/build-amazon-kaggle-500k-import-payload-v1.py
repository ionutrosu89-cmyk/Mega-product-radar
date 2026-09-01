#!/usr/bin/env python3
import csv, hashlib, io, json, os, zipfile
from pathlib import Path

SOURCE_ZIP=Path(os.environ.get('KAGGLE_ZIP','/tmp/amazon-products-2023.zip'))
MANIFEST=Path(os.environ.get('ASIN_MANIFEST','/tmp/amazon-kaggle-400k-new-asins.txt'))
OUT=Path(os.environ.get('PAYLOAD_DIR','/tmp/amazon-kaggle-500k-payload'))
EXPECTED_MANIFEST_SHA='3492ad16cfd2be451646492bd6e014a95182893f7f5867e195655b2d9db07dd2'
TARGET=400000
SHARDS=8

manifest_bytes=MANIFEST.read_bytes()
manifest_sha=hashlib.sha256(manifest_bytes).hexdigest()
if manifest_sha!=EXPECTED_MANIFEST_SHA: raise SystemExit(f'MANIFEST_SHA_MISMATCH:{manifest_sha}')
asins=[x.strip() for x in manifest_bytes.decode().splitlines() if x.strip()]
if len(asins)!=TARGET or len(set(asins))!=TARGET: raise SystemExit(f'MANIFEST_SCOPE_INVALID:{len(asins)} unique={len(set(asins))}')
selected=set(asins)
rows_by_asin={}
with zipfile.ZipFile(SOURCE_ZIP) as z:
    name=next(n for n in z.namelist() if n.endswith('amazon_products.csv'))
    with z.open(name) as raw:
        reader=csv.DictReader(io.TextIOWrapper(raw,encoding='utf-8-sig',newline=''))
        for r in reader:
            a=(r.get('asin') or '').strip().upper()
            if a not in selected: continue
            title=(r.get('title') or '').strip()
            if not title: raise SystemExit(f'TITLE_MISSING:{a}')
            price=(r.get('price') or '').strip(); stars=(r.get('stars') or '').strip(); reviews=(r.get('reviews') or '').strip(); category=(r.get('category_id') or '').strip(); product_url=(r.get('productURL') or '').strip()
            rows_by_asin[a]={
                'platform':'AMAZON','externalId':a,'market':'US','title':title,
                'categoryLabel': category or None,
                'sourceUrl': product_url or f'https://www.amazon.com/dp/{a}',
                'sourceMetadata':{
                    'source':'KAGGLE_AMAZON_PRODUCTS_2023','snapshot':'2023-09','license':'ODC-By',
                    'truthClass':'HISTORICAL_CATALOG_NOT_LIVE','priceHistorical':price or None,
                    'starsHistorical':stars or None,'reviewsHistorical':reviews or None,'verifiedSales':False
                }
            }
if len(rows_by_asin)!=TARGET: raise SystemExit(f'SOURCE_JOIN_INCOMPLETE:{len(rows_by_asin)}')
rows=[rows_by_asin[a] for a in asins]
OUT.mkdir(parents=True,exist_ok=True)
shard_size=TARGET//SHARDS
shard_digests=[]; shard_counts=[]
h=hashlib.sha256()
for si in range(SHARDS):
    shard=rows[si*shard_size:(si+1)*shard_size]
    path=OUT/f'shard-{si}.jsonl'
    sh=hashlib.sha256()
    with path.open('w',encoding='utf-8') as f:
        for r in shard:
            line=json.dumps(r,sort_keys=True,separators=(',',':'),ensure_ascii=False)+'\n'
            b=line.encode(); f.write(line); sh.update(b); h.update(b)
    shard_digests.append(sh.hexdigest()); shard_counts.append(len(shard))
receipt={
 'schema':'MPR_AMAZON_KAGGLE_500K_IMPORT_PAYLOAD_V1','manifestSha256':manifest_sha,
 'payloadRowsSha256':h.hexdigest(),'rowCount':len(rows),'shardCount':SHARDS,'shardSize':shard_size,
 'shardDigestsSha256':shard_digests,'shardCounts':shard_counts,'firstAsin':asins[0],'lastAsin':asins[-1],
 'source':'asaniczka/amazon-products-dataset-2023-1-4m-products','snapshot':'2023-09','license':'ODC-By',
 'verifiedSales':False,'databaseWrites':0,'providerSpendEur':0,'paidCallsTriggered':0,'purchaseAuthorized':False
}
(OUT/'receipt.json').write_text(json.dumps(receipt,indent=2,sort_keys=True)+'\n',encoding='utf-8')
print(json.dumps(receipt,indent=2,sort_keys=True))

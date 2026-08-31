#!/usr/bin/env python3
import csv, json, hashlib, sys, lzma, re
from pathlib import Path

csv.field_size_limit(16 * 1024 * 1024)
SOURCE=Path(sys.argv[1] if len(sys.argv)>1 else 'amazon-markup-products.csv.xz')
CURRENT=Path(sys.argv[2] if len(sys.argv)>2 else 'data/real-products-1000.compact.json')
OUT=Path(sys.argv[3] if len(sys.argv)>3 else 'markup-9k-metrics-preflight.json')
EXPECTED_SOURCE_SHA256='77fd690fc627b05ca68bd0ba3e7217b7a401e364d96eb6308d502ace92c737e9'
EXPECTED_9K_SHA256='e8b53b0aceb7e5847e2f468a64fc8c2c4ce620d8cce5129daa7f3094c4dd1787'
ASIN_RE=re.compile(r'^[A-Z0-9]{10}$')

if hashlib.sha256(SOURCE.read_bytes()).hexdigest()!=EXPECTED_SOURCE_SHA256: raise SystemExit('SOURCE_SHA_MISMATCH')
cur=json.loads(CURRENT.read_text())
fields=cur.get('fields') or []; ix={n:i for i,n in enumerate(fields)}
current={str(r[ix['asin']]).strip().upper() for r in cur.get('products',[])}
if len(current)!=1000: raise SystemExit('CURRENT_COUNT_INVALID')

def nonempty(v): return str(v or '').strip()!=''
def num(v):
    s=str(v or '').strip().replace(',','')
    if not s:return None
    m=re.search(r'-?\d+(?:\.\d+)?',s)
    return float(m.group()) if m else None

def first_key(headers,names):
    m={h.strip().lower():h for h in headers}
    for n in names:
        if n in m:return m[n]
    return None

rows={}
with lzma.open(SOURCE,'rt',encoding='utf-8-sig',newline='') as f:
    rd=csv.DictReader(f); headers=rd.fieldnames or []
    asin_key=first_key(headers,['asin']); title_key=first_key(headers,['title'])
    if not asin_key or not title_key: raise SystemExit('IDENTITY_FIELDS_MISSING')
    price_key=first_key(headers,['price','product_price','current_price'])
    rating_key=first_key(headers,['stars','rating','star_rating','average_rating'])
    reviews_key=first_key(headers,['reviews','review_count','ratings_count','number_of_reviews'])
    bsr_key=first_key(headers,['best_seller_rank','bestseller_rank','bsr','best_sellers_rank'])
    for r in rd:
        a=str(r.get(asin_key) or '').strip().upper(); t=str(r.get(title_key) or '').strip()
        if ASIN_RE.match(a) and t and a not in current and a not in rows: rows[a]=r
selected=sorted(rows)[:9000]
if len(selected)!=9000: raise SystemExit('SELECTED_COUNT_INVALID')
# Rebuild the exact 9K identity payload digest used by the canonical builder.
def canonical_row(asin):
    x={'platform':'AMAZON','externalId':asin,'title':str(rows[asin].get(title_key) or '').strip(),'brand':None,'categoryLabel':None,'market':'US','sourceUrl':None,'evidenceClass':'HISTORICAL_PUBLIC_RESEARCH_DATASET','sourceDataset':'the-markup/investigation-amazon-brands:data/output/datasets/products.csv.xz','sourceSha256':EXPECTED_SOURCE_SHA256,'verifiedSales':False,'freshnessClass':'HISTORICAL_IDENTITY_BOOTSTRAP_NOT_LIVE'}
    return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'))
digest=hashlib.sha256('\n'.join(canonical_row(a) for a in selected).encode()).hexdigest()
if digest!=EXPECTED_9K_SHA256: raise SystemExit(f'EXACT_9K_DIGEST_MISMATCH:{digest}')

counts={'price':0,'rating':0,'reviews':0,'bsr':0,'two_plus_metrics':0,'three_plus_metrics':0,'four_metrics':0}
sample=[]
for a in selected:
    r=rows[a]
    vals={
      'price': num(r.get(price_key)) if price_key else None,
      'rating': num(r.get(rating_key)) if rating_key else None,
      'reviews': num(r.get(reviews_key)) if reviews_key else None,
      'bsr': num(r.get(bsr_key)) if bsr_key else None,
    }
    present=sum(v is not None for v in vals.values())
    for k,v in vals.items():
        if v is not None: counts[k]+=1
    if present>=2: counts['two_plus_metrics']+=1
    if present>=3: counts['three_plus_metrics']+=1
    if present>=4: counts['four_metrics']+=1
    if len(sample)<10: sample.append({'asin':a,'title':str(r.get(title_key) or '')[:120],**vals})
receipt={'schemaVersion':'MPR_MARKUP_9K_METRICS_PREFLIGHT_V1','sourceSha256':EXPECTED_SOURCE_SHA256,'selected9kSha256':digest,'selectedCount':9000,'headers':headers,'detectedFields':{'price':price_key,'rating':rating_key,'reviews':reviews_key,'bsr':bsr_key},'coverage':counts,'sample':sample,'policy':{'historicalOnly':True,'freshnessClass':'HISTORICAL_MARKUP_2021_NOT_LIVE','verifiedSales':False,'providerSpendEur':0,'paidCallsTriggered':0,'purchaseAuthorized':False,'databaseWrites':0}}
OUT.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(receipt,ensure_ascii=False,indent=2))

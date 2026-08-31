#!/usr/bin/env python3
import csv,json,hashlib,sys,lzma,re
from pathlib import Path

csv.field_size_limit(16*1024*1024)
PRODUCTS=Path(sys.argv[1]); SEARCHES=Path(sys.argv[2]); CURRENT=Path(sys.argv[3]); OUT_ROWS=Path(sys.argv[4]); OUT_RECEIPT=Path(sys.argv[5]); LIMIT=int(sys.argv[6] if len(sys.argv)>6 else 25)
PRODUCTS_SHA='77fd690fc627b05ca68bd0ba3e7217b7a401e364d96eb6308d502ace92c737e9'
SEARCHES_SHA='0071593ee788681df31110b1490fe2b71243003ece1666a415c06fa3f5cdd985'
SELECTED9K_SHA='e8b53b0aceb7e5847e2f468a64fc8c2c4ce620d8cce5129daa7f3094c4dd1787'
ASIN_RE=re.compile(r'^[A-Z0-9]{10}$')
DATE_RE=re.compile(r'/((?:20)\d{2})/(\d{2})/(\d{2})/')
if hashlib.sha256(PRODUCTS.read_bytes()).hexdigest()!=PRODUCTS_SHA: raise SystemExit('PRODUCTS_SHA_MISMATCH')
if hashlib.sha256(SEARCHES.read_bytes()).hexdigest()!=SEARCHES_SHA: raise SystemExit('SEARCHES_SHA_MISMATCH')
if LIMIT<1 or LIMIT>250: raise SystemExit('LIMIT_OUT_OF_RANGE')
cur=json.loads(CURRENT.read_text()); fields=cur['fields']; ix=fields.index('asin'); current={str(r[ix]).strip().upper() for r in cur['products']}
candidates={}
with lzma.open(PRODUCTS,'rt',encoding='utf-8-sig',newline='') as f:
    rd=csv.DictReader(f)
    for r in rd:
        a=str(r.get('asin') or '').strip().upper(); t=str(r.get('title') or '').strip()
        if ASIN_RE.match(a) and t and a not in current and a not in candidates: candidates[a]=t
selected_asins=sorted(candidates)[:9000]
selected_digest=hashlib.sha256(('\n'.join(selected_asins)).encode()).hexdigest()
if selected_digest!=SELECTED9K_SHA: raise SystemExit('SELECTED9K_DIGEST_MISMATCH:'+selected_digest)
selected=set(selected_asins)

def num(v):
    s=str(v or '').strip().replace(',','').replace('$','')
    if not s:return None
    m=re.search(r'-?\d+(?:\.\d+)?',s)
    return float(m.group()) if m else None

def capture_date(fn):
    m=DATE_RE.search(str(fn or ''))
    if not m:return None
    y,mo,d=map(int,m.groups())
    if y!=2021 or mo!=1 or d<1 or d>31:return None
    return f'{y:04d}-{mo:02d}-{d:02d}'

best={}; source_rows=0; overlap_rows=0; date_missing=0
with lzma.open(SEARCHES,'rt',encoding='utf-8-sig',newline='') as f:
    rd=csv.DictReader(f); headers=rd.fieldnames or []
    required={'asin','stars','reviews','price','product_url','filename','search_term'}
    if not required.issubset(set(headers)): raise SystemExit('SEARCH_FIELDS_REJECTED:'+','.join(headers))
    for r in rd:
        source_rows+=1; a=str(r.get('asin') or '').strip().upper()
        if a not in selected: continue
        overlap_rows+=1
        dt=capture_date(r.get('filename'))
        if not dt: date_missing+=1; continue
        price=num(r.get('price')); rating=num(r.get('stars')); reviews=num(r.get('reviews'))
        metrics=sum(x is not None for x in (price,rating,reviews))
        if metrics<2: continue
        if price is not None and price<=0: price=None
        if rating is not None and not (0<=rating<=5): rating=None
        if reviews is not None and reviews<0: reviews=None
        metrics=sum(x is not None for x in (price,rating,reviews))
        if metrics<2: continue
        row={'externalId':a,'observedAt':dt+'T00:00:00Z','observedAtPrecision':'DAY','sourceFilename':str(r.get('filename') or ''),'sourceUrl':str(r.get('product_url') or ''),'searchTerm':str(r.get('search_term') or ''),'sourceDatasetSha256':SEARCHES_SHA,'evidenceClass':'HISTORICAL_PUBLIC_SEARCH_RESULT','freshnessClass':'HISTORICAL_2021_NOT_LIVE','salesEvidenceClass':'NOT_VERIFIED_SALES','purchaseAuthorized':False}
        if price is not None: row['price']=price
        if rating is not None: row['rating']=rating
        if reviews is not None: row['reviewCount']=reviews
        tie=(metrics,dt,str(r.get('filename') or ''),str(r.get('search_term') or ''),str(r.get('product_url') or ''))
        prev=best.get(a)
        if prev is None or tie[0]>prev[0][0] or (tie[0]==prev[0][0] and tie[1]>prev[0][1]) or (tie[0:2]==prev[0][0:2] and tie[2:]<prev[0][2:]):
            best[a]=(tie,row)
eligible=sorted(best)
rows=[best[a][1] for a in eligible[:LIMIT]]
if len(rows)!=LIMIT: raise SystemExit(f'PILOT_ROWS_INSUFFICIENT:{len(rows)}')
if any(sum(k in r for k in ('price','rating','reviewCount'))<2 for r in rows): raise SystemExit('MIN_TWO_METRICS_BROKEN')
receipt={'schemaVersion':'MPR_MARKUP_SEARCH_HISTORY_PILOT_BUILD_V1','selected9kSha256':selected_digest,'searchesSha256':SEARCHES_SHA,'sourceRows':source_rows,'overlapRows':overlap_rows,'dateMissingRows':date_missing,'eligibleAsinsTwoPlusMetrics':len(eligible),'pilotRows':len(rows),'pilotAsinSha256':hashlib.sha256(('\n'.join(r['externalId'] for r in rows)).encode()).hexdigest(),'metricCoverage':{'price':sum('price' in r for r in rows),'rating':sum('rating' in r for r in rows),'reviews':sum('reviewCount' in r for r in rows),'threeMetrics':sum(sum(k in r for k in ('price','rating','reviewCount'))==3 for r in rows)},'policy':{'historicalOnly':True,'freshnessClass':'HISTORICAL_2021_NOT_LIVE','observedAtPrecision':'DAY','verifiedSales':False,'providerSpendEur':0,'paidCallsTriggered':0,'purchaseAuthorized':False,'databaseWrites':0}}
OUT_ROWS.write_text(json.dumps({'schemaVersion':'MPR_MARKUP_SEARCH_HISTORY_ROWS_V1','rows':rows},ensure_ascii=False,separators=(',',':'))+'\n')
OUT_RECEIPT.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(receipt,ensure_ascii=False,indent=2))

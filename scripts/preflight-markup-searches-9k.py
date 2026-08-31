#!/usr/bin/env python3
import csv,json,hashlib,sys,lzma,re
from pathlib import Path
csv.field_size_limit(16*1024*1024)
PRODUCTS=Path(sys.argv[1]); SEARCHES=Path(sys.argv[2]); CURRENT=Path(sys.argv[3]); OUT=Path(sys.argv[4])
PRODUCTS_SHA='77fd690fc627b05ca68bd0ba3e7217b7a401e364d96eb6308d502ace92c737e9'
ASIN_RE=re.compile(r'^[A-Z0-9]{10}$')
if hashlib.sha256(PRODUCTS.read_bytes()).hexdigest()!=PRODUCTS_SHA: raise SystemExit('PRODUCTS_SHA_MISMATCH')
cur=json.loads(CURRENT.read_text()); fields=cur['fields']; ix=fields.index('asin'); current={str(r[ix]).strip().upper() for r in cur['products']}
# exact same selected 9K as canonical builder
candidates={}
with lzma.open(PRODUCTS,'rt',encoding='utf-8-sig',newline='') as f:
    rd=csv.DictReader(f)
    for r in rd:
        a=str(r.get('asin') or '').strip().upper(); t=str(r.get('title') or '').strip()
        if ASIN_RE.match(a) and t and a not in current and a not in candidates: candidates[a]=t
selected=set(sorted(candidates)[:9000])

def find(headers,names):
    m={h.strip().lower():h for h in headers}
    for n in names:
        if n in m:return m[n]
    return None
def number(v):
    s=str(v or '').strip().replace(',','')
    if not s:return None
    m=re.search(r'-?\d+(?:\.\d+)?',s)
    return float(m.group()) if m else None

agg={}; total=0
with lzma.open(SEARCHES,'rt',encoding='utf-8-sig',newline='') as f:
    rd=csv.DictReader(f); headers=rd.fieldnames or []
    asin=find(headers,['asin','product_asin','result_asin'])
    price=find(headers,['price','product_price'])
    rating=find(headers,['stars','rating','star_rating'])
    reviews=find(headers,['reviews','review_count','ratings_count'])
    rank=find(headers,['position','rank','organic_rank','search_rank'])
    if not asin: raise SystemExit('SEARCH_ASIN_FIELD_MISSING:'+','.join(headers[:80]))
    for r in rd:
        total+=1; a=str(r.get(asin) or '').strip().upper()
        if a not in selected: continue
        x=agg.setdefault(a,{'price':False,'rating':False,'reviews':False,'rank':False,'rows':0})
        x['rows']+=1
        if price and number(r.get(price)) is not None:x['price']=True
        if rating and number(r.get(rating)) is not None:x['rating']=True
        if reviews and number(r.get(reviews)) is not None:x['reviews']=True
        if rank and number(r.get(rank)) is not None:x['rank']=True
coverage={k:sum(1 for x in agg.values() if x[k]) for k in ['price','rating','reviews','rank']}
coverage['overlap_asins']=len(agg)
coverage['two_plus_metrics']=sum(1 for x in agg.values() if sum(bool(x[k]) for k in ['price','rating','reviews','rank'])>=2)
coverage['three_plus_metrics']=sum(1 for x in agg.values() if sum(bool(x[k]) for k in ['price','rating','reviews','rank'])>=3)
receipt={'schemaVersion':'MPR_MARKUP_SEARCHES_9K_PREFLIGHT_V1','searchesSha256':hashlib.sha256(SEARCHES.read_bytes()).hexdigest(),'searchRows':total,'headers':headers,'detectedFields':{'asin':asin,'price':price,'rating':rating,'reviews':reviews,'rank':rank},'selected9kCount':9000,'coverage':coverage,'policy':{'historicalOnly':True,'verifiedSales':False,'providerSpendEur':0,'paidCallsTriggered':0,'purchaseAuthorized':False,'databaseWrites':0}}
OUT.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n'); print(json.dumps(receipt,ensure_ascii=False,indent=2))

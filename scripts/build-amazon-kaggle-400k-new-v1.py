#!/usr/bin/env python3
import csv, hashlib, io, json, os, re, urllib.parse, urllib.request, zipfile
from pathlib import Path
ZIP=Path(os.environ.get('KAGGLE_ZIP','/tmp/amazon-products-2023.zip'))
EDGE=os.environ['MPR_OVERLAP_EDGE_URL']; TARGET=400000; BATCH=5000
ASIN_RE=re.compile(r'^[A-Z0-9]{10}$')

def oidc_token():
 u=os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']; sep='&' if '?' in u else '?'; u+=sep+urllib.parse.urlencode({'audience':'mpr-amazon-kaggle-overlap'})
 r=urllib.request.Request(u,headers={'Authorization':'bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
 with urllib.request.urlopen(r,timeout=30) as x:return json.load(x)['value']

def classify(asins,token):
 data=json.dumps({'action':'classify','asins':asins}).encode(); r=urllib.request.Request(EDGE,data=data,method='POST',headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
 with urllib.request.urlopen(r,timeout=60) as x:return set(json.load(x)['receipt']['existingAsins'])

with zipfile.ZipFile(ZIP) as z:
 name=next(n for n in z.namelist() if n.endswith('amazon_products.csv'))
 with z.open(name) as raw:
  reader=csv.DictReader(io.TextIOWrapper(raw,encoding='utf-8-sig',newline=''))
  all_asins=sorted({(r.get('asin') or '').strip().upper() for r in reader if ASIN_RE.fullmatch((r.get('asin') or '').strip().upper())})
selected=[]; checked=0; existing_seen=0; calls=0; token=None
for i in range(0,len(all_asins),BATCH):
 batch=all_asins[i:i+BATCH]
 if token is None or calls%25==0: token=oidc_token()
 existing=classify(batch,token); calls+=1; checked+=len(batch); existing_seen+=len(existing)
 for a in batch:
  if a not in existing:
   selected.append(a)
   if len(selected)==TARGET:break
 if len(selected)==TARGET:break
if len(selected)!=TARGET:raise SystemExit(f'NEW_ASIN_TARGET_NOT_MET:{len(selected)} checked={checked}')
payload='\n'.join(selected)+'\n'; digest=hashlib.sha256(payload.encode()).hexdigest()
Path('/tmp/amazon-kaggle-400k-new-asins.txt').write_text(payload)
receipt={'schema':'MPR_AMAZON_KAGGLE_400K_NEW_V1','source':'asaniczka/amazon-products-dataset-2023-1-4m-products','license':'ODC-By','snapshot':'2023-09','selectedNewAsins':len(selected),'checkedSourceAsins':checked,'existingAsinsSeen':existing_seen,'overlapCalls':calls,'selectedSha256':digest,'firstAsin':selected[0],'lastAsin':selected[-1],'writePerformed':False,'verifiedSales':False,'providerSpendEur':0,'paidCallsTriggered':0,'purchaseAuthorized':False}
Path('/tmp/amazon-kaggle-400k-new-receipt.json').write_text(json.dumps(receipt,indent=2,sort_keys=True)+'\n');print(json.dumps(receipt,indent=2,sort_keys=True))

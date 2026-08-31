#!/usr/bin/env python3
import csv,json,lzma,re,sys
from collections import Counter
from pathlib import Path

src=Path(sys.argv[1]); out=Path(sys.argv[2])
with lzma.open(src,'rt',encoding='utf-8-sig',newline='') as f:
    rd=csv.DictReader(f); headers=rd.fieldnames or []
    if 'filename' not in headers: raise SystemExit('FILENAME_FIELD_MISSING')
    samples=[]; patterns=Counter(); parsed=[]; total=0
    rx=[
      re.compile(r'(20\d{2})[-_](\d{2})[-_](\d{2})[T_ -]?(\d{2})?[:_-]?(\d{2})?[:_-]?(\d{2})?'),
      re.compile(r'(20\d{2})(\d{2})(\d{2})[T_-]?(\d{2})?(\d{2})?(\d{2})?')
    ]
    for r in rd:
        total+=1; fn=str(r.get('filename') or '').strip()
        if len(samples)<20 and fn: samples.append(fn)
        if not fn: patterns['EMPTY']+=1; continue
        matched=False
        for i,p in enumerate(rx):
            m=p.search(fn)
            if m:
                patterns[f'RX{i+1}']+=1; matched=True
                if len(parsed)<20: parsed.append({'filename':fn,'groups':list(m.groups())})
                break
        if not matched: patterns['NO_DATE_PATTERN']+=1
receipt={'schemaVersion':'MPR_MARKUP_SEARCH_FILENAME_DATE_INSPECTION_V1','rows':total,'headers':headers,'patterns':dict(patterns),'sampleFilenames':samples,'parsedSamples':parsed,'policy':{'databaseWrites':0,'providerSpendEur':0,'paidCallsTriggered':0,'purchaseAuthorized':False}}
out.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(receipt,ensure_ascii=False,indent=2))

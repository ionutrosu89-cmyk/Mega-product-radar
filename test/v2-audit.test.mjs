import assert from 'node:assert/strict';
import test from 'node:test';
import {strictAuditProduct} from '../v2-audit.js';

const base={
  name:'Produs test',cat:'Home',landed:40,sell:199,
  sourceStatus:'WEB_SIGNAL',kidsGate:'PASS',
  marketScout:{checks:7,foreignPresence:2},
  dataQuality:{level:'LIVE',checks:7},
  supplierIntel:{coverage:1,readiness:'PARTIAL'},
  reviewIntel:{sourceCount:0},
  competitorIntel:{quality:'PARTIAL',resultProxy:1},
  historySummary:{totalScans:3},
  megaAnalysis:{
    lifecycle:'EARLY',trendVelocity:{percent:18},
    components:{demand:78,trend:72,romaniaGap:76,saturation:80,supplier:68,logistics:90,compliance:95},
    economics:{profit:55,margin:27.6,roi:137.5}
  }
};

test('V2 keeps WAIT when evidence is below TEST gate',()=>{
  const p={...base,v2Validation:{evidenceScore:52,confidence:'LOW',marketLive:true,supplierEvidence:'PARTIAL',reviewEvidence:'NONE'}};
  assert.equal(strictAuditProduct(p).decision,'WAIT');
});

test('V2 allows SMALL TEST-equivalent decision on medium evidence with partial supplier evidence',()=>{
  const p={...base,v2Validation:{evidenceScore:60,confidence:'MEDIUM',marketLive:true,supplierEvidence:'PARTIAL',reviewEvidence:'NONE'}};
  assert.equal(strictAuditProduct(p).decision,'TEST');
});

test('V2 BUY requires strong evidence and review evidence',()=>{
  const p={...base,supplierIntel:{coverage:2,readiness:'STRONG'},reviewIntel:{sourceCount:1},v2Validation:{evidenceScore:88,confidence:'HIGH',marketLive:true,supplierEvidence:'STRONG',reviewEvidence:'SINGLE_SOURCE'}};
  assert.equal(strictAuditProduct(p).decision,'BUY');
});

test('V2 does not BUY with high economics but partial market data',()=>{
  const p={...base,sourceStatus:'PARTIAL',dataQuality:{level:'PARTIAL',checks:2},marketScout:{checks:2,foreignPresence:0},supplierIntel:{coverage:2,readiness:'STRONG'},reviewIntel:{sourceCount:2},v2Validation:{evidenceScore:90,confidence:'HIGH',marketLive:false,supplierEvidence:'STRONG',reviewEvidence:'MULTI_SOURCE'}};
  assert.notEqual(strictAuditProduct(p).decision,'BUY');
});

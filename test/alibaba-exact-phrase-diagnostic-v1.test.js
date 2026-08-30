import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseAlibabaExactPhrase,AlibabaExactPhraseDiagnosticTruthPolicy} from '../alibaba-exact-phrase-diagnostic-v1.js';

test('reports nearby product anchors without asserting identity',()=>{
  const html=`<a href="https://www.alibaba.com/product-detail/Other-Office-Item_1601111111111.html">Other</a><div>Five-Layer Metal Iron Mesh Storage Rack Office Organizer with Two Pen Holders File Document Rack $8.50-8.70 MOQ: 1 piece Foshan Yunsheng Boton Technology Co., Ltd.</div><a href="https://www.alibaba.com/product-detail/Five-Layer-Metal-Iron-Mesh-Storage-Rack_1602222222222.html">Exact product</a>`;
  const [x]=diagnoseAlibabaExactPhrase(html,{sourceUrl:'https://www.alibaba.com/countrysearch/CN/rack-file.html'});
  assert.equal(x.diagnosticOnly,true);
  assert.equal(x.canPromoteToMatch,false);
  assert.equal(x.canAuthorizeEconomics,false);
  assert.equal(x.purchaseAuthorized,false);
  assert.ok(x.nearbyProductAnchors.some(a=>a.externalId==='1602222222222'));
  assert.equal(x.truthPolicy.phraseProximityIsProductIdentity,false);
  assert.equal(x.truthPolicy.nearbyAnchorIsVerifiedAssociation,false);
});

test('does not emit diagnostics without an exact two-pen-holder phrase',()=>{
  const html=`<a href="https://www.alibaba.com/product-detail/Five-Tier-Desk-Organizer_1603333333333.html">5-Tier Desk Organizer with Drawer and Pen Holders</a>`;
  assert.deepEqual(diagnoseAlibabaExactPhrase(html),[]);
});

test('truth policy cannot authorize match economics or purchase',()=>{
  assert.equal(AlibabaExactPhraseDiagnosticTruthPolicy.diagnosticIsMatchEvidence,false);
  assert.equal(AlibabaExactPhraseDiagnosticTruthPolicy.diagnosticCanAuthorizeEconomics,false);
  assert.equal(AlibabaExactPhraseDiagnosticTruthPolicy.diagnosticCanAuthorizePurchase,false);
  assert.equal(AlibabaExactPhraseDiagnosticTruthPolicy.unknownEqualsZero,false);
});

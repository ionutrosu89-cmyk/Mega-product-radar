import test from 'node:test';
import assert from 'node:assert/strict';
import {extractAlibabaIndexEvidence} from '../alibaba-index-evidence-v1.js';

test('rejects organizer title attached to clearly unrelated product URL slug',()=>{
  const html=`<div class="card"><a href="https://www.alibaba.com/product-detail/High-Power-Camping-Rechargeable-LED-Torch_1601201546179.html" title="5-Tier Office Desk Organizer with Metal Mesh Storage Racks Paper Letter Tray File Holder 2 Pen Holders Drawer">5-Tier Office Desk Organizer with Metal Mesh Storage Racks Paper Letter Tray File Holder 2 Pen Holders Drawer</a><span>$4.53-5.90</span><span>MOQ: 100 pieces</span></div>`;
  assert.deepEqual(extractAlibabaIndexEvidence(html),[]);
});

test('keeps exact organizer evidence when URL slug and title are coherent',()=>{
  const html=`<div class="card"><a href="https://www.alibaba.com/product-detail/Mesh-Desk-Organizer-With-File-Holder_1601999999999.html" title="Mesh Desk Organizer With File Holder 5-Tier Paper Letter Tray Organizer Drawer 2 Pen Holder Magazine Holder for Office Supplies">Mesh Desk Organizer With File Holder 5-Tier Paper Letter Tray Organizer Drawer 2 Pen Holder Magazine Holder for Office Supplies</a><span>$9.90-10.66</span><span>MOQ: 1000 pieces</span></div>`;
  const [row]=extractAlibabaIndexEvidence(html);
  assert.equal(row.externalId,'1601999999999');
  assert.equal(row.exactDistinctiveConfiguration,true);
  assert.equal(row.signals.twoPenHolders,true);
});

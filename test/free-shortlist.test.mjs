import assert from 'node:assert/strict';
import test from 'node:test';
import {FREE_SHORTLIST_STORAGE_KEY,freeProductKey,freeShortlistStorageKey,readFreeShortlist,toggleComparison,toggleFreeShortlist} from '../free-shortlist.js';

const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),values};};

test('Free shortlist stores only explicit product keys on the device',()=>{
  const storage=memory();
  const key=freeProductKey({asin:'b012345678'});
  assert.equal(key,'LIVE:B012345678');
  const added=toggleFreeShortlist(new Set(),key,storage);
  assert.equal(added.added,true);
  assert.deepEqual([...readFreeShortlist(storage)],[key]);
  assert.equal(storage.values.has(FREE_SHORTLIST_STORAGE_KEY),true);
  const removed=toggleFreeShortlist(added.values,key,storage);
  assert.equal(removed.added,false);
  assert.equal(readFreeShortlist(storage).size,0);
});

test('comparison is session-only and limited to three products',()=>{
  let state=new Set();
  for(const key of ['a','b','c'])state=toggleComparison(state,key).values;
  const blocked=toggleComparison(state,'d');
  assert.equal(blocked.limitReached,true);
  assert.deepEqual([...blocked.values],['a','b','c']);
  assert.equal(toggleComparison(state,'b').values.has('b'),false);
});

test('retired product keys are purged while current shortlist entries remain',()=>{
 const storage=memory();storage.setItem(FREE_SHORTLIST_STORAGE_KEY,JSON.stringify(['AMAZON_ARCHIVE:OLD','EBAY:CURRENT']));
 assert.deepEqual([...readFreeShortlist(storage)],['EBAY:CURRENT']);
 assert.deepEqual(JSON.parse(storage.getItem(FREE_SHORTLIST_STORAGE_KEY)),['EBAY:CURRENT']);
});

test('shortlists remain separate when two accounts share one browser',()=>{
 const storage=memory(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 toggleFreeShortlist(new Set(),'EBAY:A',storage,a);
 toggleFreeShortlist(new Set(),'EBAY:B',storage,b);
 toggleFreeShortlist(new Set(),'EBAY:GUEST',storage);
 assert.deepEqual([...readFreeShortlist(storage,a)],['EBAY:A']);
 assert.deepEqual([...readFreeShortlist(storage,b)],['EBAY:B']);
 assert.deepEqual([...readFreeShortlist(storage)],['EBAY:GUEST']);
 assert.notEqual(freeShortlistStorageKey(a),freeShortlistStorageKey(b));
 assert.throws(()=>freeShortlistStorageKey('invalid-user'));
 assert.deepEqual([...readFreeShortlist(storage,'invalid-user')],[]);
});

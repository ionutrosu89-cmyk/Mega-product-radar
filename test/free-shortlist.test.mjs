import assert from 'node:assert/strict';
import test from 'node:test';
import {FREE_SHORTLIST_STORAGE_KEY,freeProductKey,readFreeShortlist,toggleComparison,toggleFreeShortlist} from '../free-shortlist.js';

const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),values};};

test('Free shortlist stores only explicit product keys on the device',()=>{
  const storage=memory();
  const key=freeProductKey({asin:'b012345678'});
  assert.equal(key,'AMAZON_ARCHIVE:B012345678');
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

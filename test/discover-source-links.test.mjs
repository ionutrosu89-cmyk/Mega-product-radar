import test from 'node:test';
import assert from 'node:assert/strict';
import {bestEvidence} from '../discover-ranking.js';

test('bestEvidence prefers a direct listing URL and keeps search URL separate',()=>{
  const evidence=bestEvidence({signals:{amazonDE:{present:true,evidenceClass:'VERIFIED',searchUrl:'https://search.example/query',links:[{title:'Exact listing',url:'https://amazon.de/dp/ABC'}]}}});
  assert.equal(evidence.url,'https://amazon.de/dp/ABC');
  assert.equal(evidence.searchUrl,'https://search.example/query');
  assert.equal(evidence.direct,true);
});

test('bestEvidence never promotes a search URL to an exact source',()=>{
  const evidence=bestEvidence({signals:{amazonDE:{present:true,evidenceClass:'DERIVED',searchUrl:'https://search.example/query',links:[]}}});
  assert.equal(evidence.url,'');
  assert.equal(evidence.searchUrl,'https://search.example/query');
  assert.equal(evidence.direct,false);
});

test('products without observed evidence expose no source action URL',()=>{
  const evidence=bestEvidence({signals:{amazonDE:{present:false,searchUrl:'https://search.example/query',links:[]}}});
  assert.equal(evidence.platform,'NONE');
  assert.equal(evidence.url,'');
  assert.equal(evidence.searchUrl,'');
  assert.equal(evidence.direct,false);
});

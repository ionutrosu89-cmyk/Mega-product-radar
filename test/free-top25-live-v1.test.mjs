import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFreeTop25LiveUniverse} from '../free-top25-live-v1.js';

function discoveryProduct(i,{category='Home organization',direct=true,score=100-i}={}){
  return {
    name:`Produs ${i}`,
    cat:category,
    discoveryAnalysis:{score},
    signals:{amazonUS:{present:true,resultCount:1000-i,evidenceClass:'VERIFIED',label:'Amazon US',links:direct?[{url:`https://www.amazon.com/dp/TEST${i}`,title:`Produs ${i}`}]:[]}}
  };
}

test('publishes a live niche only when 25 direct-evidence products exist',()=>{
  const report=buildFreeTop25LiveUniverse({discoveryProducts:Array.from({length:25},(_,i)=>discoveryProduct(i+1))});
  assert.equal(report.niches.length,1);
  assert.equal(report.niches[0].products.length,25);
  assert.equal(report.truthPolicy.completeTop25Required,true);
  assert.equal(report.truthPolicy.supplierDataExposed,false);
  assert.equal(report.truthPolicy.economicsExposed,false);
  assert.equal(report.truthPolicy.purchaseAuthorized,false);
});

test('fails closed when a niche has only 24 eligible products',()=>{
  const report=buildFreeTop25LiveUniverse({discoveryProducts:Array.from({length:24},(_,i)=>discoveryProduct(i+1))});
  assert.equal(report.niches.length,0);
  assert.equal(report.stats.completeNicheCount,0);
});

test('excludes products without a direct public source URL',()=>{
  const rows=Array.from({length:25},(_,i)=>discoveryProduct(i+1));
  rows[0]=discoveryProduct(1,{direct:false});
  const report=buildFreeTop25LiveUniverse({discoveryProducts:rows});
  assert.equal(report.stats.eligibleCandidates,24);
  assert.equal(report.niches.length,0);
});

test('does not expose supplier or economics fields from upstream rows',()=>{
  const rows=Array.from({length:25},(_,i)=>({...discoveryProduct(i+1),supplierUrl:'https://supplier.example',landed:12,profit:99,roi:4.2}));
  const report=buildFreeTop25LiveUniverse({discoveryProducts:rows});
  const product=report.niches[0].products[0];
  assert.equal('supplierUrl' in product,false);
  assert.equal('landed' in product,false);
  assert.equal('profit' in product,false);
  assert.equal('roi' in product,false);
});

test('accepts Organic Rising only when all feed quality gates are true',()=>{
  const organic=Array.from({length:25},(_,i)=>({
    name:`Organic ${i+1}`,category:'Pet',eligibleForFeed:true,organicRiseScore:80-i,
    sourceMarket:'Amazon DE',sourceUrl:`https://www.amazon.de/dp/ORG${i+1}`,
    qualityGate:{topTwoPages:true,notPromoted:true,categoryRelevant:true}
  }));
  const report=buildFreeTop25LiveUniverse({organicProducts:organic});
  assert.equal(report.niches.length,1);
  assert.equal(report.niches[0].products.length,25);
});

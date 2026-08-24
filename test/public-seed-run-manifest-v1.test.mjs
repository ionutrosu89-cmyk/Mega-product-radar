import assert from 'node:assert/strict';
import test from 'node:test';
import {buildPublicSeedRunManifest,splitSeedRunIntoBatches,validateSeedRunForExecution} from '../public-seed-run-manifest.js';

const mappings=[
  {approved:true,mprCategory:'Desk organization',amazon:{markets:['US','DE'],surfaces:['BEST_SELLERS','NEW_RELEASES'],categoryPath:'office-products'},alibaba:{categorySlug:'desk-organizer'},ebay:{categoryId:'159907',marketplaceId:'EBAY_US'}},
  {approved:false,mprCategory:'Unreviewed niche',amazon:{markets:['US'],surfaces:['BEST_SELLERS']}}
];

test('manifest creates tasks only from manually approved category mappings',()=>{
  const out=buildPublicSeedRunManifest({categoryMappings:mappings});
  assert.equal(out.approvedCategoryMappings,1);
  assert.equal(out.taskCount,6);
  assert.equal(out.stats.byPlatform.AMAZON,4);
  assert.equal(out.stats.byPlatform.ALIBABA,1);
  assert.equal(out.stats.byPlatform.EBAY,1);
  assert.ok(out.rejected.some(x=>x.error==='MAPPING_NOT_APPROVED'));
  assert.equal(out.externalExecutionTriggered,false);
  assert.equal(out.paidCallsTriggered,0);
});

test('manifest never embeds credentials and never auto executes',()=>{
  const out=buildPublicSeedRunManifest({categoryMappings:mappings});
  const ebay=out.tasks.find(x=>x.platform==='EBAY');
  assert.equal(ebay.credentialsRequired,true);
  assert.equal(ebay.serverSecretRequired,'EBAY_OAUTH_TOKEN');
  assert.equal(ebay.executeAutomatically,false);
  assert.equal(out.credentialsRemainServerSide,true);
  assert.equal(out.approvedSpendEur,0);
});

test('task cap prevents accidental giant run manifests',()=>{
  const many=Array.from({length:20},(_,i)=>({approved:true,mprCategory:`C${i}`,amazon:{markets:['US','DE','FR'],surfaces:['BEST_SELLERS','NEW_RELEASES','MOVERS_AND_SHAKERS']},alibaba:{categorySlug:`cat-${i}`},ebay:{categoryId:String(1000+i)}}));
  const out=buildPublicSeedRunManifest({categoryMappings:many,maxTasks:25});
  assert.equal(out.taskCount,25);
  assert.ok(out.truncatedTaskCount>0);
});

test('manifest splits into small manual execution batches',()=>{
  const out=buildPublicSeedRunManifest({categoryMappings:mappings});
  const split=splitSeedRunIntoBatches(out,2);
  assert.equal(split.batchCount,3);
  assert.ok(split.batches.every(x=>x.requiresManualExecutionApproval===true));
  assert.equal(split.externalExecutionTriggered,false);
});

test('execution validation fails closed when free API credentials are missing',()=>{
  const out=buildPublicSeedRunManifest({categoryMappings:mappings});
  const split=splitSeedRunIntoBatches(out,20);
  const noCreds=validateSeedRunForExecution(split.batches[0],{});
  assert.equal(noCreds.ok,false);
  assert.ok(noCreds.blockers.some(x=>x.sourceKey==='EBAY_BEST_SELLING'&&x.error==='CREDENTIALS_REQUIRED'));
  const withCreds=validateSeedRunForExecution(split.batches[0],{EBAY_BEST_SELLING:true});
  assert.equal(withCreds.ok,true);
  assert.equal(withCreds.approvedSpendEur,0);
});

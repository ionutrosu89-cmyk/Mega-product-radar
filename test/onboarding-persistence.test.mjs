import test from 'node:test';
import assert from 'node:assert/strict';
import {onboardingBudget,persistOnboarding} from '../onboarding-persistence.js';
import {accountBrowserStorageKey} from '../account-browser-storage.js';

const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const storageKey=accountBrowserStorageKey('mpr_plan_finder_v1',a);
const profile={monthly_budget_ron:0},choices={decisionNeed:'EXPLORE',chinaAgent:'NO',recommendedPlan:'FREE'};

test('a zero budget survives hydration while absent or invalid values use the default',()=>{
  assert.equal(onboardingBudget(0),0);assert.equal(onboardingBudget('0'),0);assert.equal(onboardingBudget(7800),7800);
  for(const value of [null,undefined,'',Infinity,NaN,-1,'bad'])assert.equal(onboardingBudget(value),3000);
});

test('a successful profile write remains successful when browser storage is blocked',async()=>{
  let writes=0;
  const result=await persistOnboarding(profile,choices,{storageKey,getSession:async()=>({user:{id:a}}),saveProfile:async(input,options)=>{writes++;assert.equal(options.expectedUserId,a);return input;},storage:()=>{throw new Error('SecurityError');}});
  assert.equal(writes,1);assert.deepEqual(result.savedProfile,profile);assert.equal(result.localChoicesSaved,false);
});

test('a storage quota failure cannot erase a completed server save',async()=>{
  const result=await persistOnboarding(profile,choices,{storageKey,getSession:async()=>({user:{id:a}}),saveProfile:async()=>profile,storage:()=>({setItem(){throw new Error('QuotaExceededError');}})});
  assert.equal(result.savedProfile.monthly_budget_ron,0);assert.equal(result.localChoicesSaved,false);
});

test('server failure prevents browser completion state from being written',async()=>{
  let touched=false;
  await assert.rejects(persistOnboarding(profile,choices,{storageKey,getSession:async()=>({user:{id:a}}),saveProfile:async()=>{throw new Error('write failed');},storage:()=>{touched=true;return {setItem(){}};}}),/write failed/);
  assert.equal(touched,false);
});

test('an account switch or logout rejects stale onboarding before any write',async()=>{
  for(const session of [{user:{id:b}},null]){
    let touched=false;
    await assert.rejects(persistOnboarding(profile,choices,{storageKey,getSession:async()=>session,saveProfile:async()=>{touched=true;},storage:()=>{touched=true;}}),/Contul s-a schimbat/);
    assert.equal(touched,false);
  }
});

test('valid device preferences are stored only under the active account key',async()=>{
  const store=new Map();
  const result=await persistOnboarding(profile,choices,{storageKey,getSession:async()=>({user:{id:a}}),saveProfile:async()=>profile,storage:()=>({setItem:(key,value)=>store.set(key,value)})});
  assert.equal(result.localChoicesSaved,true);assert.equal(store.size,1);assert.deepEqual(JSON.parse(store.get(storageKey)),choices);
  assert.equal(store.has('mpr_plan_finder_v1'),false);
});

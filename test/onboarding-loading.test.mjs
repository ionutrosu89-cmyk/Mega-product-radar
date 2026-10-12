import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=(await readFile(new URL('../onboarding.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(loadSellerPreferences){
 const nodes=new Map();
 function node(id){if(!nodes.has(id))nodes.set(id,{disabled:false,hidden:false,value:'',style:{},listeners:{},setAttribute(){},querySelectorAll(){return [];},addEventListener(name,fn){this.listeners[name]=fn;}});return nodes.get(id);}
 const document={querySelector:s=>s.startsWith('#')?node(s.slice(1)):null,querySelectorAll:()=>[]};
 const context=vm.createContext({document,location:{},getCurrentSession:async()=>({user:{id:'A'}}),loadSellerPreferences,accountBrowserStorageKey:()=> 'account-A',onboardingBudget:v=>v,localStorage:{getItem:()=>null},trackJourneyEvent:()=>{},console});
 vm.runInContext(source,context);
 return {node,context};
}
test('slow profile load blocks navigation and submission until hydration completes',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>resolve=r));await tick();
 assert.equal(h.node('profileFields').disabled,true);assert.equal(h.node('next').disabled,true);
 h.node('next').listeners.click();await h.node('form').listeners.submit({preventDefault(){}});
 assert.equal(vm.runInContext('step',h.context),1);
 resolve({monthly_budget_ron:7800,marketplaces:['EMAG_RO']});await tick();
 assert.equal(h.node('budget').value,7800);assert.equal(h.node('next').disabled,false);
});
test('failed hydration stays locked and retry can recover without defaults being saved',async()=>{
 let fail=true;const h=harness(async()=>{if(fail)throw Error('offline');return {monthly_budget_ron:3000};});await tick();
 assert.equal(h.node('save').disabled,true);assert.equal(h.node('retryLoad').hidden,false);
 fail=false;await h.node('retryLoad').listeners.click();await tick();
 assert.equal(h.node('save').disabled,false);assert.equal(h.node('retryLoad').hidden,true);
});

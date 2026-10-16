import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {buildBetaStudyMetadata} from '../beta-study-answers.js';
import {evaluateBetaEvidence} from '../beta-evidence-gate.js';
import {buildFreeBetaStudyEvidence} from '../free-beta-scorecard-v1.js';

const answers=(overrides={})=>new Map(Object.entries({product:'Organizator',understood:'yes',useful:'yes',watchlist:'yes',intervention:'untested',...overrides}));

test('no product availability is recorded as unknown, not a failed or successful evaluation',()=>{
 const metadata=buildBetaStudyMetadata(answers({product:'',understood:'unavailable',useful:'unavailable',watchlist:'unavailable'}));
 assert.equal(metadata.productFlowTested,false);
 assert.equal(metadata.understoodEvidence,null);
 assert.equal(metadata.useful,null);
 assert.equal(metadata.completedWatchlist,null);
 assert.equal(metadata.completedIntervention,null);
 assert.equal(metadata.usefulnessStatus,'unavailable');
});

test('untested answers stay unknown while a real negative response stays false',()=>{
 const metadata=buildBetaStudyMetadata(answers({understood:'untested',useful:'no',watchlist:'no'}));
 assert.equal(metadata.productFlowTested,true);
 assert.equal(metadata.understoodEvidence,null);
 assert.equal(metadata.useful,false);
 assert.equal(metadata.completedWatchlist,false);
 assert.equal(buildBetaStudyMetadata(answers()).completedWatchlist,true);
});

test('a missing product or unsupported answer cannot produce success metadata',()=>{
 for(const watchlist of ['yes','no'])assert.throws(()=>buildBetaStudyMetadata(answers({product:' ',watchlist})),/Numește produsul/);
 for(const key of ['understood','useful','watchlist','intervention'])assert.throws(()=>buildBetaStudyMetadata(answers({[key]:'invalid'})),/Completează/);
 const metadata=buildBetaStudyMetadata(answers({watchlist:'unavailable'}));
 assert.equal(metadata.understoodEvidence,null);
 assert.equal(metadata.useful,null);
});

test('five unavailable responses cannot pass either launch evidence gate',()=>{
 const metadata=buildBetaStudyMetadata(answers({product:'',understood:'unavailable',useful:'unavailable',watchlist:'unavailable'}));
 const sessions=Array.from({length:5},(_,i)=>({...metadata,userId:`u${i}`,realParticipant:true}));
 const gate=evaluateBetaEvidence({sessions,technicalChecksPassed:true,confirmedProductFlow:true});
 assert.equal(gate.decision,'CONTINUE_FREE_BETA');assert.equal(gate.metrics.productFlowSessions,0);
 const participants=sessions.map((row,i)=>({user_id:row.userId,workspace_id:`w${i}`,status:'ACTIVATED'}));
 const events=sessions.map((row,i)=>({user_id:row.userId,workspace_id:`w${i}`,created_at:'2026-10-16T12:00:00Z',event_name:'BETA_VALIDATION_SESSION',metadata}));
 const scorecard=buildFreeBetaStudyEvidence(participants,events);
 assert.equal(scorecard.status,'INCOMPLETE');assert.equal(scorecard.productFlowSessions,0);
});

test('save failure restores the form and never shows a success message',async()=>{
 const source=(await readFile(new URL('../beta-study.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 let handler;const button={disabled:false},status={textContent:''};
 const form={querySelector:()=>button};
 const context={document:{querySelector:selector=>selector==='#study'?{addEventListener:(_name,fn)=>handler=fn}:status},FormData:class{constructor(){return answers();}},buildBetaStudyMetadata,trackJourneyEvent:async()=>{throw new Error('offline');}};
 vm.runInNewContext(source,context);
 await handler({preventDefault(){},currentTarget:form});
 assert.equal(button.disabled,false);assert.match(status.textContent,/nu a fost salvată/);assert.doesNotMatch(status.textContent,/Mulțumim/);
});

test('a pending save blocks duplicate form submissions',async()=>{
 const source=(await readFile(new URL('../beta-study.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 let handler,resolve,calls=0;const button={disabled:false},status={textContent:''};
 const form={querySelector:()=>button};
 vm.runInNewContext(source,{document:{querySelector:selector=>selector==='#study'?{addEventListener:(_name,fn)=>handler=fn}:status},FormData:class{constructor(){return answers();}},buildBetaStudyMetadata,trackJourneyEvent:()=>{calls++;return new Promise(done=>resolve=done);}});
 const event={preventDefault(){},currentTarget:form};
 const pending=handler(event);await handler(event);assert.equal(calls,1);
 resolve(true);await pending;assert.equal(button.disabled,false);assert.match(status.textContent,/a fost salvată/);
});

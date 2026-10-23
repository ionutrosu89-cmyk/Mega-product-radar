import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {buildEditorialRadarFeed,freshEditorialProducts,EDITORIAL_EVIDENCE_TYPES} from '../editorial-radar-v1.js';
import {buildFreeSignalResearchFeed,freshPublishedFreeSignalResearchFeed,freeResearchLinks} from '../free-signal-research-v1.js';

const source=(await readFile(new URL('../editorial-radar.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
const initial=new Date('2026-09-27T12:00:00Z');
const candidate={id:'BO-TEST',nicheId:'BIROU_ORGANIZARE',title:'Concept de organizare',need:'Organizarea biroului.',rationale:'Concept documentat pentru cercetare.',brandReview:{status:'GENERIC_CONCEPT_REVIEWED',reviewer:'Test',reviewedAt:initial.toISOString()},publication:{status:'APPROVED_RESEARCH',reviewer:'Test',reviewedAt:initial.toISOString(),rightsBasis:'ORIGINAL_MPR_SUMMARY_AND_LINKS'},evidence:[{type:'IDENTITY',sourceName:'Sursă de test',sourceUrl:'https://example.com/concept',observedAt:initial.toISOString(),retrievedAt:initial.toISOString(),summary:'Identitate observată pentru test.',usage:'LINK_WITH_ORIGINAL_SUMMARY',verification:'OBSERVED'}]};
const editorial=buildEditorialRadarFeed({schema:'MPR_EDITORIAL_CANDIDATES_V1',products:[candidate]},{now:initial});
const signals=buildFreeSignalResearchFeed({observations:[{nicheId:candidate.nicheId,sourceKey:'GOOGLE_TRENDS',claim:'SEARCH_INTEREST',sourceUrl:'https://trends.google.com/trends/explore?geo=RO&q=organizator%20birou',concept:'organizator birou',observedAt:initial.toISOString(),periodStart:'2026-09-01',periodEnd:'2026-09-27',summary:'Semnal de interes de test.',reviewer:'Test',publicStatus:'APPROVED_ORIGINAL_SUMMARY'}]},{now:initial});

async function harness(){
  let now=initial,saves=0;
  const nodes=new Map(),events=new Map(),windows=new Map(),timers=[];
  const element=()=>({children:[],value:'',checked:false,hidden:false,dataset:{},options:[],append(...items){this.children.push(...items);this.options.push(...items);},replaceChildren(...items){this.children=items;},setAttribute(){},addEventListener(){}});
  const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
  get('#nicheSelect').value=candidate.nicheId;
  const document={hidden:false,querySelector:get,createElement:element,addEventListener:(name,callback)=>events.set(name,callback)};
  const context=vm.createContext({document,window:{addEventListener:(name,callback)=>windows.set(name,callback)},location:{search:''},URLSearchParams,Intl,Date,console,EDITORIAL_EVIDENCE_TYPES,
    freshEditorialProducts:feed=>freshEditorialProducts(feed,{now}),freshPublishedFreeSignalResearchFeed:feed=>freshPublishedFreeSignalResearchFeed(feed,{now}),freeResearchLinks,
    freeProductKey:()=>candidate.id,readFreeShortlist:()=>new Set(),toggleFreeShortlist:()=>{saves++;return {changed:false};},getCurrentSession:async()=>null,
    fetch:async url=>({ok:true,json:async()=>url==='editorial-radar-v1.json'?editorial:signals}),setInterval:callback=>timers.push(callback)});
  vm.runInContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  return {get,document,events,windows,timers,advance:date=>{now=new Date(date);},saves:()=>saves};
}
const text=node=>[node.textContent||'',...node.children.map(text)].join(' ');

test('an open editorial page withdraws expired cards and signals on its clock check',async()=>{
  const h=await harness();
  assert.match(h.get('#count').textContent,/1 produse afișate/);
  assert.match(text(h.get('#research')),/Semnal de interes de test/);
  h.advance('2026-10-28T12:00:00Z');h.timers[0]();
  assert.match(h.get('#count').textContent,/0 produse afișate/);
  assert.doesNotMatch(text(h.get('#research')),/Semnal de interes de test/);
  assert.match(text(h.get('#research')),/Deschide Google Trends/);
});

test('returning to a hidden page rechecks dates and a stale save cannot persist',async()=>{
  const h=await harness();h.advance('2026-10-28T12:00:00Z');
  h.events.get('click')({target:{closest:()=>({dataset:{save:candidate.id}})}});
  assert.equal(h.saves(),0);
  h.document.hidden=false;h.events.get('visibilitychange')();
  await h.windows.get('focus')();
  assert.match(h.get('#count').textContent,/0 produse afișate/);
});

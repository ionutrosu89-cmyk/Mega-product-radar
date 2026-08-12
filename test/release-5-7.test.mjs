import assert from 'node:assert/strict';
import test from 'node:test';
import { canEnterPurchaseFlow, discoveryScore, effectiveDiscoveryProduct, normalizeDiscoveryRecord, suggestedDiscoveryStage } from '../discovery-engine.js';
import { appendHistoryPoint, discoveryTrendWindows, trendLabel } from '../discovery-history.js';
import { analyzeReviewSnippets } from '../review-intelligence.js';
import { applyVault, collectVault, validateVault, VAULT_KEYS } from '../data-vault.js';
import { buildAlerts } from '../alerts.js';

function memoryStorage(seed={}){const map=new Map(Object.entries(seed));return{getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),dump:()=>Object.fromEntries(map)};}

test('open discovery candidate with unknown pricing is never auto-rejected or purchase-ready',()=>{
  const p={name:'Open candidate',cat:'Home',checks:7,foreignPresence:2,chinaPresence:2,romaniaPresence:0,foreignResults:8,chinaResults:6,socialResults:3};
  assert.equal(discoveryScore(p).economics.priceComplete,false);
  assert.notEqual(suggestedDiscoveryStage(p),'REJECT');
  assert.equal(canEnterPurchaseFlow(p,{stage:'BUY CANDIDATE'}),false);
});

test('manual pricing validation can make a non-kids LIVE candidate eligible for purchase flow',()=>{
  const p={name:'Open candidate',cat:'Home',checks:8,foreignPresence:3,chinaPresence:2,romaniaPresence:0,foreignResults:24,chinaResults:16,socialResults:20};
  const r=normalizeDiscoveryRecord({stage:'BUY CANDIDATE',sellTarget:329,landedEstimate:60});
  const effective=effectiveDiscoveryProduct(p,r);
  assert.equal(discoveryScore(effective).economics.priceComplete,true);
  assert.equal(canEnterPurchaseFlow(p,r),true);
});

test('history windows use LIVE points and expose 7/30/90 deltas when enough history exists',()=>{
  const now=Date.parse('2026-08-13T00:00:00Z');let points=[];
  points=appendHistoryPoint(points,{at:'2026-05-10T00:00:00Z',score:60,quality:'LIVE'},120,now);
  points=appendHistoryPoint(points,{at:'2026-07-10T00:00:00Z',score:70,quality:'LIVE'},120,now);
  points=appendHistoryPoint(points,{at:'2026-08-05T00:00:00Z',score:76,quality:'LIVE'},120,now);
  points=appendHistoryPoint(points,{at:'2026-08-13T00:00:00Z',score:85,quality:'LIVE'},120,now);
  const w=discoveryTrendWindows(points,now);
  assert.equal(w.d7.scoreDelta,9);assert.equal(w.d30.scoreDelta,15);assert.equal(w.d90.scoreDelta,25);assert.equal(trendLabel(w.d7),'ACCELERATING');
});

test('review intelligence only reports themes actually present in snippets',()=>{
  const a=analyzeReviewSnippets(['The adhesive falls off after two days','Too small for a large drawer','Packaging was fine']);
  assert.ok(a.negativeThemes.some(x=>x.theme==='adhesion'));
  assert.ok(a.negativeThemes.some(x=>x.theme==='size'));
  assert.equal(a.confidence,'LOW');
});

test('Data Vault exports only known keys and rejects unknown keys on restore',()=>{
  const storage=memoryStorage({[VAULT_KEYS[0]]:'{"a":1}',other:'secret'}),backup=collectVault(storage);
  assert.deepEqual(Object.keys(backup.data),[VAULT_KEYS[0]]);
  assert.equal(validateVault({...backup,data:{...backup.data,evil:'x'}}).ok,false);
  const target=memoryStorage();assert.equal(applyVault(backup,target),1);assert.equal(target.getItem(VAULT_KEYS[0]),'{"a":1}');
});

test('Alert engine ignores PARTIAL discovery and alerts strong LIVE candidates',()=>{
  const partial={products:[{name:'P',checkedAt:'2026-08-13T00:00:00Z',discoveryAnalysis:{score:95,quality:{level:'PARTIAL'}}}]};
  assert.equal(buildAlerts(partial,{products:[]}).length,0);
  const live={products:[{name:'L',checkedAt:'2026-08-13T00:00:00Z',discoveryAnalysis:{score:90,quality:{level:'LIVE'}}}]};
  assert.ok(buildAlerts(live,{products:[]}).some(x=>x.type==='DISCOVERY'));
});

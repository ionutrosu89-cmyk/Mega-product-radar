import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTop25Snapshot,
  compareTop25Snapshots,
  movementDisplay,
  sourceMovementDisplay,
  upsertTop25SnapshotHistory
} from '../top25-movement.js';

const niche={id:'TEST',products:[
  {name:'Produs A',sourceKey:'BEAUTYMATTER',sourceTier:'B',sourceKind:'PUBLISHED_RANKING',sourceRank:2},
  {name:'Produs B',sourceKey:'AMAZON_KITCHEN',sourceTier:'A',sourceKind:'BEST_SELLERS',sourceRank:3}
]};

test('prima observație este BAZĂ, nu NEW',()=>{
  const current=buildTop25Snapshot(niche,'2026-08-22');
  const movement=compareTop25Snapshots(current,null).get('produs-a');
  assert.equal(movement.status,'BASELINE');
  assert.equal(movementDisplay(movement).label,'BAZĂ');
});

test('calculează urcare, coborâre și menținere doar față de snapshot anterior',()=>{
  const previous={nicheId:'TEST',reviewedAt:'2026-08-21',products:[
    {key:'produs-a',internalRank:4,sourceRank:5},
    {key:'produs-b',internalRank:1,sourceRank:null},
    {key:'produs-c',internalRank:3,sourceRank:null}
  ]};
  const current={nicheId:'TEST',reviewedAt:'2026-08-22',products:[
    {key:'produs-a',internalRank:1,sourceRank:2},
    {key:'produs-b',internalRank:2,sourceRank:null},
    {key:'produs-c',internalRank:3,sourceRank:null}
  ]};
  const moves=compareTop25Snapshots(current,previous);
  assert.equal(moves.get('produs-a').status,'UP');
  assert.equal(moves.get('produs-a').delta,3);
  assert.equal(movementDisplay(moves.get('produs-a')).label,'↑ 3');
  assert.equal(moves.get('produs-b').status,'DOWN');
  assert.equal(moves.get('produs-b').delta,-1);
  assert.equal(movementDisplay(moves.get('produs-b')).label,'↓ 1');
  assert.equal(moves.get('produs-c').status,'STABLE');
  assert.equal(movementDisplay(moves.get('produs-c')).label,'MENȚINUT');
});

test('produs absent din snapshotul anterior devine NEW numai dacă există snapshot anterior',()=>{
  const previous={nicheId:'TEST',reviewedAt:'2026-08-21',products:[{key:'produs-a',internalRank:1,sourceRank:null}]};
  const current={nicheId:'TEST',reviewedAt:'2026-08-22',products:[{key:'produs-nou',internalRank:1,sourceRank:null}]};
  const movement=compareTop25Snapshots(current,previous).get('produs-nou');
  assert.equal(movement.status,'NEW');
});

test('mișcarea rank-ului sursei există numai când ambele rank-uri sunt observate explicit',()=>{
  const current=buildTop25Snapshot(niche,'2026-08-22');
  const a=current.products.find(p=>p.key==='produs-a');
  const b=current.products.find(p=>p.key==='produs-b');
  assert.equal(a.sourceRank,2);
  assert.equal(b.sourceRank,null,'rank-ul Amazon derivat nu trebuie tratat drept rank observat');

  const previous={nicheId:'TEST',reviewedAt:'2026-08-21',products:[
    {key:'produs-a',internalRank:1,sourceRank:5},
    {key:'produs-b',internalRank:2,sourceRank:7}
  ]};
  const moves=compareTop25Snapshots(current,previous);
  assert.equal(moves.get('produs-a').sourceDelta,3);
  assert.equal(sourceMovementDisplay(moves.get('produs-a')),'↑ 3');
  assert.equal(moves.get('produs-b').sourceDelta,null);
  assert.equal(sourceMovementDisplay(moves.get('produs-b')),null);
});

test('istoricul nu dublează aceeași revizie și păstrează maximum opt snapshot-uri per nișă',()=>{
  let history=[];
  for(let day=1;day<=10;day++){
    history=upsertTop25SnapshotHistory(history,{nicheId:'TEST',reviewedAt:`2026-08-${String(day).padStart(2,'0')}`,products:[]});
  }
  assert.equal(history.length,8);
  const replaced=upsertTop25SnapshotHistory(history,{nicheId:'TEST',reviewedAt:'2026-08-10',products:[{key:'x'}]});
  assert.equal(replaced.length,8);
  assert.equal(replaced.find(x=>x.reviewedAt==='2026-08-10').products.length,1);
});

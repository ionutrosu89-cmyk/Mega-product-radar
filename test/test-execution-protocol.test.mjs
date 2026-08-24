import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {buildTestPlan,startRealTest,measureRealTest} from '../test-execution-engine.js';

const readyDecision={status:'TEST_BUY',landedCostConfirmed:true,unitLandedCost:12,quantity:24,testBudget:288,targetSalePrice:39.9,passedGates:9,gateCount:9};
const product={name:'Produs test'};

test('FINALIST or HOLD can never create a real test plan',()=>{
  for(const status of ['FINALIST','HOLD','VALIDATE']){
    const x=buildTestPlan(product,{...readyDecision,status});
    assert.equal(x.ok,false);assert.match(x.blockers.join(' '),/TEST_BUY/);
  }
});

test('TEST_BUY plan requires confirmed landed cost and 20–30 units',()=>{
  assert.equal(buildTestPlan(product,{...readyDecision,landedCostConfirmed:false}).ok,false);
  assert.equal(buildTestPlan(product,{...readyDecision,quantity:31}).ok,false);
  const x=buildTestPlan(product,readyDecision,{authorizedAt:'2026-08-24T05:00:00Z'});
  assert.equal(x.ok,true);assert.equal(x.record.status,'PLANNED');assert.equal(x.record.plannedQuantity,24);
});

test('real test cannot start without explicit real order reference and confirmation',()=>{
  const plan=buildTestPlan(product,readyDecision,{authorizedAt:'2026-08-24T05:00:00Z'}).record;
  assert.equal(startRealTest(plan,{orderReference:'',confirmedRealOrder:true}).ok,false);
  assert.equal(startRealTest(plan,{orderReference:'PO-123',confirmedRealOrder:false}).ok,false);
  const x=startRealTest(plan,{orderReference:'PO-123',confirmedRealOrder:true,startedAt:'2026-08-24T06:00:00Z'});
  assert.equal(x.ok,true);assert.equal(x.record.status,'RUNNING');
});

test('blank measured costs never become verified zero',()=>{
  const plan=buildTestPlan(product,readyDecision,{authorizedAt:'2026-08-24T05:00:00Z'}).record;
  const running=startRealTest(plan,{orderReference:'PO-123',confirmedRealOrder:true,startedAt:'2026-08-24T06:00:00Z'}).record;
  const x=measureRealTest(running,{unitsReceived:'24',unitsSold:'15',revenueRon:'600',adSpendRon:'',marketplaceFeesRon:'0',fulfillmentCostRon:'0',returnsCount:'0',returnsCostRon:'0',otherCostsRon:'0',measuredAt:'2026-09-24T06:00'});
  assert.equal(x.ok,false);assert.match(x.blockers.join(' '),/adSpendRon/);
});

test('explicit zeros are accepted and a passing test never auto-creates BUY',()=>{
  const plan=buildTestPlan(product,readyDecision,{authorizedAt:'2026-08-24T05:00:00Z'}).record;
  const running=startRealTest(plan,{orderReference:'PO-123',confirmedRealOrder:true,startedAt:'2026-08-24T06:00:00Z'}).record;
  const x=measureRealTest(running,{unitsReceived:'24',unitsSold:'20',revenueRon:'798',adSpendRon:'80',marketplaceFeesRon:'80',fulfillmentCostRon:'40',returnsCount:'1',returnsCostRon:'20',otherCostsRon:'0',measuredAt:'2026-09-24T06:00'});
  assert.equal(x.ok,true);assert.equal(x.record.status,'MEASURED');assert.equal(x.outcome.status,'TEST_PASS_CANDIDATE');assert.equal(x.outcome.automaticBuy,false);assert.match(x.outcome.policy,/never creates BUY automatically/);
});

test('test execution table is workspace scoped with RLS and truth constraints',async()=>{
  const sql=await fs.readFile(new URL('../supabase/migrations/20260824_test_execution_protocol.sql',import.meta.url),'utf8');
  assert.match(sql,/test_execution_records/);assert.match(sql,/enable row level security/);assert.match(sql,/is_workspace_member\(workspace_id\)/);assert.match(sql,/planned_quantity between 20 and 30/);assert.match(sql,/status <> 'MEASURED'/);
});

test('Netlify build ships Test Execution Protocol assets',async()=>{
  const build=await fs.readFile(new URL('../scripts/build-site.mjs',import.meta.url),'utf8');
  for(const f of ['test-execution.html','test-execution.js','test-execution-engine.js','test-execution-client.js'])assert.match(build,new RegExp(f.replaceAll('.','\\.')));
});

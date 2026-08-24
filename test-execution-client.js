import {getSupabaseClient,getCurrentSession} from './supabase-client.js';
import {ensurePersonalWorkspace} from './workspace-client.js';

async function context(){
  const client=await getSupabaseClient();
  const session=await getCurrentSession();
  if(!client||!session)throw new Error('Autentificare necesară.');
  const workspace=await ensurePersonalWorkspace('My Radar');
  return{client,workspace};
}

export async function listTestExecutions(){
  const {client,workspace}=await context();
  const {data,error}=await client.from('test_execution_records').select('payload').eq('workspace_id',workspace.id).order('created_at',{ascending:false});
  if(error)throw error;
  return(data||[]).map(x=>x.payload).filter(Boolean);
}

export async function saveTestExecution(record){
  const {client,workspace}=await context();
  const row={
    workspace_id:workspace.id,
    run_key:record.runKey,
    product_key:record.productKey,
    product_name:record.productName,
    status:record.status,
    authorized_at:record.authorizedAt,
    decision_snapshot:record.decisionSnapshot||{},
    planned_quantity:record.plannedQuantity,
    landed_per_unit:record.landedPerUnit,
    target_sale_price:record.targetSalePrice,
    max_test_budget:record.maxTestBudget,
    order_reference:record.orderReference||null,
    started_at:record.startedAt||null,
    measured_at:record.measuredAt||null,
    units_received:record.unitsReceived,
    units_sold:record.unitsSold,
    revenue_ron:record.revenueRon,
    ad_spend_ron:record.adSpendRon,
    marketplace_fees_ron:record.marketplaceFeesRon,
    fulfillment_cost_ron:record.fulfillmentCostRon,
    returns_count:record.returnsCount,
    returns_cost_ron:record.returnsCostRon,
    other_costs_ron:record.otherCostsRon,
    payload:record,
    updated_at:record.updatedAt||new Date().toISOString()
  };
  const {error}=await client.from('test_execution_records').upsert(row,{onConflict:'workspace_id,run_key'});
  if(error)throw error;
  return record;
}

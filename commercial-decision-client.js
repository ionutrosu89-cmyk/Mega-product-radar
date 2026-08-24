import {installCloudAutosync} from './cloud-sync.js';
import {getSupabaseClient,getCurrentSession} from './supabase-client.js';
import {ensurePersonalWorkspace} from './workspace-client.js';
import {evaluateCommercialDecision} from './commercial-decision-engine.js';

const KEYS={supplierRecords:'megaRadarSupplierRecordsV1',supplierOffers:'megaRadarSupplierMatrixV6',landedCosts:'megaRadarLandedCostRecordsV1',observations:'megaRadarCommercialObservationsV1'};
const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'');return v??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};

async function hydrateCommercialObservations(){
  try{
    const session=await getCurrentSession();
    if(!session)return read(KEYS.observations,[]);
    const client=await getSupabaseClient();
    if(!client)return read(KEYS.observations,[]);
    const workspace=await ensurePersonalWorkspace('My Radar');
    const {data,error}=await client.from('commercial_observations').select('product_name,kind,verified,source_url,payload,updated_at').eq('workspace_id',workspace.id).order('updated_at',{ascending:true});
    if(error)throw error;
    const rows=(data||[]).map(x=>({productName:x.product_name,kind:x.kind,verified:x.verified,sourceUrl:x.source_url||'',payload:x.payload||{},updatedAt:x.updated_at}));
    write(KEYS.observations,rows);
    return rows;
  }catch(e){console.warn('Commercial decision private hydrate',e?.message||e);return read(KEYS.observations,[]);}
}

async function hydrateTestExecutions(){
  try{
    const session=await getCurrentSession();if(!session)return[];
    const client=await getSupabaseClient();if(!client)return[];
    const workspace=await ensurePersonalWorkspace('My Radar');
    const {data,error}=await client.from('test_execution_records').select('product_name,status,measured_at,units_received,units_sold,revenue_ron,returns_count,outcome,payload,updated_at').eq('workspace_id',workspace.id).eq('status','MEASURED').order('measured_at',{ascending:true});
    if(error)throw error;
    return (data||[]).map(x=>({...(x.payload||{}),productName:x.product_name,status:x.status,measuredAt:x.measured_at,unitsReceived:x.units_received,unitsSold:x.units_sold,revenueRon:x.revenue_ron,returnsCount:x.returns_count,outcome:x.outcome||x.payload?.outcome||null,updatedAt:x.updated_at}));
  }catch(e){console.warn('Commercial decision test hydrate',e?.message||e);return[];}
}

export async function loadPrivateCommercialState(){
  try{await installCloudAutosync({hydrate:true,reloadOnHydrate:false});}catch(e){console.warn('Commercial decision cloud hydrate',e?.message||e);}
  const [observations,testExecutions]=await Promise.all([hydrateCommercialObservations(),hydrateTestExecutions()]);
  return {supplierRecords:read(KEYS.supplierRecords,{}),supplierOffers:read(KEYS.supplierOffers,[]),landedCosts:read(KEYS.landedCosts,{}),observations,testExecutions};
}

export async function applyPrivateCommercialDecisions(products=[]){
  const state=await loadPrivateCommercialState();
  return (Array.isArray(products)?products:[]).map(p=>({...p,testBuyDecision:evaluateCommercialDecision(p,state)}));
}

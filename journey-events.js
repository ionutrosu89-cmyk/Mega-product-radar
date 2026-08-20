import {getSupabaseClient,getCurrentSession} from './supabase-client.js';
import {ensurePersonalWorkspace} from './workspace-client.js';
import {resolveCommercialAccess} from './commercial-access.js';

export async function trackJourneyEvent(eventName,metadata={}){
  try{
    const session=await getCurrentSession();
    if(!session)return false;
    const client=await getSupabaseClient();
    const ws=await ensurePersonalWorkspace('My Radar');
    const access=await resolveCommercialAccess();
    const row={workspace_id:ws.id,user_id:session.user.id,event_name:String(eventName||'UNKNOWN').slice(0,80),plan:access.plan.code,page:location.pathname.split('/').pop()||'/',metadata:metadata&&typeof metadata==='object'?metadata:{}};
    const {error}=await client.from('journey_events').insert(row);
    if(error)throw error;
    return true;
  }catch(error){console.warn('Journey event not recorded',error?.message||error);return false;}
}

export function installJourneyLinkTracking(root=document){
  root.addEventListener('click',event=>{
    const el=event.target.closest?.('[data-journey-event]');
    if(!el)return;
    trackJourneyEvent(el.dataset.journeyEvent,{target:el.getAttribute('href')||'',label:(el.textContent||'').trim().slice(0,120)});
  });
}

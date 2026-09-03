const EVENT_ENDPOINT='/api/free/demand-event';
const fallbackUuid=()=> 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,char=>{const value=Math.random()*16|0;return (char==='x'?value:(value&3|8)).toString(16);});
const PAGE_SESSION_ID=globalThis.crypto?.randomUUID?.()||fallbackUuid();
const clean=(value,max=120)=>String(value??'').trim().slice(0,max)||null;

function acquisitionContext(){
  const params=new URLSearchParams(location.search);
  let referrerHost=null;
  try{referrerHost=document.referrer?new URL(document.referrer).hostname:null;}catch{/* Invalid referrer is ignored. */}
  if(referrerHost===location.hostname)referrerHost=null;
  return {
    acquisitionSource:clean(params.get('utm_source'),80),
    acquisitionMedium:clean(params.get('utm_medium'),80),
    acquisitionCampaign:clean(params.get('utm_campaign'),120),
    referrerHost:clean(referrerHost,160)
  };
}

export async function trackFreeDemand(eventName,metadata={}){
  try{
    const payload={
      eventName:clean(eventName,80),
      page:clean(location.pathname.split('/').pop()||'/',80),
      pageSessionId:PAGE_SESSION_ID,
      nicheId:clean(metadata?.nicheId,80),
      ...acquisitionContext(),
      metadata
    };
    const response=await fetch(EVENT_ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),keepalive:true,credentials:'omit'});
    return response.ok;
  }catch{return false;}
}

export function installFreeDemandTracking(root=document){
  root.addEventListener('click',event=>{
    const target=event.target.closest?.('[data-free-event]');
    if(!target)return;
    trackFreeDemand(target.dataset.freeEvent,{
      nicheId:target.dataset.nicheId||null,
      target:target.getAttribute('href')||null,
      label:(target.textContent||'').trim().slice(0,120)
    });
  });
}

export {PAGE_SESSION_ID};

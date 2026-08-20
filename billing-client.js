import {getCurrentSession} from './supabase-client.js';

export async function startSubscriptionCheckout(plan){
  const code=String(plan||'').toUpperCase();
  if(!['DISCOVER','RADAR','LAUNCH'].includes(code))throw new Error('Plan de abonament invalid.');
  const session=await getCurrentSession();
  if(!session?.access_token){location.href=`login.html?next=${encodeURIComponent('pricing.html?plan='+code)}`;return null;}
  const response=await fetch('/api/billing/checkout',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${session.access_token}`},body:JSON.stringify({plan:code})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data?.url)throw new Error(data?.error||'Checkout indisponibil momentan.');
  location.href=data.url;
  return data;
}

export function paidBillingEnabled(env=process.env){
  return String(env.MPR_PAID_BILLING_ENABLED||'').trim().toLowerCase()==='true';
}

export function paidProviderCallsEnabled(env=process.env){
  return String(env.MPR_PAID_PROVIDER_CALLS_ENABLED||'').trim().toLowerCase()==='true';
}

export function freeBetaBillingResponse(){
  return Response.json({
    ok:false,
    code:'FREE_BETA_ONLY',
    freeBetaOnly:true,
    error:'Beta gratuită: plățile și schimbările de plan sunt dezactivate.'
  },{status:403,headers:{'Cache-Control':'private, no-store'}});
}

export function freeBetaProviderResponse(){
  return Response.json({
    ok:false,
    code:'FREE_BETA_PROVIDER_CALLS_DISABLED',
    freeBetaOnly:true,
    error:'Beta gratuită: apelurile către furnizori de date sau AI cu potențial de cost sunt dezactivate.'
  },{status:403,headers:{'Cache-Control':'private, no-store'}});
}

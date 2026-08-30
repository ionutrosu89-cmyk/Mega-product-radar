export function deriveDeploymentReadiness(data={}){
  const configured=Boolean(data.checks?.allConfigured);
  const prices=Boolean(data.checks?.allPricesValid&&data.checks?.amountsMatch);
  const technicalReady=Boolean(data.ready);
  const stripeMode=String(data.stripeMode||'UNCONFIGURED').toUpperCase();
  const sandboxReady=technicalReady&&stripeMode==='SANDBOX';
  const liveBillingReady=Boolean(data.publicLaunchBillingReady)&&stripeMode==='LIVE';

  let status='Există blocaje tehnice. Rezolvă elementele marcate înainte de orice test de billing.';
  if(sandboxReady){
    status='SANDBOX GO: configurația tehnică este pregătită pentru testul Stripe end-to-end. Plățile reale rămân NO-GO.';
  }else if(liveBillingReady){
    status='LIVE BILLING GO: Stripe/Supabase sunt configurate pentru bani reali. Acesta este doar gate-ul tehnic; P0 juridic și acceptanța end-to-end rămân obligatorii.';
  }else if(technicalReady){
    status=`Configurația tehnică este validă, dar modul Stripe ${stripeMode} nu autorizează un verdict de billing live.`;
  }

  return {
    configured,
    prices,
    technicalReady,
    stripeMode,
    sandboxReady,
    liveBillingReady,
    technicalLabel:technicalReady?'READY':'BLOCKED',
    modeLabel:stripeMode,
    sandboxLabel:sandboxReady?'GO':'NO-GO',
    liveBillingLabel:liveBillingReady?'GO':'NO-GO',
    status
  };
}

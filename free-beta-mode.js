export const FREE_BETA_MODE=Object.freeze({
  enabled:true,
  label:'Beta gratuită de validare',
  paidBillingEnabled:false,
  purpose:'Măsurăm utilizarea și intenția de plată înainte de orice investiție în date sau activarea checkout-ului.',
  paidPlanMessage:'Plățile sunt oprite. Interesul tău este înregistrat pentru validarea produsului; nu se creează un abonament.'
});

export function paidPlanInterestEvent(plan=''){
  const code=String(plan||'').trim().toUpperCase();
  return ['DISCOVER','RADAR','LAUNCH'].includes(code)?`UPGRADE_INTENT_${code}`:'UPGRADE_INTENT_UNKNOWN';
}

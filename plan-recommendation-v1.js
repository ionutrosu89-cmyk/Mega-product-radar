export const MPR_PLAN_ORDER=Object.freeze(['FREE','DISCOVER','RADAR','LAUNCH']);

export function recommendMprPlan({decisionNeed='EXPLORE',chinaAgent='NO'}={}){
  const need=String(decisionNeed||'EXPLORE').toUpperCase();
  const agent=String(chinaAgent||'NO').toUpperCase();
  if(agent==='YES'||need==='EXECUTE')return {
    code:'LAUNCH',price:'€89/lună',title:'Launch',
    reasons:[
      'Vrei să transformi oportunitatea într-un test și apoi într-o lansare disciplinată.',
      'Ai nevoie de traseul de execuție, Academy România și ecosistemul de parteneri.',
      'Launch include acces/introducere la un agent China testat/verificat de noi; serviciile agentului se contractează separat.'
    ]
  };
  if(need==='TRENDS')return {
    code:'RADAR',price:'€29/lună',title:'Radar',
    reasons:[
      'Vrei să vezi produse Rising/New, accelerare și semnale care apar înainte să fie evidente.',
      'Ai nevoie de Romania Gap, Opportunity Score, watchlist și alerte de oportunitate.'
    ]
  };
  if(need==='VALIDATE')return {
    code:'DISCOVER',price:'€17,90/lună',title:'Discover',
    reasons:[
      'Vrei să verifici de unde poți cumpăra și dacă economia produsului poate funcționa.',
      'Ai nevoie de Supplier Intelligence, MOQ, landed cost, profit, marjă, ROI și break-even.'
    ]
  };
  return {
    code:'FREE',price:'€0',title:'Free',
    reasons:[
      'Vrei să explorezi produse, categorii și nișe înainte de analiză comercială mai profundă.',
      'Poți începe gratuit și face upgrade numai când apare o nevoie reală.'
    ]
  };
}

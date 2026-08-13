const text=p=>`${p?.name||''} ${p?.cat||p?.category||''} ${p?.notes||''}`.toLowerCase();
export function importRiskGate(p={}){
  const t=text(p),flags=[];
  if(/kids|copii|baby|bebel|toy|juc[aă]rie|3.?6/.test(t))flags.push('KIDS');
  if(/battery|bater|recharge|acumulator|lithium/.test(t))flags.push('BATTERY');
  if(/medical|ortho|ortez|therapy|terapie|pain relief|durere/.test(t))flags.push('MEDICAL_CLAIM');
  if(/cosmetic|serum|cream|crem[aă]|skin|beauty liquid/.test(t))flags.push('COSMETIC');
  if(/food contact|silicone liner|air fryer|kitchen utensil|contact alimentar/.test(t))flags.push('FOOD_CONTACT');
  if(/wireless|bluetooth|wifi|radio|gps|tracker/.test(t))flags.push('RADIO');
  const severe=flags.some(x=>['MEDICAL_CLAIM','COSMETIC'].includes(x));
  const controlled=flags.some(x=>['KIDS','BATTERY','FOOD_CONTACT','RADIO'].includes(x));
  const kidsPass=!flags.includes('KIDS')||String(p.kidsGate||'').toUpperCase()==='PASS';
  let level='LOW',decision='PASS';
  if(severe){level='HIGH';decision='MANUAL REVIEW';}
  else if(controlled){level='MEDIUM';decision='DOCUMENT CHECK';}
  if(flags.includes('KIDS')&&!kidsPass){level='HIGH';decision='BLOCK';}
  return{version:'2.0',level,decision,flags,kidsPass,note:'Risk gate is a category/documentation screen, not legal certification. Required conformity and importer obligations must be verified before purchase.'};
}

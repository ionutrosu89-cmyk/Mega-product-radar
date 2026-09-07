const clean=value=>String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9+]+/g,' ').replace(/\s+/g,' ');
const words=value=>` ${clean(value)} `;
const hasPhrase=(text,phrase)=>text.includes(` ${phrase} `);
const hasAny=(text,phrases)=>phrases.find(phrase=>hasPhrase(text,phrase))||null;

const BLOCKED=Object.freeze({
  FIREARMS:['firearm','firearms','rifle','pistol','handgun','ammunition','ammo','silencer','suppressor'],
  EXPLOSIVES:['firework','fireworks','dynamite','grenade','explosive'],
  RESTRICTED_WEAPONS:['switchblade','taser','brass knuckles','pepper spray','mace spray'],
  NICOTINE:['vape','vapes','cigarette','cigarettes','nicotine'],
  DRUGS:['cbd','thc','cannabis','marijuana','magic mushrooms'],
  ALCOHOL:['vodka','whiskey','whisky','beer','wine','liquor'],
  ADULT:['sex toy','vibrator','dildo','sex doll'],
  HIGH_RISK_SUPPLEMENTS:['steroid','steroids','dnp diet pills']
});
const REVIEW=Object.freeze({
  BLADED_TOOL:['utility knife','knife','knives','blade','blades'],
  SELF_DEFENSE:['self defense','self defence'],
  MEDICAL_OR_WEIGHT_LOSS:['diet pill','diet pills','laxative','laxatives']
});

export function classifyPublicCategoryRisk(product={}){
  const text=words(`${product.name||product.title||''} ${product.category||''} ${product.description||''}`);
  for(const [riskClass,phrases] of Object.entries(BLOCKED)){
    const matchedTerm=hasAny(text,phrases);
    if(matchedTerm)return {riskClass,decision:'BLOCK',commercialEligible:false,matchedTerm,reason:'Categorie blocată pentru promovare comercială publică.'};
  }
  for(const [riskClass,phrases] of Object.entries(REVIEW)){
    const matchedTerm=hasAny(text,phrases);
    if(matchedTerm)return {riskClass,decision:'MANUAL_REVIEW',commercialEligible:false,matchedTerm,reason:'Categorie cu risc care necesită verificare manuală înainte de promovare comercială.'};
  }
  return {riskClass:'STANDARD',decision:'ALLOW',commercialEligible:true,matchedTerm:null,reason:'Nu a fost identificată o categorie reglementată în clasificatorul public.'};
}

export function publicCategoryCommerciallyEligible(product={}){
  return classifyPublicCategoryRisk(product).commercialEligible;
}

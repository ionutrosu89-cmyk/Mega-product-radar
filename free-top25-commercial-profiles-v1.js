const phraseList=value=>Object.freeze(value.map(item=>String(item).toLowerCase()));
const profile=(include,exclude=[])=>Object.freeze({include:phraseList(include),exclude:phraseList(exclude)});

// Semantic profiles for the licensed historical Free catalog. These profiles do not
// claim live demand or sales. They are only a deterministic relevance gate used when
// replacing archive positions that are held by brand/category policy.
export const FREE_TOP25_COMMERCIAL_PROFILES=Object.freeze({
  CASA:profile(['organizer','storage','drawer','closet','shelf','rack','basket','bin','holder','hooks','space saver'],['toy','kids','baby','pet','dog','cat','litter']),
  AUTO:profile(['car organizer','vehicle organizer','car seat','trunk organizer','visor','cup holder','dashboard','headrest','car storage','automotive'],['motorcycle','engine oil','filter fluid']),
  ELECTRONICE:profile(['usb hub','usb cable','laptop stand','laptop holder','cable organizer','cable management','charger stand','charging station','adapter','mouse pad','keyboard tray','webcam cover'],['printer','ink','toner','battery pack']),
  BEAUTY:profile(['makeup brush','makeup organizer','cosmetic organizer','cosmetic bag','toiletry bag','hair brush','hair accessory','nail tool','vanity mirror','beauty organizer'],['oil','shampoo','conditioner','serum','cream','lotion','fragrance','perfume','supplement']),
  PET:profile(['pet bed','pet bowl','pet feeder','pet mat','pet grooming','pet brush','pet carrier','pet toy','water fountain','food storage'],['replacement filter','medicine','supplement']),
  SPORT:profile(['sports bag','ball holder','ball pump','training cones','sports organizer','racket accessory','sports bottle holder','medal display','equipment bag'],['supplement','protein','apparel','shoe']),
  COPII:profile(['kids organizer','toy organizer','stroller organizer','kids travel','lunch bag','activity tray','car seat organizer','kids storage'],['licensed character','electronic game']),
  BIROU:profile(['desk organizer','mouse pad','monitor stand','laptop stand','document holder','file organizer','desk mat','cable management','keyboard tray','pen holder'],['printer','ink','toner']),
  ORGANIZARE_CASA:profile(['storage bin','storage basket','drawer organizer','closet organizer','shelf organizer','under bed storage','hanging organizer','shoe organizer','cabinet organizer','space saver'],['toy','kids','baby','pet','dog','cat']),
  CURATENIE:profile(['cleaning brush','scrubber','squeegee','duster','microfiber','lint roller','mop accessory','cleaning tool','dustpan','broom holder'],['cleaner liquid','detergent','spray bottle chemical','utility knife','blade']),
  TELEFON_TECH:profile(['phone holder','phone stand','tablet stand','usb c cable','charging cable','cable organizer','charging stand','phone mount','tech organizer','cable clips'],['phone case branded','battery cell']),
  FITNESS_ACASA:profile(['resistance band','exercise band','foam roller','massage ball','muscle roller','yoga block','exercise slider','jump rope','ankle strap','grip trainer','stretching strap','massage cane'],['oil','diffuser','candle','supplement','edible','cupping','fitbit','fragrance']),
  GRADINA_BALCON:profile(['plant support','plant clips','plant tie','watering','hose nozzle','garden organizer','garden tool','planter','pot hanger','seedling tray','gardening gloves'],['pesticide','herbicide','fertilizer chemical','knife','blade']),
  DIY_SCULE:profile(['tool organizer','tool holder','pegboard','magnetic tool holder','drill accessory','workbench organizer','screw organizer','hardware organizer','tool storage','wall mount tool'],['knife','blade','saw blade']),
  BABY_ACCESORII:profile(['stroller organizer','diaper caddy','burp cloth','bib','changing pad','bottle organizer','baby travel','nursery organizer','pacifier holder','diaper organizer'],['formula','medicine','cream','lotion']),
  AUTO_ACCESORII:profile(['car organizer','trunk organizer','seat organizer','visor organizer','cup holder','headrest hook','car trash','car storage','car mount','vehicle accessory'],['engine oil','fluid','filter']),
  HOBBY_CRAFT:profile(['craft organizer','art organizer','paint brush','bead organizer','puzzle mat','craft storage','painting accessory','sewing organizer','yarn organizer','scrapbook storage'],['knife','blade','solvent']),
  PARTY:profile(['party decoration','party banner','cake topper','balloon accessory','party bag','table decoration','party organizer','serving accessory','birthday decoration','photo booth prop'],['firework','alcohol']),
  BIROU_ORGANIZARE:profile(['desk organizer','file holder','document organizer','pen holder','cable organizer','monitor stand','laptop stand','drawer organizer','office storage','desk shelf'],['printer','ink','toner']),
  FASHION_ORGANIZARE:profile(['garment bag','jewelry organizer','shoe organizer','hanger','wardrobe organizer','closet organizer','hat organizer','accessory organizer','clothes storage','handbag organizer'],['apparel','shirt','dress clothing','shoe footwear']),
  CAINI_ACCESORII:profile(['dog toy','dog leash','dog harness','dog bowl','dog mat','dog waste bag','dog grooming','dog brush','dog travel','dog carrier'],['medicine','supplement','food bag']),
  PISICI_ACCESORII:profile(['cat toy','cat litter','litter mat','litter scoop','cat scratcher','cat carrier','cat bowl','cat feeder','cat grooming','cat brush','cat tunnel'],['medicine','supplement','cat food']),
  LAUNDRY:profile(['laundry hamper','laundry basket','laundry bag','mesh laundry','drying rack','clothes pin','clothespin','lint remover','ironing accessory','clothes organizer'],['detergent','softener','bleach']),
  COPII_EDUCATIONAL:profile(['learning toy','educational toy','alphabet','counting','matching game','sorting toy','montessori','learning puzzle','activity set','flash cards','fine motor','learning activity'],['tablet','electronic game']),
  CALATORII:profile(['packing cube','luggage tag','luggage strap','travel pillow','toiletry bag','passport holder','travel organizer','packing organizer','travel wallet','luggage organizer'],['suitcase branded','liquid'])
});

const normalize=value=>String(value??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const contains=(text,phrase)=>` ${text} `.includes(` ${normalize(phrase)} `);

export function classifyFreeTop25SemanticFit(nicheId,product={}){
  const rules=FREE_TOP25_COMMERCIAL_PROFILES[String(nicheId||'').toUpperCase()];
  if(!rules)return {fit:false,reason:'UNKNOWN_NICHE',matchedInclude:null,matchedExclude:null};
  const text=normalize(`${product.title||product.name||''} ${product.category||''}`);
  const matchedExclude=rules.exclude.find(term=>contains(text,term))||null;
  if(matchedExclude)return {fit:false,reason:'EXCLUDED_TERM',matchedInclude:null,matchedExclude};
  const matchedInclude=rules.include.find(term=>contains(text,term))||null;
  return matchedInclude?{fit:true,reason:'SEMANTIC_MATCH',matchedInclude,matchedExclude:null}:{fit:false,reason:'NO_INCLUDE_MATCH',matchedInclude:null,matchedExclude:null};
}

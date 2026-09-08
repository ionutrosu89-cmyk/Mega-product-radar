const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const list=(...values)=>Object.freeze(values.flat().map(fold).filter(Boolean));

const DOMAIN=Object.freeze({
  HOME:list('home garden','home organization','household','haus garten','aufbewahrung','wohnen'),
  AUTO:list('ebay motors','automotive','parts accessories','car truck','auto motorrad','autoteile','fahrzeugteile','auto zubehor'),
  ELECTRONICS:list('consumer electronics','computers tablets','cell phones','electronics','elektronik','handy','computer'),
  BEAUTY:list('health beauty','beauty','korperpflege','gesundheit'),
  PET:list('pet supplies','pets','tierbedarf','haustier'),
  SPORT:list('sporting goods','fitness','sport'),
  TOYS:list('toys hobbies','toys','spielzeug'),
  OFFICE:list('business industrial','office','buromaterial','buro'),
  GARDEN:list('garden patio','garden outdoor','garten'),
  TOOLS:list('tools workshop equipment','tools','werkzeuge','werkstatt'),
  BABY:list('baby','baby essentials','babyartikel'),
  CRAFT:list('crafts','art supplies','basteln','handarbeit'),
  PARTY:list('party supplies','party','festartikel'),
  FASHION:list('clothing shoes accessories','fashion','kleidung','mode'),
  LAUNDRY:list('laundry','household supplies','wasche','waschepflege'),
  TRAVEL:list('travel','luggage','travel accessories','reisen','gepack','koffer')
});

const NICHE_DOMAINS=Object.freeze({
  CASA:['HOME'],AUTO:['AUTO'],ELECTRONICE:['ELECTRONICS'],BEAUTY:['BEAUTY'],PET:['PET'],SPORT:['SPORT'],COPII:['TOYS','BABY'],BIROU:['OFFICE'],ORGANIZARE_CASA:['HOME'],CURATENIE:['HOME'],TELEFON_TECH:['ELECTRONICS'],FITNESS_ACASA:['SPORT'],GRADINA_BALCON:['GARDEN','HOME'],DIY_SCULE:['TOOLS'],BABY_ACCESORII:['BABY'],AUTO_ACCESORII:['AUTO'],HOBBY_CRAFT:['CRAFT'],PARTY:['PARTY'],BIROU_ORGANIZARE:['OFFICE'],FASHION_ORGANIZARE:['FASHION','HOME'],CAINI_ACCESORII:['PET'],PISICI_ACCESORII:['PET'],LAUNDRY:['LAUNDRY','HOME'],COPII_EDUCATIONAL:['TOYS'],CALATORII:['TRAVEL']
});

const HARD_REJECT=Object.freeze({
  AUTO:list('toys hobbies','spielzeug','model vehicle','modellbau'),
  AUTO_ACCESORII:list('toys hobbies','spielzeug','model vehicle','modellbau'),
  CALATORII:list('food beverages','grocery','lebensmittel','nahrungsmittel','reis getreide','rice'),
  FITNESS_ACASA:list('essential oils','dufte aromen','candles','kerzen','supplements','nahrungserganzung'),
  BEAUTY:list('auto motorrad','pet supplies','tierbedarf'),
  PET:list('toys hobbies','spielzeug fur kinder'),
  CAINI_ACCESORII:list('toys hobbies','spielzeug fur kinder'),
  PISICI_ACCESORII:list('toys hobbies','spielzeug fur kinder')
});

const pathText=candidate=>fold([...(candidate?.path||[]).map(item=>item?.categoryName),candidate?.categoryName].join(' > '));
const includesPhrase=(text,phrase)=>text.includes(phrase);

export function classifyEbayTaxonomyPath(nicheId,candidate={}){
  const niche=String(nicheId||'').trim().toUpperCase();
  const text=pathText(candidate);
  if(!text)return {accepted:false,decision:'PATH_MISSING',matchedDomain:null,matchedPhrase:null,rejectedPhrase:null};
  const rejected=(HARD_REJECT[niche]||[]).find(phrase=>includesPhrase(text,phrase))||null;
  if(rejected)return {accepted:false,decision:'PATH_DOMAIN_MISMATCH',matchedDomain:null,matchedPhrase:null,rejectedPhrase:rejected};
  const domainKeys=NICHE_DOMAINS[niche]||[];
  for(const domain of domainKeys){
    const phrase=(DOMAIN[domain]||[]).find(value=>includesPhrase(text,value));
    if(phrase)return {accepted:true,decision:'PATH_DOMAIN_MATCH',matchedDomain:domain,matchedPhrase:phrase,rejectedPhrase:null};
  }
  return {accepted:false,decision:'PATH_DOMAIN_UNCONFIRMED',matchedDomain:null,matchedPhrase:null,rejectedPhrase:null};
}

export const EBAY_TAXONOMY_PATH_POLICY=Object.freeze({version:'EBAY_TAXONOMY_PATH_POLICY_V1',autoActivation:false,nicheCount:Object.keys(NICHE_DOMAINS).length});

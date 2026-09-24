import {FREE_TOP25_EXPANDED_REGISTRY} from './free-top25-expanded-registry.js';

const QUERY_SETS=Object.freeze({
  CASA:{en:['kitchen gadgets','home storage','bathroom accessories','home improvement gadgets','space saving home','household accessories'],ro:['accesorii bucătărie','organizare casă','accesorii baie','produse pentru casă','economisire spațiu','accesorii menaj']},
  AUTO:{en:['car care tools','car safety accessories','vehicle organizers','car cleaning tools','automotive gadgets','car maintenance accessories'],ro:['întreținere auto','siguranță auto','organizatoare auto','curățare auto','gadgeturi auto','accesorii întreținere mașină']},
  ELECTRONICE:{en:['consumer electronics accessories','smart home gadgets','portable electronics','computer accessories','wireless accessories','electronic organizers'],ro:['accesorii electronice','gadgeturi smart home','electronice portabile','accesorii calculator','accesorii wireless','organizare cabluri']},
  BEAUTY:{en:['beauty tools','skin care tools','hair care accessories','makeup organizers','personal care devices','nail care tools'],ro:['instrumente beauty','accesorii îngrijire ten','accesorii păr','organizatoare machiaj','aparate îngrijire personală','instrumente manichiură']},
  PET:{en:['pet accessories','pet grooming tools','pet travel accessories','pet feeding accessories','pet enrichment toys','pet cleaning products'],ro:['accesorii animale','îngrijire animale','transport animale','accesorii hrănire animale','jucării animale','curățenie animale']},
  SPORT:{en:['sports accessories','outdoor fitness gear','recovery tools','training accessories','hydration gear','sports organizers'],ro:['accesorii sport','echipament fitness exterior','recuperare sportivă','accesorii antrenament','hidratare sport','organizare echipament sport']},
  COPII:{en:['kids accessories','children travel accessories','kids room organization','creative toys','child safety accessories','kids daily essentials'],ro:['accesorii copii','călătorii cu copii','organizare cameră copii','jucării creative','siguranță copii','produse uzuale copii']},
  BIROU:{en:['office accessories','desk organization','ergonomic office accessories','cable management','home office gadgets','document organization'],ro:['accesorii birou','organizare birou','ergonomie birou','organizare cabluri','gadgeturi home office','organizare documente']},
  ORGANIZARE_CASA:{en:['drawer organizer','under sink organizer','closet storage','cabinet organizer','space saving storage','home organization bins'],ro:['organizator sertare','organizator sub chiuvetă','depozitare dulap','organizator cabinet','depozitare economie spațiu','cutii organizare casă']},
  CURATENIE:{en:['cleaning tools','reusable cleaning products','deep cleaning brushes','window cleaning tools','kitchen cleaning accessories','bathroom cleaning tools'],ro:['instrumente curățenie','produse reutilizabile curățenie','perii curățare','curățare geamuri','accesorii curățenie bucătărie','curățenie baie']},
  TELEFON_TECH:{en:['phone accessories','mobile charging accessories','phone stands','phone camera accessories','mobile travel accessories','phone cable organizers'],ro:['accesorii telefon','încărcare telefon','suport telefon','accesorii cameră telefon','accesorii telefon călătorie','organizare cabluri telefon']},
  FITNESS_ACASA:{en:['home fitness equipment','resistance training accessories','yoga accessories','home workout tools','mobility recovery tools','compact fitness equipment'],ro:['echipament fitness acasă','accesorii benzi elastice','accesorii yoga','instrumente antrenament acasă','recuperare mobilitate','echipament fitness compact']},
  GRADINA_BALCON:{en:['balcony gardening','garden tools','plant care accessories','outdoor planters','watering accessories','small garden storage'],ro:['grădină balcon','unelte grădină','îngrijire plante','ghivece exterior','accesorii udare','depozitare grădină']},
  DIY_SCULE:{en:['hand tool accessories','power tool organizers','workshop storage','measuring tools','home repair tools','hardware organizers'],ro:['accesorii scule','organizare scule electrice','depozitare atelier','instrumente măsurare','scule reparații casă','organizatoare feronerie']},
  BABY_ACCESORII:{en:['baby accessories','baby feeding accessories','baby travel accessories','nursery organization','baby safety products','baby care tools'],ro:['accesorii bebeluși','hrănire bebeluși','călătorii cu bebeluși','organizare camera bebelușului','siguranță bebeluși','îngrijire bebeluși']},
  AUTO_ACCESORII:{en:['car phone accessories','car interior organizers','car trunk organizers','car comfort accessories','car emergency accessories','vehicle travel accessories'],ro:['accesorii telefon auto','organizatoare interior auto','organizator portbagaj','confort auto','accesorii urgență auto','accesorii călătorie auto']},
  HOBBY_CRAFT:{en:['craft tools','art supplies organizers','diy craft accessories','sewing accessories','painting tools','model making tools'],ro:['instrumente hobby','organizare materiale artă','accesorii lucru manual','accesorii cusut','instrumente pictură','instrumente modelism']},
  PARTY:{en:['party decorations','event accessories','birthday party supplies','table party decor','photo booth props','reusable party supplies'],ro:['decorațiuni petrecere','accesorii evenimente','produse aniversare','decor masă petrecere','accesorii cabină foto','produse reutilizabile petrecere']},
  BIROU_ORGANIZARE:{en:['desk organizer','file organizer','office drawer organizer','cable tray desk','monitor desk accessories','stationery organizer'],ro:['organizator birou','organizator dosare','organizator sertar birou','tavă cabluri birou','accesorii monitor birou','organizator papetărie']},
  FASHION_ORGANIZARE:{en:['clothing organizer','wardrobe storage','shoe organizer','jewelry organizer','handbag organizer','travel clothing organizer'],ro:['organizator haine','depozitare garderobă','organizator pantofi','organizator bijuterii','organizator genți','organizator haine călătorie']},
  CAINI_ACCESORII:{en:['dog accessories','dog walking accessories','dog grooming tools','dog travel accessories','dog feeding accessories','dog enrichment toys'],ro:['accesorii câini','plimbare câini','îngrijire câini','călătorie câini','hrănire câini','jucării câini']},
  PISICI_ACCESORII:{en:['cat accessories','cat grooming tools','cat travel accessories','cat feeding accessories','cat enrichment toys','cat litter accessories'],ro:['accesorii pisici','îngrijire pisici','călătorie pisici','hrănire pisici','jucării pisici','accesorii litieră']},
  LAUNDRY:{en:['laundry accessories','clothes drying accessories','laundry organizers','garment care tools','washing machine accessories','clothes folding tools'],ro:['accesorii spălătorie','uscare haine','organizare rufe','îngrijire haine','accesorii mașină de spălat','instrumente împăturire haine']},
  COPII_EDUCATIONAL:{en:['educational toys','stem toys','learning games','fine motor toys','science kits kids','creative learning tools'],ro:['jucării educative','jucării stem','jocuri de învățare','jucării motricitate fină','kituri știință copii','instrumente învățare creativă']},
  CALATORII:{en:['travel accessories','luggage organizers','packing cubes','travel comfort accessories','travel security accessories','portable travel essentials'],ro:['accesorii călătorie','organizatoare bagaje','cuburi împachetare','confort călătorie','siguranță bagaje','produse portabile călătorie']}
});

const normalize=value=>String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

export const FREE_TOP25_LIVE_TAXONOMY=Object.freeze(FREE_TOP25_EXPANDED_REGISTRY.map(niche=>Object.freeze({
  ...niche,
  queries:Object.freeze({en:Object.freeze([...QUERY_SETS[niche.id].en]),ro:Object.freeze([...QUERY_SETS[niche.id].ro])}),
  candidateTarget:100,
  publishedProductCount:25,
  marketplaceFreshnessHours:72,
  romaniaCompetitionFreshnessHours:168,
  googleDemandFreshnessDays:35,
  categoryMappings:Object.freeze({amazon:null,ebayUs:null,ebayDe:null,aliexpress:null}),
  categoryMappingStatus:'HUMAN_REVIEW_REQUIRED'
})));

export const FREE_TOP25_LIVE_TAXONOMY_BY_ID=new Map(FREE_TOP25_LIVE_TAXONOMY.map(niche=>[niche.id,niche]));

export function validateFreeTop25LiveTaxonomy(rows=FREE_TOP25_LIVE_TAXONOMY){
  const ids=new Set(),errors=[];
  for(const row of rows){
    if(ids.has(row.id))errors.push(`${row.id}:DUPLICATE_ID`); else ids.add(row.id);
    for(const language of ['en','ro']){
      const queries=Array.isArray(row?.queries?.[language])?row.queries[language]:[];
      if(queries.length<6)errors.push(`${row.id}:${language}:MINIMUM_SIX_QUERIES_REQUIRED`);
      if(new Set(queries.map(normalize)).size!==queries.length)errors.push(`${row.id}:${language}:DUPLICATE_QUERY`);
    }
    if(row.candidateTarget<75)errors.push(`${row.id}:CANDIDATE_TARGET_TOO_LOW`);
    if(row.publishedProductCount!==25)errors.push(`${row.id}:PUBLISHED_COUNT_MUST_BE_25`);
  }
  if(ids.size!==25)errors.push(`TAXONOMY_SIZE_${ids.size}`);
  return {ok:errors.length===0,errors,nicheCount:ids.size,targetPositions:ids.size*25,candidateTarget:rows.reduce((sum,row)=>sum+Number(row.candidateTarget||0),0)};
}

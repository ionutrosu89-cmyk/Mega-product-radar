const EXACT={
'Magnetic cable organizer clips set':'Set clipsuri magnetice pentru organizarea cablurilor',
'Under desk headphone hanger clamp':'Suport cu clemă pentru căști, montaj sub birou',
'Monitor memo board side panel set':'Set panouri laterale pentru notițe la monitor',
'Desk drawer organizer modular trays':'Tăvi modulare pentru organizarea sertarului de birou',
'Foldable laptop riser portable':'Suport pliabil și portabil pentru laptop',
'Bedside phone holder clamp':'Suport de telefon cu clemă pentru pat',
'Sofa arm tray organizer':'Tavă organizatoare pentru brațul canapelei',
'Bed sheet corner holder straps premium':'Set premium de benzi pentru fixarea colțurilor cearșafului',
'Mattress lifting wedge tool':'Dispozitiv tip pană pentru ridicarea saltelei',
'Reusable furniture moving sliders kit':'Set reutilizabil de glisiere pentru mutarea mobilierului',
'Rotating bathroom organizer turntable':'Organizator rotativ pentru baie',
'Shower corner shelf adhesive no drill':'Raft de colț pentru duș, autoadeziv, fără găurire',
'Toothbrush wall organizer cover':'Organizator de perete cu capac pentru periuțe de dinți',
'Hair tool heat resistant organizer':'Organizator termorezistent pentru aparate de coafat',
'Sink splash guard silicone mat':'Covoraș din silicon anti-stropire pentru chiuvetă',
'Pan lid organizer adjustable rack':'Suport reglabil pentru organizarea capacelor de oale',
'Fridge drawer pull out organizer':'Organizator tip sertar glisant pentru frigider',
'Clip on pot strainer silicone':'Strecurătoare din silicon cu prindere pe oală',
'Oil spray bottle glass free plastic':'Pulverizator pentru ulei din plastic, fără sticlă',
'Reusable food bag drying rack':'Suport reutilizabil pentru uscarea pungilor alimentare',
'Car sunglasses magnetic visor holder':'Suport magnetic pentru ochelari, montaj pe parasolar auto',
'Car headrest hidden hook premium':'Cârlig premium ascuns pentru tetiera auto',
'Car trunk side storage net':'Plasă laterală de depozitare pentru portbagaj auto',
'Car seat back foldable tray organizer':'Tavă organizatoare pliabilă pentru spătarul scaunului auto',
'Car cup holder expander adjustable':'Adaptor reglabil pentru suportul de pahare auto',
'Travel luggage cup holder sleeve':'Suport pentru pahare montat pe mânerul trolerului',
'Airplane seat pocket organizer pouch':'Organizator pentru buzunarul scaunului de avion',
'Travel cable organizer roll pouch':'Organizator rulabil pentru cabluri de călătorie',
'Luggage handle phone holder':'Suport de telefon pentru mânerul trolerului',
'Foldable travel laundry bag divider':'Geantă pliabilă de călătorie cu separator pentru rufe',
'Dog leash wall organizer station':'Stație de perete pentru organizarea lesei și accesoriilor câinelui',
'Pet food scoop bag clip combo':'Lingură dozatoare pentru hrană cu clips de închidere a pungii',
'Dog car door protector set':'Set protecții pentru portiere auto, pentru câini',
'Pet toy storage basket foldable':'Coș pliabil pentru depozitarea jucăriilor animalelor',
'Cat litter scoop holder closed':'Suport închis pentru lopățica de litieră',
'Plant pot drainage mesh pad set':'Set plase de drenaj pentru ghivece',
'Balcony plant drip tray adjustable':'Tavă reglabilă pentru colectarea apei la ghivecele de balcon',
'Garden hose guide stake rollers set':'Set ghidaje cu role pentru furtunul de grădină',
'Plant support clips reusable set':'Set clipsuri reutilizabile pentru susținerea plantelor',
'Closet shelf hanging basket':'Coș suspendat pentru raftul din dulap',
'Wardrobe handbag hanging organizer':'Organizator suspendat pentru genți în șifonier',
'Drawer sock organizer honeycomb':'Organizator tip fagure pentru șosete și sertare',
'Closet belt hanger rotating':'Umeraș rotativ pentru curele',
'Sports medal display hanger wall':'Suport de perete pentru expunerea medaliilor sportive',
'Yoga mat wall storage rack':'Suport de perete pentru depozitarea saltelelor de yoga',
'Resistance band door organizer pouch':'Organizator pentru ușă destinat benzilor elastice',
'Board game card holder hands free':'Suport hands-free pentru cărți de joc',
'Puzzle sorting trays stackable':'Tăvi suprapozabile pentru sortarea pieselor de puzzle',
'Kids car seat snack tray age 3 plus':'Tavă pentru gustări la scaunul auto, copii 3+ ani',
'Kids visual timer board non electronic':'Panou vizual de timp pentru copii, fără componente electronice',
'Kids reusable sticker activity book':'Carte de activități cu autocolante reutilizabile pentru copii',
'Kids bed bedside organizer felt':'Organizator din fetru pentru patul copilului',
'Kids portable drawing board storage bag':'Tablă portabilă de desen pentru copii, cu geantă de depozitare',
'Stroller snack cup universal no electronics':'Recipient universal pentru gustări la cărucior, fără electronică',
'Makeup brush drying organizer stand':'Suport organizator pentru uscarea pensulelor de machiaj',
'Cosmetic bag divider insert adjustable':'Separator reglabil pentru geanta de cosmetice',
'Jewelry travel roll organizer':'Organizator rulabil de călătorie pentru bijuterii',
'Hat travel case collapsible':'Cutie pliabilă de călătorie pentru pălării',
'Shoe washing laundry bag structured':'Sac structurat pentru spălarea pantofilor în mașina de spălat',
'Laundry detergent sheet storage box':'Cutie pentru depozitarea foilor de detergent',
'Dryer lint bin magnetic wall':'Recipient magnetic de perete pentru scamele uscătorului',
'Reusable lint remover storage case':'Dispozitiv reutilizabil pentru îndepărtarea scamelor, cu husă'
};
const CAT={'Kitchen':'Bucătărie','Home':'Casă','Travel':'Călătorii','Pet':'Animale','Beauty':'Frumusețe','Laundry':'Spălătorie','Auto':'Auto','Office':'Birou','Kids':'Copii','Baby':'Bebeluși'};
const PHRASES=[
['car headrest','tetieră auto'],['car seat','scaun auto'],['car trunk','portbagaj auto'],['car door','portieră auto'],['car cup holder','suport de pahare auto'],['car ','auto '],
['hidden hook','cârlig ascuns'],['organizer','organizator'],['storage','depozitare'],['holder','suport'],['foldable','pliabil'],['portable','portabil'],['adjustable','reglabil'],['reusable','reutilizabil'],['magnetic','magnetic'],['wall','de perete'],['travel','călătorie'],['luggage','bagaj'],['drawer','sertar'],['shelf','raft'],['bag','geantă'],['basket','coș'],['tray','tavă'],['rack','suport'],['clips','clipsuri'],['clip','clips'],['set','set'],['premium','premium'],['silicone','silicon'],['kids','copii'],['baby','bebeluși'],['dog','câine'],['pet','animale'],['cat','pisică'],['food','hrană'],['shoe','pantofi'],['laundry','rufe'],['phone','telefon'],['cable','cabluri'],['desk','birou'],['bathroom','baie'],['kitchen','bucătărie'],['garden','grădină'],['plant','plante'],['makeup','machiaj'],['jewelry','bijuterii'],['no drill','fără găurire'],['non electronic','fără electronică'],['no electronics','fără electronică']
];
export function roProductName(name=''){
  const raw=String(name||'').trim(); if(!raw)return raw; if(EXACT[raw])return EXACT[raw];
  let s=raw.toLowerCase(); for(const [a,b] of PHRASES)s=s.replaceAll(a,b);
  return s.charAt(0).toUpperCase()+s.slice(1);
}
export function roCategory(cat=''){const raw=String(cat||'').trim();return CAT[raw]||raw;}
export function originalProductName(name=''){return String(name||'').trim();}

if(typeof window!=='undefined'&&/market-intelligence\.html$/.test(window.location.pathname)){
  import('./market-trend-ui.js').catch(err=>console.warn('Trend UI indisponibil:',err?.message||err));
}

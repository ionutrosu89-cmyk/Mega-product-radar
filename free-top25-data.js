const SOURCES=Object.freeze({
  AMAZON_KITCHEN:{label:'Amazon Best Sellers · Kitchen Utensils & Gadgets',url:'https://us.amazon.com/Best-Sellers-Kitchen-Dining-Kitchen-Utensils-Gadgets/zgbs/kitchen/289754',tier:'A',kind:'BEST_SELLERS',period:'snapshot public'},
  AMAZON_AUTOMOTIVE:{label:'Amazon Best Sellers · Automotive',url:'https://www.amazon.com/Best-Sellers/zgbs',tier:'A',kind:'BEST_SELLERS',period:'snapshot public'},
  AMAZON_IDEAS:{label:'Sell on Amazon · Product ideas 2026',url:'https://sell.amazon.com/blog/product-ideas',tier:'A',kind:'AMAZON_EDITORIAL',period:'2026'},
  AMAZON_PRODUCTS_TO_SELL:{label:'Sell on Amazon · High-demand products 2026',url:'https://sell.amazon.com/blog/products-to-sell',tier:'A',kind:'AMAZON_EDITORIAL',period:'2026'},
  AMAZON_ELECTRONICS_IE:{label:'Amazon.ie · Electronics New Releases',url:'https://www.amazon.ie/gp/new-releases/electronics',tier:'A',kind:'NEW_RELEASES',period:'snapshot public'},
  GLIMPSE_AMAZON:{label:'Glimpse · 100 most searched products on Amazon',url:'https://meetglimpse.com/top-searched/most-searched-products-on-amazon/',tier:'B',kind:'SEARCH_VOLUME',period:'Aug 2026'},
  BEAUTYMATTER:{label:'BeautyMatter · Amazon Q1 2026 Top 25 Beauty',url:'https://beautymatter.com/articles/amazon-q1-2026-top-25-beauty-and-personal-care-products',tier:'B',kind:'PUBLISHED_RANKING',period:'Q1 2026'},
  AMAZON_SHAMPOO:{label:'Amazon Best Sellers · Hair Shampoo',url:'https://www.amazon.com/Best-Sellers-Hair-Shampoo/zgbs/beauty/11057651',tier:'A',kind:'BEST_SELLERS',period:'snapshot public'},
  AMAZON_PET_IE:{label:'Amazon.ie Best Sellers · Pet Supplies',url:'https://www.amazon.ie/gp/bestsellers/pet-supplies',tier:'A',kind:'BEST_SELLERS',period:'snapshot public'},
  GLIMPSE_PET:{label:'Glimpse · Top pet trends 2026',url:'https://meetglimpse.com/trends/pet-trends/',tier:'B',kind:'TREND_GROWTH',period:'2026'},
  AMAZON_SPORT:{label:'Amazon Best Sellers · Sports & Outdoors',url:'https://www.amazon.com/Best-Sellers-Sports-Outdoors/zgbs/sporting-goods',tier:'A',kind:'BEST_SELLERS',period:'snapshot public'},
  MEGAFICUS:{label:'Megaficus · Best-selling products on Amazon 2026',url:'https://megaficus.com/en/blog/best-selling-products-on-amazon/',tier:'C',kind:'EDITORIAL_RANKING',period:'2026'},
  RAPIDSHYP:{label:'RapidShyp · Top 25 Best-Selling Products on Amazon 2026',url:'https://www.rapidshyp.com/blog/top-25-best-selling-products-on-amazon/',tier:'C',kind:'EDITORIAL_RANKING',period:'Apr 2026'},
  AMAZON_OFFICE:{label:'Amazon Best Sellers · Office & School Supplies',url:'https://www.amzn.com/Best-Sellers-Office-School-Supplies/zgbs/office-products/1069242',tier:'A',kind:'BEST_SELLERS',period:'snapshot public'},
  AMAZON_PENS:{label:'Amazon Best Sellers · Pens & Refills',url:'https://www.amzn.com/Best-Sellers-Pens-Pen-Refills/zgbs/office-products/1069820',tier:'A',kind:'BEST_SELLERS',period:'snapshot public'},
  AMAZON_LEGAL:{label:'Amazon Best Sellers · Legal Pads',url:'https://www.amzn.com/Best-Sellers-Letter-Legal-Ruled-Pads/zgbs/office-products/490764011',tier:'A',kind:'BEST_SELLERS',period:'snapshot public'},
  AMAZON_BABY_IE:{label:'Amazon.ie · Baby products',url:'https://www.amazon.ie/b?node=94788356031',tier:'A',kind:'CATEGORY_LIST',period:'snapshot public'}
});

const VOLUMES=Object.freeze({
  'air fryer':145700,'desk':423161,'monitor':620949,'laptop':899428,'bluetooth speaker':65453,'digital camera':55248,'sd card':85193,'dash cam':45656,'hdmi cable':40161,'usb-c cable':45329,'office chair':86755,'dog food':115719,'walking pad':41897,'protein powder':77968,'electric bike':84120,'electric scooter':96435,'pokemon cards':48156,'lego sets':513271
});

function source(key){return SOURCES[key];}
function item(name,sourceKey,{sourceRank=null,metric=null,evidenceClass=null,note=''}={}){
  const s=source(sourceKey);const volume=VOLUMES[String(name).toLowerCase()];
  return {name,sourceKey,sourceLabel:s.label,sourceUrl:s.url,sourceTier:s.tier,sourceKind:s.kind,sourcePeriod:s.period,sourceRank,metric:metric||(volume?{label:'Căutări Amazon · 30 zile',value:volume,unit:'searches'}:null),evidenceClass:evidenceClass||(sourceRank?'VERIFIED':s.tier==='A'?'VERIFIED':'DERIVED'),note};
}
function ranked(names,sourceKey){return names.map((name,i)=>item(name,sourceKey,{sourceRank:i+1}));}
function sourced(names,sourceKey){return names.map(name=>item(name,sourceKey));}

const CASA=ranked([
  'Termometru digital pentru carne','Cântar digital de bucătărie','Termometru instant pentru gătit','Cântar inox pentru bucătărie','Hârtie pentru air fryer','Pulverizator pentru ulei','Foarfecă de bucătărie','Deschizător manual de conserve','Dispenser 2-în-1 pentru ulei','Presă din fontă pentru burger','Deschizător multifuncțional de conserve','Tocător de legume cu spiralizator','Paie flexibile de unică folosință','Uscător / spinner pentru salată','Bețe din bambus pentru frigărui','Termometru alimentar waterproof','Dispozitiv pentru mărunțit pui','Tavă pentru cuburi de gheață cu recipient','Paie reutilizabile pentru tumbler','Covoraș XL pentru uscarea vaselor','Set accesorii pentru plită/grill','Hârtie antiaderentă pentru air fryer','Tăvi silicon pentru gheață','Tocător 10-în-1 pentru legume','Hârtie de copt nealbită'
],'AMAZON_KITCHEN');

const AUTO=[
  ...sourced(['Ștergătoare parbriz','Suporturi/coastere pentru pahare auto','Cârlige pentru tetiera auto','Suport telefon auto','Coș de gunoi auto','Cleme de prindere pentru bară','Scanner OBD2','Jump starter portabil','Soluție pentru curățare interior auto','Lavete microfibră auto','Kit restaurare faruri','Aspirator auto','Compresor portabil pentru anvelope','Balsam pentru piele auto','Folie/protecție ecran telefon'],'AMAZON_IDEAS'),
  ...ranked(['Odorizant auto din lemn','Ulei motor sintetic','Lavete microfibră pentru detailing','Ștergătoare cu efect hidrofob','Parasolar pentru parbriz','Gel pentru curățare interior auto'],'AMAZON_AUTOMOTIVE').slice(0,4),
  ...sourced(['Adaptor wireless CarPlay','Încărcător wireless auto 15W','Suport magnetic cu vacuum pentru telefon','Suport magnetic pliabil pentru telefon','Încărcător USB-C 45W pentru mașină','Suport telefon pentru bord/parbriz'],'AMAZON_ELECTRONICS_IE')
].slice(0,25);

const ELECTRONICE=[
  ...sourced(['Căști wireless','Streaming stick','Tracker Bluetooth','Încărcător USB de perete','Adaptor Lightning','Fitness tracker','Tabletă','E-reader','Smart TV 4K','Tabletă pentru copii','Suport de perete pentru monitor','Protecție la supratensiune','Telecomandă Roku de schimb','Power bank portabil','Căști noise-cancelling'],'AMAZON_IDEAS'),
  ...sourced(['Laptop','Monitor','Bluetooth speaker','Cameră digitală','Card SD','Dash cam','Cablu USB-C','Cablu HDMI','Gaming PC','Controller gaming'],'GLIMPSE_AMAZON')
].slice(0,25);

const BEAUTY=[
  item('Medicube Zero Pore Pad 2.0','BEAUTYMATTER',{sourceRank:1}),item('Eos Shea Better Vanilla Cashmere Body Lotion','BEAUTYMATTER',{sourceRank:2}),item('Hero Cosmetics Mighty Patch','BEAUTYMATTER',{sourceRank:3}),item('Neutrogena Makeup Remover Wipes','BEAUTYMATTER',{sourceRank:4}),item('Maybelline Lash Sensational Sky High Mascara','BEAUTYMATTER',{sourceRank:5}),item('Biodance Bio-Collagen Real Deep Mask','BEAUTYMATTER',{sourceRank:6}),item('Amazon Basics Hypoallergenic Cotton Rounds','BEAUTYMATTER',{sourceRank:7}),item('The Ordinary Glycolic Acid 7% Exfoliating Toner','BEAUTYMATTER',{sourceRank:8}),item('Clean Skin Club Clean Towels XL','BEAUTYMATTER',{sourceRank:9}),item('Nizoral Anti-Dandruff Shampoo','BEAUTYMATTER',{sourceRank:10}),item('The Ordinary Niacinamide 10% + Zinc 1%','BEAUTYMATTER',{sourceRank:11}),item('The Ordinary Hyaluronic Acid 2% + B5','BEAUTYMATTER',{sourceRank:16}),item('Aquaphor Healing Ointment Advanced Therapy','BEAUTYMATTER',{sourceRank:17}),item('EltaMD UV Clear Tinted Face Sunscreen SPF 46','BEAUTYMATTER',{sourceRank:22}),item('CeraVe Daily Moisturizing Lotion','BEAUTYMATTER',{sourceRank:25}),
  ...ranked(['Neutrogena T/Sal Therapeutic Shampoo','L’Oreal Elvive Dream Lengths Shampoo & Conditioner','Redken All Soft Shampoo','Selsun Blue Medicated Anti-Dandruff Shampoo','Pureology Hydrate Shampoo','Tea Tree Special Shampoo','Biolage Color Last Shampoo','Head & Shoulders Classic Clean Twin Pack','Just For Men Control GX Shampoo','CeraVe Hydrating Anti-Dandruff Shampoo'],'AMAZON_SHAMPOO').slice(0,10)
];

const PET=[
  ...ranked(['Pad-uri absorbante pentru câini','Nisip aglomerant fără parfum pentru pisici','Hrană umedă pentru pisici multipack','Buzunare pentru pastile / recompense câini','Pungi pentru excremente câini','Cameră indoor pentru animale','Rolă reutilizabilă pentru păr de animale','Mașină de tuns pentru animale','Mingi de tenis pentru câini','Jucărie moale de ros pentru câini','Supliment articulații pentru câini','Cușcă metalică pliabilă pentru câini','Șervețele hipoalergenice pentru animale','Hrană umedă pentru pisici în supă','Set jucării de ros pentru câini','Soluție probiotică pentru gazon artificial'],'AMAZON_PET_IE'),
  ...sourced(['Jucării de enrichment pentru câini','Recompense freeze-dried pentru câini','Litieră automată','Litter Robot','PuraMax','PetSnowy','Cameră pentru zgardă de pisică','Perete / mobilier modular pentru pisici','Canapea pentru pisici'],'GLIMPSE_PET')
].slice(0,25);

const SPORT=[
  ...ranked(['Vestă cu greutăți','Ochelari de înot pentru copii','Gantere neopren','Mingi de golf','Benzi elastice de rezistență','Tumbler sport termoizolant','Prosop microfibră pentru sport/camping','Sticlă sport termoizolantă pentru copii'],'AMAZON_SPORT'),
  ...sourced(['Pachete reutilizabile cu gheață','Foam roller dens','Bluză outdoor cu mânecă lungă','Covoraș yoga','Cântar inteligent','Mănuși fitness','Protein powder'],'MEGAFICUS'),
  ...sourced(['Walking pad','Bicicletă electrică','Trotinetă electrică','Accesorii pentru piscină','Minge medicinală','Coardă de sărit','Step platform','Set benzi fitness','Bidon sport','Accesorii pentru camping'],'GLIMPSE_AMAZON')
].slice(0,25);

const COPII=[
  ...sourced(['Scutece bebeluși','Șervețele umede multi-use','Chiloței de antrenament','Șampon + gel de duș 2-în-1 pentru copii','Termometru fără contact','Creioane colorate','Plastilină / modeling compound','Cutie Pokémon','Markere lavabile','Baloane latex','Cărți de joc','Creioane cerate'],'MEGAFICUS'),
  ...sourced(['Tabletă de scris pentru copii','Șervețele pentru bebeluși'],'AMAZON_PRODUCTS_TO_SELL'),
  ...sourced(['Seturi LEGO','Needoh sensory toy','Pokemon cards'],'GLIMPSE_AMAZON'),
  ...sourced(['Ochelari de înot copii','Masă de joacă cu apă','Telefon de jucărie pentru copii','Set marble run STEM','Bucătărie de jucărie pentru exterior','Joc Spikeball','Set collectible card game','Piscină gonflabilă'],'AMAZON_BABY_IE')
].slice(0,25);

const BIROU=[
  ...ranked(['Hârtie multipurpose pentru imprimantă','Creioane colorate','Hârtie HP pentru imprimantă','Bandă adezivă heavy-duty 6-pack','Blocuri de notițe cu linii','Markere permanente Sharpie','Benzi heavy-duty pentru agățat tablouri','Bandă de ambalare cu dispenser','Folii pentru laminare','Hârtie Hammermill','Dosare cu tab-uri','Pixuri gel Pilot G2','Desk pad din piele PU','Folii protectoare pentru documente','Highlighters BIC','Bandă dublu-adezivă nano'],'AMAZON_OFFICE'),
  ...ranked(['Pixuri BIC Round Stic','Pixuri Paper Mate Flair','Pixuri Sharpie S-Gel','Pixuri Paper Mate InkJoy','Pixuri UIXJODO'],'AMAZON_PENS'),
  ...ranked(['Bloc legal Oxford 8.5x11','Bloc legal Oxford 5x8','Bloc legal TOPS','Bloc notes college-ruled 5x8'],'AMAZON_LEGAL')
].slice(0,25);

export const FREE_TOP25_NICHES=Object.freeze([
  {id:'CASA',label:'Casă & Bucătărie',emoji:'🏠',products:CASA},
  {id:'AUTO',label:'Auto',emoji:'🚗',products:AUTO},
  {id:'ELECTRONICE',label:'Electronice',emoji:'🎧',products:ELECTRONICE},
  {id:'BEAUTY',label:'Beauty',emoji:'✨',products:BEAUTY},
  {id:'PET',label:'Pet',emoji:'🐾',products:PET},
  {id:'SPORT',label:'Sport',emoji:'🏃',products:SPORT},
  {id:'COPII',label:'Copii',emoji:'🧸',products:COPII},
  {id:'BIROU',label:'Birou',emoji:'🗂️',products:BIROU}
].map(n=>({...n,products:n.products.map((p,index)=>({...p,rank:index+1,internalRankClass:'DERIVED'}))})));

export const FREE_TOP25_SOURCES=SOURCES;

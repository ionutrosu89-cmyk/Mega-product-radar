import fs from 'node:fs/promises';

const SOURCE='market-intelligence-live.json';
const UNIVERSE='category-universe.json';
const OUTPUT='category-radar-live.json';
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const arr=v=>Array.isArray(v)?v:[];

function categoryKey(p){
  const c=norm(p.cat),n=norm(p.name);
  const text=`${c} ${n}`;
  const rules=[
    ['baby',/bebel|baby|stroller|nursery|infant/],
    ['kids',/kids|copii|preschool|3.?6|child/],
    ['toys',/toy|juc|montessori|activity|educational|learning/],
    ['kitchen',/bucatar|kitchen|pan |pot |fridge|food|sink|oil spray/],
    ['bath',/baie|bath|shower|toothbrush/],
    ['closet',/garderob|closet|wardrobe|drawer|handbag|belt hanger/],
    ['laundry',/laundry|dryer|lint|washing/],
    ['auto',/auto|car |vehicle|trunk|headrest|visor/],
    ['travel',/travel|luggage|airplane|packing/],
    ['pet',/pet|dog|cat|litter/],
    ['office',/birou|desk|office|monitor|laptop|headphone|cable/],
    ['phone',/phone|tablet|tech/],
    ['beauty',/beauty|makeup|cosmetic|hair tool/],
    ['fashion',/fashion|jewelry|hat |shoe/],
    ['fitness',/fitness|recovery|resistance band|yoga/],
    ['outdoor',/outdoor|camping|hiking|picnic/],
    ['garden',/gradina|balcon|garden|plant|hose/],
    ['diy',/diy|repair|workshop|tool|mounting/],
    ['party',/party|event|birthday/],
    ['hobby',/craft|puzzle|board game|painting|hobby/],
    ['sports',/sport|medal|ball storage/],
    ['seasonal',/season|holiday|gift/],
    ['senior',/senior|daily living|easy grip|accessibility/],
    ['home',/casa|home|sofa|bed|mattress|furniture/]
  ];
  return rules.find(([,re])=>re.test(text))?.[0]||'home';
}

function gateStats(p){
  const gates=p?.testBuyDecision?.gates||{};
  const total=Math.max(8,Object.keys(gates).length||0);
  const passed=Object.values(gates).filter(Boolean).length;
  return {passed,total};
}

function commercialScore(p){
  const g=gateStats(p);
  const e=p?.economics||{};
  const confidence=num(p?.testBuyDecision?.confidenceScore||p?.dataConfidence?.overall);
  const opportunity=num(p?.opportunityRanking?.score);
  const ready=p?.testBuyDecision?.status==='TEST_BUY'?1:0;
  return ready*10000+g.passed*100+Math.min(99,num(e.margin))*1.2+Math.min(199,num(e.roi))*.5+confidence*.35+opportunity*.15;
}

const live=JSON.parse(await fs.readFile(SOURCE,'utf8'));
const universe=JSON.parse(await fs.readFile(UNIVERSE,'utf8'));
const sourceProducts=arr(live.products);
const categories=arr(universe.categories).map(c=>{
  const products=sourceProducts.filter(p=>categoryKey(p)===c.key).sort((a,b)=>commercialScore(b)-commercialScore(a)).slice(0,num(universe.targetPerCategory)||20).map((p,i)=>({
    rank:i+1,
    name:p.name,
    cat:p.cat,
    imageUrl:p.imageUrl||'',
    opportunityRank:num(p?.opportunityRanking?.rank)||null,
    opportunityScore:num(p?.opportunityRanking?.score),
    launchScore:num(p?.launchScore?.score),
    margin:num(p?.economics?.margin),
    roi:num(p?.economics?.roi),
    profit:num(p?.economics?.profit),
    confidenceScore:num(p?.testBuyDecision?.confidenceScore||p?.dataConfidence?.overall),
    confidence:p?.testBuyDecision?.confidence||p?.dataConfidence?.level||'SCĂZUTĂ',
    testStatus:p?.testBuyDecision?.status||'HOLD',
    verdict:p?.testBuyDecision?.verdict||'NU TESTA ÎNCĂ',
    quantity:num(p?.testBuyDecision?.quantity),
    blockers:arr(p?.testBuyDecision?.blockers),
    gates:gateStats(p),
    commercialScore:Math.round(commercialScore(p)*10)/10
  }));
  const target=num(universe.targetPerCategory)||20;
  const minimum=num(universe.minimumDisplayPerCategory)||10;
  const ready=products.filter(p=>p.testStatus==='TEST_BUY').length;
  return {...c,target,minimum,current:products.length,coveragePct:Math.round(Math.min(100,products.length/target*100)),ready,needsDiscovery:products.length<target,products};
});

const output={
  version:'1.0',
  updatedAt:new Date().toISOString(),
  policy:'Category Radar separă oportunitățile pe categorie. 10–20 reprezintă ținta de acoperire, nu produse garantat recomandate la cumpărare. TEST rămâne permis numai după toate gate-urile comerciale.',
  stats:{
    categories:categories.length,
    categoriesAtMinimum:categories.filter(c=>c.current>=c.minimum).length,
    categoriesAtTarget:categories.filter(c=>c.current>=c.target).length,
    totalMappedProducts:categories.reduce((s,c)=>s+c.current,0),
    totalTestReady:categories.reduce((s,c)=>s+c.ready,0),
    minimumPerCategory:num(universe.minimumDisplayPerCategory)||10,
    targetPerCategory:num(universe.targetPerCategory)||20
  },
  categories
};
await fs.writeFile(OUTPUT,JSON.stringify(output,null,2)+'\n');
console.log(`Category Radar: ${output.stats.categoriesAtMinimum}/${output.stats.categories} categorii au minimum ${output.stats.minimumPerCategory} produse; ${output.stats.totalTestReady} TEST-ready.`);

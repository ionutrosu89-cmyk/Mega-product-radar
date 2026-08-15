import fs from 'node:fs/promises';

const LIVE='market-intelligence-live.json';
const HISTORY='market-intelligence-history.json';
const ALERTS='alerts-live.json';
const VALIDATION='validation-queue-live.json';
const CONFIDENCE='data-confidence-live.json';
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const round=v=>Math.round(num(v)*10)/10;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,num(v)));
const norm=v=>String(v||'').trim().toLowerCase();
async function read(path,fallback){try{return JSON.parse(await fs.readFile(path,'utf8'));}catch{return fallback;}}
function domainOf(url){try{return new URL(String(url||'')).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}}

function previous(history,name){
  const snaps=history?.products?.[norm(name)]?.snapshots;
  if(!Array.isArray(snaps)||snaps.length<2)return null;
  return snaps[snaps.length-2];
}

function marketGapV2(p){
  const rows=Array.isArray(p?.evidenceCoverage?.rows)?p.evidenceCoverage.rows:[];
  const marketMap={amazonDE:'Germania',allegroPL:'Polonia',trendyolTR:'Turcia',amazonUS:'SUA',amazonUK:'UK',ebay:'eBay/global',emagRO:'România'};
  const markets=rows.filter(r=>marketMap[r.key]).map(r=>({market:marketMap[r.key],key:r.key,checked:Boolean(r.ok),present:Boolean(r.present),resultProxy:num(r.resultCount),observedLinks:num(r.observedLinks)}));
  const ro=markets.find(m=>m.key==='emagRO')||{checked:false,present:false,resultProxy:0,observedLinks:0};
  const external=markets.filter(m=>m.key!=='emagRO');
  const extPresent=external.filter(m=>m.present).length;
  const extChecked=external.filter(m=>m.checked).length;
  const extResults=external.reduce((a,m)=>a+m.resultProxy,0);
  const roPressure=clamp((ro.present?30:0)+Math.min(50,ro.resultProxy*8)+Math.min(20,ro.observedLinks*5));
  let earlyScore=clamp(extPresent*14+Math.min(30,extResults*2)+(extChecked>=3?12:0)-roPressure*0.55);
  if(extChecked<2)earlyScore=Math.min(earlyScore,45);
  const label=extChecked<2?'DATE INSUFICIENTE':earlyScore>=75?'EARLY GAP PUTERNIC':earlyScore>=55?'EARLY GAP MODERAT':'GAP SLAB';
  return {score:round(earlyScore),label,romaniaPressure:round(roPressure),externalMarketsChecked:extChecked,externalMarketsPresent:extPresent,markets,policy:'Market Gap V2 folosește doar prezență, rezultate-proxy și linkuri observate; nu estimează vânzări sau cotă de piață.'};
}

function reviewV2(p){
  const r=p?.reviews||{};
  const themes=Array.isArray(r.negativeThemes)?r.negativeThemes.filter(Boolean):[];
  const unique=[...new Set(themes.map(x=>String(x).trim()).filter(Boolean))];
  const sourceCount=num(r.sourceCount),snippetCount=num(r.snippetCount);
  const coverage=clamp(sourceCount*22+Math.min(34,snippetCount*6));
  const confidence=sourceCount>=3&&snippetCount>=5?'RIDICATĂ':sourceCount>=1&&snippetCount>=2?'MEDIE':'SCĂZUTĂ';
  return {confidence,coverageScore:round(coverage),sourceCount,snippetCount,negativeThemes:unique.slice(0,8),improvementIdeas:unique.slice(0,5).map(x=>`Caută o variantă care reduce problema: ${x}`),policy:'Temele provin exclusiv din review evidence deja colectat. Nu sunt generate ca feedback real dacă nu există dovezi.'};
}

function chinaV2(p){
  const s=p?.sourcing||{};
  const items=Array.isArray(s.items)?s.items:[];
  const links=[...(Array.isArray(p?.sourcingLinks)?p.sourcingLinks:[]),...items.map(x=>x?.url||x?.link||'')].filter(Boolean);
  const domains=[...new Set(links.map(domainOf).filter(Boolean))];
  const sources=Math.max(num(s.sources),domains.length);
  const readiness=String(s.readiness||'NONE').toUpperCase();
  const manual=s.requiresManualCommercialCheck!==false;
  let score=clamp(num(s.score));
  if(domains.length>=2)score=clamp(score+8);
  if(manual)score=Math.min(score,78);
  const risks=[];
  if(!sources)risks.push('fără sursă China observată');
  if(domains.length<2)risks.push('diversificare furnizori insuficientă');
  if(manual)risks.push('MOQ/preț/transport/conformitate necesită confirmare manuală');
  return {score:round(score),readiness,sources,domains,observedLinks:links.slice(0,8),risks,commercialChecklist:['confirmă prețul real','confirmă MOQ','confirmă costul transportului','confirmă materialele și conformitatea','cere mostre înainte de comandă mare'],policy:'China Intelligence V2 clasifică doar sursele observate și readiness-ul existent; nu declară furnizor verificat fără confirmare comercială.'};
}

function profitV2(p){
  const e=p?.economics||{};
  const margin=num(e.margin),roi=num(e.roi),profit=num(e.profit);
  const verified=Boolean(e.pricingVerified);
  const sale=margin>0&&profit>0?profit/(margin/100):0;
  const cost=sale>0?Math.max(0,sale-profit):0;
  const scenario=(saleMul,costMul)=>{
    const s=sale*saleMul,c=cost*costMul,pr=s-c;
    return {salePrice:round(s),landedCost:round(c),profit:round(pr),margin:s>0?round(pr/s*100):0,roi:c>0?round(pr/c*100):0};
  };
  const scenarios=sale&&cost?{conservator:scenario(.95,1.10),realist:scenario(1,1),optimist:scenario(1.05,.95)}:null;
  const targetMargin20=sale>0?round(sale*.80):0;
  const confidence=verified?'RIDICATĂ':sale&&cost?'MEDIE':'SCĂZUTĂ';
  return {confidence,pricingVerified:verified,derivedSalePrice:round(sale),derivedLandedCost:round(cost),maxLandedCostFor20Margin:targetMargin20,scenarios,policy:'Scenariile sunt derivate matematic din economia curentă și sunt orientative. Dacă pricingVerified=false, nu reprezintă prețuri comerciale confirmate.'};
}

function xrayV2(p){
  const missing=[];
  if(!p?.launchScore?.enoughEvidence)missing.push('dovezi comerciale suficiente');
  if(!p?.economics?.pricingVerified)missing.push('preț și landed cost verificate');
  if(num(p?.competitors?.evidenceMarkets)===0)missing.push('competiție RO observată');
  if(num(p?.reviews?.sourceCount)===0)missing.push('review evidence');
  if(num(p?.sourcing?.sources)===0)missing.push('sourcing China');
  if(num(p?.trendIntelligence?.sampleCount)<2)missing.push('istoric de trend');
  const strengths=[...(p?.opportunityRanking?.reasons||[])].slice(0,6);
  const blockers=[...(p?.opportunityRanking?.blockers||[]),...missing.map(x=>`lipsește: ${x}`)];
  return {strengths:[...new Set(strengths)],blockers:[...new Set(blockers)].slice(0,8),nextCondition:missing[0]||'monitorizează stabilitatea semnalelor',summary:`Prioritate ${p?.opportunityRanking?.tier||'DE CERCETAT'} · Opportunity ${num(p?.opportunityRanking?.score)} · Launch ${num(p?.launchScore?.score)} · Trend ${p?.trendIntelligence?.status||'INSUFICIENT'}`};
}

function confidenceFor(p){
  const dims={
    market:clamp(p?.evidenceCoverage?.coverageScore),
    demand:p?.keywordDemand?.verifiedSearchVolume?90:clamp(p?.demand?.score>0?55:30),
    competition:num(p?.competitors?.evidenceMarkets)>0?70:25,
    reviews:clamp(num(p?.reviews?.sourceCount)*25+num(p?.reviews?.snippetCount)*5),
    sourcing:clamp(num(p?.sourcing?.score)),
    pricing:p?.economics?.pricingVerified?90:(num(p?.economics?.margin)>0?45:20),
    history:num(p?.trendIntelligence?.sampleCount)>=3?80:num(p?.trendIntelligence?.sampleCount)>=2?60:25
  };
  const overall=round(Object.values(dims).reduce((a,b)=>a+b,0)/Object.keys(dims).length);
  const level=overall>=75?'RIDICATĂ':overall>=50?'MEDIE':'SCĂZUTĂ';
  const missing=Object.entries(dims).filter(([,v])=>v<50).map(([k])=>k);
  return {overall,level,dimensions:dims,missing};
}

function alertFor(p,prev){
  const alerts=[];
  const r=p?.opportunityRanking||{},t=p?.trendIntelligence||{};
  const launchDelta=prev?round(num(p?.launchScore?.score)-num(prev.launch)):0;
  const gapDelta=prev?round(num(p?.marketGap?.score)-num(prev.marketGap)):0;
  const compDelta=prev?round(num(p?.competition?.pressure)-num(prev.competitionPressure)):0;
  if(num(r.rank)>0&&num(r.rank)<=10)alerts.push({type:'TOP10',severity:num(r.rank)<=3?'HIGH':'MEDIUM',message:`A intrat/este în Top ${num(r.rank)}`});
  if(t.status==='ACCELERATING')alerts.push({type:'ACCELERATING',severity:'HIGH',message:'Trendul intern accelerează'});
  else if(t.status==='RISING')alerts.push({type:'RISING',severity:'MEDIUM',message:'Trendul intern este în creștere'});
  if(launchDelta>=5)alerts.push({type:'LAUNCH_UP',severity:'HIGH',message:`Launch Score +${launchDelta}`});
  if(gapDelta>=5)alerts.push({type:'GAP_UP',severity:'MEDIUM',message:`Market Gap +${gapDelta}`});
  if(compDelta<=-5)alerts.push({type:'RO_COMP_DOWN',severity:'MEDIUM',message:`Presiunea RO ${compDelta}`});
  if(p?.launchScore?.verdict==='CANDIDAT TEST')alerts.push({type:'TEST_NEAR',severity:'HIGH',message:'Produsul a ajuns CANDIDAT TEST'});
  return alerts;
}

function validationFor(p){
  const tasks=[];
  if(!p?.economics?.pricingVerified)tasks.push({key:'pricing',priority:95,label:'Validează prețul și landed cost'});
  if(num(p?.sourcing?.sources)===0)tasks.push({key:'sourcing',priority:90,label:'Găsește/validează sursa China'});
  if(num(p?.competitors?.evidenceMarkets)===0)tasks.push({key:'competition',priority:85,label:'Validează competiția din România'});
  if(num(p?.reviews?.sourceCount)===0)tasks.push({key:'reviews',priority:75,label:'Adaugă review evidence'});
  if(num(p?.trendIntelligence?.sampleCount)<2)tasks.push({key:'history',priority:55,label:'Mai așteaptă istoric de trend'});
  if(!p?.launchScore?.enoughEvidence)tasks.push({key:'evidence',priority:80,label:'Completează dovezile comerciale'});
  tasks.sort((a,b)=>b.priority-a.priority);
  return tasks;
}

const live=await read(LIVE,{products:[],stats:{}});
const history=await read(HISTORY,{products:{}});
const products=Array.isArray(live.products)?live.products:[];
const alertRows=[];
const validationRows=[];

for(const p of products){
  const prev=previous(history,p.name);
  p.marketGapV2=marketGapV2(p);
  p.reviewIntelligenceV2=reviewV2(p);
  p.chinaIntelligenceV2=chinaV2(p);
  p.profitEngineV2=profitV2(p);
  p.xrayV2=xrayV2(p);
  p.dataConfidence=confidenceFor(p);
  const alerts=alertFor(p,prev);
  p.alerts=alerts;
  if(alerts.length)alertRows.push({name:p.name,cat:p.cat,imageUrl:p.imageUrl||'',rank:num(p?.opportunityRanking?.rank),opportunityScore:num(p?.opportunityRanking?.score),tier:p?.opportunityRanking?.tier||'',alerts,confidence:p.dataConfidence.level});
  const tasks=validationFor(p);
  p.validationTasks=tasks;
  if(tasks.length)validationRows.push({name:p.name,cat:p.cat,imageUrl:p.imageUrl||'',rank:num(p?.opportunityRanking?.rank),opportunityScore:num(p?.opportunityRanking?.score),tier:p?.opportunityRanking?.tier||'',tasks,blockers:p?.xrayV2?.blockers||[],confidence:p.dataConfidence.level});
}

alertRows.sort((a,b)=>{const sev=x=>x.alerts.some(y=>y.severity==='HIGH')?2:x.alerts.some(y=>y.severity==='MEDIUM')?1:0;return sev(b)-sev(a)||b.opportunityScore-a.opportunityScore;});
validationRows.sort((a,b)=>num(b.tasks?.[0]?.priority)-num(a.tasks?.[0]?.priority)||b.opportunityScore-a.opportunityScore);

const dims=['market','demand','competition','reviews','sourcing','pricing','history'];
const dimAvg=Object.fromEntries(dims.map(k=>[k,round(products.reduce((a,p)=>a+num(p?.dataConfidence?.dimensions?.[k]),0)/Math.max(1,products.length))]));
const levelCounts={RIDICATĂ:products.filter(p=>p.dataConfidence.level==='RIDICATĂ').length,MEDIE:products.filter(p=>p.dataConfidence.level==='MEDIE').length,SCĂZUTĂ:products.filter(p=>p.dataConfidence.level==='SCĂZUTĂ').length};
const missingCounts=Object.fromEntries(dims.map(k=>[k,products.filter(p=>p.dataConfidence.missing.includes(k)).length]));

live.version='1.3';
live.freeIntelligenceSuite={version:'1.0',updatedAt:new Date().toISOString(),modules:['Alert Engine V1','Validation Queue','Xray RO V2','Market Gap V2','Review Intelligence V2','China Intelligence V2','Profit Engine V2','Data Confidence Dashboard'],policy:'Toate modulele gratuite folosesc doar date deja observate/derivate și nu modifică pragurile TEST/CUMPĂRĂ.'};
await fs.writeFile(LIVE,JSON.stringify(live,null,2)+'\n');
await fs.writeFile(ALERTS,JSON.stringify({version:'1.0',updatedAt:new Date().toISOString(),policy:'Alertele prioritizează atenția; nu reprezintă recomandare de cumpărare.',stats:{products:alertRows.length,high:alertRows.filter(x=>x.alerts.some(a=>a.severity==='HIGH')).length},items:alertRows.slice(0,30)},null,2)+'\n');
await fs.writeFile(VALIDATION,JSON.stringify({version:'1.0',updatedAt:new Date().toISOString(),policy:'Coada arată ce trebuie validat înainte de o decizie comercială.',stats:{products:validationRows.length,pricing:validationRows.filter(x=>x.tasks.some(t=>t.key==='pricing')).length,sourcing:validationRows.filter(x=>x.tasks.some(t=>t.key==='sourcing')).length,competition:validationRows.filter(x=>x.tasks.some(t=>t.key==='competition')).length},items:validationRows.slice(0,50)},null,2)+'\n');
await fs.writeFile(CONFIDENCE,JSON.stringify({version:'1.0',updatedAt:new Date().toISOString(),policy:'Data Confidence măsoară completitudinea dovezilor, nu probabilitatea de succes.',stats:{total:products.length,levels:levelCounts},dimensionAverages:dimAvg,missingCounts,products:products.map(p=>({name:p.name,cat:p.cat,rank:num(p?.opportunityRanking?.rank),score:p.dataConfidence.overall,level:p.dataConfidence.level,missing:p.dataConfidence.missing})).sort((a,b)=>b.score-a.score)},null,2)+'\n');
console.log(`Free Intelligence Suite: ${products.length} produse · ${alertRows.length} cu alerte · ${validationRows.length} în validation queue · confidence high ${levelCounts.RIDICATĂ}.`);

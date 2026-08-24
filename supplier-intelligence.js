import {installCloudAutosync} from './cloud-sync.js';
await installCloudAutosync();
import {V6_STORAGE,rankSuppliers} from './v6-core.js';
import {verifySupplierQuote} from './supplier-quote-verifier.js';
import {evaluateQuoteNegotiation} from './supplier-negotiation-engine.js';

const SUPPLIER_KEY='megaRadarSupplierRecordsV1';
const premium=document.createElement('link');premium.rel='stylesheet';premium.href='premium-ui.css';document.head.appendChild(premium);
const nav=document.createElement('nav');nav.className='bottom-nav';nav.innerHTML='<a href="index.html"><b>⌂</b>Acasă</a><a href="todays-opportunities.html"><b>◆</b>Astăzi</a><a href="discovery-inbox.html"><b>⌕</b>Descoperă</a><a class="active" href="supplier-intelligence.html"><b>▦</b>Furnizori</a><a href="sourcing-ops.html"><b>↗</b>Sourcing Ops</a><a href="strict-audit.html"><b>✓</b>Audit</a>';document.body.appendChild(nav);
const $=s=>document.querySelector(s);
const read=()=>{try{return JSON.parse(localStorage.getItem(V6_STORAGE.supplierMatrix)||'[]')}catch{return[]}};
const write=v=>localStorage.setItem(V6_STORAGE.supplierMatrix,JSON.stringify(v));
const keyOf=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const value=id=>$(id)?.value?.trim?.()??'';
const numOrRaw=id=>value(id)===''?'':Number(value(id));
const splitLines=id=>value(id).split(/\n|,/).map(x=>x.trim()).filter(Boolean);
const boolSelect=id=>value(id)===''?null:value(id)==='true';
const iso=id=>value(id)?new Date(value(id)).toISOString():'';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function inboundQuoteContext(){
  const params=new URLSearchParams(location.search);
  const product=String(params.get('product')||'').trim().slice(0,180);
  const supplier=String(params.get('supplier')||'').trim().slice(0,180);
  const platform=String(params.get('platform')||'').trim().slice(0,60);
  return{product,supplier,platform};
}
function applyInboundQuoteContext(){
  const ctx=inboundQuoteContext();
  if(ctx.product&&$('#product'))$('#product').value=ctx.product;
  if(ctx.supplier&&$('#name'))$('#name').value=ctx.supplier;
  if(ctx.platform&&$('#platform')){
    const allowed=[...$('#platform').options].map(x=>x.value);
    if(allowed.includes(ctx.platform))$('#platform').value=ctx.platform;
  }
  if((ctx.product||ctx.supplier)&&$('#quoteStatus'))$('#quoteStatus').innerHTML='<b>Context preluat din Sourcing Ops.</b> Produsul/furnizorul sunt doar precompletate pentru lucru. Prețul, MOQ, transportul, linkul exact, documentele și verificarea manuală rămân obligatorii.';
}

function readSupplierRecords(){try{return JSON.parse(localStorage.getItem(SUPPLIER_KEY)||'{}')||{};}catch{return{};}}
function syncDecisionSupplier(product,row){
  const all=readSupplierRecords(),key=keyOf(product);
  if(row.commercialVerified===true){
    all[key]={
      productName:product,
      supplierName:row.supplierName,
      platform:row.platform,
      url:row.url,
      commercialVerified:true,
      verified:true,
      strictQuote:row.strictQuote,
      verification:row.verification,
      verifiedAt:row.strictQuote.manualVerifiedAt,
      notes:'Ofertă verificată strict în moneda originală. Landed cost și conversia valutară rămân gate separat.'
    };
  }else delete all[key];
  localStorage.setItem(SUPPLIER_KEY,JSON.stringify(all));
}

function collectQuote({recordManualTimestamp=false}={}){
  const product=value('#product');
  const manualChecked=$('#manualConfirm')?.checked===true;
  const quote={
    productCanonicalKey:keyOf(product),
    supplierName:value('#name'),
    platform:value('#platform'),
    sourceUrl:value('#url'),
    supplierSkuOrModel:value('#sku'),
    exactProductConfirmed:$('#exact')?.checked===true,
    unitPrice:numOrRaw('#price'),
    currency:value('#currency'),
    quoteQuantity:numOrRaw('#quoteQty'),
    moq:numOrRaw('#moq'),
    sampleCost:numOrRaw('#sample'),
    sampleShippingToRomania:numOrRaw('#sampleShipping'),
    leadTimeDays:numOrRaw('#lead'),
    incoterm:value('#incoterm'),
    bulkShippingToRomania:numOrRaw('#bulkShipping'),
    shippingCurrency:value('#shippingCurrency'),
    cartonQuantity:numOrRaw('#cartonQty'),
    cartonGrossWeightKg:numOrRaw('#cartonWeight'),
    cartonLengthCm:numOrRaw('#cartonL'),
    cartonWidthCm:numOrRaw('#cartonW'),
    cartonHeightCm:numOrRaw('#cartonH'),
    paymentTerms:value('#payment'),
    tradeAssuranceOrEquivalent:boolSelect('#ta'),
    inspectionAccepted:$('#inspection')?.checked===true,
    complianceStatus:value('#compliance'),
    complianceEvidence:splitLines('#complianceEvidence'),
    quotedAt:iso('#quotedAt'),
    quoteValidUntil:iso('#validUntil'),
    manualVerifiedAt:manualChecked&&recordManualTimestamp?new Date().toISOString():'',
    manualVerifiedBy:value('#verifiedBy')
  };
  return{product,quote,manualChecked};
}

function previewQuote(recordManualTimestamp=false){
  const {quote,manualChecked}=collectQuote({recordManualTimestamp});
  const verification=verifySupplierQuote(quote);
  const box=$('#quoteStatus');
  if(!box)return{quote,verification};
  if(verification.verified){
    box.innerHTML='<b class="good">MANUALLY_VERIFIED_QUOTE</b> · Oferta poate satisface Supplier Gate. <b>Landed Cost rămâne separat și neconfirmat.</b>';
  }else{
    const blockers=verification.blockers.map(esc).join(' · ');
    const manualNote=manualChecked&&!recordManualTimestamp?' · La salvare se va înregistra timestamp-ul verificării manuale.':'';
    box.innerHTML=`<b class="warn">QUOTE_INCOMPLETE</b> · Lipsesc/nu sunt valide: ${blockers||'—'}${manualNote}`;
  }
  return{quote,verification};
}

function negotiationOptions(){
  return{
    sellPriceRon:Number(value('#sellPriceRon')),
    fxToRon:{USD:Number(value('#fxUsd')),EUR:Number(value('#fxEur')),CNY:Number(value('#fxCny'))}
  };
}
function negotiationClass(status){return status==='POTENTIALLY_FEASIBLE_PENDING_LANDED_COST'?'good':status==='NEGOTIATE_DOWN'||status==='FX_REQUIRED'?'warn':'bad';}
function negotiationLabel(x){
  if(x.status==='POTENTIALLY_FEASIBLE_PENDING_LANDED_COST')return`POTENȚIAL · buffer ${Number(x.screening?.headroomRon||0).toFixed(2)} lei`;
  if(x.status==='NEGOTIATE_DOWN')return`NEGOCIAZĂ · max ${Number(x.screening?.maxUnitPriceInQuoteCurrency||0).toFixed(2)} ${esc(x.quoted?.currency||'')}`;
  if(x.status==='REJECT_ECONOMICS')return'RESPINGE ECONOMIC';
  if(x.status==='FX_REQUIRED')return'CURS FX NECESAR';
  if(x.status==='QUOTE_INCOMPLETE')return'OFERTĂ INCOMPLETĂ';
  return esc(x.status||'NECALCULAT');
}
function commercialGate(x){return x?.commercialVerified===true?'VERIFICAT STRICT':'INCOMPLET';}
function render(){
  const filter=value('#filter').toLowerCase(),rows=read().filter(x=>!filter||String(x.product).toLowerCase().includes(filter));
  const ranked=rankSuppliers(rows,{targetQty:Number(value('#qty')),targetUnitCost:Number(value('#target'))});
  const opts=negotiationOptions();
  const evaluated=ranked.map(x=>({...x,negotiation:evaluateQuoteNegotiation(x.strictQuote||{},opts)}));
  $('#results').innerHTML=evaluated.length?`<table class="table"><thead><tr><th>Produs</th><th>Furnizor</th><th>Preț</th><th>MOQ</th><th>Transport RO</th><th>Lead</th><th>Supplier Gate</th><th>Negociere</th><th>Scor V6*</th></tr></thead><tbody>${evaluated.map(x=>`<tr><td>${esc(x.product)}</td><td>${esc(x.supplierName)}</td><td>${Number(x.quotedPrice||0).toFixed(2)} ${esc(x.currency||'')}</td><td>${x.moq||0}</td><td>${x.bulkShippingToRomania===''?'—':`${Number(x.bulkShippingToRomania||0).toFixed(2)} ${esc(x.shippingCurrency||'')}`}</td><td>${x.leadTimeDays||'—'} zile</td><td class="${x.commercialVerified?'good':'warn'}">${commercialGate(x)}</td><td class="${negotiationClass(x.negotiation.status)}"><b>${negotiationLabel(x.negotiation)}</b><br><span class="note">${esc(x.negotiation.action||'')}</span></td><td><b>${Math.round(x.score||0)}</b></td></tr>`).join('')}</tbody></table><p class="note">* Scorul V6 este orientativ. Verdictul de negociere folosește doar ofertă strict verificată + curs FX introdus explicit + Target Cost Envelope. „Potențial” nu înseamnă landed cost confirmat și nu permite TEST.</p>`:'<p class="note">Nu există oferte salvate pentru filtrul curent.</p>';
}

$('#preview')?.addEventListener('click',()=>previewQuote(false));
$('#save')?.addEventListener('click',()=>{
  const first=collectQuote({recordManualTimestamp:false});
  if(!first.product||!first.quote.supplierName){$('#quoteStatus').innerHTML='<b class="bad">Completează produsul și furnizorul.</b>';return;}
  const {quote}=collectQuote({recordManualTimestamp:first.manualChecked});
  const verification=verifySupplierQuote(quote);
  const row={
    product:first.product,
    supplierName:quote.supplierName,
    platform:quote.platform,
    url:quote.sourceUrl,
    quotedPrice:quote.unitPrice,
    currency:quote.currency,
    moq:quote.moq,
    sampleCost:quote.sampleCost,
    sampleShippingToRomania:quote.sampleShippingToRomania,
    bulkShippingToRomania:quote.bulkShippingToRomania,
    shippingCurrency:quote.shippingCurrency,
    leadTimeDays:quote.leadTimeDays,
    tradeAssurance:quote.tradeAssuranceOrEquivalent===true,
    certifications:quote.complianceEvidence,
    strictQuote:quote,
    verification,
    commercialVerified:verification.verified===true,
    savedAt:new Date().toISOString()
  };
  const rows=read();rows.push(row);write(rows);syncDecisionSupplier(first.product,row);render();
  if(verification.verified)$('#quoteStatus').innerHTML='<b class="good">Salvat: MANUALLY_VERIFIED_QUOTE.</b> Supplier Gate poate folosi această ofertă; Landed Cost rămâne separat.';
  else $('#quoteStatus').innerHTML=`<b class="warn">Salvat ca QUOTE_INCOMPLETE.</b> Blocaje: ${esc(verification.blockers.join(' · '))}`;
});
for(const id of ['#rank','#sellPriceRon','#fxUsd','#fxEur','#fxCny'])$(id)?.addEventListener(id==='#rank'?'click':'change',render);
applyInboundQuoteContext();
render();

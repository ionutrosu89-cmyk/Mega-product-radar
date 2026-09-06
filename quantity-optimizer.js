import {analyzeQuantityEconomics} from './quantity-economics-v1.js';
const Q=[30,50,100,300];
const n=id=>{const v=document.querySelector(id)?.value;return v===''?null:Number(v);};
const lots=document.querySelector('#lots');
lots.innerHTML=Q.map(q=>`<article class="card"><h3>${q} buc.</h3><label>Preț furnizor/buc. RON<input id="price-${q}" type="number" step="0.0001"></label><label>Ref. ofertă<input id="priceRef-${q}"></label><label>Transport total RON<input id="freight-${q}" type="number" step="0.01"></label><label>Ref. transport<input id="freightRef-${q}"></label><label>Brokeraj total RON<input id="broker-${q}" type="number" step="0.01" value="0"></label><label>Ref. brokeraj<input id="brokerRef-${q}"></label></article>`).join('');

document.querySelector('#calculate').addEventListener('click',()=>{
 const supplierPriceTiers=Q.map(q=>({minQty:q,unitPriceRon:n(`#price-${q}`),evidenceRef:document.querySelector(`#priceRef-${q}`).value.trim()})).filter(x=>Number.isFinite(x.unitPriceRon)&&x.unitPriceRon>0&&x.evidenceRef);
 const freightByQuantity=Q.map(q=>({quantity:q,totalFreightRon:n(`#freight-${q}`),verified:Boolean(document.querySelector(`#freightRef-${q}`).value.trim()),evidenceRef:document.querySelector(`#freightRef-${q}`).value.trim()}));
 const brokerageByQuantity=Q.map(q=>({quantity:q,totalRon:n(`#broker-${q}`),verified:Boolean(document.querySelector(`#brokerRef-${q}`).value.trim()),evidenceRef:document.querySelector(`#brokerRef-${q}`).value.trim()})).filter(x=>x.verified);
 const r=analyzeQuantityEconomics({
  quantities:Q,supplierPriceTiers,freightByQuantity,brokerageByQuantity,
  customsDutyRate:n('#duty')===null?null:n('#duty')/100,
  importVatRate:n('#vat')===null?null:n('#vat')/100,
  importVatRecoverable:document.querySelector('#vatRecoverable').checked,
  sellPriceGrossRon:n('#sell'),
  sellerSettings:{vatRate:21,marketplaceRate:n('#marketplace')??17,adsRate:n('#ads')??8,returnsReserveRate:n('#returns')??4,fulfillmentPerUnit:n('#fulfillment')??6}
 });
 document.querySelector('#rows').innerHTML=r.rows.map(x=>x.status==='CALCULATED'?`<tr><td>${x.quantity}</td><td>${x.supplierUnitPriceRon.toFixed(2)}</td><td>${x.freightPerUnitRon.toFixed(2)}</td><td>${x.landedCostPerUnitRon.toFixed(2)}</td><td>${x.capitalRequiredRon.toFixed(2)}</td><td>${x.profitPerUnitRon.toFixed(2)}</td><td>${x.marginPct.toFixed(1)}%</td><td>${x.roiPct.toFixed(1)}%</td><td class="${x.passesTargets?'ok':'warn'}">${x.passesTargets?'PASS':'REVIEW'}</td></tr>`:`<tr><td>${x.quantity}</td><td colspan="7">UNKNOWN: ${x.blockers.join(' · ')}</td><td class="warn">BLOCKED</td></tr>`).join('');
 document.querySelector('#summary').innerHTML=r.recommendation?`<p class="ok"><b>Lot minim care trece pragurile:</b> ${r.recommendation.quantity} buc. · motiv: capital minim cu marjă și ROI conforme.</p><p>Lot cu ROI maxim: <b>${r.bestRoiQuantity??'—'}</b></p>`:'<p class="warn"><b>Niciun lot nu este încă recomandabil.</b> Completează dovezile lipsă sau verifică economia.</p>';
});

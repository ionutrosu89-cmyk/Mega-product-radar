import {targetCostEnvelope} from './rfq-economics-envelope.js';
import {verifySupplierQuote} from './supplier-quote-verifier.js';

const n=v=>Number.isFinite(Number(v))?Number(v):NaN;
const round=v=>Math.round(Number(v)*100)/100;
const text=v=>String(v??'').trim();

function rateFor(currency,rates={}){
  const c=text(currency).toUpperCase();
  if(c==='RON')return 1;
  const r=n(rates[c]);
  return Number.isFinite(r)&&r>0?r:null;
}

export function evaluateQuoteNegotiation(quote={},options={}){
  const verification=verifySupplierQuote(quote);
  const sellPriceRon=n(options.sellPriceRon);
  const target=targetCostEnvelope(sellPriceRon,options.profitSettings||{},options.thresholds||{});
  const base={
    version:'1.0',
    supplierName:text(quote.supplierName),
    verificationStatus:verification.evidenceStatus,
    verified:verification.verified,
    target,
    confirmedLandedCost:false,
    testPermission:false,
    policy:'Negotiation screening only. Direct quoted product + freight cost is not landed cost. Customs, VAT treatment, broker, compliance, insurance, local handling and other import costs remain separate until explicitly confirmed.'
  };

  if(!verification.verified)return{...base,status:'QUOTE_INCOMPLETE',blockers:verification.blockers,action:'Completează oferta înainte de comparația economică.'};
  if(!target.feasible)return{...base,status:'NO_FEASIBLE_ENVELOPE',blockers:[target.blocker||'sell price / commercial envelope'],action:'Nu negocia furnizorul până nu există un preț de vânzare fezabil.'};

  const unitFx=rateFor(quote.currency,options.fxToRon);
  const shippingFx=rateFor(quote.shippingCurrency,options.fxToRon);
  if(!unitFx||!shippingFx)return{...base,status:'FX_REQUIRED',blockers:['explicit FX rate to RON'],action:'Introdu cursurile valutare explicite; nu presupune cursul.'};

  const qty=n(quote.quoteQuantity);
  const unit=n(quote.unitPrice);
  const shipping=n(quote.bulkShippingToRomania);
  if(!(qty>0&&unit>=0&&shipping>=0))return{...base,status:'QUOTE_INCOMPLETE',blockers:['unit price / quote quantity / bulk shipping'],action:'Completează costurile cotate.'};

  const unitProductRon=unit*unitFx;
  const shippingPerUnitRon=shipping*shippingFx/qty;
  const directQuoteCostProxyRon=unitProductRon+shippingPerUnitRon;
  const ceiling=target.maxLandedCostRon;
  const headroomRon=ceiling-directQuoteCostProxyRon;
  const headroomPct=ceiling>0?headroomRon/ceiling*100:null;
  const maxUnitProductRon=Math.max(0,ceiling-shippingPerUnitRon);
  const maxUnitPriceInQuoteCurrency=maxUnitProductRon/unitFx;

  let status='POTENTIALLY_FEASIBLE_PENDING_LANDED_COST';
  let action='Păstrează oferta în shortlist și calculează landed cost complet înainte de TEST.';
  if(headroomRon<0){
    const overPct=Math.abs(headroomRon)/ceiling*100;
    status=overPct<=25?'NEGOTIATE_DOWN':'REJECT_ECONOMICS';
    action=status==='NEGOTIATE_DOWN'
      ?`Negociază prețul produsului spre maximum ${round(maxUnitPriceInQuoteCurrency)} ${text(quote.currency).toUpperCase()} / buc. sau obține transport mai mic.`
      :'Respinge economic în forma actuală; chiar produsul + transportul cotat depășesc plafonul înainte de taxe și alte costuri.';
  }

  return{
    ...base,
    status,
    action,
    quoted:{
      quoteQuantity:qty,
      unitPrice:unit,
      currency:text(quote.currency).toUpperCase(),
      bulkShipping:shipping,
      shippingCurrency:text(quote.shippingCurrency).toUpperCase(),
      unitFxToRon:unitFx,
      shippingFxToRon:shippingFx
    },
    screening:{
      unitProductRon:round(unitProductRon),
      shippingPerUnitRon:round(shippingPerUnitRon),
      directQuoteCostProxyRon:round(directQuoteCostProxyRon),
      maxLandedCostRon:round(ceiling),
      headroomRon:round(headroomRon),
      headroomPct:headroomPct===null?null:round(headroomPct),
      maxUnitPriceInQuoteCurrency:round(maxUnitPriceInQuoteCurrency)
    }
  };
}

export function rankNegotiationQuotes(quotes=[],options={}){
  return quotes.map(q=>evaluateQuoteNegotiation(q,options)).sort((a,b)=>{
    const priority={POTENTIALLY_FEASIBLE_PENDING_LANDED_COST:4,NEGOTIATE_DOWN:3,FX_REQUIRED:2,QUOTE_INCOMPLETE:1,NO_FEASIBLE_ENVELOPE:0,REJECT_ECONOMICS:0};
    const pa=priority[a.status]??0,pb=priority[b.status]??0;
    if(pb!==pa)return pb-pa;
    const ha=Number(a.screening?.headroomRon??-Infinity),hb=Number(b.screening?.headroomRon??-Infinity);
    return hb-ha;
  });
}

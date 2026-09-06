const freeze=v=>Object.freeze(v);

export const MARKET_PROFILES_V1=freeze({
  RO:freeze({
    code:'RO',
    name:'Romania',
    active:true,
    currency:'RON',
    importVatRatePct:21,
    sellVatRatePct:21,
    vatEffectiveFrom:'2025-08-01',
    vatSourceStatus:'CONFIGURED_CURRENT_MARKET',
    customsSourceStatus:'VERIFY_PER_PRODUCT_HS_CN',
    policy:'IMPORT_VAT_RATE_IS_MARKET_CONFIG; CUSTOMS_DUTY_IS NEVER INFERRED FROM COUNTRY ALONE; VERIFY HS/CN AND ORIGIN BEFORE CONFIRMED ECONOMICS.'
  }),
  DE:freeze({code:'DE',name:'Germany',active:false,currency:'EUR',importVatRatePct:null,sellVatRatePct:null,vatSourceStatus:'NEEDS_VERIFICATION_BEFORE_ACTIVATION'}),
  HU:freeze({code:'HU',name:'Hungary',active:false,currency:'HUF',importVatRatePct:null,sellVatRatePct:null,vatSourceStatus:'NEEDS_VERIFICATION_BEFORE_ACTIVATION'}),
  BG:freeze({code:'BG',name:'Bulgaria',active:false,currency:'BGN',importVatRatePct:null,sellVatRatePct:null,vatSourceStatus:'NEEDS_VERIFICATION_BEFORE_ACTIVATION'}),
  PL:freeze({code:'PL',name:'Poland',active:false,currency:'PLN',importVatRatePct:null,sellVatRatePct:null,vatSourceStatus:'NEEDS_VERIFICATION_BEFORE_ACTIVATION'})
});

export function getMarketProfile(code='RO'){
  const key=String(code||'RO').trim().toUpperCase();
  return MARKET_PROFILES_V1[key]||null;
}

export function activeMarketProfile(){
  return MARKET_PROFILES_V1.RO;
}

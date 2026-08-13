export const LEGAL_CONFIG=Object.freeze({
  productName:'Mega Product Radar',
  operatorName:'Red Commerce SRL',
  country:'Romania',
  registeredOffice:'[DE COMPLETAT - sediul social exact]',
  tradeRegister:'[DE COMPLETAT - nr. Registrul Comertului]',
  taxId:'[DE COMPLETAT - CUI/CIF]',
  legalEmail:'[DE COMPLETAT - email juridic/GDPR]',
  supportEmail:'[DE COMPLETAT - email suport]',
  phone:'[DE COMPLETAT - telefon]',
  privacyAuthority:'Autoritatea Nationala de Supraveghere a Prelucrarii Datelor cu Caracter Personal (ANSPDCP)',
  version:'2026-08-13',
  publicPaidLaunchReady:false
});

export const LEGAL_MISSING=Object.entries(LEGAL_CONFIG).filter(([,v])=>String(v).startsWith('[DE COMPLETAT')).map(([k])=>k);

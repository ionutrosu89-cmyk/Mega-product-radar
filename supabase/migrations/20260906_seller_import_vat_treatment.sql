alter table public.seller_preferences
  add column if not exists import_vat_treatment text not null default 'UNKNOWN'
  check (import_vat_treatment in ('UNKNOWN','RECOVERABLE','NON_RECOVERABLE'));

comment on column public.seller_preferences.import_vat_treatment is
  'Seller-selected Romania import VAT economic treatment. UNKNOWN keeps both economics scenarios visible and never assumes deductibility.';

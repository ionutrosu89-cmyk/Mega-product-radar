-- Mega Product Radar · Supplier Evidence Database V4
-- Goal: turn supplier conversations/quotes into structured, comparable, reusable evidence.
-- No purchase decision is implied by storing or verifying supplier evidence.

alter table public.supplier_quotes
  add column if not exists quantity integer,
  add column if not exists goods_total numeric(12,4),
  add column if not exists shipping_total numeric(12,4),
  add column if not exists ddp_total numeric(12,4),
  add column if not exists total_currency text,
  add column if not exists ddp_includes_vat boolean,
  add column if not exists ddp_includes_duty boolean,
  add column if not exists ddp_includes_clearance boolean,
  add column if not exists ddp_includes_final_delivery boolean,
  add column if not exists importer_of_record text,
  add column if not exists buyer_on_customs_docs boolean,
  add column if not exists mrn_promised boolean,
  add column if not exists vat_proof_promised boolean,
  add column if not exists trade_assurance boolean,
  add column if not exists pre_shipment_inspection boolean,
  add column if not exists gross_weight_kg numeric(10,3),
  add column if not exists carton_length_cm numeric(10,2),
  add column if not exists carton_width_cm numeric(10,2),
  add column if not exists carton_height_cm numeric(10,2),
  add column if not exists product_material text,
  add column if not exists max_load_kg numeric(10,2),
  add column if not exists max_desk_thickness_mm numeric(10,2),
  add column if not exists quote_valid_until timestamptz,
  add column if not exists dispatch_lead_time_days integer,
  add column if not exists delivery_lead_time_days integer,
  add column if not exists compliance_status text not null default 'UNKNOWN',
  add column if not exists evidence_status text not null default 'UNVERIFIED',
  add column if not exists raw_evidence_ref text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.supplier_quotes
    add constraint supplier_quotes_quantity_positive check (quantity is null or quantity > 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.supplier_quotes
    add constraint supplier_quotes_evidence_status_check
    check (evidence_status in ('UNVERIFIED','SUPPLIER_STATED','DOCUMENTED','MANUALLY_VERIFIED'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.supplier_quotes
    add constraint supplier_quotes_compliance_status_check
    check (compliance_status in ('UNKNOWN','PENDING_REVIEW','NOT_APPLICABLE_VERIFIED','DOCUMENTED','REJECTED'));
exception when duplicate_object then null; end $$;

create table if not exists public.supplier_quote_evidence (
  id uuid primary key default gen_random_uuid(),
  supplier_quote_id uuid not null references public.supplier_quotes(id) on delete cascade,
  evidence_type text not null,
  stated_at timestamptz not null default now(),
  value_json jsonb not null default '{}'::jsonb,
  evidence_ref text,
  verification_status text not null default 'SUPPLIER_STATED'
    check (verification_status in ('SUPPLIER_STATED','DOCUMENT_RECEIVED','MANUALLY_VERIFIED','REJECTED')),
  verified_at timestamptz,
  verification_note text,
  created_at timestamptz not null default now()
);

create index if not exists supplier_quote_evidence_quote_idx
  on public.supplier_quote_evidence(supplier_quote_id, stated_at desc);
create index if not exists supplier_quotes_product_time_idx
  on public.supplier_quotes(product_id, quoted_at desc);

alter table public.supplier_quote_evidence enable row level security;
revoke all on table public.supplier_quote_evidence from anon, authenticated;

create or replace view public.supplier_quote_comparison_v4
with (security_invoker = true)
as
select
  q.id as quote_id,
  q.product_id,
  q.supplier_id,
  q.quoted_at,
  q.quantity,
  q.unit_price,
  q.currency,
  q.goods_total,
  q.shipping_total,
  q.ddp_total,
  coalesce(q.total_currency, q.currency) as total_currency,
  case when q.quantity > 0 and q.ddp_total is not null then q.ddp_total / q.quantity end as ddp_per_unit,
  q.incoterm,
  q.ddp_includes_vat,
  q.ddp_includes_duty,
  q.ddp_includes_clearance,
  q.ddp_includes_final_delivery,
  q.importer_of_record,
  q.buyer_on_customs_docs,
  q.mrn_promised,
  q.vat_proof_promised,
  q.trade_assurance,
  q.pre_shipment_inspection,
  q.dispatch_lead_time_days,
  q.delivery_lead_time_days,
  q.gross_weight_kg,
  q.carton_length_cm,
  q.carton_width_cm,
  q.carton_height_cm,
  q.product_material,
  q.compliance_status,
  q.evidence_status,
  q.confidence,
  q.raw_evidence_ref
from public.supplier_quotes q;

revoke all on public.supplier_quote_comparison_v4 from anon, authenticated;

comment on table public.supplier_quote_evidence is
'Append-only evidence ledger for supplier claims, documents and manual verification. Evidence storage never implies TEST_READY or BUY_READY.';
comment on view public.supplier_quote_comparison_v4 is
'Server-side comparison surface for supplier quotes. DDP/unit is derived only when quoted DDP total and quantity are present.';

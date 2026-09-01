-- MPR Importability Review Readiness V1
-- Evidence completeness only. It does not approve/reject products and cannot create FINALIST/BUY authority.

create or replace view public.importability_review_readiness_v1 as
select q.product_id,q.canonical_key,q.title,q.brand,q.category,
       q.importability_class,q.importability_reason,q.required_evidence,q.review_delta,
       q.evidence_records,q.dimensions_records,q.weight_records,q.material_records,
       q.certification_records,q.brand_variant_records,q.human_verified_records,q.latest_evidence_at,
       case
         when q.importability_class='REVIEW_BULKY' and q.dimensions_records>0 and q.weight_records>0 then true
         when q.importability_class='REVIEW_FRAGILITY' and q.material_records>0 and q.dimensions_records>0 then true
         when q.importability_class='REVIEW_BRAND_VARIANT' and q.brand_variant_records>0 then true
         else false end as minimum_evidence_present,
       case
         when q.human_verified_records>0 then 'HUMAN_DECISION_ALREADY_RECORDED'
         when q.importability_class='REVIEW_BULKY' and q.dimensions_records>0 and q.weight_records>0 then 'READY_FOR_HUMAN_IMPORTABILITY_REVIEW'
         when q.importability_class='REVIEW_FRAGILITY' and q.material_records>0 and q.dimensions_records>0 then 'READY_FOR_HUMAN_IMPORTABILITY_REVIEW'
         when q.importability_class='REVIEW_BRAND_VARIANT' and q.brand_variant_records>0 then 'READY_FOR_HUMAN_IMPORTABILITY_REVIEW'
         else 'MISSING_REQUIRED_EVIDENCE' end as review_readiness,
       case
         when q.importability_class='REVIEW_BULKY' then array_remove(array[
           case when q.dimensions_records=0 then 'DIMENSIONS' end,
           case when q.weight_records=0 then 'WEIGHT' end],null)
         when q.importability_class='REVIEW_FRAGILITY' then array_remove(array[
           case when q.material_records=0 then 'MATERIAL' end,
           case when q.dimensions_records=0 then 'DIMENSIONS' end],null)
         when q.importability_class='REVIEW_BRAND_VARIANT' then array_remove(array[
           case when q.brand_variant_records=0 then 'BRAND_VARIANT' end],null)
         else q.required_evidence end as missing_evidence,
       false as importability_approved,
       false as finalist_authorized,
       false as purchase_authorized
from public.importability_evidence_queue_v1 q
order by minimum_evidence_present desc,coalesce(q.review_delta,0) desc,q.canonical_key;

revoke all on public.importability_review_readiness_v1 from anon, authenticated;
comment on view public.importability_review_readiness_v1 is 'Evidence completeness queue for human importability review. READY means evidence is present, never that importability is approved.';

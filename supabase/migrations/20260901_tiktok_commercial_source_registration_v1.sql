insert into public.viral_discovery_sources_v1(source_key,platform,access_mode,terms_review_status,enabled)
values('TIKTOK_COMMERCIAL_CONTENT_API','TIKTOK','OFFICIAL_API','REVIEW_REQUIRED',false)
on conflict(source_key) do update set access_mode='OFFICIAL_API';

update public.viral_discovery_sources_v1 set terms_review_status='BLOCKED',enabled=false
where source_key='TIKTOK_CREATIVE_CENTER' and access_mode='PUBLIC_PAGE';

comment on table public.viral_discovery_sources_v1 is 'Only explicitly approved official/export/manual routes may be enabled. TikTok public-page scraping is blocked; Commercial Content API is the intended route.';

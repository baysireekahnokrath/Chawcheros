-- ============================================================================
-- 0030 · แบรนด์ที่ใช้ในโมดูลคอนเทนต์ · ลำดับ · แบรนด์ตั้งต้น (Bay ขอ 2026-09-23)
-- ============================================================================
-- "default selection ที่แบรนด์ ฌ เฌอ · ตัด Bareo ออก"
-- ซ่อนเฉพาะในโมดูลคอนเทนต์ · แบรนด์ยังอยู่ในแคตตาล็อกตามเดิม (โมดูลอื่นไม่กระทบ)
-- ============================================================================
create table content.brand_prefs (
  brand_id    uuid primary key references catalog.brands(id),
  in_content  boolean not null default true,
  is_default  boolean not null default false,
  sort_order  int not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references core.app_users(id)
);
create unique index brand_prefs_one_default on content.brand_prefs (is_default) where is_default;
comment on table content.brand_prefs is 'แบรนด์ไหนโชว์ในโมดูลคอนเทนต์ · แบรนด์ตั้งต้น · ลำดับ · ไม่มีแถว = โชว์ต่อท้าย';

insert into content.brand_prefs (brand_id, in_content, is_default, sort_order)
select id,
       name <> 'Bareo',
       name = 'ฌ เฌอ',
       case name when 'ฌ เฌอ' then 1 when 'HOF' then 2 else 100 end
  from catalog.brands;

select core.apply_standard_rules('content.brand_prefs');
alter table content.brand_prefs enable row level security;
create policy brand_prefs_select on content.brand_prefs for select to authenticated using (core.is_staff());
create policy brand_prefs_write on content.brand_prefs for all to authenticated
  using (core.has_capability('admin')) with check (core.has_capability('admin'));
grant select, insert, update on content.brand_prefs to authenticated;

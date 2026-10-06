-- ============================================================================
-- 0027 · โมดูลคอนเทนต์ เฟส 1 · รอบ R5 หน้าแรก (Dashboard)
-- ============================================================================
-- ที่มา: docs/modules/content/2-requirements.md หมวด ก5 · Bay เลือก ⭐ 2026-09-23
--
--   H16  แฟ้มคู่แข่ง · ทีมแปะลิงก์ + ข้อความที่เห็น · agent สรุปว่าเล่นเรื่องอะไร hook แบบไหน
--        (โพสต์ปกติของคู่แข่งดึงอัตโนมัติไม่ได้ ผิดเงื่อนไข Facebook/IG · คนแปะเอง)
--   H19  ไอเดียจาก agent สัปดาห์นี้ · 3 ไอเดีย · แตะ "เอา" = ไปหน้าไอเดียด่วนพร้อมข้อความ
--   ที่เหลือ (H1–H6 H9 H10 @ถึงฉัน) ใช้ข้อมูลที่มีแล้ว ไม่ต้องมีตารางใหม่
-- ============================================================================

-- ---------------------------------------------------------------------------
-- งาน AI ประเภทใหม่
-- ---------------------------------------------------------------------------
alter table content.ai_requests drop constraint ai_requests_kind_check;
alter table content.ai_requests add constraint ai_requests_kind_check
  check (kind in ('เขียนข้อความ', 'ไอเดียด่วน', 'สัมภาษณ์', 'แชท @AI', 'สรุปคู่แข่ง', 'คิดไอเดีย'));

-- ---------------------------------------------------------------------------
-- ★ แฟ้มคู่แข่ง (H16)
-- ---------------------------------------------------------------------------
create table content.swipes (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid references catalog.brands(id),
  url          text not null check (url ~ '^https?://'),
  competitor   text,
  seen_text    text,
  note         text,
  summary      text,
  hook_type    text,
  request_id   uuid references content.ai_requests(id),
  archived_at  timestamptz,
  created_by   uuid references core.app_users(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references core.app_users(id)
);
create index on content.swipes (created_at desc) where archived_at is null;
comment on table content.swipes is 'แฟ้มคู่แข่ง · ทีมแปะลิงก์และข้อความที่เห็น · agent สรุป · เก็บเข้าลิ้นชักด้วย archived_at (A7)';
comment on column content.swipes.brand_id is 'ใช้เทียบกับแบรนด์ไหน · ว่าง = ทุกแบรนด์';
comment on column content.swipes.seen_text is 'ข้อความ/แคปชันที่เห็นในโพสต์ · agent เปิดลิงก์ Facebook/IG เองไม่ได้ จึงสรุปจากตรงนี้';

-- ---------------------------------------------------------------------------
-- ★ ไอเดียที่ agent เสนอ (H19)
-- ---------------------------------------------------------------------------
create table content.idea_suggestions (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references catalog.brands(id),
  week_of      date not null,
  title        text not null,
  hook         text,
  reason       text,
  product_ids  uuid[] not null default '{}',
  status       text not null default 'เสนอ' check (status in ('เสนอ', 'เอา', 'ไม่เอา')),
  request_id   uuid references content.ai_requests(id),
  decided_by   uuid references core.app_users(id),
  decided_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references core.app_users(id)
);
create index on content.idea_suggestions (week_of desc);
comment on table content.idea_suggestions is 'ไอเดียที่ agent คิดให้รายสัปดาห์ · จากสินค้าที่ไม่ได้พูดถึง + แฟ้มคู่แข่ง + brand model';

create or replace function content.stamp_idea_decision()
returns trigger
language plpgsql
set search_path = content, public
as $$
begin
  if new.status is distinct from old.status and new.status <> 'เสนอ' then
    new.decided_at := now(); new.decided_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger stamp_idea_decision before update on content.idea_suggestions
  for each row execute function content.stamp_idea_decision();

-- ---------------------------------------------------------------------------
-- กฎเหล็ก + RLS · ทีมคอนเทนต์อ่านและเขียนได้ทั้งคู่
-- ---------------------------------------------------------------------------
select core.apply_standard_rules('content.swipes');
select core.apply_standard_rules('content.idea_suggestions');

alter table content.swipes           enable row level security;
alter table content.idea_suggestions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['swipes', 'idea_suggestions'] loop
    execute format(
      'create policy %I on content.%I for select to authenticated using ('
      'core.has_capability(''marketing.write'') or core.has_capability(''design.write'') '
      'or core.has_capability(''content.approve'') or core.has_capability(''admin''))', t || '_select', t);
    execute format(
      'create policy %I on content.%I for all to authenticated using ('
      'core.has_capability(''marketing.write'') or core.has_capability(''content.approve'') or core.has_capability(''admin'')) '
      'with check (core.has_capability(''marketing.write'') or core.has_capability(''content.approve'') or core.has_capability(''admin''))',
      t || '_write', t);
  end loop;
end $$;

grant select, insert, update on content.swipes, content.idea_suggestions to authenticated;
revoke all on function content.stamp_idea_decision() from public, anon, authenticated;

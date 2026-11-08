-- ============================================================================
-- 0041 · นับคนมาถึงโชว์รูม จากข้อความ LINE @chawcher
-- ============================================================================
-- ที่มา: docs/modules/showroom-page/0-idea.md (ป้าย A4 · 2026-11-08)
--   ป้ายในโชว์รูมมี QR → เปิดแชท @chawcher พร้อมข้อความ "สวัสดี มาถึงโชว์รูมแล้ว" → ลูกค้ากดส่ง
--   friend path ของ LINE นับแค่เพื่อนใหม่ · คนที่นัดผ่าน LINE มาแล้วไม่ถูกนับ
--   → ระบบเรานับจากข้อความแทน ได้ทั้งเพื่อนใหม่และเพื่อนเดิม
--
-- หลักที่ไฟล์นี้บังคับ
--   OA-1  เก็บ "เฉพาะข้อความที่แจ้งมาถึง" · แชทอื่นของลูกค้าไม่เข้าฐานข้อมูลเลย (PDPA · คัดตั้งแต่ webhook)
--   OA-2  webhook ซ้ำ = นับครั้งเดียว (webhook_event_id unique)
--   OA-3  คนเดียวส่งซ้ำในวันเดียว = นับ 1 คน (นับที่ view · แถวเก็บไว้ครบ)
--   OA-4  ห้ามลบ (A7) · ข้อความทดสอบ/ส่งผิด → ติ๊ก "ไม่นับ" แทน
--   OA-5  webhook (service role) ไม่ได้สิทธิ์ตารางใดๆ · เรียกได้แค่ record_arrival()
-- ============================================================================

create schema if not exists line_oa;

create table line_oa.arrivals (
  id                uuid primary key default gen_random_uuid(),
  webhook_event_id  text not null unique,                              -- OA-2
  line_user_id      text not null check (btrim(line_user_id) <> ''),
  display_name      text,
  message           text not null,
  booking_code      text,                                              -- เช่น CC-4821 ถ้ามีในข้อความ (นัดจากเว็บ · เฟสถัดไป)
  arrived_at        timestamptz not null,
  arrived_on        date not null,                                     -- วันตามเวลาไทย
  counted           boolean not null default true,                     -- OA-4
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references core.app_users(id)
);
create index on line_oa.arrivals (arrived_on desc);
create index on line_oa.arrivals (line_user_id, arrived_on);
comment on table line_oa.arrivals is
  'คนแจ้งมาถึงโชว์รูมทาง LINE @chawcher · เก็บเฉพาะข้อความแจ้งมาถึง (OA-1) · ห้ามลบ ใช้ counted=false แทน';

-- ห้ามลบ (A7)
create or replace function line_oa.no_delete() returns trigger language plpgsql as $$
begin
  raise exception 'ห้ามลบบันทึกการมาโชว์รูม · ติ๊ก "ไม่นับ" แทน (A7)';
end $$;
create trigger arrivals_no_delete before delete on line_oa.arrivals
  for each row execute function line_oa.no_delete();

-- แก้ได้แค่ counted / note · ข้อมูลจาก LINE ห้ามแก้
create or replace function line_oa.guard_update() returns trigger language plpgsql as $$
begin
  if (new.webhook_event_id, new.line_user_id, new.message, new.arrived_at, new.arrived_on)
     is distinct from (old.webhook_event_id, old.line_user_id, old.message, old.arrived_at, old.arrived_on) then
    raise exception 'แก้ได้แค่ "นับ/ไม่นับ" และหมายเหตุ · ข้อมูลจาก LINE ห้ามแก้';
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), old.updated_by);
  return new;
end $$;
create trigger arrivals_guard before update on line_oa.arrivals
  for each row execute function line_oa.guard_update();

-- ---------------------------------------------------------------------------
-- ประตูเดียวของ webhook · คืน true = บันทึกใหม่ · false = เคยบันทึกแล้ว (LINE ส่งซ้ำ)
-- ---------------------------------------------------------------------------
create or replace function line_oa.record_arrival(
  p_event_id text, p_user_id text, p_message text, p_at timestamptz, p_display_name text default null)
returns boolean
language plpgsql security definer
set search_path = line_oa, public
as $$
declare v_id uuid;
begin
  insert into line_oa.arrivals
    (webhook_event_id, line_user_id, display_name, message, booking_code, arrived_at, arrived_on)
  values (
    p_event_id, p_user_id, nullif(btrim(p_display_name), ''), left(p_message, 500),
    upper((regexp_match(p_message, '(?i)\m(CC-\d{4,6})\M'))[1]),
    p_at, (p_at at time zone 'Asia/Bangkok')::date)
  on conflict (webhook_event_id) do nothing
  returning id into v_id;
  return v_id is not null;
end $$;

-- ---------------------------------------------------------------------------
-- สรุปรายวัน · คนเดียวส่งหลายครั้งในวันเดียว = 1 คน (OA-3)
-- ---------------------------------------------------------------------------
create view line_oa.v_daily with (security_invoker = true) as
select arrived_on,
       count(distinct line_user_id) filter (where counted)                         as people,
       count(*) filter (where counted)                                             as messages,
       count(distinct line_user_id) filter (where counted and booking_code is not null) as with_code
from line_oa.arrivals
group by arrived_on;

-- ---------------------------------------------------------------------------
-- สิทธิ์ · อ่าน/ติ๊ก "ไม่นับ" = admin (Bay) · webhook = ฟังก์ชันเดียว
-- ---------------------------------------------------------------------------
alter table line_oa.arrivals enable row level security;
create policy arrivals_admin_read on line_oa.arrivals for select to authenticated
  using (core.has_capability('admin'));
create policy arrivals_admin_mark on line_oa.arrivals for update to authenticated
  using (core.has_capability('admin')) with check (core.has_capability('admin'));

grant usage on schema line_oa to authenticated, service_role;
grant select, update (counted, note) on line_oa.arrivals to authenticated;
grant select on line_oa.v_daily to authenticated;

revoke all on all functions in schema line_oa from public, anon, authenticated;
grant execute on function line_oa.record_arrival(text, text, text, timestamptz, text) to service_role;

-- ---------------------------------------------------------------------------
-- ทะเบียนโมดูล
-- ---------------------------------------------------------------------------
insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability,
   home_path, sort_order, is_core, description_th) values
  ('line_oa', 'มาโชว์รูม', 'Showroom arrivals', 'map-pin', 'line_oa',
   '{core}', 'admin', '/arrivals', 92, false,
   'นับคนแจ้งมาถึงโชว์รูมทาง LINE @chawcher (สแกนป้าย A4)');

-- ★ ต่อจาก 0039 · ค่านี้เขียนทับทั้งก้อน ต้องมีทุก schema เดิมด้วย
alter role authenticator
  set pgrst.db_schemas = 'public, graphql_public, core, catalog, materials, pricing, cost, marketing, stock, content, crm, sales, line_agent, sheets, pos, production, line_oa';

notify pgrst, 'reload config';

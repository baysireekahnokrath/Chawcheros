-- ============================================================================
-- 0001 · รากฐาน — ผู้ใช้ สิทธิ์ ประวัติการแก้ และกฎเหล็กของระบบ
-- ============================================================================
-- กฎที่ไฟล์นี้บังคับใช้จริงในฐานข้อมูล ไม่ใช่แค่เขียนไว้เฉยๆ:
--   A7  ห้าม DELETE ข้อมูลใดๆ  →  trigger ดักไว้ทุกตาราง
--   A10 ตัวเลขคำนวณได้ ห้ามเก็บ →  ใช้ generated column / view เท่านั้น
--   A6  ต้นทุนเห็นได้เฉพาะเจ้าของ → RLS ระดับฐานข้อมูล ไม่ใช่แค่ซ่อนปุ่ม
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- กฎเหล็กข้อ A7 · ห้ามลบ
-- ---------------------------------------------------------------------------
create or replace function prevent_delete()
returns trigger language plpgsql as $$
begin
  raise exception
    'ห้ามลบข้อมูลในตาราง % — ให้เปลี่ยน status แทน (กฎ A7)', tg_table_name
    using errcode = 'restrict_violation';
end;
$$;

comment on function prevent_delete() is
  'ดักทุก DELETE แล้วโยน error — เลิกขาย/ยกเลิก ต้องเปลี่ยน status ไม่ใช่ลบทิ้ง';

-- ช่วยติด trigger ห้ามลบ + updated_at ให้ตารางใดตารางหนึ่ง
create or replace function apply_standard_rules(p_table regclass)
returns void language plpgsql as $$
begin
  execute format(
    'create trigger %I before delete on %s for each row execute function prevent_delete()',
    'no_delete_' || replace(p_table::text, '.', '_'), p_table);
  execute format(
    'create trigger %I before update on %s for each row execute function touch_updated_at()',
    'touch_' || replace(p_table::text, '.', '_'), p_table);
end;
$$;

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- ผู้ใช้
-- ---------------------------------------------------------------------------
create type user_status as enum ('ใช้งาน', 'ระงับ', 'ลาออก');

create table app_users (
  id          uuid primary key references auth.users(id) on delete restrict,
  email       text not null unique,
  full_name   text not null,
  status      user_status not null default 'ใช้งาน',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
comment on table app_users is '1 แถว = พนักงาน 1 คน · ล็อกอินด้วย email (กฎ B34)';

-- ---------------------------------------------------------------------------
-- สิทธิ์ · ออกแบบเป็น "ความสามารถ" ที่ประกอบกันได้ ไม่ใช่ "ตำแหน่ง" ตายตัว
-- เพราะคำตอบ H1: บางคนทำหลายแผนก บางแผนกมีคนเดียว
-- ---------------------------------------------------------------------------
create type capability as enum (
  'products.read',    -- ดูสินค้า ราคา ผ้า
  'products.write',   -- เพิ่ม/แก้สินค้า ออก SKU
  'stock.read',       -- ดูว่าของอยู่ไหน
  'stock.write',      -- สแกน ย้ายของ ตำหนิ ยืม-คืน
  'purchase.write',   -- ใบสั่งซื้อ รับของเข้า สร้างล็อต
  'sales.write',      -- lead นัด ใบเสนอราคา ออเดอร์
  'cs.write',         -- บันทึกข้อสรุปการคุย เคส
  'marketing.write',  -- แคมเปญ โปรโมชัน
  'design.write',     -- งานกราฟิก
  'delivery.write',   -- นัดส่ง ติดตาม
  'finance.write',    -- ยืนยันเงินเข้า ค่าใช้จ่าย
  'cost.read',        -- 🔒 ต้นทุนและกำไร — เจ้าของเท่านั้น
  'admin'             -- จัดการผู้ใช้ อนุมัติ
);

create table user_capabilities (
  user_id     uuid not null references app_users(id),
  capability  capability not null,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references app_users(id),
  revoked_at  timestamptz,                  -- เพิกถอน = ใส่วันที่ ไม่ใช่ลบแถว (A7)
  primary key (user_id, capability)
);
comment on table user_capabilities is
  '1 แถว = คน 1 คน ถือความสามารถ 1 อย่าง · คนหนึ่งถือได้หลายอย่างพร้อมกัน';

-- เช็คสิทธิ์ · ใช้ใน RLS ทุกตาราง
create or replace function has_capability(p_cap capability)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_capabilities uc
    join app_users u on u.id = uc.user_id
    where uc.user_id    = auth.uid()
      and uc.capability = p_cap
      and uc.revoked_at is null
      and u.status      = 'ใช้งาน'
  );
$$;

-- ---------------------------------------------------------------------------
-- ประวัติการแก้ · จำเป็นเพราะห้ามลบ ต้องรู้ว่าใครเปลี่ยนอะไร
-- ---------------------------------------------------------------------------
create table audit_log (
  id          bigserial primary key,
  table_name  text not null,
  row_id      text not null,
  action      text not null check (action in ('INSERT', 'UPDATE')),
  changed_by  uuid references app_users(id),
  changed_at  timestamptz not null default now(),
  before      jsonb,
  after       jsonb
);
create index on audit_log (table_name, row_id, changed_at desc);
create index on audit_log (changed_by, changed_at desc);

create or replace function write_audit()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into audit_log (table_name, row_id, action, changed_by, before, after)
  values (
    tg_table_name,
    coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id')),
    tg_op,
    auth.uid(),
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new)
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table app_users         enable row level security;
alter table user_capabilities enable row level security;
alter table audit_log         enable row level security;

-- ทุกคนที่ล็อกอิน เห็นรายชื่อเพื่อนร่วมงานได้
create policy app_users_select on app_users
  for select to authenticated using (true);

-- เฉพาะ admin แก้ผู้ใช้ได้
create policy app_users_update on app_users
  for update to authenticated using (has_capability('admin'));

-- เห็นสิทธิ์ของตัวเอง หรือเป็น admin เห็นทั้งหมด
create policy user_caps_select on user_capabilities
  for select to authenticated
  using (user_id = auth.uid() or has_capability('admin'));

-- เฉพาะ admin ให้หรือเพิกถอนสิทธิ์
create policy user_caps_write on user_capabilities
  for all to authenticated
  using (has_capability('admin')) with check (has_capability('admin'));

-- เฉพาะ admin อ่านประวัติการแก้
create policy audit_log_select on audit_log
  for select to authenticated using (has_capability('admin'));

-- ห้ามลบ + updated_at
do $$ begin
  perform apply_standard_rules('app_users');
end $$;

create trigger no_delete_user_capabilities before delete on user_capabilities
  for each row execute function prevent_delete();
create trigger no_delete_audit_log before delete on audit_log
  for each row execute function prevent_delete();

create trigger audit_app_users after insert or update on app_users
  for each row execute function write_audit();

-- ============================================================================
-- 0008 · รื้อเป็นโมดูล — แยก schema ต่อโมดูล + ทะเบียนโมดูล
-- ============================================================================
-- ทำตอนนี้เพราะข้อมูลธุรกิจยังเป็น 0 แถว · รื้อทีหลังต้องย้ายข้อมูลจริงด้วย
--
-- กฎของโมดูล:
--   1. โมดูลหนึ่ง = 1 Postgres schema · เป็นเจ้าของตารางในนั้นคนเดียว
--   2. โมดูลอื่น "ห้ามแตะตาราง" ของโมดูลนี้ — เรียกได้แค่ฟังก์ชัน/view ที่เปิดให้
--   3. ห้ามพึ่งกันเป็นวงกลม — ลูกศรต้องไปทางเดียว
--
--   core ──► catalog ──► pricing
--     └────► materials    └────► cost 🔒
-- ============================================================================

create schema if not exists core;       -- ผู้ใช้ สิทธิ์ ประวัติ ทะเบียนโมดูล
create schema if not exists catalog;    -- สินค้า รุ่น SKU
create schema if not exists materials;  -- ผ้า หนัง (ป้อนหน้าเว็บ material-list)
create schema if not exists pricing;    -- ราคา ส่วนลด
create schema if not exists cost;       -- 🔒 ต้นทุน เจ้าของเท่านั้น

comment on schema core      is 'แกนกลาง · ทุกโมดูลพึ่งอันนี้ · ปิดไม่ได้';
comment on schema catalog   is 'สินค้า · ไม่พึ่งโมดูลอื่นนอกจาก core';
comment on schema materials is 'ผ้า/หนัง · ต้นทางของหน้าเว็บ material-list';
comment on schema pricing   is 'ราคาและส่วนลด · การตลาดแก้ส่วนลดได้';
comment on schema cost      is '🔒 ต้นทุนและกำไร · เจ้าของเท่านั้น';

-- ---------------------------------------------------------------------------
-- ย้ายตารางเข้าโมดูล
-- ---------------------------------------------------------------------------
alter table public.app_users            set schema core;
alter table public.user_capabilities    set schema core;
alter table public.audit_log            set schema core;

alter table public.brands               set schema catalog;
alter table public.categories           set schema catalog;
alter table public.products             set schema catalog;
alter table public.product_variants     set schema catalog;
alter table public.sku_registry         set schema catalog;

alter table public.material_collections   set schema materials;
alter table public.material_features      set schema materials;
alter table public.materials              set schema materials;
alter table public.material_feature_links set schema materials;

alter table public.vat_rates             set schema pricing;
alter table public.variant_prices        set schema pricing;
alter table public.discount_rules        set schema pricing;
alter table public.payment_discounts     set schema pricing;
alter table public.volume_discount_tiers set schema pricing;

alter table public.variant_costs   set schema cost;
alter table public.material_costs  set schema cost;

-- ย้าย view ไปอยู่กับโมดูลเจ้าของ
alter view public.v_variant_price            set schema pricing;
alter view public.v_variant_margin           set schema cost;
alter view public.v_material_list_public     set schema materials;
alter view public.v_variant_material_options set schema materials;

-- ย้ายชนิดข้อมูล
alter type public.user_status      set schema core;
alter type public.capability       set schema core;
alter type public.lifecycle_status set schema core;
alter type public.material_status  set schema materials;
alter type public.discount_scope   set schema pricing;

-- ---------------------------------------------------------------------------
-- ย้ายฟังก์ชัน + แก้ search_path ให้มองเห็นทุกโมดูล
-- ---------------------------------------------------------------------------
-- search_path เป็นแค่การ "หาชื่อ" ภายในฟังก์ชันที่เราเขียนเอง
-- เส้นแบ่งจริงระหว่างโมดูลคือ GRANT ด้านล่าง ไม่ใช่ search_path
alter function public.prevent_delete()               set schema core;
alter function public.touch_updated_at()             set schema core;
alter function public.apply_standard_rules(regclass) set schema core;
alter function public.write_audit()                  set schema core;
alter function public.has_capability(core.capability) set schema core;

alter function public.sku_check_digit(text) set schema catalog;
alter function public.sku_is_valid(text)    set schema catalog;
alter function public.sku_display(text)     set schema catalog;
alter function public.mint_sku(text)        set schema catalog;
alter function public.freeze_sku()          set schema catalog;
alter function public.freeze_sku_registry() set schema catalog;

alter function public.vat_rate(date)                              set schema pricing;
alter function public.discount_specificity(pricing.discount_scope) set schema pricing;
alter function public.current_discount_percent(uuid, date)        set schema pricing;
alter function public.volume_extra_percent(numeric, date)         set schema pricing;

do $$
declare f record;
begin
  for f in
    select n.nspname as sch, p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('core','catalog','materials','pricing','cost')
  loop
    execute format(
      'alter function %s set search_path = core, catalog, materials, pricing, cost, public',
      f.sig);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- ทะเบียนโมดูล · App Launcher กับสวิตช์เปิด/ปิด อ่านจากตารางนี้
-- ---------------------------------------------------------------------------
create table core.modules (
  id                    text primary key,
  name_th               text not null,
  name_en               text not null,
  icon                  text not null,
  db_schema             text,
  depends_on            text[] not null default '{}',
  required_capability   core.capability,
  home_path             text,
  sort_order            int not null default 0,
  is_enabled            boolean not null default true,
  is_core               boolean not null default false,
  description_th        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references core.app_users(id)
);

comment on table core.modules is
  'ทะเบียนโมดูล · เมนูและ App Launcher สร้างตัวเองจากตารางนี้ '
  'เพิ่มโมดูลใหม่ = เพิ่ม 1 แถว ไม่ต้องไปแก้เมนูที่ไหน';
comment on column core.modules.is_enabled is
  'สวิตช์เปิด/ปิดโมดูล · ปิดแล้วหายจากเมนูทันที แต่ข้อมูลยังอยู่ครบ';
comment on column core.modules.is_core is
  'true = ปิดไม่ได้ เพราะโมดูลอื่นพังหมด';

-- ปิดโมดูลแกนกลางไม่ได้
create or replace function core.guard_core_module()
returns trigger language plpgsql as $$
begin
  if old.is_core and not new.is_enabled then
    raise exception 'โมดูล "%" เป็นแกนกลาง ปิดไม่ได้', old.name_th
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
create trigger guard_core_module before update on core.modules
  for each row execute function core.guard_core_module();

-- ปิดโมดูลที่มีคนอื่นพึ่งอยู่ไม่ได้
create or replace function core.guard_module_dependents()
returns trigger language plpgsql as $$
declare dependents text;
begin
  if old.is_enabled and not new.is_enabled then
    select string_agg(name_th, ', ') into dependents
    from core.modules
    where is_enabled and old.id = any(depends_on) and id <> old.id;
    if dependents is not null then
      raise exception 'ปิดโมดูล "%" ไม่ได้ เพราะ % ยังพึ่งอยู่', old.name_th, dependents
        using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_module_dependents before update on core.modules
  for each row execute function core.guard_module_dependents();

insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability,
   home_path, sort_order, is_core, description_th) values
  ('core',      'ตั้งค่าระบบ', 'System',    'settings', 'core',      '{}',                    'admin',
   '/settings',  99, true,  'ผู้ใช้ สิทธิ์ ประวัติการแก้ ทะเบียนโมดูล'),
  ('catalog',   'สินค้า',     'Catalog',   'package',  'catalog',   '{core}',                'products.read',
   '/catalog',    1, false, 'รุ่น ตัวที่ขายจริง SKU'),
  ('materials', 'คลังผ้า',    'Materials', 'layers',   'materials', '{core,catalog}',        'products.read',
   '/materials',  2, false, 'ผ้า หนัง · ป้อนหน้าเว็บ material-list'),
  ('pricing',   'ราคา',       'Pricing',   'tag',      'pricing',   '{core,catalog}',        'products.read',
   '/pricing',    3, false, 'ราคาตั้ง ส่วนลดปกติ ส่วนลดขั้นบันได'),
  ('cost',      'ต้นทุน',     'Cost',      'lock',     'cost',      '{core,catalog,pricing}','cost.read',
   '/cost',       4, false, '🔒 ต้นทุนและกำไร เจ้าของเท่านั้น');

-- ---------------------------------------------------------------------------
-- GRANT · นี่คือเส้นแบ่งจริงของโมดูล ไม่ใช่แค่จัดโฟลเดอร์
-- ---------------------------------------------------------------------------
do $$
declare s text;
begin
  foreach s in array array['core','catalog','materials','pricing','cost'] loop
    execute format('grant usage on schema %I to authenticated, service_role', s);
    execute format('grant select, insert, update on all tables in schema %I to authenticated', s);
    execute format('grant usage, select on all sequences in schema %I to authenticated', s);
    -- ห้ามลบ ตั้งแต่ระดับสิทธิ์ ไม่ใช่แค่ trigger ดัก
    execute format('revoke delete on all tables in schema %I from authenticated, anon', s);
    -- anon ไม่มีสิทธิ์อะไรเลยในทุกโมดูล
    execute format('revoke all on all tables in schema %I from anon', s);
    execute format('revoke all on schema %I from anon', s);
  end loop;
end;
$$;

alter table core.modules enable row level security;
create policy modules_select on core.modules
  for select to authenticated using (true);
create policy modules_update on core.modules
  for update to authenticated using (core.has_capability('admin'));
create trigger no_delete_modules before delete on core.modules
  for each row execute function core.prevent_delete();
create trigger touch_modules before update on core.modules
  for each row execute function core.touch_updated_at();

-- ---------------------------------------------------------------------------
-- public ต้องว่าง · ถ้ามีตารางโผล่มาใน public แปลว่ามีคนลืมใส่โมดูล
-- ---------------------------------------------------------------------------
comment on schema public is
  'ต้องว่างเสมอ · ทุกตารางต้องอยู่ในโมดูล ถ้าเห็นตารางที่นี่ แปลว่าลืมกำหนดเจ้าของ';

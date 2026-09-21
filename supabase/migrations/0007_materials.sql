-- ============================================================================
-- 0007 · คลังวัสดุ (ผ้า/หนัง) — ต้นทางของหน้าเว็บ material-list
-- ============================================================================
-- โครงสร้างยืนยันจากหน้าเว็บจริง chawcher.com/design/material-list/ :
--   Fabric A  — The Timeless Essentials
--   Fabric B  — The Curated Fashion
--   Fabric C  — The Italian Craftsmanship   (ลายสก็อต/ตาราง)
--   Premium Leather
--
-- กฎจาก Bay (J2): "ทุกครั้งที่มีการ update หน้านี้ควร update ด้วย
--                  เช่น ผ้าหมด ผ้าเลิกผลิต เราไม่สั่งผ้านี้มาอีกแล้ว"
--   → ตารางนี้เป็น "ต้นทาง" หน้าเว็บดึงไปแสดง ไม่ใช่คนไปแก้หน้าเว็บเอง
--
-- กฎจาก Bay (J1): "เลือกสีได้" = เลือกผ้าอะไรก็ได้ที่อยู่ในประเภทนั้น
--   → SKU ผูกกับ "เกรด" · ลูกค้าเลือก "ผ้าตัวไหนในเกรดนั้น" ตอนสั่ง
-- ============================================================================

-- ---------------------------------------------------------------------------
-- สถานะวัสดุ · ตัวนี้แหละที่ทำให้หน้าเว็บอัปเดตเองได้
-- ---------------------------------------------------------------------------
create type material_status as enum (
  'มีของ',
  'ใกล้หมด',
  'หมดชั่วคราว',
  'เลิกผลิต',        -- โรงงานไม่ทำแล้ว
  'ไม่สั่งมาอีกแล้ว'  -- เราตัดสินใจเลิกสั่งเอง
);

comment on type material_status is
  'มีของ/ใกล้หมด = ขึ้นเว็บได้ · ที่เหลือ = ซ่อนจากหน้าเว็บ แต่ยังอยู่ในระบบ (กฎ A7 ห้ามลบ)';

-- ---------------------------------------------------------------------------
-- กลุ่มวัสดุ · 4 กลุ่มตามหน้าเว็บ
-- ---------------------------------------------------------------------------
create table material_collections (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,        -- 'A' · 'B' · 'C' · 'LEATHER'
  name_en        text not null,               -- 'The Timeless Essentials'
  name_th        text,
  tagline_th     text,
  pricing_grade  text not null unique,        -- ★ ตรงกับ product_variants.material_grade
  sort_order     int  not null default 0,
  status         lifecycle_status not null default 'ขายอยู่',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references app_users(id)
);

comment on column material_collections.pricing_grade is
  '★ กุญแจที่เชื่อมคลังผ้าเข้ากับราคา — ต้องตรงกับค่าใน product_variants.material_grade เป๊ะ '
  'เช่น ''ผ้า A'' · ''หนังแท้'' · ''หนังแท้ (ออย)''';

insert into material_collections (code, name_en, name_th, pricing_grade, sort_order) values
  ('A',           'The Timeless Essentials',   'เรียบง่าย ทนทานทุกการใช้งาน', 'ผ้า A',           1),
  ('B',           'The Curated Fashion',       'สีสันที่คัดสรร',              'ผ้า B',           2),
  ('C',           'The Italian Craftsmanship', 'งานฝีมืออิตาลี ลายสก็อต',     'ผ้า C',           3),
  ('LEATHER',     'Premium Leather',           'หนังแท้คัดพิเศษ',             'หนังแท้',         4),
  ('LEATHER_OIL', 'Premium Leather (Oil)',     'หนังแท้ ออย',                 'หนังแท้ (ออย)',   5);

-- ⚠️ หน้าเว็บโชว์ Premium Leather กลุ่มเดียว แต่ไฟล์ราคาแยกเป็น 2 เกรด
--    'หนังแท้' 134 แถว · 'หนังแท้ (ออย)' 123 แถว — ราคาต่างกัน จึงต้องแยก
--    ถ้าที่จริงเป็นกลุ่มเดียวกัน ให้รวมเป็นแถวเดียวแล้วแก้ราคาให้ตรง (OPEN-30)
--
-- ⚠️ ในไฟล์ราคายังมีค่าเฉพาะกิจที่ไม่ใช่ "เกรด" อีก 7 แบบ เช่น
--    'เบาะหนังแท้ ฐานหนังเทียม' · 'เบาะหนังแท้ พนักพิงผ้า' · 'ท็อปเหล็ก' · 'ท็อปกระจก'
--    พวกนี้เป็นสเปกเฉพาะรุ่น ไม่ใช่เกรดผ้าให้เลือก จึงไม่มีกลุ่มรองรับโดยตั้งใจ
--    → v_variant_material_options จะไม่คืนตัวเลือกให้ SKU เหล่านั้น ซึ่งถูกต้องแล้ว

-- ---------------------------------------------------------------------------
-- คุณสมบัติ · เห็นในหน้าเว็บจริง: Water Repellent · Pet Friendly
-- แยกตารางเพราะผ้า 1 ตัวมีได้หลายคุณสมบัติ และจะเพิ่มคุณสมบัติใหม่ได้โดยไม่ต้องแก้ schema
-- ---------------------------------------------------------------------------
create table material_features (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name_en     text not null,
  name_th     text,
  icon        text,
  sort_order  int not null default 0,
  status      lifecycle_status not null default 'ขายอยู่',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users(id)
);

insert into material_features (code, name_en, name_th, sort_order) values
  ('water_repellent', 'Water Repellent', 'กันน้ำ',       1),
  ('pet_friendly',    'Pet Friendly',    'เป็นมิตรกับสัตว์เลี้ยง', 2);

-- ---------------------------------------------------------------------------
-- วัสดุรายตัว · 1 แถว = 1 สวอตช์ในหน้าเว็บ
-- ---------------------------------------------------------------------------
create table materials (
  id              uuid primary key default gen_random_uuid(),
  collection_id   uuid not null references material_collections(id),

  code            text unique,          -- รหัสผ้าของโรงงาน ถ้ามี
  name            text not null,        -- ชื่อที่โชว์ลูกค้า
  colour_name     text,
  colour_hex      text check (colour_hex is null or colour_hex ~ '^#[0-9A-Fa-f]{6}$'),
  swatch_url      text,                 -- รูปสวอตช์

  width_cm        numeric(6,1),
  rub_test        int,                  -- ความทนการเสียดสี (จำนวนรอบ)
  composition     text,                 -- ส่วนผสมเส้นใย
  supplier        text,

  status          material_status not null default 'มีของ',
  status_note     text,                 -- เหตุผลตอนหมด/เลิก
  status_since    date,

  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references app_users(id)
);
create index on materials (collection_id, sort_order);
create index on materials (status);

comment on table materials is
  '1 แถว = 1 สวอตช์ในหน้า material-list · แก้สถานะที่นี่ที่เดียว หน้าเว็บเปลี่ยนตาม';

-- ราคาวัสดุ 🔒 แยกตารางเพราะเป็นต้นทุน ไม่ใช่ข้อมูลที่ลูกค้าหรือเซลส์ต้องเห็น
create table material_costs (
  id           uuid primary key default gen_random_uuid(),
  material_id  uuid not null references materials(id),
  cost_per_m   numeric(12,2) not null default 0,
  valid_from   date not null default current_date,
  valid_to     date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references app_users(id)
);
create index on material_costs (material_id, valid_from desc);

create table material_feature_links (
  material_id  uuid not null references materials(id),
  feature_id   uuid not null references material_features(id),
  primary key (material_id, feature_id)
);

-- ---------------------------------------------------------------------------
-- มุมมองสำหรับหน้าเว็บ · โชว์เฉพาะที่ยังสั่งได้
-- ---------------------------------------------------------------------------
create view v_material_list_public with (security_invoker = true) as
select
  mc.code          as collection_code,
  mc.name_en       as collection_name,
  mc.sort_order    as collection_order,
  m.id,
  m.code,
  m.name,
  m.colour_name,
  m.colour_hex,
  m.swatch_url,
  m.width_cm,
  m.rub_test,
  m.composition,
  m.status,
  m.sort_order,
  coalesce(
    (select array_agg(f.code order by f.sort_order)
     from material_feature_links l
     join material_features f on f.id = l.feature_id
     where l.material_id = m.id and f.status = 'ขายอยู่'),
    '{}'
  ) as features
from materials m
join material_collections mc on mc.id = m.collection_id
where m.status in ('มีของ', 'ใกล้หมด')     -- ★ หมด/เลิกผลิต หายจากเว็บเอง
  and mc.status = 'ขายอยู่';

comment on view v_material_list_public is
  'หน้าเว็บ material-list ดึงจาก view นี้ · ผ้าที่หมดหรือเลิกผลิตหายไปเองโดยไม่ต้องแก้เว็บ (กฎ J2)';

-- ---------------------------------------------------------------------------
-- ผ้าที่เลือกได้สำหรับ SKU หนึ่งๆ · นี่คือคำตอบของ "เลือกสีได้"
-- ---------------------------------------------------------------------------
create view v_variant_material_options with (security_invoker = true) as
select
  v.id      as variant_id,
  v.sku,
  v.material_grade,
  m.id      as material_id,
  m.name    as material_name,
  m.colour_name,
  m.swatch_url,
  m.status
from product_variants v
join material_collections mc on mc.pricing_grade = v.material_grade
join materials m             on m.collection_id  = mc.id
where m.status in ('มีของ', 'ใกล้หมด');

comment on view v_variant_material_options is
  'SKU นี้เลือกผ้าอะไรได้บ้าง · มีผ้าสีใหม่เข้ามา = เพิ่ม 1 แถวในตาราง materials '
  'ทุก SKU ที่ใช้เกรดนั้นเห็นทันที ไม่ต้องไล่แก้สินค้าทีละตัว';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table material_collections    enable row level security;
alter table material_features       enable row level security;
alter table materials               enable row level security;
alter table material_feature_links  enable row level security;
alter table material_costs          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['material_collections','material_features',
                           'materials','material_feature_links'] loop
    execute format(
      'create policy %I on %I for select to authenticated
         using (has_capability(''products.read''))', t || '_select', t);
    execute format(
      'create policy %I on %I for insert to authenticated
         with check (has_capability(''products.write''))', t || '_insert', t);
    execute format(
      'create policy %I on %I for update to authenticated
         using (has_capability(''products.write''))', t || '_update', t);
    execute format(
      'create trigger %I before delete on %I for each row execute function prevent_delete()',
      'no_delete_' || t, t);
  end loop;
end;
$$;

-- material_feature_links ไม่มี updated_at จึงไม่ติด touch trigger
do $$
declare t text;
begin
  foreach t in array array['material_collections','material_features','materials'] loop
    execute format(
      'create trigger %I before update on %I for each row execute function touch_updated_at()',
      'touch_' || t, t);
    execute format(
      'create trigger %I after insert or update on %I for each row execute function write_audit()',
      'audit_' || t, t);
  end loop;
end;
$$;

-- 🔒 ต้นทุนวัสดุ เจ้าของเท่านั้น
create policy material_costs_select on material_costs
  for select to authenticated using (has_capability('cost.read'));
create policy material_costs_write on material_costs
  for all to authenticated
  using (has_capability('cost.read')) with check (has_capability('cost.read'));
create trigger no_delete_material_costs before delete on material_costs
  for each row execute function prevent_delete();
create trigger touch_material_costs before update on material_costs
  for each row execute function touch_updated_at();
create trigger audit_material_costs after insert or update on material_costs
  for each row execute function write_audit();

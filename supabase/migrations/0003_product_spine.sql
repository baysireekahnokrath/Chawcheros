-- ============================================================================
-- 0002 · กระดูกสันหลังสินค้า — แบรนด์ หมวด รุ่น ตัวที่ขายจริง และ SKU
-- ============================================================================
-- นี่คือ "ก้อน A" ตาม build-plan.md — เฉพาะที่สต็อกต้องใช้ชี้เท่านั้น
-- ราคา ผ้า รูป สเปกละเอียด อยู่ก้อน B (ช่วง 5-6) ยังไม่อยู่ในไฟล์นี้
--
-- กฎ A3 · SKU 8 หลัก ไม่มีความหมายในตัวเอง ห้ามซ้ำ ห้ามเปลี่ยน ห้ามใช้ซ้ำ
-- กฎ A4 · แยก "รุ่น" (products) ออกจาก "ตัวที่ขายจริง" (product_variants)
-- ============================================================================

create type lifecycle_status as enum (
  'ขายอยู่',
  'เลิกขาย',
  'ใช้แทนด้วยตัวใหม่',   -- รองรับทางย้าย ก. → ข. ในอนาคต (D1-note)
  'ร่าง'
);

-- ---------------------------------------------------------------------------
-- แบรนด์ · หมวด
-- ---------------------------------------------------------------------------
create table brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  status      lifecycle_status not null default 'ขายอยู่',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users(id)
);
comment on table brands is 'ฌ เฌอ · HOF · ฌ เฌอ โฮม (ยืนยันแล้ว D6: HOF เป็นแบรนด์เรา)';

create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  status      lifecycle_status not null default 'ขายอยู่',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users(id)
);
comment on table categories is 'โซฟา · สตูล · อาร์มแชร์ · เตียง · ... (22 ค่าจากไฟล์ราคาจริง)';

-- ---------------------------------------------------------------------------
-- รุ่น · ลูกค้าซื้อ "รุ่น" เฉยๆ ไม่ได้ ต้องบอกขนาดและวัสดุด้วย
-- ตารางนี้จึงไม่มี SKU
-- ---------------------------------------------------------------------------
create table products (
  id           uuid primary key default gen_random_uuid(),
  collection   text not null,               -- ทากะ · Emu · Koontong · Andaman
  name_th      text,
  name_en      text,
  brand_id     uuid not null references brands(id),
  category_id  uuid not null references categories(id),
  description  text,
  status       lifecycle_status not null default 'ร่าง',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references app_users(id),
  unique (brand_id, collection)
);
comment on table products is
  '1 แถว = 1 Collection (B1) · 33 ค่าในไฟล์ราคาจริง · ไม่มี SKU โดยตั้งใจ';

-- ---------------------------------------------------------------------------
-- ตัวที่ขายจริง · SKU อยู่ที่นี่
-- ---------------------------------------------------------------------------
-- ความละเอียด = รุ่น + รูปทรง + มิติ + เกรดวัสดุ   (ตัวเลือก ก. ตาม D1)
-- สีผ้าที่ลูกค้าเลือก ไม่ได้อยู่ที่นี่ — ไปอยู่ที่ตัวสินค้าจริงและที่ออเดอร์
-- ข้อมูลจริงยืนยัน: ทุกแถวเขียนว่า "ผ้า A เลือกสีได้" อยู่แล้ว
create table product_variants (
  id             uuid primary key default gen_random_uuid(),
  sku            char(8) not null unique
                   references sku_registry(sku),
  product_id     uuid not null references products(id),

  configuration  text,        -- '3 ที่นั่ง' · 'L-shape' · 'Corner Sofa' · '5 ฟุต'
  width_cm       numeric(7,1),
  depth_cm       numeric(7,1),
  height_cm      numeric(7,1),

  material_grade text,        -- 'ผ้า A' · 'ผ้า B' · 'ผ้า C' · 'หนังแท้' · 'หนังแท้ (ออย)'
  wood_type      text,        -- ว่างได้ — ใช้เฉพาะงานไม้ (631/751 แถวว่าง)
  wood_colour    text,

  legacy_nnsku   text,        -- รหัส NocNoc เดิม เก็บไว้ track back เท่านั้น (B6)
  legacy_fullname text,       -- Full name จากไฟล์ Airtable · ไม่ซ้ำเลย ใช้จับคู่ตอน migrate

  superseded_by  uuid references product_variants(id),  -- ทางย้าย ก. → ข. (D1-note)

  status         lifecycle_status not null default 'ร่าง',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references app_users(id)
);

comment on column product_variants.sku is
  'SKU 8 หลัก · ออกโดยระบบเท่านั้น · ห้ามแก้ตลอดชีวิตสินค้า (กฎ A3)';
comment on column product_variants.superseded_by is
  'ถ้าวันหนึ่งย้ายไปแบบ ข. (แยกทุกสีผ้า): SKU เดิมไม่ถูกแก้ แต่ชี้มาที่ตัวใหม่ '
  'ออเดอร์เก่ายังอ่านออกเหมือนเดิม';

create index on product_variants (product_id);
create index on product_variants (legacy_nnsku) where legacy_nnsku is not null;
create index on product_variants (status);

-- SKU ห้ามเปลี่ยนตลอดชีวิต · บังคับที่ฐานข้อมูล
create or replace function freeze_sku()
returns trigger language plpgsql as $$
begin
  if new.sku is distinct from old.sku then
    raise exception 'SKU ห้ามเปลี่ยน (กฎ A3) · เดิม % พยายามเปลี่ยนเป็น %', old.sku, new.sku
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
create trigger freeze_sku_on_variants before update on product_variants
  for each row execute function freeze_sku();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table brands           enable row level security;
alter table categories       enable row level security;
alter table products         enable row level security;
alter table product_variants enable row level security;

do $$
declare t text;
begin
  foreach t in array array['brands','categories','products','product_variants'] loop
    -- อ่านได้ถ้ามีสิทธิ์ products.read · เพิ่ม/แก้ได้ถ้ามี products.write
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
    execute format(
      'create trigger %I before update on %I for each row execute function touch_updated_at()',
      'touch_' || t, t);
    execute format(
      'create trigger %I after insert or update on %I for each row execute function write_audit()',
      'audit_' || t, t);
  end loop;
end;
$$;

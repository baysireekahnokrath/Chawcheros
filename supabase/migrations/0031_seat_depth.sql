-- ============================================================================
-- 0031 · ความลึกที่นั่ง · เก็บเลขในวงเล็บของช่องความลึกที่เคยถูกทิ้ง
-- ============================================================================
-- ไฟล์ราคาเขียนขนาดโซฟาแบบนี้
--     ลึก  D167 (101)   → ลึกรวม 167 · ความลึกที่นั่ง 101
--     สูง  H72  (46)    → สูงรวมพนักพิง 72 · ความสูงที่นั่ง 46
--
-- ของช่อง "สูง" ระบบแยกเก็บเป็น seat_height_cm อยู่แล้วตั้งแต่ 0012
-- แต่ของช่อง "ลึก" ตัวอ่านไฟล์หยิบแค่เลขตัวแรกแล้วทิ้งวงเล็บไป
-- Bay ยืนยัน 2026-10-28 ว่าเลขในวงเล็บของช่องลึกคือ "ความลึกที่นั่ง"
--
-- ในไฟล์ราคา 2026 มี 39 จาก 751 แถวที่มีเลขนี้ (เป็นโซฟาทั้งหมด)
-- และทุกแถวที่มีเลขในวงเล็บของช่องลึก ก็มีของช่องสูงด้วย
-- ตรวจแล้วค่าในวงเล็บน้อยกว่าค่ารวมทุกแถว (0 แถวที่ขัดกัน) จึงสมเหตุสมผล
--
-- เติมให้เฉพาะตัวที่มีเลขในวงเล็บ ตัวที่ไม่มีปล่อยว่าง — ไม่เดาแทน
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1 · ที่พักข้อมูลนำเข้า
-- ---------------------------------------------------------------------------
alter table catalog.import_variants
  add column if not exists seat_depth_cm numeric(6,1);

comment on column catalog.import_variants.seat_depth_cm is
  'ความลึกที่นั่ง · มาจากเลขในวงเล็บของช่องความลึกในไฟล์ราคา เช่น D167 (101) → 101 · '
  'ว่างได้ แปลว่าไฟล์ต้นทางไม่ได้ให้ค่านี้มา ไม่ใช่ว่าไม่มีที่นั่ง';

-- ---------------------------------------------------------------------------
-- 2 · ตัวสินค้าจริง
-- ---------------------------------------------------------------------------
alter table catalog.product_variants
  add column if not exists seat_depth_cm numeric(6,1);

comment on column catalog.product_variants.seat_depth_cm is
  'ความลึกที่นั่ง (ไม่รวมพนักพิง) · คู่กับ seat_height_cm · '
  'ว่างได้สำหรับของที่ไม่ใช่ที่นั่ง หรือของที่ไฟล์ต้นทางไม่ได้ให้ค่ามา';

-- ---------------------------------------------------------------------------
-- 3 · ส่งค่าต่อตอนอนุมัติ
-- ---------------------------------------------------------------------------
-- เหมือน 0017 ทุกบรรทัด เพิ่มแค่ seat_depth_cm — ถ้าไม่เพิ่มที่นี่
-- ค่าจะค้างอยู่ในที่พักข้อมูลแล้วหายตอนออก SKU
create or replace function catalog.approve_import_rows(p_ids uuid[])
returns int
language plpgsql security definer
set search_path = core, catalog, materials, pricing, cost, public
as $$
declare
  r           record;
  v_brand_id  uuid;
  v_cat_id    uuid;
  v_prod_id   uuid;
  v_sku       char(8);
  v_variant   uuid;
  n           int := 0;
begin
  if not core.has_capability('products.write') then
    raise exception 'ต้องมีสิทธิ์ products.write จึงจะอนุมัติสินค้าได้'
      using errcode = 'insufficient_privilege';
  end if;

  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;

  for r in
    select * from catalog.import_variants
    where id = any(p_ids)
      and review_status = 'รอตรวจ'     -- กันกดซ้ำแล้วออก SKU ซ้ำ
    order by source_row_no
  loop
    insert into catalog.brands (name) values (r.brand)
      on conflict (name) do nothing;
    select id into v_brand_id from catalog.brands where name = r.brand;

    insert into catalog.categories (name) values (r.category)
      on conflict (name) do nothing;
    select id into v_cat_id from catalog.categories where name = r.category;

    -- รุ่น = Collection + หมวด (กฎ B1)
    insert into catalog.products (collection, brand_id, category_id, status)
    values (r.collection, v_brand_id, v_cat_id, 'ขายอยู่')
    on conflict (brand_id, collection, category_id) do nothing;
    select id into v_prod_id from catalog.products
      where brand_id = v_brand_id and collection = r.collection and category_id = v_cat_id;

    -- ★ SKU เกิดตรงนี้ที่เดียว และเกิดตอนอนุมัติเท่านั้น
    v_sku := catalog.mint_sku('นำเข้าจากไฟล์ราคา 2026 แถวที่ ' || r.source_row_no);

    insert into catalog.product_variants
      (sku, product_id, configuration, width_cm, depth_cm, height_cm,
       seat_height_cm, seat_depth_cm,
       material_grade, wood_type, wood_colour, legacy_nnsku, legacy_fullname, status)
    values
      (v_sku, v_prod_id, r.sub_category, r.width_cm, r.depth_cm, r.height_cm,
       r.seat_height_cm, r.seat_depth_cm,
       r.material_grade, r.wood, r.wood_colour,
       nullif(r.legacy_nnsku, 'xxxxxxxx'), r.legacy_fullname, 'ขายอยู่')
    returning id into v_variant;

    if r.list_price_incl_vat is not null then
      insert into pricing.variant_prices (variant_id, list_price_incl_vat)
      values (v_variant, r.list_price_incl_vat);
    end if;

    update catalog.import_variants
       set review_status = 'อนุมัติแล้ว',
           reviewed_by   = auth.uid(),
           reviewed_at   = now(),
           variant_id    = v_variant
     where id = r.id;

    n := n + 1;
  end loop;

  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4 · คัดลอกค่าต่อตอนเพิ่มตัวจากตัวฐาน
-- ---------------------------------------------------------------------------
-- เหมือน 0018 ทุกบรรทัด เพิ่มแค่ seat_depth_cm
-- ไม่แตะเงื่อนไขตรวจตัวซ้ำ — seat_height_cm ก็ไม่เคยอยู่ในนั้น
-- จะเปลี่ยนความหมายของ "ตัวซ้ำ" ไปโดยไม่มีใครขอ
create or replace function catalog.add_variant_from_base(
  p_base_variant_id uuid,
  p_material_grade  text,
  p_uplift          numeric,
  p_note            text default null
) returns uuid
language plpgsql security definer
set search_path = core, catalog, materials, pricing, cost, public
as $$
declare b record; v_sku char(8); v_new uuid;
begin
  if not core.has_capability('products.write') then
    raise exception 'ต้องมีสิทธิ์ products.write จึงจะเพิ่มตัวสินค้าได้'
      using errcode = 'insufficient_privilege';
  end if;

  select * into b from catalog.product_variants where id = p_base_variant_id;
  if not found then raise exception 'ไม่พบตัวฐานที่อ้างถึง'; end if;

  if coalesce(trim(p_material_grade), '') = '' then
    raise exception 'ต้องระบุวัสดุหุ้ม';
  end if;
  if p_uplift is null or p_uplift < 0 then
    raise exception 'ส่วนที่บวกเพิ่มต้องไม่ติดลบ';
  end if;
  if p_material_grade = b.material_grade then
    raise exception 'วัสดุหุ้มซ้ำกับตัวฐาน (%) — ไม่ใช่ตัวใหม่', b.material_grade;
  end if;

  if not exists (select 1 from pricing.variant_prices
                 where variant_id = p_base_variant_id and status = 'ขายอยู่') then
    raise exception 'ตัวฐานยังไม่มีราคา จะเอาอะไรไปบวก';
  end if;

  if exists (
    select 1 from catalog.product_variants x
    where x.product_id = b.product_id
      and x.material_grade is not distinct from p_material_grade
      and x.configuration is not distinct from b.configuration
      and x.width_cm  is not distinct from b.width_cm
      and x.depth_cm  is not distinct from b.depth_cm
      and x.height_cm is not distinct from b.height_cm
      and x.wood_type is not distinct from b.wood_type
  ) then
    raise exception 'ตัวนี้มีอยู่แล้ว (% · ขนาดเดียวกัน)', p_material_grade;
  end if;

  v_sku := catalog.mint_sku('เพิ่มจากตัวฐาน ' || catalog.sku_display(b.sku::text)
                            || ' เปลี่ยนเป็น ' || p_material_grade);

  insert into catalog.product_variants
    (sku, product_id, configuration, width_cm, depth_cm, height_cm,
     seat_height_cm, seat_depth_cm,
     material_grade, wood_type, wood_colour, seat_count, arm_config, is_modular, status)
  values
    (v_sku, b.product_id, b.configuration, b.width_cm, b.depth_cm, b.height_cm,
     b.seat_height_cm, b.seat_depth_cm,
     p_material_grade, b.wood_type, b.wood_colour,
     b.seat_count, b.arm_config, b.is_modular, 'ขายอยู่')
  returning id into v_new;

  insert into pricing.variant_price_uplifts
    (variant_id, base_variant_id, uplift_incl_vat, note)
  values (v_new, p_base_variant_id, p_uplift, p_note);

  return v_new;
end;
$$;

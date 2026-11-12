-- ============================================================================
-- 0043 · ส่วนลดจากไฟล์ราคาที่ตกหล่นตอนอนุมัติ
-- ============================================================================
-- ★ เจอตอนทำหน้า Price List: ราคาหลังส่วนลดออกมาเท่ากับราคาเต็มทุกตัว
--
-- สาเหตุ
--   ไฟล์ราคามีคอลัมน์ %ส่วนลด รายตัว (30% 218 แถว · 25% 204 · 40% 169 · …)
--   ตอนนำเข้า เก็บไว้ครบใน catalog.import_variants.discount_pct
--   แต่ catalog.approve_import_rows ไม่เคยเอาไปสร้างกฎใน pricing.discount_rules
--   ส่วนลดจึงหายไปเงียบๆ ตอนกดอนุมัติ ไม่มี error ให้เห็น
--
--   ผลที่ตามมา: ทุกหน้าที่โชว์ "ราคาขาย" โชว์ราคาเต็ม
--   ซึ่งแพงกว่าที่ขายจริง 20-40% แล้วแต่ตัว
--
-- แก้สองทาง เพราะแก้ทางเดียวไม่พอ
--   1. ซ่อมของที่อนุมัติไปแล้ว   (ส่วนล่างของไฟล์นี้)
--   2. ซ่อมตัวอนุมัติ ไม่ให้ตกอีก (approve_import_rows ข้างล่าง)
--
-- หมายเหตุเรื่องกฎ "ห้ามเอาข้อมูลใส่ migration"
--   ไฟล์นี้ไม่ได้ฝังตัวเลขจากไฟล์ราคาไว้สักตัว · มันอ่านจากแถวที่อยู่ในฐานข้อมูล
--   อยู่แล้วทั้งหมด จึงเป็นการซ่อมการแปลงข้อมูล ไม่ใช่การนำเข้าข้อมูล
--   และรันซ้ำได้ เพราะมีด่าน not exists กันสร้างกฎซ้ำ
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1 · ตัวอนุมัติ · เพิ่มการสร้างกฎส่วนลดต่อจากการสร้างราคา
-- ---------------------------------------------------------------------------
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
      (sku, product_id, configuration, width_cm, depth_cm, height_cm, seat_height_cm,
       material_grade, wood_type, wood_colour, legacy_nnsku, legacy_fullname, status)
    values
      (v_sku, v_prod_id, r.sub_category, r.width_cm, r.depth_cm, r.height_cm, r.seat_height_cm,
       r.material_grade, r.wood, r.wood_colour,
       nullif(r.legacy_nnsku, 'xxxxxxxx'), r.legacy_fullname, 'ขายอยู่')
    returning id into v_variant;

    if r.list_price_incl_vat is not null then
      insert into pricing.variant_prices (variant_id, list_price_incl_vat)
      values (v_variant, r.list_price_incl_vat);
    end if;

    -- ★ บรรทัดที่หายไปเดิม · ไม่มีอันนี้ ราคาขายจะเท่ากับราคาเต็มตลอดไป
    if coalesce(r.discount_pct, 0) > 0 then
      insert into pricing.discount_rules (name, scope, target_id, percent)
      values ('ส่วนลดจากไฟล์ราคา 2026', 'ตัวสินค้า', v_variant, r.discount_pct);
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
-- 2 · ซ่อมของที่อนุมัติไปแล้วก่อนหน้านี้
-- ---------------------------------------------------------------------------
insert into pricing.discount_rules (name, scope, target_id, percent)
select 'ส่วนลดจากไฟล์ราคา 2026 (ย้อนหลัง)', 'ตัวสินค้า', iv.variant_id, iv.discount_pct
from catalog.import_variants iv
where iv.review_status = 'อนุมัติแล้ว'
  and iv.variant_id   is not null
  and coalesce(iv.discount_pct, 0) > 0
  and not exists (
    select 1 from pricing.discount_rules d
    where d.scope = 'ตัวสินค้า' and d.target_id = iv.variant_id
  );

notify pgrst, 'reload schema';

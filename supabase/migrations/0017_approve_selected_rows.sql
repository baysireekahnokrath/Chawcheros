-- ============================================================================
-- 0017 · อนุมัติเลือกเป็นรายตัวได้ ไม่ใช่เหมาทั้งกลุ่ม
-- ============================================================================
-- เจอจากการใช้งานจริง กลุ่ม "กางเขน · ตู้เก็บของ" มีสองแถว
--   แถว 449 · ไม้โอ๊ค สูง 126.5 · 43,900 · ลด 15%
--   แถว 459 · ไม้โอ๊ค สูง 80    · 24,200 · ลด 20%
-- คนละของกันชัดเจน แต่ถูกจับกลุ่มเดียวกันเพราะ Collection + หมวด ตรงกัน
-- ซึ่งถูกแล้วตามกฎ B1 — สองตัวนี้คือ "รุ่นเดียวกัน คนละตัวที่ขายจริง"
--
-- ปัญหาคือหน้าตรวจให้เลือกได้แค่ "เอาทั้งกลุ่ม" หรือ "ไม่เอาทั้งกลุ่ม"
-- พอตัวหนึ่งเลิกขายแล้วอีกตัวยังขาย จึงไม่มีทางบอกระบบได้
--
-- แยกตัวอนุมัติออกมาเป็น approve_import_rows(uuid[]) แล้วให้ตัวเดิม
-- approve_import_group เรียกต่อ เพื่อให้ SKU ยังเกิดที่เดียวเหมือนเดิม
-- ถ้าลอกโค้ดไปไว้สองที่ วันหนึ่งจะมีที่หนึ่งถูกแก้แล้วอีกที่ลืม
-- ============================================================================

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

-- ตัวเดิมยังอยู่ ยังเรียกได้เหมือนเดิม แต่ข้างในมอบงานต่อ
-- ใครกด "อนุมัติทั้งกลุ่ม" ก็ยังได้ผลเท่าเดิมทุกประการ
create or replace function catalog.approve_import_group(
  p_collection text,
  p_category   text
) returns int
language plpgsql security definer
set search_path = core, catalog, materials, pricing, cost, public
as $$
declare v_ids uuid[];
begin
  select array_agg(id order by source_row_no) into v_ids
  from catalog.import_variants
  where collection = p_collection and category = p_category
    and review_status = 'รอตรวจ';

  return catalog.approve_import_rows(v_ids);
end;
$$;

revoke all on function catalog.approve_import_rows(uuid[]) from public, anon;
grant execute on function catalog.approve_import_rows(uuid[]) to authenticated;

comment on function catalog.approve_import_rows(uuid[]) is
  'อนุมัติเฉพาะแถวที่เลือก · จุดเดียวในระบบที่ SKU ถูกออกจากการนำเข้า · '
  'แถวที่ไม่ใช่สถานะรอตรวจจะถูกข้าม กดซ้ำจึงไม่ทำให้ SKU ออกซ้ำ';
comment on function catalog.approve_import_group(text, text) is
  'อนุมัติทั้งกลุ่ม · เป็นทางลัดของ approve_import_rows สำหรับกลุ่มที่เอาทั้งยวง';

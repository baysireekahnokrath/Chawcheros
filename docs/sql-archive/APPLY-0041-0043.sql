-- ============================================================================
-- รวม migration 0041 + 0042 + 0043 และข้อมูลรูปสินค้า ไว้ในไฟล์เดียว
-- ============================================================================
--   0041  เพิ่มช่อง รูป / ที่มาของรูป / หมายเหตุ ใน catalog.products
--   0042  วิว pricing.v_price_list + ขึ้นเมนู "ใบราคา" ในหน้าแรก
--   0043  ★ ซ่อมส่วนลดที่ตกหล่นตอนอนุมัตินำเข้า
--   ข้อมูล ใส่รูปสินค้า 86 รุ่นจาก chawcher.com
--
-- ★ 0043 สำคัญที่สุดในไฟล์นี้ · แก้ของที่ผิดอยู่จริงตอนนี้
--   ไฟล์ราคามี %ส่วนลดรายตัว (30% 218 แถว · 25% 204 · 40% 169 · …)
--   ตอนนำเข้าเก็บไว้ครบ แต่ตอนกดอนุมัติไม่ได้เอาไปสร้างกฎส่วนลด
--   ทุกหน้าที่โชว์ "ราคาขาย" จึงโชว์ราคาเต็ม แพงกว่าที่ขายจริง 20-40%
--   ไฟล์นี้สร้างกฎย้อนหลังให้ และซ่อมตัวอนุมัติไม่ให้ตกอีก
--
-- ต้องรัน docs/APPLY-0038-0040.sql ก่อน (พี่รันไปแล้ว)
-- รันซ้ำได้ทั้งไฟล์ · ทุกคำสั่งมีด่านกันซ้ำของตัวเอง
--
-- ⚠️ ไฟล์รูป docs/APPLY-0041-images.sql ต้องรันอีกครั้งหลังตรวจ 95 กลุ่มเสร็จ
--    เพราะมันใส่รูปให้เฉพาะรุ่นที่อนุมัติเข้าระบบแล้ว
-- ============================================================================

begin;


-- ========================================================================
-- >>> 0041_product_images.sql
-- ========================================================================

-- ============================================================================
-- 0041 · รูปสินค้า และหมายเหตุ · สำหรับหน้า Price List ออนไลน์
-- ============================================================================
-- โจทย์จาก Bay (2026-11-08)
--   อยากได้ Price List แบบที่พิมพ์แจกตอนออกงาน แต่เป็นออนไลน์
--   รูปสินค้า "ไปดึงจาก website"
--   หมายเหตุอย่าง "ไม่มีขายใน nocnoc" "ถ้าหมุนได้ +3000" ให้เป็นหมายเหตุ
--
-- ★ ระดับของรูป: ผูกกับ "รุ่น" ไม่ใช่ "ตัวสินค้า"
--   Bay ยืนยันเองว่า "ดูตาม collection + ประเภท เป็นหลัก"
--   ซึ่งตรงกับ catalog.products พอดี (unique: brand + collection + category = 95 รุ่น)
--   สินค้า 751 ตัวจึงใช้รูปร่วมกันราว 9 ตัวต่อรูป ไม่ต้องหารูป 751 รูป
--
-- ที่มาของรูป: chawcher.com เป็น WordPress + WooCommerce เปิด REST API อยู่แล้ว
--   102 สินค้าบนเว็บ มีรูปหลักครบทุกตัว
--   เก็บเป็น URL ของเว็บตัวเอง ไม่ได้ก๊อปไฟล์มา รูปบนเว็บเปลี่ยน หน้าราคาก็เปลี่ยนตาม
--   วันไหนอยากเก็บไฟล์เองค่อยย้าย ช่อง image_source บอกว่าของเดิมมาจากไหน
-- ============================================================================

alter table catalog.products
  add column if not exists image_url    text,
  add column if not exists image_source text,
  add column if not exists note         text;

comment on column catalog.products.image_url is
  'รูปหลักของรุ่น · ใช้ร่วมกันทุกขนาดและทุกเกรดในรุ่นเดียวกัน';
comment on column catalog.products.image_source is
  'ที่มาของรูป เช่นหน้าสินค้าบนเว็บ · ไว้ตามกลับได้ว่ารูปนี้มาจากไหน';
comment on column catalog.products.note is
  'หมายเหตุที่ขึ้นในใบราคา เช่น "ไม่มีขายใน nocnoc" "ถ้าหมุนได้ +3000" '
  '"Base PVC สีดำหรือขาว" · ข้อความอิสระ ไม่ต้องมีโครงสร้าง';

notify pgrst, 'reload schema';


-- ========================================================================
-- >>> 0042_price_list_view.sql
-- ========================================================================

-- ============================================================================
-- 0042 · วิวสำหรับหน้า Price List ออนไลน์
-- ============================================================================
-- แทนไฟล์ PDF 12 หน้าที่พิมพ์แจกตอนออกงานบ้านและสวนแฟร์
--
-- ★ สิ่งที่ตรวจพบระหว่างทำ และทำให้ไม่ต้องสร้างอะไรใหม่เลย
--   ตรวจทั้ง 751 แถวในไฟล์ราคาแล้ว พบว่า "ราคา BLS" ทุกแถว เท่ากับ
--        ราคาเต็ม × (1 − %ส่วนลด)   ตรงเป๊ะ 751 จาก 751 แถว
--   แปลว่า "ราคา BLS" ไม่ใช่ราคาพิเศษของงานแฟร์ แต่คือราคาหลังส่วนลดปกติ
--   ซึ่ง pricing.v_variant_price คำนวณให้อยู่แล้วตั้งแต่ 0005
--   → ไม่ต้องมีตาราง "ชุดราคาตามงาน" ไม่ต้องมีกลไกราคาใหม่
--
--   เหตุผลเดียวที่ใบราคาแฟร์เคยต้องแยกไฟล์ คือมันเป็นกระดาษ
--   พอเป็นออนไลน์ที่ดึงราคาสดทุกครั้ง เหตุผลนั้นหายไปเอง
--
-- ★ เรื่องที่ยืนยันว่าทำไมต้องเลิกใช้ PDF
--   PDF ฉบับ มี.ค. 2025 กับชีตวันนี้ ไม่ตรงกันแล้ว เช่น Flamingo Recliner
--   ผ้า A ใน PDF 33,250 (ลด 30%) · ในชีตวันนี้ 26,125 (ลด 45%)
--   ใครเสนอราคาจาก PDF อยู่ แพงกว่าราคาจริง 7,125 บาท
--
-- วิวนี้รวม 3 อย่างที่เคยอยู่คนละที่ให้มาอยู่แถวเดียวกัน
--   ราคา      จาก pricing.v_variant_price (รองรับราคาแบบบวกเพิ่มอยู่แล้ว 0018)
--   รูป       จาก catalog.products.image_url (0041)
--   สเปก/ขนาด จาก catalog.product_variants
-- ============================================================================

create or replace view pricing.v_price_list with (security_invoker = true) as
select
  p.id                      as product_id,
  p.collection              as "รุ่น",
  c.name                    as "หมวด",
  p.name_en                 as "ชื่ออังกฤษ",
  p.image_url               as "รูป",
  p.note                    as "หมายเหตุรุ่น",

  v.id                      as variant_id,
  v.sku,
  pv.sku_display,
  v.configuration           as "รูปทรง",
  v.material_grade          as "เกรดวัสดุ",
  v.wood_type               as "ไม้",
  v.wood_colour             as "สีไม้",
  v.width_cm                as "กว้าง",
  v.depth_cm                as "ลึก",
  v.height_cm               as "สูง",
  v.seat_height_cm          as "สูงที่นั่ง",
  v.seat_depth_cm           as "ลึกที่นั่ง",

  pv."ราคาเต็มรวม_vat",
  pv."ส่วนลดปกติ_pct",
  pv."ราคาขายรวม_vat",
  pv."ที่มาของราคา"
from catalog.product_variants v
join catalog.products p         on p.id = v.product_id
join catalog.categories c       on c.id = p.category_id
join pricing.v_variant_price pv on pv.variant_id = v.id
where v.status = 'ขายอยู่'
  and p.status = 'ขายอยู่';

comment on view pricing.v_price_list is
  'ใบราคาออนไลน์ · 1 แถว = 1 ตัวสินค้า · ราคาคำนวณสดทุกครั้ง ไม่มีไฟล์เก่าลอยอยู่ · '
  'ไม่มีต้นทุนสักช่อง จึงให้ฝ่ายขายเปิดดูได้ทั้งหน้า';

grant select on pricing.v_price_list to authenticated;

-- ---------------------------------------------------------------------------
-- ลงทะเบียนโมดูล · เมนูหน้าแรกสร้างตัวเองจากตารางนี้
-- ---------------------------------------------------------------------------
insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability,
   home_path, sort_order, is_core, description_th) values
  ('pricelist', 'ใบราคา', 'Price List', 'tag', 'pricing',
   '{core,catalog,pricing}', 'products.read', '/price', 7, false,
   'ใบราคาออนไลน์ · ราคาสดทุกครั้ง แทน PDF 12 หน้าที่พิมพ์แจกตอนออกงาน')
on conflict (id) do nothing;

notify pgrst, 'reload schema';


-- ========================================================================
-- >>> 0043_import_discounts.sql
-- ========================================================================

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


-- ========================================================================
-- >>> ข้อมูลรูปสินค้า 86 รุ่น (เนื้อหาเดียวกับ docs/APPLY-0041-images.sql)
-- ========================================================================


update catalog.products p
   set image_url    = v.url,
       image_source = v.page
  from (values
  ('กระตั้ว', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/kratua1-sofa-website-1.jpg', 'https://chawcher.com/product/kratua-sofa/'),
  ('กระทา', 'ตู้เก็บของ', 'https://chawcher.com/wp-content/uploads/2025/07/krata1-sideboard-website-1.jpg', 'https://chawcher.com/product/krata-sideboard/'),
  ('กระทา', 'เลาจ์แชร์', 'https://chawcher.com/wp-content/uploads/2025/07/krata2-cozychair-website-1.jpg', 'https://chawcher.com/product/krata-cozy-chair/'),
  ('กระทา', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/krata1-sofa-website-1.jpg', 'https://chawcher.com/product/phoenix-sofa-copy-copy/'),
  ('กระสา', 'ชั้นวางทีวี', 'https://chawcher.com/wp-content/uploads/2025/07/krasa1-walnut-tv-website.jpg', 'https://chawcher.com/product/krasa-tv-cabinet-walnut/'),
  ('กระสา', 'ตู้เก็บของ', 'https://chawcher.com/wp-content/uploads/2025/07/krasa-sideboard-website.jpg', 'https://chawcher.com/product/krasa-sideboard/'),
  ('กระสา', 'ม้านั่ง', 'https://chawcher.com/wp-content/uploads/2025/07/krasa1-chair-website-1.jpg', 'https://chawcher.com/product/krasa-bench/'),
  ('กระสา', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/krasa2-armchair-website-1.jpg', 'https://chawcher.com/product/krasa-armchair/'),
  ('กระสา', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/krasa1-sofa-website.jpg', 'https://chawcher.com/product/krasa-sofa/'),
  ('กระสา', 'โต๊ะทานข้าว', 'https://chawcher.com/wp-content/uploads/2025/07/krasa1-dining-table-website.jpg', 'https://chawcher.com/product/krasa-dining-table/'),
  ('กระเรียน', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/krarean1-stool-website.jpg', 'https://chawcher.com/product/krarean-stool/'),
  ('กระเรียน', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/krarean1-sofa-website.jpg', 'https://chawcher.com/product/krarean-sofa/'),
  ('กางเขน', 'ชั้นวางทีวี', 'https://chawcher.com/wp-content/uploads/2025/07/kangkaen1-tv-website.jpg', 'https://chawcher.com/product/kangkaen-tv-cabinet/'),
  ('กางเขน', 'ตู้เก็บของ', 'https://chawcher.com/wp-content/uploads/2025/07/kangkaen1-sideboard-website-1.jpg', 'https://chawcher.com/product/kangkaen-sideboard/'),
  ('กางเขน', 'เตียง', 'https://chawcher.com/wp-content/uploads/2025/07/kangkaen-bed.jpg', 'https://chawcher.com/product/kangkaen-bed/'),
  ('กีวี่', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/kiwi1-stool-website.jpg', 'https://chawcher.com/product/kiwi-stool/'),
  ('กีวี่', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/kiwi-walnut1-armchair-website-2.jpg', 'https://chawcher.com/product/kiwi-armchair-walnut/'),
  ('กีวี่', 'เก้าอี้', 'https://chawcher.com/wp-content/uploads/2025/07/kiwi2-walnut-chair-website-1.jpg', 'https://chawcher.com/product/kiwi-chair-walnut/'),
  ('กีวี่', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/kiwi-walnut1-sofa-website-1.jpg', 'https://chawcher.com/product/kiwi-sofa-walnut/'),
  ('ขมิ้น', 'ชั้นวางทีวี', 'https://chawcher.com/wp-content/uploads/2025/07/kamin1-oak-tv-website.jpg', 'https://chawcher.com/product/kamin-tv-cabinet-oak/'),
  ('ขมิ้น', 'ตู้เก็บของ', 'https://chawcher.com/wp-content/uploads/2025/07/kamin1-walnut-sideboard-website-1.jpg', 'https://chawcher.com/product/kamin-sideboard-walnut/'),
  ('ขมิ้น', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/kamin2-stool-website.jpg', 'https://chawcher.com/product/kamin-stool/'),
  ('ขมิ้น', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/kamin1-sofa-website-1.jpg', 'https://chawcher.com/product/kamin-sofa/'),
  ('ขอนไม้', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/khonmai1-stool-website.jpg', 'https://chawcher.com/product/khonmai-stool/'),
  ('ขุนทอง', 'ชั้นวางทีวี', 'https://chawcher.com/wp-content/uploads/2025/07/koontong1-walnut-tv-website.jpg', 'https://chawcher.com/product/koontong-tv-cabinet-walnut/'),
  ('ขุนทอง', 'ตู้เก็บของ', 'https://chawcher.com/wp-content/uploads/2025/07/koontong1-walnut-sideboardw160-website-1.jpg', 'https://chawcher.com/product/koontong-sideboard-walnut-2/'),
  ('ขุนทอง', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/koontong1-stool-website.jpg', 'https://chawcher.com/product/koontong-stool/'),
  ('ขุนทอง', 'เก้าอี้', 'https://chawcher.com/wp-content/uploads/2025/07/koontong2-chair-website-1.jpg', 'https://chawcher.com/product/koontong-chair/'),
  ('ขุนทอง', 'เตียง', 'https://chawcher.com/wp-content/uploads/2025/07/koontong-bed.jpg', 'https://chawcher.com/product/koontong-bed/'),
  ('ขุนทอง', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/koontong-1-sofa-website.jpg', 'https://chawcher.com/product/koontong-sofa-2/'),
  ('ดิน', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/din1-stool-website.jpg', 'https://chawcher.com/product/din-stool/'),
  ('ทากะ', '1 ที่นั่ง 1 แขน', 'https://chawcher.com/wp-content/uploads/2025/07/taka1-sofa-website-1.jpg', 'https://chawcher.com/product/taka-sofa/'),
  ('ทากะ', '1 ที่นั่ง ไม่มีแขน', 'https://chawcher.com/wp-content/uploads/2025/07/taka1-sofa-website-1.jpg', 'https://chawcher.com/product/taka-sofa/'),
  ('ทากะ', '3 ที่นั่ง ไม่มีแขน', 'https://chawcher.com/wp-content/uploads/2025/07/taka1-sofa-website-1.jpg', 'https://chawcher.com/product/taka-sofa/'),
  ('ทากะ', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/taka1-stool-website.jpg', 'https://chawcher.com/product/taka-stool/'),
  ('ทากะ', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/taka1-sofa-website-1.jpg', 'https://chawcher.com/product/taka-sofa/'),
  ('ทากะ', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/taka1-sofa-website-1.jpg', 'https://chawcher.com/product/taka-sofa/'),
  ('นกยูง', 'เตียง', 'https://chawcher.com/wp-content/uploads/2025/07/nokyoong-bed.jpg', 'https://chawcher.com/product/nokyoong-bed/'),
  ('นกยูง', 'โต๊ะกลาง', 'https://chawcher.com/wp-content/uploads/2025/07/nookyoong-coffee-table-website.jpg', 'https://chawcher.com/product/nokyoong-coffee-table/'),
  ('นกยูง', 'โต๊ะทานข้าว', 'https://chawcher.com/wp-content/uploads/2025/07/nookyoong-dining-table-website.jpg', 'https://chawcher.com/product/nokyoong-dining-table/'),
  ('นกแก้ว', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/nokkaew1-stool-website.jpg', 'https://chawcher.com/product/nokkaew-stool/'),
  ('นกแก้ว', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/nokkaew1-armchair-website-1.jpg', 'https://chawcher.com/product/mininest-armchair-2/'),
  ('นกแก้ว', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/nokkeaw1-sofa-website-1.jpg', 'https://chawcher.com/product/nokkaew-sofa/'),
  ('นางนวล', 'ม้านั่ง', 'https://chawcher.com/wp-content/uploads/2025/07/nangnuan1-chair-website-1.jpg', 'https://chawcher.com/product/nangnuan-bench/'),
  ('นางนวล', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/nangnuan1-sofa-website.jpg', 'https://chawcher.com/product/nangnaun-sofa/'),
  ('นางนวล', 'โต๊ะกลาง', 'https://chawcher.com/wp-content/uploads/2025/07/nangnuan1-table-website.jpg', 'https://chawcher.com/product/nangnuan-coffee-table/'),
  ('นางนวล', 'โต๊ะข้าง', 'https://chawcher.com/wp-content/uploads/2025/07/nangnuan-side-table-website.jpg', 'https://chawcher.com/product/nangnuan-side-table/'),
  ('นางนวล', 'โต๊ะทานข้าว', 'https://chawcher.com/wp-content/uploads/2025/07/nangnuan-dining-table-website.jpg', 'https://chawcher.com/product/nangnuan-dining-table/'),
  ('นางนวล / กระสา', 'โต๊ะทานข้าว', 'https://chawcher.com/wp-content/uploads/2025/07/nangnuan-dining-table-website.jpg', 'https://chawcher.com/product/nangnuan-dining-table/'),
  ('นางแอ่น', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/nangaan2-armchair-website-3.jpg', 'https://chawcher.com/product/nangaaen-armchair/'),
  ('นางแอ่น', 'เตียง', 'https://chawcher.com/wp-content/uploads/2025/07/nangaaen.jpg', 'https://chawcher.com/product/nangaaen-bed/'),
  ('นางแอ่น', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/nangaaen1-sofa-website-1.jpg', 'https://chawcher.com/product/nangaaen-sofa/'),
  ('พัฟฟิน', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/puffin1-stool-website.jpg', 'https://chawcher.com/product/puffin-stool/'),
  ('พัฟฟิน', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/puffin1-sofa-website-2.jpg', 'https://chawcher.com/product/puffin-sofa/'),
  ('พัฟฟิน', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/puffin1-sofa-website-2.jpg', 'https://chawcher.com/product/puffin-sofa/'),
  ('ฟลามิงโก', 'ตู้เก็บของ', 'https://chawcher.com/wp-content/uploads/2025/07/flamingo1-walnut-sideboard-website.jpg', 'https://chawcher.com/product/flamingo-sideboard-walnut/'),
  ('ฟลามิงโก้', 'Recliner', 'https://chawcher.com/wp-content/uploads/2025/07/flamingo-recliner3-cozychair-website-1.jpg', 'https://chawcher.com/product/flamingo-recliner/'),
  ('ฟีนิกซ์', 'ตู้เก็บของ', 'https://chawcher.com/wp-content/uploads/2025/07/phoenix1-sideboard-website.jpg', 'https://chawcher.com/product/phoenix-sideboard/'),
  ('ฟีนิกซ์', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/phoenix1-stool-website.jpg', 'https://chawcher.com/product/phoenix-stool/'),
  ('ฟีนิกซ์', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/phoenix1-sofa-website.jpg', 'https://chawcher.com/product/phoenix-sofa/'),
  ('ฟีนิกซ์', 'โต๊ะกลาง', 'https://chawcher.com/wp-content/uploads/2025/07/phoenix1-coffee-table-website.jpg', 'https://chawcher.com/product/phoenix-coffee-table/'),
  ('มินิเนส', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/mininest2-armchair-website-3.jpg', 'https://chawcher.com/product/mininest-armchair/'),
  ('สวอน', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/swan1-stool-website-1.jpg', 'https://chawcher.com/product/swan-stool/'),
  ('สวอน', 'เก้าอี้', 'https://chawcher.com/wp-content/uploads/2025/07/swan1-chair-website-1.jpg', 'https://chawcher.com/product/swan-chair/'),
  ('สวอน', 'เลาจ์แชร์', 'https://chawcher.com/wp-content/uploads/2025/07/swan1-cozychair-website-1.jpg', 'https://chawcher.com/product/swan-cozy-chair/'),
  ('สวอน', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/swan1-sofa-website-1.jpg', 'https://chawcher.com/product/swan-sofa/'),
  ('สวอน', 'โต๊ะกลาง', 'https://chawcher.com/wp-content/uploads/2025/07/swan-coffee-table-website-1.jpg', 'https://chawcher.com/product/swan-coffee-table/'),
  ('สวอน', 'โต๊ะข้างเตียง', 'https://chawcher.com/wp-content/uploads/2025/07/swan-side-table-website.jpg', 'https://chawcher.com/product/swan-side-table/'),
  ('สวอน', 'โต๊ะทานข้าว', 'https://chawcher.com/wp-content/uploads/2025/07/swan-dining-table-website-1.jpg', 'https://chawcher.com/product/swan-dining-table/'),
  ('อัญชัน', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/aunchan1-stool-website.jpg', 'https://chawcher.com/product/aunchan-stool/'),
  ('อัญชัน', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/aunchan1-armchair-website-1.jpg', 'https://chawcher.com/product/aunchan-armchair/'),
  ('อินทรี', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/insee1-stool-website.jpg', 'https://chawcher.com/product/insee-stool/'),
  ('อินทรี', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/insee1-cozychair-website-1.jpg', 'https://chawcher.com/product/insee-cozy-chair/'),
  ('อินทรี', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/insee2-sofa-website-1.jpg', 'https://chawcher.com/product/insee-sofa/'),
  ('อีมู', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/emu1-stool-website.jpg', 'https://chawcher.com/product/emu-stool/'),
  ('อีมู', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/emu1-armchair-website-1.jpg', 'https://chawcher.com/product/emu-armchair/'),
  ('อีมู', 'เก้าอี้', 'https://chawcher.com/wp-content/uploads/2025/07/emu3-walnut-chair-website-1.jpg', 'https://chawcher.com/product/emu-chair-walnut/'),
  ('อีมู', 'เตียง', 'https://chawcher.com/wp-content/uploads/2025/07/emu-bed.jpg', 'https://chawcher.com/product/emu-bed/'),
  ('อีมู', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/emu1-sofa-website-1.jpg', 'https://chawcher.com/product/emu-sofa/'),
  ('ฮูก', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/hook1-armchair-website-1.jpg', 'https://chawcher.com/product/hook-armchair/'),
  ('ฮูก', 'โคซี่แชร์', 'https://chawcher.com/wp-content/uploads/2025/07/hook1-cozychair-website-1.jpg', 'https://chawcher.com/product/hook-cozy-chair/'),
  ('ฮูก', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/hook1-sofa-website-1.jpg', 'https://chawcher.com/product/hook-sofa/'),
  ('เนส', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/nest2-loveseat-website-1.jpg', 'https://chawcher.com/product/nest-love-seat/'),
  ('เบิร์ด', 'ชั้นวางหนังสือ', 'https://chawcher.com/wp-content/uploads/2025/07/shelf-walnut.jpg', 'https://chawcher.com/product/bird-bookshelf-walnut/'),
  ('โอบ', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/oab1-sofa-website.jpg', 'https://chawcher.com/product/oab-sofa/'),
  ('โอมุ', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/omu1-sofa-website-1.jpg', 'https://chawcher.com/product/omu-sofa/')
  ) as v(collection, category_name, url, page)
  join catalog.categories c on c.name = v.category_name
 where p.collection = v.collection
   and p.category_id = c.id;


commit;

-- ============================================================================
-- ตรวจว่าขึ้นครบ · รันแยกหลังจาก commit แล้ว
-- ============================================================================
select 'ช่องรูปใน catalog.products' as "ตรวจอะไร",
       coalesce(string_agg(column_name, ' · ' order by column_name), 'ไม่พบ') as "ผลที่ได้"
from information_schema.columns
where table_schema='catalog' and table_name='products'
  and column_name in ('image_url','image_source','note')
union all
select 'วิวใบราคา',
       coalesce((select 'มี ' || count(*)::text || ' แถว' from pricing.v_price_list), 'ไม่พบ')
union all
select 'รุ่นที่มีรูปแล้ว',
       (select count(*) filter (where image_url is not null) || ' จาก ' || count(*) || ' รุ่น'
        from catalog.products)
union all
select 'กฎส่วนลดที่มีอยู่ (0043)',
       (select count(*)::text || ' กฎ' from pricing.discount_rules)
union all
select 'เมนูใบราคาในหน้าแรก',
       coalesce((select name_th || ' -> ' || home_path from core.modules where id='pricelist'), 'ไม่พบ');

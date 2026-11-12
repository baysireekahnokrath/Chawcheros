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

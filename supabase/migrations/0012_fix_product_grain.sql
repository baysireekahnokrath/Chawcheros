-- ============================================================================
-- 0012 · แก้ระดับของ "รุ่น" ให้ตรงกับข้อมูลจริง
-- ============================================================================
-- ข้อมูลจริง 751 แถวเปิดโปงว่าโครงเดิมผิด:
--   21 จาก 33 Collection อยู่หลายหมวดพร้อมกัน
--   เช่น "ขุนทอง" มีทั้ง เตียง · โซฟา · ตู้เก็บของ · ชั้นวางทีวี · สตูล · เก้าอี้
--   → unique(brand, collection) เดิมจะชนกันทันทีที่โหลดข้อมูลจริง
--
-- Collection = "ตระกูลงานออกแบบ" ไม่ใช่ชนิดสินค้า (เหมือน KIVIK ของ IKEA)
-- ที่ถูกคือ  รุ่น = Collection + หมวด
--   ตรงกับที่ Bay ตอบข้อ B1 ว่า "Emu Sofa" และ "Koontong Sideboard"
--   ซึ่งทั้งคู่คือ Collection + หมวด  →  ได้ 95 รุ่นจาก 751 แถว
-- ============================================================================

alter table catalog.products
  drop constraint products_brand_id_collection_key;

alter table catalog.products
  add constraint products_brand_collection_category_key
  unique (brand_id, collection, category_id);

comment on column catalog.products.collection is
  'ตระกูลงานออกแบบ เช่น ขุนทอง · ทากะ · อีมู · กระสา — 1 ตระกูลมีได้หลายหมวด';
comment on table catalog.products is
  '1 แถว = 1 รุ่น = Collection + หมวด เช่น "ขุนทอง เตียง" · "ทากะ โซฟา" (กฎ B1)';

-- ---------------------------------------------------------------------------
-- ความสูงเบาะ · ซ่อนอยู่ในวงเล็บของช่องความสูง 79 แถว เช่น "H72 (46)"
-- IKEA เก็บแยกเพราะลูกค้าสนใจมากกว่าความสูงรวมด้วยซ้ำ
-- ---------------------------------------------------------------------------
alter table catalog.product_variants
  add column seat_height_cm numeric(6,1);

comment on column catalog.product_variants.seat_height_cm is
  'ความสูงเบาะนั่ง · แกะจากวงเล็บในช่องความสูงของไฟล์เดิม เช่น H72 (46) → 46';

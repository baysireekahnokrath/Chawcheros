-- ============================================================================
-- 0044 · ลงทะเบียนโมดูล Data Sheet
-- ============================================================================
-- แผ่นสเปคสินค้าทุกรุ่น · ขนาด วัสดุ รหัส และผังด้านบน
--
-- ★ ไม่มีวิวใหม่ ไม่มีตารางใหม่ ตั้งใจ
--   data sheet ไม่มีข้อมูลที่ใบราคาไม่มี มันคือใบราคาที่ยุบเกรดวัสดุทิ้ง
--   แล้วเหลือ "1 แถว = 1 โมดูล" แทน "1 แถว = 1 ตัวสินค้า"
--   ใช้ pricing.v_price_list ที่มี RLS คุมอยู่แล้ว ไม่ต้องเปิดสิทธิ์ใหม่
--   และไม่มีทางที่หน้า data sheet จะเห็นของที่ใบราคาเห็นไม่ได้
--
--   การจัดกลุ่มกับการตั้งรหัสทำในแอป (web/src/modules/datasheet/build.ts)
--   มีชุดทดสอบ 37 ข้อที่ web/scripts/datasheet.test.mts รันโดยไม่ต้องต่อฐานข้อมูล
--
-- ★ ทำไมแผ่นนี้ไม่มีราคา
--   data sheet ของโรงงาน (Phoenix/koontong) ไม่ใส่ราคา เพราะราคาเปลี่ยนบ่อยกว่าขนาด
--   แผ่นที่ไม่มีราคาส่งให้ดีลเลอร์หรือสถาปนิกได้เลย ไม่ต้องกลัวตัวเลขหลุด
--   ใครอยากได้ราคาไปดูที่ /price ซึ่งดึงสดเหมือนกัน
--
-- ไฟล์นี้ทำอย่างเดียวคือใส่เมนูหน้าแรก · หน้า /datasheet ใช้งานได้ก่อนรันไฟล์นี้อยู่แล้ว
-- ============================================================================

insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability,
   home_path, sort_order, is_core, description_th) values
  ('datasheet', 'Data Sheet', 'Data Sheet', 'ruler', 'pricing',
   '{core,catalog,pricing}', 'products.read', '/datasheet', 8, false,
   'แผ่นสเปคสินค้าทุกรุ่น ขนาด วัสดุ รหัส และผังด้านบน · ไม่มีราคา ส่งต่อได้เลย')
on conflict (id) do update
  set name_th            = excluded.name_th,
      name_en            = excluded.name_en,
      icon               = excluded.icon,
      home_path          = excluded.home_path,
      description_th     = excluded.description_th;

notify pgrst, 'reload schema';

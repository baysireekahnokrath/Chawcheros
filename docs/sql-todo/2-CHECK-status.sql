-- เช็กสถานะระบบ · อ่านอย่างเดียว ไม่แก้อะไร · วางแล้วกด Run ได้ทุกเมื่อ
-- ได้ตารางเดียว · ทุกแถวควรเป็น ✅ · แถวไหน ❌ ให้ส่งภาพหน้าจอมาให้ Claude

select เรื่อง, case when ok then '✅' else '❌' end as สถานะ from (values
  ('0031 ความลึกที่นั่ง',      exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                                          where n.nspname='catalog' and p.proname='add_variant_from_base')),
  ('0032 ลูกค้า (CRM)',        to_regclass('crm.customers') is not null),
  ('0033 ออเดอร์',             to_regclass('sales.orders') is not null),
  ('0037 POS',                 to_regclass('pos.sales') is not null),
  ('0039 ต้นทุน/สูตรวัสดุ',     to_regclass('production.boms') is not null),
  ('0040 ดูบิลย้อนหลัง POS',    to_regprocedure('pos.list_sales(text,date)') is not null),
  ('0041 รูปสินค้า',           exists (select 1 from information_schema.columns
                                       where table_schema='catalog' and table_name='products' and column_name='image_url')),
  ('0042 ใบราคา',              to_regclass('pricing.v_price_list') is not null),
  ('0044 ปุ่ม Data Sheet',     exists (select 1 from core.modules where id='datasheet')),
  ('0045 POS ค่าส่ง',          exists (select 1 from information_schema.columns
                                       where table_schema='pos' and table_name='sales' and column_name='ship_method')),
  ('0047 จัดชุดฟีนิกซ์',        to_regprocedure('pricing.phoenix_sheet(text)') is not null),
  ('PIN ฟีนิกซ์ตั้งแล้ว',       case when to_regclass('pricing.phx_settings') is null then false
                                    else (xpath('/row/n/text()', query_to_xml('select count(*) as n from pricing.phx_settings', false, true, '')))[1]::text::int > 0 end)
) as t(เรื่อง, ok)
order by 1;

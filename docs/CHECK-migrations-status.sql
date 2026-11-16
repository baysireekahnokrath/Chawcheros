-- ============================================================================
-- CHECK · สถานะ migration 0031–0052 + ไฟล์ docs/APPLY-*.sql + PIN ตั้งแล้วหรือยัง
-- ============================================================================
-- ★ อ่านอย่างเดียว · ไม่สร้าง ไม่แก้ ไม่ลบอะไรในฐานข้อมูล
--   ทั้งไฟล์คือคำสั่ง SELECT คำสั่งเดียว · ไม่มี create / alter / insert / update / delete
--   ไม่เรียกฟังก์ชันของระบบเราสักตัว · ใช้แค่สารบัญของ Postgres
--   (pg_class · pg_attribute · pg_proc) กับ query_to_xml ที่ใช้นับจำนวนแถว
--   รันกี่ครั้งก็ได้ ผลเหมือนเดิม
--
-- วิธีใช้ · วางทั้งไฟล์ใน Supabase SQL Editor → กด Run → ได้ตารางเดียว 35 แถว
--   คอลัมน์: ลำดับ · migration · ตรวจอะไร · สถานะ
--   สถานะ = 'ลงแล้ว' / 'ยังไม่ลง' · สองแถวท้ายเรื่อง PIN = 'ตั้งแล้ว' / 'ยังไม่ตั้ง'
--
-- เรื่อง PIN (แถว 34–35)
--   นับแค่ว่า "มีแถวเก็บ PIN อยู่หรือไม่" ในตาราง pos.settings และ pricing.phx_settings
--   ไม่ได้ select ช่อง pin_hash และไม่มีทางรู้ตัว PIN · ผลที่ได้มีแค่ ตั้งแล้ว / ยังไม่ตั้ง
--
-- ข้อจำกัดที่ต้องรู้ก่อนอ่านผล
--   1. ตรวจจาก "ของที่ไฟล์นั้นสร้าง" ไฟล์ละ 1–2 อย่าง ไม่ได้ตรวจทุกบรรทัด
--      ลงแล้ว = ของชิ้นที่ตรวจมีอยู่จริง · ไม่ได้ยืนยันว่ารันจบทั้งไฟล์
--   2. 0051 ถูก 0052 เขียนทับฟังก์ชันเดียวกัน · แถว 0051 จึงแปลว่า "0051 หรือใหม่กว่า"
--   3. แถว 29 (APPLY-0041-images) ตรวจ "ข้อมูล" ไม่ใช่โครงสร้าง
--      = มีสินค้าอย่างน้อย 1 รุ่นที่ใส่รูปแล้ว
--   4. แถว APPLY ที่รวมหลาย migration = ลงแล้ว ก็ต่อเมื่อทุกตัวในนั้นลงแล้ว
--
-- ทดสอบแล้ว 2026-11-16 กับ Postgres 16 ในเครื่อง ตามวิธีใน supabase/tests/README.md
--   (ก) ลง migration ครบทุกไฟล์ → ลงแล้ว 32 · ยังไม่ลง 1 (แถว 29 เพราะฐานทดสอบไม่มีสินค้า) · ยังไม่ตั้ง 2
--   (ข) ลงถึงแค่ 0036          → รันผ่าน ไม่ error · ลงแล้ว 7 (แถว 1–6 และ 24) · ยังไม่ลง 26 · ยังไม่ตั้ง 2
--   รันในโหมด default_transaction_read_only=on ผ่านทั้งสองฐาน = ยืนยันว่าไม่เขียนอะไร
--   ตั้ง PIN ทดสอบในฐาน (ก) แล้ว แถว 34–35 เปลี่ยนเป็น ตั้งแล้ว ถูกต้อง
--   ★ ที่ยังไม่ได้ทดสอบ: แถว 29 ฝั่ง "ลงแล้ว" (ฐานทดสอบไม่มีสินค้าให้ใส่รูป)
--   ★ ยังไม่ได้รันกับฐานข้อมูลจริงบน Supabase · Bay เป็นคนรัน
--
-- ต่อยอดจาก docs/sql-todo/2-CHECK-status.sql (branch main · 2026-11-11) ที่ตรวจถึงแค่ 0047
-- ============================================================================

with
-- สารบัญของที่มีอยู่ในฐานข้อมูลตอนนี้ (แถวเดียว)
k as (
  select
    -- ฟังก์ชันทั้งหมด เขียนเป็น schema.ชื่อ
    coalesce((select array_agg(distinct n.nspname || '.' || p.proname)
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname in ('catalog','crm','sales','line_agent','sheets','pos',
                                   'production','cost','pricing','content','marketing')),
             '{}'::text[]) as fns,
    -- คอลัมน์ทั้งหมด เขียนเป็น schema.ตาราง.คอลัมน์ (รวมคอลัมน์ของ view)
    coalesce((select array_agg(n.nspname || '.' || c.relname || '.' || a.attname)
                from pg_attribute a
                join pg_class c     on c.oid = a.attrelid
                join pg_namespace n on n.oid = c.relnamespace
               where a.attnum > 0 and not a.attisdropped
                 and n.nspname in ('catalog','sales','line_agent','pos','marketing')),
             '{}'::text[]) as cols,
    -- เนื้อในของฟังก์ชันที่ถูกเขียนทับ · ใช้แยกว่าเป็นรุ่นไหน
    coalesce((select bool_or(p.prosrc like '%discount_rules%')
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'catalog' and p.proname = 'approve_import_rows'), false) as f0043,
    coalesce((select bool_or(p.prosrc like '%ship_method%')
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'pos' and p.proname = 'list_sales'), false) as f0046,
    coalesce((select bool_or(p.prosrc like '%ontop_pct%')
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'line_agent' and p.proname = '_price_full'), false) as f0051,
    -- รายชื่อโมดูลในทะเบียน core.modules (อ่านอย่างเดียว · ถ้ายังไม่มีตารางได้รายการว่าง)
    case when to_regclass('core.modules') is null then '{}'::text[]
         else coalesce((xpath('//id/text()',
                query_to_xml('select id from core.modules', false, false, '')))::text[], '{}'::text[])
    end as mods,
    -- จำนวนรุ่นที่มีรูป
    case when to_regclass('catalog.products') is null then 0
         else (xpath('/row/n/text()', query_to_xml(
                'select count(*) as n from catalog.products '
                'where to_jsonb(products) ->> ''image_url'' is not null', false, true, '')))[1]::text::int
    end as n_images,
    -- PIN · นับจำนวนแถวอย่างเดียว ไม่แตะช่อง pin_hash
    case when to_regclass('pos.settings') is null then 0
         else (xpath('/row/n/text()', query_to_xml(
                'select count(*) as n from pos.settings', false, true, '')))[1]::text::int
    end as n_pos_pin,
    case when to_regclass('pricing.phx_settings') is null then 0
         else (xpath('/row/n/text()', query_to_xml(
                'select count(*) as n from pricing.phx_settings', false, true, '')))[1]::text::int
    end as n_phx_pin
),

-- migration 0031–0052 ทีละไฟล์
base as (
  select v.ord, v.migration, v.what, v.ok
  from k, lateral (values
    ( 1, '0031_seat_depth.sql',
         'คอลัมน์ catalog.product_variants.seat_depth_cm + ฟังก์ชัน catalog.add_variant_from_base',
         'catalog.product_variants.seat_depth_cm' = any(k.cols)
         and 'catalog.add_variant_from_base' = any(k.fns)),
    ( 2, '0032_crm.sql',
         'ตาราง crm.customers + เมนูโมดูล crm',
         to_regclass('crm.customers') is not null and 'crm' = any(k.mods)),
    ( 3, '0033_sales.sql',
         'ตาราง sales.orders + วิว sales.v_orders',
         to_regclass('sales.orders') is not null and to_regclass('sales.v_orders') is not null),
    ( 4, '0034_line_agent.sql',
         'ตาราง line_agent.rooms + line_agent.requests',
         to_regclass('line_agent.rooms') is not null and to_regclass('line_agent.requests') is not null),
    ( 5, '0035_sheets.sql',
         'ตาราง sheets.sources + ฟังก์ชัน line_agent.sheets_age_minutes',
         to_regclass('sheets.sources') is not null and 'line_agent.sheets_age_minutes' = any(k.fns)),
    ( 6, '0036_line_rooms_slips.sql',
         'ตาราง line_agent.slips + คอลัมน์ line_agent.rooms.see_price',
         to_regclass('line_agent.slips') is not null and 'line_agent.rooms.see_price' = any(k.cols)),
    ( 7, '0037_line_image_sets.sql',
         'ตาราง line_agent.recent_images + ฟังก์ชัน line_agent.image_seen',
         to_regclass('line_agent.recent_images') is not null and 'line_agent.image_seen' = any(k.fns)),
    ( 8, '0037_pos.sql',
         'ตาราง pos.sales + ฟังก์ชัน pos.record_sale',
         to_regclass('pos.sales') is not null and 'pos.record_sale' = any(k.fns)),
    ( 9, '0038_fix_truncated_column.sql',
         'คอลัมน์ "เลยกำหนดและค้างเงิน" ในวิว sales.v_orders (ชื่อที่แก้แล้ว)',
         'sales.v_orders.เลยกำหนดและค้างเงิน' = any(k.cols)),
    (10, '0039_costing.sql',
         'ตาราง production.boms + cost.component_prices (ตรวจแค่ว่ามีตาราง ไม่อ่านตัวเลข)',
         to_regclass('production.boms') is not null and to_regclass('cost.component_prices') is not null),
    (11, '0040_pos_lookup.sql',
         'ฟังก์ชัน pos.list_sales (ย้อนดูบิล)',
         'pos.list_sales' = any(k.fns)),
    (12, '0041_product_images.sql',
         'คอลัมน์ catalog.products.image_url',
         'catalog.products.image_url' = any(k.cols)),
    (13, '0042_price_list_view.sql',
         'วิว pricing.v_price_list + เมนูโมดูล pricelist',
         to_regclass('pricing.v_price_list') is not null and 'pricelist' = any(k.mods)),
    (14, '0043_import_discounts.sql',
         'ฟังก์ชัน catalog.approve_import_rows รุ่นที่สร้างกฎส่วนลด (เนื้อในมี discount_rules)',
         k.f0043),
    (15, '0044_datasheet_module.sql',
         'เมนูโมดูล datasheet ใน core.modules',
         'datasheet' = any(k.mods)),
    (16, '0045_pos_shipping.sql',
         'คอลัมน์ pos.sales.ship_method + ฟังก์ชัน pos.set_sender',
         'pos.sales.ship_method' = any(k.cols) and 'pos.set_sender' = any(k.fns)),
    (17, '0046_pos_lookup_shipping.sql',
         'ฟังก์ชัน pos.list_sales รุ่นที่คืนที่อยู่จัดส่ง (เนื้อในมี ship_method)',
         k.f0046),
    (18, '0047_phoenix_public.sql',
         'ตาราง pricing.phx_settings + ฟังก์ชัน pricing.phoenix_sheet',
         to_regclass('pricing.phx_settings') is not null and 'pricing.phoenix_sheet' = any(k.fns)),
    (19, '0048_line_knowledge.sql',
         'ตาราง line_agent.kb_items + ฟังก์ชัน line_agent.faq_public',
         to_regclass('line_agent.kb_items') is not null and 'line_agent.faq_public' = any(k.fns)),
    (20, '0049_news.sql',
         'ตาราง content.news_items + เมนูโมดูล news',
         to_regclass('content.news_items') is not null and 'news' = any(k.mods)),
    (21, '0050_line_search_price.sql',
         'ฟังก์ชัน line_agent.room_price + line_agent.match_score',
         'line_agent.room_price' = any(k.fns) and 'line_agent.match_score' = any(k.fns)),
    (22, '0051_line_price_pattern.sql',
         'ฟังก์ชัน line_agent._price_full รุ่นที่ส่ง % on top (0051 หรือใหม่กว่า)',
         k.f0051),
    (23, '0052_promo_answer.sql',
         'คอลัมน์ marketing.promotions.kind + ฟังก์ชัน line_agent._promos_for',
         'marketing.promotions.kind' = any(k.cols) and 'line_agent._promos_for' = any(k.fns))
  ) as v(ord, migration, what, ok)
),

-- ไฟล์ docs/APPLY-*.sql · แต่ละไฟล์คือ migration ข้างบนมัดรวมกัน
bundles as (
  select v.ord, v.migration, v.what,
         (select bool_and(b.ok) from base b where b.ord = any(v.parts)) as ok
  from (values
    (24, 'docs/APPLY-0031-0033.sql',            'รวม 0031 + 0032 + 0033',                    array[1,2,3]),
    (25, 'docs/APPLY-0037-pos.sql',             'เท่ากับ 0037_pos (ไฟล์นี้ตั้ง PIN POS ด้วย · ดูแถว 34)', array[8]),
    (26, 'docs/APPLY-0038-0040.sql',            'รวม 0038 + 0039 + 0040',                    array[9,10,11]),
    (27, 'docs/APPLY-0038-pos-shipping.sql',    'เท่ากับ 0045 (ชื่อไฟล์เป็นเลขเก่า)',         array[16]),
    (28, 'docs/APPLY-0041-0043.sql',            'รวม 0041 + 0042 + 0043',                    array[12,13,14]),
    (30, 'docs/APPLY-0044-datasheet.sql',       'เท่ากับ 0044',                              array[15]),
    (31, 'docs/APPLY-0046-pos-lookup-shipping.sql', 'เท่ากับ 0046',                          array[17]),
    (32, 'docs/APPLY-0047-phoenix.sql',         'เท่ากับ 0047 (ไฟล์นี้ไม่ตั้ง PIN · ดูแถว 35)', array[18]),
    (33, 'docs/APPLY-POS-ONLY.sql',             'เฉพาะฟังก์ชัน pos.list_sales ของ 0040',      array[11])
  ) as v(ord, migration, what, parts)
)

select t.ord       as "ลำดับ",
       t.migration as "migration",
       t.what      as "ตรวจอะไร",
       t.status    as "สถานะ"
from (
  select ord, migration, what,
         case when ok then 'ลงแล้ว' else 'ยังไม่ลง' end as status
    from base
  union all
  select ord, migration, what,
         case when ok then 'ลงแล้ว' else 'ยังไม่ลง' end
    from bundles
  union all
  select 29, 'docs/APPLY-0041-images.sql',
         'ข้อมูลรูปสินค้า · มีอย่างน้อย 1 รุ่นใน catalog.products ที่ใส่รูปแล้ว',
         case when k.n_images > 0 then 'ลงแล้ว' else 'ยังไม่ลง' end
    from k
  union all
  select 34, 'PIN หน้า POS (/pos)',
         'มีแถว PIN ใน pos.settings หรือไม่ · ไม่อ่านตัว PIN',
         case when k.n_pos_pin > 0 then 'ตั้งแล้ว' else 'ยังไม่ตั้ง' end
    from k
  union all
  select 35, 'PIN หน้าฟีนิกซ์ (/phoenix)',
         'มีแถว PIN ใน pricing.phx_settings หรือไม่ · ไม่อ่านตัว PIN',
         case when k.n_phx_pin > 0 then 'ตั้งแล้ว' else 'ยังไม่ตั้ง' end
    from k
) t
order by t.ord;

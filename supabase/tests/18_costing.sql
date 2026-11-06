-- ============================================================================
-- ทดสอบ โมดูลต้นทุนและใบเสนอราคา (0037) และการแก้ชื่อคอลัมน์ (0038)
-- ============================================================================
-- รัน · ต้องมี -1 ไม่งั้น set local ไม่มีผล
--   psql -1 -v ON_ERROR_STOP=1 -d t1 -f supabase/tests/18_costing.sql
--
-- 🔒 ตัวเลขในไฟล์นี้สมมติขึ้นทั้งหมด ไม่ใช่ต้นทุนจริงของสินค้าตัวไหน
--    ตั้งใจเลือกเลขกลมๆ เพื่อให้ตรวจเลขคำนวณด้วยตาได้
--
-- สิ่งที่ต้องพิสูจน์
--   1 สูตร × ราคา = ต้นทุน · ปัดที่บรรทัดแล้วค่อยบวก เหมือนใบ costing เดิม
--   2 ★ 1 สูตรครอบทุกเกรด · ช่องวัสดุหุ้มเติมตามเกรดของตัวสินค้าเอง
--   3 ★ gross_margin_pct เป็นกำไรขั้นต้น (÷) ไม่ใช่ markup (×) — กับดักข้อ 3.1
--   4 ★ ถอด VAT ออกก่อนลบต้นทุนเสมอ
--   5 ★ ราคาโอนจาก ASE ยกพื้นส่วนลดขึ้น · ลดตามต้นทุนผลิตคือขาดทุนจริง
--   6 ★ สิทธิ์แยกจริง · คนไม่มี cost.read เห็นสูตรได้ แต่ไม่เห็นราคาเลยแม้แถวเดียว
--   7 ★ ส่งใบเสนอราคาไม่ได้ถ้ายังไม่ได้ตอบเรื่องค่าส่ง (เรื่องนราธิวาส)
--   8 ลูกค้ารับแล้วกลายเป็นออเดอร์ รายการถูกคัดลอกครบ ไม่ต้องพิมพ์ใหม่
--   9 เลขที่ใบเสนอราคาเรียงไม่ขาดช่วง
--  10 ตัวที่ยังไม่มีสูตร ระบบบอกตรงๆ ว่าไม่รู้ ไม่เดาให้
--  11 คอลัมน์ "เลยกำหนดและค้างเงิน" มีจริงในฐานข้อมูล (0038)
-- ============================================================================

-- เจ้าของ · มีทุกสิทธิ์
insert into auth.users (id) values ('cccccccc-0000-0000-0000-000000000001') on conflict do nothing;
insert into core.app_users (id, email, full_name, status)
  values ('cccccccc-0000-0000-0000-000000000001','owner18@test','เจ้าของ (ทดสอบ 18)','ใช้งาน')
  on conflict do nothing;
insert into core.user_capabilities (user_id, capability)
  select 'cccccccc-0000-0000-0000-000000000001', c
    from unnest(enum_range(null::core.capability)) c
  on conflict do nothing;

-- ฝ่ายขาย · ไม่มี cost.read
insert into auth.users (id) values ('dddddddd-0000-0000-0000-000000000002') on conflict do nothing;
insert into core.app_users (id, email, full_name, status)
  values ('dddddddd-0000-0000-0000-000000000002','sale18@test','ฝ่ายขาย (ทดสอบ 18)','ใช้งาน')
  on conflict do nothing;
insert into core.user_capabilities (user_id, capability) values
  ('dddddddd-0000-0000-0000-000000000002','sales.write'),
  ('dddddddd-0000-0000-0000-000000000002','products.read')
  on conflict do nothing;

set local role authenticated;
set local "test.uid" = 'cccccccc-0000-0000-0000-000000000001';

-- ===== เตรียมสินค้าและสูตร =====
do $$
declare
  v_brand uuid; v_cat uuid; v_prod uuid; v_prod2 uuid; v_prod3 uuid;
  v_a uuid; v_b uuid; v_nobom uuid;
  v_bom uuid; v_bom2 uuid;
begin
  insert into catalog.brands (name) values ('แบรนด์ทดสอบ 18') returning id into v_brand;
  insert into catalog.categories (name) values ('หมวดทดสอบ 18') returning id into v_cat;
  insert into catalog.products (collection, brand_id, category_id, status)
    values ('รุ่นทดสอบต้นทุน', v_brand, v_cat, 'ขายอยู่') returning id into v_prod;

  insert into catalog.product_variants (sku, product_id, configuration, material_grade, status)
    values (catalog.mint_sku(), v_prod, '3 ที่นั่ง', 'ผ้า A', 'ขายอยู่') returning id into v_a;
  insert into catalog.product_variants (sku, product_id, configuration, material_grade, status)
    values (catalog.mint_sku(), v_prod, '2 ที่นั่ง', 'ผ้า B', 'ขายอยู่') returning id into v_b;
  -- ★ ตัวที่ยังไม่มีสูตร ต้องอยู่คนละรุ่น เพราะสูตรที่ size_label ว่าง ครอบทุกขนาดของรุ่นเดียวกัน
  insert into catalog.products (collection, brand_id, category_id, status)
    values ('รุ่นทดสอบไม่มีสูตร', v_brand, v_cat, 'ขายอยู่') returning id into v_prod2;
  insert into catalog.product_variants (sku, product_id, configuration, material_grade, status)
    values (catalog.mint_sku(), v_prod2, '1 ที่นั่ง', 'ผ้า A', 'ขายอยู่') returning id into v_nobom;

  insert into pricing.variant_prices (variant_id, list_price_incl_vat) values
    (v_a, 1000), (v_b, 2000), (v_nobom, 500);

  -- ส่วนประกอบ · ราคาสมมติ
  insert into production.components (code, name, kind, uom, default_recovery, fills_grade) values
    ('T18-CORE',   'ไส้ทดสอบ',        'ไส้',       'ชิ้น',  1.0000, null),
    ('T18-FAB-A',  'ผ้าทดสอบเกรด A',  'วัสดุหุ้ม', 'เมตร', 0.8000, 'ผ้า A'),
    ('T18-FAB-B',  'ผ้าทดสอบเกรด B',  'วัสดุหุ้ม', 'เมตร', 0.8000, 'ผ้า B'),
    ('T18-ZIP',    'ซิปทดสอบ',        'อะไหล่',    'ชิ้น',  1.0000, null),
    ('T18-LABOUR', 'ค่าแรงทดสอบ',     'ค่าแรง',    'ตัว',   1.0000, null);

  perform cost.set_component_price('T18-CORE',   100, 'PO',    false);
  perform cost.set_component_price('T18-FAB-A',   50, 'PO',    false);
  perform cost.set_component_price('T18-FAB-B',  150, 'PO',    false);
  perform cost.set_component_price('T18-ZIP',     20, 'PO',    false);
  -- ★ ค่าแรงติดธงว่ายังเดาอยู่ ตามที่ Bay ยืนยันเองว่าวันนี้ประเมินจากความรู้สึก
  perform cost.set_component_price('T18-LABOUR',  60, 'ประเมิน', true);

  -- ★ สูตรใบเดียว size_label ว่าง = ครอบทุกขนาดของรุ่นนี้ (หลัก C2)
  insert into production.boms (product_id, size_label, note)
    values (v_prod, null, 'สูตรทดสอบ 18') returning id into v_bom;

  perform production.add_bom_line(v_bom, 'T18-CORE',   1);
  perform production.add_bom_line(v_bom, null,         2.00, null, 2);  -- ช่องวัสดุหุ้ม
  perform production.add_bom_line(v_bom, 'T18-ZIP',    1);
  perform production.add_bom_line(v_bom, 'T18-LABOUR', 1);
  perform production.activate_bom(v_bom);

  -- ★ ข้อ 12 · สูตรที่มีบรรทัดยังไม่มีราคา ต้องตอบว่า "ยังตอบไม่ได้" ไม่ใช่ตัวเลขที่ขาด
  insert into production.components (code, name, kind, uom, default_recovery)
    values ('T18-NOPRICE', 'วัสดุที่ยังไม่รู้ราคา', 'อะไหล่', 'ชิ้น', 1.0000);
  insert into catalog.products (collection, brand_id, category_id, status)
    values ('รุ่นทดสอบราคาขาด', v_brand, v_cat, 'ขายอยู่') returning id into v_prod3;
  insert into catalog.product_variants (sku, product_id, configuration, material_grade, status)
    values (catalog.mint_sku(), v_prod3, '3 ที่นั่ง', 'ผ้า A', 'ขายอยู่');
  insert into production.boms (product_id, note)
    values (v_prod3, 'สูตรที่ราคายังไม่ครบ') returning id into v_bom2;
  perform production.add_bom_line(v_bom2, 'T18-CORE',    1);
  perform production.add_bom_line(v_bom2, 'T18-NOPRICE', 1);
  perform production.activate_bom(v_bom2);

  -- นโยบายกลาง: กำไรขั้นต้น 30%
  insert into cost.pricing_policy (product_id, gross_margin_pct)
    values (v_prod, 30.00);
  -- ตัวเกรด B มีราคาโอนจาก ASE ทับนโยบายกลาง
  insert into cost.pricing_policy (variant_id, gross_margin_pct, transfer_price)
    values (v_b, 30.00, 1500.00);
end $$;

\echo ''
\echo '=== 1-2 · สูตรใบเดียว ให้ต้นทุนต่างกันตามเกรด ==='
select sku_display, เกรด, ต้นทุนผลิต, ยังเป็นค่าประเมิน_pct, บรรทัดที่ยังไม่ครบ
from cost.v_variant_cost
where รุ่น = 'รุ่นทดสอบต้นทุน'
order by เกรด;

\echo ''
\echo '=== 1 · ต้นทุนรายบรรทัด หน้าตาเหมือนใบ costing เดิม (เกรด A) ==='
select line_no, รหัสวัสดุ, net, ได้เนื้อ, ปริมาณที่ต้องซื้อ, กี่ชิ้น,
       ราคาต่อหน่วย, มูลค่า, เป็นค่าประเมิน
from cost.v_bom_cost
where sku = (select sku from cost.v_variant_cost
              where รุ่น = 'รุ่นทดสอบต้นทุน' and ขนาด = '3 ที่นั่ง')
order by line_no;

do $$
declare a record; b record;
begin
  select * into a from cost.v_variant_cost
   where รุ่น = 'รุ่นทดสอบต้นทุน' and เกรด = 'ผ้า A';
  select * into b from cost.v_variant_cost
   where รุ่น = 'รุ่นทดสอบต้นทุน' and เกรด = 'ผ้า B';

  -- ข้อ 1 · 100 + (2÷0.8 × 2 × ราคาผ้า) + 20 + 60
  if a.ต้นทุนผลิต <> 430.00 then
    raise exception 'ข้อ 1 พัง: เกรด A ควรได้ 430.00 แต่ได้ %', a.ต้นทุนผลิต;
  end if;
  if b.ต้นทุนผลิต <> 930.00 then
    raise exception 'ข้อ 2 พัง: เกรด B ควรได้ 930.00 แต่ได้ % · '
      'ช่องวัสดุหุ้มไม่ได้เติมตามเกรดของตัวสินค้า', b.ต้นทุนผลิต;
  end if;

  -- ★ ข้อ 3 · กำไรขั้นต้น ไม่ใช่ markup · 430 ÷ 0.70 = 614.29 ไม่ใช่ 430 × 1.30 = 559
  if a.ราคาตามนโยบาย <> 614.29 then
    raise exception 'ข้อ 3 พัง: ควรได้ 614.29 (÷ 0.70) แต่ได้ %', a.ราคาตามนโยบาย;
  end if;
  if a.ราคาตามนโยบาย = 559.00 then
    raise exception 'ข้อ 3 พัง: คิดเป็น markup (× 1.30) ซึ่งทำให้ราคาต่ำกว่าที่ควร 9%%';
  end if;

  -- ★ ข้อ 5 · ราคาโอนยกพื้นส่วนลดขึ้น · 930 ÷ 0.70 = 1328.57 · เผื่อไว้ 171.43
  if b.ส่วนที่เผื่อไว้ <> 171.43 then
    raise exception 'ข้อ 5 พัง: ส่วนที่เผื่อไว้ควรเป็น 171.43 แต่ได้ %', b.ส่วนที่เผื่อไว้;
  end if;
  if b.ต้นทุนที่เราจ่ายจริง <> 1500.00 then
    raise exception 'ข้อ 5 พัง: ต้นทุนที่จ่ายจริงควรเป็นราคาโอน 1500.00 แต่ได้ %',
      b.ต้นทุนที่เราจ่ายจริง;
  end if;
  if b.พื้นส่วนลดรวม_vat <> 1605.00 then
    raise exception 'ข้อ 5 พัง: พื้นส่วนลดควรเป็น 1500 × 1.07 = 1605.00 แต่ได้ %',
      b.พื้นส่วนลดรวม_vat;
  end if;
  -- ถ้าใช้ต้นทุนผลิตเป็นพื้น จะได้ 930 × 1.07 = 995.10 แล้วลดไปถึงนั้นคือขาดทุนจริง 570 บาท
  if b.พื้นส่วนลดรวม_vat = 995.10 then
    raise exception 'ข้อ 5 พัง: ใช้ต้นทุนผลิตเป็นพื้นส่วนลด ซึ่งทำให้ลดจนขาดทุนจริงได้';
  end if;

  -- ข้อ 4 (ต่อที่ v_margin_check ข้างล่าง) · ค่าประเมิน 60 ÷ 430
  if a.ยังเป็นค่าประเมิน_pct <> 14.0 then
    raise exception 'ข้อ 1 พัง: ค่าประเมินควรเป็น 14.0%% แต่ได้ %', a.ยังเป็นค่าประเมิน_pct;
  end if;
end $$;

\echo ''
\echo '=== 4 · ถอด VAT ออกก่อนลบต้นทุน ==='
select sku_display, เกรด, ราคาขายรวม_vat, ราคาขายก่อน_vat,
       ต้นทุนที่เราจ่ายจริง, กำไรจริง, กำไรจริง_pct, จ่ายเกินต้นทุนผลิต
from cost.v_margin_check
where รุ่น = 'รุ่นทดสอบต้นทุน'
order by เกรด;

do $$
declare m record;
begin
  select * into m from cost.v_margin_check
   where รุ่น = 'รุ่นทดสอบต้นทุน' and เกรด = 'ผ้า A';

  -- ★ 1000 ÷ 1.07 = 934.58 · − 430 = 504.58 · ไม่ใช่ 1000 − 430 = 570
  if m.กำไรจริง <> 504.58 then
    raise exception 'ข้อ 4 พัง: ควรได้ 504.58 (ถอด VAT ก่อน) แต่ได้ %', m.กำไรจริง;
  end if;
  if m.กำไรจริง = 570.00 then
    raise exception 'ข้อ 4 พัง: ลืมถอด VAT · กำไรเกินจริงไป 65.42 บาทต่อตัว';
  end if;

  select * into m from cost.v_margin_check
   where รุ่น = 'รุ่นทดสอบต้นทุน' and เกรด = 'ผ้า B';
  -- ★ จ่ายให้ชั้นกลางเกินต้นทุนผลิตไป 1500 − 930 = 570 ต่อตัว
  if m.จ่ายเกินต้นทุนผลิต <> 570.00 then
    raise exception 'ข้อ 5 พัง: จ่ายเกินต้นทุนผลิตควรเป็น 570.00 แต่ได้ %',
      m.จ่ายเกินต้นทุนผลิต;
  end if;
end $$;

\echo ''
\echo '=== 12 · สูตรที่ราคายังไม่ครบ · ตอบว่ายังตอบไม่ได้ ไม่ใช่ตัวเลขที่ขาด ==='
select รุ่น, ต้นทุนผลิต, ต้นทุนที่คิดได้แล้ว, บรรทัดที่ยังไม่ครบ,
       ราคาตามนโยบาย, พื้นส่วนลดรวม_vat
from cost.v_variant_cost where รุ่น = 'รุ่นทดสอบราคาขาด';

do $$
declare g record;
begin
  select * into g from cost.v_variant_cost where รุ่น = 'รุ่นทดสอบราคาขาด';
  if g.ต้นทุนผลิต is not null then
    raise exception 'ข้อ 12 พัง: สูตรยังไม่มีราคาครบ แต่ตอบต้นทุนเป็น % · '
      'ตัวเลขนี้ต่ำกว่าจริงและไม่มีใครรู้', g.ต้นทุนผลิต;
  end if;
  if g.ต้นทุนที่คิดได้แล้ว <> 100.00 then
    raise exception 'ข้อ 12 พัง: ส่วนที่คิดได้แล้วควรเป็น 100.00 แต่ได้ %',
      g.ต้นทุนที่คิดได้แล้ว;
  end if;
  if g.บรรทัดที่ยังไม่ครบ <> 1 then
    raise exception 'ข้อ 12 พัง: ควรบอกว่ามี 1 บรรทัดยังไม่ครบ แต่บอก %',
      g.บรรทัดที่ยังไม่ครบ;
  end if;
  if g.ราคาตามนโยบาย is not null or g.พื้นส่วนลดรวม_vat is not null then
    raise exception 'ข้อ 12 พัง: ยังไม่รู้ต้นทุน แต่กล้าตอบราคาตามนโยบาย/พื้นส่วนลด';
  end if;
end $$;

-- ===== 7-10 · ใบเสนอราคา =====
\echo ''
\echo '=== 7 · ส่งใบเสนอราคาไม่ได้ถ้ายังไม่ได้ตอบเรื่องค่าส่ง ==='
do $$
declare v_cust uuid; v_q uuid; v_q2 uuid; v_order uuid; v_a uuid; v_nobom uuid; n int;
        v_line record; v_no text;
begin
  insert into crm.customers (kind, name, phone)
  values ('บุคคล', 'ลูกค้าทดสอบ 18', '000-0000000') returning id into v_cust;

  select pv.id into v_a from catalog.product_variants pv
    join catalog.products p on p.id = pv.product_id
   where p.collection = 'รุ่นทดสอบต้นทุน' and pv.material_grade = 'ผ้า A'
     and pv.configuration = '3 ที่นั่ง';
  select pv.id into v_nobom from catalog.product_variants pv
    join catalog.products p on p.id = pv.product_id
   where p.collection = 'รุ่นทดสอบไม่มีสูตร';

  v_q := sales.create_quote(v_cust, 30);

  select quote_no into v_no from sales.quotes where id = v_q;
  if v_no !~ '^QT-[0-9]{4}-0001$' then
    raise exception 'ข้อ 9 พัง: เลขที่ใบแรกควรเป็น QT-YYMM-0001 แต่ได้ %', v_no;
  end if;

  -- ★ ส่ง variant มาตัวเดียว ราคาและคำบรรยายดึงจากแคตตาล็อกเอง
  perform sales.add_quote_line(v_q, v_a, 2);
  select * into v_line from sales.quote_lines where quote_id = v_q and line_no = 1;
  if v_line.unit_price_incl_vat <> 1000.00 then
    raise exception 'พัง: ควรดึงราคา 1000 จากแคตตาล็อกเอง แต่ได้ %',
      v_line.unit_price_incl_vat;
  end if;
  if v_line.description not like '%ผ้า A%' then
    raise exception 'พัง: ควรประกอบคำบรรยายจากแคตตาล็อกเอง แต่ได้ %', v_line.description;
  end if;

  -- ข้อ 10 · ตัวที่ยังไม่มีสูตร ก็เสนอราคาได้ แต่ระบบต้องบอกว่าไม่รู้ต้นทุน
  perform sales.add_quote_line(v_q, v_nobom, 1);

  -- ★ ข้อ 7 · ประตูที่ปิดเรื่องนราธิวาส
  begin
    perform sales.send_quote(v_q);
    raise exception 'ข้อ 7 พัง: ส่งใบเสนอราคาได้ทั้งที่ยังไม่ได้คุยเรื่องค่าส่ง';
  exception when raise_exception then
    if sqlerrm like 'ข้อ 7 พัง%' then raise; end if;
  end;

  -- คิดค่าส่งแต่ไม่ใส่จำนวนเงิน ก็ไม่ผ่าน
  begin
    perform sales.set_quote_shipping(v_q, 'คิดค่าส่งตามที่ระบุ', 0);
    raise exception 'ข้อ 7 พัง: ตั้งว่าคิดค่าส่งได้ทั้งที่ไม่ใส่จำนวนเงิน';
  exception when raise_exception then
    if sqlerrm like 'ข้อ 7 พัง%' then raise; end if;
  end;

  -- ตอบแล้ว · ส่งได้
  perform sales.set_quote_shipping(v_q, 'คิดค่าส่งตามที่ระบุ', 17000,
    'นราธิวาส · เหมารถ door to door · ตกลงกับคุณลูกค้าทางโทรศัพท์ 2026-11-06');
  perform sales.send_quote(v_q);

  select status::text into v_no from sales.quotes where id = v_q;
  if v_no <> 'ส่งแล้ว' then
    raise exception 'ข้อ 7 พัง: ตอบค่าส่งแล้วยังส่งไม่ได้ · สถานะ %', v_no;
  end if;

  -- ★ ข้อ 8 · ลูกค้ารับ → กลายเป็นออเดอร์ รายการถูกคัดลอกครบ
  v_order := sales.accept_quote(v_q, 'BLSTEST18');

  select count(*) into n from sales.order_lines where order_id = v_order;
  if n <> 2 then
    raise exception 'ข้อ 8 พัง: ควรคัดลอกรายการไป 2 บรรทัด แต่ได้ %', n;
  end if;

  if (select shipping_fee_incl_vat from sales.orders where id = v_order) <> 17000.00 then
    raise exception 'ข้อ 8 พัง: ค่าส่งไม่ได้ติดไปกับออเดอร์';
  end if;

  if (select order_id from sales.quotes where id = v_q) is null then
    raise exception 'ข้อ 8 พัง: ใบเสนอราคาไม่ได้ผูกกับออเดอร์';
  end if;

  -- รับซ้ำไม่ได้
  begin
    perform sales.accept_quote(v_q, 'BLSTEST18B');
    raise exception 'ข้อ 8 พัง: รับใบเดิมซ้ำได้';
  exception when raise_exception then
    if sqlerrm like 'ข้อ 8 พัง%' then raise; end if;
  end;

  -- ข้อ 9 · ใบถัดไปต้องเป็น 0002 ไม่ขาดช่วง
  v_q2 := sales.create_quote(v_cust, 15);
  select quote_no into v_no from sales.quotes where id = v_q2;
  if v_no !~ '^QT-[0-9]{4}-0002$' then
    raise exception 'ข้อ 9 พัง: ใบที่สองควรเป็น QT-YYMM-0002 แต่ได้ %', v_no;
  end if;

  -- ยกเลิกต้องมีเหตุผล
  begin
    perform sales.cancel_quote(v_q2, '   ');
    raise exception 'ข้อ 9 พัง: ยกเลิกได้โดยไม่บอกเหตุผล';
  exception when raise_exception then
    if sqlerrm like 'ข้อ 9 พัง%' then raise; end if;
  end;
  perform sales.cancel_quote(v_q2, 'ลูกค้าเปลี่ยนใจ (ทดสอบ)');
end $$;

\echo ''
\echo '=== 10 · ใบเสนอราคาพร้อมต้นทุน 🔒 · บรรทัดที่ยังไม่มีสูตร บอกตรงๆ ว่าไม่รู้ ==='
select line_no, รายการ, จำนวน, ราคาต่อหน่วยรวม_vat, ยอดบรรทัดรวม_vat,
       ต้นทุนจ่ายต่อหน่วย, กำไรบรรทัด, ลดได้ถึงราคานี้, ยังไม่มีสูตรวัสดุ
from cost.v_quote_costing
where quote_no like 'QT-%-0001'
order by line_no;

do $$
declare l record;
begin
  select * into l from cost.v_quote_costing
   where quote_no like 'QT-%-0001' and line_no = 2;
  if not l.ยังไม่มีสูตรวัสดุ then
    raise exception 'ข้อ 10 พัง: ตัวที่ไม่มีสูตร ควรติดธงว่าไม่มีสูตร';
  end if;
  if l.ต้นทุนจ่ายต่อหน่วย is not null then
    raise exception 'ข้อ 10 พัง: ไม่มีสูตรแต่กล้าตอบต้นทุน % · ต้องตอบว่าไม่รู้',
      l.ต้นทุนจ่ายต่อหน่วย;
  end if;

  -- บรรทัดที่มีสูตร · 1000 ÷ 1.07 × 2 − 430 × 2 = 1869.16 − 860 = 1009.16
  select * into l from cost.v_quote_costing
   where quote_no like 'QT-%-0001' and line_no = 1;
  if l.กำไรบรรทัด <> 1009.16 then
    raise exception 'ข้อ 4 พัง: กำไรบรรทัดควรเป็น 1009.16 แต่ได้ %', l.กำไรบรรทัด;
  end if;
end $$;

\echo ''
\echo '=== 11 · คอลัมน์ที่เคยถูกตัดชื่อทิ้ง มีจริงแล้ว (0038) ==='
select column_name, octet_length(column_name) as ไบต์
from information_schema.columns
where table_schema = 'sales' and table_name = 'v_orders'
  and column_name like 'เลยกำหนด%';

-- ===== 6 · สิทธิ์แยกจริง =====
set local "test.uid" = 'dddddddd-0000-0000-0000-000000000002';

\echo ''
\echo '=== 6 · ฝ่ายขาย (ไม่มี cost.read) เห็นสูตรได้ ==='
select count(*) as บรรทัดในสูตรที่เห็น from production.v_bom_lines;

\echo '=== 6 · แต่ไม่เห็นราคาและต้นทุนเลยแม้แถวเดียว ==='
select
  (select count(*) from cost.component_prices)  as ราคาวัสดุที่เห็น,
  (select count(*) from cost.v_variant_cost)    as ต้นทุนที่เห็น,
  (select count(*) from cost.v_quote_costing
    where ต้นทุนจ่ายต่อหน่วย is not null)        as ต้นทุนในใบที่เห็น;

\echo '=== 6 · แต่ยอดขายในใบเสนอราคายังเห็นได้ปกติ ==='
select เลขที่, ลูกค้า, สถานะ, เงื่อนไขค่าส่ง, ยอดรวมทั้งใบ_vat
from sales.v_quotes where เลขที่ like 'QT-%' order by เลขที่;

do $$
declare n int;
begin
  select count(*) into n from production.v_bom_lines;
  if n = 0 then
    raise exception 'ข้อ 6 พัง: ฝ่ายขายควรเห็นสูตรได้ แต่เห็น 0 บรรทัด · '
      'จัดซื้อจะสั่งของไม่ได้';
  end if;

  select count(*) into n from cost.v_variant_cost;
  if n <> 0 then
    raise exception 'ข้อ 6 พัง: ฝ่ายขายเห็นต้นทุน % แถว ซึ่งไม่ควรเห็นเลย', n;
  end if;

  select count(*) into n from cost.component_prices;
  if n <> 0 then
    raise exception 'ข้อ 6 พัง: ฝ่ายขายอ่านราคาวัสดุตรงจากตารางได้ % แถว', n;
  end if;

  -- เขียนราคาเองก็ต้องไม่ได้
  begin
    insert into cost.component_prices (component_id, price_per_unit)
      select id, 1 from production.components limit 1;
    raise exception 'ข้อ 6 พัง: ฝ่ายขายเขียนราคาต้นทุนได้';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm like 'ข้อ 6 พัง%' then raise; end if;
  end;

  select count(*) into n from sales.v_quotes where เลขที่ like 'QT-%';
  if n < 2 then
    raise exception 'ข้อ 6 พัง: ฝ่ายขายควรเห็นใบเสนอราคาของตัวเอง แต่เห็น % ใบ', n;
  end if;
end $$;

\echo ''
\echo '=== ผ่านทุกข้อ ==='

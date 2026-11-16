-- จำลองออกใบเสนอราคางานโครงการ (H2B MF-06A) · 2026-11-16
-- 🔒 ตัวเลขทุกตัวสมมติ ไม่ใช่ต้นทุนจริง · รัน: psql -1 -v ON_ERROR_STOP=1 -d t1 -f supabase/tests/sim_project_quote.sql
-- ผลและข้อสรุป: docs/project-job/README.md
\pset border 1
\pset format aligned
insert into auth.users (id) values ('cccccccc-0000-0000-0000-0000000000a1') on conflict do nothing;
insert into core.app_users (id, email, full_name, status)
  values ('cccccccc-0000-0000-0000-0000000000a1','sim@test','เจ้าของ (จำลอง)','ใช้งาน') on conflict do nothing;
insert into core.user_capabilities (user_id, capability)
  select 'cccccccc-0000-0000-0000-0000000000a1', c from unnest(enum_range(null::core.capability)) c on conflict do nothing;
set local role authenticated;
set local "test.uid" = 'cccccccc-0000-0000-0000-0000000000a1';

create temp table ids (k text primary key, v uuid);
insert into crm.customers (name, kind) values ('ลูกค้าโครงการ (จำลอง)', 'นิติบุคคล') returning id \gset cust_
insert into ids values ('cust', :'cust_id');

\echo '=== รอบ A · งานสั่งทำ ไม่มีในแคตตาล็อก ไม่ใส่ราคา ==='
select sales.create_quote(:'cust_id') as qa \gset
\set ON_ERROR_STOP 0
savepoint a;
select sales.add_quote_line(:'qa', null, 83, null, 'MF-06A โซฟา 2200x900x730');
rollback to a;
\set ON_ERROR_STOP 1

\echo '=== รอบ B · พิมพ์ราคาเอง (เลขสมมติ 10,000) ==='
select sales.add_quote_line(:'qa', null, 83, 10000, 'MF-06A โซฟา 2200x900x730') as l \gset
select รายการ, จำนวน, ราคาต่อหน่วยรวม_vat, ต้นทุนจ่ายต่อหน่วย, กำไรบรรทัด_pct, ลดได้ถึงราคานี้, ยังไม่มีสูตรวัสดุ
  from cost.v_quote_costing where quote_id = :'qa';

\echo '=== รอบ C · ลงทะเบียน MF-06A + สูตร + ราคาวัสดุ (เลขสมมติทั้งหมด) ==='
do $$
declare v_brand uuid; v_cat uuid; v_prod uuid; v_var uuid; v_bom uuid;
begin
  insert into catalog.brands (name) values ('งานโครงการ (จำลอง)') returning id into v_brand;
  insert into catalog.categories (name) values ('งานสั่งทำ (จำลอง)') returning id into v_cat;
  insert into catalog.products (collection, brand_id, category_id, status)
    values ('H2B MF-06A', v_brand, v_cat, 'ขายอยู่') returning id into v_prod;
  insert into catalog.product_variants (sku, product_id, configuration, material_grade, status)
    values (catalog.mint_sku(), v_prod, '2200x900x730', 'Octavia-J', 'ขายอยู่') returning id into v_var;
  insert into ids values ('var', v_var), ('prod', v_prod);

  insert into production.components (code, name, kind, uom, default_recovery) values
    ('SIM-WOOD',   'โครงไม้ + ฐานไม้แอช',   'อะไหล่',    'ชุด',    1.0),
    ('SIM-FOAM',   'ฟองน้ำ',                'ไส้',       'ชิ้น',   0.9),
    ('SIM-FAB',    'ผ้า Octavia-J',         'วัสดุหุ้ม', 'เมตร',  0.8),
    ('SIM-PILLOW', 'หมอนอิง 4 ใบ',          'อะไหล่',    'ชุด',    1.0),
    ('SIM-LABOUR', 'ค่าแรง',                'ค่าแรง',    'ตัว',    1.0),
    ('SIM-POCKET', 'พ็อกเก็ตสปริงในเบาะ',    'ไส้',       'ชุด',    1.0),
    ('SIM-SPRING', 'สปริงพื้น',              'อะไหล่',    'ชุด',    1.0),
    ('SIM-NEW',    'วัสดุที่ยังไม่รู้ราคา',    'อะไหล่',    'ชุด',    1.0);
  perform cost.set_component_price('SIM-WOOD',   2000, 'PO', false);
  perform cost.set_component_price('SIM-FOAM',    900, 'PO', false);
  perform cost.set_component_price('SIM-FAB',     200, 'ใบเสนอราคา', false);
  perform cost.set_component_price('SIM-PILLOW',  600, 'PO', false);
  perform cost.set_component_price('SIM-LABOUR', 1500, 'ประเมิน', true);
  perform cost.set_component_price('SIM-POCKET',  800, 'ประเมิน', true);
  perform cost.set_component_price('SIM-SPRING',  500, 'ประเมิน', true);

  insert into production.boms (product_id, size_label, note)
    values (v_prod, null, 'REV แรก · ฟองน้ำล้วน') returning id into v_bom;
  perform production.add_bom_line(v_bom, 'SIM-WOOD',   1);
  perform production.add_bom_line(v_bom, 'SIM-FOAM',   1.8);
  perform production.add_bom_line(v_bom, 'SIM-FAB',    12);
  perform production.add_bom_line(v_bom, 'SIM-PILLOW', 1);
  perform production.add_bom_line(v_bom, 'SIM-LABOUR', 1);
  perform production.activate_bom(v_bom);
  insert into ids values ('bom1', v_bom);
  insert into cost.pricing_policy (product_id, gross_margin_pct) values (v_prod, 30.00);
end $$;

select line_no, รหัสวัสดุ, net, ได้เนื้อ, ปริมาณที่ต้องซื้อ, ราคาต่อหน่วย, มูลค่า, เป็นค่าประเมิน
  from cost.v_bom_cost where sku = (select sku from catalog.product_variants where id=(select v from ids where k='var')) order by line_no;
select รุ่น, ต้นทุนผลิต, กำไรที่ตั้งไว้_pct, ราคาตามนโยบาย, พื้นส่วนลดรวม_vat, ยังเป็นค่าประเมิน_pct, บรรทัดที่ยังไม่ครบ
  from cost.v_variant_cost where variant_id=(select v from ids where k='var');

\echo '=== ออกใบเสนอราคาจากราคาตามนโยบาย (ราคาก่อน VAT x 1.07) ==='
select sales.create_quote(:'cust_id') as qc \gset
select round(ราคาตามนโยบาย * 1.07, 0) as p from cost.v_variant_cost where variant_id=(select v from ids where k='var') \gset
select sales.add_quote_line(:'qc', (select v from ids where k='var'), 83, :p) as l2 \gset
select รายการ, จำนวน, ราคาต่อหน่วยรวม_vat, ต้นทุนจ่ายต่อหน่วย, กำไรบรรทัด_pct, ลดได้ถึงราคานี้, ยังเป็นค่าประเมิน_pct
  from cost.v_quote_costing where quote_id = :'qc';
\set ON_ERROR_STOP 0
savepoint s1;
select sales.send_quote(:'qc');
rollback to s1;
\set ON_ERROR_STOP 1
select sales.set_quote_shipping(:'qc', 'ส่งฟรี');
select sales.send_quote(:'qc');
select quote_no, status from sales.quotes where id=:'qc';

\echo '=== รอบ D · ลูกค้าคอมเมนต์: เปลี่ยนเป็นสปริง → ออก revision 2 ของสูตร ==='
do $$
declare v_new uuid;
begin
  v_new := production.new_revision((select v from ids where k='bom1'), 'REV.02 · เพิ่มพ็อกเก็ตสปริง + สปริงพื้น');
  perform production.add_bom_line(v_new, 'SIM-POCKET', 1);
  perform production.add_bom_line(v_new, 'SIM-SPRING', 1);
  perform production.activate_bom(v_new);
  insert into ids values ('bom2', v_new);
end $$;
select b.revision, b.status, b.note from production.boms b where product_id=(select v from ids where k='prod') order by revision;
select รุ่น, ต้นทุนผลิต, ราคาตามนโยบาย, พื้นส่วนลดรวม_vat, ยังเป็นค่าประเมิน_pct
  from cost.v_variant_cost where variant_id=(select v from ids where k='var');
\echo '--- ใบเสนอราคาใบเดิมที่ส่งไปแล้ว (ราคาไม่เปลี่ยน) ---'
select quote_no, รายการ, ราคาต่อหน่วยรวม_vat, ต้นทุนจ่ายต่อหน่วย, กำไรบรรทัด_pct, กำไรบรรทัด
  from cost.v_quote_costing where quote_id = :'qc';

\echo '=== รอบ E · สูตรมีวัสดุที่ยังไม่มีราคา ==='
do $$
declare v_new uuid;
begin
  v_new := production.new_revision((select v from ids where k='bom2'), 'REV.03 · มีวัสดุใหม่ยังไม่รู้ราคา');
  perform production.add_bom_line(v_new, 'SIM-NEW', 1);
  perform production.activate_bom(v_new);
end $$;
select รุ่น, ต้นทุนผลิต, ต้นทุนที่คิดได้แล้ว, บรรทัดที่ยังไม่ครบ, ราคาตามนโยบาย
  from cost.v_variant_cost where variant_id=(select v from ids where k='var');

\echo '=== มีที่เก็บ: revision แบบ / ผลอนุมัติ / ใบสั่งผลิตแยกแผนก ไหม ==='
select table_schema, table_name from information_schema.tables
 where table_schema in ('production','sales','cost') and table_type='BASE TABLE' order by 1,2;

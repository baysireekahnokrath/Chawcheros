-- ============================================================================
-- ทดสอบ ข้อมูลจาก Google Sheet (0035)
-- ============================================================================
--   psql -1 -v ON_ERROR_STOP=1 -d t1 -f supabase/tests/16_sheets.sql
--
--   1 ดึงซ้ำ = แทนที่ทั้งชุด ไม่ซ้อน · สถานะการดึงอัปเดต
--   2 ★ BLS ที่มีแต่ในชีต บอทตอบได้ · มีราคา (เปิดแล้ว) · ไม่มีข้อมูลลูกค้า
--   3 ★ กำหนดส่งที่มีชื่อคนรับ/ชั้น/ตึก ไม่หลุดเข้าห้อง
--   4 ออเดอร์ในระบบชนะชีต (เลขเดียวกัน)
--   5 งานตามวันรวมระบบ+ชีต · นับงานที่วันส่งเป็นข้อความ
--   6 Clearance หมดอายุ = ไม่คืนราคา
--   7 สต็อกจากชีต ค้นได้ · ไม่มีต้นทุน
--   8 ★ คนล็อกอินทั่วไปเขียนข้อมูลชีตไม่ได้
-- ============================================================================

do $$
declare j jsonb; n int; t date := line_agent.today(); v_cust uuid;
begin
  -- ===== ข้อ 1 =====
  perform sheets.replace_source('orders', jsonb_build_array(
    jsonb_build_object('bls','BLS7001','wo','83/26','ordered_on','2026-10-01','delivery_text','อ.10 พ.ย.69',
                       'delivery_on', (t + 5)::text, 'items_text','Koontong Sideboard Walnut x 1 Pcs.','sheet_rows','10-11'),
    jsonb_build_object('bls','BLS7002','wo','รอW/O','ordered_on', (t - 10)::text,
                       'delivery_text','ศ 10/7 ส่งของให้คุณเปิ้ล ชั้น 28 ตึก H','delivery_on', null,
                       'items_text','Emu Chair x 2','sheet_rows','12'),
    jsonb_build_object('bls','BLS7003','wo',null,'ordered_on', (t - 5)::text,'delivery_text','ปลายเดือน พ.ค./69',
                       'delivery_on', null,'items_text','Bird (S)','sheet_rows','13')
  ), '{"tab":"order2026"}');
  perform sheets.replace_source('orders', jsonb_build_array(
    jsonb_build_object('bls','BLS7001','wo','83/26','delivery_on', (t + 5)::text, 'items_text','Koontong'),
    jsonb_build_object('bls','BLS7002','wo','รอW/O','ordered_on', (t - 10)::text,
                       'delivery_text','ศ 10/7 ส่งของให้คุณเปิ้ล ชั้น 28 ตึก H','items_text','Emu Chair x 2'),
    jsonb_build_object('bls','BLS7003','ordered_on', (t - 5)::text,'delivery_text','ปลายเดือน พ.ค./69','items_text','Bird (S)')
  ), '{"tab":"order2026"}');
  select count(*) into n from sheets.orders;
  if n <> 3 then raise exception 'ข้อ 1 พัง: ดึงซ้ำแล้วควรเหลือ 3 แถว ได้ %', n; end if;
  if (select rows from sheets.sources where id = 'orders') <> 3 or
     (select last_ok_at from sheets.sources where id = 'orders') is null then
    raise exception 'ข้อ 1 พัง: สถานะการดึงไม่อัปเดต';
  end if;
  raise notice 'ข้อ 1 ผ่าน · ดึงซ้ำแทนที่ทั้งชุด · สถานะอัปเดต';

  perform sheets.replace_source('po', jsonb_build_array(
    jsonb_build_object('bls','BLS7001','line_no',1,'name','ฌ เฌอ | ตู้เก็บของ ขุนทอง (Koontong Sideboard)',
                       'spec','ไม้โอ๊ค สีวอลนัท | ขนาด W120 D43.5 H79 cm','note',null,'qty',1,'unit_price',35680,'tab','7001')
  ), '{}');

  -- ===== ข้อ 2 =====
  j := line_agent._order_full('7001');
  if j is null or j->>'source' <> 'ชีต' then raise exception 'ข้อ 2 พัง: หา BLS7001 จากชีตไม่เจอ %', j; end if;
  if (j->'lines'->0->>'unit_price')::numeric <> 35680 then raise exception 'ข้อ 2 พัง: ราคาไม่มา %', j; end if;
  if j->>'wo' <> '83/26' then raise exception 'ข้อ 2 พัง: w/o'; end if;
  if j::text ~ '(customer|ลูกค้า|address)' then raise exception 'ข้อ 2 พัง: มีช่องข้อมูลลูกค้า %', j; end if;
  if (line_agent._order_full('BLS7003')->>'items_text') <> 'Bird (S)' then
    raise exception 'ข้อ 2 พัง: ไม่มี PO tab ต้องใช้ช่องรายการแทน';
  end if;
  raise notice 'ข้อ 2 ผ่าน · ตอบจากชีตได้ · มีราคา · ไม่มีข้อมูลลูกค้า';

  -- ===== ข้อ 3 =====
  j := line_agent._order_full('7002');
  if j->>'delivery_text' <> 'ดูในชีต' then raise exception 'ข้อ 3 พัง: ชื่อคนรับหลุด %', j->>'delivery_text'; end if;
  if (line_agent._order_full('7003')->>'delivery_text') <> 'ปลายเดือน พ.ค./69' then raise exception 'ข้อ 3 พัง: ข้อความสั้นควรผ่าน'; end if;
  raise notice 'ข้อ 3 ผ่าน · ข้อความที่มีชื่อคน/ชั้น/ตึก ไม่เข้าห้อง';

  -- ===== ข้อ 4 =====
  insert into crm.customers (kind, name) values ('บุคคล', 'ทดสอบ') returning id into v_cust;
  insert into sales.orders (order_no, customer_id, work_order_no, status)
    values ('BLS7001', v_cust, '99/26', 'ยืนยันแล้ว');
  if (line_agent._order_full('BLS7001')->>'source') <> 'ระบบ' then raise exception 'ข้อ 4 พัง: ระบบต้องชนะชีต'; end if;
  raise notice 'ข้อ 4 ผ่าน · เลขเดียวกัน ระบบชนะชีต';
end $$;

do $$
declare n int; t date := line_agent.today(); j jsonb;
begin
  -- ===== ข้อ 5 · BLS7001 อยู่ในระบบแล้ว (ไม่มีวันต้องเสร็จ) จึงไม่นับจากชีตซ้ำ =====
  update sheets.orders set bls = 'BLS7004' where bls = 'BLS7001';
  select count(*) into n from line_agent._orders_due_full(t, t + 7) where source = 'ชีต' and due_kind = 'ส่ง';
  if n <> 1 then raise exception 'ข้อ 5 พัง: งานส่งใน 7 วันจากชีตควรมี 1 ได้ %', n; end if;
  if line_agent.room_orders_undated() <> 2 then raise exception 'ข้อ 5 พัง: งานวันส่งเป็นข้อความควรมี 2'; end if;
  raise notice 'ข้อ 5 ผ่าน · รวมงานระบบ+ชีต · นับงานที่ไม่มีวันชัดได้';

  -- ===== ข้อ 6 =====
  perform sheets.replace_source('clearance', jsonb_build_array(
    jsonb_build_object('row_no',2,'full_name','ฌ เฌอ | ชั้นวางทีวี ขุนทอง (Koontong TV cabinet) สีวอลนัท',
                       'collection','ขุนทอง','retail',49900,'disc_pct','40%','price',29940)), '{}');
  update sheets.sources set expires_on = t + 10 where id = 'clearance';
  j := line_agent._clearance_full('ขุนทอง');
  if jsonb_array_length(j->'items') <> 1 then raise exception 'ข้อ 6 พัง: ยังไม่หมดอายุควรเจอ %', j; end if;
  update sheets.sources set expires_on = t - 1 where id = 'clearance';
  j := line_agent._clearance_full('ขุนทอง');
  if jsonb_array_length(j->'items') <> 0 or not (j->>'expired')::boolean then
    raise exception 'ข้อ 6 พัง: หมดอายุแล้วยังคืนราคา %', j;
  end if;
  raise notice 'ข้อ 6 ผ่าน · หมดอายุแล้วไม่คืนราคา';

  -- ===== ข้อ 7 =====
  perform sheets.replace_source('stock', jsonb_build_array(
    jsonb_build_object('row_no',8,'product','Koontong Sideboard','brand','Chaw Cher','category','ตู้เก็บของ',
                       'material','Oak','color','Walnut','total',2,
                       'by_place', jsonb_build_object('ASE-เพื่อขาย','2','ของเสีย(ASE)','1 =บุบ','ชอบใจ Studio',''))), '{}');
  perform sheets.replace_source('fabric', jsonb_build_array(
    jsonb_build_object('group_name','หนัง','name','SM-WHEAT','stock_text','1,777.50','stock',1777.5)), '{}');
  select count(*) into n from line_agent.room_stock('koontong sideboard');
  if n <> 1 then raise exception 'ข้อ 7 พัง: ค้น Koontong ควรเจอ 1 ได้ %', n; end if;
  if (select location from line_agent.room_stock('koontong')) ~ 'ชอบใจ' then
    raise exception 'ข้อ 7 พัง: ที่ว่างไม่ควรแสดง';
  end if;
  select count(*) into n from line_agent.room_stock('wheat');
  if n <> 1 then raise exception 'ข้อ 7 พัง: ค้นหนัง SM-WHEAT ไม่เจอ'; end if;
  raise notice 'ข้อ 7 ผ่าน · ค้นสต็อกสินค้าและหนังจากชีตได้';
end $$;

-- ===== ข้อ 8 =====
set local role authenticated;
do $$
begin
  begin
    perform sheets.replace_source('orders', '[]'::jsonb, '{}'::jsonb);
    raise exception 'ข้อ 8 พัง: คนทั่วไปเขียนข้อมูลชีตได้';
  exception when insufficient_privilege then null;
  end;
  begin
    perform line_agent.room_clearance('x', 'g');
    raise exception 'ข้อ 8 พัง: คนทั่วไปเรียกประตูบอทได้';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ข้อ 8 ผ่าน · คนทั่วไปเขียนข้อมูลชีตและเรียกประตูบอทไม่ได้';
end $$;
reset role;

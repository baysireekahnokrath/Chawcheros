-- ============================================================================
-- ทดสอบ 0036 · สิทธิ์รายกลุ่ม · สลิป · รูปงานเสร็จ · คำขอ · ใบงานผลิต
-- ============================================================================
--   psql -1 -v ON_ERROR_STOP=1 -d t1 -f supabase/tests/17_line_rooms_slips.sql
--   (รันหลัง 15 และ 16)
--
--   1 ★ กลุ่มเดียวกันข้อมูลเดียวกัน · กลุ่ม PO เห็นราคา+ลูกค้า+ยอด · กลุ่ม progress ไม่เห็น
--   2 ★ ห้องที่ไม่อนุมัติ ได้ null
--   3 Clearance: กลุ่มที่ไม่เห็นราคา ได้แค่ "hidden"
--   4 จับคู่สลิปจากชื่อ+ยอด · ตัดคำนำหน้าชื่อ
--   5 สลิปซ้ำ (เลขอ้างอิงเดิม) = สถานะ "ซ้ำ" · ไม่ใช่สลิป = ไม่มีตัวเลือก
--   6 เลือก BLS จากกลุ่ม: "ใช่" · "2" · "BLS…"
--   7 ★ กลุ่มที่ไม่ได้เปิดสลิป/รูป ใช้ไม่ได้
--   8 ใบงานผลิต: ครั้งแรกตั้งต้น ไม่ส่งของเก่า · BLS ใหม่ส่งครั้งเดียว
--   9 ★ คนขายอ่านสลิปไม่ได้ · การเงินอ่านได้
-- ============================================================================

do $$
declare j jsonb; t date := line_agent.today(); s jsonb; n int;
begin
  insert into line_agent.rooms (group_id, name, status, see_price, see_customer, see_money, can_slip, push_worksheet)
    values ('Gpo', 'CC - PO และ production', 'อนุมัติ', true, true, true, true, true);
  insert into line_agent.rooms (group_id, name, status, customer_draft)
    values ('Gprog', 'CC - Check progress', 'อนุมัติ', true);
  insert into line_agent.rooms (group_id, name, status, can_photo, can_slip)
    values ('Gwait', 'ห้องใหม่', 'รออนุมัติ', true, true);
  insert into line_agent.rooms (group_id, name, status, can_photo)
    values ('Gqc', 'CC- เช็คงาน', 'อนุมัติ', true);

  perform sheets.replace_source('orders', jsonb_build_array(
    jsonb_build_object('bls','BLS8001','wo','90/26','ordered_on', (t - 20)::text, 'delivery_on', (t + 3)::text, 'items_text','Emu'),
    jsonb_build_object('bls','BLS8002','ordered_on', (t - 2)::text, 'items_text','Kamin'),
    jsonb_build_object('bls','BLS8003','ordered_on', (t - 1)::text, 'items_text','Bird')), '{}');
  perform sheets.replace_source('money', jsonb_build_array(
    jsonb_build_object('bls','BLS8001','customer_name','คุณสมชาย ใจดี','total_sales',30000,'balance',15000),
    jsonb_build_object('bls','BLS8002','customer_name','คุณสมชาย ใจดี','total_sales',8000,'balance',8000),
    jsonb_build_object('bls','BLS8003','customer_name','บริษัท ฟ้าใส จำกัด','total_sales',50000,'balance',20000)), '{}');
  perform sheets.replace_source('po', jsonb_build_array(
    jsonb_build_object('bls','BLS8001','line_no',1,'name','Emu Sofa','qty',1,'unit_price',29000,'tab','8001')), '{}');

  -- ===== ข้อ 1 =====
  j := line_agent.room_order('8001', 'Gpo');
  if (j->'lines'->0->>'unit_price')::numeric <> 29000 or j->>'customer_name' <> 'คุณสมชาย ใจดี'
     or (j->>'balance')::numeric <> 15000 then
    raise exception 'ข้อ 1 พัง: กลุ่ม PO ควรเห็นราคา ลูกค้า ยอด %', j;
  end if;
  j := line_agent.room_order('8001', 'Gprog');
  if j->'lines'->0 ? 'unit_price' or j ? 'customer_name' or j ? 'balance' then
    raise exception 'ข้อ 1 พัง: กลุ่ม progress ไม่ควรเห็นราคา/ลูกค้า/ยอด %', j;
  end if;
  if (select customer_name from line_agent.room_orders_due(t, t + 7, 'Gpo') where order_no = 'BLS8001') <> 'คุณสมชาย ใจดี'
     or (select customer_name from line_agent.room_orders_due(t, t + 7, 'Gprog') where order_no = 'BLS8001') is not null then
    raise exception 'ข้อ 1 พัง: รายการตามวัน ชื่อลูกค้าไม่ตรงสิทธิ์';
  end if;
  raise notice 'ข้อ 1 ผ่าน · กลุ่ม PO เห็นราคา ลูกค้า ยอด · กลุ่ม progress ไม่เห็น';

  -- ===== ข้อ 2 =====
  if line_agent.room_order('8001', 'Gwait') is not null or line_agent.room_order('8001', 'ไม่มี') is not null then
    raise exception 'ข้อ 2 พัง: ห้องไม่อนุมัติต้องได้ null';
  end if;
  raise notice 'ข้อ 2 ผ่าน · ห้องไม่อนุมัติไม่ได้ข้อมูล';

  -- ===== ข้อ 3 =====
  if not (line_agent.room_clearance('x', 'Gprog')->>'hidden')::boolean then raise exception 'ข้อ 3 พัง'; end if;
  if line_agent.room_clearance('x', 'Gpo') ? 'hidden' then raise exception 'ข้อ 3 พัง: กลุ่ม PO ต้องเห็น'; end if;
  raise notice 'ข้อ 3 ผ่าน · Clearance ตามสิทธิ์ราคา';

  -- ===== ข้อ 4 =====
  j := line_agent.slip_candidates('นาย สมชาย ใจดี', 15000);
  if j->0->>'bls' <> 'BLS8001' or (j->0->>'score')::int <> 4 or jsonb_array_length(j) <> 2 then
    raise exception 'ข้อ 4 พัง: ชื่อ+ยอดตรง ต้องได้ BLS8001 ก่อน %', j;
  end if;
  j := line_agent.slip_candidates('บจก. ฟ้าใส', null);
  if j->0->>'bls' <> 'BLS8003' then raise exception 'ข้อ 4 พัง: ตัดคำนำหน้าบริษัท %', j; end if;
  if jsonb_array_length(line_agent.slip_candidates('นาง ไม่มีใคร', 1)) <> 0 then raise exception 'ข้อ 4 พัง: ไม่ตรงต้องว่าง'; end if;
  raise notice 'ข้อ 4 ผ่าน · จับคู่สลิปจากชื่อ+ยอด';

  -- ===== ข้อ 5 =====
  s := line_agent.slip_add(jsonb_build_object('group_id','Gpo','line_message_id','m1','image_path','x/m1.jpg',
        'line_user_id','U1','is_slip',true,'amount',15000,'payer_name','นาย สมชาย ใจดี','ref','REF123','paid_on', t::text));
  if s->>'status' <> 'รอเลือก BLS' or jsonb_array_length(s->'candidates') <> 2 then raise exception 'ข้อ 5 พัง %', s; end if;
  s := line_agent.slip_add(jsonb_build_object('group_id','Gpo','line_message_id','m2','image_path','x/m2.jpg',
        'line_user_id','U1','is_slip',true,'amount',15000,'payer_name','นาย สมชาย ใจดี','ref','REF123'));
  if s->>'status' <> 'ซ้ำ' then raise exception 'ข้อ 5 พัง: สลิปซ้ำ %', s->>'status'; end if;
  s := line_agent.slip_add(jsonb_build_object('group_id','Gpo','line_message_id','m3','image_path','x/m3.jpg',
        'line_user_id','U2','is_slip',false));
  if s->>'status' <> 'ไม่ใช่สลิป' then raise exception 'ข้อ 5 พัง: ไม่ใช่สลิป'; end if;
  raise notice 'ข้อ 5 ผ่าน · กันสลิปซ้ำ · รูปที่ไม่ใช่สลิปไม่จับคู่';

  -- ===== ข้อ 6 =====
  s := line_agent.slip_pick('Gpo', 'U1', 'ใช่');
  if s->>'bls' <> 'BLS8001' or s->>'status' <> 'รอการเงินยืนยัน' then raise exception 'ข้อ 6 พัง: ใช่ %', s; end if;
  perform line_agent.slip_add(jsonb_build_object('group_id','Gpo','line_message_id','m4','image_path','x/m4.jpg',
        'line_user_id','U1','is_slip',true,'amount',8000,'payer_name','สมชาย','ref','REF999'));
  s := line_agent.slip_pick('Gpo', 'U1', '2');
  if s->>'bls' is null then raise exception 'ข้อ 6 พัง: เลือกเลข 2 %', s; end if;
  perform line_agent.slip_add(jsonb_build_object('group_id','Gpo','line_message_id','m5','image_path','x/m5.jpg',
        'line_user_id','U1','is_slip',true,'amount',1,'payer_name','ใครก็ไม่รู้','ref','REF555'));
  s := line_agent.slip_pick('Gpo', 'U1', 'bls 8003');
  if s->>'bls' <> 'BLS8003' then raise exception 'ข้อ 6 พัง: พิมพ์เลข BLS %', s; end if;
  if line_agent.slip_pick('Gpo', 'U9', 'ใช่') is not null then raise exception 'ข้อ 6 พัง: คนอื่นไม่ควรเลือกแทน'; end if;
  raise notice 'ข้อ 6 ผ่าน · เลือก BLS ได้ 3 แบบ · เลือกแทนคนอื่นไม่ได้';

  -- ===== ข้อ 7 =====
  begin
    perform line_agent.slip_add(jsonb_build_object('group_id','Gprog','line_message_id','m6','image_path','x','is_slip',true));
    raise exception 'ข้อ 7 พัง: กลุ่ม progress อ่านสลิปได้';
  exception when raise_exception then if sqlerrm like 'ข้อ 7 พัง%' then raise; end if;
  end;
  begin
    perform line_agent.photo_add(jsonb_build_object('group_id','Gwait','bls','8001','line_message_id','p0','image_path','x'));
    raise exception 'ข้อ 7 พัง: ห้องไม่อนุมัติเก็บรูปได้';
  exception when raise_exception then if sqlerrm like 'ข้อ 7 พัง%' then raise; end if;
  end;
  n := line_agent.photo_add(jsonb_build_object('group_id','Gqc','bls','8001','line_message_id','p1','image_path','x/p1.jpg'));
  if n <> 1 or (line_agent.room_order('8001', 'Gprog')->>'photos')::int <> 1 then raise exception 'ข้อ 7 พัง: รูปงานเสร็จ'; end if;
  raise notice 'ข้อ 7 ผ่าน · สลิป/รูป ทำได้เฉพาะกลุ่มที่เปิด · รูปงานเสร็จขึ้นในคำตอบ';

  -- ===== ข้อ 8 =====
  delete from line_agent.worksheet_pushes where true;
  if jsonb_array_length(line_agent.worksheets_pending()) <> 0 then raise exception 'ข้อ 8 พัง: ครั้งแรกต้องไม่ส่งของเก่า'; end if;
  insert into sheets.po_lines (bls, line_no, name, qty, tab) values ('BLS8009', 1, 'Taka Sofa', 1, '8009');
  j := line_agent.worksheets_pending();
  if jsonb_array_length(j) <> 1 or j->0->>'bls' <> 'BLS8009' or j::text ~ 'unit_price' then raise exception 'ข้อ 8 พัง %', j; end if;
  perform line_agent.worksheet_sent('BLS8009', 1, null);
  if jsonb_array_length(line_agent.worksheets_pending()) <> 0 then raise exception 'ข้อ 8 พัง: ส่งซ้ำ'; end if;
  if (select count(*) from line_agent.worksheet_rooms()) <> 1 then raise exception 'ข้อ 8 พัง: ห้องที่รับใบงาน'; end if;
  raise notice 'ข้อ 8 ผ่าน · ใบงานผลิตไม่ส่งของเก่า · ไม่ส่งซ้ำ · ไม่มีราคา';

  perform line_agent.change_add('Gprog', '8001', 'ลูกค้าขอเลื่อนเป็นวันที่ 20', 'Usa');
  if (select count(*) from line_agent.change_requests where bls = 'BLS8001' and status = 'เปิด') <> 1 then
    raise exception 'คำขอค้างไม่ถูกจด';
  end if;
  raise notice 'คำขอเลื่อน/เปลี่ยน จดค้างไว้แล้ว';
end $$;

-- ===== ข้อ 9 =====
insert into auth.users (id) values ('cccccccc-0000-0000-0000-000000000003'), ('dddddddd-0000-0000-0000-000000000004') on conflict do nothing;
insert into core.app_users (id, email, full_name, status) values
  ('cccccccc-0000-0000-0000-000000000003', 'sales9@test', 'ขาย', 'ใช้งาน'),
  ('dddddddd-0000-0000-0000-000000000004', 'fin9@test', 'การเงิน', 'ใช้งาน') on conflict do nothing;
insert into core.user_capabilities (user_id, capability) values
  ('cccccccc-0000-0000-0000-000000000003', 'sales.write'),
  ('dddddddd-0000-0000-0000-000000000004', 'finance.write') on conflict do nothing;

set local role authenticated;
set local "test.uid" = 'cccccccc-0000-0000-0000-000000000003';
do $$ begin
  if (select count(*) from line_agent.slips) <> 0 then raise exception 'ข้อ 9 พัง: ฝ่ายขายเห็นสลิป'; end if;
  if (select count(*) from sheets.order_money) <> 0 then raise exception 'ข้อ 9 พัง: ฝ่ายขายเห็นยอดเงินจากชีต'; end if;
end $$;
set local "test.uid" = 'dddddddd-0000-0000-0000-000000000004';
do $$ begin
  if (select count(*) from line_agent.slips) < 4 then raise exception 'ข้อ 9 พัง: การเงินต้องเห็นสลิป'; end if;
  update line_agent.slips set status = 'ยืนยันแล้ว' where bls = 'BLS8001';
  raise notice 'ข้อ 9 ผ่าน · ฝ่ายขายไม่เห็นสลิป/ยอดเงิน · การเงินเห็นและยืนยันได้';
end $$;
reset role;

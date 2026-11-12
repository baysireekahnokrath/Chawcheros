-- ============================================================================
-- ทดสอบ LINE agent (0034)
-- ============================================================================
-- รัน · ต้องมี -1
--   psql -1 -v ON_ERROR_STOP=1 -d t1 -f supabase/tests/15_line_agent.sql
--
-- สิ่งที่ต้องพิสูจน์
--   1 เลข BLS พิมพ์หลายแบบ เทียบกันได้ (D9 · S3)
--   2 ★ room_order ไม่มีลูกค้า ไม่มีที่ส่ง · ไม่แสดงบรรทัดค่าขนส่ง (LR-11)
--     ราคาขายเปิดแล้ว (Bay 2026-11-02 · 0035) · ต้นทุนยังไม่มีในประตูนี้
--   3 งานใกล้ครบกำหนด / เลยกำหนด เฉพาะออเดอร์ยืนยันแล้ว
--   4 ★ คนล็อกอินทั่วไปและ anon เรียกประตูของบอทไม่ได้
--   5 webhook ซ้ำ = รับครั้งเดียว (LR-4)
--   6 ห้องใหม่ = รออนุมัติ · บอทออกแล้วเชิญใหม่ = รออนุมัติอีกรอบ (LR-3)
--   7 "ตอบผิด" ติดธงคำตอบล่าสุด (LR-28 · LR-29)
--   8 ค้นวัสดุ · ทุกคำต้องเจอ
--   9 ห้ามลบบันทึก (A7)
-- ============================================================================

do $$
declare v_cust uuid; v_addr uuid; v_o1 uuid; v_o2 uuid; j jsonb; n int; t date := line_agent.today();
begin
  -- ===== ข้อ 1 =====
  if line_agent.norm_order_no('bls 3175') <> 'BLS3175'
     or line_agent.norm_order_no('3175') <> 'BLS3175'
     or line_agent.norm_order_no(E'ิBLS3175') <> 'BLS3175'
     or line_agent.norm_order_no('BLS3181a') <> 'BLS3181A'
     or line_agent.norm_order_no('3181A') <> 'BLS3181A' then
    raise exception 'ข้อ 1 พัง';
  end if;
  raise notice 'ข้อ 1 ผ่าน · bls 3175 / 3175 / สระนำหน้า / 3181A เทียบได้หมด';

  -- ===== ข้อมูลทดสอบ =====
  insert into crm.customers (kind, name, phone) values ('บุคคล', 'ลูกค้าลับ (ทดสอบ)', '099-999-9999')
    returning id into v_cust;
  insert into crm.customer_addresses (customer_id, label, kind, address, contact_name, is_default)
    values (v_cust, 'บ้าน', 'จัดส่ง', 'ที่อยู่ลับ 123', 'คนรับลับ', true) returning id into v_addr;

  insert into sales.orders (order_no, customer_id, shipping_address_id, work_order_no,
                            required_finish_on, promised_delivery_on, status)
    values ('BLS9001', v_cust, v_addr, '78/26', t + 3, t + 7, 'ยืนยันแล้ว') returning id into v_o1;
  insert into sales.order_lines (order_id, line_no, description, qty, unit_price_incl_vat, note) values
    (v_o1, 1, 'ฌ เฌอ | โซฟา อีมู 3 ที่นั่ง · ผ้า B', 1, 55555, 'Linen-08 เทา'),
    (v_o1, 2, 'ค่าขนส่ง', 1, 365, null);
  insert into sales.orders (order_no, customer_id, required_finish_on, status)
    values ('BLS9003', v_cust, t - 3, 'ยืนยันแล้ว') returning id into v_o2;
  insert into sales.order_lines (order_id, line_no, description, qty, unit_price_incl_vat) values
    (v_o2, 1, 'ฌ เฌอ | ตู้เก็บของ ขุนทอง', 1, 35680);
  insert into sales.orders (order_no, customer_id, required_finish_on, status)
    values ('BLS9009', v_cust, t + 2, 'ร่าง');

  -- ===== ข้อ 2 =====
  j := line_agent._order_full('9001');
  if j is null then raise exception 'ข้อ 2 พัง: หา 9001 ไม่เจอ'; end if;
  if j::text ~ '(ลูกค้าลับ|099-999|ที่อยู่ลับ|คนรับลับ|customer|address|cost)' then
    raise exception 'ข้อ 2 พัง: ข้อมูลลับหลุดออกมา %', j;
  end if;
  if jsonb_array_length(j->'lines') <> 1 then
    raise exception 'ข้อ 2 พัง: ควรเหลือ 1 บรรทัด (ตัดค่าขนส่ง) แต่ได้ %', j->'lines';
  end if;
  if j->>'wo' <> '78/26' or (j->'lines'->0->>'note') <> 'Linen-08 เทา' then
    raise exception 'ข้อ 2 พัง: ข้อมูลงานผลิตไม่ครบ %', j;
  end if;
  if line_agent._order_full('BLS0000') is not null then raise exception 'ข้อ 2 พัง: เลขที่ไม่มีควรได้ null'; end if;
  if (j->'lines'->0->>'unit_price')::numeric <> 55555 then raise exception 'ข้อ 2 พัง: ราคาขายควรมา'; end if;
  raise notice 'ข้อ 2 ผ่าน · มีสเปก หมายเหตุ w/o ราคาขาย · ไม่มีลูกค้า ที่อยู่ · ตัดบรรทัดค่าขนส่ง';

  -- ===== ข้อ 3 =====
  select count(*) into n from line_agent._orders_due_full(t, t + 7);
  if n <> 1 then raise exception 'ข้อ 3 พัง: งาน 7 วันควรมี 1 (BLS9001 · ไม่นับใบร่าง) แต่ได้ %', n; end if;
  select count(*) into n from line_agent._orders_due_full(t - 30, t - 1) where order_no = 'BLS9003';
  if n <> 1 then raise exception 'ข้อ 3 พัง: BLS9003 ควรเลยกำหนด'; end if;
  raise notice 'ข้อ 3 ผ่าน · งานใกล้ครบ/เลยกำหนด นับเฉพาะใบยืนยันแล้ว';

  -- ===== ข้อ 5 =====
  perform line_agent.room_join('Cgroup1', 'CC – PO และ production');
  if not line_agent.claim_event('ev1', 'Cgroup1', 'BLS9001 รายละเอียด') then raise exception 'ข้อ 5 พัง'; end if;
  if line_agent.claim_event('ev1', 'Cgroup1', 'BLS9001 รายละเอียด') then
    raise exception 'ข้อ 5 พัง: เหตุการณ์เดิมรับซ้ำได้';
  end if;
  raise notice 'ข้อ 5 ผ่าน · webhook ซ้ำ รับครั้งเดียว';

  -- ===== ข้อ 6 =====
  if (select status from line_agent.rooms where group_id = 'Cgroup1') <> 'รออนุมัติ' then
    raise exception 'ข้อ 6 พัง: ห้องใหม่ควรรออนุมัติ';
  end if;
  update line_agent.rooms set status = 'อนุมัติ' where group_id = 'Cgroup1';
  perform line_agent.room_leave('Cgroup1');
  perform line_agent.room_join('Cgroup1', null);
  if (select status from line_agent.rooms where group_id = 'Cgroup1') <> 'รออนุมัติ' then
    raise exception 'ข้อ 6 พัง: เชิญกลับมาต้องรออนุมัติใหม่';
  end if;
  raise notice 'ข้อ 6 ผ่าน · ห้องใหม่และห้องที่เชิญกลับ ต้องรอ Bay อนุมัติ';

  -- ===== ข้อ 7 =====
  perform line_agent.finish_request('ev1', jsonb_build_object('status','ตอบแล้ว','answer','BLS9001 …'));
  if line_agent.flag_last('Cgroup1') <> 'BLS9001 รายละเอียด' then raise exception 'ข้อ 7 พัง'; end if;
  if not (select flagged from line_agent.requests where webhook_event_id = 'ev1') then raise exception 'ข้อ 7 พัง'; end if;
  if line_agent.flag_last('Cgroup1') is not null then raise exception 'ข้อ 7 พัง: ติดธงซ้ำ'; end if;
  raise notice 'ข้อ 7 ผ่าน · ตอบผิด = ติดธงคำตอบล่าสุด ครั้งเดียว';

  -- ===== ข้อ 8 =====
  insert into materials.materials (collection_id, name, colour_name, status)
    select id, 'Boucle-02', 'ครีม', 'หมดชั่วคราว' from materials.material_collections order by sort_order limit 1;
  select count(*) into n from line_agent.room_stock('boucle ครีม');
  if n <> 1 then raise exception 'ข้อ 8 พัง: ควรเจอ 1 แต่ได้ %', n; end if;
  if (select bool_or(exact) from line_agent.room_stock('boucle เขียว')) then raise exception 'ข้อ 8 พัง: ไม่ครบทุกคำต้องเป็น "ใกล้เคียง"'; end if;
  select count(*) into n from line_agent.room_stock('ไม่มีรุ่นนี้');
  if n <> 0 then raise exception 'ข้อ 8 พัง: ชื่อรุ่นไม่ตรงต้องไม่เจอ'; end if;
  raise notice 'ข้อ 8 ผ่าน · ค้นสต็อก/วัสดุ · ไม่ครบทุกคำ = ใกล้เคียง · ชื่อรุ่นไม่ตรง = ไม่เจอ';

  -- ===== ข้อ 9 =====
  begin
    delete from line_agent.requests where webhook_event_id = 'ev1';
    raise exception 'ข้อ 9 พัง: ลบบันทึกได้';
  exception when others then
    if sqlerrm like 'ข้อ 9 พัง%' then raise; end if;
  end;
  raise notice 'ข้อ 9 ผ่าน · ลบบันทึกไม่ได้';
end $$;

-- ===== ข้อ 4 · คนล็อกอินทั่วไปเรียกประตูบอทไม่ได้ =====
set local role authenticated;
do $$
begin
  begin
    perform line_agent.room_order('BLS9001', 'Cgroup1');
    raise exception 'ข้อ 4 พัง: authenticated เรียก room_order ได้';
  exception when insufficient_privilege then null;
  end;
  begin
    perform line_agent.claim_event('evX', 'Cgroup1', 'x');
    raise exception 'ข้อ 4 พัง: authenticated เขียนบันทึกได้';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ข้อ 4 ผ่าน · คนล็อกอินทั่วไปเรียกประตูบอทไม่ได้';
end $$;
reset role;

set local role anon;
do $$
begin
  perform line_agent.room_stock('ผ้า');
  raise exception 'ข้อ 4 พัง: anon เรียก room_stock ได้';
exception when insufficient_privilege then
  raise notice 'ข้อ 4 ผ่าน · anon เรียกไม่ได้';
end $$;
reset role;

set local role service_role;
do $$
begin
  perform line_agent.room_stock('ผ้า');
  begin
    perform line_agent._order_full('BLS9001');
    raise exception 'ข้อ 4 พัง: service_role เรียกตัวในที่ไม่ตัดข้อมูลได้';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ข้อ 4 ผ่าน · webhook เรียกได้แค่ประตู · ตัวในที่ไม่ตัดข้อมูลเรียกไม่ได้';
end $$;
reset role;

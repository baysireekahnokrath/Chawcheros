-- ============================================================================
-- ทดสอบ โมดูลลูกค้า (0032) และโมดูลออเดอร์ (0033)
-- ============================================================================
-- รัน · ต้องมี -1 ไม่งั้น set local ไม่มีผล
--   psql -1 -v ON_ERROR_STOP=1 -d t1 -f supabase/tests/14_crm_sales.sql
--
-- สิ่งที่ต้องพิสูจน์
--   1 ลูกค้าเดียวกัน หลายสาขา หลายออเดอร์ (เคสจริง BLS3167/3168 บจก.อุรา)
--   2 ยอดค้างคำนวณสด ไม่มีใครพิมพ์ได้ (แก้ข้อ O3)
--   3 สถานะเปลี่ยนเองเมื่อจ่ายครบ ไม่มีใครไปกดเปลี่ยน (แก้ข้อ O1)
--   4 ลบไม่ได้ (กฎ A7) ยกเลิกต้องมีเหตุผล
--   5 ★ สิทธิ์แยกกันจริง ฝ่ายขายบันทึกรับชำระไม่ได้ การเงินสร้างออเดอร์ไม่ได้
--   6 ★ ที่อยู่ตั้งต้นมีได้ที่เดียว และเลขที่ออเดอร์ซ้ำไม่ได้
-- ============================================================================

-- ฝ่ายขาย
insert into auth.users (id) values ('aaaaaaaa-0000-0000-0000-000000000001') on conflict do nothing;
insert into core.app_users (id, email, full_name, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001','sale@test','ฝ่ายขาย (ทดสอบ)','ใช้งาน')
  on conflict do nothing;
insert into core.user_capabilities (user_id, capability)
  values ('aaaaaaaa-0000-0000-0000-000000000001','sales.write')
  on conflict do nothing;

-- พี่ษา · การเงิน
insert into auth.users (id) values ('bbbbbbbb-0000-0000-0000-000000000002') on conflict do nothing;
insert into core.app_users (id, email, full_name, status)
  values ('bbbbbbbb-0000-0000-0000-000000000002','sa@test','พี่ษา (ทดสอบ)','ใช้งาน')
  on conflict do nothing;
insert into core.user_capabilities (user_id, capability)
  values ('bbbbbbbb-0000-0000-0000-000000000002','finance.write')
  on conflict do nothing;

set local role authenticated;
set local "test.uid" = 'aaaaaaaa-0000-0000-0000-000000000001';

-- ===== ข้อ 1 · ลูกค้าเดียวกัน สองสาขา สองออเดอร์ =====
do $$
declare v_cust uuid; v_khon uuid; v_ckhon uuid; v_o1 uuid; v_o2 uuid; n int;
begin
  insert into crm.customers (kind, name, tax_id, phone)
  values ('นิติบุคคล', 'บจก.อุรา กรุงเทพ คลินิก (ทดสอบ)', '0105562061928', '061-4265549')
  returning id into v_cust;

  insert into crm.customer_addresses (customer_id, label, kind, address, contact_name, is_default)
  values (v_cust, 'สาขา C KHON', 'จัดส่ง', 'Central Khonkaen ชั้น 1 จ.ขอนแก่น', 'คุณตาก', true)
  returning id into v_ckhon;

  insert into crm.customer_addresses (customer_id, label, kind, address, contact_name)
  values (v_cust, 'สาขา KHON', 'จัดส่ง', 'บ้านเลขที่ 25/25 ถ.ประชาสโมสร จ.ขอนแก่น', 'คุณตาก')
  returning id into v_khon;

  v_o1 := sales.create_order('BLSTEST01', v_cust, 'ขายตรง', v_ckhon);
  v_o2 := sales.create_order('BLSTEST02', v_cust, 'ขายตรง', v_khon);

  select count(*) into n from sales.orders where customer_id = v_cust;
  if n <> 2 then raise exception 'ข้อ 1 พัง: ลูกค้ารายเดียวควรมี 2 ออเดอร์ แต่ได้ %', n; end if;

  -- ★ ข้อ 6a · ที่อยู่ตั้งต้นซ้ำไม่ได้
  begin
    insert into crm.customer_addresses (customer_id, label, kind, address, is_default)
    values (v_cust, 'สาขาที่สาม', 'จัดส่ง', 'ที่ไหนสักแห่ง', true);
    raise exception 'ข้อ 6a พัง: ตั้งที่อยู่ตั้งต้นซ้ำได้ ซึ่งไม่ควร';
  exception when unique_violation then null;
  end;

  -- ★ ข้อ 6b · เลขที่ออเดอร์ซ้ำไม่ได้
  begin
    perform sales.create_order('BLSTEST01', v_cust);
    raise exception 'ข้อ 6b พัง: สร้างเลขที่ออเดอร์ซ้ำได้';
  exception when raise_exception then
    if sqlerrm like 'ข้อ 6b พัง%' then raise; end if;
  end;

  raise notice 'ข้อ 1 + 6 ผ่าน · ลูกค้า 1 ราย 2 สาขา 2 ออเดอร์ · กันซ้ำได้ทั้งสองแบบ';
end $$;

-- ===== ข้อ 2 + 3 · ยอดค้างและสถานะคำนวณสด =====
do $$
declare v_o uuid; v_cust uuid; r record;
begin
  select id into v_cust from crm.customers where name like 'บจก.อุรา%ทดสอบ%';
  select id into v_o from sales.orders where order_no = 'BLSTEST01';

  perform sales.add_order_line(v_o, 'EMU CHAIR Ash-Walnut เบาะหนัง Sm-Wheat', 8, 11300.00);
  perform sales.add_order_line(v_o, 'Khonmai Stool (S) Sm-Wheat', 8, 8960.00);
  update sales.orders set shipping_fee_incl_vat = 2000 where id = v_o;
  perform sales.confirm_order(v_o);

  -- 8×11300 + 8×8960 + 2000 = 164,080
  select * into r from sales.v_orders where id = v_o;
  if r."ยอดรวม" <> 164080.00 then
    raise exception 'ข้อ 2 พัง: ยอดรวมควรเป็น 164080 แต่ได้ %', r."ยอดรวม"; end if;
  if r."ยอดค้าง" <> 164080.00 then
    raise exception 'ข้อ 2 พัง: ยังไม่จ่ายเลย ยอดค้างควรเท่ายอดรวม แต่ได้ %', r."ยอดค้าง"; end if;
  if r."สถานะการเงิน" <> 'รอชำระ' then
    raise exception 'ข้อ 3 พัง: ควรเป็น รอชำระ แต่ได้ %', r."สถานะการเงิน"; end if;

  raise notice 'ข้อ 2 ผ่าน · ยอดรวม % · ยอดค้าง % · สถานะ %',
    r."ยอดรวม", r."ยอดค้าง", r."สถานะการเงิน";
end $$;

-- ===== ข้อ 5a · ★ ฝ่ายขายบันทึกรับชำระไม่ได้ =====
do $$
declare v_o uuid; n_before int; n_after int;
begin
  select id into v_o from sales.orders where order_no = 'BLSTEST01';
  select count(*) into n_before from sales.order_payments where order_id = v_o;

  -- ทางที่ 1 · เรียกฟังก์ชัน ต้องโดนปฏิเสธ
  begin
    perform sales.record_payment(v_o, 50000, 'โอน SCB/TTB');
    raise exception 'ข้อ 5a พัง: ฝ่ายขายบันทึกรับชำระผ่านฟังก์ชันได้';
  exception when insufficient_privilege then null;
  end;

  -- ทางที่ 2 · ยิงตรงที่ตาราง · ไม่ขึ้น error แต่ต้องไม่มีแถวเพิ่ม
  begin
    insert into sales.order_payments (order_id, amount_incl_vat, method)
    values (v_o, 50000, 'โอน SCB/TTB');
  exception when insufficient_privilege then null;
  end;

  select count(*) into n_after from sales.order_payments where order_id = v_o;
  if n_after <> n_before then
    raise exception 'ข้อ 5a พัง: ฝ่ายขายแทรกแถวรับชำระตรงๆ ได้ % แถว', n_after - n_before;
  end if;

  raise notice 'ข้อ 5a ผ่าน · ฝ่ายขายบันทึกรับชำระไม่ได้ ทั้งผ่านฟังก์ชันและยิงตรง';
end $$;

-- ===== เปลี่ยนเป็นพี่ษา =====
set local "test.uid" = 'bbbbbbbb-0000-0000-0000-000000000002';

-- ===== ข้อ 5b · ★ การเงินสร้างออเดอร์ไม่ได้ =====
do $$
declare v_cust uuid; n_before int; n_after int;
begin
  select id into v_cust from crm.customers where name like 'บจก.อุรา%ทดสอบ%';
  select count(*) into n_before from sales.orders;

  begin
    perform sales.create_order('BLSTEST99', v_cust);
    raise exception 'ข้อ 5b พัง: การเงินสร้างออเดอร์ผ่านฟังก์ชันได้';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into sales.orders (order_no, customer_id) values ('BLSTEST98', v_cust);
  exception when insufficient_privilege then null;
  end;

  select count(*) into n_after from sales.orders;
  if n_after <> n_before then
    raise exception 'ข้อ 5b พัง: การเงินสร้างออเดอร์ได้ % ใบ', n_after - n_before;
  end if;

  raise notice 'ข้อ 5b ผ่าน · การเงินสร้างออเดอร์ไม่ได้';
end $$;

-- ===== ข้อ 3 ต่อ · พี่ษารับชำระ แล้วสถานะต้องขยับเอง =====
do $$
declare v_o uuid; r record;
begin
  select id into v_o from sales.orders where order_no = 'BLSTEST01';

  perform sales.record_payment(v_o, 50000, 'โอน SCB/TTB', current_date - 10, 'มัดจำ');
  select * into r from sales.v_orders where id = v_o;
  if r."สถานะการเงิน" <> 'ชำระบางส่วน' then
    raise exception 'ข้อ 3 พัง: จ่ายมัดจำแล้วควรเป็น ชำระบางส่วน แต่ได้ %', r."สถานะการเงิน"; end if;
  if r."ยอดค้าง" <> 114080.00 then
    raise exception 'ข้อ 2 พัง: ยอดค้างควรเหลือ 114080 แต่ได้ %', r."ยอดค้าง"; end if;

  perform sales.record_payment(v_o, 114080, 'บัตรเครดิต', current_date, 'ส่วนที่เหลือ');
  select * into r from sales.v_orders where id = v_o;
  if r."ยอดค้าง" <> 0 then
    raise exception 'ข้อ 2 พัง: จ่ายครบแล้วยอดค้างควรเป็น 0 แต่ได้ %', r."ยอดค้าง"; end if;
  if r."สถานะการเงิน" <> 'ชำระครบ' then
    raise exception 'ข้อ 3 พัง: จ่ายครบแล้วควรเป็น ชำระครบ แต่ได้ %', r."สถานะการเงิน"; end if;

  raise notice 'ข้อ 2 + 3 ผ่าน · สถานะขยับเองจาก รอชำระ → ชำระบางส่วน → ชำระครบ '
               'โดยไม่มีใครไปกดเปลี่ยนสักครั้ง';
end $$;

-- ===== ข้อ 4 · ลบไม่ได้ · ยกเลิกต้องมีเหตุผล =====
set local "test.uid" = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare v_o uuid; n int;
begin
  select id into v_o from sales.orders where order_no = 'BLSTEST02';

  begin
    delete from sales.orders where id = v_o;
    raise exception 'ข้อ 4 พัง: ลบออเดอร์ได้ ซึ่งผิดกฎ A7';
  exception when others then
    if sqlerrm like 'ข้อ 4 พัง%' then raise; end if;
  end;

  select count(*) into n from sales.orders where id = v_o;
  if n <> 1 then raise exception 'ข้อ 4 พัง: ออเดอร์หายไปจริง'; end if;

  begin
    perform sales.cancel_order(v_o, '   ');
    raise exception 'ข้อ 4 พัง: ยกเลิกโดยไม่บอกเหตุผลได้';
  exception when raise_exception then
    if sqlerrm like 'ข้อ 4 พัง%' then raise; end if;
  end;

  perform sales.cancel_order(v_o, 'ลูกค้าเปลี่ยนใจ ย้ายไปสาขาอื่น');
  select count(*) into n from sales.orders
   where id = v_o and status = 'ยกเลิก' and cancel_reason is not null;
  if n <> 1 then raise exception 'ข้อ 4 พัง: ยกเลิกแล้วแต่สถานะหรือเหตุผลไม่ถูก'; end if;

  raise notice 'ข้อ 4 ผ่าน · ลบไม่ได้ · ยกเลิกต้องมีเหตุผล · ข้อมูลยังอยู่ครบ';
end $$;

\echo '=== สรุป ==='
select "เลขที่", "ลูกค้า", "ส่งที่", "ยอดรวม", "รับชำระแล้ว", "ยอดค้าง",
       "สถานะการเงิน", "สถานะเอกสาร"
from sales.v_orders where "เลขที่" like 'BLSTEST%' order by "เลขที่";

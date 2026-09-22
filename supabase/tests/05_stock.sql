-- ============================================================================
-- ทดสอบโมดูลคลัง · เดินเรื่องแบบที่เกิดขึ้นจริง
-- ============================================================================
-- รับของเข้า 4 ตัว → ยืมไปออกแฟร์ → เลยกำหนดคืน → ระบบเตือน → รับคืน
-- ต้องโหลดข้อมูลรอตรวจไว้ก่อน (supabase/seed/import_batch_*.sql)
-- ============================================================================

insert into auth.users (id) values ('33333333-3333-3333-3333-333333333333')
  on conflict do nothing;
insert into core.app_users (id, email, full_name, status)
  values ('33333333-3333-3333-3333-333333333333','stock@test','ทดสอบคลัง','ใช้งาน')
  on conflict do nothing;
insert into core.user_capabilities (user_id, capability) values
  ('33333333-3333-3333-3333-333333333333','products.write'),
  ('33333333-3333-3333-3333-333333333333','products.read'),
  ('33333333-3333-3333-3333-333333333333','stock.write'),
  ('33333333-3333-3333-3333-333333333333','stock.read')
  on conflict do nothing;

set local role authenticated;
set local "test.uid" = '33333333-3333-3333-3333-333333333333';

do $$
declare
  v_variant uuid; v_ase uuid; v_show uuid;
  v_codes text[]; v_first text; n int; v_overdue int; v_msg text := '';
begin
  perform catalog.approve_import_group('กีวี่','เก้าอี้');
  select id into v_variant from catalog.product_variants where width_cm = 51 limit 1;
  select id into v_ase  from stock.locations where name = 'โกดัง ASE';
  select id into v_show from stock.locations where name = 'Showroom';

  -- รับเข้า 4 ตัว (ของเก่าที่ไฟล์เดิมเก็บเป็นจำนวน)
  select array_agg(unit_code order by unit_code) into v_codes
    from stock.receive_units(v_variant, 4, v_ase, 'พร้อมขาย', 'ยอดยกมาจากไฟล์เดิม');
  if array_length(v_codes,1) <> 4 then raise exception 'ควรได้ 4 ตัว ได้ %', array_length(v_codes,1); end if;
  v_first := v_codes[1];
  v_msg := v_msg || format(E'\n  ✓ รับเข้า 4 ตัว ได้รหัส %s', array_to_string(v_codes, ', '));

  -- นับสดต้องเห็น 4 ตัวที่โกดัง
  select "พร้อมขาย" into n from stock.v_on_hand
    where variant_id = v_variant and "อยู่ที่" = 'โกดัง ASE';
  if n <> 4 then raise exception 'ยอดคงเหลือควรเป็น 4 ได้ %', n; end if;
  v_msg := v_msg || E'\n  ✓ ยอดคงเหลือนับสดได้ 4 ตัว ที่โกดัง ASE';

  -- ย้ายไปโชว์รูม
  perform stock.move_unit(v_first, v_show, null, 'เอาไปตั้งโชว์');
  if (select loc.name from stock.units u join stock.locations loc on loc.id=u.location_id
      where u.unit_code = v_first) <> 'Showroom' then
    raise exception 'ย้ายไม่สำเร็จ';
  end if;
  v_msg := v_msg || E'\n  ✓ ย้ายไปโชว์รูมได้ · ไม่ต้องบอกสถานะ ระบบคงของเดิมไว้';

  -- ★ ยืมไปออกแฟร์ · ที่ปลายทางยังไม่มีในระบบ ต้องสร้างให้เอง
  perform stock.lend_unit(v_first, 'แฟร์ BITEC ต.ค. 69', current_date + 10, 'คุณเอ', 'ออกบูธ');
  if not exists (select 1 from stock.locations where name = 'แฟร์ BITEC ต.ค. 69') then
    raise exception 'ไม่ได้สร้างที่ปลายทางให้';
  end if;
  v_msg := v_msg || E'\n  ✓ ยืมออกได้ · สร้างที่ "แฟร์ BITEC ต.ค. 69" ให้อัตโนมัติ';

  -- ยืมซ้อนไม่ได้
  begin
    perform stock.lend_unit(v_first, 'ที่อื่น', current_date + 5);
    raise exception 'ยืมซ้อนได้ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%ยืมออกอยู่แล้ว%' then raise; end if;
  end;
  v_msg := v_msg || E'\n  ✓ ตัวเดียวยืมซ้อนสองที่ไม่ได้';

  -- ยืมโดยไม่บอกกำหนดกลับไม่ได้
  begin
    perform stock.lend_unit(v_codes[2], 'ที่ไหนสักแห่ง', null);
    raise exception 'ยืมโดยไม่มีกำหนดกลับได้ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%กำหนดกลับ%' then raise; end if;
  end;
  v_msg := v_msg || E'\n  ✓ ยืมโดยไม่ระบุกำหนดกลับไม่ได้';

  -- ของที่ยืมอยู่ ย้ายเฉยๆ ไม่ได้ ต้องกดรับคืน
  begin
    perform stock.move_unit(v_first, v_ase, 'พร้อมขาย');
    raise exception 'ย้ายของที่ยืมอยู่ได้ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%รับคืน%' then raise; end if;
  end;
  v_msg := v_msg || E'\n  ✓ ของที่ยืมอยู่ ย้ายเฉยๆ ไม่ได้ ต้องกดรับคืน (รายการยืมจะได้ไม่ค้าง)';

  -- ★ ทำให้เลยกำหนด แล้วดูว่าเตือนไหม
  -- ย้อนวันทั้งคู่ เพราะของที่เลยกำหนดจริงๆ มันออกไปตั้งแต่อดีต
  -- (constraint due_back_on >= out_on กันไว้ถูกแล้ว ถ้าย้อนแค่วันกลับ)
  update stock.loans
     set out_on = current_date - 20, due_back_on = current_date - 3
   where unit_id = (select id from stock.units where unit_code = v_first);
  select count(*) into v_overdue from stock.v_overdue_loans;
  if v_overdue <> 1 then raise exception 'ควรเตือน 1 รายการ ได้ %', v_overdue; end if;
  v_msg := v_msg || E'\n  ✓ เลยกำหนด 3 วัน → ขึ้นในรายการของที่ต้องตามคืน พร้อมมูลค่าที่จมอยู่';

  if not exists (select 1 from stock.v_today where "หมวด" = 'เลยกำหนดคืน') then
    raise exception 'งานวันนี้ไม่ขึ้นเรื่องเลยกำหนดคืน';
  end if;
  v_msg := v_msg || E'\n  ✓ โผล่ในหน้า "งานวันนี้" ของคลัง';

  -- รับคืน
  perform stock.return_unit(v_first, v_ase, 'พร้อมขาย');
  if (select count(*) from stock.v_overdue_loans) <> 0 then
    raise exception 'รับคืนแล้วยังค้างในรายการเลยกำหนด';
  end if;
  if (select returned_on from stock.loans
      where unit_id = (select id from stock.units where unit_code = v_first)) is null then
    raise exception 'ไม่ได้ปิดรายการยืม';
  end if;
  v_msg := v_msg || E'\n  ✓ รับคืนแล้ว รายการยืมปิด และหลุดจากรายการของที่ต้องตาม';

  -- ประวัติการย้ายต้องครบทุกครั้ง
  select count(*) into n from stock.unit_moves
   where unit_id = (select id from stock.units where unit_code = v_first);
  if n < 4 then raise exception 'ประวัติการย้ายหายไป เหลือแค่ % ครั้ง', n; end if;
  v_msg := v_msg || format(E'\n  ✓ ประวัติการย้ายครบ %s ครั้ง (รับเข้า·ย้าย·ยืม·คืน)', n);

  raise notice '%', v_msg;
end $$;

-- ---------------------------------------------------------------------------
-- กฎที่ห้ามพัง
--
-- เช็คด้วย "ข้อมูลเปลี่ยนไหม" ไม่ใช่ "มี error ไหม"
-- เพราะ RLS ที่ไม่มี policy ให้ UPDATE จะกรองแถวออกหมดแล้วเงียบๆ ไม่ error
-- ถ้าเช็คแค่ error จะสรุปผิดว่าระบบยอมให้แก้ ทั้งที่จริงมันกันไว้แล้ว
-- ---------------------------------------------------------------------------
do $$
declare v_id uuid; v_move bigint; v_note text; n int; bad text := '';
begin
  select id into v_id from stock.units limit 1;
  select id, note into v_move, v_note from stock.unit_moves where unit_id = v_id limit 1;

  -- ลบตัวสินค้า
  begin
    delete from stock.units where id = v_id;
    get diagnostics n = row_count;
    if n > 0 then bad := bad || ' · ลบตัวสินค้าได้'; end if;
  exception when others then null; end;
  if exists (select 1 from stock.units where id = v_id) is not true then
    bad := bad || ' · ตัวสินค้าหายไปจริง';
  end if;

  -- ลบประวัติการย้าย
  begin
    delete from stock.unit_moves where id = v_move;
    get diagnostics n = row_count;
    if n > 0 then bad := bad || ' · ลบประวัติการย้ายได้'; end if;
  exception when others then null; end;
  if not exists (select 1 from stock.unit_moves where id = v_move) then
    bad := bad || ' · ประวัติการย้ายหายไปจริง';
  end if;

  -- แก้ประวัติย้อนหลัง
  begin
    update stock.unit_moves set note = 'แก้ย้อนหลัง' where id = v_move;
  exception when others then null; end;
  if (select note from stock.unit_moves where id = v_move) is distinct from v_note then
    bad := bad || ' · แก้ประวัติการย้ายย้อนหลังได้จริง';
  end if;

  -- ปิดที่ประจำ
  begin
    update stock.locations set status = 'เลิกขาย' where name = 'โกดัง ASE';
  exception when others then null; end;
  if (select status from stock.locations where name = 'โกดัง ASE') <> 'ขายอยู่' then
    bad := bad || ' · ปิดที่ประจำได้จริง';
  end if;

  if bad <> '' then raise exception 'กฎพัง:%', bad; end if;
  raise notice 'กฎครบ · ลบของไม่ได้ · ลบและแก้ประวัติย้อนหลังไม่ได้ · ปิดที่ประจำไม่ได้';
end $$;

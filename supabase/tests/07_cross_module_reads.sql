-- ============================================================================
-- ทดสอบว่าพนักงานแต่ละแผนกเปิดหน้าจอของตัวเองแล้วเห็นข้อมูลจริง
-- ============================================================================
-- บั๊กที่ไฟล์นี้กันไว้: วิวที่ join ข้ามโมดูลคืนศูนย์แถวแบบเงียบๆ
-- เพราะคนใช้ไม่มีสิทธิ์อ่านตารางที่ถูก join ไป
-- มันไม่ error มันแค่บอกว่า "ไม่มีข้อมูล" ซึ่งหลอกกว่า error มาก
--
-- ต้องโหลด seed + อนุมัติสินค้าก่อน (tests/03)
-- ============================================================================

-- คนคลัง · มีแค่สิทธิ์คลัง ไม่มี products.read
insert into auth.users (id) values ('66666666-6666-6666-6666-666666666666') on conflict do nothing;
insert into core.app_users (id, email, full_name, status)
  values ('66666666-6666-6666-6666-666666666666','warehouse@test','คนคลัง','ใช้งาน')
  on conflict do nothing;
insert into core.user_capabilities (user_id, capability) values
  ('66666666-6666-6666-6666-666666666666','stock.read'),
  ('66666666-6666-6666-6666-666666666666','stock.write')
  on conflict do nothing;

-- กราฟิก · มีแค่ design.write
insert into auth.users (id) values ('77777777-7777-7777-7777-777777777777') on conflict do nothing;
insert into core.app_users (id, email, full_name, status)
  values ('77777777-7777-7777-7777-777777777777','design@test','กราฟิก','ใช้งาน')
  on conflict do nothing;
insert into core.user_capabilities (user_id, capability)
  values ('77777777-7777-7777-7777-777777777777','design.write')
  on conflict do nothing;

set local role authenticated;

do $$
declare v_variant uuid; v_ase uuid; v_code text; n int; v_item uuid; msg text := '';
begin
  -- ── คนคลังทำงานของตัวเอง ────────────────────────────────────────────
  perform set_config('test.uid','66666666-6666-6666-6666-666666666666', true);

  select id into v_variant from catalog.product_variants limit 1;
  if v_variant is null then raise exception 'ยังไม่มีสินค้า ต้องรัน tests/03 ก่อน'; end if;
  msg := msg || E'\n  ✓ คนคลังอ่านรายการสินค้าได้ (เมื่อก่อนอ่านไม่ได้เลย)';

  select id into v_ase from stock.locations where name = 'โกดัง ASE';
  select unit_code into v_code from stock.receive_units(v_variant, 1, v_ase) limit 1;

  perform stock.lend_unit(v_code, 'แฟร์ทดสอบ', current_date + 1);
  update stock.loans set out_on = current_date - 10, due_back_on = current_date - 2
   where unit_id = (select id from stock.units where unit_code = v_code);

  -- ★ หน้าที่เคยว่างเปล่า
  select count(*) into n from stock.v_overdue_loans;
  if n < 1 then raise exception 'คนคลังเปิดหน้าของที่ต้องตามคืนแล้วว่างเปล่า — บั๊กกลับมาแล้ว'; end if;

  if (select "รุ่น" from stock.v_overdue_loans limit 1) is null then
    raise exception 'เห็นแถวแต่ชื่อรุ่นเป็นค่าว่าง';
  end if;
  msg := msg || format(E'\n  ★ คนคลังเห็นของที่ต้องตามคืน %s รายการ พร้อมชื่อรุ่นและมูลค่า', n);

  select count(*) into n from stock.v_on_hand;
  if n < 1 then raise exception 'หน้ามีอะไรอยู่ที่ไหนว่างเปล่า'; end if;
  msg := msg || E'\n  ✓ คนคลังเห็นหน้า "มีอะไรอยู่ที่ไหน"';

  -- แต่ต้องไม่เห็นต้นทุน
  begin
    perform 1 from cost.variant_costs limit 1;
    if (select count(*) from cost.variant_costs) > 0 then
      raise exception 'คนคลังเห็นต้นทุน!';
    end if;
  exception when insufficient_privilege then null;
  end;
  msg := msg || E'\n  ✓ คนคลังยังเห็นต้นทุนไม่ได้ (เส้นนั้นไม่ขยับ)';

  -- ── กราฟิกทำงานของตัวเอง ────────────────────────────────────────────
  perform set_config('test.uid','77777777-7777-7777-7777-777777777777', true);

  insert into content.items (title, format, stage) values ('คลิปทดสอบ','คลิปสั้น','พร้อมโพสต์')
  returning id into v_item;
  insert into content.placements (item_id, channel_id) values
    (v_item,'tiktok'), (v_item,'youtube');

  select count(*) into n from marketing.channels;
  if n < 1 then raise exception 'กราฟิกอ่านรายชื่อช่องทางไม่ได้'; end if;
  msg := msg || format(E'\n  ✓ กราฟิกอ่านรายชื่อช่องทางได้ %s ช่อง', n);

  -- ★ หน้าที่เคยว่างเปล่า
  select count(*) into n from content.v_placement_gaps where item_id = v_item;
  if n <> 1 then
    raise exception 'กราฟิกเปิดหน้า "ลงครบยัง" แล้วว่างเปล่า — บั๊กกลับมาแล้ว (ได้ %)', n;
  end if;
  if (select "ที่ยังขาด" from content.v_placement_gaps where item_id = v_item) is null then
    raise exception 'เห็นแถวแต่ไม่รู้ว่าขาดช่องทางไหน';
  end if;
  msg := msg || E'\n  ★ กราฟิกเห็นว่าคลิปนี้ยังลงไม่ครบ และขาดช่องทางไหนบ้าง';

  -- กราฟิกอนุมัติเองไม่ได้
  begin
    perform content.approve_item(v_item);
    raise exception 'กราฟิกอนุมัติเองได้ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%content.approve%' then raise; end if;
  end;
  msg := msg || E'\n  ✓ กราฟิกยังอนุมัติคอนเทนต์เองไม่ได้';

  raise notice '%', msg;
end $$;

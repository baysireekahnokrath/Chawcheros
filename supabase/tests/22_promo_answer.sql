-- ============================================================================
-- ทดสอบ 0052 · โปรฯ ต่อท้ายคำตอบราคา · รันหลัง 19 (ใช้สินค้าทดสอบของ 19)
-- ============================================================================
--   1 โปรเงินสดใช้กับ Kiwi Armchair · ราคาสุดท้าย 24192 ตรงไฟล์
--   2 ตัวที่ไฟล์ให้ on top 0% ไม่ได้โปรเงินสด
--   3 โปรหมดเขต / ยังไม่เริ่ม / ยังเป็นร่าง ไม่ขึ้น
--   4 ขั้นบันได ส่งฟรี ของแถม ขึ้นตามลำดับ · เงินสดมีตัวเดียว
--   5 โปรเฉพาะรุ่นอื่น ไม่ขึ้นกับสินค้านี้ · โปร "ลดราคา" ไม่ซ้ำในส่วนท้าย
--   6 กรอกไม่ครบ = บันทึกไม่ได้ (ของแถมต้องบอกว่าแถมอะไร · ขั้นบันไดต้องมียอด · ลิงก์ต้อง https)
--   7 ห้ามลบโปร (A7)
-- ============================================================================
do $$
declare j jsonb; it jsonb; b uuid; t date := line_agent.today(); r uuid;
begin
  -- ปิดโปรเงินสดที่มีอยู่ทั้งหมด แล้วตั้งของทดสอบเอง (ห้ามลบ จึงเปลี่ยนสถานะ)
  update marketing.promotions set status = 'จบแล้ว' where kind <> 'ลดราคา';

  select batch_id into b from catalog.import_variants where legacy_fullname ~ 'Kiwi Armchair' limit 1;
  insert into catalog.import_variants (batch_id, source_row_no, collection, legacy_fullname, list_price_incl_vat, discount_pct, ontop_pct) values
    (b, 3, 'กีวี่', 'ฌ เฌอ | เก้าอี้  กีวี่ (Kiwi Chair) ไม้โอ๊ค  สีธรรมชาติ ผ้า A เลือกสีได้', 12000, 15, 0);

  insert into marketing.promotions (name, kind, percent, starts_on, ends_on, status) values
    ('เงินสด', 'ชำระเงินสด', 10, t - 5, t + 5, 'กำลังใช้'),
    ('เงินสดหมดเขต', 'ชำระเงินสด', 30, t - 10, t - 1, 'กำลังใช้'),
    ('เงินสดยังไม่เริ่ม', 'ชำระเงินสด', 40, t + 1, t + 9, 'กำลังใช้'),
    ('เงินสดร่าง', 'ชำระเงินสด', 50, t - 1, t + 9, 'ร่าง');
  insert into marketing.promotions (name, kind, percent, min_total, detail, link_url, starts_on, ends_on, status) values
    ('ครบแสน', 'ขั้นบันได', 18, 100000, null, null, t, t + 5, 'กำลังใช้'),
    ('ครบห้าหมื่น', 'ขั้นบันได', 12, 50000, null, null, t, t + 5, 'กำลังใช้'),
    ('ส่งฟรี', 'ส่งฟรี', null, 30000, 'กรุงเทพฯ และปริมณฑล', 'https://chawcher.com/free-ship/', t, null, 'กำลังใช้'),
    ('แถมหมอน', 'ของแถม', null, null, 'หมอนอิง 2 ใบ', null, t, t + 5, 'กำลังใช้');
  insert into marketing.promotions (name, kind, detail, scope, target_id, starts_on, status)
    values ('แถมเฉพาะรุ่นอื่น', 'ของแถม', 'โคมไฟ', 'รุ่น', gen_random_uuid(), t, 'กำลังใช้');
  insert into pricing.discount_rules (name, scope, percent, valid_from, valid_to, status)
    values ('ทดสอบลดราคา', 'ทั้งหมด', 25, t + 100, t + 101, 'ขายอยู่') returning id into r;
  insert into marketing.promotions (name, kind, discount_rule_id, starts_on, status) values ('ลดราคา', 'ลดราคา', r, t, 'กำลังใช้');

  j := line_agent._price_full('kiwi armchair');
  it := j->'items'->0;
  if (it->>'final')::numeric <> 24192 or (it->>'ontop_pct')::numeric <> 10 then raise exception '1 พัง: %', it; end if;
  raise notice 'ข้อ 1 ผ่าน · โปรเงินสด 10%% · 33600 → 26880 → 24192';

  it := (select x from jsonb_array_elements(line_agent._price_full('kiwi chair')->'items') x where x->>'name' ~ 'Kiwi Chair');
  if (it->>'final')::numeric <> (it->>'price')::numeric or it->'promos' @> '[{"kind":"ชำระเงินสด"}]' then
    raise exception '2 พัง: ตัวที่ไฟล์ยกเว้นต้องไม่ได้เงินสด %', it;
  end if;
  raise notice 'ข้อ 2 ผ่าน · Kiwi Chair (ไฟล์ on top 0%%) ไม่ได้โปรเงินสด';

  it := line_agent._price_full('kiwi armchair')->'items'->0;
  if jsonb_array_length(it->'promos') <> 5 then raise exception '3-5 พัง: ต้องได้ 5 โปร %', it->'promos'; end if;
  if (select string_agg(p->>'name', ',' order by o) from jsonb_array_elements(it->'promos') with ordinality as e(p, o))
     <> 'เงินสด,ครบห้าหมื่น,ครบแสน,ส่งฟรี,แถมหมอน' then
    raise exception '3-5 พัง: ลำดับ/ตัวที่ขึ้นผิด %', it->'promos';
  end if;
  raise notice 'ข้อ 3-5 ผ่าน · หมดเขต/ยังไม่เริ่ม/ร่าง/รุ่นอื่น/ลดราคา ไม่ขึ้น · เรียง เงินสด → ขั้นบันได → ส่งฟรี → ของแถม';

  begin
    insert into marketing.promotions (name, kind, starts_on) values ('แถมอะไร', 'ของแถม', t);
    raise exception '6 พัง: ของแถมไม่บอกว่าแถมอะไร บันทึกได้';
  exception when check_violation then null; end;
  begin
    insert into marketing.promotions (name, kind, percent, starts_on) values ('ขั้นบันได', 'ขั้นบันได', 12, t);
    raise exception '6 พัง: ขั้นบันไดไม่มียอด บันทึกได้';
  exception when check_violation then null; end;
  begin
    insert into marketing.promotions (name, kind, link_url, starts_on) values ('ลิงก์', 'ส่งฟรี', 'chawcher.com', t);
    raise exception '6 พัง: ลิงก์ไม่ใช่ https บันทึกได้';
  exception when check_violation then null; end;
  raise notice 'ข้อ 6 ผ่าน · กรอกไม่ครบบันทึกไม่ได้';

  begin
    delete from marketing.promotions where name = 'เงินสด';
    raise exception '7 พัง: ลบโปรได้';
  exception when others then if sqlerrm like '7 พัง%' then raise; end if; end;
  raise notice '22 ผ่านทั้ง 7 ข้อ';
end $$;

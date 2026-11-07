-- ============================================================================
-- ทดสอบ POS ย้อนดูบิล (0040)
-- ============================================================================
-- รัน · psql -1 -v ON_ERROR_STOP=1 -d t1 -f supabase/tests/19_pos_lookup.sql
--
-- สิ่งที่ต้องพิสูจน์
--   1 PIN ผิด อ่านไม่ได้
--   2 PIN ถูก อ่านบิลของวันที่เลือกได้ ทุกเครื่องรวมกัน
--   3 ★ รูปแบบที่คืนกลับ ตรงกับที่หน้าเว็บใช้ทุกช่อง (ก็อปปี้ใบเสร็จได้เลย)
--   4 ★ anon ยังแตะตาราง pos.sales ตรงๆ ไม่ได้ · ประตูเดียวคือฟังก์ชันที่ต้องใช้ PIN
-- ============================================================================

-- ตั้ง PIN ร้าน (ปกติ Bay ตั้งจากหลังบ้านด้วย pos.set_pin)
insert into pos.settings (id, pin_hash, event_name)
-- pgcrypto อยู่ schema extensions บน Supabase แต่อยู่ public บนเครื่องทดสอบ
-- จึงเรียกแบบไม่ระบุ schema ให้ search_path หาเอง เหมือนที่ฟังก์ชันใน 0037 ทำ
values (1, crypt('199001', gen_salt('bf')), 'ทดสอบ 19')
on conflict (id) do update set pin_hash = excluded.pin_hash;

set local role anon;

-- ===== บันทึกบิลสามใบ · สองวัน · คนละเครื่อง =====
select pos.record_sale('199001', jsonb_build_object(
  'id','t19aaaaaa','no','SX1106-100000-A','at','2026-11-06T03:00:00Z','date','2026-11-06',
  'seller','น้องเอ','pay','โอน','customer','คุณลูกค้าหนึ่ง','phone','081-0000001',
  'items', jsonb_build_array(jsonb_build_object('name','กระเป๋าหนังแท้','v','สะพาย','price',500,'qty',1))));

select pos.record_sale('199001', jsonb_build_object(
  'id','t19bbbbbb','no','SX1107-110000-B','at','2026-11-07T04:00:00Z','date','2026-11-07',
  'seller','น้องบี','pay','เงินสด',
  'items', jsonb_build_array(jsonb_build_object('name','กระเป๋าหนังแท้','v','สะพาย','price',500,'qty',2))));

select pos.record_sale('199001', jsonb_build_object(
  'id','t19cccccc','no','SX1107-113000-C','at','2026-11-07T04:30:00Z','date','2026-11-07',
  'seller','น้องซี','pay','โอน','discountType','pct','discountValue',10,
  'items', jsonb_build_array(jsonb_build_object('name','พวงกุญแจหนัง','v','','price',200,'qty',1))));

-- ===== ข้อ 1 · PIN ผิด อ่านไม่ได้ =====
do $$
begin
  perform pos.list_sales('000000', date '2026-11-07');
  raise exception 'ข้อ 1 พัง: PIN ผิดแต่อ่านบิลได้';
exception
  when sqlstate '28000' then null;
  when raise_exception then if sqlerrm like 'ข้อ 1 พัง%' then raise; end if;
end $$;

\echo ''
\echo '=== 2-3 · บิลของวันที่เลือก · รูปแบบตรงกับที่หน้าเว็บใช้ ==='
select jsonb_pretty(pos.list_sales('199001', date '2026-11-07'));

do $$
declare v jsonb; b jsonb; n int;
begin
  v := pos.list_sales('199001', date '2026-11-07');
  n := jsonb_array_length(v);
  if n <> 2 then raise exception 'ข้อ 2 พัง: วันที่ 7 ควรมี 2 บิล แต่ได้ %', n; end if;

  -- เรียงใหม่สุดขึ้นก่อน
  if (v->0->>'no') <> 'SX1107-113000-C' then
    raise exception 'ข้อ 2 พัง: ควรเรียงบิลใหม่สุดขึ้นก่อน แต่ได้ %', v->0->>'no';
  end if;

  -- ★ ข้อ 3 · ทุกช่องที่หน้าเว็บใช้วาดใบเสร็จต้องมีครบ
  b := v->0;
  foreach b in array array[
    (v->0->'id'), (v->0->'no'), (v->0->'at'), (v->0->'date'), (v->0->'seller'),
    (v->0->'items'), (v->0->'subtotal'), (v->0->'discountType'), (v->0->'discountValue'),
    (v->0->'discount'), (v->0->'total'), (v->0->'pay'), (v->0->'customer'),
    (v->0->'phone'), (v->0->'note'), (v->0->'status'), (v->0->'synced')]
  loop
    if b is null then raise exception 'ข้อ 3 พัง: มีช่องที่หน้าเว็บต้องใช้หายไป'; end if;
  end loop;

  -- ส่วนลด 10% ของ 200 = 20 · สุทธิ 180 · ฐานข้อมูลคิดให้ ไม่เชื่อตัวเลขจากเครื่องหน้าบูธ
  if (v->0->>'total')::numeric <> 180.00 then
    raise exception 'ข้อ 3 พัง: ยอดสุทธิควรเป็น 180.00 แต่ได้ %', v->0->>'total';
  end if;
  if (v->0->>'synced')::boolean is not true then
    raise exception 'ข้อ 3 พัง: บิลจากฐานข้อมูลต้องติดธงว่าเข้าระบบแล้ว';
  end if;

  -- วันก่อนหน้ายังอ่านได้ · นี่คือทั้งหมดของโจทย์
  v := pos.list_sales('199001', date '2026-11-06');
  if jsonb_array_length(v) <> 1 or (v->0->>'customer') <> 'คุณลูกค้าหนึ่ง' then
    raise exception 'ข้อ 2 พัง: ย้อนดูบิลวันก่อนไม่ได้';
  end if;
end $$;

-- ===== ข้อ 4 · ประตูเดียวยังเป็นประตูเดียว =====
do $$
declare n int;
begin
  begin
    select count(*) into n from pos.sales;
    raise exception 'ข้อ 4 พัง: anon อ่านตาราง pos.sales ตรงๆ ได้ % แถว', n;
  exception
    when insufficient_privilege then null;
    when raise_exception then if sqlerrm like 'ข้อ 4 พัง%' then raise; end if;
  end;
end $$;

\echo ''
\echo '=== ผ่านทุกข้อ ==='

-- ============================================================================
-- ทดสอบนับคนมาโชว์รูม (0041)
-- ============================================================================
-- รัน · psql -1 -v ON_ERROR_STOP=1 -d t1 -f supabase/tests/20_line_oa_arrivals.sql
--
-- สิ่งที่ต้องพิสูจน์
--   1 LINE ส่ง event เดิมซ้ำ = บันทึกครั้งเดียว (OA-2)
--   2 คนเดียวส่งสองรอบในวันเดียว = 1 คน · วันถัดไปมาอีก = นับใหม่ (OA-3)
--   3 วันที่ตามเวลาไทย · 23:30 ไทย ยังเป็นวันเดิม (ไม่ใช่วันของ UTC)
--   4 รหัสนัด CC-xxxx ในข้อความ ถูกดึงออกมา
--   5 ★ ติ๊ก "ไม่นับ" แล้วหายจากยอด · ลบไม่ได้ (A7) · ข้อมูลจาก LINE แก้ไม่ได้
--   6 ★ anon / authenticated เรียก record_arrival ไม่ได้ · มีแค่ service_role
-- ============================================================================

-- ===== บันทึกในฐานะ webhook (service_role) =====
set local role service_role;

do $$
declare ok boolean;
begin
  -- ข้อ 1 · ส่งซ้ำ
  ok := line_oa.record_arrival('ev1', 'Uaaa', 'สวัสดี มาถึงโชว์รูมแล้ว', '2026-11-08 03:00+00', 'คุณเอ');
  if not ok then raise exception 'ข้อ 1 พัง: บันทึกครั้งแรกไม่ได้'; end if;
  ok := line_oa.record_arrival('ev1', 'Uaaa', 'สวัสดี มาถึงโชว์รูมแล้ว', '2026-11-08 03:00+00', 'คุณเอ');
  if ok then raise exception 'ข้อ 1 พัง: event ซ้ำถูกบันทึกสองครั้ง'; end if;

  -- ข้อ 2 · คนเดิมส่งอีกรอบวันเดียวกัน + คนใหม่มีรหัสนัด
  perform line_oa.record_arrival('ev2', 'Uaaa', 'มาถึงโชว์รูมแล้วครับ', '2026-11-08 05:00+00', 'คุณเอ');
  perform line_oa.record_arrival('ev3', 'Ubbb', 'สวัสดี มาถึงโชว์รูมแล้ว รหัส cc-4821', '2026-11-08 06:00+00', null);
  -- ข้อ 3 · 23:30 เวลาไทย = 16:30 UTC ยังเป็นวันที่ 8
  perform line_oa.record_arrival('ev4', 'Uccc', 'มาถึงโชว์รูมแล้ว', '2026-11-08 16:30+00', 'คุณซี');
  -- วันถัดไป คุณเอมาอีก
  perform line_oa.record_arrival('ev5', 'Uaaa', 'มาถึงโชว์รูมแล้ว', '2026-11-09 04:00+00', 'คุณเอ');
end $$;

reset role;

do $$
declare v record;
begin
  select * into v from line_oa.v_daily where arrived_on = '2026-11-08';
  if v.people <> 3 then raise exception 'ข้อ 2-3 พัง: วันที่ 8 ต้องได้ 3 คน ได้ %', v.people; end if;
  if v.messages <> 4 then raise exception 'ข้อ 2 พัง: วันที่ 8 ต้องมี 4 ข้อความ ได้ %', v.messages; end if;
  if v.with_code <> 1 then raise exception 'ข้อ 4 พัง: ต้องมีรหัสนัด 1 คน ได้ %', v.with_code; end if;

  select * into v from line_oa.v_daily where arrived_on = '2026-11-09';
  if v.people <> 1 then raise exception 'ข้อ 2 พัง: วันที่ 9 ต้องได้ 1 คน ได้ %', v.people; end if;

  if (select booking_code from line_oa.arrivals where webhook_event_id = 'ev3') is distinct from 'CC-4821' then
    raise exception 'ข้อ 4 พัง: ดึงรหัสนัดไม่ถูก';
  end if;
  if (select arrived_on from line_oa.arrivals where webhook_event_id = 'ev4') <> '2026-11-08' then
    raise exception 'ข้อ 3 พัง: 23:30 ไทยถูกนับเป็นวันถัดไป';
  end if;
end $$;

-- ===== ข้อ 5 · ไม่นับ / ลบ / แก้ข้อมูล LINE =====
update line_oa.arrivals set counted = false where webhook_event_id = 'ev4';
do $$
begin
  if (select people from line_oa.v_daily where arrived_on = '2026-11-08') <> 2 then
    raise exception 'ข้อ 5 พัง: ติ๊กไม่นับแล้วยอดไม่ลด';
  end if;

  begin
    delete from line_oa.arrivals where webhook_event_id = 'ev4';
    raise exception 'ข้อ 5 พัง: ลบได้';
  exception when raise_exception then
    if sqlerrm like 'ข้อ 5 พัง%' then raise; end if;
  end;

  begin
    update line_oa.arrivals set message = 'แก้' where webhook_event_id = 'ev4';
    raise exception 'ข้อ 5 พัง: แก้ข้อความจาก LINE ได้';
  exception when raise_exception then
    if sqlerrm like 'ข้อ 5 พัง%' then raise; end if;
  end;
end $$;

-- ===== ข้อ 6 · คนอื่นเรียกประตู webhook ไม่ได้ =====
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    begin
      execute format('set local role %I', r);
      perform line_oa.record_arrival('evX', 'Uxxx', 'มาถึงโชว์รูมแล้ว', now(), null);
      reset role;
      raise exception 'ข้อ 6 พัง: % เรียก record_arrival ได้', r;
    exception when insufficient_privilege then
      reset role;
    end;
  end loop;
end $$;

\echo '✓ 20 · นับคนมาโชว์รูม ผ่านทุกข้อ'

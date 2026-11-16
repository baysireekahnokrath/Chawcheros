-- ============================================================================
-- ทดสอบ 0053 · โมดูลคนสนใจ (leads)
-- ============================================================================
--   psql -1 -v ON_ERROR_STOP=1 -d t1 -f supabase/tests/23_leads.sql   (ต้องมี -1)
--   ชื่อทุกชื่อในไฟล์นี้เป็นชื่อสมมติ ไม่มีข้อมูลลูกค้าจริง
--
--   1 ★ คนไม่ล็อกอิน (anon) ไม่ได้อะไรเลย · อ่านไม่ได้ เรียกประตูไม่ได้
--   2 ★ ล็อกอินแต่ไม่มีสิทธิ์: ไม่เห็นแถว · เรียกประตูไม่ได้ · สรุปได้ศูนย์
--   3 ★ เขียนตารางตรงๆ ไม่ได้ แม้มีสิทธิ์ · ต้องผ่านประตู
--   4   เดินครบทุกขั้น ใหม่ → ตอบแล้ว → เสนอราคาแล้ว → นัดแล้ว → มาโชว์รูม → ซื้อ
--   5 ★ ซื้อ ต้องมีที่มา · หาย ต้องมีเหตุผล · ปิดผ่าน set_stage ไม่ได้ · นัดแล้ว ต้องมีวันนัด
--   6   เปิดรายการเดิม (จากหาย · จากซื้อ) · ปิดแล้วทำต่อไม่ได้จนกว่าจะเปิด
--   7 ★ LINE: 1 รหัสผู้ใช้ = 1 แถว · ส่งซ้ำไม่สร้างแถวซ้ำ ไม่ทับของใหม่ด้วยของเก่า · หายแล้วทักมา = เปิดแถวเดิม
--   8 ★ ข้อความตัดที่ 200 ตัวอักษร
--   9 ★ ป้ายที่คนตั้งแล้ว ระบบไม่ทับ · ป้ายที่ระบบเสนอ ทับได้
--  10 ★ ประตู LINE เรียกได้เฉพาะ service_role · service_role อ่านตารางไม่ได้
--  11   หน้า "วันนี้" คืน 3 รายการถูกแถว · ไม่มีแถวที่ปิดแล้วหรือไม่นับ
--  12   สรุปสัปดาห์นับสด · ไม่นับแถวที่ติ๊ก "ไม่นับ"
--  13   A7 ห้ามลบ · ทะเบียนโมดูล · schema leads อยู่ในรายการที่เปิดให้เว็บและไม่ทำ schema อื่นหลุด
--
-- หมายเหตุ: บล็อกที่ดัก raise_exception ใช้ errcode 'T0023' กับข้อความ "พัง" ของตัวเอง
--           ไม่งั้นข้อความ "พัง" จะถูกดักกลืนไปด้วย แล้วข้อทดสอบผ่านทั้งที่ควรล้ม
-- ============================================================================

insert into auth.users (id) values
  ('aaaaaaaa-0000-0000-0000-0000000023a1'), ('aaaaaaaa-0000-0000-0000-0000000023b2'),
  ('aaaaaaaa-0000-0000-0000-0000000023c3') on conflict do nothing;
insert into core.app_users (id, email, full_name, status) values
  ('aaaaaaaa-0000-0000-0000-0000000023a1', 'sales23@test', 'ทดสอบ ฝ่ายขาย', 'ใช้งาน'),
  ('aaaaaaaa-0000-0000-0000-0000000023b2', 'stock23@test', 'ทดสอบ ฝ่ายคลัง', 'ใช้งาน'),
  ('aaaaaaaa-0000-0000-0000-0000000023c3', 'cs23@test', 'ทดสอบ หลังการขาย', 'ใช้งาน') on conflict do nothing;
insert into core.user_capabilities (user_id, capability) values
  ('aaaaaaaa-0000-0000-0000-0000000023a1', 'sales.write'),
  ('aaaaaaaa-0000-0000-0000-0000000023b2', 'stock.write'),
  ('aaaaaaaa-0000-0000-0000-0000000023c3', 'cs.write') on conflict do nothing;

create temp table t23 (k text primary key, id uuid);
grant all on t23 to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- ข้อ 1 · anon
-- ---------------------------------------------------------------------------
set local role anon;
do $$
begin
  begin
    perform count(*) from leads.leads;
    raise exception '1 พัง: anon อ่านตารางได้';
  exception when insufficient_privilege then null; end;
  begin
    perform leads.create_lead('Messenger', 'คุณ ทดสอบ');
    raise exception '1 พัง: anon เรียกประตูได้';
  exception when insufficient_privilege then null; end;
  begin
    perform leads.upsert_from_line('Utest0', 'คุณ ทดสอบ', 'สวัสดี');
    raise exception '1 พัง: anon เรียกประตู LINE ได้';
  exception when insufficient_privilege then null; end;
  begin
    perform leads.week_summary(current_date);
    raise exception '1 พัง: anon เรียกสรุปได้';
  exception when insufficient_privilege then null; end;
  raise notice 'ข้อ 1 ผ่าน · anon ไม่ได้อะไรเลย';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- ข้อ 3-6, 8, 9 · ฝ่ายขายเดินงานจริง
-- ---------------------------------------------------------------------------
set local role authenticated;
set local "test.uid" = 'aaaaaaaa-0000-0000-0000-0000000023a1';
do $$
declare a uuid; b uuid; c uuid; r leads.leads; n int;
begin
  -- ข้อ 3 · เขียนตารางตรงไม่ได้
  begin
    insert into leads.leads (channel, display_name) values ('Messenger', 'คุณ ทดสอบ แอบเขียน');
    raise exception '3 พัง: เขียนตารางตรงได้';
  exception when insufficient_privilege then null; end;

  a := leads.create_lead('Messenger', '  คุณ ทดสอบ หนึ่ง  ', 'ถามราคา', repeat('ก', 250));
  insert into t23 values ('a', a);
  select * into r from leads.leads where id = a;
  if r.display_name <> 'คุณ ทดสอบ หนึ่ง' or r.stage <> 'ใหม่' or r.topic <> 'ถามราคา' or r.topic_suggested
     or r.readiness <> 'เย็น' or r.awaiting_reply_since is null
     or r.created_by <> 'aaaaaaaa-0000-0000-0000-0000000023a1' then
    raise exception '4 พัง: แถวใหม่ไม่ถูก %', to_jsonb(r);
  end if;
  -- ข้อ 8 · ตัด 200
  if char_length(r.last_message) <> 200 then raise exception '8 พัง: ข้อความยาว % ต้อง 200', char_length(r.last_message); end if;

  begin
    update leads.leads set stage = 'ซื้อ', outcome_source = 'LINE', closed_at = now() where id = a;
    raise exception '3 พัง: แก้ตารางตรงได้';
  exception when insufficient_privilege then null; end;
  begin
    perform leads.create_lead('Messenger', '   ');
    raise exception '4 พัง: ชื่อว่างผ่านได้' using errcode = 'T0023';
  exception when raise_exception then null; end;

  -- ข้อ 4 · เดินทุกขั้น
  perform leads.mark_replied(a);
  select * into r from leads.leads where id = a;
  if r.stage <> 'ตอบแล้ว' or r.awaiting_reply_since is not null or r.first_reply_at is null
     or r.next_action_on <> leads.today() + 2 then
    raise exception '4 พัง: ตอบแล้ว %', to_jsonb(r);
  end if;

  perform leads.set_need_by(a, 'ภายใน 1 เดือน', 'ร้อน');
  perform leads.set_tags(a, null, 'โซฟา');
  select * into r from leads.leads where id = a;
  if r.need_by <> 'ภายใน 1 เดือน' or r.readiness <> 'ร้อน' or not r.readiness_suggested
     or r.product <> 'โซฟา' or r.product_suggested then
    raise exception '4 พัง: ป้าย %', to_jsonb(r);
  end if;
  perform leads.set_tags(a, p_confirm => true);
  if (select readiness_suggested from leads.leads where id = a) then raise exception '4 พัง: ยืนยันป้ายแล้วยังเป็นระบบเสนอ'; end if;

  perform leads.set_stage(a, 'เสนอราคาแล้ว');
  select * into r from leads.leads where id = a;
  if r.stage <> 'เสนอราคาแล้ว' or r.next_action_on <> leads.today() + 3 or r.next_action_note <> 'ชวนมาโชว์รูม' then
    raise exception '4 พัง: เสนอราคาแล้ว %', to_jsonb(r);
  end if;

  n := leads.mark_followup_sent(a);
  if n <> 1 or (select followup_count from leads.leads where id = a) <> 1 then raise exception '4 พัง: นับทักตาม'; end if;

  -- ข้อ 5 · นัดแล้วต้องมีวันนัด
  begin
    perform leads.set_stage(a, 'นัดแล้ว');
    raise exception '5 พัง: นัดแล้วโดยไม่มีวันนัด' using errcode = 'T0023';
  exception when raise_exception then null; end;
  perform leads.set_stage(a, 'นัดแล้ว', leads.today() + 1, '14:00');
  select * into r from leads.leads where id = a;
  if r.stage <> 'นัดแล้ว' or r.appointment_on <> leads.today() + 1 or r.appointment_time <> '14:00'
     or r.next_action_on <> leads.today() or r.next_action_note <> 'ยืนยันนัด' then
    raise exception '4 พัง: นัดแล้ว %', to_jsonb(r);
  end if;
  perform leads.set_appointment(a, leads.today() + 5, '11:30');
  if (select next_action_on from leads.leads where id = a) <> leads.today() + 4 then raise exception '4 พัง: เลื่อนนัดแล้ววันทำต่อไม่ตาม'; end if;
  perform leads.mark_followup_sent(a);
  select * into r from leads.leads where id = a;
  if r.appointment_confirmed_at is null or r.next_action_on is not null or r.followup_count <> 1 then
    raise exception '4 พัง: ยืนยันนัด %', to_jsonb(r);
  end if;

  perform leads.set_stage(a, 'มาโชว์รูม');
  perform leads.set_next_action(a, leads.today() + 2, 'ถามผลวัดห้อง');
  if (select next_action_note from leads.leads where id = a) <> 'ถามผลวัดห้อง' then raise exception '4 พัง: วันทำต่อ'; end if;

  -- ข้อ 5 · ปิด
  begin
    perform leads.set_stage(a, 'ซื้อ');
    raise exception '5 พัง: ปิดเป็นซื้อผ่าน set_stage ได้' using errcode = 'T0023';
  exception when raise_exception then null; end;
  begin
    perform leads.close_bought(a, null);
    raise exception '5 พัง: ซื้อโดยไม่มีที่มา' using errcode = 'T0023';
  exception when raise_exception then null; end;
  begin
    perform leads.close_lost(a, null);
    raise exception '5 พัง: หายโดยไม่มีเหตุผล' using errcode = 'T0023';
  exception when raise_exception then null; end;

  perform leads.close_bought(a, 'Messenger');
  select * into r from leads.leads where id = a;
  if r.stage <> 'ซื้อ' or r.outcome_source <> 'Messenger' or r.closed_at is null
     or r.stage_before_close <> 'มาโชว์รูม' or r.next_action_on is not null then
    raise exception '4 พัง: ซื้อ %', to_jsonb(r);
  end if;
  if (select count(*) from leads.lead_events where lead_id = a and to_stage is not null) <> 6 then
    raise exception '4 พัง: ประวัติขั้นต้องมี 6 รายการ ได้ %',
      (select count(*) from leads.lead_events where lead_id = a and to_stage is not null);
  end if;
  if exists (select 1 from leads.lead_events where lead_id = a and created_by is distinct from 'aaaaaaaa-0000-0000-0000-0000000023a1') then
    raise exception '4 พัง: ประวัติไม่จดว่าใครกด';
  end if;

  -- ข้อ 6 · ปิดแล้วทำต่อไม่ได้ · เปิดกลับได้
  begin
    perform leads.set_stage(a, 'ตอบแล้ว');
    raise exception '6 พัง: แถวที่ปิดแล้วเปลี่ยนขั้นได้' using errcode = 'T0023';
  exception when raise_exception then null; end;
  begin
    perform leads.close_lost(a, 'ราคา');
    raise exception '6 พัง: ปิดซ้ำได้' using errcode = 'T0023';
  exception when raise_exception then null; end;
  perform leads.reopen(a);
  select * into r from leads.leads where id = a;
  if r.stage <> 'มาโชว์รูม' or r.outcome_source is not null or r.closed_at is not null then
    raise exception '6 พัง: ย้อนจากซื้อ %', to_jsonb(r);
  end if;
  begin
    perform leads.reopen(a);
    raise exception '6 พัง: เปิดแถวที่เปิดอยู่ได้' using errcode = 'T0023';
  exception when raise_exception then null; end;
  perform leads.close_bought(a, 'โชว์รูม');

  b := leads.create_lead('Instagram', 'คุณ ทดสอบ สอง');
  insert into t23 values ('b', b);
  perform leads.mark_replied(b);
  perform leads.close_lost(b, 'ยังไม่ถึงเวลา');
  select * into r from leads.leads where id = b;
  if r.stage <> 'หาย' or r.lost_reason <> 'ยังไม่ถึงเวลา' or r.outcome_source is not null then
    raise exception '5 พัง: หาย %', to_jsonb(r);
  end if;
  perform leads.reopen(b);
  select * into r from leads.leads where id = b;
  if r.stage <> 'ตอบแล้ว' or r.lost_reason is not null or r.next_action_on <> leads.today()
     or r.next_action_note <> 'ลูกค้าทักกลับมา ตอบต่อ' then
    raise exception '6 พัง: เปิดจากหาย %', to_jsonb(r);
  end if;
  perform leads.close_lost(b, 'ราคา');

  -- ไม่นับ
  c := leads.create_lead('โทรศัพท์', 'คุณ ทดสอบ สร้างผิด');
  insert into t23 values ('c', c);
  perform leads.set_counted(c, false);
  if (select counted from leads.leads where id = c) then raise exception '4 พัง: ไม่นับ'; end if;

  raise notice 'ข้อ 3-6, 8 ผ่าน · เขียนตรงไม่ได้ · เดินครบ 6 ขั้น · ซื้อต้องมีที่มา หายต้องมีเหตุผล · เปิดรายการเดิมได้ · ตัด 200';
end $$;

-- ข้อ 10 (ส่วนแรก) · คนล็อกอินเรียกประตู LINE ไม่ได้
do $$
begin
  begin
    perform leads.upsert_from_line('Utest0', 'คุณ ทดสอบ', 'สวัสดี');
    raise exception '10 พัง: คนล็อกอินเรียกประตู LINE ได้';
  exception when insufficient_privilege then null; end;
end $$;

-- cs.write ใช้ได้เหมือนกัน
set local "test.uid" = 'aaaaaaaa-0000-0000-0000-0000000023c3';
do $$
begin
  if (select count(*) from leads.leads) < 3 then raise exception '2 พัง: cs.write ต้องเห็นแถว'; end if;
  perform leads.set_tags((select id from t23 where k = 'b'), 'หลังการขาย');
end $$;

-- ---------------------------------------------------------------------------
-- ข้อ 2 · ล็อกอินแต่ไม่มีสิทธิ์
-- ---------------------------------------------------------------------------
set local "test.uid" = 'aaaaaaaa-0000-0000-0000-0000000023b2';
do $$
declare s jsonb;
begin
  if (select count(*) from leads.leads) <> 0 then raise exception '2 พัง: คนไม่มีสิทธิ์เห็นแถว'; end if;
  if (select count(*) from leads.lead_events) <> 0 then raise exception '2 พัง: คนไม่มีสิทธิ์เห็นประวัติ'; end if;
  if (select count(*) from leads.v_today) <> 0 then raise exception '2 พัง: คนไม่มีสิทธิ์เห็นงานวันนี้'; end if;
  begin
    perform leads.create_lead('Messenger', 'คุณ ทดสอบ ไม่มีสิทธิ์');
    raise exception '2 พัง: คนไม่มีสิทธิ์สร้างได้';
  exception when insufficient_privilege then null; end;
  begin
    perform leads.set_stage((select id from t23 where k = 'a'), 'ตอบแล้ว');
    raise exception '2 พัง: คนไม่มีสิทธิ์เปลี่ยนขั้นได้';
  exception when insufficient_privilege then null; end;
  begin
    perform leads.close_lost((select id from t23 where k = 'a'), 'ราคา');
    raise exception '2 พัง: คนไม่มีสิทธิ์ปิดได้';
  exception when insufficient_privilege then null; end;
  begin
    perform leads.reopen((select id from t23 where k = 'a'));
    raise exception '2 พัง: คนไม่มีสิทธิ์เปิดได้';
  exception when insufficient_privilege then null; end;
  s := leads.week_summary(leads.today() - 3);
  if (s->'funnel'->>'new')::int <> 0 or (s->'funnel'->>'bought')::int <> 0 then
    raise exception '2 พัง: คนไม่มีสิทธิ์เห็นตัวเลขสรุป %', s;
  end if;
  raise notice 'ข้อ 2 ผ่าน · ไม่มีสิทธิ์ = ไม่เห็นแถว เรียกประตูไม่ได้ สรุปได้ศูนย์';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- ข้อ 7, 8, 9, 10 · LINE (service_role)
-- ---------------------------------------------------------------------------
set local "test.uid" = '';
set local role service_role;
do $$
declare j jsonb; lid uuid;
begin
  -- ข้อ 10 · อ่านตารางไม่ได้ · เรียกประตูอื่นไม่ได้
  begin
    perform count(*) from leads.leads;
    raise exception '10 พัง: service_role อ่านตารางได้';
  exception when insufficient_privilege then null; end;
  begin
    perform leads.close_lost(gen_random_uuid(), 'ราคา');
    raise exception '10 พัง: service_role เรียกประตูของพนักงานได้';
  exception when insufficient_privilege then null; end;

  j := leads.upsert_from_line('Utest0001', 'คุณ ทดสอบ ไลน์', E'โซฟา 3 ที่นั่ง\nราคาเท่าไหร่คะ ' || repeat('ข', 300),
                              '2026-11-16 03:00:00+00', 'ถามราคา', 'โซฟา');
  if not (j->>'created')::boolean then raise exception '7 พัง: ครั้งแรกต้องสร้างแถว %', j; end if;
  lid := (j->>'id')::uuid;
  insert into t23 values ('line', lid);

  -- ส่งซ้ำ (เหตุการณ์เดิม เวลาเดิม) = ไม่สร้างแถว ไม่เปลี่ยนอะไร
  j := leads.upsert_from_line('Utest0001', 'คุณ ทดสอบ ไลน์', 'โซฟา 3 ที่นั่ง ราคาเท่าไหร่คะ',
                              '2026-11-16 03:00:00+00', 'ถามราคา', 'โซฟา');
  if (j->>'created')::boolean or (j->>'changed')::boolean or (j->>'id')::uuid <> lid then
    raise exception '7 พัง: ส่งซ้ำต้องไม่เปลี่ยนอะไร %', j;
  end if;
  -- ข้อความเก่ากว่ามาถึงทีหลัง = ไม่ทับ
  j := leads.upsert_from_line('Utest0001', 'คุณ ทดสอบ ไลน์', 'ข้อความเก่า', '2026-11-16 02:00:00+00');
  if (j->>'changed')::boolean then raise exception '7 พัง: ข้อความเก่าทับของใหม่ %', j; end if;
  -- ช่องว่างหน้าหลังรหัส = คนเดิม
  j := leads.upsert_from_line(' Utest0001 ', null, 'ขอบคุณค่ะ', '2026-11-16 03:05:00+00');
  if (j->>'created')::boolean or (j->>'id')::uuid <> lid then raise exception '7 พัง: คนเดิมได้แถวใหม่ %', j; end if;
  -- อีกคน = อีกแถว
  j := leads.upsert_from_line('Utest0002', '', 'มีเตียง 6 ฟุตไหม', '2026-11-16 03:06:00+00', null, 'เตียง');
  if not (j->>'created')::boolean then raise exception '7 พัง: คนใหม่ต้องได้แถวใหม่ %', j; end if;
  insert into t23 values ('line2', (j->>'id')::uuid);
  begin
    perform leads.upsert_from_line('  ', 'คุณ ทดสอบ', 'x');
    raise exception '7 พัง: รหัสผู้ใช้ว่างผ่านได้' using errcode = 'T0023';
  exception when raise_exception then null; end;
end $$;
reset role;

do $$
declare r leads.leads; lid uuid := (select id from t23 where k = 'line'); j jsonb;
begin
  if (select count(*) from leads.leads where channel = 'LINE' and channel_user_id = 'Utest0001') <> 1 then
    raise exception '7 พัง: รหัสผู้ใช้เดียวมีหลายแถว';
  end if;
  if (select count(*) from leads.leads where channel = 'LINE') <> 2 then raise exception '7 พัง: LINE ต้องมี 2 แถว'; end if;
  if (select count(*) from leads.lead_events where lead_id = lid) <> 1 then raise exception '7 พัง: ส่งซ้ำแล้วประวัติงอก'; end if;

  select * into r from leads.leads where id = lid;
  if r.last_message <> 'ขอบคุณค่ะ' or r.last_message_at <> '2026-11-16 03:05:00+00' or r.display_name <> 'คุณ ทดสอบ ไลน์'
     or r.topic <> 'ถามราคา' or not r.topic_suggested or r.product <> 'โซฟา' or not r.product_suggested
     or r.stage <> 'ใหม่' or r.created_by is not null then
    raise exception '7 พัง: แถว LINE %', to_jsonb(r);
  end if;
  if (select display_name from leads.leads where id = (select id from t23 where k = 'line2')) <> 'ลูกค้า LINE' then
    raise exception '7 พัง: ไม่มีชื่อต้องใช้ชื่อกลาง';
  end if;
  begin
    insert into leads.leads (channel, channel_user_id, display_name) values ('LINE', 'Utest0001', 'คุณ ทดสอบ ซ้ำ');
    raise exception '7 พัง: ฐานข้อมูลยอมให้รหัสผู้ใช้ซ้ำ';
  exception when unique_violation then null; end;
end $$;

-- ข้อ 8 · ข้อความยาว + ขึ้นบรรทัดใหม่ ถูกตัดเหลือบรรทัดเดียว 200 ตัวอักษร (ดูจากข้อความแรกก่อนถูกทับ: ทดสอบซ้ำด้วยคนที่ 3)
set local role service_role;
do $$
declare j jsonb;
begin
  j := leads.upsert_from_line('Utest0003', 'คุณ ทดสอบ ยาว', E'บรรทัดแรก\n\nบรรทัดสอง ' || repeat('ค', 400), '2026-11-16 03:10:00+00');
  insert into t23 values ('line3', (j->>'id')::uuid);
end $$;
reset role;
do $$
declare m text := (select last_message from leads.leads where id = (select id from t23 where k = 'line3'));
begin
  if char_length(m) <> 200 or m like E'%\n%' or m not like 'บรรทัดแรก บรรทัดสอง %' then
    raise exception '8 พัง: ข้อความ LINE ต้องเหลือบรรทัดเดียว 200 ตัวอักษร ได้ % ตัว', char_length(m);
  end if;
end $$;

-- ข้อ 9 · คนตั้งป้ายแล้ว ระบบไม่ทับ · ข้อ 7 · หายแล้วทักมา = เปิดแถวเดิม
set local role authenticated;
set local "test.uid" = 'aaaaaaaa-0000-0000-0000-0000000023a1';
do $$
declare lid uuid := (select id from t23 where k = 'line');
begin
  perform leads.set_tags(lid, 'งานโครงการ');           -- คนตั้งเรื่องเอง · สินค้ายังเป็นระบบเสนอ
  perform leads.mark_replied(lid);
  perform leads.set_stage(lid, 'เสนอราคาแล้ว');
  perform leads.close_lost(lid, 'ติดต่อไม่ได้');
end $$;
set local "test.uid" = '';
set local role service_role;
do $$
declare j jsonb;
begin
  j := leads.upsert_from_line('Utest0001', 'คุณ ทดสอบ ไลน์ ชื่อใหม่', 'ขอนัดดูเตียงค่ะ', '2026-11-16 05:00:00+00', 'นัดโชว์รูม', 'เตียง');
  if (j->>'created')::boolean or not (j->>'reopened')::boolean then raise exception '7 พัง: หายแล้วทักมาต้องเปิดแถวเดิม %', j; end if;
end $$;
reset role;
do $$
declare r leads.leads;
begin
  select * into r from leads.leads where id = (select id from t23 where k = 'line');
  if r.topic <> 'งานโครงการ' or r.topic_suggested then raise exception '9 พัง: ระบบทับป้ายที่คนตั้ง %', to_jsonb(r); end if;
  if r.product <> 'เตียง' or not r.product_suggested then raise exception '9 พัง: ป้ายที่ระบบเสนอต้องทับได้ %', to_jsonb(r); end if;
  if r.stage <> 'เสนอราคาแล้ว' or r.lost_reason is not null or r.closed_at is not null
     or r.awaiting_reply_since is null or r.display_name <> 'คุณ ทดสอบ ไลน์ ชื่อใหม่' or r.followup_count <> 0 then
    raise exception '7 พัง: เปิดแถวเดิม %', to_jsonb(r);
  end if;
  if (select count(*) from leads.leads where channel = 'LINE' and channel_user_id = 'Utest0001') <> 1 then
    raise exception '7 พัง: เปิดแถวเดิมแล้วมีแถวซ้ำ';
  end if;
  raise notice 'ข้อ 7-10 ผ่าน · LINE 1 คน 1 แถว · ส่งซ้ำไม่เปลี่ยน · หายแล้วทักมาเปิดแถวเดิม · ตัด 200 · ป้ายคนตั้งไม่ถูกทับ · ประตู LINE เฉพาะ service_role';
end $$;

-- ---------------------------------------------------------------------------
-- ข้อ 11 · หน้า "วันนี้"
--   จัดฉากด้วยสิทธิ์เจ้าของฐาน (ย้อนเวลา) แล้วอ่านด้วยฝ่ายขาย
--   ตอนนี้: a = ซื้อ · b = หาย · c = ไม่นับ · line = เสนอราคาแล้ว (เพิ่งทักกลับ) · line2, line3 = ใหม่ (เพิ่งทัก)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local "test.uid" = 'aaaaaaaa-0000-0000-0000-0000000023a1';
do $$
declare d uuid; e uuid; f uuid;
begin
  d := leads.create_lead('Messenger', 'คุณ ทดสอบ ทักตาม');           -- จะถึงวันทักตาม
  perform leads.mark_replied(d);
  perform leads.set_next_action(d, leads.today(), 'ทักตามหลังส่งโบรชัวร์');
  e := leads.create_lead('Instagram', 'คุณ ทดสอบ นัดพรุ่งนี้');        -- นัดพรุ่งนี้ ยังไม่ยืนยัน
  perform leads.set_stage(e, 'นัดแล้ว', leads.today() + 1, '14:00');
  f := leads.create_lead('LINE', 'คุณ ทดสอบ นัดอีกสี่วัน');            -- นัดอีก 4 วัน ไม่ต้องขึ้น
  perform leads.set_stage(f, 'นัดแล้ว', leads.today() + 4, '11:00');
  insert into t23 values ('d', d), ('e', e), ('f', f);
end $$;
reset role;
-- line2 รอมา 135 นาที · line3 รอมา 30 นาที · c (ไม่นับ) รอมา 3 ชั่วโมง · a (ซื้อ) ใส่วันทำต่อย้อนหลังไม่ได้เพราะปิดแล้ว
update leads.leads set awaiting_reply_since = now() - interval '135 minutes' where id = (select id from t23 where k = 'line2');
update leads.leads set awaiting_reply_since = now() - interval '30 minutes'  where id = (select id from t23 where k = 'line3');
update leads.leads set awaiting_reply_since = now() - interval '3 hours'     where id = (select id from t23 where k = 'c');
update leads.leads set awaiting_reply_since = now() - interval '10 minutes'  where id = (select id from t23 where k = 'line');

set local role authenticated;
set local "test.uid" = 'aaaaaaaa-0000-0000-0000-0000000023a1';
do $$
declare got text; want text;
begin
  select string_agg(v.bucket || ':' || t.k, ',' order by v.bucket, t.k) into got
  from leads.v_today v join t23 t on t.id = v.id;
  want := 'appointment:e,followup:d,followup:line,unanswered:line2';   -- line = หายแล้วทักกลับมา ระบบตั้งวันทำต่อเป็นวันนี้
  if got is distinct from want then raise exception '11 พัง: งานวันนี้ต้องเป็น [%] ได้ [%]', want, got; end if;
  if (select waiting_minutes from leads.v_today where id = (select id from t23 where k = 'line2')) not between 134 and 136 then
    raise exception '11 พัง: นาทีที่รอ';
  end if;

  -- กดตอบแล้ว = หายจากรายการ · ยืนยันนัดแล้ว = หายจากรายการ · ส่งทักตามแล้ว = เลื่อนไป 3 วัน
  perform leads.mark_replied((select id from t23 where k = 'line2'));
  perform leads.mark_followup_sent((select id from t23 where k = 'e'));
  perform leads.mark_followup_sent((select id from t23 where k = 'd'));
  perform leads.mark_followup_sent((select id from t23 where k = 'line'));
  if (select count(*) from leads.v_today v join t23 t on t.id = v.id) <> 0 then
    raise exception '11 พัง: ทำเสร็จแล้วยังค้างในงานวันนี้ %',
      (select string_agg(v.bucket || ':' || t.k, ',') from leads.v_today v join t23 t on t.id = v.id);
  end if;
  raise notice 'ข้อ 11 ผ่าน · งานวันนี้ 3 รายการถูกแถว · ไม่มีแถวที่ปิด/ไม่นับ/ยังไม่ถึงเวลา · ทำแล้วหายจากรายการ';
end $$;

-- ---------------------------------------------------------------------------
-- ข้อ 12 · สรุปสัปดาห์ (ช่วง 7 วันที่คร่อมวันนี้)
--   แถวที่นับ: a (Messenger · ซื้อ) · b (Instagram · หาย เหตุผล ราคา) · line, line2, line3, f (LINE) · d (Messenger) · e (Instagram)
--   แถว c ไม่นับ
-- ---------------------------------------------------------------------------
do $$
declare s jsonb := leads.week_summary(leads.today() - 3); ch jsonb;
begin
  if (s->'funnel'->>'new')::int <> 8 then raise exception '12 พัง: คนใหม่ต้อง 8 ได้ %', s->'funnel'; end if;
  if (s->'funnel'->>'replied')::int <> 5 then raise exception '12 พัง: ตอบแล้วต้อง 5 (a b line line2 d) ได้ %', s->'funnel'; end if;
  if (s->'funnel'->>'quoted')::int <> 2 then raise exception '12 พัง: เสนอราคาต้อง 2 (a line) ได้ %', s->'funnel'; end if;
  if (s->'funnel'->>'appointed')::int <> 3 then raise exception '12 พัง: นัดแล้วต้อง 3 (a e f) ได้ %', s->'funnel'; end if;
  if (s->'funnel'->>'visited')::int <> 1 or (s->'funnel'->>'bought')::int <> 1 or (s->'funnel'->>'lost')::int <> 1 then
    raise exception '12 พัง: มาโชว์รูม/ซื้อ/หาย ต้อง 1/1/1 ได้ %', s->'funnel';
  end if;
  if s->'lost_reasons' <> '[{"n": 1, "reason": "ราคา"}]'::jsonb then raise exception '12 พัง: เหตุผลที่หาย %', s->'lost_reasons'; end if;
  select x into ch from jsonb_array_elements(s->'channels') x where x->>'channel' = 'LINE';
  if (ch->>'new')::int <> 4 or (ch->>'appointed')::int <> 1 or (ch->>'bought')::int <> 0 then raise exception '12 พัง: ช่องทาง LINE %', ch; end if;
  select x into ch from jsonb_array_elements(s->'channels') x where x->>'channel' = 'Messenger';
  if (ch->>'new')::int <> 2 or (ch->>'visited')::int <> 1 or (ch->>'bought')::int <> 1 then raise exception '12 พัง: ช่องทาง Messenger %', ch; end if;
  -- เวลาตอบครั้งแรก: เฉพาะ LINE ที่เข้าระบบเอง และตอบแล้ว = line, line2
  if (s->'first_reply'->>'n')::int <> 2 then raise exception '12 พัง: เวลาตอบครั้งแรกต้องนับ 2 แถว ได้ %', s->'first_reply'; end if;
  -- สัปดาห์อื่น = ศูนย์
  s := leads.week_summary(leads.today() - 30);
  if (s->'funnel'->>'new')::int <> 0 or (s->'funnel'->>'replied')::int <> 0 then raise exception '12 พัง: สัปดาห์ก่อนต้องว่าง %', s; end if;
  raise notice 'ข้อ 12 ผ่าน · สรุปนับสดจากแถวและประวัติ · ไม่นับแถวที่ติ๊กไม่นับ';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- ข้อ 13 · A7 · check constraint · ทะเบียนโมดูล · รายการ schema
-- ---------------------------------------------------------------------------
do $$
declare cfg text; s text;
begin
  begin
    delete from leads.leads where id = (select id from t23 where k = 'c');
    raise exception '13 พัง: ลบแถวได้';
  exception when restrict_violation then null; end;
  begin
    delete from leads.lead_events where lead_id = (select id from t23 where k = 'c');
    raise exception '13 พัง: ลบประวัติได้';
  exception when restrict_violation then null; end;

  -- แม้เจ้าของฐานข้อมูลก็ปิดโดยไม่มีที่มา/เหตุผลไม่ได้
  begin
    update leads.leads set stage = 'ซื้อ', closed_at = now() where id = (select id from t23 where k = 'd');
    raise exception '13 พัง: ซื้อโดยไม่มีที่มา (ตารางยอม)';
  exception when check_violation then null; end;
  begin
    update leads.leads set stage = 'หาย', closed_at = now() where id = (select id from t23 where k = 'd');
    raise exception '13 พัง: หายโดยไม่มีเหตุผล (ตารางยอม)';
  exception when check_violation then null; end;
  begin
    update leads.leads set last_message = repeat('ง', 201) where id = (select id from t23 where k = 'd');
    raise exception '13 พัง: ข้อความเกิน 200 (ตารางยอม)';
  exception when check_violation then null; end;

  if not exists (select 1 from core.modules where id = 'leads' and name_th = 'คนสนใจ' and home_path = '/leads'
                 and db_schema = 'leads' and required_capability = 'sales.write' and depends_on = '{core}' and is_enabled) then
    raise exception '13 พัง: ทะเบียนโมดูล';
  end if;
  if (select count(*) from core.modules where sort_order = 3) <> 1 then raise exception '13 พัง: ลำดับเมนูชนกัน'; end if;

  select c into cfg from pg_db_role_setting rs, unnest(rs.setconfig) c
   where rs.setrole = 'authenticator'::regrole and c like 'pgrst.db_schemas=%';
  foreach s in array array['public','graphql_public','core','catalog','materials','pricing','cost','marketing','stock',
                           'content','crm','sales','line_agent','sheets','pos','production','leads'] loop
    if cfg !~ ('[=, ]' || s || '(,|$)') then raise exception '13 พัง: schema % หลุดจากรายการที่เปิดให้เว็บ [%]', s, cfg; end if;
  end loop;
  -- ทุก schema ที่โมดูลในทะเบียนใช้ ต้องอยู่ในรายการ
  for s in select distinct db_schema from core.modules where db_schema is not null loop
    if cfg !~ ('[=, ]' || s || '(,|$)') then raise exception '13 พัง: schema % ของโมดูลในทะเบียนไม่อยู่ในรายการ', s; end if;
  end loop;

  -- ไม่มีช่องต้นทุน/กำไร และไม่อ้าง schema cost
  if exists (select 1 from information_schema.columns where table_schema = 'leads' and column_name ~* 'cost|profit|margin') then
    raise exception '13 พัง: มีช่องต้นทุนในโมดูลคนสนใจ';
  end if;
  if exists (select 1 from pg_proc p where p.pronamespace = 'leads'::regnamespace and p.prosrc ~* '\mcost\.') then
    raise exception '13 พัง: ฟังก์ชันของโมดูลคนสนใจอ้าง schema cost';
  end if;
  raise notice 'ข้อ 13 ผ่าน · ห้ามลบ · ตารางบังคับที่มา/เหตุผล/200 ตัวอักษร · ทะเบียนโมดูล · schema ครบ 17 ตัว · ไม่มีต้นทุน';
end $$;

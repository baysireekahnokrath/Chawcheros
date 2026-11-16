-- ============================================================================
-- ทดสอบ 0048 · คลังความรู้ + เก็บบทสนทนา + FAQ สาธารณะ
-- ============================================================================
--   psql -1 -v ON_ERROR_STOP=1 -d t1 -f supabase/tests/20_line_knowledge.sql   (ต้องมี -1)
--
--   1 ★ R2  เปิดเก็บบทสนทนาโดยยังไม่โพสต์แจ้งทีม = ฐานข้อมูลไม่ยอม
--   2 ★ เก็บเฉพาะห้องที่อนุมัติ+เปิดเก็บ+แจ้งแล้ว · ไม่เก็บซ้ำ · ห้องพักบอท = ไม่เก็บ
--   3   จำชื่อคนในแชท 14 วัน · ไม่ต้องถาม LINE ทุกข้อความ
--   4   "จดเรื่องนี้": พิมพ์ต่อท้าย · Reply ข้อความที่เก็บไว้ · Reply ที่ไม่ได้เก็บ = บอกให้พิมพ์เอง
--   5 ★ R4  ไม่ยืนยัน = บอท/FAQ ใช้ไม่ได้ · ยืนยันต้องมีผู้ตรวจ · แก้หลังยืนยัน = กลับเป็นร่างเอง
--   6 ★ LR-11 ต้นทุน/กำไร เข้าบอทและ FAQ ไม่ได้ · FAQ ห้ามมีเลข BLS/เบอร์โทร
--   7 ★ บอทค้นได้เฉพาะข้อที่ยืนยัน+bot_use+ห้องเปิด see_kb
--   8   รอบสรุป: ส่ง AI เป็นเลขคน (ไม่มีชื่อ) · บันทึกแล้วข้อความถูกทำเครื่องหมาย · ค่าเข้างบ
--   9 ★ FAQ สาธารณะ: anon อ่านได้แค่ข้อความที่เขียนให้ลูกค้า · แตะตารางตรงๆ ไม่ได้
--  10 ★ สิทธิ์: บทสนทนาดิบ Bay เท่านั้น · ทีมขายเห็นเฉพาะข้อที่ยืนยัน · แก้ไม่ได้
--  11   A7 ห้ามลบ
-- ============================================================================

insert into auth.users (id) values ('aaaaaaaa-0000-0000-0000-0000000000a1'), ('aaaaaaaa-0000-0000-0000-0000000000b2') on conflict do nothing;
insert into core.app_users (id, email, full_name, status) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'bay20@test', 'Bay', 'ใช้งาน'),
  ('aaaaaaaa-0000-0000-0000-0000000000b2', 'sales20@test', 'ขาย', 'ใช้งาน') on conflict do nothing;
insert into core.user_capabilities (user_id, capability) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'admin'),
  ('aaaaaaaa-0000-0000-0000-0000000000b2', 'sales.write') on conflict do nothing;

do $$
declare r jsonb; n int; bay uuid := 'aaaaaaaa-0000-0000-0000-0000000000a1'; id1 uuid; id2 uuid; id3 uuid; ok boolean;
begin
  insert into line_agent.rooms (group_id, name, status, see_kb) values
    ('Kpo',   'CC - PO และ production', 'อนุมัติ', true),
    ('Kqc',   'CC- เช็คงาน', 'อนุมัติ', false),
    ('Kwait', 'ห้องใหม่', 'รออนุมัติ', true);

  -- ข้อ 1 · R2
  begin
    update line_agent.rooms set kb_collect = true where group_id = 'Kpo';
    raise exception 'ไม่ควรมาถึงตรงนี้';
  exception when check_violation then null; end;
  update line_agent.rooms set kb_collect = true, kb_notice_at = now() where group_id = 'Kpo';
  raise notice 'ข้อ 1 ผ่าน · เปิดเก็บโดยไม่แจ้งทีมไม่ได้ (R2)';

  -- ข้อ 2 · เก็บ
  r := line_agent.kb_log_message('{"group_id":"Kpo","message_id":"m1","line_user_id":"U1","text":"ผ้ากันน้ำซักเครื่องได้ไหม","sent_at":"2026-11-11T03:00:00Z"}');
  if not (r->>'logged')::boolean then raise exception '2 พัง: ห้องที่เปิดเก็บ+แจ้งแล้ว ต้องเก็บ %', r; end if;
  r := line_agent.kb_log_message('{"group_id":"Kpo","message_id":"m1","line_user_id":"U1","text":"ซ้ำ","sent_at":"2026-11-11T03:00:01Z"}');
  if (r->>'logged')::boolean then raise exception '2 พัง: ข้อความซ้ำต้องไม่เก็บซ้ำ'; end if;
  r := line_agent.kb_log_message('{"group_id":"Kqc","message_id":"m2","line_user_id":"U2","text":"ห้องที่ไม่ได้เปิดเก็บ"}');
  if (r->>'logged')::boolean then raise exception '2 พัง: ห้องที่ไม่ได้เปิดเก็บต้องไม่เก็บ'; end if;
  r := line_agent.kb_log_message('{"group_id":"Kwait","message_id":"m3","line_user_id":"U2","text":"ห้องรออนุมัติ"}');
  if (r->>'logged')::boolean then raise exception '2 พัง: ห้องไม่อนุมัติต้องไม่เก็บ'; end if;
  r := line_agent.kb_log_message('{"group_id":"Kunknown","message_id":"m4","line_user_id":"U2","text":"ห้องที่ไม่รู้จัก"}');
  if (r->>'logged')::boolean then raise exception '2 พัง: ห้องที่ไม่รู้จักต้องไม่เก็บ'; end if;
  perform line_agent.kb_log_message('{"group_id":"Kpo","message_id":"m5","line_user_id":"U2","text":"ลูกค้า BLS3230 ขอเลื่อนส่ง","sent_at":"2026-11-11T03:05:00Z"}');
  update line_agent.settings set paused = true where id = 1;
  r := line_agent.kb_log_message('{"group_id":"Kpo","message_id":"m6","line_user_id":"U2","text":"ตอนพักบอท"}');
  update line_agent.settings set paused = false where id = 1;
  if (r->>'logged')::boolean then raise exception '2 พัง: พักบอทอยู่ต้องไม่เก็บ'; end if;
  select count(*) into n from line_agent.chat_log;
  if n <> 2 then raise exception '2 พัง: ควรมี 2 ข้อความ ได้ %', n; end if;
  raise notice 'ข้อ 2 ผ่าน · เก็บเฉพาะห้องที่อนุมัติ+เปิดเก็บ+แจ้งแล้ว · ไม่ซ้ำ · พักบอทไม่เก็บ';

  -- ข้อ 3 · ชื่อ
  r := line_agent.kb_log_message('{"group_id":"Kpo","message_id":"m7","line_user_id":"U3","text":"สวัสดี"}');
  if not (r->>'need_name')::boolean then raise exception '3 พัง: คนใหม่ต้องขอชื่อ'; end if;
  perform line_agent.kb_member_name('U3', 'พี่หนิง');
  r := line_agent.kb_log_message('{"group_id":"Kpo","message_id":"m8","line_user_id":"U3","text":"ว่าไง"}');
  if (r->>'need_name')::boolean then raise exception '3 พัง: รู้ชื่อแล้วต้องไม่ถามอีก'; end if;
  update line_agent.members set updated_at = now() - interval '20 days' where line_user_id = 'U3';
  r := line_agent.kb_log_message('{"group_id":"Kpo","message_id":"m9","line_user_id":"U3","text":"ผ่านไปนาน"}');
  if not (r->>'need_name')::boolean then raise exception '3 พัง: เกิน 14 วันต้องถามใหม่'; end if;
  raise notice 'ข้อ 3 ผ่าน · จำชื่อ 14 วัน';

  -- ข้อ 4 · จดเรื่องนี้
  r := line_agent.kb_note_add('{"group_id":"Kpo","text":"จุดน้ำตาลบนเบาะผ้า = ราขึ้นจากความชื้น ให้เช็ดก่อนส่ง งาน BLS3199","display_name":"บิ๊ง"}');
  if not (r->>'ok')::boolean then raise exception '4 พัง: จดจากข้อความที่พิมพ์ %', r; end if;
  if (select bls from line_agent.kb_items where id = (r->>'id')::uuid) <> 'BLS3199' then raise exception '4 พัง: ต้องจับเลข BLS จากข้อความ'; end if;
  if (select status from line_agent.kb_items where id = (r->>'id')::uuid) <> 'ร่าง' then raise exception '4 พัง: จดแล้วต้องเป็นร่าง'; end if;
  r := line_agent.kb_note_add('{"group_id":"Kpo","text":"","quoted_message_id":"m5","display_name":"บิ๊ง"}');
  if not (r->>'ok')::boolean then raise exception '4 พัง: Reply ข้อความที่เก็บไว้ต้องจดได้ %', r; end if;
  if (select body from line_agent.kb_items where id = (r->>'id')::uuid) not like '%ขอเลื่อนส่ง%' then raise exception '4 พัง: ต้องจดเนื้อหาข้อความที่ Reply'; end if;
  r := line_agent.kb_note_add('{"group_id":"Kpo","text":"","quoted_message_id":"zzz"}');
  if (r->>'ok')::boolean or r->>'error' <> 'no_quoted' then raise exception '4 พัง: Reply ข้อความที่ไม่ได้เก็บต้องบอกให้พิมพ์เอง %', r; end if;
  r := line_agent.kb_note_add('{"group_id":"Kwait","text":"ห้องที่ยังไม่อนุมัติจดไม่ได้เลย"}');
  if (r->>'ok')::boolean then raise exception '4 พัง: ห้องไม่อนุมัติต้องจดไม่ได้'; end if;
  r := line_agent.kb_note_add('{"group_id":"Kqc","text":"ห้องที่อนุมัติแต่ไม่ได้เปิดเก็บ · สั่งจดเองได้"}');
  if not (r->>'ok')::boolean then raise exception '4 พัง: สั่งจดเองได้แม้ห้องไม่เปิดเก็บ'; end if;
  raise notice 'ข้อ 4 ผ่าน · จดเรื่องนี้: พิมพ์ต่อท้าย · Reply · Reply ที่ไม่ได้เก็บ · ห้องไม่อนุมัติ';

  -- ข้อ 5 · R4
  insert into line_agent.kb_items (title, body, category, source) values
    ('ผ้ากันน้ำซักเครื่องได้ไหม', 'ซักมือเท่านั้น น้ำเย็น ห้ามปั่นแห้ง', 'การดูแลรักษา', 'สรุปจากแชท');
  select id into id1 from line_agent.kb_items where title = 'ผ้ากันน้ำซักเครื่องได้ไหม';
  begin update line_agent.kb_items set bot_use = true where id = id1; raise exception 'ควรถูกฐานข้อมูลปฏิเสธแต่ผ่าน (จุดที่ 1)';
  exception when check_violation then null; end;
  begin update line_agent.kb_items set reviewed_at = now() + interval '2 seconds', is_public = true, public_title = 'q', public_body = 'a' where id = id1; raise exception 'ควรถูกฐานข้อมูลปฏิเสธแต่ผ่าน (จุดที่ 2)';
  exception when check_violation then null; end;
  begin update line_agent.kb_items set status = 'ยืนยันแล้ว' where id = id1; raise exception 'ควรถูกฐานข้อมูลปฏิเสธแต่ผ่าน (จุดที่ 3)';
  exception when check_violation then null; end;
  update line_agent.kb_items set status = 'ยืนยันแล้ว', reviewed_by = bay, reviewed_at = now(), bot_use = true,
         is_public = true, public_title = 'ผ้ากันน้ำซักเครื่องได้ไหม', public_body = 'แนะนำซักมือด้วยน้ำเย็น เพื่อคงคุณสมบัติกันน้ำ'
   where id = id1;
  update line_agent.kb_items set body = 'ซักมือเท่านั้น น้ำเย็น ห้ามปั่นแห้ง ห้ามใช้น้ำยาปรับผ้านุ่ม' where id = id1;
  if (select status from line_agent.kb_items where id = id1) <> 'ร่าง'
     or (select bot_use or is_public from line_agent.kb_items where id = id1) then
    raise exception '5 พัง: แก้เนื้อหาหลังยืนยัน ต้องกลับเป็นร่างและบอท/FAQ เลิกใช้เอง';
  end if;
  update line_agent.kb_items set status = 'ยืนยันแล้ว', reviewed_by = bay, reviewed_at = now(), bot_use = true,
         is_public = true where id = id1;
  update line_agent.kb_items set category = 'การดูแลรักษา' where id = id1;     -- ไม่เปลี่ยนอะไรจริง ต้องไม่รีเซ็ต
  if (select status from line_agent.kb_items where id = id1) <> 'ยืนยันแล้ว' then raise exception '5 พัง: ไม่ได้แก้เนื้อหา ต้องไม่รีเซ็ต'; end if;
  update line_agent.kb_items set body = 'ซักมือเท่านั้น น้ำเย็น', status = 'ยืนยันแล้ว', reviewed_by = bay, reviewed_at = now() + interval '1 second' where id = id1;
  if (select status from line_agent.kb_items where id = id1) <> 'ยืนยันแล้ว' then raise exception '5 พัง: Bay แก้+ยืนยันใหม่ในคำสั่งเดียวต้องยังยืนยันอยู่'; end if;
  raise notice 'ข้อ 5 ผ่าน · R4 ยืนยันก่อนถึงใช้ได้ · ต้องมีผู้ตรวจ · แก้แล้วกลับเป็นร่างเอง';

  -- ข้อ 6 · LR-11 + FAQ ไม่มีข้อมูลลูกค้า
  insert into line_agent.kb_items (title, body, category, source, status, reviewed_by, reviewed_at)
    values ('ราคาต้นทุนโซฟา', 'ต้นทุนต่อตัว 12,000', 'ภายใน', 'จดเอง', 'ยืนยันแล้ว', bay, now());
  select id into id2 from line_agent.kb_items where title = 'ราคาต้นทุนโซฟา';
  begin update line_agent.kb_items set bot_use = true where id = id2; raise exception 'ควรถูกฐานข้อมูลปฏิเสธแต่ผ่าน (จุดที่ 4)';
  exception when check_violation then null; end;
  begin update line_agent.kb_items set reviewed_at = now() + interval '2 seconds', is_public = true, public_title = 'ราคา', public_body = 'กำไร 30%' where id = id2; raise exception 'ควรถูกฐานข้อมูลปฏิเสธแต่ผ่าน (จุดที่ 5)';
  exception when check_violation then null; end;
  insert into line_agent.kb_items (title, body, category, source, status, reviewed_by, reviewed_at)
    values ('เลื่อนส่งทำยังไง', 'ลูกค้า BLS3230 ขอเลื่อน ให้ทีม ASE ยืนยันวันใหม่', 'การส่งของ', 'จดเอง', 'ยืนยันแล้ว', bay, now());
  select id into id3 from line_agent.kb_items where title = 'เลื่อนส่งทำยังไง';
  begin update line_agent.kb_items set reviewed_at = now() + interval '2 seconds', is_public = true, public_title = 'ขอเลื่อนส่ง', public_body = 'งาน BLS3230 เลื่อนได้' where id = id3; raise exception 'ควรถูกฐานข้อมูลปฏิเสธแต่ผ่าน (จุดที่ 6)';
  exception when check_violation then null; end;
  begin update line_agent.kb_items set reviewed_at = now() + interval '2 seconds', is_public = true, public_title = 'ขอเลื่อนส่ง', public_body = 'โทร 081-234-5678 ได้เลย' where id = id3; raise exception 'ควรถูกฐานข้อมูลปฏิเสธแต่ผ่าน (จุดที่ 7)';
  exception when check_violation then null; end;
  begin update line_agent.kb_items set reviewed_at = now() + interval '2 seconds', is_public = true, public_title = 'ขอเลื่อนส่ง', public_body = 'โทร 0812345678 ได้เลย' where id = id3; raise exception 'ควรถูกฐานข้อมูลปฏิเสธแต่ผ่าน (จุดที่ 8)';
  exception when check_violation then null; end;
  update line_agent.kb_items set reviewed_at = now() + interval '2 seconds', is_public = true, public_title = 'ขอเลื่อนวันส่งได้ไหม',
         public_body = 'แจ้งทีมงานล่วงหน้าอย่างน้อย 7 วัน ทีมจะยืนยันวันส่งใหม่ให้ค่ะ' where id = id3;     -- เลข 7 วัน ต้องผ่าน
  raise notice 'ข้อ 6 ผ่าน · ต้นทุน/กำไรเข้าบอทและ FAQ ไม่ได้ · FAQ ห้ามมี BLS/เบอร์โทร';

  -- ข้อ 7 · บอทค้น
  update line_agent.kb_items set bot_use = true where id = id3;
  r := line_agent.kb_search('ผ้ากันน้ำ ซักเครื่อง', 'Kpo');
  if jsonb_array_length(r) <> 1 or r->0->>'title' <> 'ผ้ากันน้ำซักเครื่องได้ไหม' then raise exception '7 พัง: ค้นผ้ากันน้ำต้องได้ 1 ข้อ %', r; end if;
  r := line_agent.kb_search('เลื่อนส่ง', 'Kpo');
  if jsonb_array_length(r) <> 1 or r->0->>'title' <> 'เลื่อนส่งทำยังไง' then raise exception '7 พัง: ค้นเลื่อนส่ง %', r; end if;
  r := line_agent.kb_search('ต้นทุน', 'Kpo');
  if jsonb_array_length(r) <> 0 then raise exception '7 พัง: ข้อที่ไม่ได้เปิดบอทต้องไม่โผล่ %', r; end if;
  r := line_agent.kb_search('ซักมือ', 'Kpo');                       -- ข้อที่ยังเป็นร่าง/ไม่ยืนยันต้องไม่โผล่ (ข้อเรื่องจุดน้ำตาล)
  if (select count(*) from jsonb_array_elements(r) e where e->>'title' like 'จุดน้ำตาล%') > 0 then raise exception '7 พัง: ร่างต้องไม่โผล่'; end if;
  r := line_agent.kb_search('ผ้ากันน้ำ', 'Kqc');
  if not (r->>'hidden')::boolean then raise exception '7 พัง: ห้องที่ไม่เปิด see_kb ต้องได้ hidden %', r; end if;
  if line_agent.kb_search('ผ้ากันน้ำ', 'Kwait') is not null then raise exception '7 พัง: ห้องไม่อนุมัติต้องได้ null'; end if;
  r := line_agent.kb_search('%', 'Kpo');
  if jsonb_array_length(r) <> 0 then raise exception '7 พัง: เครื่องหมายเปอร์เซ็นต์ห้ามเป็น wildcard %', r; end if;
  r := line_agent.kb_search('  ', 'Kpo');
  if jsonb_array_length(r) <> 0 then raise exception '7 พัง: คำค้นว่างต้องไม่ได้อะไร'; end if;
  raise notice 'ข้อ 7 ผ่าน · บอทค้นเฉพาะที่ยืนยัน+bot_use+ห้องเปิด · เครื่องหมายเปอร์เซ็นต์ไม่เป็น wildcard';

  -- ข้อ 8 · รอบสรุป
  perform line_agent.kb_log_message('{"group_id":"Kpo","message_id":"m10","line_user_id":"U1","text":"ลูกค้าถามว่าเบาะหนังเช็ดยังไง","sent_at":"2026-11-11T04:00:00Z"}');
  r := line_agent.kb_digest_input(100);
  if jsonb_array_length(r->'messages') < 5 then raise exception '8 พัง: ต้องมีข้อความรอสรุป %', r->'messages'; end if;
  if r::text like '%พี่หนิง%' or r::text like '%บิ๊ง%' then raise exception '8 พัง: ห้ามส่งชื่อคนในแชทให้ AI'; end if;
  if (r->'budget'->>'remaining_thb') is null then raise exception '8 พัง: ต้องส่งงบที่เหลือมาด้วย (รอบสรุปใช้เช็กงบ)'; end if;
  if (r->'messages'->0->>'who') not like 'คน%' then raise exception '8 พัง: ต้องใช้เลขคน'; end if;
  n := line_agent.kb_digest_save(jsonb_build_object(
    'run_by', 'กดเอง', 'period_from', now() - interval '7 days', 'period_to', now(),
    'messages', jsonb_array_length(r->'messages'), 'requests', 0,
    'model', 'claude-sonnet-5-5', 'input_tokens', 10000, 'output_tokens', 2000,
    'usd_per_mtok_in', 2, 'usd_per_mtok_out', 10, 'thb_per_usd', 33,
    'message_ids', (select jsonb_agg(e->'id') from jsonb_array_elements(r->'messages') e),
    'items', jsonb_build_array(jsonb_build_object('title', 'เบาะหนังเช็ดยังไง', 'body', 'เช็ดด้วยผ้าหมาดนุ่ม',
      'category', 'การดูแลรักษา', 'refs', jsonb_build_array(jsonb_build_object('kind', 'chat', 'id', 'm10', 'excerpt', 'x'))))));
  if n <> 1 then raise exception '8 พัง: ควรสร้างร่าง 1 ข้อ ได้ %', n; end if;
  if exists (select 1 from line_agent.chat_log where digested_at is null) then raise exception '8 พัง: ข้อความที่สรุปแล้วต้องถูกทำเครื่องหมาย'; end if;
  if (select status || source from line_agent.kb_items where title = 'เบาะหนังเช็ดยังไง') <> 'ร่างสรุปจากแชท' then
    raise exception '8 พัง: ที่ AI สรุปต้องเป็นร่าง (R4)';
  end if;
  if jsonb_array_length(line_agent.kb_digest_input(100)->'messages') <> 0 then raise exception '8 พัง: รอบถัดไปต้องไม่เห็นข้อความเดิม'; end if;
  if (select spent_thb from line_agent.v_budget) <> 1.32 then raise exception '8 พัง: ค่ารอบสรุปต้องเข้างบ ได้ %', (select spent_thb from line_agent.v_budget); end if;
  raise notice 'ข้อ 8 ผ่าน · ส่ง AI เป็นเลขคน · ผลเป็นร่าง · ข้อความถูกทำเครื่องหมาย · ค่า Claude เข้างบ';
end $$;

-- ข้อ 9 · FAQ สาธารณะ
set local role anon;
do $$
declare r jsonb; denied int := 0;
begin
  r := line_agent.faq_public();
  if jsonb_array_length(r->'items') <> 2 then raise exception '9 พัง: FAQ ต้องมีเฉพาะ 2 ข้อที่ติ๊กสาธารณะ ได้ %', r; end if;
  if r::text ~ '(BLS|ห้ามปั่นแห้ง|ต้นทุน|กำไร|จุดน้ำตาล)' then raise exception '9 พัง: FAQ ห้ามมีข้อมูลภายใน %', r; end if;
  if (select count(*) from jsonb_object_keys(r->'items'->0)) <> 5 then raise exception '9 พัง: ต้องมีแค่ id/category/q/a/updated_at'; end if;
  begin perform 1 from line_agent.kb_items; exception when insufficient_privilege then denied := denied + 1; end;
  begin perform 1 from line_agent.chat_log; exception when insufficient_privilege then denied := denied + 1; end;
  begin perform line_agent.kb_search('ผ้า', 'Kpo'); exception when insufficient_privilege then denied := denied + 1; end;
  begin perform line_agent.kb_digest_input(10); exception when insufficient_privilege then denied := denied + 1; end;
  if denied <> 4 then raise exception '9 พัง: anon ต้องแตะตารางและฟังก์ชันภายในไม่ได้ (ถูกกัน % จาก 4)', denied; end if;
  raise notice 'ข้อ 9 ผ่าน · anon อ่านได้แค่ FAQ ที่เขียนให้ลูกค้า · แตะตาราง/ฟังก์ชันภายในไม่ได้';
end $$;
reset role;

-- ข้อ 10 · สิทธิ์
set local role authenticated;
set local "test.uid" = 'aaaaaaaa-0000-0000-0000-0000000000b2';
do $$
declare n int;
begin
  if (select count(*) from line_agent.chat_log) <> 0 then raise exception '10 พัง: ทีมขายเห็นบทสนทนาดิบ'; end if;
  if exists (select 1 from line_agent.kb_items where status <> 'ยืนยันแล้ว') then raise exception '10 พัง: ทีมขายเห็นร่าง'; end if;
  if (select count(*) from line_agent.kb_items) <> 3 then raise exception '10 พัง: ทีมขายควรเห็นข้อที่ยืนยัน 3 ข้อ'; end if;
  update line_agent.kb_items set status = 'ไม่ใช้';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '10 พัง: ทีมขายแก้คลังความรู้ได้'; end if;
end $$;
set local "test.uid" = 'aaaaaaaa-0000-0000-0000-0000000000a1';
do $$
begin
  if (select count(*) from line_agent.chat_log) < 6 then raise exception '10 พัง: Bay ต้องเห็นบทสนทนา'; end if;
  if (select count(*) from line_agent.kb_items) < 6 then raise exception '10 พัง: Bay ต้องเห็นทุกข้อรวมร่าง'; end if;
  update line_agent.kb_items set status = 'ไม่ใช้', bot_use = false, is_public = false where title = 'ราคาต้นทุนโซฟา';
  raise notice 'ข้อ 10 ผ่าน · บทสนทนาดิบ Bay เท่านั้น · ทีมขายอ่านเฉพาะข้อที่ยืนยัน แก้ไม่ได้ · Bay แก้ได้';
end $$;
reset role;

-- ข้อ 11 · A7
do $$
begin
  begin delete from line_agent.kb_items where true; raise exception 'ควรถูกฐานข้อมูลปฏิเสธแต่ผ่าน (จุดที่ 9)'; exception when others then
    if sqlerrm = 'x' then raise exception '11 พัง: ลบคลังความรู้ได้'; end if; end;
  begin delete from line_agent.chat_log where true; raise exception 'ควรถูกฐานข้อมูลปฏิเสธแต่ผ่าน (จุดที่ 10)'; exception when others then
    if sqlerrm = 'x' then raise exception '11 พัง: ลบบทสนทนาได้'; end if; end;
  raise notice 'ข้อ 11 ผ่าน · ห้ามลบ (A7)';
  raise notice '20 ผ่านทั้ง 11 ข้อ';
end $$;

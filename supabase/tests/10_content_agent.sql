-- ============================================================================
-- ทดสอบโมดูลคอนเทนต์ · รอบ R3 Content agent
-- ============================================================================
-- ใช้ผู้ใช้จาก 06 (ทีม 4444…) และ 09 (หัวหน้า 6666… · Bay 7777…)
-- ============================================================================

set local role authenticated;

do $$
declare
  CREW constant text := '44444444-4444-4444-4444-444444444444';
  LEAD constant text := '66666666-6666-6666-6666-666666666666';
  BAY  constant text := '77777777-7777-7777-7777-777777777777';
  v_cc uuid; v_item uuid; v_req uuid; v_note uuid; v_sec uuid; v_q uuid;
  v_spent numeric; v_status text; n int; msg text := '';
begin
  perform set_config('test.uid', BAY, true);
  select id into v_cc from catalog.brands where name = 'ฌ เฌอ';
  perform content.seed_brand_brain(v_cc);
  select count(*) into n from content.brand_sections where brand_id = v_cc;
  if n <> 14 then raise exception 'แบรนด์ควรมีหัวข้อตั้งต้น 14 หัวข้อ ได้ %', n; end if;
  select count(*) into n from content.playbooks where brand_id = v_cc;
  if n <> 3 then raise exception 'ควรมีคู่มือ FB IG บล็อก ได้ %', n; end if;
  msg := msg || E'\n  ✓ แบรนด์ได้ brand model 9 หัวข้อ + brand book 5 หัวข้อ + คู่มือ 3 ช่องทาง';

  -- ── ทีมตั้งสมองของแบรนด์ไม่ได้ ───────────────────────────────────────────
  perform set_config('test.uid', CREW, true);
  begin
    perform content.seed_brand_brain(v_cc);
    raise exception 'ทีมตั้งสมองแบรนด์ได้ ซึ่งไม่ควร';
  exception when insufficient_privilege then null;
  end;
  update content.brand_sections set body = 'แอบแก้' where brand_id = v_cc and topic = 'Purpose';
  if exists (select 1 from content.brand_sections where brand_id = v_cc and body = 'แอบแก้') then
    raise exception 'ทีมแก้ brand model ได้ ซึ่งไม่ควร';
  end if;
  msg := msg || E'\n  ✓ brand model / คู่มือ แก้ได้เฉพาะ Bay';

  -- ── Bay เขียน = ยืนยันเอง ────────────────────────────────────────────────
  perform set_config('test.uid', BAY, true);
  update content.brand_sections set body = 'ทำให้บ้านคนไทยน่าอยู่' where brand_id = v_cc and topic = 'Purpose'
    returning id into v_sec;
  if (select confirmed_by from content.brand_sections where id = v_sec) <> BAY::uuid then
    raise exception 'Bay บันทึกแล้วไม่ได้ยืนยัน';
  end if;
  msg := msg || E'\n  ✓ Bay บันทึกหัวข้อ = ยืนยันแล้ว agent ใช้ได้';

  -- ── บันทึก AI: เขียนในชื่อคนอื่นไม่ได้ · ลบไม่ได้ · งบคำนวณถูก ────────────
  perform set_config('test.uid', CREW, true);
  begin
    insert into content.ai_requests (requested_by, kind, model, status, usd_per_mtok_in, usd_per_mtok_out, thb_per_usd)
    values (BAY::uuid, 'เขียนข้อความ', 'claude-opus-5', 'สำเร็จ', 5, 25, 35);
    raise exception 'บันทึก AI ในชื่อคนอื่นได้ ซึ่งไม่ควร';
  exception when insufficient_privilege then null;
  end;
  insert into content.items (title, format, brand_id, hook) values ('โซฟา mid century', 'ภาพเดี่ยว', v_cc, 'โซฟาตัวนี้เกิดปี 60')
    returning id into v_item;
  insert into content.ai_requests (kind, item_id, brand_id, model, status, input_tokens, output_tokens,
                                   usd_per_mtok_in, usd_per_mtok_out, thb_per_usd)
  values ('เขียนข้อความ', v_item, v_cc, 'claude-opus-5', 'สำเร็จ', 100000, 20000, 5, 25, 35)
  returning id into v_req;
  -- (100000×5 + 20000×25) / 1e6 = $1.00 → 35 บาท
  select spent_thb into v_spent from content.v_ai_budget;
  if v_spent <> 35 then raise exception 'ใช้ไปควรเป็น 35 บาท ได้ %', v_spent; end if;
  begin
    delete from content.ai_requests where id = v_req;
    if exists (select 1 from content.ai_requests where id = v_req) then null;
    else raise exception 'ลบบันทึก AI ได้ ซึ่งไม่ควร'; end if;
  exception when others then
    if sqlerrm like 'ลบบันทึก AI ได้%' then raise; end if;
  end;
  update content.ai_requests set output_tokens = 0 where id = v_req;
  if (select output_tokens from content.ai_requests where id = v_req) <> 20000 then
    raise exception 'แก้บันทึก AI ได้ ซึ่งไม่ควร';
  end if;
  msg := msg || E'\n  ✓ บันทึก AI ในชื่อตัวเองเท่านั้น · แก้/ลบไม่ได้ · งบเดือนนี้คิดเป็นบาทถูก (35 บาท)';

  -- ── สมุด: agent เสนอได้ · ยืนยันเองไม่ได้ · Bay ยืนยัน ─────────────────────
  insert into content.notebook (brand_id, body, source, from_item_id, request_id)
  values (null, 'Bay ไม่ชอบคำว่า "ราคาพิเศษ"', 'agent เสนอ', v_item, v_req) returning id into v_note;
  begin
    insert into content.notebook (body, source, status) values ('แอบใช้เลย', 'agent เสนอ', 'ใช้อยู่');
    raise exception 'ทีมใส่ข้อในสมุดแบบใช้อยู่ได้ ซึ่งไม่ควร';
  exception when insufficient_privilege then null;
  end;
  update content.notebook set status = 'ใช้อยู่' where id = v_note;
  if (select status from content.notebook where id = v_note) <> 'รอยืนยัน' then
    raise exception 'ทีมยืนยันข้อในสมุดได้ ซึ่งไม่ควร';
  end if;
  perform set_config('test.uid', BAY, true);
  update content.notebook set status = 'ใช้อยู่' where id = v_note;
  if (select confirmed_by from content.notebook where id = v_note) <> BAY::uuid then
    raise exception 'Bay ยืนยันแล้วไม่ได้บันทึกว่าใครยืนยัน';
  end if;
  update content.notebook set status = 'เลิกใช้' where id = v_note;
  msg := msg || E'\n  ✓ สมุด: agent เสนอได้อย่างเดียว · Bay ยืนยัน/เลิกใช้ · บันทึกว่าใครยืนยัน';

  -- ── คำถาม agent: ทีมตอบไม่ได้ · หัวหน้าตอบได้ + ขึ้นในแชท ────────────────
  perform set_config('test.uid', CREW, true);
  insert into content.agent_questions (item_id, request_id, question, choices)
  values (v_item, v_req, 'รุ่นนี้ mid century ตรงไหน?', array['ขาเรียว', 'ทรงเตี้ย']) returning id into v_q;
  begin
    perform content.answer_question(v_q, 'ขาเรียว');
    raise exception 'ทีมตอบคำถาม agent ได้ ซึ่งไม่ควร';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.uid', LEAD, true);
  perform content.answer_question(v_q, 'ขาเรียว ไม้สัก');
  if not exists (select 1 from content.messages where item_id = v_item and body like 'ตอบ agent:%ขาเรียว ไม้สัก') then
    raise exception 'ตอบแล้วไม่ขึ้นในแชท';
  end if;
  msg := msg || E'\n  ✓ คำถาม agent ตอบได้เฉพาะคนอนุมัติ · คำตอบขึ้นในแชทของงาน';

  -- ── ข้อความ AI ในแชท: ผ่านฟังก์ชันได้ · พิมพ์ตรงเป็น AI ไม่ได้ ─────────────
  perform content.post_ai_message(v_item, 'เขียน FB กับ IG แล้ว', null);
  begin
    insert into content.messages (item_id, author_id, kind, body) values (v_item, LEAD::uuid, 'AI', 'ปลอมเป็น AI');
    raise exception 'พิมพ์ในชื่อ AI ได้ ซึ่งไม่ควร';
  exception when insufficient_privilege then null;
  end;
  msg := msg || E'\n  ✓ ข้อความ AI ในแชทมาจากระบบเท่านั้น';

  -- ── ตั้งค่า AI: ทีมแก้งบไม่ได้ · Bay แก้ได้ ─────────────────────────────
  perform set_config('test.uid', CREW, true);
  update content.ai_settings set monthly_budget_thb = 99999;
  if (select monthly_budget_thb from content.ai_settings) <> 300 then raise exception 'ทีมแก้งบได้'; end if;
  perform set_config('test.uid', BAY, true);
  update content.ai_settings set monthly_budget_thb = 500;
  if (select remaining_thb from content.v_ai_budget) <> 465 then raise exception 'งบคงเหลือคิดผิด'; end if;
  msg := msg || E'\n  ✓ งบ AI แก้ได้เฉพาะ Bay · คงเหลือคำนวณจากงบ − ที่ใช้';

  raise notice E'10_content_agent ผ่านทั้งหมด%', msg;
end $$;

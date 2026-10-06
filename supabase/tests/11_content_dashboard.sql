-- ============================================================================
-- ทดสอบโมดูลคอนเทนต์ · รอบ R5 หน้าแรก · แฟ้มคู่แข่ง + ไอเดียจาก agent
-- ใช้ผู้ใช้จาก 06 (ทีม 4444…) และ 09 (Bay 7777…)
-- ============================================================================

insert into auth.users (id) values ('88888888-8888-8888-8888-888888888888') on conflict do nothing;
insert into core.app_users (id, email, full_name, status) values
  ('88888888-8888-8888-8888-888888888888', 'viewer@test', 'คนนอกทีม', 'ใช้งาน') on conflict do nothing;

set local role authenticated;

do $$
declare
  CREW constant text := '44444444-4444-4444-4444-444444444444';
  BAY  constant text := '77777777-7777-7777-7777-777777777777';
  OUTSIDER constant text := '88888888-8888-8888-8888-888888888888';
  v_cc uuid; v_swipe uuid; v_idea uuid; msg text := '';
begin
  perform set_config('test.uid', CREW, true);
  select id into v_cc from catalog.brands where name = 'ฌ เฌอ';

  insert into content.swipes (brand_id, url, competitor, seen_text)
  values (v_cc, 'https://facebook.com/x/posts/1', 'แบรนด์ A', 'โซฟาที่แมวไม่ข่วน') returning id into v_swipe;
  if (select created_by from content.swipes where id = v_swipe) <> CREW::uuid then raise exception 'ไม่ได้บันทึกว่าใครแปะ'; end if;
  begin
    insert into content.swipes (url) values ('ไม่ใช่ลิงก์');
    raise exception 'แปะของที่ไม่ใช่ลิงก์ได้ ซึ่งไม่ควร';
  exception when check_violation then null;
  end;
  begin
    delete from content.swipes where id = v_swipe;
  exception when others then null;
  end;
  if not exists (select 1 from content.swipes where id = v_swipe) then raise exception 'ลบแฟ้มคู่แข่งได้ ซึ่งไม่ควร (A7)'; end if;
  msg := msg || E'\n  ✓ แฟ้มคู่แข่ง: ทีมแปะลิงก์ได้ · ต้องเป็นลิงก์ · ลบไม่ได้ (เก็บเข้าลิ้นชักแทน)';

  perform set_config('test.uid', OUTSIDER, true);
  if exists (select 1 from content.swipes) then raise exception 'คนนอกทีมเห็นแฟ้มคู่แข่ง'; end if;
  msg := msg || E'\n  ✓ คนนอกทีมคอนเทนต์มองไม่เห็นแฟ้มคู่แข่ง';

  perform set_config('test.uid', CREW, true);
  insert into content.idea_suggestions (brand_id, week_of, title) values (v_cc, current_date, 'เล่าเรื่องไม้สัก')
    returning id into v_idea;
  perform set_config('test.uid', BAY, true);
  update content.idea_suggestions set status = 'เอา' where id = v_idea;
  if (select decided_by from content.idea_suggestions where id = v_idea) <> BAY::uuid then
    raise exception 'เลือกไอเดียแล้วไม่ได้บันทึกว่าใครเลือก';
  end if;
  msg := msg || E'\n  ✓ ไอเดียจาก agent: กด "เอา" บันทึกว่าใครเลือกเมื่อไหร่';

  raise notice E'11_content_dashboard ผ่านทั้งหมด%', msg;
end $$;

-- ============================================================================
-- ทดสอบ 0049 · ข่าว Chaw Cher / ASE
-- ============================================================================
--   psql -1 -v ON_ERROR_STOP=1 -d t1 -f supabase/tests/21_news.sql   (ต้องมี -1)
--
--   1 ★ กันซ้ำ: รหัสแถวชีตซ้ำ หรือลิงก์เดียวกัน (http/https · www · / ท้าย) = ข้าม · รอบดึงนับ "ซ้ำ"
--   2 ★ ข่าวที่ "ไม่ใช้" ยังกันซ้ำ · ไม่เด้งกลับมา
--   3 ★ แถวจากชีตต้องมีรหัส
--   4 ★ ของออกนอก: เผยแพร่ / ส่ง LINE ต้องมีคนกด (reviewed_by)
--   6 ★ สิทธิ์: Bay เท่านั้น · ทีมขายไม่เห็น · ฟังก์ชันของตัวดึงชีตคนทั่วไปเรียกไม่ได้
--   7   A7 ห้ามลบ · ข่าวแรก (Dior) อยู่ในระบบ
-- ============================================================================

insert into auth.users (id) values ('aaaaaaaa-0000-0000-0000-0000000000a1'), ('aaaaaaaa-0000-0000-0000-0000000000b2') on conflict do nothing;
insert into core.app_users (id, email, full_name, status) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'bay20@test', 'Bay', 'ใช้งาน'),
  ('aaaaaaaa-0000-0000-0000-0000000000b2', 'sales20@test', 'ขาย', 'ใช้งาน') on conflict do nothing;
insert into core.user_capabilities (user_id, capability) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'admin'),
  ('aaaaaaaa-0000-0000-0000-0000000000b2', 'sales.write') on conflict do nothing;

do $$
declare n int; nid uuid;
begin
  -- ข้อ 7 (ส่วนแรก) · ข่าวแรกจาก migration
  if not exists (select 1 from content.news_items where post_title like 'Chaw Cher เยือน Dior%' and wp_post_id is null and status = 'ร่าง' and jsonb_array_length(images) = 3) then
    raise exception '7 พัง: ไม่มีข่าวแรก (Dior)';
  end if;

  -- ข้อ 1 · กันซ้ำ (รหัสชีต + ลิงก์)
  n := content.news_import('{"run_by":"ตั้งเวลา","items":[
        {"sheet_ref":"2026-11-12-01","brand":"ASE","source_url":"https://www.facebook.com/AseSofa/posts/1/","source_title":"ASE งานบ้านและสวน","source_date":"2026-11-10","summary":"s","post_title":"ASE ออกบูธ","post_body":"b","line_text":"l","images":[{"url":"https://x/1.jpg"}]},
        {"sheet_ref":"2026-11-12-02","brand":"Chaw Cher","source_url":"https://news.example.com/a?","source_title":"ข่าว","source_date":"","summary":"s","post_title":"CC ได้รางวัล","post_body":"b","line_text":"l","images":[]},
        {"sheet_ref":"2026-11-12-03","brand":"chaw cher","source_url":"","post_title":"เล่าเอง ไม่มีลิงก์","post_body":"b","line_text":"l","images":[]}
      ]}'::jsonb);
  if n <> 3 then raise exception '1 พัง: ควรสร้าง 3 ได้ %', n; end if;
  n := content.news_import('{"run_by":"กดเอง","items":[
        {"sheet_ref":"2026-11-12-01","brand":"ASE","post_title":"รหัสซ้ำ","post_body":"","line_text":""},
        {"sheet_ref":"2026-11-13-01","brand":"ASE","source_url":"http://facebook.com/asesofa/posts/1","post_title":"ลิงก์ซ้ำ","post_body":"","line_text":""},
        {"sheet_ref":"2026-11-13-02","brand":"Chaw Cher","source_url":"https://news.example.com/b","post_title":"ใหม่","post_body":"","line_text":""}
      ]}'::jsonb);
  if n <> 1 then raise exception '1 พัง: รหัสซ้ำ/ลิงก์ซ้ำ ต้องไม่ถูกสร้าง ได้ %', n; end if;
  if not exists (select 1 from content.news_runs where run_by = 'กดเอง' and rows_read = 3 and created = 1 and skipped_dupes = 2) then
    raise exception '1 พัง: รอบดึงต้องบันทึก อ่าน 3 ใหม่ 1 ซ้ำ 2';
  end if;
  if (select source_date from content.news_items where sheet_ref = '2026-11-12-01') <> '2026-11-10' then raise exception '1 พัง: วันที่ต้นทาง'; end if;

  -- ข้อ 2 · ไม่ใช้แล้วก็ยังกันซ้ำ
  update content.news_items set status = 'ไม่ใช้' where sheet_ref = '2026-11-13-02';
  n := content.news_import('{"items":[{"sheet_ref":"2026-11-14-01","brand":"Chaw Cher","source_url":"https://news.example.com/b/","post_title":"x","post_body":"","line_text":""}]}'::jsonb);
  if n <> 0 then raise exception '2 พัง: ข่าวที่ไม่ใช้เด้งกลับมา'; end if;

  -- ข้อ 3 · แถวจากชีตต้องมีรหัส
  begin
    insert into content.news_items (brand, source, post_title) values ('ASE', 'ชีตข่าว', 'ไม่มีรหัส');
    raise exception 'ไม่ควรมาถึงตรงนี้';
  exception when check_violation then null; end;
  insert into content.news_items (brand, source, post_title) values ('ASE', 'Bay ส่งเอง', 'เพิ่มเองในเว็บ') returning id into nid;

  -- ข้อ 4 · ของออกนอกต้องมีคนกด
  begin
    update content.news_items set status = 'เผยแพร่แล้ว', wp_post_id = 99999 where id = nid;
    raise exception 'ไม่ควรมาถึงตรงนี้';
  exception when check_violation then null; end;
  begin
    update content.news_items set line_sent_at = now() where id = nid;
    raise exception 'ไม่ควรมาถึงตรงนี้';
  exception when check_violation then null; end;
  begin
    update content.news_items set status = 'เผยแพร่แล้ว', reviewed_by = 'aaaaaaaa-0000-0000-0000-0000000000a1' where id = nid;
    raise exception 'ไม่ควรมาถึงตรงนี้ (เผยแพร่ต้องมีโพสต์ WordPress)';
  exception when check_violation then null; end;
  update content.news_items set status = 'เผยแพร่แล้ว', wp_post_id = 99999, reviewed_by = 'aaaaaaaa-0000-0000-0000-0000000000a1' where id = nid;

  raise notice 'ข้อ 1-4 ผ่าน · กันซ้ำด้วยรหัส+ลิงก์ · ไม่ใช้ก็กันซ้ำ · แถวชีตต้องมีรหัส · ของออกนอกต้องมีคนกด';
end $$;

-- ข้อ 6 · สิทธิ์
set local role authenticated;
set local "test.uid" = 'aaaaaaaa-0000-0000-0000-0000000000b2';
do $$
declare n int;
begin
  if (select count(*) from content.news_items) <> 0 then raise exception '6 พัง: ทีมขายเห็นข่าว'; end if;
  if (select count(*) from content.news_runs) <> 0 then raise exception '6 พัง: ทีมขายเห็นค่าใช้จ่าย'; end if;
  begin
    perform content.news_import('{"items":[]}'::jsonb);
    raise exception 'ไม่ควรมาถึงตรงนี้';
  exception when insufficient_privilege then null; end;
end $$;
set local "test.uid" = 'aaaaaaaa-0000-0000-0000-0000000000a1';
do $$
declare n int;
begin
  if (select count(*) from content.news_items) < 5 then raise exception '6 พัง: Bay ต้องเห็นข่าวทั้งหมด'; end if;
  update content.news_items set post_body = post_body || ' ' where post_title like 'Chaw Cher เยือน Dior%';
  get diagnostics n = row_count;
  if n <> 1 then raise exception '6 พัง: Bay แก้ข่าวไม่ได้'; end if;
end $$;
reset role;

-- ข้อ 7 · A7 (แม้แต่เจ้าของฐานข้อมูลก็ลบไม่ได้)
do $$
begin
  begin
    delete from content.news_items where post_title like 'Chaw Cher เยือน Dior%';
    raise exception 'ไม่ควรมาถึงตรงนี้';
  exception when restrict_violation then null; end;
  raise notice 'ข้อ 6-7 ผ่าน · Bay เท่านั้น · ตัวตั้งเวลาเรียกผ่าน service_role · ห้ามลบ';
end $$;

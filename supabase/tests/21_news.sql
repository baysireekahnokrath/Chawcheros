-- ============================================================================
-- ทดสอบ 0049 · ข่าว Chaw Cher / ASE
-- ============================================================================
--   psql -1 -v ON_ERROR_STOP=1 -d t1 -f supabase/tests/21_news.sql   (ต้องมี -1)
--
--   1 ★ กันซ้ำ: ลิงก์เดียวกัน (http/https · www · / ท้าย) สร้างซ้ำไม่ได้ · รอบบันทึกนับเป็น "ซ้ำ"
--   2 ★ ข่าวที่ "ไม่ใช้" ยังกันซ้ำ · ไม่เด้งกลับมา
--   3 ★ ค้นอัตโนมัติต้องมีลิงก์ต้นทาง
--   4 ★ ของออกนอก: เผยแพร่ / ส่ง LINE ต้องมีคนกด (reviewed_by)
--   5   ข้อมูลให้ AI: รายการที่มีแล้ว + ค่าใช้จ่ายเดือนนี้ + วันนี้ค้นแล้วหรือยัง
--   6 ★ สิทธิ์: Bay เท่านั้น · ทีมขายไม่เห็น · ฟังก์ชันของตัวตั้งเวลาคนทั่วไปเรียกไม่ได้
--   7   A7 ห้ามลบ · ข่าวแรก (WP 18153) อยู่ในระบบ
-- ============================================================================

insert into auth.users (id) values ('aaaaaaaa-0000-0000-0000-0000000000a1'), ('aaaaaaaa-0000-0000-0000-0000000000b2') on conflict do nothing;
insert into core.app_users (id, email, full_name, status) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'bay20@test', 'Bay', 'ใช้งาน'),
  ('aaaaaaaa-0000-0000-0000-0000000000b2', 'sales20@test', 'ขาย', 'ใช้งาน') on conflict do nothing;
insert into core.user_capabilities (user_id, capability) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'admin'),
  ('aaaaaaaa-0000-0000-0000-0000000000b2', 'sales.write') on conflict do nothing;

do $$
declare n int; r jsonb; nid uuid;
begin
  -- ข้อ 7 (ส่วนแรก) · ข่าวแรกจาก migration
  if not exists (select 1 from content.news_items where wp_post_id = 18153 and status = 'ร่าง' and jsonb_array_length(images) = 3) then
    raise exception '7 พัง: ไม่มีข่าวแรก (WP 18153)';
  end if;

  -- ข้อ 1 · กันซ้ำ
  n := content.news_run_save('{"run_by":"ตั้งเวลา","model":"m","input_tokens":1000000,"output_tokens":100000,"web_searches":5,
      "usd_per_mtok_in":2,"usd_per_mtok_out":10,"usd_per_search":0.01,"thb_per_usd":36,
      "items":[
        {"brand":"ASE","source_url":"https://www.facebook.com/AseSofa/posts/1/","source_title":"ASE งานบ้านและสวน","summary":"s","post_title":"ASE ออกบูธ","post_body":"b","line_text":"l"},
        {"brand":"Chaw Cher","source_url":"https://news.example.com/a?","source_title":"ข่าว","summary":"s","post_title":"CC ได้รางวัล","post_body":"b","line_text":"l"}
      ]}'::jsonb);
  if n <> 2 then raise exception '1 พัง: ควรสร้าง 2 ได้ %', n; end if;
  n := content.news_run_save('{"run_by":"ตั้งเวลา","items":[
        {"brand":"ASE","source_url":"http://facebook.com/asesofa/posts/1","source_title":"ซ้ำ","summary":"s","post_title":"ซ้ำ","post_body":"b","line_text":"l"},
        {"brand":"Chaw Cher","source_url":"https://news.example.com/b","source_title":"ใหม่","summary":"s","post_title":"ใหม่","post_body":"b","line_text":"l"}
      ]}'::jsonb);
  if n <> 1 then raise exception '1 พัง: ลิงก์ซ้ำ (http/www/ท้าย /) ต้องไม่ถูกสร้าง ได้ %', n; end if;
  if (select skipped_dupes from content.news_runs order by created_at desc, id limit 1) is distinct from 1
     and not exists (select 1 from content.news_runs where skipped_dupes = 1) then
    raise exception '1 พัง: รอบบันทึกต้องนับซ้ำ 1';
  end if;

  -- ข้อ 2 · ไม่ใช้แล้วก็ยังกันซ้ำ
  update content.news_items set status = 'ไม่ใช้' where source_url = 'https://news.example.com/b';
  n := content.news_run_save('{"run_by":"กดเอง","items":[{"brand":"Chaw Cher","source_url":"https://news.example.com/b/","source_title":"x","summary":"s","post_title":"x","post_body":"b","line_text":"l"}]}'::jsonb);
  if n <> 0 then raise exception '2 พัง: ข่าวที่ไม่ใช้เด้งกลับมา'; end if;

  -- ข้อ 3 · ค้นอัตโนมัติต้องมีลิงก์
  begin
    insert into content.news_items (brand, source, post_title) values ('ASE', 'ค้นอัตโนมัติ', 'ไม่มีลิงก์');
    raise exception 'ไม่ควรมาถึงตรงนี้';
  exception when check_violation then null; end;
  insert into content.news_items (brand, source, post_title) values ('ASE', 'Bay ส่งเอง', 'เล่าเอง ไม่มีลิงก์ได้') returning id into nid;

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

  -- ข้อ 5 · ข้อมูลให้ AI
  r := content.news_run_input();
  if jsonb_array_length(r->'seen') < 4 then raise exception '5 พัง: seen ควรมีอย่างน้อย 4 ได้ %', r->'seen'; end if;
  if not (r->'seen')::text like '%facebook.com/AseSofa%' then raise exception '5 พัง: seen ไม่มีลิงก์ ASE'; end if;
  -- 1M in × $2 + 0.1M out × $10 + 5 × $0.01 = $3.05 × 36 = ฿109.80
  if abs((r->>'spent_thb_month')::numeric - 109.80) > 0.01 then raise exception '5 พัง: ค่าใช้จ่าย % ควรเป็น 109.80', r->>'spent_thb_month'; end if;
  if (r->>'ran_today')::boolean is not true then raise exception '5 พัง: ค้นแล้ววันนี้ ต้องเป็น true'; end if;

  raise notice 'ข้อ 1-5 ผ่าน · กันซ้ำ · ไม่ใช้ก็กันซ้ำ · ต้องมีลิงก์ · ของออกนอกต้องมีคนกด · ข้อมูลให้ AI ครบ';
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
    perform content.news_run_input();
    raise exception 'ไม่ควรมาถึงตรงนี้';
  exception when insufficient_privilege then null; end;
  begin
    perform content.news_run_save('{"items":[]}'::jsonb);
    raise exception 'ไม่ควรมาถึงตรงนี้';
  exception when insufficient_privilege then null; end;
end $$;
set local "test.uid" = 'aaaaaaaa-0000-0000-0000-0000000000a1';
do $$
declare n int;
begin
  if (select count(*) from content.news_items) < 5 then raise exception '6 พัง: Bay ต้องเห็นข่าวทั้งหมด'; end if;
  update content.news_items set post_title = 'แก้หัวข่าว' where wp_post_id = 18153;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '6 พัง: Bay แก้ข่าวไม่ได้'; end if;
end $$;
reset role;

-- ข้อ 7 · A7 (แม้แต่เจ้าของฐานข้อมูลก็ลบไม่ได้)
do $$
begin
  begin
    delete from content.news_items where wp_post_id = 18153;
    raise exception 'ไม่ควรมาถึงตรงนี้';
  exception when restrict_violation then null; end;
  raise notice 'ข้อ 6-7 ผ่าน · Bay เท่านั้น · ตัวตั้งเวลาเรียกผ่าน service_role · ห้ามลบ';
end $$;

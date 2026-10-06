-- ============================================================================
-- ทดสอบโมดูลคอนเทนต์ · รอบ R2 ตรวจทีละส่วน + แชท + โพสต์
-- ============================================================================
-- ใช้ผู้ใช้จาก 06 (ทีม 4444… · ผู้ตรวจ 5555…) + เพิ่ม
--   6666… ผู้ตรวจอีกคน (มี content.approve แต่ไม่ใช่ admin)
--   7777… Bay (admin + content.approve + marketing.write)
-- ============================================================================

insert into auth.users (id) values ('66666666-6666-6666-6666-666666666666'), ('77777777-7777-7777-7777-777777777777')
  on conflict do nothing;
insert into core.app_users (id, email, full_name, status) values
  ('66666666-6666-6666-6666-666666666666', 'lead@test', 'หัวหน้า', 'ใช้งาน'),
  ('77777777-7777-7777-7777-777777777777', 'bayadmin@test', 'Bay', 'ใช้งาน')
  on conflict do nothing;
insert into core.user_capabilities (user_id, capability) values
  ('66666666-6666-6666-6666-666666666666', 'content.approve'),
  ('66666666-6666-6666-6666-666666666666', 'marketing.write'),
  ('77777777-7777-7777-7777-777777777777', 'admin'),
  ('77777777-7777-7777-7777-777777777777', 'content.approve'),
  ('77777777-7777-7777-7777-777777777777', 'marketing.write')
  on conflict do nothing;

set local role authenticated;

do $$
declare
  CREW constant text := '44444444-4444-4444-4444-444444444444';
  REVIEWER constant text := '55555555-5555-5555-5555-555555555555';
  LEAD constant text := '66666666-6666-6666-6666-666666666666';
  BAY constant text := '77777777-7777-7777-7777-777777777777';
  v_cc uuid; v_item uuid; v_fb uuid; v_ig uuid; v_img1 uuid; v_img2 uuid; v_note uuid;
  v_stage content.stage; v_ver int; n int; msg text := '';
begin
  perform set_config('test.uid', CREW, true);
  select id into v_cc from catalog.brands where name = 'ฌ เฌอ';

  -- ── ทีมตั้งอัลบั้ม 2 ภาพ ลง FB + IG ─────────────────────────────────────
  perform set_config('test.uid', CREW, true);
  insert into content.items (title, format, brand_id, hook) values ('ตู้ Koontong', 'อัลบั้มภาพ', v_cc, 'ตู้เดียวเก็บได้ทั้งห้อง')
    returning id into v_item;
  if (select created_by from content.items where id = v_item) <> CREW::uuid then
    raise exception 'ไม่ได้บันทึกว่าใครตั้งงาน';
  end if;
  insert into content.placements (item_id, channel_id, copy_text) values
    (v_item, 'facebook', 'FB v1'), (v_item, 'instagram', 'IG v1 #1 #2 #3 #4 #5 #6 #7');
  select id into v_fb from content.placements where item_id = v_item and channel_id = 'facebook';
  select id into v_ig from content.placements where item_id = v_item and channel_id = 'instagram';
  insert into content.item_images (item_id, position, url) values (v_item, 1, 'https://drive/dark.jpg') returning id into v_img1;
  insert into content.item_images (item_id, position, url) values (v_item, 2, 'https://drive/open.jpg') returning id into v_img2;

  perform content.submit_for_review(v_item);
  if not exists (select 1 from content.item_versions where item_id = v_item and version = 1
                  and snapshot->'images'->>0 = 'https://drive/dark.jpg') then
    raise exception 'ส่งตรวจแล้วไม่ได้เก็บเวอร์ชัน v1';
  end if;
  msg := msg || E'\n  ✓ ส่งตรวจ = เก็บภาพและข้อความของ v1 ไว้ย้อนดูได้';

  select count(*) into n from content.open_parts(v_item);
  if n <> 4 then raise exception 'ควรมี 4 ส่วนให้ตรวจ (ภาพ 2 + ช่องทาง 2) ได้ %', n; end if;
  msg := msg || E'\n  ✓ แยกเป็น 4 ส่วนให้ตรวจ · ภาพ 1 · ภาพ 2 · Facebook · Instagram';

  -- ── ทีมตรวจงานตัวเองไม่ได้ (ไม่มีสิทธิ์) · ผู้ตรวจที่ตั้งงานเองก็ไม่ได้ ──────
  begin
    perform content.review_item(v_item, '[]');
    raise exception 'ทีมตรวจงานได้ ซึ่งไม่ควร';
  exception when insufficient_privilege then null;
  end;

  -- ── ผู้ตรวจ: ตัดสินไม่ครบ = ไม่ได้ · ไม่ผ่านไม่มีเหตุผล = ไม่ได้ ───────────
  perform set_config('test.uid', REVIEWER, true);
  begin
    perform content.review_item(v_item, jsonb_build_array(jsonb_build_object('part', 'ch:facebook', 'pass', true)));
    raise exception 'ตัดสินไม่ครบทุกส่วนแต่ผ่านได้';
  exception when others then
    if sqlerrm not like '%ยังไม่ได้ตัดสิน%' then raise; end if;
  end;
  begin
    perform content.review_item(v_item, jsonb_build_array(
      jsonb_build_object('part', 'ch:facebook', 'pass', true),
      jsonb_build_object('part', 'ch:instagram', 'pass', false, 'note', ''),
      jsonb_build_object('part', 'img:' || v_img1, 'pass', true),
      jsonb_build_object('part', 'img:' || v_img2, 'pass', true)));
    raise exception 'ไม่ผ่านโดยไม่มีเหตุผลได้';
  exception when others then
    if sqlerrm not like '%ต้องบอกเหตุผล%' then raise; end if;
  end;
  msg := msg || E'\n  ✓ ต้องติ๊กครบทุกส่วน และส่วนที่ไม่ผ่านต้องมีเหตุผล';

  -- ── ผ่าน FB + ภาพ 2 · ไม่ผ่าน ภาพ 1 + IG ──────────────────────────────────
  perform content.review_item(v_item, jsonb_build_array(
    jsonb_build_object('part', 'ch:facebook', 'pass', true),
    jsonb_build_object('part', 'ch:instagram', 'pass', false, 'note', 'แฮชแท็กเยอะไป เหลือ 5 อันพอ'),
    jsonb_build_object('part', 'img:' || v_img1, 'pass', false, 'note', 'แสงมืดไป ถ่ายใหม่ช่วงเช้า'),
    jsonb_build_object('part', 'img:' || v_img2, 'pass', true)));
  select stage into v_stage from content.items where id = v_item;
  if v_stage <> 'ตีกลับแก้' then raise exception 'มีส่วนไม่ผ่านแต่ขั้นเป็น %', v_stage; end if;
  if (select count(*) from content.review_notes where item_id = v_item and done_at is null) <> 2 then
    raise exception 'ควรมีรายการต้องแก้ 2 ข้อ';
  end if;
  if not exists (select 1 from content.messages where item_id = v_item and part_label = 'ภาพ 1' and body like 'แสงมืด%') then
    raise exception 'เหตุผลที่ติไม่ลงแชท';
  end if;
  msg := msg || E'\n  ✓ ไม่ผ่านบางส่วน → ตีกลับเฉพาะส่วนนั้น · เหตุผลเป็นรายการต้องแก้ และลงแชทเอง';

  -- ── Q-49g · FB ผ่าน แต่ภาพ 1 ไม่ผ่าน → FB ยังโพสต์ไม่ได้ (ใช้ภาพเดียวกัน) ──
  perform set_config('test.uid', CREW, true);
  begin
    perform content.mark_posted(v_fb, 'https://facebook.com/p/1');
    raise exception 'โพสต์ FB ได้ทั้งที่ภาพ 1 ไม่ผ่าน';
  exception when others then
    if sqlerrm not like '%ยังไม่ผ่านตรวจ%' then raise; end if;
  end;
  msg := msg || E'\n  ✓ ภาพไม่ผ่าน → ทุกช่องทางที่ใช้ภาพนั้นรอก่อน แม้ข้อความผ่านแล้ว';

  -- ── ส่งใหม่โดยยังไม่ติ๊กครบ = ไม่ได้ ───────────────────────────────────────
  update content.item_images set url = 'https://drive/morning.jpg' where id = v_img1;
  update content.placements set copy_text = 'IG v2 #1 #2 #3 #4 #5' where id = v_ig;
  select id into v_note from content.review_notes where item_id = v_item and part_label = 'Instagram';
  perform content.tick_review_note(v_note, true);
  begin
    perform content.submit_for_review(v_item);
    raise exception 'ส่งตรวจได้ทั้งที่ยังแก้ไม่ครบ';
  exception when others then
    if sqlerrm not like '%ยังแก้ไม่ครบ%' then raise; end if;
  end;
  msg := msg || E'\n  ✓ ติ๊กแก้ยังไม่ครบ ส่งตรวจใหม่ไม่ได้';

  -- ทีมแก้รายการต้องแก้ตรงๆ ไม่ได้ ต้องติ๊กผ่านฟังก์ชัน
  begin
    update content.review_notes set done_at = now() where item_id = v_item;
    raise exception 'แก้รายการต้องแก้ตรงๆ ได้';
  exception when insufficient_privilege then null;
  end;
  msg := msg || E'\n  ✓ แก้รายการต้องแก้ตรงๆ ไม่ได้ ต้องติ๊กผ่านฟังก์ชัน';
  raise notice '%', msg;
end $$;

-- ส่วนที่สอง
do $$
declare
  CREW constant text := '44444444-4444-4444-4444-444444444444';
  REVIEWER constant text := '55555555-5555-5555-5555-555555555555';
  LEAD constant text := '66666666-6666-6666-6666-666666666666';
  BAY constant text := '77777777-7777-7777-7777-777777777777';
  v_cc uuid; v_item uuid; v_fb uuid; v_ig uuid; v_own uuid; v_stage content.stage; v_ver int; n int; msg text := '';
begin
  perform set_config('test.uid', CREW, true);
  select id into v_cc from catalog.brands where name = 'ฌ เฌอ';
  select id into v_item from content.items where title = 'ตู้ Koontong';
  select id into v_fb from content.placements where item_id = v_item and channel_id = 'facebook';
  select id into v_ig from content.placements where item_id = v_item and channel_id = 'instagram';

  perform set_config('test.uid', CREW, true);
  perform content.tick_review_note(id, true) from content.review_notes where item_id = v_item and done_at is null;
  perform content.submit_for_review(v_item);
  select version into v_ver from content.items where id = v_item;
  if v_ver <> 2 then raise exception 'ตีกลับแล้วส่งใหม่ควรเป็น v2 ได้ v%', v_ver; end if;
  msg := msg || E'\n  ✓ ติ๊กครบแล้วส่งใหม่ได้ · กลายเป็น v2';

  select count(*) into n from content.open_parts(v_item);
  if n <> 2 then raise exception 'รอบ 2 ควรตรวจแค่ 2 ส่วนที่แก้ (ภาพ 1 + IG) ได้ %', n; end if;
  if not exists (select 1 from content.open_parts(v_item) where part_label = 'ภาพ 1') then
    raise exception 'เลขภาพเพี้ยน · ภาพที่แก้ต้องยังชื่อ "ภาพ 1"';
  end if;
  msg := msg || E'\n  ★ รอบ 2 ตรวจแค่ส่วนที่แก้ · ส่วนที่ผ่านแล้ว (FB · ภาพ 2) ไม่ต้องตรวจซ้ำ';

  perform set_config('test.uid', REVIEWER, true);
  perform content.review_item(v_item, (select jsonb_agg(jsonb_build_object('part', part_key, 'pass', true)) from content.open_parts(v_item)));
  select stage into v_stage from content.items where id = v_item;
  if v_stage <> 'พร้อมโพสต์' then raise exception 'ผ่านครบแล้วแต่ขั้นเป็น %', v_stage; end if;
  msg := msg || E'\n  ✓ ผ่านครบทุกส่วน = อนุมัติ';

  -- แก้ข้อความ FB ที่ผ่านแล้ว → FB กลับไปรอตรวจ ส่วนอื่นยังผ่าน
  perform set_config('test.uid', CREW, true);
  update content.placements set copy_text = 'FB v3' where id = v_fb;
  select count(*) into n from content.open_parts(v_item);
  if n <> 1 or (select stage from content.items where id = v_item) <> 'รอตรวจ' then
    raise exception 'แก้ FB แล้วควรเหลือตรวจแค่ FB 1 ส่วน ได้ %', n;
  end if;
  msg := msg || E'\n  ★ แก้ส่วนที่ผ่านแล้ว → ส่วนนั้นส่วนเดียวกลับไปรอตรวจ';

  -- Q-49g · IG กับภาพผ่านหมด → IG โพสต์ได้แม้ FB ยังรอตรวจ
  perform content.mark_posted(v_ig, 'https://instagram.com/p/1');
  begin
    perform content.mark_posted(v_fb, 'https://facebook.com/p/1');
    raise exception 'FB ยังรอตรวจแต่โพสต์ได้';
  exception when others then
    if sqlerrm not like '%ยังไม่ผ่านตรวจ%' then raise; end if;
  end;
  msg := msg || E'\n  ★ ช่องทางที่ผ่านครบ (ข้อความ + ภาพ) โพสต์ก่อนได้ ไม่ต้องรอช่องอื่น';

  -- ── แชท · พิมพ์ในชื่อคนอื่นหรือเป็นข้อความระบบไม่ได้ ─────────────────────
  insert into content.messages (item_id, author_id, part_label, body, mentions)
  values (v_item, CREW::uuid, 'Instagram', 'ลงแล้วครับ @Bay ช่วยดู FB อีกรอบ', array[BAY::uuid]);
  begin
    insert into content.messages (item_id, author_id, body) values (v_item, REVIEWER::uuid, 'ปลอมตัว');
    raise exception 'พิมพ์ในชื่อคนอื่นได้';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into content.messages (item_id, author_id, kind, body) values (v_item, CREW::uuid, 'ระบบ', 'ปลอมระบบ');
    raise exception 'ปลอมข้อความระบบได้';
  exception when insufficient_privilege then null;
  end;
  msg := msg || E'\n  ✓ แชทพิมพ์ได้เฉพาะในชื่อตัวเอง · ข้อความระบบปลอมไม่ได้';

  perform set_config('test.uid', BAY, true);
  select mentions into n from content.v_my_unread where item_id = v_item;
  if n <> 1 then raise exception 'Bay ควรเห็นข้อความ @ถึงตัวเอง 1 ข้อ ได้ %', n; end if;
  insert into content.message_reads (item_id) values (v_item);
  if exists (select 1 from content.v_my_unread where item_id = v_item) then
    raise exception 'อ่านแล้วยังนับว่าไม่ได้อ่าน';
  end if;
  msg := msg || E'\n  ✓ นับข้อความใหม่และข้อความที่ @ ถึงฉัน · อ่านแล้วตัวเลขหาย';

  -- ── Q-121 · หัวหน้า (ไม่ใช่ admin) ตรวจงานตัวเองไม่ได้ · Bay (admin) ได้ ─────
  perform set_config('test.uid', LEAD, true);
  insert into content.items (title, format, brand_id, hook) values ('งานหัวหน้า', 'ข้อความล้วน', v_cc, 'x') returning id into v_own;
  insert into content.placements (item_id, channel_id, copy_text) values (v_own, 'facebook', 'x');
  perform content.submit_for_review(v_own);
  begin
    perform content.review_item(v_own, (select jsonb_agg(jsonb_build_object('part', part_key, 'pass', true)) from content.open_parts(v_own)));
    raise exception 'หัวหน้าอนุมัติงานตัวเองได้';
  exception when insufficient_privilege then null;
  end;

  perform set_config('test.uid', BAY, true);
  insert into content.items (title, format, brand_id, hook) values ('งาน Bay', 'ข้อความล้วน', v_cc, 'y') returning id into v_own;
  insert into content.placements (item_id, channel_id, copy_text) values (v_own, 'facebook', 'y');
  perform content.submit_for_review(v_own);
  perform content.review_item(v_own, (select jsonb_agg(jsonb_build_object('part', part_key, 'pass', true)) from content.open_parts(v_own)));
  if (select stage from content.items where id = v_own) <> 'พร้อมโพสต์' then
    raise exception 'Bay อนุมัติงานตัวเองไม่ได้';
  end if;
  msg := msg || E'\n  ✓ คนอื่นตรวจงานตัวเองไม่ได้ · Bay (admin) ตรวจงานที่ตัวเองตั้งได้ (Q-121)';

  -- ปุ่มอนุมัติทั้งชิ้นแบบเดิมใช้กับงานเฟส 1 ไม่ได้แล้ว
  begin
    perform content.approve_item(v_item);
    raise exception 'ใช้ปุ่มอนุมัติทั้งชิ้นกับงานเฟส 1 ได้';
  exception when others then
    if sqlerrm not like '%ตรวจทีละส่วน%' then raise; end if;
  end;
  msg := msg || E'\n  ✓ งานเฟส 1 ต้องตรวจทีละส่วน ปุ่มอนุมัติทั้งชิ้นแบบเดิมใช้ไม่ได้';

  raise notice '%', msg;
end $$;

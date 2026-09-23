-- ============================================================================
-- ทดสอบโมดูลคอนเทนต์ เฟส 1 · รอบ R1 ชิ้นงาน
-- ============================================================================
-- ใช้ผู้ใช้จาก 06_content.sql (ทีม 4444… · Bay 5555…)
-- เดินเรื่อง: ตั้ง pillar + ธีม → ตั้งอัลบั้มลง FB IG เว็บ → ใส่ภาพ ข้อความต่อช่องทาง
-- → อนุมัติ → แก้ข้อความ/ภาพ = อนุมัติเป็นโมฆะ → ไม่ลงบางที่ → ลงครบ
-- ============================================================================

set local role authenticated;

do $$
declare
  v_cc uuid; v_hof uuid; v_pillar uuid; v_hof_pillar uuid; v_theme uuid;
  v_item uuid; v_text uuid; v_fb uuid; v_ig uuid; v_web uuid; v_img uuid;
  v_stage content.stage; msg text := ''; i int;
begin
  perform set_config('test.uid', '44444444-4444-4444-4444-444444444444', true);

  -- แบรนด์ของเทส (ในเครื่องไม่มีข้อมูลนำเข้า) · HOF ต้องมีจาก migration
  reset role;
  insert into catalog.brands (name) values ('ฌ เฌอ') on conflict (name) do nothing;
  set local role authenticated;
  select id into v_cc  from catalog.brands where name = 'ฌ เฌอ';
  select id into v_hof from catalog.brands where name = 'HOF';
  if v_hof is null then raise exception 'migration ไม่ได้เพิ่มแบรนด์ HOF'; end if;
  msg := msg || E'\n  ✓ มีแบรนด์ HOF ให้ตั้งงานคอนเทนต์ได้';

  -- ── pillar + ธีม ─────────────────────────────────────────────────────────
  insert into content.pillars (brand_id, name, color) values (v_cc, 'สินค้า', '#a0673f') returning id into v_pillar;
  insert into content.pillars (brand_id, name) values (v_hof, 'โปรโมชัน') returning id into v_hof_pillar;
  insert into content.themes (brand_id, name, starts_on, ends_on)
    values (v_cc, 'ห้องเล็กอยู่สบาย', '2026-10-01', '2026-11-15') returning id into v_theme;
  msg := msg || E'\n  ✓ ธีมคร่อม 2 เดือนได้ (1 ต.ค. – 15 พ.ย.)';

  begin
    insert into content.themes (brand_id, name, starts_on, ends_on) values (v_cc, 'กลับหัว', '2026-10-10', '2026-10-01');
    raise exception 'ธีมจบก่อนเริ่มได้ ซึ่งไม่ควร';
  exception when check_violation then null;
  end;
  msg := msg || E'\n  ✓ ธีมจบก่อนเริ่มไม่ได้';

  -- ── ต้องมีแบรนด์ · pillar ต้องแบรนด์เดียวกัน ────────────────────────────
  begin
    insert into content.items (title, format) values ('ไม่มีแบรนด์', 'ภาพเดี่ยว');
    raise exception 'ตั้งงานเฟส 1 โดยไม่มีแบรนด์ได้ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%แบรนด์%' then raise; end if;
  end;
  msg := msg || E'\n  ✓ งานเฟส 1 ต้องเลือกแบรนด์';

  begin
    insert into content.items (title, format, brand_id, pillar_id) values ('ผิดแบรนด์', 'ภาพเดี่ยว', v_cc, v_hof_pillar);
    raise exception 'ใช้ pillar ของ HOF กับงาน ฌ เฌอ ได้ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%แบรนด์อื่น%' then raise; end if;
  end;
  msg := msg || E'\n  ✓ pillar ต้องเป็นของแบรนด์เดียวกับชิ้นงาน';

  -- ── ข้อความล้วนลง IG ไม่ได้ และไม่มีภาพ ─────────────────────────────────
  insert into content.items (title, format, brand_id, hook) values ('5 วิธีดูไม้จริง', 'ข้อความล้วน', v_cc, 'ไม้จริงหรือไม้อัด')
    returning id into v_text;
  begin
    insert into content.placements (item_id, channel_id) values (v_text, 'instagram');
    raise exception 'ข้อความล้วนลง IG ได้ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%Instagram%' then raise; end if;
  end;
  begin
    insert into content.item_images (item_id, url) values (v_text, 'https://drive/x.jpg');
    raise exception 'ข้อความล้วนใส่ภาพได้ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%ไม่มีภาพ%' then raise; end if;
  end;
  msg := msg || E'\n  ✓ ข้อความล้วน ลง Instagram ไม่ได้ และใส่ภาพไม่ได้';

  -- ── อัลบั้ม ลง 3 ที่ ─────────────────────────────────────────────────────
  insert into content.items (title, format, brand_id, pillar_id, theme_id, hook, key_message, visual, source_url, stage)
  values ('คอนโด 28 ตร.ม.', 'อัลบั้มภาพ', v_cc, v_pillar, v_theme,
          'ห้อง 28 ตร.ม. วางโซฟา 3 ที่นั่งได้ไหม', 'เลือกขาเรียว พนักต่ำ', 'บ้านลูกค้าจริง', 'https://docs/สรุปเลขา', 'ไอเดีย')
  returning id into v_item;
  if (select off_plan from content.items where id = v_item) is not true then
    raise exception 'งานที่ตั้งเองไม่ได้ติดป้ายนอกแผน';
  end if;
  msg := msg || E'\n  ✓ งานที่ตั้งเอง (ไม่ได้มาจากแผน) ติดป้ายนอกแผนเอง';

  insert into content.placements (item_id, channel_id, planned_on) values
    (v_item, 'facebook', '2026-10-14'), (v_item, 'instagram', '2026-10-15'), (v_item, 'website', '2026-10-16');
  select id into v_fb  from content.placements where item_id = v_item and channel_id = 'facebook';
  select id into v_ig  from content.placements where item_id = v_item and channel_id = 'instagram';
  select id into v_web from content.placements where item_id = v_item and channel_id = 'website';

  for i in 1..20 loop
    insert into content.item_images (item_id, position, url) values (v_item, i, 'https://drive/img' || i || '.jpg');
  end loop;
  begin
    insert into content.item_images (item_id, position, url) values (v_item, 21, 'https://drive/img21.jpg');
    raise exception 'อัลบั้มใส่ภาพที่ 21 ได้ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%20 ภาพ%' then raise; end if;
  end;
  msg := msg || E'\n  ✓ อัลบั้มมีได้สูงสุด 20 ภาพ ตามที่ IG รับ';

  -- เอาภาพออก = removed_at ห้ามลบแถว
  select id into v_img from content.item_images where item_id = v_item and position = 20;
  begin
    delete from content.item_images where id = v_img;
    raise exception 'ลบภาพได้ ซึ่งผิดกฎ A7';
  exception when others then
    if sqlerrm like '%ผิดกฎ%' then raise; end if;
  end;
  update content.item_images set removed_at = now() where id = v_img;
  msg := msg || E'\n  ✓ เอาภาพออกด้วย removed_at ลบแถวไม่ได้ (A7)';

  update content.placements set copy_text = 'FB: ห้องเล็กก็วางโซฟา 3 ที่นั่งได้', first_comment = 'ดูรุ่น → chawcher.com' where id = v_fb;
  update content.placements set copy_text = 'IG: 28 ตร.ม.', hook = 'ห้องเล็ก โซฟาใหญ่?' where id = v_ig;
  update content.placements set web_title = 'วางโซฟา 3 ที่นั่งในคอนโด 28 ตร.ม.', web_keyword = 'โซฟาคอนโด',
    web_meta = 'วิธีเลือกโซฟาห้องเล็ก', copy_text = '## ห้องเล็ก...' where id = v_web;
  msg := msg || E'\n  ✓ ข้อความแยกต่อช่องทาง · FB · IG (hook ของตัวเอง) · บล็อก SEO (หัวเรื่อง คำค้น meta)';

  -- ── อนุมัติ แล้วแก้ = โมฆะ ────────────────────────────────────────────────
  perform content.submit_for_review(v_item);
  perform set_config('test.uid', '55555555-5555-5555-5555-555555555555', true);
  perform content.review_item(v_item, (select jsonb_agg(jsonb_build_object('part', part_key, 'pass', true)) from content.open_parts(v_item)));
  perform set_config('test.uid', '44444444-4444-4444-4444-444444444444', true);

  update content.placements set copy_text = 'IG: แก้แคปชัน' where id = v_ig;
  select stage into v_stage from content.items where id = v_item;
  if v_stage <> 'รอตรวจ' then raise exception 'แก้ข้อความ IG หลังอนุมัติแล้วยังโพสต์ได้ ขั้นเป็น %', v_stage; end if;
  msg := msg || E'\n  ★ แก้ข้อความช่องทางไหนหลังอนุมัติ → อนุมัติเป็นโมฆะ';

  perform set_config('test.uid', '55555555-5555-5555-5555-555555555555', true);
  perform content.review_item(v_item, (select jsonb_agg(jsonb_build_object('part', part_key, 'pass', true)) from content.open_parts(v_item)));
  perform set_config('test.uid', '44444444-4444-4444-4444-444444444444', true);
  update content.item_images set position = 0 where item_id = v_item and position = 5;
  select stage into v_stage from content.items where id = v_item;
  if v_stage <> 'รอตรวจ' then raise exception 'สลับภาพหลังอนุมัติแล้วยังโพสต์ได้ ขั้นเป็น %', v_stage; end if;
  msg := msg || E'\n  ★ เปลี่ยนภาพหรือลำดับภาพหลังอนุมัติ → อนุมัติเป็นโมฆะ (key visual เปลี่ยน)';

  perform set_config('test.uid', '55555555-5555-5555-5555-555555555555', true);
  perform content.review_item(v_item, (select jsonb_agg(jsonb_build_object('part', part_key, 'pass', true)) from content.open_parts(v_item)));
  perform set_config('test.uid', '44444444-4444-4444-4444-444444444444', true);
  update content.items set hook = 'hook ใหม่' where id = v_item;
  select stage into v_stage from content.items where id = v_item;
  if v_stage <> 'รอตรวจ' then raise exception 'แก้ hook หลังอนุมัติแล้วยังโพสต์ได้'; end if;
  msg := msg || E'\n  ★ แก้ hook เนื้อหา visual หลังอนุมัติ → อนุมัติเป็นโมฆะ';

  -- ── ไม่ลงเว็บแล้ว · ลง FB IG ครบ = โพสต์แล้ว ────────────────────────────
  perform set_config('test.uid', '55555555-5555-5555-5555-555555555555', true);
  perform content.review_item(v_item, (select jsonb_agg(jsonb_build_object('part', part_key, 'pass', true)) from content.open_parts(v_item)));
  perform set_config('test.uid', '44444444-4444-4444-4444-444444444444', true);
  update content.placements set skipped_reason = 'บทความซ้ำกับของเดือนก่อน' where id = v_web;
  select stage into v_stage from content.items where id = v_item;
  if v_stage <> 'พร้อมโพสต์' then raise exception 'ถอดช่องทางแล้วอนุมัติหาย ซึ่งไม่ควร'; end if;
  perform content.mark_posted(v_fb, 'https://facebook.com/p/1');
  perform content.mark_posted(v_ig, 'https://instagram.com/p/1');
  select stage into v_stage from content.items where id = v_item;
  if v_stage <> 'โพสต์แล้ว' then raise exception 'ลง FB IG ครบ (ไม่ลงเว็บแล้ว) แต่ขั้นยังเป็น %', v_stage; end if;
  msg := msg || E'\n  ✓ "ไม่ลงที่นี่แล้ว" ไม่นับว่าขาด · ลงที่เหลือครบ = โพสต์แล้ว';

  -- ── เปลี่ยนภาพเดี่ยวที่มี 2 ภาพไม่ได้ ───────────────────────────────────
  insert into content.items (title, format, brand_id) values ('ภาพเดียว', 'ภาพเดี่ยว', v_hof) returning id into v_item;
  insert into content.item_images (item_id, url) values (v_item, 'https://drive/a.jpg');
  begin
    insert into content.item_images (item_id, url) values (v_item, 'https://drive/b.jpg');
    raise exception 'ภาพเดี่ยวใส่ 2 ภาพได้ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%ภาพเดียว%' then raise; end if;
  end;
  msg := msg || E'\n  ✓ ภาพเดี่ยวมีได้ภาพเดียว';

  raise notice '%', msg;
end $$;

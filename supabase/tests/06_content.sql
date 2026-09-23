-- ============================================================================
-- ทดสอบโมดูลคอนเทนต์ · เดินเรื่องแบบที่เกิดขึ้นจริง
-- ============================================================================
-- ตั้งงาน → เขียนบท → ถ่าย → ตัด → ส่งตรวจ → ตีกลับ → แก้ → ส่งใหม่ → อนุมัติ
-- → โพสต์ TikTok → โพสต์ Reel → โพสต์ Shorts → ครบแล้วถึงนับว่าโพสต์แล้ว
--
-- ข้อที่สำคัญที่สุดคือ "แก้ไฟล์หลังอนุมัติแล้วการอนุมัติต้องเป็นโมฆะ"
-- เพราะตัวที่อนุมัติกับตัวที่โพสต์ต้องเป็นตัวเดียวกันเสมอ
-- ============================================================================

-- คนทำงาน (การตลาด+กราฟิก) อนุมัติไม่ได้
insert into auth.users (id) values ('44444444-4444-4444-4444-444444444444')
  on conflict do nothing;
insert into core.app_users (id, email, full_name, status)
  values ('44444444-4444-4444-4444-444444444444','crew@test','ทีมคอนเทนต์','ใช้งาน')
  on conflict do nothing;
insert into core.user_capabilities (user_id, capability) values
  ('44444444-4444-4444-4444-444444444444','marketing.write'),
  ('44444444-4444-4444-4444-444444444444','design.write')
  on conflict do nothing;

-- Bay อนุมัติได้
insert into auth.users (id) values ('55555555-5555-5555-5555-555555555555')
  on conflict do nothing;
insert into core.app_users (id, email, full_name, status)
  values ('55555555-5555-5555-5555-555555555555','bay@test2','เบย์','ใช้งาน')
  on conflict do nothing;
insert into core.user_capabilities (user_id, capability) values
  ('55555555-5555-5555-5555-555555555555','content.approve'),
  ('55555555-5555-5555-5555-555555555555','marketing.write')
  on conflict do nothing;

set local role authenticated;

do $$
declare
  v_item uuid; v_tiktok uuid; v_reel uuid; v_short uuid;
  v_stage content.stage; msg text := '';
begin
  -- ── ทีมคอนเทนต์ตั้งงาน ────────────────────────────────────────────────
  perform set_config('test.uid', '44444444-4444-4444-4444-444444444444', true);

  insert into content.items (title, format, brief, stage)
  values ('รีวิวโซฟากีวี่ 30 วิ', 'คลิปสั้น', 'เน้นว่าเลือกไม้ได้สองแบบ', 'เขียนบท')
  returning id into v_item;

  -- ตั้งใจลง 3 ที่ จากคลิปตัวเดียว
  insert into content.placements (item_id, channel_id) values
    (v_item, 'tiktok'), (v_item, 'instagram'), (v_item, 'youtube');
  select id into v_tiktok from content.placements where item_id=v_item and channel_id='tiktok';
  select id into v_reel   from content.placements where item_id=v_item and channel_id='instagram';
  select id into v_short  from content.placements where item_id=v_item and channel_id='youtube';
  msg := msg || E'\n  ✓ คลิปตัวเดียว ตั้งใจลง 3 ที่ (TikTok · Reel · Shorts)';

  update content.items set stage='ถ่ายแล้วรอตัด', raw_url='https://drive/raw' where id=v_item;
  update content.items set stage='ตัดเสร็จ', edit_url='https://drive/v1' where id=v_item;
  msg := msg || E'\n  ✓ เดินผ่าน 3 ขั้นผลิต เขียนบท → ถ่ายแล้วรอตัด → ตัดเสร็จ';

  -- ยังไม่อนุมัติ โพสต์ไม่ได้
  begin
    perform content.mark_posted(v_tiktok, 'https://tiktok.com/x');
    raise exception 'โพสต์ได้ทั้งที่ยังไม่อนุมัติ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%ยังไม่ผ่านการอนุมัติ%' then raise; end if;
  end;
  msg := msg || E'\n  ✓ ยังไม่อนุมัติ โพสต์ไม่ได้';

  perform content.submit_for_review(v_item);

  -- ทีมคอนเทนต์อนุมัติงานตัวเองไม่ได้
  begin
    perform content.approve_item(v_item);
    raise exception 'ทีมอนุมัติเองได้ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%content.approve%' then raise; end if;
  end;
  msg := msg || E'\n  ✓ คนทำอนุมัติงานตัวเองไม่ได้ ต้องมีสิทธิ์ content.approve';

  -- ── Bay ตีกลับ ────────────────────────────────────────────────────────
  perform set_config('test.uid', '55555555-5555-5555-5555-555555555555', true);

  begin
    perform content.bounce_item(v_item, '');
    raise exception 'ตีกลับโดยไม่บอกเหตุผลได้ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%เหตุผล%' then raise; end if;
  end;
  msg := msg || E'\n  ✓ ตีกลับต้องบอกเหตุผล ไม่งั้นคนทำไม่รู้จะแก้อะไร';

  perform content.bounce_item(v_item, 'ราคาในคลิปเป็นราคาเก่า');
  select stage into v_stage from content.items where id=v_item;
  if v_stage <> 'ตีกลับแก้' then raise exception 'ตีกลับแล้วขั้นไม่เปลี่ยน ได้ %', v_stage; end if;
  msg := msg || E'\n  ✓ ตีกลับแล้วขั้นเป็น "ตีกลับแก้" พร้อมเหตุผลติดไปด้วย';

  -- ── แก้แล้วส่งใหม่ อนุมัติ ────────────────────────────────────────────
  perform set_config('test.uid', '44444444-4444-4444-4444-444444444444', true);
  update content.items set edit_url='https://drive/v2', stage='ตัดเสร็จ' where id=v_item;
  perform content.submit_for_review(v_item);

  perform set_config('test.uid', '55555555-5555-5555-5555-555555555555', true);
  perform content.approve_item(v_item, 'โอเคแล้ว');
  select stage into v_stage from content.items where id=v_item;
  if v_stage <> 'พร้อมโพสต์' then raise exception 'อนุมัติแล้วไม่เป็นพร้อมโพสต์ ได้ %', v_stage; end if;
  msg := msg || E'\n  ✓ Bay อนุมัติแล้ว ขั้นเป็น "พร้อมโพสต์"';

  -- ★ แก้ไฟล์หลังอนุมัติ = การอนุมัติเป็นโมฆะ
  perform set_config('test.uid', '44444444-4444-4444-4444-444444444444', true);
  update content.items set edit_url='https://drive/v3' where id=v_item;
  select stage into v_stage from content.items where id=v_item;
  if v_stage <> 'รอตรวจ' then
    raise exception 'แก้ไฟล์หลังอนุมัติแล้วยังโพสต์ได้! ขั้นเป็น %', v_stage;
  end if;
  if (select approved_at from content.items where id=v_item) is not null then
    raise exception 'ถอนอนุมัติไม่หมด approved_at ยังอยู่';
  end if;
  msg := msg || E'\n  ★ แก้ไฟล์หลังอนุมัติ → ถอนอนุมัติเอง กลับไปรอตรวจ (ตัวที่อนุมัติ = ตัวที่โพสต์เสมอ)';

  -- อนุมัติใหม่ แล้วโพสต์ทีละที่
  perform set_config('test.uid', '55555555-5555-5555-5555-555555555555', true);
  perform content.approve_item(v_item);

  perform set_config('test.uid', '44444444-4444-4444-4444-444444444444', true);
  perform content.mark_posted(v_tiktok, 'https://tiktok.com/@chawcher/1');
  select stage into v_stage from content.items where id=v_item;
  if v_stage = 'โพสต์แล้ว' then raise exception 'ลงแค่ที่เดียวก็นับว่าโพสต์แล้ว ซึ่งไม่ควร'; end if;

  if not exists (select 1 from content.v_placement_gaps where item_id = v_item) then
    raise exception 'ลงไม่ครบแต่ไม่ขึ้นในรายการที่ยังขาด';
  end if;
  msg := msg || E'\n  ✓ ลง TikTok แล้ว แต่ยังขึ้นเตือนว่าเหลือ Reel กับ Shorts';

  perform content.mark_posted(v_reel,  'https://instagram.com/p/2');
  perform content.mark_posted(v_short, 'https://youtube.com/shorts/3');
  select stage into v_stage from content.items where id=v_item;
  if v_stage <> 'โพสต์แล้ว' then raise exception 'ลงครบแล้วแต่ขั้นยังเป็น %', v_stage; end if;
  if exists (select 1 from content.v_placement_gaps where item_id = v_item) then
    raise exception 'ลงครบแล้วแต่ยังขึ้นในรายการที่ยังขาด';
  end if;
  msg := msg || E'\n  ✓ ลงครบ 3 ที่ → ขั้นเป็น "โพสต์แล้ว" เอง (ระบบคิดเอง ไม่มีช่องให้ติ๊ก)';

  raise notice '%', msg;
end $$;

-- ============================================================================
-- ทดสอบโมดูลคอนเทนต์ เฟส 2 · R7 ส่งบล็อกเข้า WordPress
-- ใช้ผู้ใช้จาก 06 (ทีม 4444…) และ 09 (Bay 7777…)
-- ============================================================================

set local role authenticated;

do $$
declare
  CREW constant text := '44444444-4444-4444-4444-444444444444';
  BAY  constant text := '77777777-7777-7777-7777-777777777777';
  v_cc uuid; v_item uuid; v_web uuid; pl content.placements; n int; msg text := '';
begin
  perform set_config('test.uid', CREW, true);
  select id into v_cc from catalog.brands where name = 'ฌ เฌอ';
  insert into content.items (title, format, brand_id, hook) values ('เลือกโซฟาห้องเล็ก', 'ข้อความล้วน', v_cc, 'วัด 3 จุดก่อนซื้อ')
    returning id into v_item;
  insert into content.placements (item_id, channel_id, copy_text, web_title, web_meta)
  values (v_item, 'website', '# เลือกโซฟา\n\nเนื้อหา', 'เลือกโซฟาห้องเล็ก', 'คำอธิบาย') returning id into v_web;

  -- ── ยังไม่ผ่านตรวจ ส่งไม่ได้ ──
  begin
    perform content.record_wp_send(v_web, 101, '{}', null);
    raise exception 'ส่งเข้า WordPress ได้ทั้งที่ยังไม่ผ่านตรวจ';
  exception when others then if sqlerrm not like 'บทความยังไม่ผ่านตรวจ%' then raise; end if;
  end;
  -- ── แก้สถานะ WordPress ตรงๆ ไม่ได้ · หมวด/slug แก้ได้ ──
  begin
    update content.placements set wp_post_id = 999 where id = v_web;
    raise exception 'แก้เลขโพสต์ WordPress ตรงๆ ได้ ซึ่งไม่ควร';
  exception when others then if sqlerrm not like 'สถานะ WordPress%' then raise; end if;
  end;
  msg := msg || E'\n  ✓ ยังไม่ผ่านตรวจ ส่งเข้า WordPress ไม่ได้ · สถานะ WordPress แก้ตรงๆ ไม่ได้';

  perform content.submit_for_review(v_item);
  perform set_config('test.uid', BAY, true);
  perform content.review_item(v_item, jsonb_build_array(jsonb_build_object('part', 'ch:website', 'pass', true)));
  if (select stage from content.items where id = v_item) <> 'พร้อมโพสต์' then raise exception 'ผ่านครบแล้วควรพร้อมโพสต์'; end if;

  perform set_config('test.uid', CREW, true);
  update content.placements set web_category = 'Design', web_slug = 'small-room-sofa' where id = v_web;
  if (select passed_at from content.placements where id = v_web) is null then
    raise exception 'เปลี่ยนหมวด/slug แล้วผลตรวจหาย ซึ่งไม่ควร';
  end if;
  msg := msg || E'\n  ✓ เปลี่ยนหมวดกับ slug ก่อนส่งได้ ผลตรวจไม่หาย';

  -- ── ส่ง Draft · ส่งซ้ำ = อัปเดตโพสต์เดิม ──
  pl := content.record_wp_send(v_web, 101, '{55,56}', 'ใส่ภาพปกเองใน wp-admin');
  if pl.wp_post_id <> 101 or pl.wp_media_ids <> '{55,56}' or pl.wp_sent_by <> CREW::uuid or pl.published_url is not null then
    raise exception 'บันทึกการส่งไม่ครบ';
  end if;
  pl := content.record_wp_send(v_web, 101, '{55,56}', null);
  select count(*) into n from content.messages where item_id = v_item and kind = 'ระบบ' and body like '%WordPress%';
  if n <> 2 or pl.wp_note is not null then raise exception 'ควรมีข้อความระบบ 2 ข้อ (ส่ง + อัปเดต) ได้ %', n; end if;
  if not exists (select 1 from content.messages where item_id = v_item and body like 'อัปเดต Draft%') then
    raise exception 'ส่งซ้ำควรบอกว่าอัปเดต Draft เดิม';
  end if;
  msg := msg || E'\n  ✓ ส่ง Draft แล้วจำเลขโพสต์ + ภาพ · ส่งซ้ำ = อัปเดตตัวเดิม · แชทแจ้งทุกครั้ง';

  -- ── แก้บทความหลังส่ง = ต้องตรวจใหม่ก่อนส่งซ้ำ ──
  update content.placements set copy_text = '# เลือกโซฟา\n\nเนื้อหาใหม่' where id = v_web;
  begin
    perform content.record_wp_send(v_web, 101, '{55,56}', null);
    raise exception 'แก้แล้วส่งซ้ำได้โดยไม่ตรวจ';
  exception when others then if sqlerrm not like 'บทความยังไม่ผ่านตรวจ%' then raise; end if;
  end;
  -- แก้หลังอนุมัติ ระบบถอนอนุมัติกลับไปรอตรวจเอง (C3)
  perform set_config('test.uid', BAY, true);
  perform content.review_item(v_item, jsonb_build_array(jsonb_build_object('part', 'ch:website', 'pass', true)));
  perform set_config('test.uid', CREW, true);
  perform content.record_wp_send(v_web, 101, '{55,56}', null);
  msg := msg || E'\n  ✓ แก้บทความหลังส่ง → ต้องผ่านตรวจใหม่ก่อนส่งซ้ำ';

  -- ── Publish ใน WordPress → ระบบใส่ลิงก์ + โพสต์แล้ว · หลังจากนั้นส่งทับไม่ได้ ──
  begin
    perform content.record_wp_published(v_web, 'not-a-link');
    raise exception 'รับลิงก์ผิดรูปแบบ';
  exception when others then if sqlerrm not like 'ลิงก์บทความ%' then raise; end if;
  end;
  pl := content.record_wp_published(v_web, 'https://chawcher.com/small-room-sofa/');
  if pl.published_url <> 'https://chawcher.com/small-room-sofa/' then raise exception 'ไม่ได้ใส่ลิงก์'; end if;
  if (select stage from content.items where id = v_item) <> 'โพสต์แล้ว' then raise exception 'ลงครบแล้วควรเป็นโพสต์แล้ว'; end if;
  begin
    perform content.record_wp_send(v_web, 101, '{}', null);
    raise exception 'ส่งทับบทความที่ Publish แล้วได้';
  exception when others then if sqlerrm not like 'บทความนี้ Publish แล้ว%' then raise; end if;
  end;
  msg := msg || E'\n  ★ Publish ใน WordPress → การ์ดได้ลิงก์จริง + "โพสต์แล้ว" เอง · หลังจากนั้นระบบไม่ส่งทับ';

  raise notice '13_content_wordpress ผ่านทั้งหมด%', msg;
end;
$$;

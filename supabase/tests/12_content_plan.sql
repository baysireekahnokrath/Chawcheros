-- ============================================================================
-- ทดสอบโมดูลคอนเทนต์ · รอบ R6 แผนเดือน + แบรนด์
-- ใช้ผู้ใช้จาก 06 (ทีม 4444…) และ 09 (Bay 7777…)
-- ============================================================================

set local role authenticated;

do $$
declare
  CREW constant text := '44444444-4444-4444-4444-444444444444';
  BAY  constant text := '77777777-7777-7777-7777-777777777777';
  v_cc uuid; v_hof uuid; v_plan uuid; v_s1 uuid; v_s2 uuid; v_item uuid; v_pl uuid; n int; msg text := '';
  v_month date := (date_trunc('month', current_date) + interval '2 month')::date;
begin
  perform set_config('test.uid', CREW, true);
  select id into v_cc from catalog.brands where name = 'ฌ เฌอ';
  select id into v_hof from catalog.brands where name = 'HOF';

  insert into content.plans (brand_id, month) values (v_cc, v_month) returning id into v_plan;
  begin
    perform content.submit_plan(v_plan);
    raise exception 'ส่งแผนว่างได้ ซึ่งไม่ควร';
  exception when others then if sqlerrm like 'ส่งแผนว่าง%' then raise; end if;
  end;

  insert into content.plan_slots (plan_id, planned_on, format, channels, hook)
  values (v_plan, v_month + 2, 'ภาพเดี่ยว', '{facebook,instagram}', 'โซฟาที่แมวรัก') returning id into v_s1;
  insert into content.plan_slots (plan_id, planned_on, format, channels, hook)
  values (v_plan, v_month + 9, 'ข้อความล้วน', '{facebook,website}', 'เลือกโซฟาให้ห้องเล็ก') returning id into v_s2;
  begin
    insert into content.plan_slots (plan_id, planned_on, format, channels) values (v_plan, v_month + 3, 'ข้อความล้วน', '{instagram}');
    raise exception 'ข้อความล้วนลง IG ในแผนได้ ซึ่งไม่ควร';
  exception when others then if sqlerrm like '%ซึ่งไม่ควร' then raise; end if;
  end;
  begin
    insert into content.plan_slots (plan_id, planned_on) values (v_plan, v_month - 1);
    raise exception 'ใส่วันนอกเดือนของแผนได้ ซึ่งไม่ควร';
  exception when others then if sqlerrm like '%ซึ่งไม่ควร' then raise; end if;
  end;
  msg := msg || E'\n  ✓ ร่างแผน: ส่งแผนว่างไม่ได้ · ข้อความล้วนลง IG ไม่ได้ · วันต้องอยู่ในเดือน';

  perform content.submit_plan(v_plan);
  begin
    update content.plan_slots set hook = 'แอบแก้' where id = v_s1;
    raise exception 'แก้แผนที่ส่งแล้วได้ ซึ่งไม่ควร';
  exception when others then if sqlerrm like '%ซึ่งไม่ควร' then raise; end if;
  end;
  begin
    perform content.approve_plan(v_plan);
    raise exception 'ทีมอนุมัติแผนเองได้ ซึ่งไม่ควร';
  exception when insufficient_privilege then null;
  end;
  msg := msg || E'\n  ✓ ส่งแล้วแก้ไม่ได้ · ทีมอนุมัติแผนเองไม่ได้';

  perform set_config('test.uid', BAY, true);
  perform content.bounce_plan(v_plan, 'เพิ่มเรื่องไม้สักอีกชิ้น');
  perform set_config('test.uid', CREW, true);
  update content.plan_slots set hook = 'โซฟาที่แมวรัก v2' where id = v_s1;
  perform content.submit_plan(v_plan);
  perform set_config('test.uid', BAY, true);
  select content.approve_plan(v_plan) into n;
  if n <> 2 then raise exception 'อนุมัติแล้วควรได้การ์ด 2 ใบ ได้ %', n; end if;
  select item_id into v_item from content.plan_slots where id = v_s1;
  if (select off_plan from content.items where id = v_item) then raise exception 'การ์ดจากแผนติดป้ายนอกแผน'; end if;
  if (select created_by from content.items where id = v_item) <> CREW::uuid then raise exception 'การ์ดจากแผนควรเป็นของคนร่างแผน'; end if;
  select count(*) into n from content.placements where item_id = v_item and planned_on = v_month + 2;
  if n <> 2 then raise exception 'การ์ดควรมีวันลง FB + IG ตามแผน ได้ %', n; end if;
  msg := msg || E'\n  ★ ตีกลับ → แก้ → ส่งใหม่ → Bay อนุมัติ = การ์ดไอเดีย 2 ใบ ในแผน วันลงและช่องทางติดมาครบ';

  perform set_config('test.uid', CREW, true);
  begin
    update content.plan_slots set hook = 'แก้ตรงๆ' where id = v_s2;
    raise exception 'แก้ช่องในแผนที่อนุมัติแล้วตรงๆ ได้ ซึ่งไม่ควร';
  exception when others then if sqlerrm like '%ซึ่งไม่ควร' then raise; end if;
  end;
  perform content.add_slot_after_approval(v_plan, jsonb_build_object('planned_on', v_month + 15, 'hook', 'ชิ้นเสริม', 'channels', jsonb_build_array('facebook')));
  perform content.remove_slot(v_s2, 'ซ้ำกับชิ้นอื่น');
  if (select stage from content.items where id = (select item_id from content.plan_slots where id = v_s2)) <> 'พับไว้' then
    raise exception 'ตัดชิ้นหลังอนุมัติแล้วการ์ดไม่ถูกพับ';
  end if;
  select count(*) into n from content.plan_changes where plan_id = v_plan and seen_at is null;
  if n <> 2 then raise exception 'ควรมีบันทึกเพิ่ม/ตัดแจ้ง Bay 2 รายการ ได้ %', n; end if;
  perform set_config('test.uid', BAY, true);
  perform content.mark_plan_changes_seen(v_plan);
  if exists (select 1 from content.plan_changes where plan_id = v_plan and seen_at is null) then raise exception 'Bay กดเห็นแล้วยังค้าง'; end if;
  msg := msg || E'\n  ✓ หลังอนุมัติ: แก้ตรงๆ ไม่ได้ · เพิ่ม/ตัดผ่านปุ่ม = การ์ดใหม่/พับการ์ด + บันทึกแจ้ง Bay';

  perform set_config('test.uid', CREW, true);
  insert into content.brand_kits (brand_id, fonts) values (v_cc, 'แอบตั้ง');
  raise exception 'ทีมตั้ง Brand Kit ได้ ซึ่งไม่ควร';
exception
  when insufficient_privilege then
    raise notice E'12_content_plan ผ่านทั้งหมด%\n  ✓ Brand Kit ตั้งได้เฉพาะ Bay', msg;
end $$;

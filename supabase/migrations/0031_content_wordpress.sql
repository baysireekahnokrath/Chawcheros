-- ============================================================================
-- โมดูลคอนเทนต์ เฟส 2 · R7 · ส่งบล็อกเข้า WordPress (W-01–09)
--
-- กฎ: ระบบส่งเป็น Draft เท่านั้น · คนกด Publish เองใน wp-admin
-- ผู้ใช้ WordPress ที่ระบบใช้มีสิทธิ์ Author → Publish ไม่ได้โดยสิทธิ์ (กันพลาดอีกชั้น)
-- ระบบเห็นเองว่า Draft ถูก Publish แล้ว → ใส่ลิงก์ + "โพสต์แล้ว" ให้ (W-07)
-- ============================================================================

alter table content.placements
  add column web_category  text,
  add column web_slug      text,
  add column wp_post_id    bigint,
  add column wp_media_ids  bigint[] not null default '{}',
  add column wp_sent_at    timestamptz,
  add column wp_sent_by    uuid references core.app_users(id),
  add column wp_note       text,
  add column wp_checked_at timestamptz;

comment on column content.placements.web_category is 'หมวดบทความบนเว็บ (ชื่อ) · agent เลือกจากหมวดที่มีอยู่ (W-04)';
comment on column content.placements.web_slug     is 'slug ภาษาอังกฤษของบทความ · ว่าง = WordPress ตั้งเอง';
comment on column content.placements.wp_post_id   is 'เลขโพสต์ใน WordPress · มีแล้ว = ส่งซ้ำอัปเดตโพสต์เดิม ไม่สร้างใหม่ (W-08)';
comment on column content.placements.wp_media_ids is 'ภาพที่อัปขึ้น Media แล้ว · ตัวแรก = ภาพปก · ส่งซ้ำไม่อัปซ้ำ';
comment on column content.placements.wp_note      is 'สิ่งที่คนต้องทำต่อใน wp-admin เช่น ใส่ภาพปกเอง · ช่อง Yoast ยังไม่เปิด';
comment on column content.placements.wp_checked_at is 'เช็กสถานะใน WordPress ล่าสุดเมื่อไหร่ (W-07)';

alter table content.placements add constraint wp_only_website
  check (wp_post_id is null or channel_id = 'website');

-- ช่อง wp_* เขียนผ่านฟังก์ชันเท่านั้น · web_category / web_slug คนแก้ได้ตรงๆ
create or replace function content.guard_wp_columns()
returns trigger
language plpgsql
set search_path = content, public
as $$
begin
  if current_setting('content.wp_fn', true) = 'on' then return new; end if;
  if new.wp_post_id    is distinct from old.wp_post_id
     or new.wp_media_ids is distinct from old.wp_media_ids
     or new.wp_sent_at   is distinct from old.wp_sent_at
     or new.wp_sent_by   is distinct from old.wp_sent_by
     or new.wp_note      is distinct from old.wp_note
     or new.wp_checked_at is distinct from old.wp_checked_at then
    raise exception 'สถานะ WordPress เปลี่ยนได้ผ่านปุ่มส่งเท่านั้น';
  end if;
  return new;
end;
$$;
create trigger guard_wp_columns before update on content.placements
  for each row execute function content.guard_wp_columns();

-- ---------------------------------------------------------------------------
-- บันทึกว่าส่ง Draft แล้ว · ด่านเดียวกับ "โพสต์" (Q-49g): ข้อความผ่าน + ภาพผ่านทุกภาพ
-- ---------------------------------------------------------------------------
create or replace function content.record_wp_send(
  p_placement_id uuid, p_post_id bigint, p_media_ids bigint[], p_note text
) returns content.placements
language plpgsql security definer
set search_path = core, content, public
as $$
declare pl content.placements; v_img_open int; v_first boolean;
begin
  if not (core.has_capability('marketing.write') or core.has_capability('design.write')) then
    raise exception 'ต้องมีสิทธิ์ marketing.write หรือ design.write จึงจะส่งเข้า WordPress ได้'
      using errcode = 'insufficient_privilege';
  end if;

  select * into pl from content.placements where id = p_placement_id for update;
  if not found then raise exception 'ไม่พบรายการที่ลง'; end if;
  if pl.channel_id <> 'website' then raise exception 'ส่งเข้า WordPress ได้เฉพาะช่องเว็บไซต์'; end if;
  if pl.published_url is not null then
    raise exception 'บทความนี้ Publish แล้ว · แก้ในเว็บแทน ระบบไม่ทับบทความที่ขึ้นเว็บแล้ว';
  end if;
  select count(*) into v_img_open from content.item_images
   where item_id = pl.item_id and removed_at is null and passed_at is null;
  if pl.passed_at is null or v_img_open > 0 then
    raise exception 'บทความยังไม่ผ่านตรวจ (ข้อความหรือภาพ) ส่งเข้า WordPress ไม่ได้';
  end if;
  if p_post_id is null or p_post_id <= 0 then raise exception 'ไม่มีเลขโพสต์จาก WordPress'; end if;

  perform set_config('content.wp_fn', 'on', true);
  v_first := pl.wp_post_id is distinct from p_post_id;
  update content.placements
     set wp_post_id = p_post_id,
         wp_media_ids = coalesce(p_media_ids, '{}'),
         wp_sent_at = now(), wp_sent_by = auth.uid(),
         wp_note = nullif(trim(p_note), ''),
         wp_checked_at = now(),
         updated_by = auth.uid()
   where id = p_placement_id
  returning * into pl;
  perform set_config('content.wp_fn', 'off', true);

  perform content.post_system_message(pl.item_id,
    case when v_first then 'ส่งบทความเข้า WordPress เป็น Draft แล้ว · รอคนกด Publish ใน wp-admin'
         else 'อัปเดต Draft ใน WordPress แล้ว' end);
  return pl;
end;
$$;

-- ---------------------------------------------------------------------------
-- ระบบเห็นว่า Draft ถูก Publish แล้ว → ลิงก์จริง + นับว่าลงแล้ว (W-07)
-- ไม่ต้องผ่านด่านตรวจซ้ำ เพราะเป็นการบันทึกสิ่งที่เกิดขึ้นบนเว็บแล้ว
-- ---------------------------------------------------------------------------
create or replace function content.record_wp_published(p_placement_id uuid, p_url text)
returns content.placements
language plpgsql security definer
set search_path = core, content, public
as $$
declare pl content.placements; it content.items; v_left int;
begin
  if not (core.has_capability('marketing.write') or core.has_capability('design.write')
          or core.has_capability('content.approve')) then
    raise exception 'ไม่มีสิทธิ์ในงานคอนเทนต์' using errcode = 'insufficient_privilege';
  end if;
  select * into pl from content.placements where id = p_placement_id for update;
  if not found then raise exception 'ไม่พบรายการที่ลง'; end if;
  if pl.wp_post_id is null then raise exception 'บทความนี้ยังไม่ได้ส่งเข้า WordPress'; end if;
  if pl.published_url is not null then return pl; end if;
  if coalesce(trim(p_url), '') !~ '^https?://' then raise exception 'ลิงก์บทความไม่ถูกต้อง'; end if;

  perform set_config('content.wp_fn', 'on', true);
  update content.placements
     set published_url = trim(p_url), published_at = now(), wp_checked_at = now(), wp_note = null
   where id = p_placement_id
  returning * into pl;
  perform set_config('content.wp_fn', 'off', true);

  perform content.post_system_message(pl.item_id, 'บทความขึ้นเว็บแล้ว (Publish ใน WordPress) · ' || pl.published_url);

  select * into it from content.items where id = pl.item_id;
  select count(*) into v_left from content.placements
   where item_id = pl.item_id and published_url is null and skipped_reason is null;
  if v_left = 0 and it.stage = 'พร้อมโพสต์' then
    update content.items set stage = 'โพสต์แล้ว' where id = pl.item_id;
  end if;
  return pl;
end;
$$;

-- เช็กแล้วยังเป็น Draft · จดเวลาไว้ ไม่เช็กถี่เกิน (W-07)
create or replace function content.touch_wp_check(p_placement_ids uuid[])
returns void
language plpgsql security definer
set search_path = core, content, public
as $$
begin
  if not (core.has_capability('marketing.write') or core.has_capability('design.write')
          or core.has_capability('content.approve')) then
    return;
  end if;
  perform set_config('content.wp_fn', 'on', true);
  update content.placements set wp_checked_at = now()
   where id = any(p_placement_ids) and wp_post_id is not null;
  perform set_config('content.wp_fn', 'off', true);
end;
$$;

revoke all on function content.record_wp_send(uuid, bigint, bigint[], text) from public, anon;
revoke all on function content.record_wp_published(uuid, text)              from public, anon;
revoke all on function content.touch_wp_check(uuid[])                       from public, anon;
revoke all on function content.guard_wp_columns()                           from public, anon, authenticated;
grant execute on function content.record_wp_send(uuid, bigint, bigint[], text) to authenticated;
grant execute on function content.record_wp_published(uuid, text)              to authenticated;
grant execute on function content.touch_wp_check(uuid[])                       to authenticated;

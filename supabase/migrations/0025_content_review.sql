-- ============================================================================
-- 0025 · โมดูลคอนเทนต์ เฟส 1 · รอบ R2 ตรวจทีละส่วน + แชท + โพสต์
-- ============================================================================
-- ที่มา: docs/modules/content/2-requirements.md หมวด จ · จ2 · ฉ
--
--   Q-47–49c  ตรวจทีละส่วน (ภาพแต่ละภาพ · ข้อความแต่ละช่องทาง) ผ่าน/ไม่ผ่าน
--             ไม่ผ่านต้องมีเหตุผล · ส่วนที่ผ่านแล้วไม่ต้องตรวจซ้ำ · แก้ส่วนที่ผ่าน = ส่วนนั้นกลับไปรอตรวจ
--   Q-42      คนแก้ติ๊กทีละข้อ · ส่งตรวจใหม่ได้เมื่อติ๊กครบ
--   Q-43      เก็บทุกเวอร์ชันที่ส่งตรวจ
--   Q-49d–i   แชทในงาน อ้างถึงส่วนได้ · เหตุผลที่ติลงแชทเอง · @ชื่อ · ตัวเลขข้อความใหม่
--   Q-49g     ช่องทางที่ข้อความผ่าน และภาพทุกภาพผ่าน โพสต์ก่อนได้ไม่ต้องรอช่องอื่น
--   Q-121     Bay อนุมัติงานที่ตัวเองตั้งได้ · คนอื่นอนุมัติงานตัวเองไม่ได้ (C6)
--
-- "Bay" ในฐานข้อมูลคือคนที่มีสิทธิ์ admin · ไม่ผูกกับชื่อคน
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ชิ้นงาน · ใครตั้ง และรอบที่เท่าไหร่
-- ---------------------------------------------------------------------------
alter table content.items
  add column created_by uuid references core.app_users(id) default auth.uid(),
  add column version    int  not null default 1 check (version >= 1);

update content.items set created_by = updated_by where created_by is null;

comment on column content.items.created_by is 'คนตั้งงาน · ใช้กันอนุมัติงานตัวเอง (C6 · Q-121)';
comment on column content.items.version is 'รอบที่ส่งตรวจ · ตีกลับแล้วส่งใหม่ = รอบถัดไป (Q-43)';

-- ---------------------------------------------------------------------------
-- ★ ผ่านทีละส่วน · ส่วนคือ ข้อความของช่องทางหนึ่ง หรือภาพหนึ่งภาพ
-- ---------------------------------------------------------------------------
alter table content.placements
  add column passed_at timestamptz,
  add column passed_by uuid references core.app_users(id);
alter table content.item_images
  add column passed_at timestamptz,
  add column passed_by uuid references core.app_users(id);

comment on column content.placements.passed_at is 'ข้อความช่องทางนี้ผ่านตรวจแล้ว · แก้ข้อความ = ว่างเอง ต้องตรวจใหม่ (Q-49c)';
comment on column content.item_images.passed_at is 'ภาพนี้ผ่านตรวจแล้ว · เปลี่ยนลิงก์ = ว่างเอง ต้องตรวจใหม่ (Q-49c)';

-- ของที่อนุมัติไปแล้วก่อนมีระบบนี้ ถือว่าผ่านทุกส่วน
update content.placements p
   set passed_at = coalesce(i.approved_at, now()), passed_by = i.approved_by
  from content.items i
 where i.id = p.item_id and i.stage in ('พร้อมโพสต์', 'โพสต์แล้ว');
update content.item_images m
   set passed_at = coalesce(i.approved_at, now()), passed_by = i.approved_by
  from content.items i
 where i.id = m.item_id and i.stage in ('พร้อมโพสต์', 'โพสต์แล้ว');

-- แก้ส่วนที่ผ่านแล้ว = ส่วนนั้นกลับไปรอตรวจ
-- ย้ายลำดับภาพไม่ล้างการผ่านของภาพ (ภาพเดิม) แต่ชิ้นงานยังกลับไปรอตรวจ เพราะ key visual เปลี่ยน (0024)
create or replace function content.clear_part_pass()
returns trigger
language plpgsql
set search_path = content, public
as $$
begin
  if tg_table_name = 'placements' then
    if new.hook          is distinct from old.hook
       or new.copy_text  is distinct from old.copy_text
       or new.web_title  is distinct from old.web_title
       or new.web_keyword is distinct from old.web_keyword
       or new.web_meta   is distinct from old.web_meta then
      new.passed_at := null; new.passed_by := null;
    end if;
  else
    if new.url is distinct from old.url or new.removed_at is distinct from old.removed_at then
      new.passed_at := null; new.passed_by := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger clear_part_pass before update on content.placements
  for each row execute function content.clear_part_pass();
create trigger clear_part_pass before update on content.item_images
  for each row execute function content.clear_part_pass();

-- ---------------------------------------------------------------------------
-- รายการที่ต้องแก้ · 1 แถว = 1 ส่วนที่ไม่ผ่าน · คนแก้ติ๊กทีละข้อ (Q-42)
-- ---------------------------------------------------------------------------
create table content.review_notes (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references content.items(id),
  version     int  not null,
  part_key    text not null,
  part_label  text not null,
  note        text not null check (trim(note) <> ''),
  done_at     timestamptz,
  done_by     uuid references core.app_users(id),
  created_at  timestamptz not null default now(),
  created_by  uuid references core.app_users(id) default auth.uid(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references core.app_users(id)
);
create index on content.review_notes (item_id, version);
comment on table content.review_notes is
  'ส่วนที่ไม่ผ่านพร้อมเหตุผล · part_key = ch:<ช่องทาง> หรือ img:<id ภาพ> · ติ๊ก done_at เมื่อแก้แล้ว';

-- ---------------------------------------------------------------------------
-- เวอร์ชัน · ภาพและข้อความตอนส่งตรวจแต่ละรอบ (Q-43 · R-03)
-- ---------------------------------------------------------------------------
create table content.item_versions (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references content.items(id),
  version       int  not null,
  submitted_at  timestamptz not null default now(),
  submitted_by  uuid references core.app_users(id),
  snapshot      jsonb not null,
  unique (item_id, version)
);
comment on table content.item_versions is 'ภาพถ่ายของชิ้นงานตอนส่งตรวจแต่ละรอบ · ย้อนดูได้ว่ารอบก่อนโดนติอะไร';

-- ---------------------------------------------------------------------------
-- แชทในงาน (Q-49d) · ข้อความระบบ = เหตุการณ์ของงาน · ห้ามแก้ห้ามลบ
-- ---------------------------------------------------------------------------
create table content.messages (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references content.items(id),
  author_id   uuid references core.app_users(id),
  kind        text not null default 'คน' check (kind in ('คน', 'ระบบ', 'AI')),
  part_label  text,
  body        text not null check (trim(body) <> ''),
  mentions    uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index on content.messages (item_id, created_at);
create index on content.messages using gin (mentions);
comment on table content.messages is
  'คุยกันในงาน · part_label บอกว่าพูดถึงส่วนไหน · mentions = คนที่ถูก @ (Q-49i)';

create trigger no_delete_content_messages before delete on content.messages
  for each row execute function core.prevent_delete();

-- อ่านถึงไหนแล้ว · ใช้นับข้อความใหม่ (Q-49h) · ไม่มีแจ้งเตือนเข้ามือถือ (A6)
create table content.message_reads (
  user_id      uuid not null references core.app_users(id) default auth.uid(),
  item_id      uuid not null references content.items(id),
  last_read_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create or replace function content.post_system_message(p_item_id uuid, p_body text)
returns void
language sql
security definer
set search_path = content, public
as $$
  insert into content.messages (item_id, kind, body) values (p_item_id, 'ระบบ', p_body);
$$;

-- ---------------------------------------------------------------------------
-- ส่วนที่ยังต้องตรวจของชิ้นงาน · ข้อความช่องทางที่ยังลง + ภาพที่ยังอยู่ และยังไม่ผ่าน
-- ---------------------------------------------------------------------------
create or replace function content.open_parts(p_item_id uuid)
returns table (part_key text, part_label text)
language sql stable
set search_path = content, marketing, public
as $$
  select 'ch:' || p.channel_id, ch.name_th
    from content.placements p join marketing.channels ch on ch.id = p.channel_id
   where p.item_id = p_item_id and p.skipped_reason is null and p.passed_at is null
  union all
  -- เลขภาพนับจากภาพที่ยังอยู่ทั้งหมด ไม่ใช่เฉพาะที่ยังไม่ผ่าน · "ภาพ 3" ต้องตรงกับที่คนแก้เห็น
  select 'img:' || n.id, 'ภาพ ' || n.no
    from (select m.id, m.passed_at, row_number() over (order by m.position, m.created_at) as no
            from content.item_images m
           where m.item_id = p_item_id and m.removed_at is null) n
   where n.passed_at is null
$$;

-- ---------------------------------------------------------------------------
-- ส่งตรวจ · ตีกลับแล้วต้องติ๊กแก้ครบก่อน (Q-42) · บันทึกเวอร์ชัน (Q-43)
-- ---------------------------------------------------------------------------
create or replace function content.submit_for_review(p_item_id uuid)
returns content.items
language plpgsql security definer
set search_path = core, content, public
as $$
declare it content.items; v_open int; v_snap jsonb;
begin
  if not (core.has_capability('marketing.write') or core.has_capability('design.write')) then
    raise exception 'ต้องมีสิทธิ์ marketing.write หรือ design.write จึงจะส่งตรวจได้'
      using errcode = 'insufficient_privilege';
  end if;

  select * into it from content.items where id = p_item_id;
  if not found then raise exception 'ไม่พบชิ้นงาน'; end if;
  if it.stage in ('รอตรวจ', 'พร้อมโพสต์', 'โพสต์แล้ว') then
    raise exception 'ชิ้นนี้อยู่ขั้น "%" อยู่แล้ว ส่งตรวจซ้ำไม่ได้', it.stage;
  end if;

  select count(*) into v_open from content.review_notes where item_id = p_item_id and done_at is null;
  if v_open > 0 then
    raise exception 'ยังแก้ไม่ครบ เหลืออีก % ข้อ · ติ๊กข้อที่แก้แล้วก่อนส่งตรวจ', v_open;
  end if;

  update content.items
     set stage = 'รอตรวจ', review_note = null,
         version = case when it.stage = 'ตีกลับแก้' then it.version + 1 else it.version end
   where id = p_item_id
  returning * into it;

  select jsonb_build_object(
    'hook', it.hook, 'key_message', it.key_message, 'visual', it.visual,
    'channels', coalesce((select jsonb_agg(jsonb_build_object(
        'channel', p.channel_id, 'hook', p.hook, 'copy_text', p.copy_text,
        'web_title', p.web_title, 'web_keyword', p.web_keyword, 'web_meta', p.web_meta,
        'first_comment', p.first_comment) order by p.channel_id)
      from content.placements p where p.item_id = p_item_id and p.skipped_reason is null), '[]'),
    'images', coalesce((select jsonb_agg(m.url order by m.position, m.created_at)
      from content.item_images m where m.item_id = p_item_id and m.removed_at is null), '[]'))
  into v_snap;

  insert into content.item_versions (item_id, version, submitted_by, snapshot)
  values (p_item_id, it.version, auth.uid(), v_snap)
  on conflict (item_id, version) do update
    set snapshot = excluded.snapshot, submitted_at = now(), submitted_by = excluded.submitted_by;

  perform content.post_system_message(p_item_id, 'ส่งตรวจ v' || it.version);
  return it;
end;
$$;

-- ---------------------------------------------------------------------------
-- กันอนุมัติงานตัวเอง · ยกเว้นคนที่มีสิทธิ์ admin (Bay) (Q-121)
-- ---------------------------------------------------------------------------
create or replace function content.assert_not_own_work(it content.items)
returns void
language plpgsql stable
set search_path = core, content, public
as $$
begin
  if (it.created_by = auth.uid() or it.owner_id = auth.uid()) and not core.has_capability('admin') then
    raise exception 'ตรวจงานที่ตัวเองตั้งหรือเป็นคนทำไม่ได้ · ต้องให้คนอื่นตรวจ'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- ★ ตรวจทีละส่วน
-- p_verdicts = [{"part": "ch:facebook" | "img:<uuid>", "pass": true|false, "note": "..."}]
-- ต้องตัดสินครบทุกส่วนที่ยังไม่ผ่าน · ไม่ผ่านต้องมีเหตุผล
-- ผ่านหมด = อนุมัติ · มีไม่ผ่าน = ตีกลับเฉพาะส่วนนั้น ส่วนที่ผ่านเก็บไว้ไม่ต้องตรวจซ้ำ
-- ---------------------------------------------------------------------------
create or replace function content.review_item(
  p_item_id  uuid,
  p_verdicts jsonb,
  p_note     text default null
) returns content.items
language plpgsql security definer
set search_path = core, content, public
as $$
declare
  it content.items; r record; v jsonb; v_fail int := 0; v_pass int := 0; v_failed text := '';
begin
  if not core.has_capability('content.approve') then
    raise exception 'ต้องมีสิทธิ์ content.approve จึงจะตรวจคอนเทนต์ได้'
      using errcode = 'insufficient_privilege';
  end if;

  select * into it from content.items where id = p_item_id for update;
  if not found then raise exception 'ไม่พบชิ้นงาน'; end if;
  if it.stage <> 'รอตรวจ' then
    raise exception 'ตรวจได้เฉพาะชิ้นที่ส่งตรวจแล้ว · ตอนนี้อยู่ขั้น "%"', it.stage;
  end if;
  perform content.assert_not_own_work(it);

  for r in select * from content.open_parts(p_item_id) loop
    select e into v from jsonb_array_elements(coalesce(p_verdicts, '[]')) e
     where e->>'part' = r.part_key limit 1;
    if v is null or v->'pass' is null then
      raise exception 'ยังไม่ได้ตัดสิน "%" · ต้องติ๊กผ่านหรือไม่ผ่านทุกส่วน', r.part_label;
    end if;

    if (v->>'pass')::boolean then
      v_pass := v_pass + 1;
      if r.part_key like 'ch:%' then
        update content.placements set passed_at = now(), passed_by = auth.uid()
         where item_id = p_item_id and channel_id = substr(r.part_key, 4);
      else
        update content.item_images set passed_at = now(), passed_by = auth.uid()
         where id = substr(r.part_key, 5)::uuid;
      end if;
    else
      if coalesce(trim(v->>'note'), '') = '' then
        raise exception '"%" ไม่ผ่าน ต้องบอกเหตุผล คนแก้จะได้รู้ว่าต้องแก้อะไร', r.part_label;
      end if;
      v_fail := v_fail + 1;
      v_failed := v_failed || case when v_failed = '' then '' else ', ' end || r.part_label;
      insert into content.review_notes (item_id, version, part_key, part_label, note)
      values (p_item_id, it.version, r.part_key, r.part_label, trim(v->>'note'));
      insert into content.messages (item_id, author_id, kind, part_label, body)
      values (p_item_id, auth.uid(), 'คน', r.part_label, trim(v->>'note'));
    end if;
  end loop;

  if v_fail = 0 then
    update content.items
       set stage = 'พร้อมโพสต์', approved_by = auth.uid(), approved_at = now(),
           review_note = nullif(trim(coalesce(p_note, '')), '')
     where id = p_item_id
    returning * into it;
    perform content.post_system_message(p_item_id, 'ตรวจ v' || it.version || ' · ผ่านทั้งหมด · อนุมัติแล้ว');
  else
    update content.items
       set stage = 'ตีกลับแก้', approved_by = null, approved_at = null,
           review_note = 'ต้องแก้ ' || v_failed
     where id = p_item_id
    returning * into it;
    perform content.post_system_message(p_item_id,
      'ตรวจ v' || it.version || ' · ผ่าน ' || v_pass || ' ส่วน · ต้องแก้ ' || v_failed);
  end if;

  return it;
end;
$$;

-- ติ๊กว่าแก้ข้อนี้แล้ว (หรือเอาติ๊กออก)
create or replace function content.tick_review_note(p_note_id uuid, p_done boolean)
returns content.review_notes
language plpgsql security definer
set search_path = core, content, public
as $$
declare n content.review_notes;
begin
  if not (core.has_capability('marketing.write') or core.has_capability('design.write')) then
    raise exception 'ต้องมีสิทธิ์ marketing.write หรือ design.write'
      using errcode = 'insufficient_privilege';
  end if;
  update content.review_notes
     set done_at = case when p_done then now() end,
         done_by = case when p_done then auth.uid() end
   where id = p_note_id
  returning * into n;
  if not found then raise exception 'ไม่พบรายการที่ต้องแก้'; end if;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- ปุ่มเดิม (อนุมัติ/ตีกลับทั้งชิ้น) ใช้ได้เฉพาะงานคลิปเดิม · งานเฟส 1 ต้องตรวจทีละส่วน
-- และกันอนุมัติงานตัวเองเหมือนกัน
-- ---------------------------------------------------------------------------
create or replace function content.approve_item(
  p_item_id uuid,
  p_note    text default null
) returns content.items
language plpgsql security definer
set search_path = core, content, public
as $$
declare it content.items;
begin
  if not core.has_capability('content.approve') then
    raise exception 'ต้องมีสิทธิ์ content.approve จึงจะอนุมัติคอนเทนต์ได้'
      using errcode = 'insufficient_privilege';
  end if;

  select * into it from content.items where id = p_item_id;
  if not found then raise exception 'ไม่พบชิ้นงาน'; end if;
  if it.format in ('ข้อความล้วน', 'ภาพเดี่ยว', 'อัลบั้มภาพ') then
    raise exception 'งานนี้ต้องตรวจทีละส่วน · ใช้หน้าตรวจ';
  end if;
  if it.stage <> 'รอตรวจ' then
    raise exception 'อนุมัติได้เฉพาะชิ้นที่ส่งตรวจแล้ว · ตอนนี้อยู่ขั้น "%"', it.stage;
  end if;
  perform content.assert_not_own_work(it);

  update content.items
     set stage = 'พร้อมโพสต์', approved_by = auth.uid(), approved_at = now(), review_note = p_note
   where id = p_item_id
  returning * into it;
  return it;
end;
$$;

create or replace function content.bounce_item(
  p_item_id uuid,
  p_reason  text
) returns content.items
language plpgsql security definer
set search_path = core, content, public
as $$
declare it content.items;
begin
  if not core.has_capability('content.approve') then
    raise exception 'ต้องมีสิทธิ์ content.approve จึงจะตีกลับได้'
      using errcode = 'insufficient_privilege';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'ต้องบอกเหตุผลที่ตีกลับ ไม่งั้นคนทำไม่รู้ว่าต้องแก้อะไร';
  end if;

  select * into it from content.items where id = p_item_id;
  if not found then raise exception 'ไม่พบชิ้นงาน'; end if;
  if it.format in ('ข้อความล้วน', 'ภาพเดี่ยว', 'อัลบั้มภาพ') then
    raise exception 'งานนี้ต้องตรวจทีละส่วน · ใช้หน้าตรวจ';
  end if;

  update content.items
     set stage = 'ตีกลับแก้', review_note = trim(p_reason), approved_by = null, approved_at = null
   where id = p_item_id
  returning * into it;
  return it;
end;
$$;

-- ---------------------------------------------------------------------------
-- ★ โพสต์ · ช่องทางที่ข้อความผ่าน และภาพทุกภาพผ่าน โพสต์ได้เลย (Q-49g)
-- ภาพไม่ผ่าน = ทุกช่องทางที่ใช้ภาพนั้นรอก่อน · ข้อความล้วนไม่มีภาพ ดูแค่ข้อความ
-- ---------------------------------------------------------------------------
create or replace function content.mark_posted(
  p_placement_id uuid,
  p_url          text
) returns content.placements
language plpgsql security definer
set search_path = core, content, public
as $$
declare pl content.placements; it content.items; v_left int; v_img_open int;
begin
  if not (core.has_capability('marketing.write') or core.has_capability('design.write')) then
    raise exception 'ต้องมีสิทธิ์ marketing.write หรือ design.write จึงจะบันทึกการโพสต์ได้'
      using errcode = 'insufficient_privilege';
  end if;

  select * into pl from content.placements where id = p_placement_id;
  if not found then raise exception 'ไม่พบรายการที่ลง'; end if;
  select * into it from content.items where id = pl.item_id;

  if it.format in ('ข้อความล้วน', 'ภาพเดี่ยว', 'อัลบั้มภาพ') then
    select count(*) into v_img_open from content.item_images
     where item_id = pl.item_id and removed_at is null and passed_at is null;
    if pl.passed_at is null or v_img_open > 0 then
      raise exception 'ช่องทางนี้ยังไม่ผ่านตรวจ (ข้อความหรือภาพ) โพสต์ไม่ได้';
    end if;
  elsif it.stage not in ('พร้อมโพสต์', 'โพสต์แล้ว') then
    raise exception 'ชิ้นนี้ยังไม่ผ่านการอนุมัติ (ตอนนี้ "%") โพสต์ไม่ได้', it.stage;
  end if;
  if coalesce(trim(p_url), '') = '' then
    raise exception 'ต้องใส่ลิงก์ที่โพสต์จริง จะได้ย้อนกลับไปดูได้';
  end if;

  update content.placements
     set published_url = trim(p_url), published_at = now(), updated_by = auth.uid()
   where id = p_placement_id
  returning * into pl;

  perform content.post_system_message(pl.item_id, 'ลง ' || pl.channel_id || ' แล้ว');

  select count(*) into v_left from content.placements
   where item_id = pl.item_id and published_url is null and skipped_reason is null;
  if v_left = 0 and it.stage = 'พร้อมโพสต์' then
    update content.items set stage = 'โพสต์แล้ว' where id = pl.item_id;
  end if;

  return pl;
end;
$$;

-- ---------------------------------------------------------------------------
-- ข้อความใหม่ของฉัน · ต่องาน (Q-49h) และข้อความที่ @ ถึงฉัน (Q-49i)
-- ---------------------------------------------------------------------------
create view content.v_my_unread with (security_invoker = true) as
select m.item_id,
       count(*)                                            as unread,
       count(*) filter (where auth.uid() = any(m.mentions)) as mentions
from content.messages m
left join content.message_reads r on r.item_id = m.item_id and r.user_id = auth.uid()
where m.author_id is distinct from auth.uid()
  and m.created_at > coalesce(r.last_read_at, '-infinity')
group by m.item_id;

comment on view content.v_my_unread is 'ข้อความที่ฉันยังไม่ได้อ่านต่องาน · แจ้งด้วยตัวเลขเท่านั้น ไม่ส่งเข้ามือถือ (Y2)';

-- ---------------------------------------------------------------------------
-- กฎเหล็ก + RLS
-- ---------------------------------------------------------------------------
select core.apply_standard_rules('content.review_notes');
create trigger no_delete_content_item_versions before delete on content.item_versions
  for each row execute function core.prevent_delete();

alter table content.review_notes  enable row level security;
alter table content.item_versions enable row level security;
alter table content.messages      enable row level security;
alter table content.message_reads enable row level security;

create policy review_notes_select on content.review_notes for select to authenticated
  using (core.has_capability('marketing.write') or core.has_capability('design.write')
         or core.has_capability('content.approve'));
create policy item_versions_select on content.item_versions for select to authenticated
  using (core.has_capability('marketing.write') or core.has_capability('design.write')
         or core.has_capability('content.approve'));
create policy messages_select on content.messages for select to authenticated
  using (core.has_capability('marketing.write') or core.has_capability('design.write')
         or core.has_capability('content.approve'));
-- พิมพ์ได้เฉพาะในชื่อตัวเอง · ข้อความระบบมาจากฟังก์ชันเท่านั้น
create policy messages_insert on content.messages for insert to authenticated
  with check (author_id = auth.uid() and kind = 'คน'
    and (core.has_capability('marketing.write') or core.has_capability('design.write')
         or core.has_capability('content.approve')));
create policy reads_own on content.message_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on content.review_notes, content.item_versions to authenticated;
grant select, insert on content.messages to authenticated;
grant select, insert, update on content.message_reads to authenticated;
grant select on content.v_my_unread to authenticated;
-- review_notes กับ item_versions เขียนผ่านฟังก์ชันเท่านั้น
revoke insert, update on content.review_notes, content.item_versions from authenticated;

revoke all on function content.clear_part_pass()                      from public, anon, authenticated;
revoke all on function content.post_system_message(uuid, text)        from public, anon, authenticated;
revoke all on function content.assert_not_own_work(content.items)     from public, anon;
grant execute on function content.assert_not_own_work(content.items)  to authenticated;
revoke all on function content.open_parts(uuid)                       from public, anon;
grant execute on function content.open_parts(uuid)                    to authenticated;
revoke all on function content.review_item(uuid, jsonb, text)         from public, anon;
grant execute on function content.review_item(uuid, jsonb, text)      to authenticated;
revoke all on function content.tick_review_note(uuid, boolean)        from public, anon;
grant execute on function content.tick_review_note(uuid, boolean)     to authenticated;
revoke all on function content.submit_for_review(uuid)                from public, anon;
grant execute on function content.submit_for_review(uuid)             to authenticated;
revoke all on function content.approve_item(uuid, text)               from public, anon;
grant execute on function content.approve_item(uuid, text)            to authenticated;
revoke all on function content.bounce_item(uuid, text)                from public, anon;
grant execute on function content.bounce_item(uuid, text)             to authenticated;
revoke all on function content.mark_posted(uuid, text)                from public, anon;
grant execute on function content.mark_posted(uuid, text)             to authenticated;

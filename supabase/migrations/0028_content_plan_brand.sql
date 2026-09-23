-- ============================================================================
-- 0028 · โมดูลคอนเทนต์ เฟส 1 · รอบ R6 แผนเดือน + แบรนด์
-- ============================================================================
-- ที่มา: docs/modules/content/2-requirements.md หมวด ข · ซ · ก2
--
--   Q-12  หัวข้อรายสัปดาห์ใต้ธีม
--   Q-14  การตลาดร่างแผน กดส่งให้ Bay · Bay อนุมัติทั้งแผนครั้งเดียว
--   Q-15  ส่งก่อนวันแรกของแผน 20 วัน (Bay: ไม่ต้องมีป้ายส่งช้า · แค่โชว์เส้นตาย)
--   Q-16  อนุมัติแล้ว ทุกช่องในแผนกลายเป็นการ์ด "ไอเดีย" ข้อมูลติดมาครบ (ในแผน · ไม่ใช่นอกแผน)
--   Q-17  หลังอนุมัติ เพิ่ม/ตัดชิ้น ระบบบันทึกและแจ้ง Bay ในหน้าแผน
--   Q-70  Brand Kit · โลโก้ · ฟอนต์ · สี · Q-71 ตัวอย่างที่ใช่/ไม่ใช่
--   Q-08  ตั้งค่าเส้นทาง agent ต่อ ประเภท × ช่องทาง โดยไม่ต้องแก้โค้ด (เฟส 1 มี Content agent ตัวเดียว)
--   K6    สีแคมเปญ (ปฏิทินสีตามแคมเปญ)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- หัวข้อรายสัปดาห์ใต้ธีม (Q-12)
-- ---------------------------------------------------------------------------
create table content.theme_weeks (
  id          uuid primary key default gen_random_uuid(),
  theme_id    uuid not null references content.themes(id),
  week_of     date not null check (extract(isodow from week_of) = 1),
  topic       text not null check (trim(topic) <> ''),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references core.app_users(id),
  unique (theme_id, week_of)
);
comment on column content.theme_weeks.week_of is 'วันจันทร์ของสัปดาห์';

-- ---------------------------------------------------------------------------
-- ★ แผนเดือน (Q-14–17)
-- ---------------------------------------------------------------------------
create table content.plans (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references catalog.brands(id),
  month        date not null check (extract(day from month) = 1),
  status       text not null default 'ร่าง' check (status in ('ร่าง', 'รออนุมัติ', 'ตีกลับ', 'อนุมัติแล้ว')),
  note         text,
  review_note  text,
  submitted_at timestamptz,
  submitted_by uuid references core.app_users(id),
  approved_at  timestamptz,
  approved_by  uuid references core.app_users(id),
  created_by   uuid references core.app_users(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references core.app_users(id),
  unique (brand_id, month)
);
comment on table content.plans is 'แผนคอนเทนต์ 1 เดือน 1 แบรนด์ · เส้นตายส่ง = วันแรกของเดือน − 20 วัน (คำนวณ ไม่เก็บ · A10)';

create table content.plan_slots (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references content.plans(id),
  planned_on   date not null,
  format       content.format not null default 'ภาพเดี่ยว',
  channels     text[] not null default '{facebook,instagram}',
  hook         text,
  key_message  text,
  visual       text,
  pillar_id    uuid references content.pillars(id),
  theme_id     uuid references content.themes(id),
  campaign_id  uuid references marketing.campaigns(id),
  owner_id     uuid references core.app_users(id),
  product_ids  uuid[] not null default '{}',
  item_id      uuid references content.items(id),
  removed_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references core.app_users(id)
);
create index on content.plan_slots (plan_id, planned_on);
comment on column content.plan_slots.item_id is 'การ์ดที่เกิดจากช่องนี้ตอนอนุมัติแผน (Q-16)';
comment on column content.plan_slots.removed_at is 'ตัดออกจากแผน · ไม่ลบแถว (A7)';

-- บันทึกเพิ่ม/ตัดหลังอนุมัติ · แจ้ง Bay ในหน้าแผน (Q-17)
create table content.plan_changes (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references content.plans(id),
  slot_id     uuid references content.plan_slots(id),
  kind        text not null check (kind in ('เพิ่ม', 'ตัด')),
  summary     text not null,
  seen_at     timestamptz,
  created_by  uuid references core.app_users(id) default auth.uid(),
  created_at  timestamptz not null default now()
);
create trigger no_delete_content_plan_changes before delete on content.plan_changes
  for each row execute function core.prevent_delete();

-- ช่องในแผน: ช่องทางต้องเป็นของเฟส 1 · ข้อความล้วนลง IG ไม่ได้ · วันต้องอยู่ในเดือนของแผน
-- แผนที่ส่งแล้ว (รออนุมัติ) แก้ไม่ได้จนกว่าจะตีกลับ · อนุมัติแล้วแก้ผ่านฟังก์ชันเท่านั้น
create or replace function content.check_slot_rules()
returns trigger
language plpgsql
set search_path = content, public
as $$
declare p content.plans;
begin
  select * into p from content.plans where id = new.plan_id;
  if p.status = 'รออนุมัติ' then
    raise exception 'แผนนี้ส่งให้ Bay แล้ว แก้ไม่ได้จนกว่าจะอนุมัติหรือตีกลับ';
  end if;
  if p.status = 'อนุมัติแล้ว' and current_setting('content.plan_fn', true) is distinct from 'on' then
    raise exception 'แผนอนุมัติแล้ว · เพิ่มหรือตัดชิ้นผ่านปุ่มในหน้าแผน (ระบบจะบันทึกแจ้ง Bay)';
  end if;
  if new.planned_on < p.month or new.planned_on >= (p.month + interval '1 month')::date then
    raise exception 'วันลงต้องอยู่ในเดือนของแผน';
  end if;
  if new.format not in ('ข้อความล้วน', 'ภาพเดี่ยว', 'อัลบั้มภาพ') then
    raise exception 'แผนเฟส 1 มีแค่ ข้อความล้วน · ภาพเดี่ยว · อัลบั้มภาพ';
  end if;
  if cardinality(new.channels) = 0 or not (new.channels <@ array['facebook', 'instagram', 'website']) then
    raise exception 'เลือกช่องทาง Facebook · Instagram · บล็อก อย่างน้อย 1 ช่อง';
  end if;
  if new.format = 'ข้อความล้วน' and 'instagram' = any(new.channels) then
    raise exception 'ข้อความล้วนลง Instagram ไม่ได้ เพราะ IG ต้องมีภาพ';
  end if;
  if new.pillar_id is not null and (select brand_id from content.pillars where id = new.pillar_id) is distinct from p.brand_id then
    raise exception 'pillar นี้เป็นของแบรนด์อื่น';
  end if;
  if new.theme_id is not null and (select brand_id from content.themes where id = new.theme_id) is distinct from p.brand_id then
    raise exception 'ธีมนี้เป็นของแบรนด์อื่น';
  end if;
  return new;
end;
$$;
create trigger check_slot_rules before insert or update on content.plan_slots
  for each row execute function content.check_slot_rules();

-- ---------------------------------------------------------------------------
-- สร้างการ์ดจากช่องในแผน · ใช้ตอนอนุมัติ และตอนเพิ่มชิ้นหลังอนุมัติ
-- ---------------------------------------------------------------------------
create or replace function content.slot_to_item(s content.plan_slots, p content.plans)
returns uuid
language plpgsql
set search_path = content, public
as $$
declare v_item uuid;
begin
  insert into content.items (title, format, brand_id, hook, key_message, visual, pillar_id, theme_id,
                             campaign_id, owner_id, off_plan, stage, created_by)
  values (coalesce(nullif(trim(s.hook), ''), 'ชิ้นในแผน ' || to_char(s.planned_on, 'DD/MM')), s.format, p.brand_id,
          s.hook, s.key_message, s.visual, s.pillar_id, s.theme_id, s.campaign_id, s.owner_id, false, 'ไอเดีย',
          coalesce(p.created_by, auth.uid()))
  returning id into v_item;
  insert into content.placements (item_id, channel_id, planned_on)
  select v_item, c, s.planned_on from unnest(s.channels) c;
  insert into content.item_models (item_id, product_id)
  select v_item, x from unnest(s.product_ids) x;
  return v_item;
end;
$$;

-- ส่งแผน (Q-14) · ต้องมีอย่างน้อย 1 ชิ้น
create or replace function content.submit_plan(p_plan_id uuid)
returns content.plans
language plpgsql security definer
set search_path = core, content, public
as $$
declare p content.plans;
begin
  if not (core.has_capability('marketing.write') or core.has_capability('admin')) then
    raise exception 'ต้องมีสิทธิ์ marketing.write จึงจะส่งแผนได้' using errcode = 'insufficient_privilege';
  end if;
  select * into p from content.plans where id = p_plan_id for update;
  if not found then raise exception 'ไม่พบแผน'; end if;
  if p.status not in ('ร่าง', 'ตีกลับ') then raise exception 'แผนนี้อยู่ขั้น "%" แล้ว', p.status; end if;
  if not exists (select 1 from content.plan_slots where plan_id = p_plan_id and removed_at is null) then
    raise exception 'แผนยังไม่มีชิ้นงาน';
  end if;
  update content.plans set status = 'รออนุมัติ', submitted_at = now(), submitted_by = auth.uid(), review_note = null
   where id = p_plan_id returning * into p;
  return p;
end;
$$;

-- อนุมัติทั้งแผน (Q-14 Q-16) · ทุกช่องกลายเป็นการ์ดไอเดีย
create or replace function content.approve_plan(p_plan_id uuid, p_note text default null)
returns int
language plpgsql security definer
set search_path = core, content, public
as $$
declare p content.plans; s content.plan_slots; n int := 0;
begin
  if not (core.has_capability('content.approve') or core.has_capability('admin')) then
    raise exception 'อนุมัติแผนได้เฉพาะ Bay หรือคนที่มีสิทธิ์ content.approve' using errcode = 'insufficient_privilege';
  end if;
  select * into p from content.plans where id = p_plan_id for update;
  if not found then raise exception 'ไม่พบแผน'; end if;
  if p.status <> 'รออนุมัติ' then raise exception 'แผนนี้ยังไม่ได้ส่ง หรืออนุมัติไปแล้ว'; end if;

  update content.plans set status = 'อนุมัติแล้ว', approved_at = now(), approved_by = auth.uid(), review_note = p_note
   where id = p_plan_id returning * into p;
  perform set_config('content.plan_fn', 'on', true);
  for s in select * from content.plan_slots where plan_id = p_plan_id and removed_at is null and item_id is null order by planned_on loop
    update content.plan_slots set item_id = content.slot_to_item(s, p) where id = s.id;
    n := n + 1;
  end loop;
  perform set_config('content.plan_fn', 'off', true);
  return n;
end;
$$;

create or replace function content.bounce_plan(p_plan_id uuid, p_note text)
returns content.plans
language plpgsql security definer
set search_path = core, content, public
as $$
declare p content.plans;
begin
  if not (core.has_capability('content.approve') or core.has_capability('admin')) then
    raise exception 'ตีกลับแผนได้เฉพาะ Bay หรือคนที่มีสิทธิ์ content.approve' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'บอกเหตุผลที่ตีกลับ ทีมจะได้รู้ว่าต้องแก้อะไร'; end if;
  update content.plans set status = 'ตีกลับ', review_note = trim(p_note)
   where id = p_plan_id and status = 'รออนุมัติ' returning * into p;
  if not found then raise exception 'แผนนี้ไม่ได้รออนุมัติอยู่'; end if;
  return p;
end;
$$;

-- เพิ่มชิ้นหลังอนุมัติ (Q-17) · สร้างการ์ดทันที + บันทึกแจ้ง Bay
create or replace function content.add_slot_after_approval(p_plan_id uuid, p_slot jsonb)
returns uuid
language plpgsql security definer
set search_path = core, content, public
as $$
declare p content.plans; s content.plan_slots;
begin
  if not (core.has_capability('marketing.write') or core.has_capability('admin')) then
    raise exception 'ต้องมีสิทธิ์ marketing.write' using errcode = 'insufficient_privilege';
  end if;
  select * into p from content.plans where id = p_plan_id;
  if p.status <> 'อนุมัติแล้ว' then raise exception 'แผนนี้ยังไม่อนุมัติ · เพิ่มชิ้นได้ตามปกติ'; end if;
  perform set_config('content.plan_fn', 'on', true);
  insert into content.plan_slots (plan_id, planned_on, format, channels, hook, key_message, visual,
                                  pillar_id, theme_id, campaign_id, owner_id, product_ids)
  values (p_plan_id, (p_slot->>'planned_on')::date, coalesce((p_slot->>'format')::content.format, 'ภาพเดี่ยว'),
          coalesce(array(select jsonb_array_elements_text(p_slot->'channels')), '{facebook}'),
          nullif(p_slot->>'hook', ''), nullif(p_slot->>'key_message', ''), nullif(p_slot->>'visual', ''),
          nullif(p_slot->>'pillar_id', '')::uuid, nullif(p_slot->>'theme_id', '')::uuid,
          nullif(p_slot->>'campaign_id', '')::uuid, nullif(p_slot->>'owner_id', '')::uuid,
          coalesce(array(select jsonb_array_elements_text(p_slot->'product_ids'))::uuid[], '{}'))
  returning * into s;
  update content.plan_slots set item_id = content.slot_to_item(s, p) where id = s.id;
  perform set_config('content.plan_fn', 'off', true);
  insert into content.plan_changes (plan_id, slot_id, kind, summary)
  values (p_plan_id, s.id, 'เพิ่ม', to_char(s.planned_on, 'DD/MM') || ' · ' || coalesce(s.hook, 'ไม่มี hook'));
  return s.id;
end;
$$;

-- ตัดชิ้น · ก่อนอนุมัติ = ตัดออกจากร่าง · หลังอนุมัติ = การ์ดพับไว้ + บันทึกแจ้ง Bay (Q-17)
create or replace function content.remove_slot(p_slot_id uuid, p_reason text default null)
returns void
language plpgsql security definer
set search_path = core, content, public
as $$
declare s content.plan_slots; p content.plans;
begin
  if not (core.has_capability('marketing.write') or core.has_capability('admin')) then
    raise exception 'ต้องมีสิทธิ์ marketing.write' using errcode = 'insufficient_privilege';
  end if;
  select * into s from content.plan_slots where id = p_slot_id and removed_at is null;
  if not found then raise exception 'ไม่พบชิ้นนี้ในแผน'; end if;
  select * into p from content.plans where id = s.plan_id;
  perform set_config('content.plan_fn', 'on', true);
  update content.plan_slots set removed_at = now() where id = p_slot_id;
  perform set_config('content.plan_fn', 'off', true);
  if p.status = 'อนุมัติแล้ว' then
    if s.item_id is not null then
      update content.items set stage = 'พับไว้'
       where id = s.item_id and stage in ('ไอเดีย', 'กำลังทำ', 'ตีกลับแก้');
    end if;
    insert into content.plan_changes (plan_id, slot_id, kind, summary)
    values (p.id, s.id, 'ตัด', to_char(s.planned_on, 'DD/MM') || ' · ' || coalesce(s.hook, 'ไม่มี hook')
            || coalesce(' · ' || nullif(trim(p_reason), ''), ''));
  end if;
end;
$$;

-- Bay เห็นแล้ว
create or replace function content.mark_plan_changes_seen(p_plan_id uuid)
returns void
language sql security definer
set search_path = core, content, public
as $$
  update content.plan_changes set seen_at = now()
   where plan_id = p_plan_id and seen_at is null
     and (core.has_capability('content.approve') or core.has_capability('admin'));
$$;

-- ---------------------------------------------------------------------------
-- ★ Brand Kit (Q-70) + ตัวอย่างใช่/ไม่ใช่ (Q-71)
-- น้ำเสียงอยู่ใน brand model แล้ว (brand_sections) · หน้า Brand Kit ดึงมาแสดง
-- ---------------------------------------------------------------------------
create table content.brand_kits (
  brand_id    uuid primary key references catalog.brands(id),
  logo_url    text,
  fonts       text,
  colors      jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references core.app_users(id)
);
comment on column content.brand_kits.colors is '[{"name":"น้ำตาลไม้","hex":"#6b5b4a"}]';

create table content.brand_examples (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references catalog.brands(id),
  kind        text not null check (kind in ('ใช่', 'ไม่ใช่')),
  item_id     uuid references content.items(id),
  url         text,
  note        text not null check (trim(note) <> ''),
  removed_at  timestamptz,
  created_by  uuid references core.app_users(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references core.app_users(id),
  check (item_id is not null or url is not null)
);
comment on table content.brand_examples is 'ตัวอย่างที่ใช่/ไม่ใช่ · หยิบจากงานที่ผ่านหรือโดนตีกลับ หรือแปะลิงก์ · agent อ่านเป็นส่วนหนึ่งของ brand book';

-- สีแคมเปญ (K6) · ปฏิทินสีตามแคมเปญ
alter table marketing.campaigns add column color text check (color ~ '^#[0-9a-fA-F]{6}$');

-- ---------------------------------------------------------------------------
-- ★ เส้นทาง agent (Q-08) · ประเภท × ช่องทาง → agent ตัวไหน · เฟส 1 มีตัวเดียว
-- ---------------------------------------------------------------------------
create table content.agent_routes (
  format      content.format not null,
  channel_id  text not null references marketing.channels(id),
  agent       text not null default 'Content agent' check (agent in ('Content agent', 'คนทำเอง')),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references core.app_users(id),
  created_at  timestamptz not null default now(),
  primary key (format, channel_id)
);
comment on table content.agent_routes is 'งานประเภทไหน ช่องทางไหน ส่งให้ใคร · "คนทำเอง" = agent ไม่เขียนช่องนั้น';
insert into content.agent_routes (format, channel_id)
select f::content.format, c from unnest(array['ข้อความล้วน', 'ภาพเดี่ยว', 'อัลบั้มภาพ']) f,
       unnest(array['facebook', 'instagram', 'website']) c
 where not (f = 'ข้อความล้วน' and c = 'instagram');

-- ---------------------------------------------------------------------------
-- กฎเหล็ก + RLS
-- ---------------------------------------------------------------------------
select core.apply_standard_rules('content.theme_weeks');
select core.apply_standard_rules('content.plans');
select core.apply_standard_rules('content.plan_slots');
select core.apply_standard_rules('content.brand_kits');
select core.apply_standard_rules('content.brand_examples');
select core.apply_standard_rules('content.agent_routes');

alter table content.theme_weeks    enable row level security;
alter table content.plans          enable row level security;
alter table content.plan_slots     enable row level security;
alter table content.plan_changes   enable row level security;
alter table content.brand_kits     enable row level security;
alter table content.brand_examples enable row level security;
alter table content.agent_routes   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['theme_weeks', 'plans', 'plan_slots', 'plan_changes', 'brand_kits', 'brand_examples', 'agent_routes'] loop
    execute format(
      'create policy %I on content.%I for select to authenticated using ('
      'core.has_capability(''marketing.write'') or core.has_capability(''design.write'') '
      'or core.has_capability(''content.approve'') or core.has_capability(''admin''))', t || '_select', t);
  end loop;
  -- ทีมการตลาดเขียนหัวข้อสัปดาห์ · ร่างแผน · ช่องในแผน · ตัวอย่างแบรนด์
  foreach t in array array['theme_weeks', 'plan_slots', 'brand_examples'] loop
    execute format(
      'create policy %I on content.%I for all to authenticated '
      'using (core.has_capability(''marketing.write'') or core.has_capability(''admin'')) '
      'with check (core.has_capability(''marketing.write'') or core.has_capability(''admin''))', t || '_write', t);
  end loop;
  -- Brand Kit · เส้นทาง agent = Bay (Q-93)
  foreach t in array array['brand_kits', 'agent_routes'] loop
    execute format(
      'create policy %I on content.%I for all to authenticated '
      'using (core.has_capability(''admin'')) with check (core.has_capability(''admin''))', t || '_write', t);
  end loop;
end $$;

-- แผน: สร้าง/แก้หมายเหตุได้ขณะยังเป็นร่างหรือตีกลับ · เปลี่ยนสถานะผ่านฟังก์ชันเท่านั้น
create policy plans_insert on content.plans for insert to authenticated
  with check (status = 'ร่าง' and (core.has_capability('marketing.write') or core.has_capability('admin')));
create policy plans_update on content.plans for update to authenticated
  using (status in ('ร่าง', 'ตีกลับ') and (core.has_capability('marketing.write') or core.has_capability('admin')))
  with check (status in ('ร่าง', 'ตีกลับ'));

grant select, insert, update on content.theme_weeks, content.plans, content.plan_slots,
  content.brand_kits, content.brand_examples, content.agent_routes to authenticated;
grant select on content.plan_changes to authenticated;
grant update (color) on marketing.campaigns to authenticated;

revoke all on function content.check_slot_rules()                        from public, anon, authenticated;
revoke all on function content.slot_to_item(content.plan_slots, content.plans) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['content.submit_plan(uuid)', 'content.approve_plan(uuid, text)', 'content.bounce_plan(uuid, text)',
                           'content.add_slot_after_approval(uuid, jsonb)', 'content.remove_slot(uuid, text)',
                           'content.mark_plan_changes_seen(uuid)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

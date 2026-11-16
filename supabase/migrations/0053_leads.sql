-- ============================================================================
-- 0053 · โมดูลคนสนใจ (leads) · ด่าน 4 ของจริง
-- ============================================================================
-- ที่มา: docs/modules/leads/1-workflow.md · 2-requirements.md · mockup.html
--        docs/decisions-log.md หัวข้อ O (2026-11-16): เป้า = พาคนที่ทักแชทมาโชว์รูม
--
-- ขั้น:  ใหม่ → ตอบแล้ว → เสนอราคาแล้ว → นัดแล้ว → มาโชว์รูม → ซื้อ / หาย
--
-- กฎที่ไฟล์นี้บังคับในฐานข้อมูล (ไม่ใช่แค่เขียนไว้)
--   LD-5   ห้ามลบ (A7) · แถวที่สร้างผิด/ทดสอบ = ติ๊ก "ไม่นับ"
--   LD-6   ลูกค้าที่หายแล้วทักกลับมา = เปิดแถวเดิม ไม่สร้างแถวซ้ำ
--   LD-10  LINE: 1 รหัสผู้ใช้ = 1 แถว · webhook ซ้ำไม่สร้างแถวซ้ำ ไม่ทับข้อความใหม่ด้วยของเก่า
--   LD-21  ป้ายที่คนตั้งแล้ว ระบบไม่ทับ
--   LD-23  ขั้นเปลี่ยนผ่านประตูเท่านั้น · เก็บประวัติว่าใครกด เมื่อไหร่
--   LD-27  ไม่มีต้นทุน/กำไร · ไม่อ้าง schema cost เลย
--   LD-48  ปิดเป็น ซื้อ ต้องมี "ที่มา" · ปิดเป็น หาย ต้องมี "เหตุผล" (check constraint)
--   LD-59  ตัวเลขสรุปคำนวณสดจากแถวและประวัติ · ไม่มีช่องเก็บตัวเลข (A10)
--   LD-64  เก็บข้อความล่าสุดของลูกค้าแค่ 1 ข้อความ ตัดที่ 200 ตัวอักษร · ไม่เก็บบทสนทนา
--   LD-76  webhook (service_role) เรียกได้ฟังก์ชันเดียว · อ่านตารางไม่ได้
--
-- สิทธิ์: อ่าน = sales.write หรือ cs.write หรือ admin · เขียนผ่านประตู (ฟังก์ชัน) เท่านั้น
--         authenticated ไม่มีสิทธิ์ insert/update ตารางตรงๆ · anon ไม่ได้อะไรเลย
--
-- ★ ตารางนี้ "ไม่ติด" core.write_audit โดยตั้งใจ
--   audit_log เก็บแถวก่อน/หลังทุกครั้งที่แก้ → ข้อความลูกค้าที่ถูกทับจะค้างอยู่ในนั้นทุกข้อความ
--   เท่ากับเก็บบทสนทนา ซึ่งขัด LD-64 · ประวัติว่าใครทำอะไรอยู่ที่ leads.lead_events แทน (ไม่มีข้อความลูกค้า)
-- ============================================================================

create schema if not exists leads;

create type leads.channel       as enum ('LINE', 'Messenger', 'Instagram', 'โชว์รูม', 'โทรศัพท์');
create type leads.stage         as enum ('ใหม่', 'ตอบแล้ว', 'เสนอราคาแล้ว', 'นัดแล้ว', 'มาโชว์รูม', 'ซื้อ', 'หาย');
create type leads.topic         as enum ('ถามราคา', 'ขอโบรชัวร์', 'นัดโชว์รูม', 'หลังการขาย', 'งานโครงการ');
create type leads.product_group as enum ('โซฟา', 'เตียง', 'เก้าอี้', 'ตู้และโต๊ะ', 'สั่งทำพิเศษ');
create type leads.readiness     as enum ('ร้อน', 'อุ่น', 'เย็น');
create type leads.lost_reason   as enum ('ราคา', 'รอนาน', 'ยังไม่ถึงเวลา', 'เลือกเจ้าอื่น', 'ติดต่อไม่ได้');
create type leads.order_source  as enum
  ('LINE', 'Messenger', 'Instagram', 'โชว์รูม', 'โทรศัพท์', 'ลูกค้าเก่า/แนะนำ', 'อื่นๆ');

-- ---------------------------------------------------------------------------
-- คนสนใจ · 1 คน = 1 แถว
-- ---------------------------------------------------------------------------
create table leads.leads (
  id                    uuid primary key default gen_random_uuid(),
  channel               leads.channel not null,
  display_name          text not null check (btrim(display_name) <> '' and char_length(display_name) <= 120),
  channel_user_id       text check (channel_user_id is null or btrim(channel_user_id) <> ''),

  last_message          text check (char_length(last_message) <= 200),      -- LD-64
  last_message_at       timestamptz,
  awaiting_reply_since  timestamptz,           -- ลูกค้าทักแล้วยังไม่มีใครกด "ตอบแล้ว" ตั้งแต่เมื่อไหร่
  last_contact_at       timestamptz not null default now(),

  topic                 leads.topic,
  topic_suggested       boolean not null default false,   -- true = ระบบเสนอ รอคนยืนยัน
  product               leads.product_group,
  product_suggested     boolean not null default false,
  readiness             leads.readiness not null default 'เย็น',
  readiness_suggested   boolean not null default true,

  stage                 leads.stage not null default 'ใหม่',
  stage_before_close    leads.stage,           -- ใช้ตอนเปิดรายการเดิม
  need_by               text check (char_length(need_by) <= 200),           -- คำตอบของ "ต้องการใช้ช่วงไหน"

  next_action_on        date,
  next_action_note      text check (char_length(next_action_note) <= 200),
  appointment_on        date,
  appointment_time      time,
  appointment_confirmed_at timestamptz,        -- ส่งข้อความยืนยันนัดแล้วเมื่อไหร่

  followup_count        int not null default 0 check (followup_count >= 0),
  last_followup_at      timestamptz,
  first_reply_at        timestamptz,           -- กด "ตอบแล้ว" ครั้งแรกเมื่อไหร่ (ใช้คิดเวลาตอบครั้งแรก)

  outcome_source        leads.order_source,    -- ที่มาของออเดอร์ (เมื่อซื้อ)
  lost_reason           leads.lost_reason,
  closed_at             timestamptz,

  counted               boolean not null default true,                      -- LD-5

  created_at            timestamptz not null default now(),
  created_by            uuid references core.app_users(id),                 -- null = ระบบรับจาก LINE
  updated_at            timestamptz not null default now(),
  updated_by            uuid references core.app_users(id),

  constraint leads_bought_has_source check ((stage = 'ซื้อ') = (outcome_source is not null)),
  constraint leads_lost_has_reason   check ((stage = 'หาย') = (lost_reason is not null)),
  constraint leads_closed_has_time   check ((stage in ('ซื้อ', 'หาย')) = (closed_at is not null)),
  constraint leads_appointed_has_date check (stage <> 'นัดแล้ว' or appointment_on is not null),
  constraint leads_before_close_open check (stage_before_close is null or stage_before_close not in ('ซื้อ', 'หาย'))
);

-- LD-10 · 1 รหัสผู้ใช้ของช่องทาง = 1 แถว
create unique index leads_channel_user_uq on leads.leads (channel, channel_user_id)
  where channel_user_id is not null;
create index leads_stage_idx on leads.leads (stage, last_contact_at);
create index leads_next_idx  on leads.leads (next_action_on) where stage not in ('ซื้อ', 'หาย');

comment on table leads.leads is
  'คนสนใจ 1 คน = 1 แถว ทุกช่องทาง · เขียนผ่านฟังก์ชัน leads.* เท่านั้น · ห้ามลบ ใช้ counted=false · ไม่มีเบอร์โทร ที่อยู่ ต้นทุน';
comment on column leads.leads.last_message is
  'ข้อความล่าสุดของลูกค้า 1 ข้อความ ตัดที่ 200 ตัวอักษร · ข้อความใหม่ทับของเก่า · ไม่เก็บบทสนทนา (LD-64)';

-- ---------------------------------------------------------------------------
-- ประวัติ · ใครทำอะไร เมื่อไหร่ · ไม่มีข้อความของลูกค้า
-- ---------------------------------------------------------------------------
create table leads.lead_events (
  id          bigint generated always as identity primary key,
  lead_id     uuid not null references leads.leads(id),
  kind        text not null check (kind in
                ('สร้าง', 'ป้าย', 'ขั้น', 'นัด', 'ทำต่อ', 'ทักตาม', 'ปิด', 'เปิดใหม่', 'ไม่นับ')),
  to_stage    leads.stage,                     -- มีค่าเมื่อเหตุการณ์นี้พาแถวไปถึงขั้นนั้น (ใช้นับ "ถึงขั้น")
  note        text not null check (char_length(note) <= 300),
  created_at  timestamptz not null default now(),
  created_by  uuid references core.app_users(id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references core.app_users(id)
);
create index lead_events_lead_idx on leads.lead_events (lead_id, created_at desc);
create index lead_events_time_idx on leads.lead_events (created_at) where to_stage is not null;

comment on table leads.lead_events is
  'ประวัติของคนสนใจ · เพิ่มอย่างเดียว · สรุปรายสัปดาห์นับ "ถึงขั้นไหน" จาก to_stage ของตารางนี้';

select core.apply_standard_rules('leads.leads');
select core.apply_standard_rules('leads.lead_events');

-- ---------------------------------------------------------------------------
-- ตัวช่วย
-- ---------------------------------------------------------------------------
create or replace function leads.today()
returns date language sql stable
as $$ select (now() at time zone 'Asia/Bangkok')::date $$;

create or replace function leads.can_use()
returns boolean language sql stable
set search_path = core, public
as $$
  select core.has_capability('sales.write') or core.has_capability('cs.write') or core.has_capability('admin')
$$;
comment on function leads.can_use() is
  'ด่านของโมดูลคนสนใจ · sales.write หรือ cs.write หรือ admin';

-- ใช้ภายในประตูเท่านั้น (ไม่เปิดให้ใครเรียกตรง)
create or replace function leads._require()
returns void language plpgsql stable
set search_path = leads, core, public
as $$
begin
  if not leads.can_use() then
    raise exception 'ต้องมีสิทธิ์ sales.write หรือ cs.write จึงจะใช้รายการคนสนใจได้'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

create or replace function leads._log(p_lead uuid, p_kind text, p_to leads.stage, p_note text)
returns void language sql
set search_path = leads, public
as $$
  insert into leads.lead_events (lead_id, kind, to_stage, note, created_by)
  values (p_lead, p_kind, p_to, left(p_note, 300), auth.uid());
$$;

-- ดึงแถวมาล็อกไว้ · p_must_be_open = true แล้วแถวปิดอยู่ = error
create or replace function leads._lock(p_lead uuid, p_must_be_open boolean default true)
returns leads.leads language plpgsql
set search_path = leads, public
as $$
declare l leads.leads;
begin
  select * into l from leads.leads where id = p_lead for update;
  if not found then raise exception 'ไม่พบรายการคนสนใจนี้'; end if;
  if p_must_be_open and l.stage in ('ซื้อ', 'หาย') then
    raise exception 'รายการนี้ปิดเป็น % แล้ว · ถ้าจะทำต่อให้กดเปิดรายการเดิมก่อน', l.stage;
  end if;
  return l;
end;
$$;

-- ตัดข้อความให้เหลือบรรทัดเดียว ไม่เกิน 200 ตัวอักษร (LD-64)
create or replace function leads._snippet(p text)
returns text language sql immutable
as $$ select nullif(left(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), 200), '') $$;

-- ---------------------------------------------------------------------------
-- ประตู 1 · บันทึกคนสนใจด้วยมือ (Messenger · Instagram · โชว์รูม · โทรศัพท์ · LINE ก่อนต่อ webhook)
-- ---------------------------------------------------------------------------
create or replace function leads.create_lead(
  p_channel      leads.channel,
  p_display_name text,
  p_topic        leads.topic default null,
  p_message      text default null
) returns uuid
language plpgsql security definer
set search_path = leads, core, public
as $$
declare v_id uuid; v_name text := btrim(coalesce(p_display_name, ''));
begin
  perform leads._require();
  if p_channel is null then raise exception 'ต้องเลือกช่องทาง'; end if;
  if v_name = '' then raise exception 'ใส่ชื่อที่เห็นในแชทก่อน'; end if;

  insert into leads.leads (channel, display_name, topic, topic_suggested,
                           last_message, last_message_at, awaiting_reply_since, created_by)
  values (p_channel, left(v_name, 120), p_topic, false,
          leads._snippet(p_message), now(), now(), auth.uid())
  returning id into v_id;

  perform leads._log(v_id, 'สร้าง', 'ใหม่', 'พนักงานกดบันทึกคนสนใจ จาก ' || p_channel::text);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- ประตู 2 · รับจาก LINE @chawcher · webhook (service_role) เรียกได้ตัวเดียวนี้
--   - ยังไม่มีแถวของรหัสผู้ใช้นี้ → เปิดแถวใหม่ ขั้น "ใหม่"
--   - มีแล้ว → ทับข้อความล่าสุด + เวลา · ไม่สร้างแถวซ้ำ
--   - ข้อความที่เก่ากว่าหรือเท่ากับที่จดไว้ (webhook ส่งซ้ำ) → ไม่เปลี่ยนอะไร
--   - แถวที่ "หาย" → เปิดแถวเดิมกลับไปขั้นก่อนปิด (LD-6)
--   - ป้ายที่ระบบเสนอ ลงได้เฉพาะช่องที่ยังว่างหรือยังเป็น "ระบบเสนอ" (LD-21)
-- ---------------------------------------------------------------------------
create or replace function leads.upsert_from_line(
  p_user_id      text,
  p_display_name text,
  p_message      text,
  p_at           timestamptz default now(),
  p_topic        leads.topic default null,
  p_product      leads.product_group default null
) returns jsonb
language plpgsql security definer
set search_path = leads, public
as $$
declare
  l       leads.leads;
  v_id    uuid;
  v_uid   text := btrim(coalesce(p_user_id, ''));
  v_name  text := nullif(left(btrim(coalesce(p_display_name, '')), 120), '');
  v_msg   text := leads._snippet(p_message);
  v_at    timestamptz := coalesce(p_at, now());
  v_reopen boolean := false;
begin
  if v_uid = '' then raise exception 'ไม่มีรหัสผู้ใช้ LINE'; end if;

  insert into leads.leads (channel, channel_user_id, display_name, last_message, last_message_at,
                           awaiting_reply_since, last_contact_at,
                           topic, topic_suggested, product, product_suggested)
  values ('LINE', v_uid, coalesce(v_name, 'ลูกค้า LINE'), v_msg, v_at,
          now(), now(),
          p_topic, p_topic is not null, p_product, p_product is not null)
  on conflict (channel, channel_user_id) where channel_user_id is not null do nothing
  returning id into v_id;

  if v_id is not null then
    perform leads._log(v_id, 'สร้าง', 'ใหม่', 'ทักมาทาง LINE ระบบเปิดรายการให้เอง');
    return jsonb_build_object('id', v_id, 'created', true, 'reopened', false, 'changed', true);
  end if;

  select * into l from leads.leads where channel = 'LINE' and channel_user_id = v_uid for update;

  -- webhook ส่งซ้ำ หรือมาถึงสลับลำดับ · ไม่ทับของใหม่ด้วยของเก่า
  if l.last_message_at is not null and v_at <= l.last_message_at then
    return jsonb_build_object('id', l.id, 'created', false, 'reopened', false, 'changed', false);
  end if;

  v_reopen := l.stage = 'หาย';

  update leads.leads set
    display_name         = coalesce(v_name, display_name),
    last_message         = v_msg,
    last_message_at      = v_at,
    last_contact_at      = now(),
    awaiting_reply_since = case when l.stage = 'ซื้อ' then awaiting_reply_since
                                else coalesce(awaiting_reply_since, now()) end,
    topic                = case when p_topic is not null and (topic is null or topic_suggested) then p_topic else topic end,
    topic_suggested      = case when p_topic is not null and (topic is null or topic_suggested) then true else topic_suggested end,
    product              = case when p_product is not null and (product is null or product_suggested) then p_product else product end,
    product_suggested    = case when p_product is not null and (product is null or product_suggested) then true else product_suggested end,
    stage                = case when v_reopen then coalesce(stage_before_close, 'ตอบแล้ว') else stage end,
    stage_before_close   = case when v_reopen then null else stage_before_close end,
    lost_reason          = case when v_reopen then null else lost_reason end,
    closed_at            = case when v_reopen then null else closed_at end,
    followup_count       = case when v_reopen then 0 else followup_count end,
    next_action_on       = case when v_reopen then leads.today() else next_action_on end,
    next_action_note     = case when v_reopen then 'ลูกค้าทักกลับมา ตอบต่อ' else next_action_note end
  where id = l.id;

  if v_reopen then
    perform leads._log(l.id, 'เปิดใหม่', null, 'ลูกค้าทักกลับมาทาง LINE ระบบเปิดรายการเดิม');
  end if;
  return jsonb_build_object('id', l.id, 'created', false, 'reopened', v_reopen, 'changed', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- ประตู 3 · ป้าย · ช่องที่ส่ง null = ไม่แตะ · p_confirm = ยืนยันป้ายที่ระบบเสนอทั้งหมด
-- ---------------------------------------------------------------------------
create or replace function leads.set_tags(
  p_lead      uuid,
  p_topic     leads.topic default null,
  p_product   leads.product_group default null,
  p_readiness leads.readiness default null,
  p_confirm   boolean default false
) returns void
language plpgsql security definer
set search_path = leads, core, public
as $$
declare l leads.leads; v_note text;
begin
  perform leads._require();
  l := leads._lock(p_lead, false);

  update leads.leads set
    topic               = coalesce(p_topic, topic),
    topic_suggested     = case when p_topic is not null or p_confirm then false else topic_suggested end,
    product             = coalesce(p_product, product),
    product_suggested   = case when p_product is not null or p_confirm then false else product_suggested end,
    readiness           = coalesce(p_readiness, readiness),
    readiness_suggested = case when p_readiness is not null or p_confirm then false else readiness_suggested end
  where id = p_lead;

  v_note := concat_ws(' · ',
    case when p_topic is not null then 'เรื่อง ' || p_topic::text end,
    case when p_product is not null then 'สินค้า ' || p_product::text end,
    case when p_readiness is not null then 'ความพร้อม ' || p_readiness::text end);
  perform leads._log(p_lead, 'ป้าย', null,
    case when v_note <> '' then 'ตั้งป้าย ' || v_note else 'ยืนยันป้ายที่ระบบเสนอ' end);
end;
$$;

-- คำตอบของคำถามคัดกรอง "ต้องการใช้ช่วงไหน" · ระบบเสนอความพร้อมตามตัวเลือกที่กด
create or replace function leads.set_need_by(
  p_lead      uuid,
  p_need_by   text,
  p_readiness leads.readiness default null
) returns void
language plpgsql security definer
set search_path = leads, core, public
as $$
declare l leads.leads;
begin
  perform leads._require();
  l := leads._lock(p_lead, false);
  update leads.leads set
    need_by             = leads._snippet(p_need_by),
    readiness           = coalesce(p_readiness, readiness),
    readiness_suggested = case when p_readiness is not null and p_readiness <> l.readiness then true
                               else readiness_suggested end
  where id = p_lead;
  perform leads._log(p_lead, 'ป้าย', null, 'จดคำตอบ ต้องการใช้ช่วงไหน' ||
    case when p_readiness is not null and p_readiness <> l.readiness
         then ' · ระบบเสนอความพร้อม ' || p_readiness::text else '' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- ประตู 4 · ขั้น (เฉพาะ 5 ขั้นที่ยังเปิดอยู่ · ซื้อ/หาย ใช้ประตูปิด)
-- ---------------------------------------------------------------------------
create or replace function leads.set_stage(
  p_lead             uuid,
  p_stage            leads.stage,
  p_appointment_on   date default null,
  p_appointment_time time default null
) returns void
language plpgsql security definer
set search_path = leads, core, public
as $$
declare
  l      leads.leads;
  d      date := leads.today();
  v_appt date;
begin
  perform leads._require();
  if p_stage is null then raise exception 'ต้องเลือกขั้น'; end if;
  if p_stage in ('ซื้อ', 'หาย') then
    raise exception 'ปิดเป็น % ต้องกดที่ "ผลสุดท้าย" (ซื้อต้องมีที่มา · หายต้องมีเหตุผล)', p_stage;
  end if;
  l := leads._lock(p_lead);
  if l.stage = p_stage then return; end if;

  if p_stage = 'นัดแล้ว' then
    v_appt := coalesce(p_appointment_on, l.appointment_on);
    if v_appt is null then raise exception 'ต้องใส่วันนัดโชว์รูมก่อน'; end if;
    update leads.leads set
      stage = p_stage,
      appointment_on = v_appt,
      appointment_time = coalesce(p_appointment_time, appointment_time),
      appointment_confirmed_at = case when v_appt is distinct from l.appointment_on then null
                                      else appointment_confirmed_at end,
      next_action_on = greatest(v_appt - 1, d),
      next_action_note = 'ยืนยันนัด',
      readiness = 'ร้อน',
      readiness_suggested = case when l.readiness <> 'ร้อน' then true else readiness_suggested end
    where id = p_lead;
  elsif p_stage = 'ตอบแล้ว' then
    update leads.leads set
      stage = p_stage,
      next_action_on = coalesce(next_action_on, d + 2),
      next_action_note = coalesce(next_action_note, 'ทักตาม')
    where id = p_lead;
  elsif p_stage = 'เสนอราคาแล้ว' then
    update leads.leads set
      stage = p_stage, next_action_on = d + 3, next_action_note = 'ชวนมาโชว์รูม', followup_count = 0
    where id = p_lead;
  elsif p_stage = 'มาโชว์รูม' then
    update leads.leads set
      stage = p_stage, next_action_on = d + 1, next_action_note = 'ถามผลหลังมาโชว์รูม'
    where id = p_lead;
  else
    update leads.leads set stage = p_stage where id = p_lead;
  end if;

  update leads.leads set
    awaiting_reply_since = null,
    last_contact_at = now(),
    first_reply_at = coalesce(first_reply_at, case when p_stage <> 'ใหม่' then now() end)
  where id = p_lead;

  perform leads._log(p_lead, 'ขั้น', p_stage, 'เปลี่ยนขั้นเป็น ' || p_stage::text);
end;
$$;

-- กด "ตอบแล้ว" · ขั้นใหม่ → ตอบแล้ว · ขั้นอื่น = แค่หยุดนับว่าค้างตอบ
create or replace function leads.mark_replied(p_lead uuid)
returns void
language plpgsql security definer
set search_path = leads, core, public
as $$
declare l leads.leads;
begin
  perform leads._require();
  l := leads._lock(p_lead);
  if l.stage = 'ใหม่' then
    perform leads.set_stage(p_lead, 'ตอบแล้ว');
    return;
  end if;
  update leads.leads set awaiting_reply_since = null, last_contact_at = now() where id = p_lead;
  perform leads._log(p_lead, 'ทำต่อ', null, 'ตอบลูกค้าแล้ว');
end;
$$;

-- ---------------------------------------------------------------------------
-- ประตู 5 · วันทำต่อ · นัดโชว์รูม · ทักตามแล้ว
-- ---------------------------------------------------------------------------
create or replace function leads.set_next_action(p_lead uuid, p_on date, p_note text default null)
returns void
language plpgsql security definer
set search_path = leads, core, public
as $$
begin
  perform leads._require();
  perform leads._lock(p_lead);
  update leads.leads set next_action_on = p_on, next_action_note = leads._snippet(p_note) where id = p_lead;
  perform leads._log(p_lead, 'ทำต่อ', null,
    case when p_on is null then 'ล้างวันทำต่อ' else 'ตั้งวันทำต่อ ' || to_char(p_on, 'YYYY-MM-DD') end);
end;
$$;

create or replace function leads.set_appointment(p_lead uuid, p_on date, p_time time default null)
returns void
language plpgsql security definer
set search_path = leads, core, public
as $$
begin
  perform leads._require();
  perform leads._lock(p_lead);
  if p_on is null then raise exception 'ต้องใส่วันนัดโชว์รูม'; end if;
  update leads.leads set
    appointment_on = p_on,
    appointment_time = p_time,
    appointment_confirmed_at = null,
    next_action_on = greatest(p_on - 1, leads.today()),
    next_action_note = 'ยืนยันนัด'
  where id = p_lead;
  perform leads._log(p_lead, 'นัด', null,
    'ตั้งนัดโชว์รูม ' || to_char(p_on, 'YYYY-MM-DD') || coalesce(' ' || to_char(p_time, 'HH24:MI') || ' น.', ''));
end;
$$;

-- กด "ส่งแล้ว" หลังคัดลอกร่างไปส่งเอง · คืนจำนวนครั้งที่ทักตามไปแล้ว
create or replace function leads.mark_followup_sent(p_lead uuid)
returns int
language plpgsql security definer
set search_path = leads, core, public
as $$
declare l leads.leads; n int;
begin
  perform leads._require();
  l := leads._lock(p_lead);
  if l.stage = 'นัดแล้ว' then
    update leads.leads set
      appointment_confirmed_at = now(), next_action_on = null, next_action_note = null, last_contact_at = now()
    where id = p_lead;
    perform leads._log(p_lead, 'ทักตาม', null, 'ส่งข้อความยืนยันนัดแล้ว');
    return l.followup_count;
  end if;
  n := l.followup_count + 1;
  update leads.leads set
    followup_count = n, last_followup_at = now(), last_contact_at = now(),
    next_action_on = leads.today() + 3, next_action_note = 'ทักตามครั้งถัดไป'
  where id = p_lead;
  perform leads._log(p_lead, 'ทักตาม', null, 'ทักตามครั้งที่ ' || n);
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- ประตู 6 · ผลสุดท้าย · เปิดรายการเดิม · ไม่นับ
-- ---------------------------------------------------------------------------
create or replace function leads.close_bought(p_lead uuid, p_source leads.order_source)
returns void
language plpgsql security definer
set search_path = leads, core, public
as $$
declare l leads.leads;
begin
  perform leads._require();
  if p_source is null then raise exception 'ปิดเป็น ซื้อ ต้องเลือกที่มาของออเดอร์'; end if;
  l := leads._lock(p_lead);
  update leads.leads set
    stage = 'ซื้อ', stage_before_close = l.stage, outcome_source = p_source, closed_at = now(),
    next_action_on = null, next_action_note = null, awaiting_reply_since = null, last_contact_at = now(),
    first_reply_at = coalesce(first_reply_at, now())
  where id = p_lead;
  perform leads._log(p_lead, 'ปิด', 'ซื้อ', 'ปิดเป็น ซื้อ · ที่มา ' || p_source::text);
end;
$$;

create or replace function leads.close_lost(p_lead uuid, p_reason leads.lost_reason)
returns void
language plpgsql security definer
set search_path = leads, core, public
as $$
declare l leads.leads;
begin
  perform leads._require();
  if p_reason is null then raise exception 'ปิดเป็น หาย ต้องเลือกเหตุผล 1 ข้อ'; end if;
  l := leads._lock(p_lead);
  update leads.leads set
    stage = 'หาย', stage_before_close = l.stage, lost_reason = p_reason, closed_at = now(),
    next_action_on = null, next_action_note = null, awaiting_reply_since = null
  where id = p_lead;
  perform leads._log(p_lead, 'ปิด', 'หาย', 'ปิดเป็น หาย · เหตุผล ' || p_reason::text);
end;
$$;

create or replace function leads.reopen(p_lead uuid)
returns void
language plpgsql security definer
set search_path = leads, core, public
as $$
declare l leads.leads; v_stage leads.stage;
begin
  perform leads._require();
  l := leads._lock(p_lead, false);
  if l.stage not in ('ซื้อ', 'หาย') then raise exception 'รายการนี้ยังเปิดอยู่'; end if;
  v_stage := coalesce(l.stage_before_close, case when l.stage = 'ซื้อ' then 'มาโชว์รูม' else 'ตอบแล้ว' end::leads.stage);
  update leads.leads set
    stage = v_stage, stage_before_close = null,
    outcome_source = null, lost_reason = null, closed_at = null,
    followup_count = 0, last_contact_at = now(),
    next_action_on = leads.today(),
    next_action_note = case when l.stage = 'หาย' then 'ลูกค้าทักกลับมา ตอบต่อ' end
  where id = p_lead;
  perform leads._log(p_lead, 'เปิดใหม่', null,
    case when l.stage = 'หาย' then 'ลูกค้าทักกลับมา เปิดรายการเดิม' else 'ย้อนกลับจาก ซื้อ' end);
end;
$$;

create or replace function leads.set_counted(p_lead uuid, p_counted boolean)
returns void
language plpgsql security definer
set search_path = leads, core, public
as $$
begin
  perform leads._require();
  perform leads._lock(p_lead, false);
  update leads.leads set counted = coalesce(p_counted, true) where id = p_lead;
  perform leads._log(p_lead, 'ไม่นับ', null,
    case when coalesce(p_counted, true) then 'กลับมานับรายการนี้' else 'ไม่นับรายการนี้ (สร้างผิดหรือทดสอบ)' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- หน้า "วันนี้" · 3 รายการ · คำนวณสดทุกครั้งที่เปิด
--   unanswered   ลูกค้าทักแล้วยังไม่มีใครกด "ตอบแล้ว" เกิน 60 นาที
--   appointment  นัดโชว์รูมพรุ่งนี้ ยังไม่ได้ส่งข้อความยืนยัน
--   followup     ถึงวันทำต่อแล้ว (วันนี้หรือเลยมาแล้ว)
-- 1 คนอยู่ได้รายการเดียว ตามลำดับข้างบน
-- ---------------------------------------------------------------------------
create view leads.v_today with (security_invoker = true) as
select
  case
    when l.awaiting_reply_since <= now() - interval '60 minutes' then 'unanswered'
    when l.stage = 'นัดแล้ว' and l.appointment_on = leads.today() + 1
         and l.appointment_confirmed_at is null then 'appointment'
    else 'followup'
  end as bucket,
  case when l.awaiting_reply_since is not null
       then floor(extract(epoch from now() - l.awaiting_reply_since) / 60)::int end as waiting_minutes,
  l.*
from leads.leads l
where l.counted
  and l.stage not in ('ซื้อ', 'หาย')
  and (
    l.awaiting_reply_since <= now() - interval '60 minutes'
    or (l.stage = 'นัดแล้ว' and l.appointment_on = leads.today() + 1 and l.appointment_confirmed_at is null)
    or (l.stage <> 'ใหม่' and l.next_action_on <= leads.today())
  );

comment on view leads.v_today is
  'งานวันนี้ของคนตอบแชท · ค้างตอบเกิน 60 นาที · นัดพรุ่งนี้ที่ยังไม่ยืนยัน · ถึงวันทำต่อ';

-- ---------------------------------------------------------------------------
-- สรุป 7 วัน นับจาก p_from (เวลาไทย) · คำนวณสดจากแถวและประวัติ (LD-59 · A10)
--   new       แถวที่เปิดในช่วงนั้น
--   replied…visited  จำนวนคนที่ "ไปถึง" ขั้นนั้นในช่วงนั้น (จาก lead_events.to_stage)
--   bought / lost    แถวที่ตอนนี้ปิดอยู่ และปิดในช่วงนั้น (กดผิดแล้วเปิดใหม่ = ไม่นับ)
--   เวลาตอบครั้งแรก  เฉพาะแถวที่ LINE เข้าระบบเอง (แถวที่คนกดบันทึกเอง ไม่รู้เวลาที่ลูกค้าทักจริง)
-- ไม่นับแถวที่ติ๊ก "ไม่นับ" · คนไม่มีสิทธิ์เรียกได้ แต่ RLS ทำให้ได้ศูนย์ทุกช่อง
-- ---------------------------------------------------------------------------
create or replace function leads.week_summary(p_from date)
returns jsonb
language sql stable
set search_path = leads, public
as $$
  with r as (
    select (p_from::timestamp at time zone 'Asia/Bangkok')       as t0,
           ((p_from + 7)::timestamp at time zone 'Asia/Bangkok') as t1
  ),
  l as (select * from leads.leads where counted),
  newl as (
    select l.id, l.channel from l, r where l.created_at >= r.t0 and l.created_at < r.t1
  ),
  reached as (
    select distinct e.lead_id, e.to_stage, l.channel
    from leads.lead_events e join l on l.id = e.lead_id, r
    where e.to_stage in ('ตอบแล้ว', 'เสนอราคาแล้ว', 'นัดแล้ว', 'มาโชว์รูม')
      and e.created_at >= r.t0 and e.created_at < r.t1
  ),
  closed as (
    select l.id, l.channel, l.stage, l.lost_reason from l, r
    where l.stage in ('ซื้อ', 'หาย') and l.closed_at >= r.t0 and l.closed_at < r.t1
  ),
  reply as (
    select extract(epoch from l.first_reply_at - l.created_at) / 60 as minutes from l, r
    where l.channel = 'LINE' and l.channel_user_id is not null
      and l.first_reply_at >= r.t0 and l.first_reply_at < r.t1
  )
  select jsonb_build_object(
    'from', p_from,
    'to',   p_from + 6,
    'funnel', jsonb_build_object(
      'new',       (select count(*) from newl),
      'replied',   (select count(*) from reached where to_stage = 'ตอบแล้ว'),
      'quoted',    (select count(*) from reached where to_stage = 'เสนอราคาแล้ว'),
      'appointed', (select count(*) from reached where to_stage = 'นัดแล้ว'),
      'visited',   (select count(*) from reached where to_stage = 'มาโชว์รูม'),
      'bought',    (select count(*) from closed where stage = 'ซื้อ'),
      'lost',      (select count(*) from closed where stage = 'หาย')),
    'channels', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'channel',   c.ch::text,
               'new',       (select count(*) from newl where channel = c.ch),
               'appointed', (select count(*) from reached where channel = c.ch and to_stage = 'นัดแล้ว'),
               'visited',   (select count(*) from reached where channel = c.ch and to_stage = 'มาโชว์รูม'),
               'bought',    (select count(*) from closed where channel = c.ch and stage = 'ซื้อ'))
             order by c.ch), '[]'::jsonb)
      from unnest(enum_range(null::leads.channel)) as c(ch)),
    'lost_reasons', (
      select coalesce(jsonb_agg(jsonb_build_object('reason', x.reason::text, 'n', x.n) order by x.n desc, x.reason), '[]'::jsonb)
      from (select lost_reason as reason, count(*) as n from closed where stage = 'หาย' group by lost_reason) x),
    'first_reply', jsonb_build_object(
      'n',           (select count(*) from reply),
      'avg_minutes', (select round(avg(minutes))::int from reply),
      'slow',        (select count(*) from reply where minutes > 60))
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS · อ่านได้เฉพาะคนที่มีสิทธิ์ · ไม่มี policy เขียน = เขียนตรงไม่ได้ ต้องผ่านประตู
-- ---------------------------------------------------------------------------
alter table leads.leads       enable row level security;
alter table leads.lead_events enable row level security;

create policy leads_read on leads.leads for select to authenticated using (leads.can_use());
create policy lead_events_read on leads.lead_events for select to authenticated using (leads.can_use());

-- ---------------------------------------------------------------------------
-- สิทธิ์ระดับ schema
-- ---------------------------------------------------------------------------
grant usage on schema leads to authenticated, service_role;
revoke all on schema leads from anon;
revoke all on all tables in schema leads from public, anon, authenticated, service_role;
grant select on leads.leads, leads.lead_events, leads.v_today to authenticated;

revoke all on all functions in schema leads from public, anon, authenticated, service_role;
grant execute on function
  leads.today(),
  leads.can_use(),
  leads.create_lead(leads.channel, text, leads.topic, text),
  leads.set_tags(uuid, leads.topic, leads.product_group, leads.readiness, boolean),
  leads.set_need_by(uuid, text, leads.readiness),
  leads.set_stage(uuid, leads.stage, date, time),
  leads.mark_replied(uuid),
  leads.set_next_action(uuid, date, text),
  leads.set_appointment(uuid, date, time),
  leads.mark_followup_sent(uuid),
  leads.close_bought(uuid, leads.order_source),
  leads.close_lost(uuid, leads.lost_reason),
  leads.reopen(uuid),
  leads.set_counted(uuid, boolean),
  leads.week_summary(date)
to authenticated;

-- webhook ของ LINE @chawcher · ฟังก์ชันเดียว ไม่มีสิทธิ์อ่านตาราง (LD-76)
grant execute on function
  leads.upsert_from_line(text, text, text, timestamptz, leads.topic, leads.product_group)
to service_role;

-- ---------------------------------------------------------------------------
-- ทะเบียนโมดูล · เมนู "คนสนใจ" อยู่ถัดจากสต็อก (งานหลักตอนนี้คือพาคนมาโชว์รูม · O5)
-- พึ่งแค่ core (ผู้ใช้ + สิทธิ์) · ยังไม่ผูกลูกค้าหรือออเดอร์
-- ---------------------------------------------------------------------------
update core.modules set sort_order = sort_order + 1 where sort_order between 3 and 11;

insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability,
   home_path, sort_order, is_core, description_th) values
  ('leads', 'คนสนใจ', 'Leads', 'inbox', 'leads',
   '{core}', 'sales.write', '/leads', 3, false,
   'ทุกคนที่ทักมา อยู่ในรายการเดียว · วันนี้ต้องตอบใคร ตามใคร เพื่อชวนมาโชว์รูม');

-- ⚠️ ขาดบรรทัดนี้ = REST API มองไม่เห็น schema leads
-- ★ ค่านี้เขียนทับกันทั้งก้อน ไม่ได้ต่อท้าย · รายการข้างล่าง = ค่าล่าสุดใน repo (0039_costing.sql) + leads
--   ถ้ามี migration อื่นที่เพิ่ม schema และรันไปแล้วบนฐานจริงแต่ไม่อยู่ในรายการนี้ ต้องเติมก่อนวาง
alter role authenticator
  set pgrst.db_schemas = 'public, graphql_public, core, catalog, materials, pricing, cost, marketing, stock, content, crm, sales, line_agent, sheets, pos, production, leads';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

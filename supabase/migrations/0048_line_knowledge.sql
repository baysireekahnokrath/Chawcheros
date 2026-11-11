-- ============================================================================
-- 0048 · Team Bay · คลังความรู้ (Knowledge base) + เก็บบทสนทนา + FAQ สาธารณะ
-- ============================================================================
-- ที่มา: docs/modules/line-agent/7-status.md · Bay ตอบ 2026-11-11
--   ข้อ 1 "ได้"  → เก็บบทสนทนากลุ่ม PO และกลุ่มเช็คงานได้ · แต่ต้องโพสต์แจ้งทีมก่อน (R2)
--   ข้อ 2 "ก"    → FAQ สาธารณะขึ้นที่ chawcher.com (ระบบนี้เป็นแหล่งข้อมูล · เว็บแบรนด์ดึงไปแสดง)
--
-- ทางเดิน
--   ① เก็บ     : ข้อความในกลุ่มที่เปิดเก็บ · "@Team Bay จดเรื่องนี้" · คำถามที่ทักบอท (มีใน requests อยู่แล้ว)
--   ② สรุป     : AI อ่านทุกสัปดาห์ → ร่างคำถาม-คำตอบ แยกหมวด · ทุกข้อแนบหลักฐาน (ข้อความต้นทาง)
--   ③ ยืนยัน   : Bay ตรวจทีละข้อ (R4) · ไม่ยืนยัน = บอทไม่ใช้ · ไม่ขึ้น FAQ
--   ④ ใช้      : บอทตอบจากข้อที่ยืนยัน · FAQ สาธารณะเฉพาะข้อที่ติ๊ก "สาธารณะ" + เขียนใหม่ให้ลูกค้าอ่าน
--
-- กฎที่ไฟล์นี้บังคับในฐานข้อมูล (ไม่ใช่แค่เขียนไว้)
--   R2   ห้องจะเก็บบทสนทนาได้ต้องมีเวลา "โพสต์แจ้งทีมแล้ว" (check constraint)
--   R4   บอท/FAQ ใช้ได้เฉพาะข้อที่ยืนยันแล้ว · แก้เนื้อหาหลังยืนยัน = กลับเป็นร่างเอง
--   LR-11 ข้อความที่บอทใช้ตอบ/ขึ้น FAQ ห้ามมีคำว่า ต้นทุน · กำไร
--   FAQ  ข้อความสาธารณะห้ามมีเลข BLS · เบอร์โทร (กันชื่อ/ข้อมูลลูกค้าหลุด)
--   A7   ห้ามลบ (ทุกตาราง)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ห้อง · เก็บบทสนทนา + ใช้คลังความรู้
-- ---------------------------------------------------------------------------
alter table line_agent.rooms
  add column kb_collect    boolean not null default false,   -- เก็บบทสนทนาห้องนี้
  add column kb_notice_at  timestamptz,                       -- Bay โพสต์แจ้งทีมในห้องแล้วเมื่อไหร่ (R2)
  add column see_kb        boolean not null default false,   -- บอทตอบจากคลังความรู้ในห้องนี้ได้
  add constraint rooms_kb_needs_notice check (not kb_collect or kb_notice_at is not null);

comment on column line_agent.rooms.kb_collect is
  'เก็บทุกข้อความในห้องนี้เข้า chat_log · เปิดได้ต่อเมื่อมี kb_notice_at (Bay โพสต์แจ้งทีมแล้ว · R2)';
comment on column line_agent.rooms.see_kb is
  'บอทตอบคำถามจากคลังความรู้ที่ Bay ยืนยันแล้ว · กลุ่มใหม่ = ปิด เหมือนสิทธิ์อื่น';

update line_agent.rooms set see_kb = true where name ilike '%ทดสอบ%';

-- ---------------------------------------------------------------------------
-- ชื่อสมาชิกที่เคยถามจาก LINE · กันเรียก API ทุกข้อความ
-- ---------------------------------------------------------------------------
create table line_agent.members (
  line_user_id  text primary key,
  display_name  text,
  updated_at    timestamptz not null default now()
);
alter table line_agent.members enable row level security;

-- ---------------------------------------------------------------------------
-- ① บทสนทนาที่เก็บ · เฉพาะข้อความตัวอักษรในห้องที่ Bay เปิดเก็บ · ไม่เก็บรูป/ไฟล์
-- ---------------------------------------------------------------------------
create table line_agent.chat_log (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references line_agent.rooms(id),
  line_message_id  text not null unique,                      -- กันเก็บซ้ำเมื่อ LINE ส่งซ้ำ
  line_user_id     text,
  text             text not null check (btrim(text) <> ''),
  sent_at          timestamptz not null,
  digested_at      timestamptz,                                -- ถูก AI อ่านสรุปแล้วเมื่อไหร่
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references core.app_users(id)
);
create index chat_log_undigested_idx on line_agent.chat_log (sent_at) where digested_at is null;
create index chat_log_room_idx on line_agent.chat_log (room_id, sent_at desc);
comment on table line_agent.chat_log is
  'บทสนทนากลุ่มที่เปิดเก็บ (หลัง Bay โพสต์แจ้งทีม · R2) · เห็นได้เฉพาะ Bay · มีชื่อลูกค้าได้ จึงไม่ขึ้นที่ไหนนอกจากหน้าตรวจของ Bay';

-- ---------------------------------------------------------------------------
-- ③ คลังความรู้ · 1 แถว = 1 เรื่อง (คำถาม-คำตอบ / วิธีทำ / กฎ)
-- ---------------------------------------------------------------------------
create table line_agent.kb_items (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (btrim(title) <> ''),     -- คำถาม/หัวข้อ · ภายในทีม CC
  body          text not null check (btrim(body) <> ''),      -- คำตอบ/วิธีทำ · ภายในทีม CC
  category      text not null default 'ยังไม่จัดหมวด' check (btrim(category) <> ''),
  bls           text,                                         -- ผูกกับงาน (ถ้ามี)
  source        text not null check (source in ('จดเอง', 'สรุปจากแชท', 'คำถามบอท', 'เขียนในเว็บ')),
  source_refs   jsonb not null default '[]'::jsonb,           -- หลักฐานต้นทาง [{kind, id, excerpt}]
  room_id       uuid references line_agent.rooms(id),
  noted_by      text,                                         -- ชื่อ LINE คนที่สั่งจด
  status        text not null default 'ร่าง' check (status in ('ร่าง', 'ยืนยันแล้ว', 'ไม่ใช้')),
  bot_use       boolean not null default false,               -- บอทใช้ตอบในห้อง
  is_public     boolean not null default false,               -- ขึ้น FAQ สาธารณะ
  public_title  text,                                         -- เขียนใหม่ให้ลูกค้าอ่าน
  public_body   text,
  reviewed_by   uuid references core.app_users(id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references core.app_users(id),

  -- R4 · ใช้ได้เฉพาะที่ยืนยัน และต้องรู้ว่าใครยืนยัน
  constraint kb_confirmed_has_reviewer check (status <> 'ยืนยันแล้ว' or (reviewed_by is not null and reviewed_at is not null)),
  constraint kb_bot_needs_confirm check (not bot_use or status = 'ยืนยันแล้ว'),
  constraint kb_public_needs_confirm check (
    not is_public or (status = 'ยืนยันแล้ว'
      and nullif(btrim(public_title), '') is not null and nullif(btrim(public_body), '') is not null)),
  -- LR-11 · ต้นทุน/กำไรไม่เข้าบอทและไม่ขึ้นเว็บ ไม่ว่าใครพิมพ์
  constraint kb_bot_no_cost check (not bot_use or (title || ' ' || body) !~ '(ต้นทุน|กำไร)'),
  constraint kb_public_no_cost check (not is_public or (public_title || ' ' || public_body) !~ '(ต้นทุน|กำไร)'),
  -- FAQ สาธารณะ · ห้ามมีเลข BLS หรือเบอร์โทร (กันข้อมูลลูกค้าหลุดมาจากแชท)
  constraint kb_public_no_customer check (
    not is_public or (public_title || ' ' || public_body) !~* '(bls\s*[0-9]|(^|[^0-9])0[0-9]{1,2}[- .]?[0-9]{3}[- .]?[0-9]{3,4}($|[^0-9]))')
);
create index kb_items_status_idx on line_agent.kb_items (status, created_at desc);
create index kb_items_public_idx on line_agent.kb_items (category) where is_public;

comment on table line_agent.kb_items is
  'คลังความรู้ · AI ร่าง คนยืนยัน (R4 · กฎ AI 2) · บอทใช้เฉพาะ status=ยืนยันแล้ว และ bot_use · FAQ เฉพาะ is_public';

-- แก้เนื้อหาหลังยืนยัน = กลับเป็นร่างเอง (ยกเว้น Bay กดยืนยันใหม่ในคำสั่งเดียว = reviewed_at เปลี่ยน)
create or replace function line_agent.kb_edit_resets()
returns trigger language plpgsql
as $$
begin
  if old.status = 'ยืนยันแล้ว' and new.status = 'ยืนยันแล้ว'
     and new.reviewed_at is not distinct from old.reviewed_at
     and (new.title, new.body, new.category, new.public_title, new.public_body)
         is distinct from (old.title, old.body, old.category, old.public_title, old.public_body) then
    new.status := 'ร่าง'; new.bot_use := false; new.is_public := false;
    new.reviewed_by := null; new.reviewed_at := null;
  end if;
  return new;
end;
$$;
create trigger kb_edit_resets before update on line_agent.kb_items
  for each row execute function line_agent.kb_edit_resets();

-- ---------------------------------------------------------------------------
-- ② รอบสรุปของ AI · 1 แถว = 1 รอบ · ค่า Claude นับรวมในงบผู้ช่วย (LR-20)
-- ---------------------------------------------------------------------------
create table line_agent.kb_digests (
  id                uuid primary key default gen_random_uuid(),
  run_by            text not null check (run_by in ('ตั้งเวลา', 'กดเอง')),
  period_from       timestamptz not null,
  period_to         timestamptz not null,
  messages          int not null default 0,
  requests          int not null default 0,
  items_created     int not null default 0,
  model             text,
  input_tokens      int,
  output_tokens     int,
  usd_per_mtok_in   numeric(8,3),
  usd_per_mtok_out  numeric(8,3),
  thb_per_usd       numeric(8,2),
  error             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references core.app_users(id)
);

select core.apply_standard_rules('line_agent.chat_log');
select core.apply_standard_rules('line_agent.kb_items');
select core.apply_standard_rules('line_agent.kb_digests');
create trigger audit_line_agent_kb_items after insert or update on line_agent.kb_items
  for each row execute function core.write_audit();

-- งบ = คำถามที่ตอบ + รอบสรุปความรู้ (คอลัมน์เดิมครบ · เพิ่มแค่ยอดรอบสรุป)
create or replace view line_agent.v_budget with (security_invoker = true) as
with spent as (
  select
    coalesce((select sum((r.input_tokens * r.usd_per_mtok_in + r.output_tokens * r.usd_per_mtok_out) / 1e6 * r.thb_per_usd)
              from line_agent.requests r
              where (r.created_at at time zone 'Asia/Bangkok') >= date_trunc('month', now() at time zone 'Asia/Bangkok')), 0)
    + coalesce((select sum((d.input_tokens * d.usd_per_mtok_in + d.output_tokens * d.usd_per_mtok_out) / 1e6 * d.thb_per_usd)
                from line_agent.kb_digests d
                where (d.created_at at time zone 'Asia/Bangkok') >= date_trunc('month', now() at time zone 'Asia/Bangkok')), 0) as thb
)
select
  s.model, s.monthly_budget_thb, s.thb_per_usd, s.paused,
  sp.thb::numeric(10,2)                                   as spent_thb,
  (s.monthly_budget_thb - sp.thb)::numeric(10,2)          as remaining_thb,
  (select count(*) from line_agent.requests r
     where r.status in ('ตอบแล้ว','ตอบไม่ได้','ส่งต่อทีม')
       and (r.created_at at time zone 'Asia/Bangkok') >= date_trunc('month', now() at time zone 'Asia/Bangkok')) as answered,
  (select count(*) from line_agent.requests r
     where r.flagged
       and (r.created_at at time zone 'Asia/Bangkok') >= date_trunc('month', now() at time zone 'Asia/Bangkok')) as flagged
from line_agent.settings s cross join spent sp;

-- ---------------------------------------------------------------------------
-- room_state เดิม + สิทธิ์คลังความรู้
-- ---------------------------------------------------------------------------
create or replace function line_agent.room_state(p_group_id text)
returns jsonb
language sql stable security definer
set search_path = line_agent, public
as $$
  select jsonb_build_object(
    'room', (select status::text from line_agent.rooms where group_id = p_group_id),
    'flags', (select jsonb_build_object(
                'see_price', see_price, 'see_customer', see_customer, 'see_money', see_money,
                'see_address', see_address, 'customer_draft', customer_draft, 'draft_polite', draft_polite,
                'can_slip', can_slip, 'can_photo', can_photo, 'see_kb', see_kb)
              from line_agent.rooms where group_id = p_group_id),
    'budget', (select to_jsonb(b) from line_agent.v_budget b))
$$;

-- ---------------------------------------------------------------------------
-- ประตูของ webhook · เก็บข้อความ
-- ---------------------------------------------------------------------------
-- คืน logged=จริงเมื่อเก็บ · need_name=จริงเมื่อยังไม่รู้ชื่อคนนี้ (webhook ไปถาม LINE แล้วเรียก kb_member_name)
-- ห้องที่ไม่อนุมัติ · ไม่ได้เปิดเก็บ · ยังไม่โพสต์แจ้ง · บอทถูกพัก = ไม่เก็บอะไรเลย
create or replace function line_agent.kb_log_message(p jsonb)
returns jsonb
language plpgsql security definer
set search_path = line_agent, public
as $$
declare r line_agent.rooms; n int; u text := nullif(p->>'line_user_id', ''); t text := btrim(coalesce(p->>'text', ''));
begin
  select * into r from line_agent.rooms
   where group_id = p->>'group_id' and status = 'อนุมัติ' and kb_collect and kb_notice_at is not null;
  if r.id is null or t = '' or (select paused from line_agent.settings where id = 1) then
    return jsonb_build_object('logged', false, 'need_name', false);
  end if;
  insert into line_agent.chat_log (room_id, line_message_id, line_user_id, text, sent_at)
  values (r.id, p->>'message_id', u, left(t, 2000), coalesce((p->>'sent_at')::timestamptz, now()))
  on conflict (line_message_id) do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object(
    'logged', n > 0,
    'need_name', u is not null and not exists (
      select 1 from line_agent.members m where m.line_user_id = u and m.updated_at > now() - interval '14 days'));
end;
$$;

create or replace function line_agent.kb_member_name(p_user text, p_name text)
returns void
language sql security definer
set search_path = line_agent, public
as $$
  insert into line_agent.members (line_user_id, display_name) values (p_user, p_name)
  on conflict (line_user_id) do update set display_name = coalesce(excluded.display_name, line_agent.members.display_name), updated_at = now()
$$;

-- "@Team Bay จดเรื่องนี้ …" · ข้อความต่อท้ายคำสั่ง หรือ Reply ข้อความที่เก็บไว้ · ใช้ได้ทุกห้องที่อนุมัติ
create or replace function line_agent.kb_note_add(p jsonb)
returns jsonb
language plpgsql security definer
set search_path = line_agent, public
as $$
declare r line_agent.rooms; t text := btrim(coalesce(p->>'text', '')); q text; v_id uuid; v_bls text; line1 text;
begin
  select * into r from line_agent.rooms where group_id = p->>'group_id' and status = 'อนุมัติ';
  if r.id is null then return jsonb_build_object('ok', false, 'error', 'ห้องนี้ยังไม่อนุมัติ'); end if;

  if t = '' and nullif(p->>'quoted_message_id', '') is not null then
    select c.text into q from line_agent.chat_log c where c.line_message_id = p->>'quoted_message_id';
    if q is null then
      return jsonb_build_object('ok', false, 'error', 'no_quoted');
    end if;
    t := q;
  end if;
  if length(t) < 5 then return jsonb_build_object('ok', false, 'error', 'empty'); end if;

  v_bls := nullif(line_agent.norm_order_no((regexp_match(upper(t), 'BLS\s*([0-9]{3,5}[A-Z]?)'))[1]), '');
  line1 := left(btrim(split_part(t, E'\n', 1)), 80);
  insert into line_agent.kb_items (title, body, bls, source, source_refs, room_id, noted_by)
  values (line1, left(t, 4000), v_bls, 'จดเอง',
          jsonb_build_array(jsonb_build_object('kind', case when q is null then 'พิมพ์ในคำสั่ง' else 'chat' end,
                                               'id', p->>'quoted_message_id', 'excerpt', left(t, 160))),
          r.id, nullif(p->>'display_name', ''))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'title', line1);
end;
$$;

-- บอทค้นคลังความรู้ · เฉพาะข้อที่ยืนยันแล้วและเปิด bot_use · ห้องที่ไม่เปิด see_kb ได้แค่ hidden
-- คำค้นจาก Claude เป็นคำสั้นๆ คั่นช่องว่าง · นับว่าตรงกี่คำ · คืนไม่เกิน 3 ข้อ
create or replace function line_agent.kb_search(p_query text, p_group_id text)
returns jsonb
language plpgsql stable security definer
set search_path = line_agent, public
as $$
declare r line_agent.rooms; terms text[]; out jsonb;
begin
  select * into r from line_agent.rooms where group_id = p_group_id and status = 'อนุมัติ';
  if r.id is null then return null; end if;
  if not r.see_kb then return jsonb_build_object('hidden', true); end if;

  select coalesce(array_agg(t), '{}') into terms from (
    select distinct lower(x) as t from regexp_split_to_table(btrim(coalesce(p_query, '')), '\s+') x
     where length(x) >= 2 limit 5) s;
  if cardinality(terms) = 0 then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'title', title, 'body', body, 'category', category,
           'reviewed_at', reviewed_at, 'public_body', public_body) order by score desc, reviewed_at desc), '[]'::jsonb)
    into out
  from (
    select i.id, i.title, i.body, i.category, i.reviewed_at, i.public_body,
           (select count(*) from unnest(terms) tm
             where lower(i.title || ' ' || i.body || ' ' || i.category)
                   like '%' || replace(replace(replace(tm, '\', '\\'), '%', '\%'), '_', '\_') || '%') as score
    from line_agent.kb_items i
    where i.status = 'ยืนยันแล้ว' and i.bot_use
    order by score desc, i.reviewed_at desc
    limit 3
  ) m
  where score > 0;
  return out;
end;
$$;

-- ---------------------------------------------------------------------------
-- ประตูของรอบสรุป (webhook/cron ใช้) · ชื่อคนในแชทถูกแทนด้วยเลขคน ไม่ส่งชื่อไปให้ AI
-- ---------------------------------------------------------------------------
create or replace function line_agent.kb_digest_input(p_limit int)
returns jsonb
language sql stable security definer
set search_path = line_agent, public
as $$
  select jsonb_build_object(
    'since', coalesce((select max(period_to) from line_agent.kb_digests where error is null), now() - interval '14 days'),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'room', m.room, 'who', m.who, 'at', m.sent_at, 'text', m.text) order by m.sent_at)
      from (
        select c.id, c.text, c.sent_at, rm.name as room,
               'คน' || dense_rank() over (order by coalesce(c.line_user_id, '?')) as who
        from line_agent.chat_log c join line_agent.rooms rm on rm.id = c.room_id
        where c.digested_at is null and rm.kb_collect
        order by c.sent_at limit greatest(p_limit, 1)
      ) m), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question, 'status', q.status::text) order by q.created_at)
      from (
        select r.id, r.question, r.status, r.created_at from line_agent.requests r
        where r.created_at > coalesce((select max(period_to) from line_agent.kb_digests where error is null), now() - interval '14 days')
          and r.status in ('ตอบแล้ว', 'ตอบไม่ได้', 'ส่งต่อทีม')
        order by r.created_at limit 200
      ) q), '[]'::jsonb),
    'budget', (select jsonb_build_object('remaining_thb', b.remaining_thb, 'thb_per_usd', b.thb_per_usd, 'paused', b.paused)
               from line_agent.v_budget b),
    'existing_titles', coalesce((
      select jsonb_agg(title) from (select title from line_agent.kb_items where status <> 'ไม่ใช้' order by created_at desc limit 300) t), '[]'::jsonb)
  )
$$;

-- บันทึกผลรอบสรุป: ร่างใหม่ + ทำเครื่องหมายข้อความที่อ่านแล้ว + ค่า Claude · ในคำสั่งเดียว (ล้มกลางคัน = ถอยหมด)
create or replace function line_agent.kb_digest_save(p jsonb)
returns int
language plpgsql security definer
set search_path = line_agent, public
as $$
declare it jsonb; n int := 0;
begin
  for it in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
    insert into line_agent.kb_items (title, body, category, bls, source, source_refs)
    values (left(it->>'title', 200), left(it->>'body', 4000), coalesce(nullif(btrim(it->>'category'), ''), 'ยังไม่จัดหมวด'),
            nullif(it->>'bls', ''), coalesce(nullif(it->>'source', ''), 'สรุปจากแชท'), coalesce(it->'refs', '[]'::jsonb));
    n := n + 1;
  end loop;
  update line_agent.chat_log set digested_at = now()
   where id in (select (x)::uuid from jsonb_array_elements_text(coalesce(p->'message_ids', '[]'::jsonb)) x);
  insert into line_agent.kb_digests (run_by, period_from, period_to, messages, requests, items_created, model,
                                     input_tokens, output_tokens, usd_per_mtok_in, usd_per_mtok_out, thb_per_usd, error)
  values (coalesce(p->>'run_by', 'ตั้งเวลา'), (p->>'period_from')::timestamptz, (p->>'period_to')::timestamptz,
          coalesce((p->>'messages')::int, 0), coalesce((p->>'requests')::int, 0), n, p->>'model',
          (p->>'input_tokens')::int, (p->>'output_tokens')::int, (p->>'usd_per_mtok_in')::numeric,
          (p->>'usd_per_mtok_out')::numeric, (p->>'thb_per_usd')::numeric, nullif(p->>'error', ''));
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- ④ FAQ สาธารณะ · ใครก็อ่านได้ (chawcher.com ดึงไปแสดง) · คืนเฉพาะข้อที่ Bay ยืนยัน+ติ๊กสาธารณะ
--    คืนแค่ข้อความที่เขียนให้ลูกค้าอ่าน (public_*) · ไม่มีคำตอบภายใน · ไม่มีหลักฐานต้นทาง · ไม่มีชื่อคน
-- ---------------------------------------------------------------------------
create or replace function line_agent.faq_public()
returns jsonb
language sql stable security definer
set search_path = line_agent, public
as $$
  select jsonb_build_object(
    'updated_at', (select max(reviewed_at) from line_agent.kb_items where is_public and status = 'ยืนยันแล้ว'),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'category', i.category, 'q', i.public_title, 'a', i.public_body,
               'updated_at', i.reviewed_at) order by i.category, i.reviewed_at desc)
      from line_agent.kb_items i
      where i.is_public and i.status = 'ยืนยันแล้ว'), '[]'::jsonb))
$$;

-- ---------------------------------------------------------------------------
-- สิทธิ์
-- ---------------------------------------------------------------------------
alter table line_agent.chat_log   enable row level security;
alter table line_agent.kb_items   enable row level security;
alter table line_agent.kb_digests enable row level security;

-- บทสนทนาดิบ = Bay เท่านั้น (มีชื่อลูกค้าได้) · คลังความรู้ที่ตรวจแล้ว ทีมขายอ่านได้ · แก้/ยืนยัน = Bay
create policy chat_read on line_agent.chat_log for select to authenticated
  using (core.has_capability('admin'));
create policy kb_read on line_agent.kb_items for select to authenticated
  using (core.has_capability('admin') or (core.has_capability('sales.write') and status = 'ยืนยันแล้ว'));
create policy kb_write on line_agent.kb_items for insert to authenticated
  with check (core.has_capability('admin'));
create policy kb_update on line_agent.kb_items for update to authenticated
  using (core.has_capability('admin')) with check (core.has_capability('admin'));
create policy digest_read on line_agent.kb_digests for select to authenticated
  using (core.has_capability('admin'));
create policy members_read on line_agent.members for select to authenticated
  using (core.has_capability('admin'));

grant select on line_agent.chat_log, line_agent.kb_digests, line_agent.members to authenticated;
grant select, insert, update on line_agent.kb_items to authenticated;

revoke all on function
  line_agent.kb_edit_resets(), line_agent.kb_log_message(jsonb), line_agent.kb_member_name(text, text),
  line_agent.kb_note_add(jsonb), line_agent.kb_search(text, text), line_agent.kb_digest_input(int),
  line_agent.kb_digest_save(jsonb), line_agent.faq_public()
  from public, anon, authenticated;
grant execute on function
  line_agent.kb_log_message(jsonb), line_agent.kb_member_name(text, text), line_agent.kb_note_add(jsonb),
  line_agent.kb_search(text, text), line_agent.kb_digest_input(int), line_agent.kb_digest_save(jsonb),
  line_agent.faq_public()
  to service_role;

-- FAQ สาธารณะ: อ่านได้ทุกคนผ่านฟังก์ชันนี้ตัวเดียว (ตารางยังปิดสนิท · anon แตะตารางตรงๆ ไม่ได้)
grant usage on schema line_agent to anon;
grant execute on function line_agent.faq_public() to anon, authenticated;

-- ทะเบียนโมดูล · เมนู "คลังความรู้" (Bay เห็น)
insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability, home_path, sort_order, is_core, description_th)
values
  ('knowledge', 'คลังความรู้', 'Knowledge base', 'book', 'line_agent',
   '{core,line_agent}', 'admin', '/knowledge', 91, false,
   'ความรู้ที่เก็บจากกลุ่ม LINE · AI ร่าง Bay ยืนยัน · บอทใช้ตอบ · FAQ สาธารณะ');

notify pgrst, 'reload schema';

-- ============================================================================
-- 0034 · LINE agent ในห้อง CC
-- ============================================================================
-- ที่มา: docs/modules/line-agent/0-idea.md · 2-requirements.md · mockup.html
--
-- หลักที่ไฟล์นี้บังคับ (ไม่ใช่แค่เขียนไว้)
--   LR-11  ห้องที่มี ASE อยู่ด้วย · บอทเห็นได้แค่ "ข้อมูลงานผลิต + สต็อก"
--          → ฟังก์ชัน room_* คืนเฉพาะคอลัมน์ที่ปลอดภัย · ไม่มีราคา ลูกค้า ต้นทุน ชื่อคนยืม
--          → เว็บ (service role) เรียกได้แค่ฟังก์ชันพวกนี้ ไม่มีสิทธิ์ select ตารางอื่นผ่านโค้ดบอท
--   LR-24  ตัวเลข/วันที่ในคำตอบมาจากฟังก์ชันพวกนี้ตรงๆ · Claude ไม่เห็นข้อมูลเลย เห็นแค่คำถาม
--   LR-3   ห้องใหม่ = รออนุมัติ · Bay อนุมัติก่อนบอทถึงจะตอบ
--   LR-4   webhook ซ้ำ = ตอบครั้งเดียว (webhook_event_id unique)
--   LR-19  บันทึกทุกครั้ง · A7 ห้ามลบ
-- ============================================================================

create schema if not exists line_agent;

create type line_agent.room_status as enum ('รออนุมัติ', 'อนุมัติ', 'ปฏิเสธ', 'บอทออกแล้ว');
create type line_agent.answer_status as enum
  ('ตอบแล้ว', 'ตอบไม่ได้', 'ส่งต่อทีม', 'ไม่ทัน', 'งบหมด', 'ล้มเหลว', 'ถอนคำตอบ');

-- ---------------------------------------------------------------------------
-- ตั้งค่า · 1 แถวเท่านั้น
-- ---------------------------------------------------------------------------
create table line_agent.settings (
  id                 int primary key default 1 check (id = 1),
  model              text not null default 'claude-opus-5-5',
  monthly_budget_thb numeric(10,2) not null default 500 check (monthly_budget_thb >= 0),
  thb_per_usd        numeric(8,2)  not null default 33  check (thb_per_usd > 0),
  paused             boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references core.app_users(id)
);
insert into line_agent.settings (id) values (1);

-- ---------------------------------------------------------------------------
-- ห้อง LINE ที่บอทถูกเชิญเข้า
-- ---------------------------------------------------------------------------
create table line_agent.rooms (
  id          uuid primary key default gen_random_uuid(),
  group_id    text not null unique check (btrim(group_id) <> ''),
  name        text,
  status      line_agent.room_status not null default 'รออนุมัติ',
  joined_at   timestamptz not null default now(),
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references core.app_users(id)
);
comment on table line_agent.rooms is
  'ห้องที่บอทอยู่ · บอทตอบเฉพาะห้อง อนุมัติ (LR-2 · LR-3)';

-- ---------------------------------------------------------------------------
-- บันทึกคำถาม-คำตอบ · เก็บเฉพาะข้อความที่ทักบอท (D3)
-- ---------------------------------------------------------------------------
create table line_agent.requests (
  id                uuid primary key default gen_random_uuid(),
  webhook_event_id  text not null unique,            -- LR-4 กันตอบซ้ำ
  room_id           uuid references line_agent.rooms(id),
  line_user_id      text,
  display_name      text,
  question          text not null,
  intent            jsonb,                           -- สิ่งที่ Claude เลือก · ไม่มีข้อมูลจริงในนี้
  data_used         text,                            -- ฟังก์ชันที่ดึง เช่น room_order
  answer            text,
  status            line_agent.answer_status not null,
  error             text,
  model             text,
  input_tokens      int,
  output_tokens     int,
  usd_per_mtok_in   numeric(8,3),
  usd_per_mtok_out  numeric(8,3),
  thb_per_usd       numeric(8,2),
  flagged           boolean not null default false,  -- LR-29 ถูกแจ้งว่าตอบผิด
  flagged_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references core.app_users(id)
);
create index requests_room_idx on line_agent.requests (room_id, created_at desc);
create index requests_month_idx on line_agent.requests (created_at);

comment on column line_agent.requests.intent is
  'ผลจาก Claude = แค่ "จะดึงอะไร" · ไม่เคยมีข้อมูลออเดอร์/สต็อก เพราะ Claude ไม่ได้เห็น (LR-24)';

select core.apply_standard_rules('line_agent.settings');
select core.apply_standard_rules('line_agent.rooms');
select core.apply_standard_rules('line_agent.requests');

create trigger audit_line_agent_settings after insert or update on line_agent.settings
  for each row execute function core.write_audit();
create trigger audit_line_agent_rooms after insert or update on line_agent.rooms
  for each row execute function core.write_audit();

-- ค่าใช้จ่ายเดือนนี้ (เวลาไทย)
create view line_agent.v_budget with (security_invoker = true) as
select
  s.model, s.monthly_budget_thb, s.thb_per_usd, s.paused,
  coalesce(sum((r.input_tokens * r.usd_per_mtok_in + r.output_tokens * r.usd_per_mtok_out)
               / 1e6 * r.thb_per_usd), 0)::numeric(10,2)                       as spent_thb,
  (s.monthly_budget_thb - coalesce(sum((r.input_tokens * r.usd_per_mtok_in
       + r.output_tokens * r.usd_per_mtok_out) / 1e6 * r.thb_per_usd), 0))::numeric(10,2) as remaining_thb,
  count(r.id) filter (where r.status in ('ตอบแล้ว','ตอบไม่ได้','ส่งต่อทีม'))      as answered,
  count(r.id) filter (where r.flagged)                                           as flagged
from line_agent.settings s
left join line_agent.requests r
  on (r.created_at at time zone 'Asia/Bangkok') >= date_trunc('month', now() at time zone 'Asia/Bangkok')
group by s.id;

-- ---------------------------------------------------------------------------
-- ★ มุมมองสำหรับห้อง CC · ประตูเดียวที่บอทใช้ดูข้อมูล (LR-11)
-- ---------------------------------------------------------------------------
-- ทำให้เลข BLS ที่พิมพ์มาหลายแบบ ("bls 3175" · "3175" · "ิBLS3175") เทียบกันได้ (D9 · S3)
create or replace function line_agent.norm_order_no(p text)
returns text language sql immutable
as $$
  select case
    when x ~ '^[0-9]+[A-Z]?$' then 'BLS' || x
    else x
  end
  from (select regexp_replace(upper(coalesce(p,'')), '[^A-Z0-9]', '', 'g') as x) s
$$;

-- บรรทัดที่ไม่ใช่งานผลิต (ค่าขนส่ง ค่าแพ็ค) ไม่แสดง · หมวด จ
create or replace function line_agent.is_production_line(p_variant uuid, p_desc text)
returns boolean language sql immutable
as $$ select p_variant is not null or p_desc !~ '^\s*(ค่าขนส่ง|ค่าแพ็ค|ค่าส่ง|ค่าติดตั้ง)' $$;

create or replace function line_agent.today()
returns date language sql stable
as $$ select (now() at time zone 'Asia/Bangkok')::date $$;

-- 1 ออเดอร์ · ไม่มีราคา ไม่มีลูกค้า ไม่มีที่ส่ง
create or replace function line_agent.room_order(p_order_no text)
returns jsonb
language sql stable security definer
set search_path = line_agent, sales, public
as $$
  select jsonb_build_object(
    'order_no', o.order_no,
    'wo', nullif(btrim(o.work_order_no), ''),
    'doc_status', o.status::text,
    'required_finish_on', o.required_finish_on,
    'promised_delivery_on', o.promised_delivery_on,
    'updated_at', greatest(o.updated_at, coalesce(max(l.updated_at), o.updated_at)),
    'lines', coalesce(jsonb_agg(jsonb_build_object(
        'line_no', l.line_no, 'description', l.description, 'note', l.note, 'qty', l.qty)
        order by l.line_no) filter (where l.id is not null), '[]'::jsonb)
  )
  from sales.orders o
  left join sales.order_lines l
    on l.order_id = o.id and line_agent.is_production_line(l.variant_id, l.description)
  where line_agent.norm_order_no(o.order_no) = line_agent.norm_order_no(p_order_no)
  group by o.id
$$;

-- งานที่ต้องผลิตเสร็จในช่วงวัน · เฉพาะออเดอร์ยืนยันแล้ว
create or replace function line_agent.room_orders_due(p_from date, p_to date)
returns table (order_no text, wo text, required_finish_on date, promised_delivery_on date,
               first_item text, item_count int)
language sql stable security definer
set search_path = line_agent, sales, public
as $$
  select o.order_no, nullif(btrim(o.work_order_no), ''), o.required_finish_on, o.promised_delivery_on,
         (array_agg(l.description order by l.line_no))[1], count(l.id)::int
  from sales.orders o
  left join sales.order_lines l
    on l.order_id = o.id and line_agent.is_production_line(l.variant_id, l.description)
  where o.status = 'ยืนยันแล้ว'
    and o.required_finish_on between p_from and p_to
  group by o.id
  order by o.required_finish_on, o.order_no
  limit 30
$$;

-- เลยวันต้องผลิตเสร็จ · ย้อนไม่เกิน 30 วัน เพราะระบบยังไม่รู้ว่างานไหนเสร็จแล้ว (LR-9)
create or replace function line_agent.room_orders_overdue()
returns table (order_no text, wo text, required_finish_on date, promised_delivery_on date,
               first_item text, item_count int)
language sql stable security definer
set search_path = line_agent, sales, public
as $$
  select * from line_agent.room_orders_due(line_agent.today() - 30, line_agent.today() - 1)
$$;

-- สต็อก · ทุกคำในข้อความค้นต้องเจอ · นับเป็นตัว ไม่มีราคา ไม่มีชื่อคนยืม (B39 · D7)
create or replace function line_agent.room_stock(p_query text)
returns table (kind text, item text, location text, status text, units int)
language sql stable security definer
set search_path = line_agent, stock, catalog, public
as $$
  with words as (
    select w from regexp_split_to_table(lower(btrim(coalesce(p_query,''))), '\s+') w where length(w) > 0
  ),
  products as (
    select 'สินค้า'::text as kind,
           concat_ws(' · ', p.collection, nullif(p.name_th,''), v.configuration, v.material_grade,
                     nullif(concat_ws(' ', v.wood_type, v.wood_colour), '')) as item,
           loc.name as location, u.status::text as status, count(*)::int as units,
           lower(concat_ws(' ', p.collection, p.name_th, p.name_en, v.configuration, v.material_grade,
                           v.wood_type, v.wood_colour, v.legacy_fullname)) as hay
    from stock.units u
    join catalog.product_variants v on v.id = u.variant_id
    join catalog.products p         on p.id = v.product_id
    join stock.locations loc        on loc.id = u.location_id
    where u.status <> 'ส่งแล้ว'
    group by 1, 2, 3, 4, 6
  ),
  mats as (
    select 'วัสดุ'::text, concat_ws(' · ', c.pricing_grade, m.name, m.colour_name), null::text,
           m.status::text, null::int,
           lower(concat_ws(' ', c.pricing_grade, c.name_en, c.name_th, m.name, m.colour_name, m.code, 'ผ้า หนัง วัสดุ'))
    from materials.materials m
    join materials.material_collections c on c.id = m.collection_id
  ),
  allrows as (select * from products union all select * from mats)
  select kind, item, location, status, sum(coalesce(units,0))::int
  from allrows a
  where exists (select 1 from words)
    and not exists (select 1 from words where position(w in a.hay) = 0)
  group by kind, item, location, status
  order by kind desc, item, location
  limit 20
$$;

-- ---------------------------------------------------------------------------
-- ประตูที่ webhook ใช้เขียน
-- ---------------------------------------------------------------------------
create or replace function line_agent.room_join(p_group_id text, p_name text)
returns line_agent.room_status
language sql security definer
set search_path = line_agent, public
as $$
  insert into line_agent.rooms (group_id, name) values (p_group_id, p_name)
  on conflict (group_id) do update
     set status = case when line_agent.rooms.status = 'บอทออกแล้ว' then 'รออนุมัติ'
                       else line_agent.rooms.status end,
         name = coalesce(excluded.name, line_agent.rooms.name)
  returning status
$$;

create or replace function line_agent.room_leave(p_group_id text)
returns void
language sql security definer
set search_path = line_agent, public
as $$ update line_agent.rooms set status = 'บอทออกแล้ว' where group_id = p_group_id $$;

-- จองเหตุการณ์ก่อนตอบ · คืน false ถ้าเคยรับแล้ว (LR-4)
create or replace function line_agent.claim_event(p_event_id text, p_group_id text, p_question text)
returns boolean
language plpgsql security definer
set search_path = line_agent, public
as $$
declare v_id uuid;
begin
  insert into line_agent.requests (webhook_event_id, room_id, question, status)
  values (p_event_id, (select id from line_agent.rooms where group_id = p_group_id), p_question, 'ล้มเหลว')
  on conflict (webhook_event_id) do nothing
  returning id into v_id;
  return v_id is not null;
end;
$$;

create or replace function line_agent.finish_request(p_event_id text, p jsonb)
returns void
language sql security definer
set search_path = line_agent, public
as $$
  update line_agent.requests set
    line_user_id = p->>'line_user_id', display_name = p->>'display_name',
    intent = p->'intent', data_used = p->>'data_used', answer = p->>'answer',
    status = (p->>'status')::line_agent.answer_status, error = p->>'error', model = p->>'model',
    input_tokens = (p->>'input_tokens')::int, output_tokens = (p->>'output_tokens')::int,
    usd_per_mtok_in = (p->>'usd_per_mtok_in')::numeric, usd_per_mtok_out = (p->>'usd_per_mtok_out')::numeric,
    thb_per_usd = (p->>'thb_per_usd')::numeric
  where webhook_event_id = p_event_id
$$;

-- "@CC ผู้ช่วย ตอบผิด" · ติดธงคำตอบล่าสุดในห้องที่ยังไม่ถูกติด (LR-28 · LR-29)
create or replace function line_agent.flag_last(p_group_id text)
returns text
language plpgsql security definer
set search_path = line_agent, public
as $$
declare v_id uuid; v_q text;
begin
  select r.id, r.question into v_id, v_q
  from line_agent.requests r join line_agent.rooms rm on rm.id = r.room_id
  where rm.group_id = p_group_id and r.status = 'ตอบแล้ว' and not r.flagged
  order by r.created_at desc limit 1;
  if v_id is null then return null; end if;
  update line_agent.requests set flagged = true, flagged_at = now() where id = v_id;
  return v_q;
end;
$$;

create or replace function line_agent.room_state(p_group_id text)
returns jsonb
language sql stable security definer
set search_path = line_agent, public
as $$
  select jsonb_build_object(
    'room', (select status::text from line_agent.rooms where group_id = p_group_id),
    'budget', (select to_jsonb(b) from line_agent.v_budget b))
$$;

-- ---------------------------------------------------------------------------
-- สิทธิ์
-- ---------------------------------------------------------------------------
alter table line_agent.settings enable row level security;
alter table line_agent.rooms    enable row level security;
alter table line_agent.requests enable row level security;

-- หลังบ้าน = Bay (สิทธิ์ admin)
create policy settings_admin on line_agent.settings for all to authenticated
  using (core.has_capability('admin')) with check (core.has_capability('admin'));
create policy rooms_admin on line_agent.rooms for all to authenticated
  using (core.has_capability('admin')) with check (core.has_capability('admin'));
create policy requests_admin_select on line_agent.requests for select to authenticated
  using (core.has_capability('admin'));
create policy requests_admin_flag on line_agent.requests for update to authenticated
  using (core.has_capability('admin')) with check (core.has_capability('admin'));

grant usage on schema line_agent to authenticated, service_role;
grant select, update on line_agent.settings, line_agent.rooms to authenticated;
grant select, update on line_agent.requests to authenticated;
grant select on line_agent.v_budget to authenticated;

-- webhook (service role) ไม่ได้สิทธิ์ตารางใดๆ เลย · เรียกได้แค่ประตูข้างล่าง
revoke all on all functions in schema line_agent from public, anon, authenticated;
grant execute on function
  line_agent.room_order(text),
  line_agent.room_orders_due(date, date),
  line_agent.room_orders_overdue(),
  line_agent.room_stock(text),
  line_agent.room_join(text, text),
  line_agent.room_leave(text),
  line_agent.claim_event(text, text, text),
  line_agent.finish_request(text, jsonb),
  line_agent.flag_last(text),
  line_agent.room_state(text)
to service_role;
grant execute on function line_agent.norm_order_no(text), line_agent.is_production_line(uuid, text),
  line_agent.today() to service_role, authenticated;

-- ---------------------------------------------------------------------------
-- ทะเบียนโมดูล
-- ---------------------------------------------------------------------------
insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability,
   home_path, sort_order, is_core, description_th) values
  ('line_agent', 'ผู้ช่วย LINE', 'LINE agent', 'message', 'line_agent',
   '{core,sales,stock,catalog,materials}', 'admin', '/line', 90, false,
   'บอทในห้อง CC · ตอบงานผลิตและสต็อก · ไม่เห็นราคาและลูกค้า');

-- ⚠️ ขาดบรรทัดนี้ = REST API มองไม่เห็น schema line_agent
alter role authenticator
  set pgrst.db_schemas = 'public, graphql_public, core, catalog, materials, pricing, cost, marketing, stock, content, crm, sales, line_agent';

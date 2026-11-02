-- ============================================================================
-- 0036 · Team Bay · สิทธิ์รายกลุ่ม · สลิป · รูปงานเสร็จ · คำขอค้าง · ใบงานผลิต
-- ============================================================================
-- ที่มา: docs/modules/line-agent/6-groups.md (Bay กรอก 2026-11-02 · "ผ่าน")
--
--   ชุด A  แต่ละกลุ่มเห็นไม่เหมือนกัน (ราคา · ชื่อลูกค้า · ยอดเงิน · ที่อยู่) · กลุ่มใหม่ปิดหมด
--          ข้อความพร้อมส่งลูกค้า (กลุ่ม Check progress)
--   ชุด B  สลิป → AI อ่าน → จับคู่ BLS → คนยืนยัน · รูปงานเสร็จผูก BLS
--          รูปเก็บในที่เก็บไฟล์ส่วนตัว (bucket line-images) · ไม่มีลิงก์สาธารณะ
--   ชุด C  ใบงานผลิตส่งเอง (กันส่งซ้ำ) · คำขอเลื่อน/เปลี่ยน จดค้างไว้
--
-- ต้นทุน/กำไร ไม่มีในไฟล์นี้และไม่มีทางผ่านประตูบอทไปได้ · เหมือนเดิม
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ชุด A · สิทธิ์และหน้าที่ของแต่ละกลุ่ม
-- ---------------------------------------------------------------------------
alter table line_agent.rooms
  add column see_price      boolean not null default false,
  add column see_customer   boolean not null default false,
  add column see_money      boolean not null default false,
  add column see_address    boolean not null default false,
  add column customer_draft boolean not null default false,   -- แนบข้อความพร้อมส่งลูกค้า
  add column draft_polite   text    not null default 'ค่ะ' check (draft_polite in ('ค่ะ', 'ครับ')),
  add column can_slip       boolean not null default false,
  add column can_photo      boolean not null default false,
  add column push_worksheet boolean not null default false;

comment on column line_agent.rooms.see_price is 'กลุ่มนี้เห็นราคาขาย/Clearance · กลุ่มใหม่ = ปิด';
comment on column line_agent.rooms.customer_draft is 'แนบ "ข้อความพร้อมส่งลูกค้า" ใต้คำตอบ ให้ทีมก๊อปไปส่งเอง (กฎ AI 1)';

-- ค่าเริ่มต้นตามที่ Bay กรอก (6-groups.md)
update line_agent.rooms set see_price = true, see_customer = true, see_money = true, see_address = true,
                             can_slip = true, push_worksheet = true
 where name ilike '%PO และ production%';
update line_agent.rooms set see_customer = true, see_address = true, can_photo = true
 where name ilike '%เช็คงาน%';
update line_agent.rooms set customer_draft = true
 where name ilike '%Check progress%';
-- กลุ่มทดสอบเปิดทุกอย่างไว้ลอง
update line_agent.rooms set see_price = true, see_customer = true, see_money = true, see_address = true,
                             customer_draft = true, can_slip = true, can_photo = true
 where name ilike '%ทดสอบ%';

-- ---------------------------------------------------------------------------
-- ชื่อลูกค้า + ยอดเงินจากชีต · ตารางแยก เห็นได้เฉพาะกลุ่มที่เปิด และหน้าการเงิน
-- ---------------------------------------------------------------------------
create table sheets.order_money (
  bls            text primary key,
  customer_name  text,
  total_sales    numeric,
  balance        numeric          -- ตามชีต · ช่องนี้คนพิมพ์เอง อาจไม่ตรง (O3)
);
alter table sheets.order_money enable row level security;
insert into sheets.sources (id, name_th, spreadsheet_id)
  values ('money', 'Order Tracking · ลูกค้า+ยอดเงิน', '1y9ROPiZHSxFiJSw0oNTrC9xPtmX0RlZu-6vZWPDsxYc');

create or replace function sheets.replace_source(p_source text, p_rows jsonb, p_meta jsonb)
returns int
language plpgsql security definer
set search_path = sheets, public
as $$
declare n int;
begin
  if p_source = 'orders' then
    delete from sheets.orders where true;
    insert into sheets.orders select * from jsonb_populate_recordset(null::sheets.orders, p_rows);
  elsif p_source = 'money' then
    delete from sheets.order_money where true;
    insert into sheets.order_money select * from jsonb_populate_recordset(null::sheets.order_money, p_rows);
  elsif p_source = 'po' then
    delete from sheets.po_lines where true;
    insert into sheets.po_lines select * from jsonb_populate_recordset(null::sheets.po_lines, p_rows);
  elsif p_source = 'stock' then
    delete from sheets.stock where true;
    insert into sheets.stock select * from jsonb_populate_recordset(null::sheets.stock, p_rows);
  elsif p_source = 'fabric' then
    delete from sheets.fabric where true;
    insert into sheets.fabric select * from jsonb_populate_recordset(null::sheets.fabric, p_rows);
  elsif p_source = 'clearance' then
    delete from sheets.clearance where true;
    insert into sheets.clearance select * from jsonb_populate_recordset(null::sheets.clearance, p_rows);
  else
    raise exception 'ไม่รู้จักแหล่ง %', p_source;
  end if;
  get diagnostics n = row_count;
  update sheets.sources set
    rows = n, tab = coalesce(p_meta->>'tab', tab),
    warnings = coalesce(p_meta->'warnings', '[]'::jsonb),
    last_try_at = now(), last_ok_at = now(), last_error = null, updated_at = now()
  where id = p_source;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- ชุด B · รูปงานเสร็จ
-- ---------------------------------------------------------------------------
create table line_agent.work_photos (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid references line_agent.rooms(id),
  bls              text not null,
  line_message_id  text not null unique,
  image_path       text not null,              -- ใน bucket line-images
  line_user_id     text,
  display_name     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references core.app_users(id)
);
create index work_photos_bls_idx on line_agent.work_photos (bls, created_at desc);

-- ---------------------------------------------------------------------------
-- ชุด B · สลิป · AI อ่าน → คนในกลุ่มยืนยัน BLS → การเงินยืนยัน → ลงชีตแล้ว
-- ---------------------------------------------------------------------------
create type line_agent.slip_status as enum ('รอเลือก BLS', 'รอการเงินยืนยัน', 'ยืนยันแล้ว', 'ลงชีตแล้ว', 'ไม่ใช่สลิป', 'ซ้ำ');

create table line_agent.slips (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid references line_agent.rooms(id),
  line_message_id  text not null unique,
  image_path       text not null,
  line_user_id     text,
  display_name     text,
  amount           numeric(12,2),
  paid_on          date,
  paid_time        text,
  bank             text,
  ref              text,
  payer_name       text,
  receiver_name    text,
  candidates       jsonb not null default '[]'::jsonb,   -- [{bls, customer_name, balance, score}]
  bls              text,                                 -- BLS ที่เลือกแล้ว
  status           line_agent.slip_status not null default 'รอเลือก BLS',
  duplicate_of     uuid references line_agent.slips(id),
  ai_raw           jsonb,
  confirmed_by     uuid references core.app_users(id),
  confirmed_at     timestamptz,
  posted_by        uuid references core.app_users(id),
  posted_at        timestamptz,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references core.app_users(id)
);
create index slips_status_idx on line_agent.slips (status, created_at desc);
create index slips_ref_idx on line_agent.slips (ref) where ref is not null;

comment on table line_agent.slips is
  'สลิปโอนเงินที่ส่งในกลุ่ม · AI อ่านเป็นร่าง · เงินจริงต้องมีคนยืนยันเสมอ (กฎ AI 4) · ต้นฉบับยังเป็น Google Sheet';

-- ---------------------------------------------------------------------------
-- ชุด C · คำขอเลื่อน/เปลี่ยน · ใบงานผลิตที่ส่งแล้ว
-- ---------------------------------------------------------------------------
create table line_agent.change_requests (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid references line_agent.rooms(id),
  bls           text,
  text          text not null,
  display_name  text,
  status        text not null default 'เปิด' check (status in ('เปิด', 'ปิดแล้ว')),
  closed_by     uuid references core.app_users(id),
  closed_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references core.app_users(id)
);

create table line_agent.worksheet_pushes (
  bls         text primary key,
  baseline    boolean not null default false,   -- มีอยู่ก่อนเปิดใช้ · ไม่ส่ง
  sent_at     timestamptz,
  rooms       int,
  error       text,
  created_at  timestamptz not null default now()
);

select core.apply_standard_rules('line_agent.work_photos');
select core.apply_standard_rules('line_agent.slips');
select core.apply_standard_rules('line_agent.change_requests');
create trigger audit_line_agent_slips after insert or update on line_agent.slips
  for each row execute function core.write_audit();

-- ---------------------------------------------------------------------------
-- ★ ประตูข้อมูลตามสิทธิ์กลุ่ม
-- ของเดิม (0035) กลายเป็นตัวใน · เรียกได้เฉพาะจากประตูชุดใหม่
-- ---------------------------------------------------------------------------
alter function line_agent.room_order(text) rename to _order_full;
alter function line_agent.room_orders_due(date, date) rename to _orders_due_full;
alter function line_agent.room_clearance(text) rename to _clearance_full;
revoke all on function line_agent._order_full(text), line_agent._orders_due_full(date, date),
  line_agent._clearance_full(text) from public, anon, authenticated, service_role;

create or replace function line_agent.room_flags(p_group_id text)
returns line_agent.rooms
language sql stable security definer
set search_path = line_agent, public
as $$ select * from line_agent.rooms where group_id = p_group_id and status = 'อนุมัติ' $$;

create or replace function line_agent.room_order(p_order_no text, p_group_id text)
returns jsonb
language plpgsql stable security definer
set search_path = line_agent, sales, crm, sheets, public
as $$
declare j jsonb; f line_agent.rooms; k text := line_agent.norm_order_no(p_order_no); m sheets.order_money;
begin
  f := line_agent.room_flags(p_group_id);
  if f.id is null then return null; end if;           -- ห้องไม่อนุมัติ = ไม่มีข้อมูล
  j := line_agent._order_full(p_order_no);
  if j is null then return null; end if;

  if not f.see_price then
    j := jsonb_set(j, '{lines}', coalesce((select jsonb_agg(l - 'unit_price') from jsonb_array_elements(j->'lines') l), '[]'));
  end if;

  -- รูปงานเสร็จ (ชุด B) · สัญญาณว่าผลิตเสร็จแล้ว
  j := j || jsonb_build_object(
    'photos', (select count(*) from line_agent.work_photos p where p.bls = k),
    'photo_last', (select max(created_at) from line_agent.work_photos p where p.bls = k));

  if f.see_customer or f.see_money then
    if j->>'source' = 'ระบบ' then
      select c.name into m.customer_name
      from sales.orders o join crm.customers c on c.id = o.customer_id
      where line_agent.norm_order_no(o.order_no) = k;
      select t."ยอดรวม", t."ยอดค้าง" into m.total_sales, m.balance
      from sales.orders o join sales.v_order_totals t on t.order_id = o.id
      where line_agent.norm_order_no(o.order_no) = k;
    else
      select * into m from sheets.order_money where bls = k;
    end if;
    if f.see_customer then j := j || jsonb_build_object('customer_name', m.customer_name); end if;
    if f.see_money then j := j || jsonb_build_object('total_sales', m.total_sales, 'balance', m.balance); end if;
  end if;
  if f.see_address and j->>'source' = 'ชีต' then
    j := j || jsonb_build_object('delivery_text_full',
      (select delivery_text from sheets.orders where bls = k));
  end if;
  return j;
end;
$$;

drop function if exists line_agent.room_orders_overdue();
create or replace function line_agent.room_orders_due(p_from date, p_to date, p_group_id text)
returns table (order_no text, wo text, due_on date, due_kind text,
               first_item text, item_count int, source text, customer_name text)
language sql stable security definer
set search_path = line_agent, sheets, public
as $$
  select d.order_no, d.wo, d.due_on, d.due_kind, d.first_item, d.item_count, d.source,
         case when f.see_customer then (select m.customer_name from sheets.order_money m where m.bls = d.order_no) end
  from line_agent.room_flags(p_group_id) f
  cross join line_agent._orders_due_full(p_from, p_to) d
  where f.id is not null
$$;

create or replace function line_agent.room_orders_overdue(p_group_id text)
returns table (order_no text, wo text, due_on date, due_kind text,
               first_item text, item_count int, source text, customer_name text)
language sql stable security definer
set search_path = line_agent, public
as $$ select * from line_agent.room_orders_due(line_agent.today() - 30, line_agent.today() - 1, p_group_id) $$;

create or replace function line_agent.room_clearance(p_query text, p_group_id text)
returns jsonb
language sql stable security definer
set search_path = line_agent, public
as $$
  select case when f.id is null then null
              when not f.see_price then jsonb_build_object('hidden', true)
              else line_agent._clearance_full(p_query) end
  from (select (line_agent.room_flags(p_group_id)).*) f
$$;

-- room_state เดิม + สิทธิ์ของกลุ่ม · บอทใช้ตัดสินว่าทำอะไรได้
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
                'can_slip', can_slip, 'can_photo', can_photo)
              from line_agent.rooms where group_id = p_group_id),
    'budget', (select to_jsonb(b) from line_agent.v_budget b))
$$;

-- ---------------------------------------------------------------------------
-- ประตูเขียนของ webhook · ชุด B และ C
-- ---------------------------------------------------------------------------
create or replace function line_agent.photo_add(p jsonb)
returns int
language plpgsql security definer
set search_path = line_agent, public
as $$
declare k text := line_agent.norm_order_no(p->>'bls');
begin
  if (select can_photo from line_agent.room_flags(p->>'group_id')) is not true then
    raise exception 'กลุ่มนี้ไม่ได้เปิดให้เก็บรูปงานเสร็จ';
  end if;
  insert into line_agent.work_photos (room_id, bls, line_message_id, image_path, line_user_id, display_name)
  values ((select id from line_agent.rooms where group_id = p->>'group_id'), k, p->>'line_message_id',
          p->>'image_path', p->>'line_user_id', p->>'display_name')
  on conflict (line_message_id) do nothing;
  return (select count(*) from line_agent.work_photos where bls = k);
end;
$$;

-- หา BLS ที่น่าจะใช่จากชื่อคนโอน + ยอด · คะแนน: ชื่อตรง 2 · ยอดเท่ายอดค้าง/ยอดขาย 2 · ลำดับใหม่ก่อน
create or replace function line_agent.slip_candidates(p_name text, p_amount numeric)
returns jsonb
language sql stable security definer
set search_path = line_agent, sheets, public
as $$
  with tok as (
    select t from regexp_split_to_table(
      lower(regexp_replace(coalesce(p_name, ''),
        '(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|mr\.?|mrs\.?|ms\.?|miss|บริษัท|บจก\.?|จำกัด|\(มหาชน\)|หจก\.?|co\.?,? ?ltd\.?)', ' ', 'gi')),
      '\s+') t
    where length(t) >= 3
  ),
  scored as (
    select m.bls, m.customer_name, m.balance, m.total_sales,
      (case when exists (select 1 from tok where position(tok.t in lower(coalesce(m.customer_name, ''))) > 0) then 2 else 0 end
       + case when p_amount is not null and (m.balance = p_amount or m.total_sales = p_amount) then 2 else 0 end) as score,
      o.ordered_on
    from sheets.order_money m
    left join sheets.orders o on o.bls = m.bls
  )
  select coalesce(jsonb_agg(jsonb_build_object('bls', bls, 'customer_name', customer_name,
                                               'balance', balance, 'score', score)
                            order by score desc, ordered_on desc nulls last, bls desc), '[]'::jsonb)
  from (select * from scored where score > 0 order by score desc, ordered_on desc nulls last limit 5) s
$$;

create or replace function line_agent.slip_add(p jsonb)
returns jsonb
language plpgsql security definer
set search_path = line_agent, public
as $$
declare v line_agent.slips; d uuid; c jsonb; n int;
begin
  if (select can_slip from line_agent.room_flags(p->>'group_id')) is not true then
    raise exception 'กลุ่มนี้ไม่ได้เปิดให้อ่านสลิป';
  end if;
  select id into d from line_agent.slips
   where nullif(btrim(p->>'ref'), '') is not null and ref = btrim(p->>'ref') and status <> 'ไม่ใช่สลิป'
   limit 1;
  c := case when (p->>'is_slip')::boolean is false then '[]'::jsonb
            else line_agent.slip_candidates(p->>'payer_name', (p->>'amount')::numeric) end;
  n := jsonb_array_length(c);
  insert into line_agent.slips (room_id, line_message_id, image_path, line_user_id, display_name,
      amount, paid_on, paid_time, bank, ref, payer_name, receiver_name, candidates, bls, status, duplicate_of, ai_raw)
  values ((select id from line_agent.rooms where group_id = p->>'group_id'), p->>'line_message_id', p->>'image_path',
      p->>'line_user_id', p->>'display_name', (p->>'amount')::numeric, (p->>'paid_on')::date, p->>'paid_time',
      p->>'bank', nullif(btrim(p->>'ref'), ''), p->>'payer_name', p->>'receiver_name', c,
      case when nullif(p->>'bls', '') is not null then line_agent.norm_order_no(p->>'bls') end,
      case when (p->>'is_slip')::boolean is false then 'ไม่ใช่สลิป'
           when d is not null then 'ซ้ำ'
           when nullif(p->>'bls', '') is not null then 'รอการเงินยืนยัน'
           else 'รอเลือก BLS' end::line_agent.slip_status,
      d, p->'ai_raw')
  on conflict (line_message_id) do nothing
  returning * into v;
  if v.id is null then select * into v from line_agent.slips where line_message_id = p->>'line_message_id'; end if;
  return to_jsonb(v);
end;
$$;

-- คนในกลุ่มตอบ "ใช่" / "1" / "BLS3230" → ผูกสลิปล่าสุดที่รอเลือกของคนนั้น (30 นาที)
create or replace function line_agent.slip_pick(p_group_id text, p_line_user_id text, p_choice text)
returns jsonb
language plpgsql security definer
set search_path = line_agent, public
as $$
declare v line_agent.slips; k text; i int;
begin
  select s.* into v from line_agent.slips s join line_agent.rooms r on r.id = s.room_id
   where r.group_id = p_group_id and s.line_user_id = p_line_user_id and s.status = 'รอเลือก BLS'
     and s.created_at > now() - interval '30 minutes'
   order by s.created_at desc limit 1;
  if v.id is null then return null; end if;
  if p_choice ~ '^\s*[1-5]\s*$' then
    i := btrim(p_choice)::int;
    k := v.candidates->(i - 1)->>'bls';
  elsif p_choice ~* '^\s*(ใช่|ถูก|ok|โอเค|yes|y)\s*$' then
    k := v.candidates->0->>'bls';
  else
    k := line_agent.norm_order_no(p_choice);
    if k !~ '^BLS[0-9]{3,5}[A-Z]?$' then k := null; end if;
  end if;
  if k is null then return jsonb_build_object('id', v.id, 'ok', false); end if;
  update line_agent.slips set bls = k, status = 'รอการเงินยืนยัน' where id = v.id returning * into v;
  return to_jsonb(v) || jsonb_build_object('ok', true);
end;
$$;

create or replace function line_agent.change_add(p_group_id text, p_bls text, p_text text, p_name text)
returns void
language sql security definer
set search_path = line_agent, public
as $$
  insert into line_agent.change_requests (room_id, bls, text, display_name)
  values ((select id from line_agent.rooms where group_id = p_group_id),
          case when p_bls is not null then line_agent.norm_order_no(p_bls) end, left(p_text, 2000), p_name)
$$;

-- ใบงานผลิต · BLS ที่มีใบ PO ในชีตแต่ยังไม่เคยส่ง · ครั้งแรกตั้งต้นทั้งหมดเป็น "มีอยู่แล้ว" ไม่ส่ง
create or replace function line_agent.worksheets_pending()
returns jsonb
language plpgsql security definer
set search_path = line_agent, sheets, public
as $$
begin
  if not exists (select 1 from line_agent.worksheet_pushes) then
    insert into line_agent.worksheet_pushes (bls, baseline)
    select distinct bls, true from sheets.po_lines on conflict do nothing;
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'bls', b.bls,
      'delivery_text', (select max(delivery_text) from sheets.po_lines p where p.bls = b.bls),
      'delivery_on', (select o.delivery_on from sheets.orders o where o.bls = b.bls),
      'lines', (select jsonb_agg(jsonb_build_object('line_no', line_no, 'name', name, 'spec', spec,
                                                   'note', note, 'qty', qty) order by line_no)
                from sheets.po_lines p where p.bls = b.bls)))
    from (select distinct bls from sheets.po_lines
          where bls not in (select bls from line_agent.worksheet_pushes)) b), '[]'::jsonb);
end;
$$;

create or replace function line_agent.worksheet_rooms()
returns setof text
language sql stable security definer
set search_path = line_agent, public
as $$ select group_id from line_agent.rooms where status = 'อนุมัติ' and push_worksheet $$;

create or replace function line_agent.worksheet_sent(p_bls text, p_rooms int, p_error text)
returns void
language sql security definer
set search_path = line_agent, public
as $$
  insert into line_agent.worksheet_pushes (bls, sent_at, rooms, error)
  values (p_bls, now(), p_rooms, p_error)
  on conflict (bls) do update set sent_at = now(), rooms = excluded.rooms, error = excluded.error
$$;

-- ---------------------------------------------------------------------------
-- ที่เก็บรูป · ส่วนตัว · webhook (service role) เขียน · Bay/การเงินอ่านผ่านลิงก์ชั่วคราว
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'storage' and c.relname = 'buckets') then
    insert into storage.buckets (id, name, public) values ('line-images', 'line-images', false)
    on conflict (id) do nothing;
    execute $p$
      create policy line_images_read on storage.objects for select to authenticated
      using (bucket_id = 'line-images' and (core.has_capability('admin') or core.has_capability('finance.write')))
    $p$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- สิทธิ์
-- ---------------------------------------------------------------------------
alter table line_agent.work_photos      enable row level security;
alter table line_agent.slips            enable row level security;
alter table line_agent.change_requests  enable row level security;
alter table line_agent.worksheet_pushes enable row level security;

create policy photos_read on line_agent.work_photos for select to authenticated
  using (core.has_capability('admin') or core.has_capability('sales.write'));
create policy slips_read on line_agent.slips for select to authenticated
  using (core.has_capability('admin') or core.has_capability('finance.write'));
create policy slips_confirm on line_agent.slips for update to authenticated
  using (core.has_capability('admin') or core.has_capability('finance.write'))
  with check (core.has_capability('admin') or core.has_capability('finance.write'));
create policy changes_rw on line_agent.change_requests for all to authenticated
  using (core.has_capability('admin') or core.has_capability('sales.write'))
  with check (core.has_capability('admin') or core.has_capability('sales.write'));
create policy money_read on sheets.order_money for select to authenticated
  using (core.has_capability('admin') or core.has_capability('finance.write'));

grant select on line_agent.work_photos to authenticated;
grant select, update on line_agent.slips, line_agent.change_requests to authenticated;
grant select on sheets.order_money to authenticated;

revoke all on function line_agent.room_flags(text), line_agent.room_order(text, text),
  line_agent.room_orders_due(date, date, text), line_agent.room_orders_overdue(text),
  line_agent.room_clearance(text, text), line_agent.photo_add(jsonb), line_agent.slip_candidates(text, numeric),
  line_agent.slip_add(jsonb), line_agent.slip_pick(text, text, text), line_agent.change_add(text, text, text, text),
  line_agent.worksheets_pending(), line_agent.worksheet_rooms(), line_agent.worksheet_sent(text, int, text)
  from public, anon, authenticated;
grant execute on function line_agent.room_order(text, text),
  line_agent.room_orders_due(date, date, text), line_agent.room_orders_overdue(text),
  line_agent.room_clearance(text, text), line_agent.photo_add(jsonb),
  line_agent.slip_add(jsonb), line_agent.slip_pick(text, text, text), line_agent.change_add(text, text, text, text),
  line_agent.worksheets_pending(), line_agent.worksheet_rooms(), line_agent.worksheet_sent(text, int, text)
  to service_role;

notify pgrst, 'reload schema';

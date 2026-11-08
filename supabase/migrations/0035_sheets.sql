-- ============================================================================
-- 0035 · ข้อมูลจาก Google Sheet (อ่านอย่างเดียว) + บอทตอบจากข้อมูลนี้
-- ============================================================================
-- ที่มา: docs/modules/sheet-sync/0-idea.md · docs/modules/line-agent/5-roadmap.md ชุด 1
--
-- หลัก
--   · ทางเดียว ชีต → ระบบ · ระบบไม่เขียนกลับชีต (B40) · กุญแจ Google ได้สิทธิ์อ่านอย่างเดียว
--   · ตารางในไฟล์นี้เป็น "สำเนาจากชีต" ไม่ใช่ต้นฉบับ · ดึงใหม่ = แทนที่ทั้งชุด
--     จึงไม่ใส่กฎห้ามลบ (A7) · ต้นฉบับคือชีต และประวัติอยู่ในชีตเอง
--   · ไม่ดึง: ชื่อ เบอร์ ที่อยู่ลูกค้า · ต้นทุน (Landing Cost / Inventory Value / ต้นทุน)
--   · ราคาขาย/Clearance เปิดในห้อง CC แล้ว (Bay 2026-11-02 · "เค้าเห็นอยู่แล้ว เวลาเราส่ง PO")
-- ============================================================================

create schema if not exists sheets;

-- แหล่งชีต · 1 แถว = 1 ไฟล์/ชุดข้อมูล · สถานะการดึงล่าสุด
create table sheets.sources (
  id              text primary key,         -- orders · po · stock · fabric · clearance
  name_th         text not null,
  spreadsheet_id  text not null,
  tab             text,                     -- แท็บที่ใช้ล่าสุด (สต็อกเปลี่ยนแท็บตามวันที่)
  expires_on      date,                     -- ราคา Clearance หมดอายุ
  rows            int,
  last_try_at     timestamptz,
  last_ok_at      timestamptz,
  last_error      text,
  warnings        jsonb not null default '[]'::jsonb,   -- แถวที่อ่านไม่ออก
  updated_at      timestamptz not null default now()
);

insert into sheets.sources (id, name_th, spreadsheet_id, expires_on) values
  ('orders',    'Order Tracking · order2026',  '1y9ROPiZHSxFiJSw0oNTrC9xPtmX0RlZu-6vZWPDsxYc', null),
  ('po',        'PO template 2026',            '1udWHrgWgNWfhUQ4D4eANMZ07RpXXO5HIaXMOLn7tq6E', null),
  ('stock',     'Chaw Cher Stock · สินค้า',      '15qf7h1QKUQbYRZxUh2ddVb_f0HUozNTCjxBCXy3tkEA', null),
  ('fabric',    'Chaw Cher Stock · ผ้า+หนัง',    '15qf7h1QKUQbYRZxUh2ddVb_f0HUozNTCjxBCXy3tkEA', null),
  ('clearance', 'Clearance Sales 2026',        '1iN0J2DyQj2GAkKNGg-evocKpNYb7zSirorWsOvdkxTc', '2026-11-30');

-- ① Order Tracking · 1 แถว = 1 BLS (รวมหลายแถวในชีตเป็นแถวเดียวแล้ว · O4)
create table sheets.orders (
  bls            text primary key,   -- รูปเดียว BLS3230 / BLS3181A
  label          text,               -- เช่น งานซ่อม
  wo             text,               -- เลขหรือคำตามชีต (83/26 · รอW/O · s/s)
  ordered_on     date,
  delivery_text  text,               -- ตามที่พิมพ์ในชีต · อาจมีชื่อคนรับ จึงไม่ส่งเข้าห้องตรงๆ
  delivery_on    date,               -- แปลจากข้อความได้ · แปลไม่ได้ = null
  items_text     text,               -- ช่อง "รายการ" ต่อกัน
  sheet_rows     text                -- แถวในชีต เช่น 120-123 · ไว้ตามรอย
);

-- ② PO template · 1 แถว = 1 รายการในใบ PO (ไม่มีชื่อลูกค้า/ที่อยู่)
create table sheets.po_lines (
  bls            text not null,
  line_no        int  not null,
  name           text not null,
  spec           text,
  note           text,
  qty            numeric,
  unit_price     numeric,            -- ราคาต่อหน่วยหลังลด (ช่องที่มีจำนวนเงิน)
  delivery_text  text,
  tab            text not null,
  primary key (bls, line_no)
);

-- ③ สต็อกสินค้า · ตามแท็บล่าสุด · จำนวนแยกตามที่อยู่
create table sheets.stock (
  row_no     int primary key,
  product    text not null,
  brand      text,
  category   text,
  material   text,
  color      text,
  size       text,
  total      numeric,                -- ช่อง "คงเหลือ"
  by_place   jsonb not null default '{}'::jsonb,   -- {"ASE-เพื่อขาย":"9","ของเสีย(ASE)":"2 =สีต่าง"}
  note       text
);

-- ③ข สต็อกผ้า+หนัง
create table sheets.fabric (
  group_name  text not null,         -- ผ้า A กอง 1 · ผ้า B · หนัง ...
  name        text not null,
  stock_text  text,                  -- ตามชีต เช่น "86.7" · "หมด"
  stock       numeric,
  primary key (group_name, name)
);

-- ④ Clearance
create table sheets.clearance (
  row_no       int primary key,
  full_name    text not null,
  code         text,
  collection   text,
  name_en      text,
  wood         text,
  wood_colour  text,
  upholstery   text,
  upholstery_colour text,
  size         text,
  nnsku        text,
  retail       numeric,
  disc_pct     text,
  price        numeric
);

-- ---------------------------------------------------------------------------
-- ประตูเขียน · แทนที่ทั้งชุดในครั้งเดียว · service_role เท่านั้น
-- ---------------------------------------------------------------------------
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

-- ดึงไม่สำเร็จ = จดไว้ · ข้อมูลเดิมยังอยู่ (F1 · F5)
create or replace function sheets.mark_failed(p_source text, p_error text)
returns void
language sql security definer
set search_path = sheets, public
as $$
  update sheets.sources set last_try_at = now(), last_error = left(p_error, 1000), updated_at = now()
  where id = p_source
$$;

create or replace function sheets.list_sources()
returns setof sheets.sources
language sql stable security definer
set search_path = sheets, public
as $$ select * from sheets.sources order by id $$;

-- ---------------------------------------------------------------------------
-- กำหนดส่งที่ส่งเข้าห้องได้ · ข้อความในชีตบางช่องมีชื่อคนรับ/ชั้น/ตึก (R1)
-- แปลเป็นวันที่ได้ = ส่งแค่วันที่ · แปลไม่ได้ = ส่งข้อความสั้นๆ ที่ตัดวงเล็บ/หมายเหตุออก
-- ---------------------------------------------------------------------------
create or replace function sheets.safe_delivery_text(p text)
returns text language sql immutable
as $$
  select case
    when x is null or x = '' then null
    when length(x) > 40 or x ~ '(คุณ|ชั้น|ตึก|ประตู|โทร|[0-9]{3}-?[0-9]{3}-?[0-9]{4})' then 'ดูในชีต'
    else x
  end
  from (select btrim(regexp_replace(split_part(split_part(coalesce(p,''), '**', 1), '(', 1), '\s+', ' ', 'g')) as x) s
$$;

-- ---------------------------------------------------------------------------
-- ★ ประตูบอทชุดใหม่ · ระบบก่อน ชีตทีหลัง · ไม่มีลูกค้า ไม่มีต้นทุน
-- ---------------------------------------------------------------------------
create or replace function line_agent.room_order(p_order_no text)
returns jsonb
language plpgsql stable security definer
set search_path = line_agent, sales, sheets, public
as $$
declare j jsonb; k text := line_agent.norm_order_no(p_order_no);
begin
  -- ระบบ (ออเดอร์ที่ลงในเว็บ)
  select jsonb_build_object(
    'source', 'ระบบ',
    'order_no', o.order_no,
    'wo', nullif(btrim(o.work_order_no), ''),
    'doc_status', o.status::text,
    'required_finish_on', o.required_finish_on,
    'promised_delivery_on', o.promised_delivery_on,
    'delivery_text', null,
    'updated_at', greatest(o.updated_at, coalesce(max(l.updated_at), o.updated_at)),
    'lines', coalesce(jsonb_agg(jsonb_build_object(
        'line_no', l.line_no, 'description', l.description, 'note', l.note,
        'qty', l.qty, 'unit_price', l.unit_price_incl_vat)
        order by l.line_no) filter (where l.id is not null), '[]'::jsonb)
  ) into j
  from sales.orders o
  left join sales.order_lines l
    on l.order_id = o.id and line_agent.is_production_line(l.variant_id, l.description)
  where line_agent.norm_order_no(o.order_no) = k
  group by o.id;
  if j is not null then return j; end if;

  -- ชีต · รายการจาก PO template ถ้ามี ไม่งั้นจากช่อง "รายการ" ใน Order Tracking
  select jsonb_build_object(
    'source', 'ชีต',
    'order_no', coalesce(o.bls, k),
    'label', o.label,
    'wo', o.wo,
    'doc_status', null,
    'required_finish_on', null,
    'promised_delivery_on', o.delivery_on,
    'delivery_text', case when o.delivery_on is null
                          then sheets.safe_delivery_text(coalesce(o.delivery_text, (select max(p.delivery_text) from sheets.po_lines p where p.bls = k)))
                     end,
    'items_text', o.items_text,
    'updated_at', (select max(last_ok_at) from sheets.sources where id in ('orders','po')),
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
        'line_no', p.line_no, 'description', concat_ws(' · ', p.name, p.spec), 'note', p.note,
        'qty', p.qty, 'unit_price', p.unit_price) order by p.line_no)
      from sheets.po_lines p where p.bls = k), '[]'::jsonb)
  ) into j
  from (select k as kk) x
  left join sheets.orders o on o.bls = x.kk
  where o.bls is not null or exists (select 1 from sheets.po_lines p where p.bls = k);
  return j;
end;
$$;

-- งานตามวัน · ระบบใช้ "ต้องผลิตเสร็จ" · ชีตมีแต่ "กำหนดส่ง" (ช่องผลิตเสร็จในชีตว่างทั้งปี)
drop function if exists line_agent.room_orders_overdue();
drop function if exists line_agent.room_orders_due(date, date);

create or replace function line_agent.room_orders_due(p_from date, p_to date)
returns table (order_no text, wo text, due_on date, due_kind text,
               first_item text, item_count int, source text)
language sql stable security definer
set search_path = line_agent, sales, sheets, public
as $$
  with sys as (
    select o.order_no, nullif(btrim(o.work_order_no), '') as wo, o.required_finish_on as due_on,
           'ต้องเสร็จ'::text as due_kind,
           (array_agg(l.description order by l.line_no))[1] as first_item, count(l.id)::int as item_count,
           'ระบบ'::text as source
    from sales.orders o
    left join sales.order_lines l
      on l.order_id = o.id and line_agent.is_production_line(l.variant_id, l.description)
    where o.status = 'ยืนยันแล้ว' and o.required_finish_on between p_from and p_to
    group by o.id
  ),
  sh as (
    select s.bls, s.wo, s.delivery_on, 'ส่ง'::text,
           coalesce((select p.name from sheets.po_lines p where p.bls = s.bls order by p.line_no limit 1),
                    split_part(s.items_text, E'\n', 1)),
           coalesce((select count(*)::int from sheets.po_lines p where p.bls = s.bls), 1),
           'ชีต'::text
    from sheets.orders s
    where s.delivery_on between p_from and p_to
      and not exists (select 1 from sales.orders o where line_agent.norm_order_no(o.order_no) = s.bls)
  )
  select * from (select * from sys union all select * from sh) u
  order by due_on, order_no
  limit 30
$$;

create or replace function line_agent.room_orders_overdue()
returns table (order_no text, wo text, due_on date, due_kind text,
               first_item text, item_count int, source text)
language sql stable security definer
set search_path = line_agent, public
as $$
  select * from line_agent.room_orders_due(line_agent.today() - 30, line_agent.today() - 1)
$$;

-- ออเดอร์ในชีตที่กำหนดส่งเป็นข้อความ แปลเป็นวันไม่ได้ · ให้บอทบอกจำนวนไว้ ไม่เงียบ
create or replace function line_agent.room_orders_undated()
returns int
language sql stable security definer
set search_path = sheets, public
as $$
  select count(*)::int from sheets.orders
  where delivery_on is null and ordered_on >= line_agent.today() - 120
$$;

-- สต็อก · ระบบ + ชีตสินค้า + ชีตผ้า/หนัง + คลังวัสดุ · ทุกคำต้องเจอ
drop function if exists line_agent.room_stock(text);
create or replace function line_agent.room_stock(p_query text)
returns table (kind text, item text, location text, status text, units numeric, source text)
language sql stable security definer
set search_path = line_agent, stock, catalog, sheets, public
as $$
  with words as (
    select w from regexp_split_to_table(lower(btrim(coalesce(p_query,''))), '\s+') w where length(w) > 0
  ),
  sys as (
    select 'สินค้า'::text as kind,
           concat_ws(' · ', p.collection, nullif(p.name_th,''), v.configuration, v.material_grade,
                     nullif(concat_ws(' ', v.wood_type, v.wood_colour), '')) as item,
           loc.name as location, u.status::text as status, count(*)::numeric as units, 'ระบบ'::text as source,
           lower(concat_ws(' ', p.collection, p.name_th, p.name_en, v.configuration, v.material_grade,
                           v.wood_type, v.wood_colour, v.legacy_fullname)) as hay
    from stock.units u
    join catalog.product_variants v on v.id = u.variant_id
    join catalog.products p         on p.id = v.product_id
    join stock.locations loc        on loc.id = u.location_id
    where u.status <> 'ส่งแล้ว'
    group by 1, 2, 3, 4, 6, 7
  ),
  sh as (
    select 'สินค้า', concat_ws(' · ', s.product, nullif(s.material,''), nullif(s.color,''), nullif(s.size,'')),
           (select string_agg(e.key || ' ' || e.value, ' · ' order by e.key)
              from jsonb_each_text(s.by_place) e where btrim(e.value) not in ('', '0')),
           null::text, s.total, 'ชีต',
           lower(concat_ws(' ', s.product, s.brand, s.category, s.material, s.color, s.size))
    from sheets.stock s
  ),
  fab as (
    select 'วัสดุ', concat_ws(' · ', f.group_name, f.name), null::text,
           coalesce(f.stock_text, '—'), f.stock, 'ชีต',
           lower(concat_ws(' ', f.group_name, f.name, 'ผ้า หนัง วัสดุ'))
    from sheets.fabric f
  ),
  mats as (
    select 'วัสดุ', concat_ws(' · ', c.pricing_grade, m.name, m.colour_name), null::text,
           m.status::text, null::numeric, 'ระบบ',
           lower(concat_ws(' ', c.pricing_grade, c.name_en, c.name_th, m.name, m.colour_name, m.code, 'ผ้า หนัง วัสดุ'))
    from materials.materials m
    join materials.material_collections c on c.id = m.collection_id
  ),
  allrows as (select * from sys union all select * from sh union all select * from fab union all select * from mats)
  select kind, item, location, status, units, source
  from allrows a
  where exists (select 1 from words)
    and not exists (select 1 from words where position(w in a.hay) = 0)
  order by kind desc, item
  limit 20
$$;

-- Clearance · เลยวันหมดอายุ = ไม่คืนราคา
create or replace function line_agent.room_clearance(p_query text)
returns jsonb
language sql stable security definer
set search_path = line_agent, sheets, public
as $$
  with src as (select expires_on from sheets.sources where id = 'clearance'),
  words as (
    select w from regexp_split_to_table(lower(btrim(coalesce(p_query,''))), '\s+') w where length(w) > 0
  ),
  hit as (
    select c.* from sheets.clearance c
    where not exists (select 1 from words
                      where position(w in lower(concat_ws(' ', c.full_name, c.code, c.collection, c.name_en,
                                                         c.wood, c.wood_colour, c.upholstery_colour))) = 0)
    order by c.row_no limit 10
  )
  select jsonb_build_object(
    'expires_on', (select expires_on from src),
    'expired', (select expires_on < line_agent.today() from src),
    'updated_at', (select last_ok_at from sheets.sources where id = 'clearance'),
    'total', (select count(*) from hit),
    'items', case when (select expires_on < line_agent.today() from src) then '[]'::jsonb
                  else coalesce((select jsonb_agg(jsonb_build_object(
                         'name', h.full_name, 'retail', h.retail, 'disc', h.disc_pct, 'price', h.price)
                         order by h.row_no) from hit h), '[]'::jsonb) end)
$$;

-- ข้อมูลเก่าแค่ไหน · บอทใช้ตัดสินว่าต้องดึงใหม่ก่อนตอบไหม
create or replace function line_agent.sheets_age_minutes()
returns int
language sql stable security definer
set search_path = sheets, public
as $$
  select coalesce(extract(epoch from now() - min(last_ok_at))::int / 60, 99999)
  from sheets.sources
$$;

-- ---------------------------------------------------------------------------
-- สิทธิ์
-- ---------------------------------------------------------------------------
alter table sheets.sources   enable row level security;
alter table sheets.orders    enable row level security;
alter table sheets.po_lines  enable row level security;
alter table sheets.stock     enable row level security;
alter table sheets.fabric    enable row level security;
alter table sheets.clearance enable row level security;

-- หน้าหลังบ้าน (Bay) ดูสถานะการดึงได้
create policy sources_admin on sheets.sources for select to authenticated using (core.has_capability('admin'));

grant usage on schema sheets to authenticated, service_role;
grant select on sheets.sources to authenticated;

revoke all on all functions in schema sheets from public, anon, authenticated;
grant execute on function sheets.replace_source(text, jsonb, jsonb), sheets.mark_failed(text, text),
  sheets.list_sources() to service_role;
grant execute on function sheets.safe_delivery_text(text) to service_role;

revoke all on function line_agent.room_order(text), line_agent.room_orders_due(date, date),
  line_agent.room_orders_overdue(), line_agent.room_orders_undated(), line_agent.room_stock(text),
  line_agent.room_clearance(text), line_agent.sheets_age_minutes() from public, anon, authenticated;
grant execute on function line_agent.room_order(text), line_agent.room_orders_due(date, date),
  line_agent.room_orders_overdue(), line_agent.room_orders_undated(), line_agent.room_stock(text),
  line_agent.room_clearance(text), line_agent.sheets_age_minutes() to service_role;

alter role authenticator
  set pgrst.db_schemas = 'public, graphql_public, core, catalog, materials, pricing, cost, marketing, stock, content, crm, sales, line_agent, sheets';
notify pgrst, 'reload config';

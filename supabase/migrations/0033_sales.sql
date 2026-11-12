-- ============================================================================
-- 0033 · โมดูลออเดอร์
-- ============================================================================
-- แทนชีต order2026 ใน Chaw Cher Order Tracking · สิ่งที่ชีตทำไม่ได้และตารางนี้ทำ
--
--   O1 ชีตไม่มีช่อง "สถานะ" เลยสักช่อง (ตรวจครบ 63 คอลัมน์แล้ว)
--      → สถานะอยู่ในหัวคนกับในแชท จึงต้องถามกันในกลุ่มทุกครั้งที่ลูกค้าทัก
--      ★ ที่นี่ "สถานะ" ไม่มีช่องให้ใครพิมพ์ · คำนวณสดจากสิ่งที่เกิดขึ้นจริง
--
--   O2 ชีตมีคอลัมน์ ต้นทุน ปนอยู่กับทุกคน ขัดกฎที่ Bay ตั้งเองว่าต้นทุนเห็นได้แค่เจ้าของ
--      → ที่นี่ไม่มีช่องต้นทุนเลย ต้นทุนอยู่ schema cost ซึ่งต้องมีสิทธิ์ cost.read
--
--   O3 ชีตมีคอลัมน์ Balance ที่คนพิมพ์เอง ทั้งที่คำนวณได้
--      → ที่นี่ไม่มีช่อง Balance · คำนวณจากยอดขายลบยอดที่รับชำระจริง (กฎ A10)
--
--   O4 ชีต 1 ออเดอร์กินหลายแถว ที่อยู่อยู่แถวหนึ่ง เบอร์อยู่อีกแถว
--      → ที่นี่ 1 ออเดอร์ = 1 แถว · รายการสินค้าอยู่ตารางลูก
--
-- ★ ไม่ออกเลข BLS ให้เอง · ยังไม่รู้กติกาการออกเลขของบริษัท (คำถาม OQ1)
--   ให้คนกรอกเลขที่ใช้อยู่จริง ระบบกันซ้ำให้ · ออกเลขเองตอนรู้กติกาแล้ว
-- ============================================================================

create schema if not exists sales;

-- สถานะของ "เอกสาร" ไม่ใช่สถานะของ "งาน" · สถานะงานคำนวณเอาจากของจริง
create type sales.order_status as enum ('ร่าง', 'ยืนยันแล้ว', 'ยกเลิก');

create type sales.channel as enum ('ขายตรง', 'NocNoc', 'ASE', 'อื่นๆ');

-- ช่องทางรับเงินตามที่เจอในชีตจริง · เพิ่มได้ภายหลังด้วย alter type
create type sales.payment_method as enum
  ('โอน SCB/TTB', 'บัตรเครดิต', 'ผ่าน ASE', 'NocNoc', 'เงินสด', 'อื่นๆ');

-- VAT อยู่ที่เดียว · วันไหนอัตราเปลี่ยน แก้ตรงนี้จุดเดียว
create or replace function sales.vat_rate() returns numeric
language sql immutable as $$ select 0.07::numeric $$;

-- ---------------------------------------------------------------------------
-- ออเดอร์
-- ---------------------------------------------------------------------------
create table sales.orders (
  id                   uuid primary key default gen_random_uuid(),
  order_no             text not null unique check (btrim(order_no) <> ''),

  customer_id          uuid not null references crm.customers(id),
  billing_address_id   uuid references crm.customer_addresses(id),
  shipping_address_id  uuid references crm.customer_addresses(id),

  channel              sales.channel not null default 'ขายตรง',
  external_ref         text,          -- เลขที่ใบสั่งซื้อฝั่งลูกค้า/มาร์เก็ตเพลส
  work_order_no        text,          -- w/o ในชีต เช่น "10/26"
  tax_invoice_no       text,          -- ใบกำกับ / ใบชมพู

  ordered_on           date not null default current_date,
  required_finish_on   date,          -- วันที่ต้องการให้ผลิตเสร็จ
  promised_delivery_on date,          -- กำหนดส่งของที่รับปากลูกค้า

  shipping_fee_incl_vat numeric(12,2) not null default 0 check (shipping_fee_incl_vat >= 0),
  commission_pct        numeric(5,2)  check (commission_pct >= 0 and commission_pct <= 100),

  status               sales.order_status not null default 'ร่าง',
  cancel_reason        text,
  note                 text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references core.app_users(id),

  constraint cancel_needs_reason
    check (status <> 'ยกเลิก' or btrim(coalesce(cancel_reason,'')) <> ''),
  constraint finish_before_delivery
    check (required_finish_on is null or promised_delivery_on is null
           or required_finish_on <= promised_delivery_on)
);

create index orders_customer_idx on sales.orders (customer_id);
create index orders_status_idx   on sales.orders (status) where status <> 'ยกเลิก';
create index orders_delivery_idx on sales.orders (promised_delivery_on)
  where status = 'ยืนยันแล้ว';

comment on table sales.orders is
  '1 ออเดอร์ = 1 แถว · ไม่มีช่องต้นทุน (อยู่ schema cost) และไม่มีช่องยอดค้าง (คำนวณสด)';
comment on column sales.orders.order_no is
  'เลขที่ออเดอร์ที่บริษัทใช้จริง เช่น BLS3167 · คนกรอกเอง ระบบกันซ้ำ · '
  'ยังไม่ออกเลขให้อัตโนมัติเพราะยังไม่รู้กติกาการออกเลข';
comment on column sales.orders.status is
  'สถานะของเอกสาร ไม่ใช่สถานะของงาน · สถานะงาน (ผลิต/QC/ชำระ/ส่ง) คำนวณจากของจริง ดู v_orders';

-- ---------------------------------------------------------------------------
-- รายการในออเดอร์
-- ---------------------------------------------------------------------------
create table sales.order_lines (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references sales.orders(id),
  line_no             int  not null check (line_no > 0),

  -- ชี้ไปที่สินค้าที่มี SKU แล้ว · ว่างได้สำหรับของเก่าที่ยกมาจากชีตซึ่งเป็นข้อความอิสระ
  variant_id          uuid references catalog.product_variants(id),
  description         text not null check (btrim(description) <> ''),

  qty                 numeric(10,2) not null check (qty > 0),
  unit_price_incl_vat numeric(12,2) not null check (unit_price_incl_vat >= 0),
  note                text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references core.app_users(id),

  unique (order_id, line_no)
);

create index order_lines_order_idx   on sales.order_lines (order_id);
create index order_lines_variant_idx on sales.order_lines (variant_id)
  where variant_id is not null;

comment on table sales.order_lines is
  'รายการสินค้าในออเดอร์ · ไม่มีช่องยอดรวมบรรทัด เพราะ qty × ราคา คำนวณได้ (กฎ A10)';
comment on column sales.order_lines.description is
  'ข้อความรายการตามที่คนขายเขียน · เก็บไว้เสมอแม้ชี้ SKU ได้แล้ว '
  'เพราะเป็นสิ่งที่ลูกค้าเห็นในใบเสนอราคาและเป็นหลักฐานว่าตกลงอะไรกัน';

-- ---------------------------------------------------------------------------
-- การรับชำระ · งานของพี่ษา
-- ---------------------------------------------------------------------------
create table sales.order_payments (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references sales.orders(id),

  paid_on          date not null default current_date,
  amount_incl_vat  numeric(12,2) not null check (amount_incl_vat > 0),
  method           sales.payment_method not null,
  ref              text,              -- เลขอ้างอิงสลิป/รายการโอน
  note             text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references core.app_users(id)
);

create index order_payments_order_idx on sales.order_payments (order_id);

comment on table sales.order_payments is
  'รับชำระทีละครั้ง มัดจำก็เป็นแถวหนึ่ง · ยอดค้างคำนวณจากตารางนี้ ไม่มีใครพิมพ์ได้ · '
  'แก้ได้ถ้ากรอกผิด แต่ลบไม่ได้ (กฎ A7) และทุกการแก้ลงประวัติ';

-- ---------------------------------------------------------------------------
-- กฎมาตรฐาน
-- ---------------------------------------------------------------------------
select core.apply_standard_rules('sales.orders');
select core.apply_standard_rules('sales.order_lines');
select core.apply_standard_rules('sales.order_payments');

create trigger audit_sales_orders after insert or update on sales.orders
  for each row execute function core.write_audit();
create trigger audit_sales_order_lines after insert or update on sales.order_lines
  for each row execute function core.write_audit();
create trigger audit_sales_order_payments after insert or update on sales.order_payments
  for each row execute function core.write_audit();

-- ---------------------------------------------------------------------------
-- ยอดเงินของแต่ละออเดอร์ · ทุกตัวเลขคำนวณสด ไม่มีช่องให้ใครแก้
-- ---------------------------------------------------------------------------
create view sales.v_order_totals with (security_invoker = true) as
select
  o.id                                                           as order_id,
  coalesce(l.goods_total, 0)                                     as "ยอดสินค้า",
  o.shipping_fee_incl_vat                                        as "ค่าขนส่ง",
  (coalesce(l.goods_total, 0) + o.shipping_fee_incl_vat)
    ::numeric(14,2)                                              as "ยอดรวม",
  ((coalesce(l.goods_total, 0) + o.shipping_fee_incl_vat)
     / (1 + sales.vat_rate()))::numeric(14,2)                    as "ยอดก่อน VAT",
  coalesce(p.paid_total, 0)::numeric(14,2)                       as "รับชำระแล้ว",
  (coalesce(l.goods_total, 0) + o.shipping_fee_incl_vat
     - coalesce(p.paid_total, 0))::numeric(14,2)                 as "ยอดค้าง"
from sales.orders o
left join lateral (
  select sum(ol.qty * ol.unit_price_incl_vat) as goods_total
  from sales.order_lines ol where ol.order_id = o.id
) l on true
left join lateral (
  select sum(op.amount_incl_vat) as paid_total
  from sales.order_payments op where op.order_id = o.id
) p on true;

comment on view sales.v_order_totals is
  'ยอดรวม ยอดก่อน VAT รับชำระแล้ว ยอดค้าง · คำนวณสดทุกครั้ง '
  'แทนคอลัมน์ Balance ในชีตที่คนพิมพ์เองแล้วเพี้ยน (ข้อ O3)';

-- ---------------------------------------------------------------------------
-- ★ สถานะคำนวณสด · ไม่มีช่องให้ใครพิมพ์ จึงโกหกไม่ได้
-- ---------------------------------------------------------------------------
-- วันนี้คำนวณได้แค่มิติ "เงิน" เพราะโมดูล QC และจัดส่งยังไม่มี
-- พอโมดูลพวกนั้นมา ให้เพิ่มเงื่อนไขใน case ข้างล่างนี้ ไม่ต้องเพิ่มช่องใหม่ในตาราง
--   · ผลิตเสร็จ   → มี stock.units ผูกกับบรรทัดในออเดอร์นี้
--   · ผ่าน QC    → มีผลตรวจว่าผ่าน
--   · ส่งแล้ว     → มีบันทึกการจัดส่งถึงมือลูกค้า
-- ---------------------------------------------------------------------------
create view sales.v_orders with (security_invoker = true) as
select
  o.id,
  o.order_no                                   as "เลขที่",
  c.name                                       as "ลูกค้า",
  sa.label                                     as "ส่งที่",
  o.channel::text                              as "ช่องทาง",
  o.ordered_on                                 as "วันที่สั่ง",
  o.required_finish_on                         as "ต้องผลิตเสร็จ",
  o.promised_delivery_on                       as "กำหนดส่ง",
  t."ยอดรวม",
  t."รับชำระแล้ว",
  t."ยอดค้าง",
  case
    when o.status = 'ยกเลิก'                              then 'ยกเลิก'
    when o.status = 'ร่าง'                                then 'ร่าง'
    when t."ยอดรวม" <= 0                                   then 'ยังไม่มีรายการ'
    when t."ยอดค้าง" <= 0                                  then 'ชำระครบ'
    when t."รับชำระแล้ว" > 0                                then 'ชำระบางส่วน'
    else                                                       'รอชำระ'
  end                                          as "สถานะการเงิน",
  (o.status = 'ยืนยันแล้ว'
     and o.promised_delivery_on is not null
     and o.promised_delivery_on < current_date
     and t."ยอดค้าง" > 0)                       as "เลยกำหนดส่งและยังค้างเงิน",
  o.status::text                               as "สถานะเอกสาร",
  o.work_order_no                              as "w/o",
  o.created_at
from sales.orders o
join crm.customers c                   on c.id = o.customer_id
left join crm.customer_addresses sa    on sa.id = o.shipping_address_id
join sales.v_order_totals t            on t.order_id = o.id;

comment on view sales.v_orders is
  'รายการออเดอร์พร้อมสถานะที่คำนวณสด · ไม่มีช่องสถานะให้ใครพิมพ์ จึงไม่มีทางเพี้ยน (แก้ข้อ O1)';

-- รายการที่ต้องตามวันนี้
create view sales.v_today with (security_invoker = true) as
select * from sales.v_orders
where "สถานะเอกสาร" = 'ยืนยันแล้ว'
  and ("เลยกำหนดส่งและยังค้างเงิน" or "ยอดค้าง" > 0)
order by "กำหนดส่ง" nulls last, "เลขที่";

comment on view sales.v_today is 'ออเดอร์ที่ยังค้างเงินหรือเลยกำหนดส่ง · หน้าแรกของฝ่ายขายและพี่ษา';

-- ---------------------------------------------------------------------------
-- ฟังก์ชัน
-- ---------------------------------------------------------------------------
create or replace function sales.create_order(
  p_order_no            text,
  p_customer_id         uuid,
  p_channel             sales.channel default 'ขายตรง',
  p_shipping_address_id uuid default null,
  p_billing_address_id  uuid default null,
  p_ordered_on          date default null
) returns uuid
language plpgsql security definer
set search_path = core, crm, sales, catalog, public
as $$
declare v_id uuid; v_no text;
begin
  if not core.has_capability('sales.write') then
    raise exception 'ต้องมีสิทธิ์ sales.write จึงจะสร้างออเดอร์ได้'
      using errcode = 'insufficient_privilege';
  end if;

  v_no := upper(btrim(coalesce(p_order_no, '')));
  if v_no = '' then raise exception 'ต้องระบุเลขที่ออเดอร์'; end if;
  if exists (select 1 from sales.orders where order_no = v_no) then
    raise exception 'เลขที่ออเดอร์ % มีอยู่แล้ว', v_no;
  end if;

  insert into sales.orders
    (order_no, customer_id, channel, shipping_address_id, billing_address_id, ordered_on)
  values
    (v_no, p_customer_id, p_channel, p_shipping_address_id, p_billing_address_id,
     coalesce(p_ordered_on, current_date))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function sales.add_order_line(
  p_order_id    uuid,
  p_description text,
  p_qty         numeric,
  p_unit_price  numeric,
  p_variant_id  uuid default null,
  p_note        text default null
) returns uuid
language plpgsql security definer
set search_path = core, crm, sales, catalog, public
as $$
declare v_id uuid; v_no int; v_status sales.order_status;
begin
  if not core.has_capability('sales.write') then
    raise exception 'ต้องมีสิทธิ์ sales.write จึงจะเพิ่มรายการได้'
      using errcode = 'insufficient_privilege';
  end if;

  select status into v_status from sales.orders where id = p_order_id;
  if not found then raise exception 'ไม่พบออเดอร์ที่อ้างถึง'; end if;
  if v_status = 'ยกเลิก' then raise exception 'ออเดอร์ถูกยกเลิกแล้ว เพิ่มรายการไม่ได้'; end if;

  select coalesce(max(line_no), 0) + 1 into v_no
  from sales.order_lines where order_id = p_order_id;

  insert into sales.order_lines
    (order_id, line_no, variant_id, description, qty, unit_price_incl_vat, note)
  values
    (p_order_id, v_no, p_variant_id, btrim(p_description), p_qty, p_unit_price, p_note)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function sales.confirm_order(p_order_id uuid)
returns void
language plpgsql security definer
set search_path = core, crm, sales, catalog, public
as $$
declare n int;
begin
  if not core.has_capability('sales.write') then
    raise exception 'ต้องมีสิทธิ์ sales.write จึงจะยืนยันออเดอร์ได้'
      using errcode = 'insufficient_privilege';
  end if;

  select count(*) into n from sales.order_lines where order_id = p_order_id;
  if n = 0 then raise exception 'ออเดอร์ยังไม่มีรายการสินค้า ยืนยันไม่ได้'; end if;

  update sales.orders set status = 'ยืนยันแล้ว'
   where id = p_order_id and status = 'ร่าง';
  if not found then raise exception 'ยืนยันได้เฉพาะออเดอร์ที่ยังเป็นร่าง'; end if;
end;
$$;

create or replace function sales.cancel_order(p_order_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = core, crm, sales, catalog, public
as $$
begin
  if not core.has_capability('sales.write') then
    raise exception 'ต้องมีสิทธิ์ sales.write จึงจะยกเลิกออเดอร์ได้'
      using errcode = 'insufficient_privilege';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'ยกเลิกต้องบอกเหตุผล จะได้ย้อนดูได้ว่าทำไม';
  end if;

  -- ยกเลิก = เปลี่ยนสถานะ ไม่ลบ (กฎ A7) ข้อมูลยังอยู่ครบย้อนดูได้
  update sales.orders
     set status = 'ยกเลิก', cancel_reason = btrim(p_reason)
   where id = p_order_id and status <> 'ยกเลิก';
  if not found then raise exception 'ออเดอร์นี้ยกเลิกไปแล้ว หรือไม่พบ'; end if;
end;
$$;

-- งานของพี่ษา · ต้องมีสิทธิ์การเงิน ไม่ใช่สิทธิ์ขาย
create or replace function sales.record_payment(
  p_order_id uuid,
  p_amount   numeric,
  p_method   sales.payment_method,
  p_paid_on  date default null,
  p_ref      text default null,
  p_note     text default null
) returns uuid
language plpgsql security definer
set search_path = core, crm, sales, catalog, public
as $$
declare v_id uuid; v_status sales.order_status;
begin
  if not core.has_capability('finance.write') then
    raise exception 'ต้องมีสิทธิ์ finance.write จึงจะบันทึกการรับชำระได้'
      using errcode = 'insufficient_privilege';
  end if;

  select status into v_status from sales.orders where id = p_order_id;
  if not found then raise exception 'ไม่พบออเดอร์ที่อ้างถึง'; end if;
  if v_status = 'ยกเลิก' then
    raise exception 'ออเดอร์ถูกยกเลิกแล้ว บันทึกรับชำระไม่ได้';
  end if;

  insert into sales.order_payments (order_id, paid_on, amount_incl_vat, method, ref, note)
  values (p_order_id, coalesce(p_paid_on, current_date), p_amount, p_method, p_ref, p_note)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS · พนักงานดูออเดอร์ได้ทุกคน แต่คนละสิทธิ์ในการแก้
--   ขาย      → สร้าง/แก้ออเดอร์และรายการ
--   การเงิน  → บันทึกรับชำระ (พี่ษา)
--   จัดส่ง   → แก้วันนัดส่งและค่าขนส่ง (พี่ภา)
-- ---------------------------------------------------------------------------
alter table sales.orders         enable row level security;
alter table sales.order_lines    enable row level security;
alter table sales.order_payments enable row level security;

create policy orders_select on sales.orders for select to authenticated
  using (core.is_staff());
create policy orders_insert on sales.orders for insert to authenticated
  with check (core.has_capability('sales.write'));
create policy orders_update on sales.orders for update to authenticated
  using (core.has_capability('sales.write') or core.has_capability('delivery.write'))
  with check (core.has_capability('sales.write') or core.has_capability('delivery.write'));

create policy order_lines_select on sales.order_lines for select to authenticated
  using (core.is_staff());
create policy order_lines_write on sales.order_lines for all to authenticated
  using (core.has_capability('sales.write'))
  with check (core.has_capability('sales.write'));

create policy payments_select on sales.order_payments for select to authenticated
  using (core.is_staff());
create policy payments_insert on sales.order_payments for insert to authenticated
  with check (core.has_capability('finance.write'));
create policy payments_update on sales.order_payments for update to authenticated
  using (core.has_capability('finance.write'))
  with check (core.has_capability('finance.write'));

-- ---------------------------------------------------------------------------
-- สิทธิ์ระดับ schema
-- ---------------------------------------------------------------------------
grant usage on schema sales to authenticated, service_role;
grant select, insert, update on all tables in schema sales to authenticated;
grant usage, select on all sequences in schema sales to authenticated;
alter default privileges in schema sales
  grant select, insert, update on tables to authenticated;
alter default privileges in schema sales
  grant usage, select on sequences to authenticated;

revoke all on schema sales from anon;

revoke all on function sales.create_order(text, uuid, sales.channel, uuid, uuid, date) from public, anon;
revoke all on function sales.add_order_line(uuid, text, numeric, numeric, uuid, text)   from public, anon;
revoke all on function sales.confirm_order(uuid)                                        from public, anon;
revoke all on function sales.cancel_order(uuid, text)                                   from public, anon;
revoke all on function sales.record_payment(uuid, numeric, sales.payment_method, date, text, text) from public, anon;
revoke all on function sales.vat_rate()                                                 from public, anon;

grant execute on function sales.create_order(text, uuid, sales.channel, uuid, uuid, date) to authenticated;
grant execute on function sales.add_order_line(uuid, text, numeric, numeric, uuid, text)   to authenticated;
grant execute on function sales.confirm_order(uuid)                                        to authenticated;
grant execute on function sales.cancel_order(uuid, text)                                   to authenticated;
grant execute on function sales.record_payment(uuid, numeric, sales.payment_method, date, text, text) to authenticated;
grant execute on function sales.vat_rate()                                                 to authenticated;

-- ---------------------------------------------------------------------------
-- ลงทะเบียนโมดูล
-- ---------------------------------------------------------------------------
insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability,
   home_path, sort_order, is_core, description_th) values
  ('sales', 'ออเดอร์', 'Orders', 'receipt', 'sales',
   '{core,crm,catalog,pricing}', 'sales.write', '/orders', 4, false,
   'ออเดอร์ที่เดียว ไม่ต้องกรอกสองที่ · ยอดค้างคำนวณเอง · ไม่มีช่องสถานะให้เพี้ยน');

update core.modules set sort_order = sort_order + 1
 where id in ('materials','pricing','cost','marketing','content');

-- ⚠️ ขาดบรรทัดนี้ = REST API มองไม่เห็น schema crm และ sales ทั้งก้อน
alter role authenticator
  set pgrst.db_schemas = 'public, graphql_public, core, catalog, materials, pricing, cost, marketing, stock, content, crm, sales';

notify pgrst, 'reload config';

-- ============================================================================
-- 0032 · โมดูลลูกค้า
-- ============================================================================
-- ทำไมต้องแยกลูกค้าออกจากออเดอร์ · เหตุผลมาจากข้อมูลจริงในชีต order2026
--
--   BLS3167  บจก.อุรา กรุงเทพ คลินิก   ส่งที่ สาขา C KHON
--   BLS3168  บจก.อุรา กรุงเทพ คลินิก   ส่งที่ สาขา KHON
--
-- ลูกค้าเดียวกัน คนละสาขา คนละที่ส่ง · วันนี้พิมพ์ชื่อซ้ำทุกใบ
-- เบอร์โทรเปลี่ยนทีต้องไล่แก้ทุกแถวที่เคยสั่ง และไม่มีทางรู้ว่าใครสั่งซ้ำบ้าง
--
-- โครงจึงเป็น  ลูกค้า → ที่อยู่/สาขา → ออเดอร์  ไม่ใช่ยัดรวมแถวเดียว
--
-- ★ ไม่ออกรหัสลูกค้าเอง · ยังไม่รู้ว่าบริษัทมีระบบรหัสลูกค้าอยู่แล้วหรือไม่
--   ตั้งเองแล้วชนกับของเดิมจะแก้ยากกว่าไม่ตั้ง (คำถาม CQ1)
-- ============================================================================

create schema if not exists crm;

create type crm.customer_kind   as enum ('บุคคล', 'นิติบุคคล');
create type crm.customer_status as enum ('ใช้งาน', 'ไม่ใช้งาน');
create type crm.address_kind    as enum ('ใบกำกับภาษี', 'จัดส่ง', 'ทั้งสองอย่าง');

-- ---------------------------------------------------------------------------
-- ลูกค้า
-- ---------------------------------------------------------------------------
create table crm.customers (
  id           uuid primary key default gen_random_uuid(),
  kind         crm.customer_kind   not null default 'บุคคล',
  name         text not null check (btrim(name) <> ''),

  tax_id       text,
  email        text,
  phone        text,
  line_id      text,
  facebook     text,
  instagram    text,

  note         text,
  status       crm.customer_status not null default 'ใช้งาน',

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references core.app_users(id)
);

-- นิติบุคคลหนึ่งรายมีเลขผู้เสียภาษีเดียว · กันสร้างซ้ำตั้งแต่ในฐานข้อมูล
create unique index customers_tax_id_uniq on crm.customers (tax_id)
  where tax_id is not null and btrim(tax_id) <> '';

-- ค้นชื่อ · ไม่บังคับ unique เพราะคนชื่อซ้ำกันมีจริง
create index customers_name_idx on crm.customers (lower(name));

comment on table crm.customers is
  'ลูกค้า 1 ราย = 1 แถว · สาขาและที่อยู่อยู่คนละตาราง · เลิกใช้ = เปลี่ยน status ไม่ลบ (กฎ A7)';
comment on column crm.customers.phone is
  'เบอร์หลักของลูกค้า · เบอร์ของแต่ละสาขาอยู่ที่ตารางที่อยู่ เพราะคนละสาขาคนละคนรับสาย';

-- ---------------------------------------------------------------------------
-- ที่อยู่ / สาขา
-- ---------------------------------------------------------------------------
create table crm.customer_addresses (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references crm.customers(id),

  label         text not null check (btrim(label) <> ''),
  kind          crm.address_kind not null default 'จัดส่ง',
  address       text not null check (btrim(address) <> ''),

  contact_name  text,
  contact_phone text,

  is_default    boolean not null default false,
  status        crm.customer_status not null default 'ใช้งาน',
  note          text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references core.app_users(id)
);

create index customer_addresses_customer_idx
  on crm.customer_addresses (customer_id) where status = 'ใช้งาน';

-- ที่อยู่ตั้งต้นมีได้ที่เดียวต่อลูกค้าหนึ่งราย
create unique index customer_addresses_one_default
  on crm.customer_addresses (customer_id) where is_default and status = 'ใช้งาน';

comment on table crm.customer_addresses is
  'สาขา/ที่อยู่ของลูกค้า · 1 ลูกค้ามีได้หลายที่ · label คือชื่อที่คนเรียกกัน เช่น "สาขา C KHON"';

-- ---------------------------------------------------------------------------
-- กฎมาตรฐาน · ห้ามลบ + updated_at ขยับเอง + ประวัติการแก้
-- ---------------------------------------------------------------------------
select core.apply_standard_rules('crm.customers');
select core.apply_standard_rules('crm.customer_addresses');

create trigger audit_crm_customers after insert or update on crm.customers
  for each row execute function core.write_audit();
create trigger audit_crm_customer_addresses after insert or update on crm.customer_addresses
  for each row execute function core.write_audit();

-- ---------------------------------------------------------------------------
-- วิว · ลูกค้าพร้อมที่อยู่ สำหรับหน้าจอค้นหา
-- ---------------------------------------------------------------------------
create view crm.v_customers with (security_invoker = true) as
select
  c.id,
  c.name                                        as "ชื่อลูกค้า",
  c.kind::text                                  as "ประเภท",
  c.tax_id                                      as "เลขผู้เสียภาษี",
  c.phone                                       as "เบอร์",
  c.email                                       as "อีเมล",
  c.line_id                                     as "LINE",
  c.status::text                                as "สถานะ",
  count(a.id) filter (where a.status = 'ใช้งาน') as "จำนวนที่อยู่",
  c.created_at
from crm.customers c
left join crm.customer_addresses a on a.customer_id = c.id
group by c.id;

comment on view crm.v_customers is 'รายชื่อลูกค้าพร้อมจำนวนสาขา · ใช้ในหน้าค้นหาลูกค้า';

-- ---------------------------------------------------------------------------
-- RLS · พนักงานทุกคนดูลูกค้าได้ แต่แก้ได้เฉพาะฝ่ายขายกับฝ่ายดูแลลูกค้า
-- เหตุผล: คนจัดส่งต้องเห็นที่อยู่ คนเก็บเงินต้องเห็นชื่อ แต่ไม่ควรแก้ข้อมูลลูกค้า
-- ---------------------------------------------------------------------------
alter table crm.customers          enable row level security;
alter table crm.customer_addresses enable row level security;

create policy customers_select on crm.customers for select to authenticated
  using (core.is_staff());
create policy customers_write on crm.customers for all to authenticated
  using (core.has_capability('sales.write') or core.has_capability('cs.write'))
  with check (core.has_capability('sales.write') or core.has_capability('cs.write'));

create policy addresses_select on crm.customer_addresses for select to authenticated
  using (core.is_staff());
create policy addresses_write on crm.customer_addresses for all to authenticated
  using (core.has_capability('sales.write') or core.has_capability('cs.write'))
  with check (core.has_capability('sales.write') or core.has_capability('cs.write'));

-- ---------------------------------------------------------------------------
-- สิทธิ์ระดับ schema
-- ---------------------------------------------------------------------------
grant usage on schema crm to authenticated, service_role;
grant select, insert, update on all tables in schema crm to authenticated;
grant usage, select on all sequences in schema crm to authenticated;
alter default privileges in schema crm
  grant select, insert, update on tables to authenticated;
alter default privileges in schema crm
  grant usage, select on sequences to authenticated;

revoke all on schema crm from anon;

-- ---------------------------------------------------------------------------
-- ลงทะเบียนโมดูล
-- ---------------------------------------------------------------------------
insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability,
   home_path, sort_order, is_core, description_th) values
  ('crm', 'ลูกค้า', 'Customers', 'users', 'crm',
   '{core}', 'sales.write', '/customers', 3, false,
   'ลูกค้า 1 ราย 1 แถว · หลายสาขาหลายที่ส่ง · ไม่ต้องพิมพ์ชื่อซ้ำทุกออเดอร์');

update core.modules set sort_order = sort_order + 1
 where id in ('materials','pricing','cost','marketing','content');

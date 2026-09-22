-- ============================================================================
-- 0019 · โมดูลคลัง · นับเป็น "ตัว" ไม่ใช่ "จำนวน"
-- ============================================================================
-- เอกสารหัวข้อ 7: "Kiwi ผ้าเทา มี 4 ตัว" ใช้ไม่ได้ เพราะแต่ละตัวมีชะตาชีวิตต่างกัน
-- ตัวหนึ่งจองแล้ว ตัวหนึ่งมีตำหนิ ตัวหนึ่งยืมไปออกแฟร์และยังไม่กลับ
-- เลขจำนวนบอกไม่ได้สักเรื่อง
--
-- ★ ช่อง "กำหนดกลับ" คือช่องที่ทำเงิน (คำของ Bay เอง)
--   ของที่ยืมไปโชว์แล้วไม่มีใครตามคืน คือสินค้าที่จมอยู่ในมือคนอื่นโดยไม่มีใครรู้
--
-- ★ การย้ายของต้องง่ายกว่าการไม่ย้าย
--   ถ้าต้องเปิดคอมกรอกฟอร์ม จะไม่มีใครทำ แล้วข้อมูลจะเน่าภายในเดือนเดียว
--   ฟังก์ชัน move_unit จึงรับแค่ "ตัวไหน ไปไหน" พอ ที่เหลือระบบเติมเอง
-- ============================================================================

create schema if not exists stock;

-- ---------------------------------------------------------------------------
-- ที่อยู่ของ · 4 ที่ประจำ + "อื่นๆ" ที่ต้องกำกับได้เสมอ
-- Bay: "บางทีเบิกไปออกแฟร์ 10 วัน ก็ต้องระบุได้ว่าแฟร์ไหน"
-- ---------------------------------------------------------------------------
create type stock.location_kind as enum
  ('โกดัง', 'โชว์รูม', 'บ้าน/ที่พัก', 'สตูดิโอ', 'งานอีเวนต์', 'อื่นๆ');

create table stock.locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  kind        stock.location_kind not null,
  is_fixed    boolean not null default false,
  note        text,
  status      core.lifecycle_status not null default 'ขายอยู่',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references core.app_users(id)
);

comment on table stock.locations is
  'ที่อยู่ของสินค้า · is_fixed = ที่ประจำ ลบไม่ได้ · ที่ชั่วคราวเช่นงานแฟร์ สร้างเพิ่มได้เรื่อยๆ';
comment on column stock.locations.is_fixed is
  'true = ที่ประจำที่ Bay กำหนดไว้ · false = ที่ชั่วคราวที่คลังสร้างเอง เช่น แฟร์ BITEC';

insert into stock.locations (name, kind, is_fixed, note) values
  ('โกดัง ASE',        'โกดัง',      true, 'คลังจริง ของส่วนใหญ่อยู่ที่นี่'),
  ('Showroom',         'โชว์รูม',    true, null),
  ('ฌ เฌอ โฮม',        'บ้าน/ที่พัก', true, 'แบรนด์ย่อย บ้านสำเร็จรูป + บ้านให้เช่าถ่ายรูป'),
  ('ชอบใจ Studio',     'สตูดิโอ',    true, 'สตูดิโอที่เรา sponsor เฟอร์นิเจอร์ให้ ไม่ใช่ธุรกิจของเรา');

-- ---------------------------------------------------------------------------
-- สถานะของแต่ละตัว · ตามเอกสารหัวข้อ 7 เป๊ะ
-- ---------------------------------------------------------------------------
create type stock.unit_status as enum
  ('พร้อมขาย', 'จองแล้ว', 'ตำหนิ', 'ยืมออก', 'ส่งแล้ว');

-- ---------------------------------------------------------------------------
-- รหัสตัว · U + เลขวิ่ง 7 หลัก
--
-- ต่างจาก SKU ตรงที่ไม่ต้องมีเลขตรวจทาน เพราะ SKU ถูกพิมพ์ลงใบเสนอราคา
-- และไฟล์ข้างนอกที่ไม่มีฐานข้อมูลคอยตรวจ ส่วนรหัสตัวใช้ในระบบเราเท่านั้น
-- พิมพ์ผิดเมื่อไหร่ระบบหาไม่เจอทันที
--
-- ขึ้นต้นด้วย U เพื่อไม่ให้สับสนกับ SKU ที่เป็นตัวเลขล้วน 8 หลัก
-- คนละอย่างกันแต่อยู่บนสติกเกอร์ใบเดียวกัน ถ้าหน้าตาเหมือนกันจะอ่านผิดแน่
-- ---------------------------------------------------------------------------
create sequence stock.unit_code_seq start 1;

create or replace function stock.next_unit_code()
returns text
language sql volatile
set search_path = stock, public
as $$ select 'U' || lpad(nextval('stock.unit_code_seq')::text, 7, '0') $$;

-- ---------------------------------------------------------------------------
-- ตัวสินค้าจริงแต่ละตัว
-- ---------------------------------------------------------------------------
create table stock.units (
  id            uuid primary key default gen_random_uuid(),
  unit_code     text not null unique default stock.next_unit_code(),
  variant_id    uuid not null references catalog.product_variants(id),
  location_id   uuid not null references stock.locations(id),
  status        stock.unit_status not null default 'พร้อมขาย',

  -- ประวัติการผลิต · Bay: "track back ได้ว่าผลิตที่ไหน วันไหน ใครผลิตส่วนไหนบ้าง"
  serial_no     text,
  made_at       text,
  made_on       date,
  made_by       text,

  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references core.app_users(id)
);

create index on stock.units (variant_id);
create index on stock.units (location_id);
create index on stock.units (status);

comment on table stock.units is
  '1 แถว = ของจริง 1 ตัว · ไม่ใช่จำนวน · แต่ละตัวมีที่อยู่และสถานะของตัวเอง';
comment on column stock.units.unit_code is
  'รหัสบนสติกเกอร์ · ขึ้นต้นด้วย U เพื่อไม่ให้สับสนกับ SKU ที่เป็นตัวเลขล้วน';
comment on column stock.units.made_by is
  'ใครผลิตส่วนไหน · ข้อความอิสระ เพราะยังไม่มีระบบโรงงาน จะได้ไม่บังคับรูปแบบก่อนรู้ว่าต้องการอะไร';

-- ---------------------------------------------------------------------------
-- ทุกการเคลื่อนไหว · เขียนอย่างเดียว ไม่แก้ ไม่ลบ
-- ตารางนี้คือคำตอบของ "ของหายไปไหน" ถ้าแก้ย้อนหลังได้ก็ตอบไม่ได้
-- ---------------------------------------------------------------------------
create table stock.unit_moves (
  id             bigserial primary key,
  unit_id        uuid not null references stock.units(id),
  from_location  uuid references stock.locations(id),
  to_location    uuid not null references stock.locations(id),
  from_status    stock.unit_status,
  to_status      stock.unit_status not null,
  note           text,
  moved_at       timestamptz not null default now(),
  moved_by       uuid references core.app_users(id)
);

create index on stock.unit_moves (unit_id, moved_at desc);

comment on table stock.unit_moves is
  'ประวัติการย้ายทุกครั้ง · เขียนอย่างเดียว แก้ไม่ได้ ลบไม่ได้ · '
  'เป็นที่เดียวที่ตอบได้ว่าของหายไปตอนไหน';

-- ---------------------------------------------------------------------------
-- ★ การยืมออก · หัวใจของโมดูลนี้
-- ---------------------------------------------------------------------------
create table stock.loans (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references stock.units(id),
  destination   text not null,
  borrower      text,
  purpose       text,
  out_on        date not null default current_date,
  due_back_on   date not null,
  returned_on   date,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references core.app_users(id),
  constraint due_after_out check (due_back_on >= out_on)
);

create index on stock.loans (unit_id);
create unique index loans_one_open_per_unit
  on stock.loans (unit_id) where returned_on is null;

comment on table stock.loans is
  'ยืมออก · ช่อง due_back_on คือช่องที่ทำเงิน ของที่ไม่มีใครตามคืนคือของที่จมอยู่ในมือคนอื่น';
comment on index stock.loans_one_open_per_unit is
  'ของตัวเดียวยืมออกซ้อนกันสองที่ไม่ได้ ต้องคืนก่อนถึงจะยืมใหม่';

-- ---------------------------------------------------------------------------
-- กฎมาตรฐาน · ห้ามลบ + แตะแล้ว updated_at ขยับเอง
-- unit_moves ไม่ใส่ touch เพราะไม่มีใครควรแก้มัน
-- ---------------------------------------------------------------------------
select core.apply_standard_rules('stock.locations');
select core.apply_standard_rules('stock.units');
select core.apply_standard_rules('stock.loans');

create trigger no_delete_stock_unit_moves before delete on stock.unit_moves
  for each row execute function core.prevent_delete();
create trigger no_update_stock_unit_moves before update on stock.unit_moves
  for each row execute function core.prevent_delete();

-- ที่ประจำลบไม่ได้และปิดไม่ได้
create or replace function stock.guard_fixed_location()
returns trigger
language plpgsql
set search_path = stock, core, public
as $$
begin
  if old.is_fixed and new.status <> 'ขายอยู่' then
    raise exception 'ที่ประจำ "%" ปิดไม่ได้ เพราะของยังอ้างอิงอยู่', old.name;
  end if;
  return new;
end;
$$;

create trigger guard_fixed before update on stock.locations
  for each row execute function stock.guard_fixed_location();

-- ---------------------------------------------------------------------------
-- รับของเข้า · Kiwi 4 ตัว = ออกรหัส 4 รหัสในครั้งเดียว
-- Bay เลือกข้อ ก: ของเก่าที่ไฟล์เดิมเก็บเป็นจำนวน ให้ระบบออกรหัสให้ทั้งหมด
-- แล้วคลังค่อยไล่ติดสติกเกอร์ตามทีหลัง
-- ---------------------------------------------------------------------------
create or replace function stock.receive_units(
  p_variant_id  uuid,
  p_qty         int,
  p_location_id uuid,
  p_status      stock.unit_status default 'พร้อมขาย',
  p_note        text default null
) returns setof stock.units
language plpgsql security definer
set search_path = core, stock, catalog, public
as $$
declare v_unit stock.units; i int;
begin
  if not core.has_capability('stock.write') then
    raise exception 'ต้องมีสิทธิ์ stock.write จึงจะรับของเข้าได้'
      using errcode = 'insufficient_privilege';
  end if;
  if p_qty is null or p_qty < 1 then
    raise exception 'จำนวนต้องอย่างน้อย 1 ตัว';
  end if;
  if p_qty > 500 then
    raise exception 'รับเข้าทีละไม่เกิน 500 ตัว (ขอมา % ตัว) — กันกดพลาดติดศูนย์เกิน', p_qty;
  end if;
  if not exists (select 1 from catalog.product_variants where id = p_variant_id) then
    raise exception 'ไม่พบสินค้าที่อ้างถึง';
  end if;

  for i in 1..p_qty loop
    insert into stock.units (variant_id, location_id, status, note)
    values (p_variant_id, p_location_id, p_status, p_note)
    returning * into v_unit;

    insert into stock.unit_moves (unit_id, to_location, to_status, note, moved_by)
    values (v_unit.id, p_location_id, p_status, coalesce(p_note, 'รับเข้าครั้งแรก'), auth.uid());

    return next v_unit;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- ★ ย้ายของ · ต้องจบใน 3 วินาที สแกนแล้วเลือกปลายทาง จบ
-- รับแค่สองอย่างที่คนต้องบอก ที่เหลือระบบเติมเอง (เอกสารหัวข้อ 6)
-- ---------------------------------------------------------------------------
create or replace function stock.move_unit(
  p_unit_code   text,
  p_location_id uuid,
  p_status      stock.unit_status default null,
  p_note        text default null
) returns stock.units
language plpgsql security definer
set search_path = core, stock, public
as $$
declare u stock.units; v_new_status stock.unit_status;
begin
  if not core.has_capability('stock.write') then
    raise exception 'ต้องมีสิทธิ์ stock.write จึงจะย้ายของได้'
      using errcode = 'insufficient_privilege';
  end if;

  select * into u from stock.units where unit_code = upper(trim(p_unit_code));
  if not found then
    raise exception 'ไม่พบรหัส "%" — สแกนใหม่ หรือพิมพ์รหัสบนสติกเกอร์', p_unit_code;
  end if;

  -- ไม่ได้บอกสถานะมา = ย้ายที่เฉยๆ สถานะเดิม
  v_new_status := coalesce(p_status, u.status);

  -- ของที่ยืมออกอยู่ ต้องกดคืนก่อน ไม่ใช่ย้ายเฉยๆ ไม่งั้นรายการยืมจะค้าง
  if u.status = 'ยืมออก' and v_new_status <> 'ยืมออก'
     and exists (select 1 from stock.loans where unit_id = u.id and returned_on is null) then
    raise exception 'ตัวนี้ยืมออกอยู่ ต้องกด "รับคืน" ก่อน จะได้ปิดรายการยืมให้เรียบร้อย';
  end if;

  insert into stock.unit_moves
    (unit_id, from_location, to_location, from_status, to_status, note, moved_by)
  values (u.id, u.location_id, p_location_id, u.status, v_new_status, p_note, auth.uid());

  update stock.units
     set location_id = p_location_id, status = v_new_status
   where id = u.id
  returning * into u;

  return u;
end;
$$;

-- ---------------------------------------------------------------------------
-- ยืมออก · สร้างที่ชั่วคราวให้เองถ้ายังไม่มี (เช่น "แฟร์ BITEC ต.ค. 69")
-- ---------------------------------------------------------------------------
create or replace function stock.lend_unit(
  p_unit_code   text,
  p_destination text,
  p_due_back_on date,
  p_borrower    text default null,
  p_purpose     text default null
) returns stock.loans
language plpgsql security definer
set search_path = core, stock, public
as $$
declare u stock.units; v_loc uuid; v_loan stock.loans; v_name text;
begin
  if not core.has_capability('stock.write') then
    raise exception 'ต้องมีสิทธิ์ stock.write จึงจะให้ยืมได้'
      using errcode = 'insufficient_privilege';
  end if;

  v_name := trim(p_destination);
  if coalesce(v_name, '') = '' then
    raise exception 'ต้องระบุว่ายืมไปไหน — "อื่นๆ" เฉยๆ ตามของคืนไม่ได้';
  end if;
  if p_due_back_on is null then
    raise exception 'ต้องระบุกำหนดกลับ — ไม่มีกำหนดกลับคือของที่จะหายไปเฉยๆ';
  end if;

  select * into u from stock.units where unit_code = upper(trim(p_unit_code));
  if not found then raise exception 'ไม่พบรหัส "%"', p_unit_code; end if;
  if u.status = 'ยืมออก' then
    raise exception 'ตัวนี้ยืมออกอยู่แล้ว ต้องรับคืนก่อน';
  end if;
  if u.status = 'ส่งแล้ว' then
    raise exception 'ตัวนี้ส่งลูกค้าไปแล้ว ยืมไม่ได้';
  end if;

  select id into v_loc from stock.locations where name = v_name;
  if v_loc is null then
    insert into stock.locations (name, kind, is_fixed, note)
    values (v_name, 'งานอีเวนต์', false, 'สร้างอัตโนมัติตอนให้ยืม')
    returning id into v_loc;
  end if;

  insert into stock.loans
    (unit_id, destination, borrower, purpose, due_back_on, updated_by)
  values (u.id, v_name, p_borrower, p_purpose, p_due_back_on, auth.uid())
  returning * into v_loan;

  perform stock.move_unit(u.unit_code, v_loc, 'ยืมออก',
                          'ยืมไป ' || v_name || ' กำหนดกลับ ' || p_due_back_on::text);
  return v_loan;
end;
$$;

-- ---------------------------------------------------------------------------
-- รับคืน
-- ---------------------------------------------------------------------------
create or replace function stock.return_unit(
  p_unit_code   text,
  p_location_id uuid,
  p_status      stock.unit_status default 'พร้อมขาย',
  p_note        text default null
) returns stock.units
language plpgsql security definer
set search_path = core, stock, public
as $$
declare u stock.units; v_loan uuid;
begin
  if not core.has_capability('stock.write') then
    raise exception 'ต้องมีสิทธิ์ stock.write จึงจะรับคืนได้'
      using errcode = 'insufficient_privilege';
  end if;

  select * into u from stock.units where unit_code = upper(trim(p_unit_code));
  if not found then raise exception 'ไม่พบรหัส "%"', p_unit_code; end if;

  select id into v_loan from stock.loans where unit_id = u.id and returned_on is null;
  if v_loan is null then
    raise exception 'ตัวนี้ไม่ได้ยืมออกอยู่ ถ้าจะย้ายที่เฉยๆ ใช้ปุ่มย้ายของ';
  end if;

  update stock.loans set returned_on = current_date, updated_by = auth.uid()
   where id = v_loan;

  -- ปลดสถานะยืมออกก่อน ไม่งั้นยามใน move_unit จะกันไว้
  update stock.units set status = 'พร้อมขาย' where id = u.id;

  return stock.move_unit(u.unit_code, p_location_id, p_status,
                         coalesce(p_note, 'รับคืนจากการยืม'));
end;
$$;

-- ---------------------------------------------------------------------------
-- ★ ของที่เลยกำหนดกลับ · เหตุผลที่โมดูลนี้มีอยู่
-- ---------------------------------------------------------------------------
create view stock.v_overdue_loans with (security_invoker = true) as
select
  l.id                                        as loan_id,
  u.unit_code                                 as "รหัสตัว",
  p.collection                                as "รุ่น",
  cat.name                                    as "หมวด",
  v.material_grade                            as "วัสดุ",
  l.destination                               as "ยืมไปไหน",
  l.borrower                                  as "ใครยืม",
  l.out_on                                    as "ออกไปเมื่อ",
  l.due_back_on                               as "กำหนดกลับ",
  (current_date - l.due_back_on)              as "เลยมากี่วัน",
  pr."ราคาเต็มรวม_vat"                          as "มูลค่าที่จมอยู่"
from stock.loans l
join stock.units u              on u.id = l.unit_id
join catalog.product_variants v on v.id = u.variant_id
join catalog.products p         on p.id = v.product_id
left join catalog.categories cat on cat.id = p.category_id
left join pricing.v_variant_price pr on pr.variant_id = v.id
where l.returned_on is null
  and l.due_back_on < current_date;

comment on view stock.v_overdue_loans is
  'ของที่เลยกำหนดคืนแล้ว · เรียงตามมูลค่าที่จมจะได้รู้ว่าควรตามตัวไหนก่อน';

-- ---------------------------------------------------------------------------
-- งานวันนี้ของคลัง · หน้าจอคือ "งานวันนี้" ไม่ใช่ฐานข้อมูล (เอกสารหัวข้อ 4)
-- ---------------------------------------------------------------------------
create view stock.v_today with (security_invoker = true) as
select 'เลยกำหนดคืน' as "หมวด",
       u.unit_code || ' · ' || p.collection || ' อยู่ที่ ' || l.destination as "เรื่อง",
       (current_date - l.due_back_on) as "เลยมากี่วัน",
       u.id as ref_id
from stock.loans l
join stock.units u      on u.id = l.unit_id
join catalog.product_variants v on v.id = u.variant_id
join catalog.products p on p.id = v.product_id
where l.returned_on is null and l.due_back_on < current_date
union all
select 'ใกล้ถึงกำหนดคืน',
       u.unit_code || ' · ' || p.collection || ' อยู่ที่ ' || l.destination,
       (l.due_back_on - current_date) * -1,
       u.id
from stock.loans l
join stock.units u      on u.id = l.unit_id
join catalog.product_variants v on v.id = u.variant_id
join catalog.products p on p.id = v.product_id
where l.returned_on is null
  and l.due_back_on >= current_date
  and l.due_back_on <= current_date + 7
union all
select 'ของมีตำหนิ รอจัดการ',
       u.unit_code || ' · ' || p.collection || ' อยู่ที่ ' || loc.name,
       null,
       u.id
from stock.units u
join catalog.product_variants v on v.id = u.variant_id
join catalog.products p on p.id = v.product_id
join stock.locations loc on loc.id = u.location_id
where u.status = 'ตำหนิ';

comment on view stock.v_today is
  'งานที่คลังต้องลงมือวันนี้ · ไม่ใช่ตารางข้อมูลให้มานั่งไล่ดูเอง';

-- ---------------------------------------------------------------------------
-- สรุปว่ามีอะไรอยู่ที่ไหนบ้าง · ยังต้องมีเพราะคนถามว่า "รุ่นนี้เหลือกี่ตัว"
-- แต่ตัวเลขนี้นับสดจากของจริง ไม่ใช่ช่องที่ใครไปแก้ได้ (กฎ A10)
-- ---------------------------------------------------------------------------
create view stock.v_on_hand with (security_invoker = true) as
select
  v.id                                              as variant_id,
  catalog.sku_display(v.sku::text)                  as "SKU",
  p.collection                                      as "รุ่น",
  cat.name                                          as "หมวด",
  v.material_grade                                  as "วัสดุ",
  loc.name                                          as "อยู่ที่",
  count(*)                                          as "ทั้งหมด",
  count(*) filter (where u.status = 'พร้อมขาย')      as "พร้อมขาย",
  count(*) filter (where u.status = 'จองแล้ว')       as "จองแล้ว",
  count(*) filter (where u.status = 'ตำหนิ')         as "ตำหนิ",
  count(*) filter (where u.status = 'ยืมออก')        as "ยืมออก"
from stock.units u
join catalog.product_variants v  on v.id = u.variant_id
join catalog.products p          on p.id = v.product_id
left join catalog.categories cat on cat.id = p.category_id
join stock.locations loc         on loc.id = u.location_id
where u.status <> 'ส่งแล้ว'
group by v.id, v.sku, p.collection, cat.name, v.material_grade, loc.name;

comment on view stock.v_on_hand is
  'มีอะไรอยู่ที่ไหนกี่ตัว · นับสดจากของจริงทุกครั้ง ไม่มีช่องยอดคงเหลือให้ใครไปแก้';

-- ---------------------------------------------------------------------------
-- RLS · คลังอ่านเขียนได้ คนอื่นที่ดูสินค้าได้ก็ดูสต็อกได้ แต่แก้ไม่ได้
-- ---------------------------------------------------------------------------
alter table stock.locations   enable row level security;
alter table stock.units       enable row level security;
alter table stock.unit_moves  enable row level security;
alter table stock.loans       enable row level security;

create policy loc_select on stock.locations for select to authenticated
  using (core.has_capability('stock.read') or core.has_capability('products.read'));
create policy loc_write on stock.locations for all to authenticated
  using (core.has_capability('stock.write')) with check (core.has_capability('stock.write'));

create policy units_select on stock.units for select to authenticated
  using (core.has_capability('stock.read') or core.has_capability('products.read'));
create policy units_write on stock.units for all to authenticated
  using (core.has_capability('stock.write')) with check (core.has_capability('stock.write'));

create policy moves_select on stock.unit_moves for select to authenticated
  using (core.has_capability('stock.read') or core.has_capability('products.read'));
create policy moves_insert on stock.unit_moves for insert to authenticated
  with check (core.has_capability('stock.write'));

create policy loans_select on stock.loans for select to authenticated
  using (core.has_capability('stock.read') or core.has_capability('products.read'));
create policy loans_write on stock.loans for all to authenticated
  using (core.has_capability('stock.write')) with check (core.has_capability('stock.write'));

-- ---------------------------------------------------------------------------
-- สิทธิ์ระดับ schema
-- ---------------------------------------------------------------------------
grant usage on schema stock to authenticated, service_role;
grant select, insert, update on all tables in schema stock to authenticated;
grant usage, select on all sequences in schema stock to authenticated;
alter default privileges in schema stock
  grant select, insert, update on tables to authenticated;
alter default privileges in schema stock
  grant usage, select on sequences to authenticated;

revoke all on schema stock from anon;

revoke all on function stock.receive_units(uuid, int, uuid, stock.unit_status, text) from public, anon;
revoke all on function stock.move_unit(text, uuid, stock.unit_status, text)          from public, anon;
revoke all on function stock.lend_unit(text, text, date, text, text)                 from public, anon;
revoke all on function stock.return_unit(text, uuid, stock.unit_status, text)        from public, anon;
revoke all on function stock.next_unit_code()                                        from public, anon;
revoke all on function stock.guard_fixed_location()                                  from public, anon, authenticated;

grant execute on function stock.receive_units(uuid, int, uuid, stock.unit_status, text) to authenticated;
grant execute on function stock.move_unit(text, uuid, stock.unit_status, text)          to authenticated;
grant execute on function stock.lend_unit(text, text, date, text, text)                 to authenticated;
grant execute on function stock.return_unit(text, uuid, stock.unit_status, text)        to authenticated;
grant execute on function stock.next_unit_code()                                        to authenticated;

-- ---------------------------------------------------------------------------
-- ลงทะเบียนโมดูล · App Launcher จะขึ้นเองโดยไม่ต้องแก้โค้ดเมนู
-- ---------------------------------------------------------------------------
insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability,
   home_path, sort_order, is_core, description_th) values
  ('stock', 'คลัง', 'Stock', 'box', 'stock',
   '{core,catalog,pricing}', 'stock.read', '/stock', 2, false,
   'นับเป็นตัว ไม่ใช่จำนวน · สแกนย้ายของ · ยืมออกแล้วตามคืนได้');

update core.modules set sort_order = sort_order + 1
 where id in ('materials','pricing','cost','marketing');

-- ⚠️ ขาดบรรทัดนี้ = REST API มองไม่เห็น schema stock ทั้งก้อน
alter role authenticator
  set pgrst.db_schemas = 'public, graphql_public, core, catalog, materials, pricing, cost, marketing, stock';

notify pgrst, 'reload config';

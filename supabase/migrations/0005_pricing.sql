-- ============================================================================
-- 0005 · ราคา ส่วนลด และต้นทุน
-- ============================================================================
-- กฎจาก Bay (2026-09-21):
--   · เก็บราคาเต็มแบบ "รวม VAT" · ราคาก่อน VAT และ VAT คำนวณสด ไม่เก็บ
--   · ส่วนลดปกติ ลดแบบนี้ทั้งปี · การตลาดแก้ได้ ทั้งทีละหมวดและทีละตัว
--   · ส่วนลดเพิ่ม (เงินสด) คิดจากราคา "รวม VAT"
--   · ส่วนลดขั้นบันไดตามยอด เช่น ครบ 50,000 ลดเพิ่ม 12% · ครบ 100,000 ลดเพิ่ม 18%
--   · คิดกำไร ต้อง "ถอด VAT ออกก่อน" แล้วค่อยลบต้นทุน   ← สำคัญที่สุด
--   · ต้นทุนเห็นได้เฉพาะเจ้าของ · เซลส์เห็นแค่ราคาขายกับ % ลดของเดือนนั้น
-- ============================================================================

-- ---------------------------------------------------------------------------
-- อัตรา VAT · แยกเป็นตารางเพราะรัฐเปลี่ยนอัตราได้ และออเดอร์เก่าต้องคิดอัตราเดิม
-- ---------------------------------------------------------------------------
create table vat_rates (
  id          uuid primary key default gen_random_uuid(),
  rate        numeric(5,4) not null check (rate >= 0 and rate < 1),
  valid_from  date not null,
  valid_to    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users(id)
);
insert into vat_rates (rate, valid_from) values (0.0700, '2000-01-01');

create or replace function vat_rate(p_on date default current_date)
returns numeric language sql stable security definer set search_path = public as $$
  select rate from vat_rates
  where valid_from <= p_on and (valid_to is null or valid_to >= p_on)
  order by valid_from desc limit 1;
$$;

-- ---------------------------------------------------------------------------
-- ราคาตั้ง · เก็บ "รวม VAT" ตัวเดียว
-- ---------------------------------------------------------------------------
create table variant_prices (
  id                   uuid primary key default gen_random_uuid(),
  variant_id           uuid not null references product_variants(id),
  list_price_incl_vat  numeric(12,2) not null check (list_price_incl_vat >= 0),
  valid_from           date not null default current_date,
  valid_to             date,
  status               lifecycle_status not null default 'ขายอยู่',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references app_users(id),
  check (valid_to is null or valid_to >= valid_from)
);
create index on variant_prices (variant_id, valid_from desc);

comment on table variant_prices is
  'เก็บเฉพาะราคาเต็มรวม VAT · ราคาก่อน VAT และตัว VAT ไม่เก็บ คำนวณสดเสมอ (กฎ A10) · '
  'มีช่วงเวลาเพราะขึ้นราคาแล้วออเดอร์เก่าต้องยังอ่านราคาเดิมออก';

-- ---------------------------------------------------------------------------
-- ส่วนลดปกติ · การตลาดตั้งได้ทีละหมวด (batch) หรือทีละตัว
-- ตัวอย่างที่ Bay ยกมา: "เดือนหน้า อยากลดเตียงทั้งหมด ให้อยู่ที่ 30%"
--   → 1 แถว: scope='หมวด' · target=เตียง · percent=30
-- ---------------------------------------------------------------------------
create type discount_scope as enum ('ทั้งหมด', 'หมวด', 'รุ่น', 'ตัวสินค้า');

create table discount_rules (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  scope       discount_scope not null,
  target_id   uuid,                       -- ว่างได้เฉพาะ scope='ทั้งหมด'
  percent     numeric(5,2) not null check (percent >= 0 and percent <= 100),
  valid_from  date not null default current_date,
  valid_to    date,
  status      lifecycle_status not null default 'ขายอยู่',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users(id),
  check ((scope = 'ทั้งหมด') = (target_id is null)),
  check (valid_to is null or valid_to >= valid_from)
);
create index on discount_rules (scope, target_id, valid_from desc);

-- เจาะจงกว่า ชนะเสมอ · ลดรายตัว > ลดรายรุ่น > ลดรายหมวด > ลดทั้งหมด
create or replace function discount_specificity(p_scope discount_scope)
returns int language sql immutable as $$
  select case p_scope
    when 'ตัวสินค้า' then 4
    when 'รุ่น'      then 3
    when 'หมวด'      then 2
    when 'ทั้งหมด'   then 1
  end;
$$;

create or replace function current_discount_percent(
  p_variant_id uuid, p_on date default current_date)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((
    select d.percent
    from discount_rules d
    join product_variants v on v.id = p_variant_id
    join products         p on p.id = v.product_id
    where d.status = 'ขายอยู่'
      and d.valid_from <= p_on
      and (d.valid_to is null or d.valid_to >= p_on)
      and (
        d.scope = 'ทั้งหมด'
        or (d.scope = 'หมวด'      and d.target_id = p.category_id)
        or (d.scope = 'รุ่น'       and d.target_id = p.id)
        or (d.scope = 'ตัวสินค้า' and d.target_id = v.id)
      )
    order by discount_specificity(d.scope) desc, d.valid_from desc, d.created_at desc
    limit 1
  ), 0);
$$;
comment on function current_discount_percent(uuid, date) is
  'ส่วนลดปกติที่ใช้ได้ ณ วันนั้น · ถ้ามีหลายกฎชนกัน กฎที่เจาะจงกว่าชนะ';

-- ---------------------------------------------------------------------------
-- ส่วนลดเพิ่ม · คิดจากราคา "รวม VAT" ตามที่ Bay ระบุ
-- ---------------------------------------------------------------------------
create table payment_discounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,              -- 'เงินสด'
  percent     numeric(5,2) not null check (percent >= 0 and percent <= 100),
  valid_from  date not null default current_date,
  valid_to    date,
  status      lifecycle_status not null default 'ขายอยู่',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users(id)
);

create table volume_discount_tiers (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  min_order_amount  numeric(12,2) not null check (min_order_amount > 0),
  extra_percent     numeric(5,2) not null check (extra_percent >= 0 and extra_percent <= 100),
  valid_from        date not null default current_date,
  valid_to          date,
  status            lifecycle_status not null default 'ขายอยู่',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references app_users(id)
);
comment on table volume_discount_tiers is
  'ขั้นบันไดตามยอด · ครบ 50,000 ลดเพิ่ม 12% · ครบ 100,000 ลดเพิ่ม 18%';

insert into volume_discount_tiers (name, min_order_amount, extra_percent) values
  ('ครบ 50,000',  50000,  12.00),
  ('ครบ 100,000', 100000, 18.00);

create or replace function volume_extra_percent(
  p_order_amount numeric, p_on date default current_date)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((
    select extra_percent from volume_discount_tiers
    where status = 'ขายอยู่'
      and valid_from <= p_on and (valid_to is null or valid_to >= p_on)
      and min_order_amount <= p_order_amount
    order by min_order_amount desc limit 1
  ), 0);
$$;

-- ---------------------------------------------------------------------------
-- ต้นทุน 🔒 เจ้าของเท่านั้น
-- ---------------------------------------------------------------------------
create table variant_costs (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null references product_variants(id),
  cogs        numeric(12,2) not null default 0,   -- ต้นทุนสินค้า
  freight_in  numeric(12,2) not null default 0,   -- ค่าขนส่งเข้า
  other_cost  numeric(12,2) not null default 0,
  valid_from  date not null default current_date,
  valid_to    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users(id)
);
create index on variant_costs (variant_id, valid_from desc);

comment on table variant_costs is
  'ไม่มีช่อง "กำไร" และ "%กำไร" โดยตั้งใจ (กฎ A10) — คำนวณสดจาก ราคา − ต้นทุน · '
  'ถ้าเก็บไว้ วันหนึ่งจะมีคนแก้กำไรให้สวยโดยไม่แก้ต้นทุน แล้วตัวเลขจะโกหก';

-- ---------------------------------------------------------------------------
-- มุมมองของเซลส์ · เห็นราคาขายกับ % ลด แต่ไม่เห็นต้นทุน
-- ---------------------------------------------------------------------------
create view v_variant_price with (security_invoker = true) as
select
  v.id                as variant_id,
  v.sku,
  sku_display(v.sku)  as sku_display,
  p.collection,
  v.configuration,
  v.material_grade,
  pr.list_price_incl_vat                                            as ราคาเต็มรวม_vat,
  round(pr.list_price_incl_vat / (1 + vat_rate()), 2)               as ราคาเต็มก่อน_vat,
  round(pr.list_price_incl_vat - pr.list_price_incl_vat / (1 + vat_rate()), 2) as vat,
  current_discount_percent(v.id)                                    as ส่วนลดปกติ_pct,
  round(pr.list_price_incl_vat * (1 - current_discount_percent(v.id)/100), 2)
                                                                    as ราคาขายรวม_vat
from product_variants v
join products p        on p.id = v.product_id
left join variant_prices pr
  on pr.variant_id = v.id
 and pr.status = 'ขายอยู่'
 and pr.valid_from <= current_date
 and (pr.valid_to is null or pr.valid_to >= current_date);

comment on view v_variant_price is
  'สำหรับเซลส์ · ทุกตัวเลขคำนวณสด ไม่มีช่องไหนเก็บไว้ · ไม่มีต้นทุนโผล่มาเลย';

-- ---------------------------------------------------------------------------
-- มุมมองกำไร 🔒 · ถอด VAT ออกก่อนคิดกำไร ตามที่ Bay ย้ำ
-- ---------------------------------------------------------------------------
create view v_variant_margin with (security_invoker = true) as
select
  pv.variant_id,
  pv.sku,
  pv.sku_display,
  pv.collection,
  pv.ราคาขายรวม_vat,
  round(pv.ราคาขายรวม_vat / (1 + vat_rate()), 2)  as รายได้จริงหลังถอด_vat,
  (c.cogs + c.freight_in + c.other_cost)           as ต้นทุนรวม,
  round(pv.ราคาขายรวม_vat / (1 + vat_rate()), 2)
    - (c.cogs + c.freight_in + c.other_cost)       as กำไร,
  case when pv.ราคาขายรวม_vat > 0 then
    round(100 * (round(pv.ราคาขายรวม_vat / (1 + vat_rate()), 2)
      - (c.cogs + c.freight_in + c.other_cost))
      / (pv.ราคาขายรวม_vat / (1 + vat_rate())), 2)
  end                                              as กำไร_pct
from v_variant_price pv
join variant_costs c
  on c.variant_id = pv.variant_id
 and c.valid_from <= current_date
 and (c.valid_to is null or c.valid_to >= current_date);

comment on view v_variant_margin is
  '🔒 เจ้าของเท่านั้น · VAT ไม่ใช่รายได้ จึงถอดออกก่อนลบต้นทุนเสมอ · '
  'security_invoker=true ทำให้ RLS ของ variant_costs มีผลจริง ไม่ใช่แค่ซ่อนหน้าจอ';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table vat_rates             enable row level security;
alter table variant_prices        enable row level security;
alter table discount_rules        enable row level security;
alter table payment_discounts     enable row level security;
alter table volume_discount_tiers enable row level security;
alter table variant_costs         enable row level security;

-- ราคาและส่วนลด: ใครมี products.read ก็อ่านได้
do $$
declare t text;
begin
  foreach t in array array['vat_rates','variant_prices','discount_rules',
                           'payment_discounts','volume_discount_tiers'] loop
    execute format(
      'create policy %I on %I for select to authenticated
         using (has_capability(''products.read''))', t || '_select', t);
    execute format(
      'create trigger %I before delete on %I for each row execute function prevent_delete()',
      'no_delete_' || t, t);
    execute format(
      'create trigger %I before update on %I for each row execute function touch_updated_at()',
      'touch_' || t, t);
    execute format(
      'create trigger %I after insert or update on %I for each row execute function write_audit()',
      'audit_' || t, t);
  end loop;
end;
$$;

-- ส่วนลด: การตลาดแก้ได้ (ตามที่ Bay ระบุว่าการตลาดต้องเข้าไป update ได้)
do $$
declare t text;
begin
  foreach t in array array['discount_rules','payment_discounts','volume_discount_tiers'] loop
    execute format(
      'create policy %I on %I for insert to authenticated
         with check (has_capability(''marketing.write''))', t || '_insert', t);
    execute format(
      'create policy %I on %I for update to authenticated
         using (has_capability(''marketing.write''))', t || '_update', t);
  end loop;
end;
$$;

-- ราคาตั้ง: เจ้าของเท่านั้น (Bay ตอบข้อ 19 ว่าราคาเป็นของเจ้าของ)
create policy variant_prices_insert on variant_prices
  for insert to authenticated with check (has_capability('admin'));
create policy variant_prices_update on variant_prices
  for update to authenticated using (has_capability('admin'));
create policy vat_rates_write on vat_rates
  for all to authenticated
  using (has_capability('admin')) with check (has_capability('admin'));

-- 🔒 ต้นทุน: cost.read เท่านั้น — บังคับที่ฐานข้อมูล
create policy variant_costs_select on variant_costs
  for select to authenticated using (has_capability('cost.read'));
create policy variant_costs_write on variant_costs
  for all to authenticated
  using (has_capability('cost.read')) with check (has_capability('cost.read'));

create trigger no_delete_variant_costs before delete on variant_costs
  for each row execute function prevent_delete();
create trigger touch_variant_costs before update on variant_costs
  for each row execute function touch_updated_at();
create trigger audit_variant_costs after insert or update on variant_costs
  for each row execute function write_audit();

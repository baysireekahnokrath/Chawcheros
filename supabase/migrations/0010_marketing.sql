-- ============================================================================
-- 0010 · โมดูล marketing — แคมเปญ โปรโมชัน คอนเทนต์
-- ============================================================================
-- เป้าหมาย: ทำเงินก่อน · โมดูลนี้ต่อยอดจากเครื่องส่วนลดที่สร้างไว้แล้วใน 0005
--
-- สายงานที่ทำให้เกิดเงิน:
--   แคมเปญ → โปรโมชัน → กฎส่วนลด → ราคาเปลี่ยน → เซลส์เสนอราคาใหม่ได้ทันที
--
-- ยังทำไม่ได้ในรอบนี้ (ต้องรอโมดูลอื่น):
--   · แคมเปญนี้ได้ลูกค้ากี่คน / กี่บาท  → ต้องมีโมดูล crm + sales ก่อน
--   · กลุ่มลูกค้าเก่าที่ควรทักเดือนนี้    → ต้องมีประวัติการซื้อก่อน
--   ช่องสำหรับเชื่อมเตรียมไว้แล้ว เติมทีหลังได้โดยไม่ต้องรื้อ
-- ============================================================================

create schema if not exists marketing;
comment on schema marketing is 'แคมเปญ โปรโมชัน คอนเทนต์ · การตลาดเป็นเจ้าของ';

-- ---------------------------------------------------------------------------
-- ประตูของโมดูล pricing · การตลาดห้ามเขียนตารางส่วนลดตรงๆ ต้องผ่านฟังก์ชันนี้
-- ---------------------------------------------------------------------------
create or replace function pricing.create_promo_discount(
  p_name        text,
  p_scope       pricing.discount_scope,
  p_target_id   uuid,
  p_percent     numeric,
  p_valid_from  date,
  p_valid_to    date
) returns uuid
language plpgsql security definer
set search_path = core, catalog, materials, pricing, cost, public
as $$
declare new_id uuid;
begin
  if not core.has_capability('marketing.write') then
    raise exception 'ต้องมีสิทธิ์ marketing.write จึงจะตั้งส่วนลดได้'
      using errcode = 'insufficient_privilege';
  end if;
  if p_percent < 0 or p_percent > 100 then
    raise exception 'ส่วนลดต้องอยู่ระหว่าง 0-100%% (ได้รับ %)', p_percent;
  end if;

  insert into pricing.discount_rules (name, scope, target_id, percent, valid_from, valid_to)
  values (p_name, p_scope, p_target_id, p_percent, p_valid_from, p_valid_to)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function pricing.create_promo_discount(text, pricing.discount_scope, uuid, numeric, date, date) from public, anon;
grant execute on function pricing.create_promo_discount(text, pricing.discount_scope, uuid, numeric, date, date) to authenticated;

comment on function pricing.create_promo_discount(text, pricing.discount_scope, uuid, numeric, date, date) is
  'ประตูที่โมดูล marketing ใช้ตั้งส่วนลด · กฎธุรกิจอยู่ที่นี่ที่เดียว '
  'ถ้าวันหนึ่งเพิ่มกฎ เช่น ห้ามลดเกิน 50% แก้ที่นี่ที่เดียว ทุกคนได้กฎใหม่ทันที';

-- ---------------------------------------------------------------------------
-- ช่องทาง
-- ---------------------------------------------------------------------------
create table marketing.channels (
  id          text primary key,
  name_th     text not null,
  sort_order  int not null default 0,
  status      core.lifecycle_status not null default 'ขายอยู่',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references core.app_users(id)
);
insert into marketing.channels (id, name_th, sort_order) values
  ('facebook',  'Facebook',        1),
  ('instagram', 'Instagram',       2),
  ('line_oa',   'Line OA',         3),
  ('tiktok',    'TikTok',          4),
  ('google',    'Google Ads',      5),
  ('website',   'เว็บไซต์',          6),
  ('fair',      'งานแสดงสินค้า',     7),
  ('showroom',  'โชว์รูม',           8),
  ('other',     'อื่นๆ',             9);

-- ---------------------------------------------------------------------------
-- แคมเปญ
-- ---------------------------------------------------------------------------
create type marketing.campaign_status as enum
  ('ร่าง', 'กำลังทำ', 'จบแล้ว', 'ยกเลิก');

create table marketing.campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  channel_id    text references marketing.channels(id),
  objective     text,
  starts_on     date not null default current_date,
  ends_on       date,
  budget        numeric(12,2),
  utm_campaign  text,
  status        marketing.campaign_status not null default 'ร่าง',
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references core.app_users(id),
  check (ends_on is null or ends_on >= starts_on)
);
create index on marketing.campaigns (status, starts_on desc);
create index on marketing.campaigns (utm_campaign) where utm_campaign is not null;

comment on column marketing.campaigns.budget is
  'งบที่ตั้งไว้ · ค่าใช้จ่ายจริงไปบันทึกที่ campaign_spend แล้วรวมสด ไม่เก็บยอดรวม (กฎ A10)';
comment on column marketing.campaigns.utm_campaign is
  'ใช้จับคู่ลูกค้าที่เข้ามาจากโฆษณา เมื่อมีโมดูล crm แล้ว';

-- ค่าใช้จ่ายโฆษณา · การตลาดเห็นได้ เพราะต้องรู้ว่าคุ้มไหม
-- (คนละเรื่องกับต้นทุนสินค้าในโมดูล cost ที่เจ้าของเห็นคนเดียว)
create table marketing.campaign_spend (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references marketing.campaigns(id),
  spent_on     date not null default current_date,
  amount       numeric(12,2) not null check (amount >= 0),
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references core.app_users(id)
);
create index on marketing.campaign_spend (campaign_id, spent_on desc);

-- ---------------------------------------------------------------------------
-- โปรโมชัน · ตัวที่ทำให้ราคาเปลี่ยนจริง
-- ---------------------------------------------------------------------------
create type marketing.promotion_status as enum
  ('ร่าง', 'รออนุมัติ', 'กำลังใช้', 'จบแล้ว', 'ยกเลิก');

create table marketing.promotions (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  campaign_id       uuid references marketing.campaigns(id),
  headline          text,
  starts_on         date not null default current_date,
  ends_on           date,
  discount_rule_id  uuid references pricing.discount_rules(id),
  status            marketing.promotion_status not null default 'ร่าง',
  approved_by       uuid references core.app_users(id),
  approved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references core.app_users(id),
  check (ends_on is null or ends_on >= starts_on)
);
create index on marketing.promotions (status, starts_on desc);

comment on column marketing.promotions.discount_rule_id is
  'ชี้ไปที่กฎส่วนลดในโมดูล pricing · สร้างผ่าน pricing.create_promo_discount() เท่านั้น '
  'อ่านข้ามโมดูลได้ แต่เขียนต้องผ่านประตู';

-- ---------------------------------------------------------------------------
-- คอนเทนต์
-- ---------------------------------------------------------------------------
create type marketing.content_status as enum
  ('ไอเดีย', 'กำลังทำ', 'รอตรวจ', 'พร้อมโพสต์', 'โพสต์แล้ว', 'พับไว้');

create table marketing.content_items (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  campaign_id   uuid references marketing.campaigns(id),
  channel_id    text references marketing.channels(id),
  body          text,
  asset_url     text,
  status        marketing.content_status not null default 'ไอเดีย',
  scheduled_at  timestamptz,
  published_at  timestamptz,
  published_url text,
  owner_id      uuid references core.app_users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references core.app_users(id)
);
create index on marketing.content_items (status, scheduled_at);
create index on marketing.content_items (campaign_id);

-- สินค้าที่คอนเทนต์/แคมเปญนี้พูดถึง
create table marketing.campaign_products (
  campaign_id  uuid not null references marketing.campaigns(id),
  variant_id   uuid not null references catalog.product_variants(id),
  primary key (campaign_id, variant_id)
);

-- ---------------------------------------------------------------------------
-- หน้า "งานวันนี้" ของการตลาด — ตามเอกสารหัวข้อ 4
-- หน้าจอไหนเปิดแล้วไม่มีอะไรต้องทำ ไม่ควรมีหน้านั้น
-- ---------------------------------------------------------------------------
create view marketing.v_today with (security_invoker = true) as
select 'โปรใกล้หมดอายุ' as หมวด, p.name as เรื่อง,
       (p.ends_on - current_date) as อีกกี่วัน, p.id as ref_id
from marketing.promotions p
where p.status = 'กำลังใช้' and p.ends_on is not null
  and p.ends_on between current_date and current_date + 7
union all
select 'โปรรออนุมัติ', p.name, current_date - p.created_at::date, p.id
from marketing.promotions p where p.status = 'รออนุมัติ'
union all
select 'คอนเทนต์เลยกำหนดโพสต์', c.title,
       current_date - c.scheduled_at::date, c.id
from marketing.content_items c
where c.status <> 'โพสต์แล้ว' and c.scheduled_at is not null
  and c.scheduled_at < now()
union all
select 'แคมเปญจบแล้วแต่ยังไม่ปิด', ca.name, current_date - ca.ends_on, ca.id
from marketing.campaigns ca
where ca.status = 'กำลังทำ' and ca.ends_on is not null and ca.ends_on < current_date;

comment on view marketing.v_today is
  'หน้าแรกของการตลาด · รายการที่ต้องลงมือ ไม่ใช่ตารางให้ค้นหา (เอกสารหัวข้อ 4)';

-- สรุปแคมเปญ · ใช้จ่ายไปเท่าไหร่ เทียบงบ
create view marketing.v_campaign_summary with (security_invoker = true) as
select
  c.id, c.name, ch.name_th as ช่องทาง, c.status,
  c.starts_on, c.ends_on, c.budget as งบที่ตั้ง,
  coalesce(s.spent, 0)                       as ใช้จริง,
  c.budget - coalesce(s.spent, 0)            as คงเหลือ,
  (select count(*) from marketing.promotions p where p.campaign_id = c.id)     as จำนวนโปร,
  (select count(*) from marketing.content_items ci where ci.campaign_id = c.id) as จำนวนคอนเทนต์
from marketing.campaigns c
left join marketing.channels ch on ch.id = c.channel_id
left join (select campaign_id, sum(amount) spent
           from marketing.campaign_spend group by 1) s on s.campaign_id = c.id;

comment on view marketing.v_campaign_summary is
  'ยอดใช้จ่ายรวมสดทุกครั้ง ไม่เก็บเป็นช่อง (กฎ A10) · '
  'ยอดขายต่อแคมเปญยังใส่ไม่ได้ ต้องรอโมดูล sales';

-- ---------------------------------------------------------------------------
-- RLS + สิทธิ์
-- ---------------------------------------------------------------------------
alter table marketing.channels          enable row level security;
alter table marketing.campaigns         enable row level security;
alter table marketing.campaign_spend    enable row level security;
alter table marketing.promotions        enable row level security;
alter table marketing.content_items     enable row level security;
alter table marketing.campaign_products enable row level security;

do $$
declare t text;
begin
  foreach t in array array['channels','campaigns','campaign_spend','promotions',
                           'content_items','campaign_products'] loop
    -- ทุกคนที่ล็อกอินอ่านได้ (เซลส์ต้องรู้ว่าโปรอะไรกำลังใช้อยู่)
    execute format('create policy %I on marketing.%I for select to authenticated
       using (core.has_capability(''products.read''))', t || '_select', t);
    execute format('create policy %I on marketing.%I for insert to authenticated
       with check (core.has_capability(''marketing.write''))', t || '_insert', t);
    execute format('create policy %I on marketing.%I for update to authenticated
       using (core.has_capability(''marketing.write''))', t || '_update', t);
    execute format('create trigger %I before delete on marketing.%I
       for each row execute function core.prevent_delete()', 'no_delete_' || t, t);
  end loop;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['channels','campaigns','campaign_spend','promotions','content_items'] loop
    execute format('create trigger %I before update on marketing.%I
       for each row execute function core.touch_updated_at()', 'touch_' || t, t);
    execute format('create trigger %I after insert or update on marketing.%I
       for each row execute function core.write_audit()', 'audit_' || t, t);
  end loop;
end;
$$;

grant usage on schema marketing to authenticated, service_role;
grant select, insert, update on all tables in schema marketing to authenticated;
revoke delete on all tables in schema marketing from authenticated, anon;
revoke all on all tables in schema marketing from anon;
revoke all on schema marketing from anon;

-- ---------------------------------------------------------------------------
-- ลงทะเบียนโมดูล
-- ---------------------------------------------------------------------------
insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability,
   home_path, sort_order, is_core, description_th) values
  ('marketing', 'การตลาด', 'Marketing', 'megaphone', 'marketing',
   '{core,catalog,pricing}', 'marketing.write', '/marketing', 5, false,
   'แคมเปญ โปรโมชัน คอนเทนต์ · ตั้งส่วนลดแล้วราคาเปลี่ยนทันที');

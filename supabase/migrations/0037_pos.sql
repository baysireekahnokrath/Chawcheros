-- ============================================================================
-- 0037 · POS หน้าบูธ (งาน SX และงานออกบูธอื่นๆ)
-- ============================================================================
-- โจทย์จาก Bay
--   P1 ลิงก์สาธารณะ ใครมีลิงก์ก็ขายได้ (น้องสาว ทีมหน้าบูธ) ไม่ต้องล็อกอิน
--   P2 บรรทัดสุดท้ายใส่ส่วนลดเท่าไหร่ก็ได้ (บาท หรือ %)
--   P3 กดผิด → Bay คนเดียวแก้/ยกเลิก/ลบจากหลังบ้าน
--
-- ออกแบบความปลอดภัย
--   · คนไม่ล็อกอิน (anon) แตะตารางไม่ได้เลย · ทำได้อย่างเดียวคือเรียก pos.record_sale
--     ซึ่งต้องใส่ PIN ร้านให้ถูก (เก็บเป็น hash ไม่ใช่ตัวเลขตรงๆ)
--   · ยอดเงินคำนวณใหม่ที่ฐานข้อมูลเสมอ · เครื่องหน้าบูธส่งราคาผิดมาไม่ได้ผลรวมเพี้ยน
--   · ส่งบิลเดิมซ้ำ (เน็ตหลุดแล้วส่งใหม่) ไม่เบิ้ล เพราะ id มาจากเครื่อง
--   · อ่าน/แก้/ลบ ได้เฉพาะคนที่มีสิทธิ์ admin (Bay)
-- ============================================================================

create schema if not exists pos;
comment on schema pos is 'POS หน้าบูธ · บิลขายหน้างาน · anon บันทึกได้ผ่านฟังก์ชันที่ต้องใช้ PIN เท่านั้น';

create table pos.settings (
  id          int primary key default 1 check (id = 1),
  pin_hash    text not null,
  event_name  text not null default 'SX 2026',
  updated_at  timestamptz not null default now()
);
comment on table pos.settings is 'แถวเดียว · PIN ร้าน (hash) และชื่องาน';

create table pos.sales (
  id              text primary key check (id ~ '^[A-Za-z0-9]{6,40}$'),
  bill_no         text not null,
  sold_at         timestamptz not null,
  sold_on         date not null,
  event_name      text not null,
  seller          text not null check (btrim(seller) <> ''),
  items           jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 100),
  subtotal        numeric(12,2) not null check (subtotal >= 0),
  discount_type   text not null default 'baht' check (discount_type in ('baht', 'pct')),
  discount_value  numeric(12,2) not null default 0 check (discount_value >= 0),
  discount        numeric(12,2) not null default 0 check (discount >= 0),
  total           numeric(12,2) not null check (total >= 0),
  pay             text not null check (pay in ('โอน', 'เงินสด', 'บัตร')),
  customer        text not null default '',
  phone           text not null default '',
  note            text not null default '',
  status          text not null default 'ปกติ' check (status in ('ปกติ', 'ยกเลิก')),
  created_at      timestamptz not null default now(),
  edited_at       timestamptz,
  edited_by       uuid references core.app_users(id)
);
create index pos_sales_sold_on on pos.sales (sold_on desc, sold_at desc);
comment on table pos.sales is '1 แถว = 1 บิล · รายการสินค้าอยู่ใน items (jsonb) · ยอดคำนวณจากฐานข้อมูล';

-- ---------------------------------------------------------------------------
-- คำนวณยอดจากรายการ · ใช้ทั้งตอนบันทึกและตอน Bay แก้ไข
-- ---------------------------------------------------------------------------
create or replace function pos.clean_items(p_items jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name',  left(btrim(coalesce(e->>'name', '')), 120),
           'v',     left(btrim(coalesce(e->>'v', '')), 60),
           'price', greatest(round(coalesce((e->>'price')::numeric, 0), 2), 0),
           'qty',   greatest(least(coalesce((e->>'qty')::int, 0), 999), 0)
         )), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) e
  where btrim(coalesce(e->>'name', '')) <> '' and coalesce((e->>'qty')::int, 0) > 0
$$;

create or replace function pos.compute_totals()
returns trigger language plpgsql as $$
declare v_sub numeric; v_disc numeric;
begin
  new.items := pos.clean_items(new.items);
  select coalesce(sum((e->>'price')::numeric * (e->>'qty')::int), 0) into v_sub
    from jsonb_array_elements(new.items) e;
  v_disc := case when new.discount_type = 'pct'
                 then v_sub * least(new.discount_value, 100) / 100
                 else new.discount_value end;
  v_disc := round(least(greatest(v_disc, 0), v_sub), 2);
  new.subtotal := round(v_sub, 2);
  new.discount := v_disc;
  new.total    := round(v_sub - v_disc, 2);
  return new;
end $$;

create trigger pos_sales_totals before insert or update on pos.sales
  for each row execute function pos.compute_totals();

-- ---------------------------------------------------------------------------
-- ประตูเดียวของคนไม่ล็อกอิน
-- ---------------------------------------------------------------------------
create or replace function pos.check_pin(p_pin text)
returns boolean language sql stable security definer
set search_path = pos, extensions, public as $$
  select exists (select 1 from pos.settings s where s.pin_hash = crypt(coalesce(p_pin, ''), s.pin_hash))
$$;

create or replace function pos.record_sale(p_pin text, p_sale jsonb)
returns jsonb language plpgsql security definer
set search_path = pos, extensions, public as $$
declare v_row pos.sales; v_event text;
begin
  if not pos.check_pin(p_pin) then
    raise exception 'pin_invalid' using errcode = '28000';
  end if;
  select event_name into v_event from pos.settings where id = 1;

  insert into pos.sales (id, bill_no, sold_at, sold_on, event_name, seller, items,
                         subtotal, discount_type, discount_value, total, pay,
                         customer, phone, note)
  values (
    p_sale->>'id',
    left(coalesce(p_sale->>'no', ''), 40),
    coalesce((p_sale->>'at')::timestamptz, now()),
    coalesce((p_sale->>'date')::date, (now() at time zone 'Asia/Bangkok')::date),
    v_event,
    left(btrim(coalesce(p_sale->>'seller', '')), 60),
    coalesce(p_sale->'items', '[]'::jsonb),
    0,
    case when p_sale->>'discountType' = 'pct' then 'pct' else 'baht' end,
    greatest(coalesce((p_sale->>'discountValue')::numeric, 0), 0),
    0,
    coalesce(p_sale->>'pay', 'โอน'),
    left(coalesce(p_sale->>'customer', ''), 120),
    left(coalesce(p_sale->>'phone', ''), 60),
    left(coalesce(p_sale->>'note', ''), 300)
  )
  on conflict (id) do nothing;

  select * into v_row from pos.sales where id = p_sale->>'id';
  return jsonb_build_object('id', v_row.id, 'total', v_row.total, 'bill_no', v_row.bill_no);
end $$;

-- Bay เปลี่ยน PIN จากหลังบ้าน
create or replace function pos.set_pin(p_pin text)
returns void language plpgsql security definer
set search_path = pos, extensions, public as $$
begin
  if not core.has_capability('admin') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if length(coalesce(p_pin, '')) < 6 then raise exception 'pin_too_short'; end if;
  insert into pos.settings (id, pin_hash) values (1, crypt(p_pin, gen_salt('bf')))
  on conflict (id) do update set pin_hash = excluded.pin_hash, updated_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- สิทธิ์
-- ---------------------------------------------------------------------------
alter table pos.settings enable row level security;
alter table pos.sales    enable row level security;

create policy pos_sales_admin_read   on pos.sales for select to authenticated using (core.has_capability('admin'));
create policy pos_sales_admin_update on pos.sales for update to authenticated using (core.has_capability('admin')) with check (core.has_capability('admin'));
create policy pos_sales_admin_delete on pos.sales for delete to authenticated using (core.has_capability('admin'));
create policy pos_settings_admin_read on pos.settings for select to authenticated using (core.has_capability('admin'));

grant usage on schema pos to anon, authenticated, service_role;
grant select, update, delete on pos.sales to authenticated;
grant select (id, event_name, updated_at) on pos.settings to authenticated;
revoke all on function pos.record_sale(text, jsonb) from public;
revoke all on function pos.check_pin(text) from public;
revoke all on function pos.set_pin(text) from public;
grant execute on function pos.record_sale(text, jsonb) to anon, authenticated;
grant execute on function pos.check_pin(text)          to anon, authenticated;
grant execute on function pos.set_pin(text)            to authenticated;

-- ทะเบียนโมดูล · ขึ้นใน App Launcher ของ Bay
insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability,
   home_path, sort_order, is_core, description_th) values
  ('pos', 'ขายหน้าบูธ', 'Booth POS', 'receipt', 'pos', '{core}', 'admin', '/pos-admin', 90, false,
   'บิลขายหน้างาน · ลิงก์ /pos ให้ทีมหน้าบูธ · Bay แก้/ยกเลิก/ลบได้คนเดียว')
on conflict (id) do nothing;

-- ⚠️ ขาดบรรทัดนี้ = REST API มองไม่เห็น schema pos
alter role authenticator
  set pgrst.db_schemas = 'public, graphql_public, core, catalog, materials, pricing, cost, marketing, stock, content, crm, sales, line_agent, sheets, pos';
notify pgrst, 'reload config';

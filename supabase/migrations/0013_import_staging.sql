-- ============================================================================
-- 0013 · พื้นที่พักข้อมูลนำเข้า + หน้าตรวจทีละกลุ่ม
-- ============================================================================
-- ทำไมต้องมีพื้นที่พัก ไม่โหลดเข้าตารางจริงเลย:
--   · Bay ยังไม่ได้ตรวจว่าแถวไหนเลิกขาย แถวไหนซ้ำกัน
--   · SKU ออกแล้วออกเลย ห้ามใช้ซ้ำ (กฎ A3) — ออกให้แถวที่ซ้ำกัน = เสียเปล่าถาวร
--   → พักไว้ก่อน ให้ตรวจทีละ "กลุ่ม" (95 กลุ่ม) แทนทีละ "แถว" (751 แถว)
--     อนุมัติเมื่อไหร่ ค่อยออก SKU ตอนนั้น
-- ============================================================================

create type catalog.import_review_status as enum
  ('รอตรวจ', 'อนุมัติแล้ว', 'ไม่เอา', 'ซ้ำกับตัวอื่น');

create table catalog.import_batches (
  id           uuid primary key default gen_random_uuid(),
  source_file  text not null,
  note         text,
  imported_at  timestamptz not null default now(),
  imported_by  uuid references core.app_users(id)
);

create table catalog.import_variants (
  id                   uuid primary key default gen_random_uuid(),
  batch_id             uuid not null references catalog.import_batches(id),
  source_row_no        int  not null,

  brand                text,
  category             text,
  collection           text,
  sub_category         text,
  wood                 text,
  wood_colour          text,
  material_grade       text,

  width_cm             numeric(7,1),
  depth_cm             numeric(7,1),
  height_cm            numeric(7,1),
  seat_height_cm       numeric(6,1),

  legacy_nnsku         text,
  legacy_fullname      text,

  list_price_incl_vat  numeric(12,2),
  discount_pct         numeric(5,2),
  ontop_pct            numeric(5,2),

  review_status        catalog.import_review_status not null default 'รอตรวจ',
  review_note          text,
  reviewed_by          uuid references core.app_users(id),
  reviewed_at          timestamptz,
  variant_id           uuid references catalog.product_variants(id),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references core.app_users(id),
  unique (batch_id, source_row_no)
);
create index on catalog.import_variants (review_status);
create index on catalog.import_variants (collection, category);

comment on table catalog.import_variants is
  'ข้อมูลดิบจากไฟล์ราคา · ยังไม่ใช่สินค้าจริง ยังไม่มี SKU · '
  'แถวที่ยังไม่อนุมัติจะไม่โผล่ให้เซลส์เห็นและจัดโปรไม่ได้';

-- ---------------------------------------------------------------------------
-- หน้าตรวจ · จัดกลุ่มให้แล้ว ตรวจ 95 กลุ่ม แทนที่จะไล่ 751 แถว
-- ---------------------------------------------------------------------------
create view catalog.v_import_groups with (security_invoker = true) as
select
  iv.collection,
  iv.category,
  count(*)                                              as จำนวนแถว,
  count(*) filter (where iv.review_status = 'รอตรวจ')    as รอตรวจ,
  count(*) filter (where iv.review_status = 'อนุมัติแล้ว') as อนุมัติแล้ว,
  count(*) filter (where iv.review_status = 'ไม่เอา')     as ไม่เอา,
  min(iv.list_price_incl_vat)                           as ราคาต่ำสุด,
  max(iv.list_price_incl_vat)                           as ราคาสูงสุด,
  string_agg(distinct iv.material_grade, ' · '
             order by iv.material_grade)                as วัสดุที่มี,
  string_agg(distinct coalesce(iv.sub_category,'(ไม่ระบุ)'), ' · '
             order by coalesce(iv.sub_category,'(ไม่ระบุ)')) as รูปทรงที่มี,
  count(*) filter (where iv.list_price_incl_vat is null) as ไม่มีราคา
from catalog.import_variants iv
group by iv.collection, iv.category;

comment on view catalog.v_import_groups is
  'หน้าตรวจของ Bay · 1 แถว = 1 รุ่น (Collection + หมวด) · '
  'ตอบแค่ 3 คำถามต่อกลุ่ม: ยังขายไหม · รุ่นเดียวกันจริงไหม · สเปกถูกไหม';

-- ---------------------------------------------------------------------------
-- อนุมัติทั้งกลุ่ม · ตรงนี้คือจุดเดียวที่ SKU ถูกออก
-- ---------------------------------------------------------------------------
create or replace function catalog.approve_import_group(
  p_collection text,
  p_category   text
) returns int
language plpgsql security definer
set search_path = core, catalog, materials, pricing, cost, public
as $$
declare
  r           record;
  v_brand_id  uuid;
  v_cat_id    uuid;
  v_prod_id   uuid;
  v_sku       char(8);
  v_variant   uuid;
  n           int := 0;
begin
  if not core.has_capability('products.write') then
    raise exception 'ต้องมีสิทธิ์ products.write จึงจะอนุมัติสินค้าได้'
      using errcode = 'insufficient_privilege';
  end if;

  for r in
    select * from catalog.import_variants
    where collection = p_collection and category = p_category
      and review_status = 'รอตรวจ'
    order by source_row_no
  loop
    -- แบรนด์
    insert into catalog.brands (name) values (r.brand)
      on conflict (name) do nothing;
    select id into v_brand_id from catalog.brands where name = r.brand;

    -- หมวด
    insert into catalog.categories (name) values (r.category)
      on conflict (name) do nothing;
    select id into v_cat_id from catalog.categories where name = r.category;

    -- รุ่น = Collection + หมวด (กฎ B1)
    insert into catalog.products (collection, brand_id, category_id, status)
    values (r.collection, v_brand_id, v_cat_id, 'ขายอยู่')
    on conflict (brand_id, collection, category_id) do nothing;
    select id into v_prod_id from catalog.products
      where brand_id = v_brand_id and collection = r.collection and category_id = v_cat_id;

    -- ★ SKU เกิดตรงนี้ที่เดียว และเกิดตอนอนุมัติเท่านั้น
    v_sku := catalog.mint_sku('นำเข้าจากไฟล์ราคา 2026 แถวที่ ' || r.source_row_no);

    insert into catalog.product_variants
      (sku, product_id, configuration, width_cm, depth_cm, height_cm, seat_height_cm,
       material_grade, wood_type, wood_colour, legacy_nnsku, legacy_fullname, status)
    values
      (v_sku, v_prod_id, r.sub_category, r.width_cm, r.depth_cm, r.height_cm, r.seat_height_cm,
       r.material_grade, r.wood, r.wood_colour,
       nullif(r.legacy_nnsku, 'xxxxxxxx'), r.legacy_fullname, 'ขายอยู่')
    returning id into v_variant;

    if r.list_price_incl_vat is not null then
      insert into pricing.variant_prices (variant_id, list_price_incl_vat)
      values (v_variant, r.list_price_incl_vat);
    end if;

    update catalog.import_variants
       set review_status = 'อนุมัติแล้ว',
           reviewed_by   = auth.uid(),
           reviewed_at   = now(),
           variant_id    = v_variant
     where id = r.id;

    n := n + 1;
  end loop;

  return n;
end;
$$;

revoke all on function catalog.approve_import_group(text, text) from public, anon;
grant execute on function catalog.approve_import_group(text, text) to authenticated;

comment on function catalog.approve_import_group(text, text) is
  'อนุมัติทั้งกลุ่มในครั้งเดียว · สร้างแบรนด์/หมวด/รุ่น/ตัวขายจริง/ราคา ให้ครบ '
  'และเป็นจุดเดียวในระบบที่ SKU ถูกออกจากการนำเข้า';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table catalog.import_batches  enable row level security;
alter table catalog.import_variants enable row level security;

create policy import_batches_select on catalog.import_batches
  for select to authenticated using (core.has_capability('products.read'));
create policy import_batches_write on catalog.import_batches
  for all to authenticated
  using (core.has_capability('products.write'))
  with check (core.has_capability('products.write'));

create policy import_variants_select on catalog.import_variants
  for select to authenticated using (core.has_capability('products.read'));
create policy import_variants_insert on catalog.import_variants
  for insert to authenticated with check (core.has_capability('products.write'));
create policy import_variants_update on catalog.import_variants
  for update to authenticated using (core.has_capability('products.write'));

create trigger no_delete_import_batches before delete on catalog.import_batches
  for each row execute function core.prevent_delete();
create trigger no_delete_import_variants before delete on catalog.import_variants
  for each row execute function core.prevent_delete();
create trigger touch_import_variants before update on catalog.import_variants
  for each row execute function core.touch_updated_at();

grant select, insert, update on catalog.import_batches, catalog.import_variants to authenticated;
revoke delete on catalog.import_batches, catalog.import_variants from authenticated, anon;
revoke all on catalog.import_batches, catalog.import_variants from anon;

-- ============================================================================
-- 0018 · ราคาแบบ "บวกเพิ่มจากผ้า A กี่บาท"
-- ============================================================================
-- ที่มา: ไฟล์ราคามีแค่ผ้า A สำหรับ 5 กลุ่ม (กีวี่ เก้าอี้/โซฟา/อาร์มแชร์ ·
-- ฌ เฌอ หมอน · อีมู เก้าอี้) ทั้งที่จริงลูกค้าเลือก ผ้า B/C/หนังแท้ ได้
--
-- ลองหาสูตรจากข้อมูล 131 คู่แล้ว ไม่มีสูตรเดียวที่ใช้ได้ทั้งบริษัท
--   เทียบเป็น %     กระจาย 118%–213%
--   เทียบเป็นบาท    กระจาย 2,475–129,600 (108 ค่าไม่ซ้ำ)
--   เทียบต่อตาราง.ม. กระจาย 7,859–33,633
-- ตัวอย่างที่ฟันธง: กระสา โซฟา 3 ที่นั่ง 151×75 บวกหนัง 8,900
--                  กระเรียน โซฟา 2 ที่นั่ง 135×97 บวกหนัง 39,700
-- ตัวใหญ่กว่าแต่บวกน้อยกว่า 4 เท่า → ตั้งเป็นรุ่นๆ ไป ไม่ได้มาจากสูตร
--
-- จึงเก็บ "ส่วนที่บวกเพิ่ม" เป็นตัวเลขที่คนกรอก แล้วคำนวณราคาสดทุกครั้ง
-- ไม่เก็บราคาสุดท้าย เพราะปีหน้าขึ้นราคาผ้า A แล้วราคาหนังจะค้างอยู่ที่เดิม
-- โดยไม่มีใครรู้ — ผิดกฎ A10 ตัวเลขที่คำนวณได้ห้ามเก็บเป็นช่องที่คนแก้ได้
-- ============================================================================

create table pricing.variant_price_uplifts (
  variant_id       uuid primary key references catalog.product_variants(id),
  base_variant_id  uuid not null references catalog.product_variants(id),
  uplift_incl_vat  numeric(12,2) not null,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references core.app_users(id),
  constraint uplift_not_self check (variant_id <> base_variant_id)
);

comment on table pricing.variant_price_uplifts is
  'ราคาที่บวกจากตัวฐาน เช่น หนังแท้ = ผ้า A + 12,000 · '
  'เก็บเฉพาะส่วนที่บวก ราคาจริงคำนวณสดจากตัวฐานเสมอ (กฎ A10)';
comment on column pricing.variant_price_uplifts.base_variant_id is
  'ตัวฐานที่เอาราคามาบวก ปกติคือตัวผ้า A ของรุ่นและขนาดเดียวกัน';

-- ห้ามต่อกันเป็นทอดๆ · ตัวฐานต้องมีราคาของตัวเองเท่านั้น
-- ถ้าปล่อยให้ A อิง B อิง C วันหนึ่งจะมีคนทำให้มันวนกลับมาหาตัวเอง
create or replace function pricing.guard_uplift_base()
returns trigger
language plpgsql
set search_path = pricing, catalog, core, public
as $$
begin
  if exists (select 1 from pricing.variant_price_uplifts
             where variant_id = new.base_variant_id) then
    raise exception 'ตัวฐานต้องเป็นตัวที่มีราคาของตัวเอง ห้ามอิงต่อกันเป็นทอดๆ';
  end if;
  if exists (select 1 from pricing.variant_price_uplifts
             where base_variant_id = new.variant_id) then
    raise exception 'ตัวนี้เป็นตัวฐานให้ตัวอื่นอยู่ จะให้ไปอิงตัวอื่นอีกไม่ได้';
  end if;
  return new;
end;
$$;

create trigger guard_base before insert or update on pricing.variant_price_uplifts
  for each row execute function pricing.guard_uplift_base();

select core.apply_standard_rules('pricing.variant_price_uplifts');

alter table pricing.variant_price_uplifts enable row level security;

create policy uplift_select on pricing.variant_price_uplifts
  for select to authenticated using (core.has_capability('products.read'));
create policy uplift_write on pricing.variant_price_uplifts
  for all to authenticated
  using (core.has_capability('products.write'))
  with check (core.has_capability('products.write'));

-- ---------------------------------------------------------------------------
-- ราคาคำนวณสด · ราคาของตัวเองมาก่อน ถ้าไม่มีค่อยไปบวกจากตัวฐาน
-- เพิ่มช่อง "ที่มาของราคา" ต่อท้าย เพื่อให้เซลส์รู้ว่าเลขนี้มาจากไหน
-- ---------------------------------------------------------------------------
create or replace view pricing.v_variant_price with (security_invoker = true) as
with priced as (
  select pr.variant_id, pr.list_price_incl_vat
  from pricing.variant_prices pr
  where pr.status = 'ขายอยู่'
    and pr.valid_from <= current_date
    and (pr.valid_to is null or pr.valid_to >= current_date)
)
select
  v.id                                as variant_id,
  v.sku,
  catalog.sku_display(v.sku::text)    as sku_display,
  p.collection,
  v.configuration,
  v.material_grade,
  coalesce(own.list_price_incl_vat,
           base.list_price_incl_vat + u.uplift_incl_vat)::numeric(12,2)
                                      as "ราคาเต็มรวม_vat",
  round(coalesce(own.list_price_incl_vat, base.list_price_incl_vat + u.uplift_incl_vat)
        / (1 + pricing.vat_rate()), 2)
                                      as "ราคาเต็มก่อน_vat",
  round(coalesce(own.list_price_incl_vat, base.list_price_incl_vat + u.uplift_incl_vat)
        - coalesce(own.list_price_incl_vat, base.list_price_incl_vat + u.uplift_incl_vat)
          / (1 + pricing.vat_rate()), 2)
                                      as vat,
  pricing.current_discount_percent(v.id)
                                      as "ส่วนลดปกติ_pct",
  round(coalesce(own.list_price_incl_vat, base.list_price_incl_vat + u.uplift_incl_vat)
        * (1 - pricing.current_discount_percent(v.id) / 100), 2)
                                      as "ราคาขายรวม_vat",
  case
    when own.list_price_incl_vat is not null then 'ราคาของตัวเอง'
    when u.variant_id is not null then
      'บวกจาก ' || catalog.sku_display(bv.sku::text) || ' + '
      || to_char(u.uplift_incl_vat, 'FM999,999') || ' บาท'
    else 'ยังไม่มีราคา'
  end                                 as "ที่มาของราคา"
from catalog.product_variants v
join catalog.products p               on p.id = v.product_id
left join priced own                  on own.variant_id = v.id
left join pricing.variant_price_uplifts u on u.variant_id = v.id
left join priced base                 on base.variant_id = u.base_variant_id
left join catalog.product_variants bv on bv.id = u.base_variant_id;

comment on view pricing.v_variant_price is
  'สำหรับเซลส์ · ทุกตัวเลขคำนวณสด ไม่มีช่องไหนเก็บไว้ · ไม่มีต้นทุนโผล่มาเลย · '
  'ตัวที่ไม่มีราคาของตัวเองจะบวกจากตัวฐานให้อัตโนมัติ';

-- ---------------------------------------------------------------------------
-- เพิ่มตัวสินค้าใหม่เข้ารุ่นที่มีอยู่ · คัดลอกสเปกจากตัวฐาน เปลี่ยนแค่วัสดุหุ้ม
-- เป็นอีกจุดที่ SKU ถูกออก จึงต้องด่านเดียวกับตอนอนุมัตินำเข้า
-- ---------------------------------------------------------------------------
create or replace function catalog.add_variant_from_base(
  p_base_variant_id uuid,
  p_material_grade  text,
  p_uplift          numeric,
  p_note            text default null
) returns uuid
language plpgsql security definer
set search_path = core, catalog, materials, pricing, cost, public
as $$
declare b record; v_sku char(8); v_new uuid;
begin
  if not core.has_capability('products.write') then
    raise exception 'ต้องมีสิทธิ์ products.write จึงจะเพิ่มตัวสินค้าได้'
      using errcode = 'insufficient_privilege';
  end if;

  select * into b from catalog.product_variants where id = p_base_variant_id;
  if not found then raise exception 'ไม่พบตัวฐานที่อ้างถึง'; end if;

  if coalesce(trim(p_material_grade), '') = '' then
    raise exception 'ต้องระบุวัสดุหุ้ม';
  end if;
  if p_uplift is null or p_uplift < 0 then
    raise exception 'ส่วนที่บวกเพิ่มต้องไม่ติดลบ';
  end if;
  if p_material_grade = b.material_grade then
    raise exception 'วัสดุหุ้มซ้ำกับตัวฐาน (%) — ไม่ใช่ตัวใหม่', b.material_grade;
  end if;

  if not exists (select 1 from pricing.variant_prices
                 where variant_id = p_base_variant_id and status = 'ขายอยู่') then
    raise exception 'ตัวฐานยังไม่มีราคา จะเอาอะไรไปบวก';
  end if;

  if exists (
    select 1 from catalog.product_variants x
    where x.product_id = b.product_id
      and x.material_grade is not distinct from p_material_grade
      and x.configuration is not distinct from b.configuration
      and x.width_cm  is not distinct from b.width_cm
      and x.depth_cm  is not distinct from b.depth_cm
      and x.height_cm is not distinct from b.height_cm
      and x.wood_type is not distinct from b.wood_type
  ) then
    raise exception 'ตัวนี้มีอยู่แล้ว (% · ขนาดเดียวกัน)', p_material_grade;
  end if;

  v_sku := catalog.mint_sku('เพิ่มจากตัวฐาน ' || catalog.sku_display(b.sku::text)
                            || ' เปลี่ยนเป็น ' || p_material_grade);

  insert into catalog.product_variants
    (sku, product_id, configuration, width_cm, depth_cm, height_cm, seat_height_cm,
     material_grade, wood_type, wood_colour, seat_count, arm_config, is_modular, status)
  values
    (v_sku, b.product_id, b.configuration, b.width_cm, b.depth_cm, b.height_cm,
     b.seat_height_cm, p_material_grade, b.wood_type, b.wood_colour,
     b.seat_count, b.arm_config, b.is_modular, 'ขายอยู่')
  returning id into v_new;

  insert into pricing.variant_price_uplifts
    (variant_id, base_variant_id, uplift_incl_vat, note)
  values (v_new, p_base_variant_id, p_uplift, p_note);

  return v_new;
end;
$$;

revoke all on function catalog.add_variant_from_base(uuid, text, numeric, text)
  from public, anon;
grant execute on function catalog.add_variant_from_base(uuid, text, numeric, text)
  to authenticated;

comment on function catalog.add_variant_from_base(uuid, text, numeric, text) is
  'เพิ่มตัวสินค้าใหม่โดยคัดลอกสเปกจากตัวฐาน เปลี่ยนวัสดุหุ้ม และตั้งส่วนที่บวกเพิ่ม · '
  'เป็นอีกจุดที่ SKU ถูกออก';

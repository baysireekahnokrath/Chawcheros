-- ============================================================================
-- ทดสอบ ความลึกที่นั่ง (0031)
-- ============================================================================
-- วิธีรัน · ต้องมี -1 ไม่งั้น "set local" ไม่มีผล แล้วจะติดเรื่องสิทธิ์
--   psql -1 -v ON_ERROR_STOP=1 -d t1 -f supabase/tests/13_seat_depth.sql
--
-- สิ่งที่ต้องพิสูจน์
--   1 ตัวที่ไฟล์ให้ค่ามา → ค่าไปถึงตัวสินค้าจริงตอนออก SKU
--   2 ตัวที่ไฟล์ไม่ให้ค่ามา → ยังว่าง ไม่ถูกเดาแทน (Bay สั่ง "เฉพาะตัวที่มี")
--   3 เพิ่มตัวจากตัวฐาน → ค่าถูกคัดลอกไปด้วย ไม่หาย
-- ============================================================================

insert into auth.users (id) values ('33333333-3333-3333-3333-333333333333')
  on conflict do nothing;
insert into core.app_users (id, email, full_name, status)
  values ('33333333-3333-3333-3333-333333333333','seat@test','ทดสอบที่นั่ง','ใช้งาน')
  on conflict do nothing;
insert into core.user_capabilities (user_id, capability)
  values ('33333333-3333-3333-3333-333333333333','products.write'),
         ('33333333-3333-3333-3333-333333333333','products.read')
  on conflict do nothing;

set local role authenticated;
set local "test.uid" = '33333333-3333-3333-3333-333333333333';

-- สองแถวจากไฟล์จริง · โอมุ D167 (101) H72 (46) มีค่า · อีกแถวไม่มีวงเล็บ
with b as (
  insert into catalog.import_batches (source_file, note)
  values ('ทดสอบความลึกที่นั่ง', '0031') returning id
)
insert into catalog.import_variants
  (batch_id, source_row_no, brand, category, collection, sub_category,
   material_grade, width_cm, depth_cm, height_cm, seat_height_cm, seat_depth_cm,
   list_price_incl_vat)
select b.id, x.n, 'ฌ เฌอ', 'โซฟา', 'ทดสอบที่นั่ง', x.cfg,
       'ผ้า A', x.w, x.d, x.h, x.sh, x.sd, x.price
from b, (values
  (901, 'มีค่าในวงเล็บ',   167.0, 167.0, 72.0, 46.0, 101.0, 180000.00),
  (902, 'ไม่มีวงเล็บ',     180.0,  90.0, 72.0, null, null,   71550.00)
) as x(n, cfg, w, d, h, sh, sd, price);

do $$
declare n int;
begin
  n := catalog.approve_import_rows(
    (select array_agg(id order by source_row_no) from catalog.import_variants
     where collection = 'ทดสอบที่นั่ง'));
  if n <> 2 then raise exception 'ควรอนุมัติได้ 2 ตัว แต่ได้ %', n; end if;
end $$;

-- ข้อ 1 + 2
do $$
declare v_has numeric; v_none numeric; v_id uuid; v_new uuid;
begin
  select seat_depth_cm into v_has from catalog.product_variants
   where configuration = 'มีค่าในวงเล็บ';
  if v_has is distinct from 101.0 then
    raise exception 'ข้อ 1 พัง: ความลึกที่นั่งควรเป็น 101 แต่ได้ %', coalesce(v_has::text,'ว่าง');
  end if;

  select seat_depth_cm into v_none from catalog.product_variants
   where configuration = 'ไม่มีวงเล็บ';
  if v_none is not null then
    raise exception 'ข้อ 2 พัง: ตัวที่ไฟล์ไม่ให้ค่ามา ต้องว่าง แต่ได้ %', v_none;
  end if;

  -- ข้อ 3 · คัดลอกตอนเพิ่มตัวจากตัวฐาน
  select id into v_id from catalog.product_variants where configuration = 'มีค่าในวงเล็บ';
  v_new := catalog.add_variant_from_base(v_id, 'หนังแท้', 25000, 'ทดสอบ 0031');
  select seat_depth_cm into v_has from catalog.product_variants where id = v_new;
  if v_has is distinct from 101.0 then
    raise exception 'ข้อ 3 พัง: ตัวที่เพิ่มจากตัวฐานควรได้ 101 แต่ได้ %', coalesce(v_has::text,'ว่าง');
  end if;

  raise notice 'ผ่านทั้ง 3 ข้อ · ตัวที่มีค่าได้ 101 · ตัวที่ไม่มีค่ายังว่าง · คัดลอกต่อได้';
end $$;

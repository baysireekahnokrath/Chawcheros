-- ============================================================================
-- 0022 · พนักงานทุกคนอ่านข้อมูลสินค้าได้ · แก้บั๊กที่ทำให้สองโมดูลใช้ไม่ได้จริง
-- ============================================================================
-- เจอตอนทดสอบโมดูลคอนเทนต์ วิว "ลงครบทุกที่แล้วยัง" คืนศูนย์แถวทั้งที่มีข้อมูล
-- ไล่ดูแล้วพบว่าเป็นปัญหาเชิงโครงสร้าง ไม่ใช่เรื่องเฉพาะวิวนั้น
--
-- ต้นเหตุ: products.read กลายเป็นด่านของเกือบทุกตาราง รวมถึง marketing.channels
-- ซึ่งเก็บแค่ชื่อแพลตฟอร์ม (TikTok, YouTube) ที่ไม่ได้เป็นความลับอะไรเลย
-- ผลคือ
--   · คนคลังที่มีแค่ stock.read → เปิดหน้า "ของที่ต้องตามคืน" แล้วว่างเปล่า
--     เพราะวิวนั้น join ไปหา catalog.products และ pricing เพื่อเอาชื่อรุ่นกับมูลค่า
--   · กราฟิกที่มีแค่ design.write → เปิดหน้าคอนเทนต์แล้วว่างเปล่า
--     เพราะวิว join ไปหา marketing.channels เพื่อเอาชื่อช่องทาง
-- ทั้งสองกรณีไม่ error ด้วย มันเงียบแล้วโชว์ว่าไม่มีข้อมูล ซึ่งหลอกกว่า error
--
-- ทำไมถึงแก้แบบนี้: เอกสารหัวข้อ 3 ของ Bay เขียนไว้เองว่าทั้งหกแผนกอ่านข้อมูลสินค้า
--   คลังอ่านออเดอร์ที่ต้องเตรียม · ขายอ่านสต็อก ราคา ผ้า · CS อ่านสเปก
--   จัดส่งอ่านขนาดน้ำหนัก · การตลาดอ่านสเปกและรูป · กราฟิกอ่านสเปกและรูปสินค้า
-- แปลว่า products.read ควรเป็นของทุกคนตั้งแต่แรก การบังคับให้ต้องให้สิทธิ์
-- เป็นรายคนจึงเป็นแค่ช่องให้ลืม แล้วหน้าจอจะว่างเปล่าโดยไม่มีใครรู้สาเหตุ
--
-- ★ เส้นที่ยังอยู่เหมือนเดิม: ต้นทุนและกำไร (cost.read) ยังเป็นของเจ้าของคนเดียว
--   และการ "แก้" ทุกอย่างยังต้องมีสิทธิ์เขียนของโมดูลนั้นเหมือนเดิม
--   ไฟล์นี้เปิดแค่การ "อ่าน" ของที่พนักงานต้องใช้ทำงานอยู่แล้ว
-- ============================================================================

-- ---------------------------------------------------------------------------
-- พนักงานที่ยังทำงานอยู่ · คนที่ลาออกหรือโดนระงับอ่านไม่ได้
-- ---------------------------------------------------------------------------
create or replace function core.is_staff()
returns boolean
language sql stable security definer
set search_path = core, public
as $$
  select exists (
    select 1 from core.app_users
    where id = auth.uid() and status = 'ใช้งาน'
  )
$$;

comment on function core.is_staff() is
  'ล็อกอินอยู่และยังเป็นพนักงาน · ใช้เป็นด่านของข้อมูลที่ทุกแผนกต้องอ่านเพื่อทำงาน';

revoke all on function core.is_staff() from public, anon;
grant execute on function core.is_staff() to authenticated;

-- ---------------------------------------------------------------------------
-- เปลี่ยนด่านการ "อ่าน" ของข้อมูลอ้างอิงที่ทุกแผนกต้องใช้
-- ข้อมูลที่ยังไม่ผ่านการตรวจ (import_*) ไม่รวมอยู่ในนี้ เพราะยังไม่ใช่สินค้าจริง
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select * from (values
      ('catalog','brands','brands_select'),
      ('catalog','categories','categories_select'),
      ('catalog','products','products_select'),
      ('catalog','product_variants','product_variants_select'),
      ('catalog','sku_registry','sku_registry_select'),
      ('materials','materials','materials_select'),
      ('materials','material_collections','material_collections_select'),
      ('materials','material_features','material_features_select'),
      ('materials','material_feature_links','material_feature_links_select'),
      ('pricing','variant_prices','variant_prices_select'),
      ('pricing','variant_price_uplifts','uplift_select'),
      ('pricing','discount_rules','discount_rules_select'),
      ('pricing','payment_discounts','payment_discounts_select'),
      ('pricing','volume_discount_tiers','volume_discount_tiers_select'),
      ('pricing','vat_rates','vat_rates_select'),
      ('marketing','channels','channels_select')
    ) as t(sch, tbl, pol)
  loop
    if exists (select 1 from pg_policies
               where schemaname = r.sch and tablename = r.tbl and policyname = r.pol) then
      execute format('drop policy %I on %I.%I', r.pol, r.sch, r.tbl);
    end if;
    execute format(
      'create policy %I on %I.%I for select to authenticated using (core.is_staff())',
      r.pol, r.sch, r.tbl);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- วิวที่ join ข้ามโมดูลใช้ left join เผื่อไว้
--
-- ถ้าวันหน้ามีใครรัดสิทธิ์ตารางที่ถูก join อีก วิวจะได้เสียแค่ชื่อที่หายไป
-- ไม่ใช่แถวหายทั้งแถวแบบเงียบๆ ซึ่งคือสิ่งที่เพิ่งเกิดขึ้นกับสองโมดูลนี้
-- ---------------------------------------------------------------------------
create or replace view content.v_placement_gaps with (security_invoker = true) as
select
  i.id                                                   as item_id,
  i.title                                                as "เรื่อง",
  i.format::text                                         as "รูปแบบ",
  i.stage::text                                          as "ขั้น",
  count(*)                                               as "ตั้งใจลงกี่ที่",
  count(*) filter (where p.published_url is not null)     as "ลงแล้ว",
  count(*) filter (where p.published_url is null)         as "ยังไม่ได้ลง",
  string_agg(coalesce(ch.name_th, p.channel_id), ' · ')
    filter (where p.published_url is null)               as "ที่ยังขาด"
from content.items i
join content.placements p       on p.item_id = i.id
left join marketing.channels ch on ch.id = p.channel_id
where i.stage in ('พร้อมโพสต์', 'โพสต์แล้ว')
group by i.id, i.title, i.format, i.stage
having count(*) filter (where p.published_url is null) > 0;

-- ---------------------------------------------------------------------------
-- คำสั่งตรวจ · คนคลังที่มีแค่ stock.read ต้องเห็นชื่อรุ่นในวิวของที่ต้องตามคืน
-- ถ้าเห็นศูนย์แถวทั้งที่มีของค้าง แปลว่าบั๊กนี้กลับมาแล้ว
-- ---------------------------------------------------------------------------

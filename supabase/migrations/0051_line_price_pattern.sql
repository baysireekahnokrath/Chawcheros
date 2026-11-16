-- ============================================================================
-- 0039 · ราคาตอบลูกค้าตามแบบของ Bay (D13 · คอลัมน์ "ราคา งานไม้ โซฟา - Answer Customer")
-- ============================================================================
-- Bay 2026-11-12: "ผมเคยให้ pattern ในการตอบราคาลูกค้าไปแล้ว · ทำไมทำผิดซ้ำๆ"
-- แบบที่ทีมใช้จริง (docs/source/standard-price-2026-grid-view.csv · docs/price-list-analysis.md หัวข้อ 3):
--   <Full name> ราคา <เต็ม> ลด <x>% เหลือ <หลังลด> ชำระเป็นเงินสด ลด on top เพิ่ม <y>% เหลือ <สุดท้าย>
--   ภายใน เดือน<เดือนนี้> และส่วนลดเพิ่มเติมตามโปรฯ ได้ที่ https://chawcher.com/category/promotion/
-- 0038 พลาด: ไม่ส่ง % on top (ส่วนลดเงินสด) และไม่ได้ใช้แบบนี้
-- ============================================================================

create or replace function line_agent._price_full(p_query text)
returns jsonb
language sql stable security definer
set search_path = line_agent, catalog, pricing, public
as $$
  with rows as (
    select distinct on (iv.legacy_fullname)
           iv.legacy_fullname as name,
           coalesce(vp."ราคาเต็มรวม_vat", iv.list_price_incl_vat) as list_price,
           coalesce(vp."ส่วนลดปกติ_pct", iv.discount_pct, 0) as disc_pct,
           coalesce(iv.ontop_pct, 0) as ontop_pct,
           (iv.variant_id is not null) as approved,
           line_agent.match_score(concat_ws(' ', iv.legacy_fullname, iv.collection, iv.category, iv.sub_category,
                                            iv.material_grade, iv.wood, iv.wood_colour), p_query) as score,
           iv.source_row_no
    from catalog.import_variants iv
    left join pricing.v_variant_price vp on vp.variant_id = iv.variant_id
    where iv.legacy_fullname is not null
      and coalesce(iv.review_status::text, '') <> 'ไม่ใช้'
    order by iv.legacy_fullname, iv.reviewed_at desc nulls last
  ),
  best as (select max(score) as top from rows where score >= 0)
  select jsonb_build_object(
    'exact', coalesce((select top from best), -1) >= line_agent.query_words(p_query),
    'total', (select count(*) from rows, best where rows.score = best.top),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
               'name', name, 'list_price', list_price, 'disc_pct', disc_pct, 'ontop_pct', ontop_pct,
               -- สูตรเดียวกับไฟล์ราคา (ตรวจแล้วถูก 751/751 แถว)
               'price', round(list_price * (1 - disc_pct / 100), 2),
               'final', round(list_price * (1 - disc_pct / 100) * (1 - ontop_pct / 100), 2),
               'approved', approved) order by source_row_no)
             from (select r.* from rows r, best where r.score = best.top order by r.source_row_no limit 12) t), '[]'::jsonb))
$$;

revoke all on function line_agent._price_full(text) from public, anon, authenticated, service_role;
notify pgrst, 'reload schema';

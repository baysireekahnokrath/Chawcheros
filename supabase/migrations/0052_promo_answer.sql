-- ============================================================================
-- 0052 · โปรฯ ต่อท้ายคำตอบราคา (Bay 2026-11-12)
-- ============================================================================
-- Bay: คำตอบราคา = ส่วนหัวตายตัว "<ชื่อเต็ม> ราคา <เต็ม> ลด <x>% เหลือ <หลังลด>"
--      ส่วนท้าย = โปรฯ ของช่วงนั้น (ทุกสินค้า / เฉพาะสินค้า) + ลิงก์โปรฯ
--      "ชำระเงินสด ลด on top" นับเป็นโปรฯ · มีส่งฟรีกับของแถมด้วย
--
-- ที่เก็บ: ตารางเดิม marketing.promotions (0010) เพิ่มประเภท
--   ลดราคา      = แบบเดิม · ผ่าน pricing.discount_rules · เปลี่ยน "ลด x%" ในส่วนหัว
--   ชำระเงินสด  = % ลดเพิ่มเมื่อจ่ายเงินสด · คิดต่อจากราคาหลังลด (สูตรเดิมของไฟล์ราคา)
--   ขั้นบันได   = ซื้อครบ <ยอด> ลดเพิ่ม <%> (J5)
--   ส่งฟรี      = มี/ไม่มียอดขั้นต่ำก็ได้
--   ของแถม      = ต้องบอกว่าแถมอะไร
-- โปรประเภทอื่นที่ไม่ใช่ "ลดราคา" ไม่แตะ pricing.discount_rules เลย
-- (ถ้าสร้างกฎส่วนลด 0% ไว้ กฎที่เจาะจงกว่าจะชนะ แล้วทับส่วนลดจริงของสินค้า)
--
-- ไฟล์ราคาให้ on top 0% กับ 16 ตัว (เก้าอี้ กีวี่/อีมู · โต๊ะกลาง นกยูง/นางนวล/สวอน
-- · โต๊ะข้าง นางนวล/เบิร์ด · โต๊ะข้างเตียง กางเขน) → โปรชำระเงินสดไม่ใช้กับตัวที่ไฟล์ยกเว้น
-- ============================================================================

alter table marketing.promotions
  add column kind      text not null default 'ลดราคา'
                       check (kind in ('ลดราคา', 'ชำระเงินสด', 'ขั้นบันได', 'ส่งฟรี', 'ของแถม')),
  add column percent   numeric(5,2) check (percent is null or (percent > 0 and percent <= 100)),
  add column min_total numeric(12,2) check (min_total is null or min_total > 0),
  add column scope     pricing.discount_scope not null default 'ทั้งหมด',
  add column target_id uuid,
  add column detail    text,
  add column link_url  text check (link_url is null or link_url ~ '^https://');

-- แถวเก่า (ถ้ามี) ไม่ต้องผ่านกฎนี้ย้อนหลัง
alter table marketing.promotions
  add constraint promotions_kind_fields check (case kind
    when 'ลดราคา'     then discount_rule_id is not null
    when 'ชำระเงินสด' then percent is not null
    when 'ขั้นบันได'  then percent is not null and min_total is not null
    when 'ส่งฟรี'     then true
    when 'ของแถม'     then nullif(trim(detail), '') is not null
  end) not valid,
  add constraint promotions_scope_target check ((scope = 'ทั้งหมด') = (target_id is null));

comment on column marketing.promotions.kind is
  'ลดราคา = เปลี่ยนส่วนลดหลัก (ผ่าน discount_rules) · อย่างอื่น = ต่อท้ายคำตอบราคาของบอท';
comment on column marketing.promotions.link_url is 'ลิงก์หน้าโปรฯ · ว่าง = ใช้ https://chawcher.com/category/promotion/';

-- โปรเงินสดที่ใช้อยู่ตอนนี้ (ไฟล์ Standard Price 2026 · Bay: ราคานี้หมดเขต 30 พ.ย. 2569)
insert into marketing.promotions (name, kind, percent, starts_on, ends_on, status, headline)
select 'ชำระเงินสด ลด on top 10%', 'ชำระเงินสด', 10, date '2026-11-01', date '2026-11-30', 'กำลังใช้',
       'ตามไฟล์ Standard Price 2026 · ตัวที่ไฟล์ให้ on top 0% ไม่ร่วม'
where not exists (select 1 from marketing.promotions where kind = 'ชำระเงินสด');

-- ---------------------------------------------------------------------------
-- โปรที่ใช้กับสินค้านี้วันนี้ (ไม่รวม "ลดราคา" เพราะอยู่ในส่วนหัวแล้ว)
-- p_variant ว่าง (ยังไม่ผ่านการตรวจ) = ได้เฉพาะโปรทุกสินค้า
-- ---------------------------------------------------------------------------
create or replace function line_agent._promos_for(p_variant uuid, p_cash_ok boolean)
returns jsonb
language sql stable security definer
set search_path = line_agent, marketing, catalog, pricing, public
as $$
  with prod as (
    select p.id as pid, p.category_id as cid
    from catalog.product_variants v join catalog.products p on p.id = v.product_id
    where v.id = p_variant
  ),
  hit as (
    select pr.*, pricing.discount_specificity(pr.scope) as spec
    from marketing.promotions pr
    left join prod on true
    where pr.status = 'กำลังใช้'
      and pr.kind <> 'ลดราคา'
      and pr.starts_on <= line_agent.today()
      and (pr.ends_on is null or pr.ends_on >= line_agent.today())
      and (pr.scope = 'ทั้งหมด'
           or (pr.scope = 'หมวด'      and pr.target_id = prod.cid)
           or (pr.scope = 'รุ่น'       and pr.target_id = prod.pid)
           or (pr.scope = 'ตัวสินค้า' and pr.target_id = p_variant))
      and (pr.kind <> 'ชำระเงินสด' or p_cash_ok)
  ),
  -- เงินสดมีได้ตัวเดียว · ตัวที่เจาะจงกว่าชนะ (เหมือนกฎส่วนลด)
  cash as (select * from hit where kind = 'ชำระเงินสด' order by spec desc, starts_on desc, created_at desc limit 1),
  pick as (select * from cash union all select * from hit where kind <> 'ชำระเงินสด')
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', kind, 'name', name, 'percent', percent, 'min_total', min_total,
           'detail', detail, 'link', link_url, 'ends_on', ends_on)
         order by array_position(array['ชำระเงินสด','ขั้นบันได','ส่งฟรี','ของแถม'], kind),
                  min_total nulls first, created_at), '[]'::jsonb)
  from pick
$$;
revoke all on function line_agent._promos_for(uuid, boolean) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- ราคา · % เงินสดมาจากโปรฯ แทนไฟล์ (ไฟล์ใช้แค่บอกว่าตัวไหนไม่ร่วม)
-- ---------------------------------------------------------------------------
create or replace function line_agent._price_full(p_query text)
returns jsonb
language sql stable security definer
set search_path = line_agent, catalog, pricing, public
as $$
  with rows as (
    select distinct on (iv.legacy_fullname)
           iv.legacy_fullname as name,
           iv.variant_id,
           coalesce(vp."ราคาเต็มรวม_vat", iv.list_price_incl_vat) as list_price,
           coalesce(vp."ส่วนลดปกติ_pct", iv.discount_pct, 0) as disc_pct,
           coalesce(iv.ontop_pct, 0) > 0 as cash_ok,
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
  best as (select max(score) as top from rows where score >= 0),
  shown as (
    select r.*, line_agent._promos_for(r.variant_id, r.cash_ok) as promos
    from rows r, best where r.score = best.top
    order by r.source_row_no limit 12
  ),
  calc as (
    select t.*,
           coalesce((select (p->>'percent')::numeric from jsonb_array_elements(t.promos) p
                     where p->>'kind' = 'ชำระเงินสด'), 0) as cash_pct
    from shown t
  )
  select jsonb_build_object(
    'exact', coalesce((select top from best), -1) >= line_agent.query_words(p_query),
    'total', (select count(*) from rows, best where rows.score = best.top),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
               'name', name, 'list_price', list_price, 'disc_pct', disc_pct, 'ontop_pct', cash_pct,
               -- สูตรเดียวกับไฟล์ราคา (ตรวจแล้วถูก 751/751 แถว)
               'price', round(list_price * (1 - disc_pct / 100), 2),
               'final', round(list_price * (1 - disc_pct / 100) * (1 - cash_pct / 100), 2),
               'promos', promos,
               'approved', approved) order by source_row_no)
             from calc), '[]'::jsonb))
$$;

revoke all on function line_agent._price_full(text) from public, anon, authenticated, service_role;
notify pgrst, 'reload schema';

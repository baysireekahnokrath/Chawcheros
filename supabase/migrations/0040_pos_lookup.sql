-- ============================================================================
-- 0040 · POS หน้าบูธ · เปิดให้ย้อนดูบิลวันก่อนได้
-- ============================================================================
-- โจทย์จาก Bay (2026-11-07) ดูจากหน้าบูธจริง
--   "ยอดขายต้องเลือกวันได้ด้วย และต้องกลับไปก็อปปี้ย้อนหลังเพื่อส่งให้ลูกค้าได้"
--
-- ปัญหาของเดิม
--   หน้า /pos เก็บบิลไว้ใน localStorage ของเครื่องที่ขาย และโชว์เฉพาะ "วันนี้"
--   · ลูกค้าทักมาวันถัดไปขอใบเสร็จ → ไม่มีทางหาเจอ
--   · ลูกค้าซื้อจากเครื่องน้องสาว แต่คนตอบแชทถือเครื่องอื่น → ไม่มีทางหาเจอ
--   · เคลียร์ข้อมูลเบราว์เซอร์ทีเดียว บิลที่ส่งเข้าระบบแล้วก็ยังหายไปจากหน้าจอ
--
--   ทั้งสามกรณีข้อมูลอยู่ครบในฐานข้อมูลแล้ว · ขาดแค่ทางอ่านกลับ
--   เพราะ pos.sales อ่านได้เฉพาะคนที่มีสิทธิ์ admin (Bay) เท่านั้น
--
-- ทางแก้ · ใช้ประตูเดิม ไม่เปิดประตูใหม่
--   อ่านกลับผ่านฟังก์ชันที่ต้องใส่ PIN ร้านให้ถูก เหมือนตอนบันทึก
--   RLS ของตารางยังปิดสนิทเหมือนเดิม · anon แตะตารางตรงๆ ไม่ได้
--
-- ⚠️ สิ่งที่ต้องรู้: ใครมี PIN จะอ่านบิลทุกใบของงานได้ รวมชื่อและเบอร์ลูกค้า
--    เดิมคนมี PIN "เขียน" บิลปลอมได้อยู่แล้ว อันนี้เพิ่มสิทธิ์ "อ่าน" เข้าไป
--    → จบงานแล้วเปลี่ยน PIN ที่หลังบ้าน ลิงก์เดิมก็ใช้ไม่ได้ทันที
-- ============================================================================

-- ---------------------------------------------------------------------------
-- บิลของวันที่เลือก · ทุกเครื่องรวมกัน
-- ---------------------------------------------------------------------------
-- รูปแบบที่คืนกลับ ตรงกับรูปแบบที่หน้าเว็บเก็บใน localStorage ทุกช่อง
-- หน้าจอจึงเอาไปวาดและก็อปปี้ใบเสร็จได้ด้วยโค้ดชุดเดิม ไม่ต้องแปลงอะไร
create or replace function pos.list_sales(p_pin text, p_date date)
returns jsonb
language plpgsql security definer
set search_path = pos, extensions, public
as $$
declare v jsonb;
begin
  if not pos.check_pin(p_pin) then
    raise exception 'pin_invalid' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(x order by x->>'at' desc), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'id',            s.id,
      'no',            s.bill_no,
      'at',            to_char(s.sold_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'date',          to_char(s.sold_on, 'YYYY-MM-DD'),
      'seller',        s.seller,
      'items',         s.items,
      'subtotal',      s.subtotal,
      'discountType',  s.discount_type,
      'discountValue', s.discount_value,
      'discount',      s.discount,
      'total',         s.total,
      'pay',           s.pay,
      'customer',      s.customer,
      'phone',         s.phone,
      'note',          s.note,
      'status',        s.status,
      'synced',        true          -- มาจากฐานข้อมูล จึงเข้าระบบแน่นอน
    ) as x
    from pos.sales s
    where s.sold_on = p_date
  ) t;

  return v;
end $$;

comment on function pos.list_sales(text, date) is
  'บิลของวันที่เลือก ทุกเครื่องรวมกัน · ต้องใส่ PIN ร้าน · '
  'คืนรูปแบบเดียวกับที่หน้าเว็บเก็บในเครื่อง หน้าจอจึงใช้โค้ดวาดชุดเดิมได้';

-- ---------------------------------------------------------------------------
-- วันไหนมีบิลบ้าง · ให้ตัวเลือกวันที่รู้ว่ามีอะไรให้ดู ไม่ต้องเดาวัน
-- ---------------------------------------------------------------------------
create or replace function pos.sale_days(p_pin text)
returns jsonb
language plpgsql security definer
set search_path = pos, extensions, public
as $$
declare v jsonb;
begin
  if not pos.check_pin(p_pin) then
    raise exception 'pin_invalid' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(x order by x->>'date' desc), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'date',  to_char(s.sold_on, 'YYYY-MM-DD'),
      'bills', count(*) filter (where s.status = 'ปกติ'),
      'total', coalesce(sum(s.total) filter (where s.status = 'ปกติ'), 0)
    ) as x
    from pos.sales s
    group by s.sold_on
  ) t;

  return v;
end $$;

comment on function pos.sale_days(text) is
  'วันที่มีบิล พร้อมจำนวนและยอดรวมของวันนั้น · ใช้เติมตัวเลือกวันในหน้ายอดขาย';

revoke all on function pos.list_sales(text, date) from public;
revoke all on function pos.sale_days(text)        from public;
grant execute on function pos.list_sales(text, date) to anon, authenticated;
grant execute on function pos.sale_days(text)        to anon, authenticated;

notify pgrst, 'reload schema';

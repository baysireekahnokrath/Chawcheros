-- ============================================================================
-- 0006 · ปิดช่องโหว่ที่ advisor เจอหลัง apply 0005
-- ============================================================================
-- ฟังก์ชันราคา/ส่วนลดที่ 0005 สร้าง เปิดให้ anon เรียกได้โดยไม่ตั้งใจ
-- current_discount_percent อันตรายสุด เพราะคนนอกไล่ดูส่วนลดทุกตัวได้
-- ============================================================================

revoke all on function vat_rate(date)                        from public, anon;
revoke all on function volume_extra_percent(numeric, date)   from public, anon;
revoke all on function current_discount_percent(uuid, date)  from public, anon;
revoke all on function discount_specificity(discount_scope)  from public, anon;

grant execute on function vat_rate(date)                       to authenticated;
grant execute on function volume_extra_percent(numeric, date)  to authenticated;
grant execute on function current_discount_percent(uuid, date) to authenticated;
grant execute on function discount_specificity(discount_scope) to authenticated;

-- ---------------------------------------------------------------------------
-- หลังไฟล์นี้ advisor เหลือ 5 รายการ ทั้งหมดเป็นเจตนา ไม่ใช่ช่องโหว่:
--   has_capability · vat_rate · volume_extra_percent · current_discount_percent
--     → แอปต้องเรียกได้ และบอกได้แค่ข้อมูลที่คนล็อกอินมีสิทธิ์เห็นอยู่แล้ว
--   mint_sku
--     → แอปต้องเรียกได้ และมียามเช็ค products.write อยู่ข้างในฟังก์ชันเอง
-- ---------------------------------------------------------------------------

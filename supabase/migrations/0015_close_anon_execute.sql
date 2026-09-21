-- ============================================================================
-- 0015 · ปิดประตูสุดท้ายที่คนยังไม่ล็อกอินเรียกได้
-- ============================================================================
-- ก่อนเปิดเว็บให้พนักงานเข้าถึงจากอินเทอร์เน็ตได้จริง ไล่ตรวจว่า anon
-- (คนที่ยังไม่ล็อกอิน) แตะอะไรได้บ้าง ผลคือ
--
--   ตาราง/วิว ใน 6 schema ของเรา → ไม่ได้เลย  ✅
--   storage                      → RLS เปิด ไม่มี policy ไม่มี bucket  ✅
--   ฟังก์ชัน                      → ยังเรียกได้ 5 ตัว  ← ไฟล์นี้ปิด
--
-- ทั้ง 5 ตัวไม่ได้รั่วข้อมูล
--   sku_check_digit / sku_is_valid / sku_display คือเลขคณิตล้วน ไม่แตะตาราง
--   guard_* เป็นฟังก์ชัน trigger เรียกตรงๆ จะ error อยู่แล้ว
--
-- แต่เราจะพูดได้เต็มปากว่า "ยังไม่ล็อกอิน = ทำอะไรไม่ได้เลย" โดยไม่ต้องมี
-- ดอกจัน ก็ต่อเมื่อรายการนี้ว่างจริงๆ ความปลอดภัยที่ต้องอธิบายเป็นข้อยกเว้น
-- คือความปลอดภัยที่วันหนึ่งจะมีคนอธิบายผิด
-- ============================================================================

-- เลขคณิต SKU · เว็บเรียกตอนตรวจรหัสที่พนักงานพิมพ์ ซึ่งต้องล็อกอินอยู่แล้ว
revoke all on function catalog.sku_check_digit(text) from public, anon;
revoke all on function catalog.sku_is_valid(text)    from public, anon;
revoke all on function catalog.sku_display(text)     from public, anon;

grant execute on function catalog.sku_check_digit(text) to authenticated;
grant execute on function catalog.sku_is_valid(text)    to authenticated;
grant execute on function catalog.sku_display(text)     to authenticated;

-- ฟังก์ชัน trigger · ไม่มีใครควรเรียกตรงๆ แม้แต่คนที่ล็อกอินแล้ว
-- trigger ทำงานด้วยสิทธิ์ของเจ้าของตาราง ไม่ใช่สิทธิ์ของคนเรียก จึงไม่พัง
revoke all on function core.guard_core_module()      from public, anon, authenticated;
revoke all on function core.guard_module_dependents() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- หลังไฟล์นี้ คำสั่งตรวจข้างล่างต้องคืนค่าว่าง ถ้าไม่ว่างแปลว่ามีคนเปิดประตูใหม่
--
--   select n.nspname||'.'||p.proname
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname in ('core','catalog','materials','pricing','cost','marketing')
--     and has_function_privilege('anon', p.oid, 'EXECUTE');
-- ---------------------------------------------------------------------------

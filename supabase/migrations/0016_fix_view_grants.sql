-- ============================================================================
-- 0016 · วิวหน้าตรวจสินค้าไม่มีสิทธิ์ให้คนล็อกอินอ่าน + กันไม่ให้เกิดซ้ำ
-- ============================================================================
-- เจอตอนทดสอบเส้นทาง อัปโหลด → ตรวจ → อนุมัติ บนเครื่อง
-- กดเข้าหน้าตรวจแล้วเด้ง permission denied for view v_import_groups
--
-- ต้นเหตุ: 0008 สั่ง grant ... on ALL TABLES ตอนนั้น ซึ่งครอบคลุมเฉพาะ
-- ของที่มีอยู่ ณ วันนั้น ส่วน 0013 สร้างวิวใหม่แล้วให้สิทธิ์เฉพาะสองตาราง
-- ลืมวิวไป — วิวจึงไม่มีใครอ่านได้เลยนอกจากเจ้าของฐานข้อมูล
--
-- แก้สองชั้น ชั้นแรกแก้ของที่พังตอนนี้ ชั้นที่สองกันไม่ให้พังแบบเดิมอีก
-- เพราะถ้าแก้แค่ชั้นแรก โมดูลถัดไปที่มีวิวก็จะลืมอีก แล้วจะไปเจอตอนผู้ใช้กดใช้งาน
-- ============================================================================

-- ชั้นที่ 1 · ของที่พังตอนนี้
grant select on catalog.v_import_groups to authenticated;

-- ชั้นที่ 2 · ของที่จะสร้างต่อจากนี้ได้สิทธิ์เองอัตโนมัติ
-- ครอบคลุมทั้งตารางและวิว (Postgres นับวิวรวมอยู่ใน TABLES)
-- ยังไม่ให้ DELETE เหมือนเดิม เพราะกฎ A7 ห้ามลบข้อมูล เลิกขาย = เปลี่ยนสถานะ
do $$
declare s text;
begin
  foreach s in array array['core','catalog','materials','pricing','cost','marketing'] loop
    execute format(
      'alter default privileges in schema %I grant select, insert, update on tables to authenticated', s);
    execute format(
      'alter default privileges in schema %I grant usage, select on sequences to authenticated', s);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- คำสั่งตรวจ · ต้องคืนค่าว่าง ถ้าไม่ว่างแปลว่ามีของที่คนล็อกอินเข้าไม่ถึง
--
--   select n.nspname||'.'||c.relname
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname in ('core','catalog','materials','pricing','cost','marketing')
--     and c.relkind in ('r','v')
--     and not has_table_privilege('authenticated', c.oid, 'SELECT');
-- ---------------------------------------------------------------------------

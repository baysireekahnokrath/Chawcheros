-- ============================================================================
-- 0004 · ปิดช่องโหว่ที่ Supabase advisor ตรวจพบหลัง apply 0001-0003
-- ============================================================================
-- advisor เจอ 14 รายการ · ไฟล์นี้ปิดไป 12 · เหลือ 2 ที่เป็นเจตนา
--
--   1. search_path แก้ได้ (8 ฟังก์ชัน) → คนร้ายสลับ schema แล้วหลอกให้เรียกของปลอม
--   2. mint_sku เรียกได้จาก anon      → ใครก็ได้ยิง SKU รัวๆ จนทะเบียนเต็ม  ⚠️ อันนี้หนักสุด
--   3. write_audit เรียกตรงได้         → ปลอมประวัติการแก้ได้
-- ============================================================================

alter function prevent_delete()                  set search_path = public;
alter function touch_updated_at()                set search_path = public;
alter function apply_standard_rules(regclass)    set search_path = public;
alter function sku_check_digit(text)             set search_path = public;
alter function sku_is_valid(text)                set search_path = public;
alter function sku_display(text)                 set search_path = public;
alter function freeze_sku_registry()             set search_path = public;
alter function freeze_sku()                      set search_path = public;

-- ฟังก์ชัน trigger ไม่มีเหตุผลให้ใครเรียกตรง
revoke all on function write_audit()                  from public, anon, authenticated;
revoke all on function prevent_delete()               from public, anon, authenticated;
revoke all on function touch_updated_at()             from public, anon, authenticated;
revoke all on function freeze_sku()                   from public, anon, authenticated;
revoke all on function freeze_sku_registry()          from public, anon, authenticated;
revoke all on function apply_standard_rules(regclass) from public, anon, authenticated;

-- has_capability: คนล็อกอินเรียกดูสิทธิ์ตัวเองได้ คนนอกไม่ได้
revoke all on function has_capability(capability) from public, anon;
grant execute on function has_capability(capability) to authenticated;

-- ---------------------------------------------------------------------------
-- mint_sku · ใส่ยามไว้ข้างในฟังก์ชัน ไม่พึ่ง GRANT อย่างเดียว
-- ---------------------------------------------------------------------------
create or replace function mint_sku(p_note text default null)
returns char(8)
language plpgsql
security definer
set search_path = public
as $$
declare
  base      text;
  candidate char(8);
  attempt   int := 0;
begin
  if auth.uid() is null then
    raise exception 'ต้องล็อกอินก่อนจึงจะออก SKU ได้' using errcode = 'insufficient_privilege';
  end if;
  if not has_capability('products.write') then
    raise exception 'ต้องมีสิทธิ์ products.write จึงจะออก SKU ได้' using errcode = 'insufficient_privilege';
  end if;

  loop
    attempt := attempt + 1;
    base      := (1000000 + floor(random() * 9000000)::bigint)::text;
    candidate := base || sku_check_digit(base)::text;
    begin
      insert into sku_registry (sku, issued_by, note)
      values (candidate, auth.uid(), p_note);
      return candidate;
    exception when unique_violation then
      if attempt >= 50 then
        raise exception 'ออก SKU ไม่สำเร็จหลังลอง % ครั้ง — พื้นที่เลขใกล้เต็ม', attempt;
      end if;
    end;
  end loop;
end;
$$;

revoke all on function mint_sku(text) from public, anon;
grant execute on function mint_sku(text) to authenticated;

comment on function mint_sku(text) is
  'ทางเดียวที่ SKU จะเกิดได้ · ต้องล็อกอิน + มีสิทธิ์ products.write · '
  'ยามอยู่ในฟังก์ชันเอง ไม่พึ่ง GRANT อย่างเดียว';

-- ---------------------------------------------------------------------------
-- ที่เหลือ 2 รายการเป็นเจตนา ไม่ใช่ช่องโหว่:
--   has_capability  ต้องให้คนล็อกอินเรียกได้ · บอกได้แค่สิทธิ์ของตัวเอง
--   mint_sku        ต้องให้แอปเรียกได้ · มียามเช็คสิทธิ์อยู่ข้างในแล้ว
-- ---------------------------------------------------------------------------

-- ============================================================================
-- 0014 · ตั้งค่าผู้ใช้คนแรก
-- ============================================================================
-- ปัญหาไก่กับไข่: ต้องมีสิทธิ์ admin ถึงจะให้สิทธิ์คนอื่นได้
--                 แต่ตอนเริ่มต้นยังไม่มีใครมีสิทธิ์อะไรเลย
--
-- ทางแก้: คนแรกที่ล็อกอินเข้ามาตอนที่ยังไม่มีผู้ใช้เลย = เจ้าของ ได้สิทธิ์ครบ
--         ใช้ได้ครั้งเดียวในชีวิตของระบบ · ครั้งที่สองเป็นต้นไปจะถูกปฏิเสธ
--         หลังจากนั้นผู้ใช้ใหม่ต้องให้ admin สร้างให้เท่านั้น
-- ============================================================================

create or replace function core.bootstrap_first_owner(p_full_name text)
returns text
language plpgsql security definer
set search_path = core, public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  n       int;
begin
  if v_uid is null then
    raise exception 'ต้องล็อกอินก่อน' using errcode = 'insufficient_privilege';
  end if;

  select count(*) into n from core.app_users;
  if n > 0 then
    raise exception 'ระบบมีผู้ใช้อยู่แล้ว — ผู้ใช้ใหม่ต้องให้ผู้ดูแลระบบสร้างให้'
      using errcode = 'restrict_violation';
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into core.app_users (id, email, full_name, status)
  values (v_uid, v_email, p_full_name, 'ใช้งาน');

  -- เจ้าของได้ทุกความสามารถ รวม cost.read ที่คนอื่นไม่ได้
  insert into core.user_capabilities (user_id, capability, granted_by)
  select v_uid, c, v_uid from unnest(enum_range(null::core.capability)) c;

  return v_email;
end;
$$;

revoke all on function core.bootstrap_first_owner(text) from public, anon;
grant execute on function core.bootstrap_first_owner(text) to authenticated;

comment on function core.bootstrap_first_owner(text) is
  'ใช้ได้ครั้งเดียวตอนระบบยังไม่มีผู้ใช้เลย · คนแรกที่เรียก = เจ้าของ ได้สิทธิ์ครบ';

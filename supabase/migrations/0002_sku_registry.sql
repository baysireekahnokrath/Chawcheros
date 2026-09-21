-- ============================================================================
-- 0002 · ทะเบียน SKU และเครื่องออกเลข
-- ============================================================================
-- กฎ A3 · 8 หลัก · ไม่มีความหมายในตัวเอง · ห้ามซ้ำ · ห้ามเปลี่ยน · ห้ามใช้ซ้ำ
-- ตัวเลือก D2 · สุ่ม 7 หลัก + เลขตรวจสอบ 1 หลัก · แสดงเป็น XXX.XXX.XX
-- ตัวอย่างในเอกสารออกแบบ: 104.228.60  → ตรงกับรูปแบบนี้พอดี
-- ============================================================================

-- ---------------------------------------------------------------------------
-- เลขตรวจสอบ (Luhn mod 10) · พิมพ์ผิดตัวเดียว หรือสลับตัว ระบบจับได้ทันที
-- ---------------------------------------------------------------------------
create or replace function sku_check_digit(p_base text)
returns int
language plpgsql immutable
as $$
declare
  total int := 0;
  d     int;
  i     int;
  pos   int := 0;
begin
  if p_base !~ '^[0-9]+$' then
    raise exception 'ฐาน SKU ต้องเป็นตัวเลขล้วน: %', p_base;
  end if;
  -- เดินจากขวาไปซ้าย · ตำแหน่งคี่คูณสอง
  for i in reverse length(p_base)..1 loop
    d   := substring(p_base from i for 1)::int;
    pos := pos + 1;
    if pos % 2 = 1 then
      d := d * 2;
      if d > 9 then d := d - 9; end if;
    end if;
    total := total + d;
  end loop;
  return (10 - (total % 10)) % 10;
end;
$$;

create or replace function sku_is_valid(p_sku text)
returns boolean
language sql immutable
as $$
  select p_sku ~ '^[1-9][0-9]{7}$'
     and substring(p_sku from 8 for 1)::int
       = sku_check_digit(substring(p_sku from 1 for 7));
$$;

-- แสดงผลแบบ IKEA: 48291735 → 482.917.35
create or replace function sku_display(p_sku text)
returns text
language sql immutable
as $$
  select substring(p_sku from 1 for 3) || '.' ||
         substring(p_sku from 4 for 3) || '.' ||
         substring(p_sku from 7 for 2);
$$;

-- ---------------------------------------------------------------------------
-- ทะเบียน · ทุกเลขที่เคยออก อยู่ที่นี่ตลอดไป
-- ---------------------------------------------------------------------------
create table sku_registry (
  sku         char(8) primary key check (sku_is_valid(sku)),
  issued_at   timestamptz not null default now(),
  issued_by   uuid references app_users(id),
  note        text
);

comment on table sku_registry is
  'ออกแล้วออกเลย · ห้ามเอากลับมาใช้ซ้ำแม้สินค้าเลิกขายไปแล้ว '
  'เพราะออเดอร์เก่าต้องอ่านออกเสมอ (กฎ A3 + A7)';

create trigger no_delete_sku_registry before delete on sku_registry
  for each row execute function prevent_delete();

-- SKU ที่ออกแล้ว ห้ามแก้
create or replace function freeze_sku_registry()
returns trigger language plpgsql as $$
begin
  if new.sku is distinct from old.sku then
    raise exception 'SKU ที่ออกแล้วห้ามแก้ (กฎ A3)' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
create trigger freeze_sku_registry before update on sku_registry
  for each row execute function freeze_sku_registry();

-- ---------------------------------------------------------------------------
-- เครื่องออกเลข · ระบบออกให้เท่านั้น ห้ามคนพิมพ์เอง
-- ---------------------------------------------------------------------------
-- ทำไมสุ่ม ไม่ใช่เรียง 1,2,3:
--   · เลขเรียงบอกความลับ — เห็น 00001042 ก็รู้ว่าเรามีสินค้าพันกว่าตัว
--   · เลขเรียงชวนให้คนเดาความหมาย แล้ววันหนึ่งจะมีคนพูดว่า "เลข 3 ขึ้นต้นคือโซฟา"
--   · เริ่มที่ 1 ไม่เอา 0 นำหน้า เพราะ export ลง Sheets แล้วศูนย์หน้าจะหาย
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
  loop
    attempt := attempt + 1;
    -- 1000000..9999999  (7 หลัก ไม่ขึ้นต้นด้วย 0) → พื้นที่ 9 ล้านเลข
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

comment on function mint_sku(text) is
  'ทางเดียวที่ SKU จะเกิดได้ · คนพิมพ์เองไม่ได้ เพราะคนจะเผลอใส่ความหมาย '
  'แล้วกฎ "ไม่มีความหมาย" จะพังภายในเดือนเดียว';

revoke execute on function mint_sku(text) from public;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table sku_registry enable row level security;

-- อ่านทะเบียน SKU ได้ถ้ามีสิทธิ์ products.read
create policy sku_registry_select on sku_registry
  for select to authenticated
  using (has_capability('products.read'));

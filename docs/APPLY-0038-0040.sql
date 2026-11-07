-- ============================================================================
-- รวม migration 0038 + 0039 + 0040 ไว้ในไฟล์เดียว เพื่อวางครั้งเดียวจบ
-- ============================================================================
-- สร้างจากไฟล์ใน repo ตรงๆ ไม่ได้แก้อะไรเพิ่ม
--   supabase/migrations/0038_fix_truncated_column.sql แก้ชื่อคอลัมน์ที่ถูกตัดทิ้ง
--   supabase/migrations/0039_costing.sql              โมดูลต้นทุนและใบเสนอราคา
--   supabase/migrations/0040_pos_lookup.sql           POS ย้อนดูบิลวันก่อนได้
--
-- ★ ต้องรัน docs/APPLY-0037-pos.sql ก่อนไฟล์นี้
--   ไฟล์นี้ตั้งค่า pgrst.db_schemas ทั้งก้อนใหม่ และใส่ pos ไว้ให้แล้ว
--   ถ้ารันไฟล์นี้ก่อน แล้วค่อยรัน pos ก็ยังได้ · pos จะเขียนทับโดยไม่มี production
--   แล้วต้องรันบรรทัด alter role ท้ายไฟล์นี้อีกครั้ง
--
-- วิธีใช้
--   1. เปิด Supabase → SQL Editor → New query
--   2. วางทั้งไฟล์นี้ → Run
--   3. รันคำสั่งตรวจท้ายไฟล์เพื่อยืนยันว่าขึ้นครบ
--
-- ทดสอบแล้วบน Postgres เปล่า + migration 0001-0037 → ผ่านทั้งก้อนในทรานแซกชันเดียว
-- tests/18_costing.sql ผ่าน 12 ข้อ · tests/19_pos_lookup.sql ผ่าน 5 ข้อ
-- ถ้าพังกลางคัน จะถอยกลับหมด ไม่ทิ้งสถานะค้าง
--
-- ★ 0038 แก้ของที่พังอยู่จริงบนเว็บวันนี้
--   คอลัมน์ "เลยกำหนดส่งและยังค้างเงิน" ยาวเกิน 63 ไบต์ Postgres จึงตัดชื่อทิ้งเงียบๆ
--   โค้ดหน้าเว็บอ่านไม่เจอ → หน้ารายการออเดอร์นับ "เลยกำหนด" ได้ 0 เสมอ
--   ต้อง deploy เว็บใหม่พร้อมกัน เพราะชื่อคอลัมน์เปลี่ยน
--
-- ★ 0040 ทำให้หน้า /pos เลือกวันและก็อปปี้ใบเสร็จย้อนหลังได้
--   ⚠️ ใครมี PIN ร้านจะอ่านบิลทุกใบของงานได้ รวมชื่อและเบอร์ลูกค้า
--      จบงานแล้วเปลี่ยน PIN ที่หลังบ้าน ลิงก์เดิมก็ใช้ไม่ได้ทันที
-- ============================================================================

begin;


-- ========================================================================
-- >>> 0038_fix_truncated_column.sql
-- ========================================================================

-- ============================================================================
-- 0038 · แก้ชื่อคอลัมน์ที่ถูกตัดทิ้งเงียบๆ ใน 0033
-- ============================================================================
-- เจอตอนทดสอบ 0037 กับ Postgres ในเครื่อง · Postgres ตัดชื่อ identifier ที่ยาว
-- เกิน 63 "ไบต์" ทิ้งโดยแจ้งแค่ NOTICE ไม่ใช่ ERROR — ภาษาไทยตัวละ 3 ไบต์
-- จึงเขียนได้แค่ประมาณ 21 ตัวอักษร
--
--   ตั้งใจให้ชื่อ   "เลยกำหนดส่งและยังค้างเงิน"   (75 ไบต์)
--   ฐานข้อมูลเก็บ  "เลยกำหนดส่งและยังค้าง"      (63 ไบต์ · ถูกตัด)
--
-- ★ ผลที่เกิดขึ้นจริงบนหน้าเว็บ: โค้ดอ่าน row.เลยกำหนดส่งและยังค้างเงิน
--   ได้ undefined ทุกครั้ง → หน้ารายการออเดอร์นับ "เลยกำหนด" ได้ 0 เสมอ
--   และหน้ารายละเอียดไม่เคยขึ้นคำเตือน แม้ออเดอร์เลยกำหนดส่งและยังค้างเงินจริง
--   ไม่มี error ให้เห็น ตัวเลขแค่บอกว่าไม่มีปัญหา ซึ่งแย่กว่าพัง
--
-- แก้ด้วยการเปลี่ยนชื่อ ไม่ drop แล้วสร้างใหม่ · view ที่พึ่งพากันอ้างถึงกัน
-- ด้วยหมายเลขคอลัมน์ ไม่ใช่ชื่อ จึงไม่พังตาม
-- ============================================================================

alter view sales.v_orders
  rename column "เลยกำหนดส่งและยังค้าง" to "เลยกำหนดและค้างเงิน";

alter view sales.v_today
  rename column "เลยกำหนดส่งและยังค้าง" to "เลยกำหนดและค้างเงิน";

comment on view sales.v_orders is
  'รายการออเดอร์พร้อมสถานะที่คำนวณสด · ไม่มีช่องสถานะให้ใครพิมพ์ จึงไม่มีทางเพี้ยน (แก้ข้อ O1) · '
  'ชื่อคอลัมน์ภาษาไทยต้องไม่เกิน 63 ไบต์ = ราว 21 ตัวอักษร ไม่งั้น Postgres ตัดทิ้งเงียบๆ';

notify pgrst, 'reload schema';


-- ========================================================================
-- >>> 0039_costing.sql
-- ========================================================================

-- ============================================================================
-- 0039 · โมดูลต้นทุนและใบเสนอราคา
-- ============================================================================
-- เป้าหมายที่ Bay ตั้งไว้ (2026-11-05):
--   "ผมส่ง customer requirement แล้ว คุณออกใบเสนอราคาให้ผมได้เลย
--    โดยมีรายละเอียด costing ของทุกตัว แบบถูกต้องเลย เพื่อ double check ง่ายๆ
--    ว่าน่าจะถูกหรือไม่ แล้วคนก็เอาไปทำงานต่อได้ทันที"
--
-- หลักสี่ข้อที่ตัดสินโครงนี้ (docs/modules/costing/2-design.md):
--
--   C1 แยก "สูตร" ออกจาก "ราคา" เพราะคนละคนเห็น
--      สูตร  → schema production  พนักงานอ่านได้ ไม่เห็นก็สั่งของไม่ได้
--      ราคา  → schema cost 🔒     ต้องมีสิทธิ์ cost.read
--      ต้นทุน = สูตร × ราคา จึงตกอยู่ใน cost เอง ไม่ต้องกั้นเพิ่ม
--
--   C2 1 สูตร ครอบทุกเกรด — ไม่ใช่ 751 สูตร
--      ใบ costing ที่โรงงานใช้เป็น 1 ใบ หลายคอลัมน์เกรด เปลี่ยนแค่ราคาวัสดุหุ้ม
--      ที่นี่สูตรผูกกับ รุ่น + ขนาด · วัสดุหุ้มเป็น "ช่องว่าง" ที่เติมตามเกรดของตัวนั้น
--      → 751 ตัว เหลือสูตรราว 150 ใบ
--
--   C3 ไม่เก็บตัวเลขที่คำนวณได้ (กฎ A10)
--      ปริมาณหลังหักของเสีย · มูลค่าต่อบรรทัด · ต้นทุนรวม · ราคาตามนโยบาย ·
--      กำไร % · พื้นส่วนลด — คำนวณสดทุกครั้ง ไม่มีช่องให้ใครพิมพ์
--
--   C4 บอกตรงๆ ว่าตัวไหนยังเดาอยู่
--      Bay ยืนยันเองว่าค่าแรงวันนี้ประเมินจากความรู้สึก
--      → ทุกราคามีธง is_estimate · ใบเสนอราคาบอกได้ว่ายังเดาอยู่กี่ %
--
-- ★ สองกับดักจากใบเดิมที่แก้ตั้งแต่บรรทัดแรก
--   1. คำว่า "MARK UP 30%" ในใบเดิม ที่จริงคือ กำไรขั้นต้น (÷ 0.70 ไม่ใช่ × 1.30)
--      → ที่นี่ชื่อ gross_margin_pct · ไม่มีคำว่า markup ที่ไหนเลย
--      วันไหนมีคนแก้ให้ตรงกับชื่อเดิม ราคาจะตกทั้งกระดาน 9%
--   2. ค่าแรง + ขนส่ง + บรรจุ ถูกยุบเป็นก้อนเดียวที่เดาเอา
--      → ที่นี่แยกเป็นบรรทัดจริง แต่ละบรรทัดติดธง is_estimate ของตัวเอง
--
-- ★ ต้นทุนมีสองชั้น และนี่คือเรื่องที่ไม่มีใครเห็นมาก่อน
--     ต้นทุนผลิตจริง        = Σ สูตร × ราคาวัสดุ
--     ต้นทุนที่ Chaw Cher จ่าย = ราคาโอนจาก ASE (ถ้ามี)
--   พื้นส่วนลดต้องใช้ "ที่จ่ายจริง" ไม่ใช่ "ผลิตจริง" — ไม่งั้นลดไปถึงจุดที่
--   ตัวเลขบอกว่ายังกำไร แต่เงินจริงขาดทุน
-- ============================================================================

create schema if not exists production;

comment on schema production is
  'สูตรวัสดุ · พนักงานอ่านได้ (จัดซื้อต้องใช้สั่งของ) · ราคาไม่อยู่ที่นี่ อยู่ schema cost';

-- ---------------------------------------------------------------------------
-- ชนิดข้อมูล
-- ---------------------------------------------------------------------------
create type production.component_kind as enum (
  'วัสดุหุ้ม',        -- ผ้า หนัง — เปลี่ยนตามเกรดของตัวสินค้า
  'ไส้',             -- ฟองน้ำ ไมโครเจล ใยสังเคราะห์
  'โครง',            -- ไม้ เหล็ก
  'อะไหล่',          -- ขา ซิป ล้อ สปริง
  'ของสิ้นเปลือง',    -- กาว ลวด ด้าย
  'ค่าแรง',
  'ขนส่ง',
  'บรรจุ'
);

create type production.uom as enum (
  'ตร.ฟุต', 'เมตร', 'หลา', 'นิ้ว', 'กิโลกรัม', 'ขา', 'ชิ้น', 'ชุด', 'ตัว'
);

create type production.item_status as enum ('ร่าง', 'ใช้อยู่', 'เลิกใช้');

-- บทบาทของบรรทัดในสูตร · ว่าง = วัสดุตายตัว
-- 'วัสดุหุ้ม' = ช่องว่าง เติมตามเกรดของตัวสินค้า (หลัก C2)
-- เติม 'ไม้' ได้ภายหลังด้วย alter type เพราะชนิดไม้ก็ต่างกันตามตัวสินค้า
create type production.line_role as enum ('วัสดุหุ้ม');

create type cost.price_source as enum (
  'PO', 'ใบเสนอราคา', 'ใบ costing โรงงาน', 'ประเมิน'
);

-- ---------------------------------------------------------------------------
-- ส่วนประกอบ · ทุกอย่างที่กินต้นทุน รวมค่าแรงและขนส่งด้วย
-- ---------------------------------------------------------------------------
create table production.components (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (btrim(code) <> ''),
  name             text not null check (btrim(name) <> ''),
  kind             production.component_kind not null,
  uom              production.uom not null,

  -- อัตราได้เนื้อ · ของที่ตัดแล้วเหลือเศษใส่ต่ำกว่า 1 เช่น หนัง 0.75
  default_recovery numeric(5,4) check (default_recovery > 0 and default_recovery <= 1),

  material_id      uuid references materials.materials(id),

  -- ★ กุญแจของหลัก C2 · ชิ้นนี้เป็นตัวเติมช่องวัสดุหุ้มของเกรดไหน
  --   ต้องตรงกับ catalog.product_variants.material_grade เป๊ะ
  fills_grade      text,

  status           production.item_status not null default 'ใช้อยู่',
  note             text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references core.app_users(id)
);

-- 1 เกรด = 1 ตัวเติม · กันกรณีมีสองชิ้นแย่งกันเติมเกรดเดียวกันแล้วต้นทุนเพี้ยน
create unique index components_fills_grade_idx
  on production.components (fills_grade) where fills_grade is not null;
create index components_kind_idx on production.components (kind);

comment on table production.components is
  '1 แถว = 1 อย่างที่กินต้นทุน · ค่าแรงและขนส่งก็เป็นแถวในนี้ '
  'เพราะใบ costing เดิมยุบสามอย่างเป็นก้อนเดียวแล้วไม่มีใครรู้ว่าก้อนนั้นมาจากไหน';
comment on column production.components.default_recovery is
  'ได้เนื้อ · 0.75 = ซื้อ 100 ใช้ได้ 75 · ปริมาณที่ต้องซื้อ = net ÷ ได้เนื้อ';
comment on column production.components.fills_grade is
  '★ ชิ้นนี้เติมช่องวัสดุหุ้มของเกรดนี้ เช่น ผ้า A · หนังแท้ · '
  'ต้องสะกดตรงกับ catalog.product_variants.material_grade ไม่งั้นต้นทุนจะว่าง';

-- ---------------------------------------------------------------------------
-- สูตร · 1 สูตร = 1 รุ่น + 1 ขนาด
-- ---------------------------------------------------------------------------
create table production.boms (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references catalog.products(id),

  -- ว่าง = ครอบทุกขนาดของรุ่นนี้ · ใส่ค่า = ใช้กับตัวที่ configuration ตรงกันเท่านั้น
  size_label     text,

  revision       int not null default 1 check (revision > 0),
  effective_from date not null default current_date,
  status         production.item_status not null default 'ร่าง',
  source_doc     text,          -- ใบ costing ที่ถอดมา เช่น "ใบ 2026-10 หมอน"
  note           text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references core.app_users(id)
);

-- unique ปกติใช้ไม่ได้เพราะ null ใน Postgres นับว่าไม่ซ้ำกันเอง
create unique index boms_key_idx
  on production.boms (product_id, coalesce(size_label, ''), revision);
create index boms_product_idx on production.boms (product_id)
  where status = 'ใช้อยู่';

comment on table production.boms is
  'แก้สูตร = ออก revision ใหม่ ไม่ทับของเก่า · ใบเสนอราคาเดือนที่แล้วจึงยังตรวจย้อนได้';
comment on column production.boms.size_label is
  'ว่าง = ครอบทุกขนาดของรุ่น · ถ้ามีทั้งแบบระบุขนาดและแบบว่าง ตัวที่ระบุขนาดชนะ';

create table production.bom_lines (
  id           uuid primary key default gen_random_uuid(),
  bom_id       uuid not null references production.boms(id),
  line_no      int  not null check (line_no > 0),

  -- ว่างได้ ถ้าเป็นช่องวัสดุหุ้ม — เติมตามเกรดของตัวสินค้าตอนคิดต้นทุน
  component_id uuid references production.components(id),
  role         production.line_role,

  net_qty      numeric(12,4) not null check (net_qty > 0),

  -- ว่าง = ใช้ค่าของ component · ใส่ได้ถ้ารุ่นนี้เสียมากกว่าปกติ
  recovery     numeric(5,4) check (recovery > 0 and recovery <= 1),

  pieces       numeric(8,2) not null default 1 check (pieces > 0),
  note         text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references core.app_users(id),

  unique (bom_id, line_no),

  -- บรรทัดต้องชี้วัสดุได้ ไม่งั้นต้องบอกว่าเป็นช่องวัสดุหุ้ม
  constraint line_points_somewhere
    check (component_id is not null or role = 'วัสดุหุ้ม')
);

create index bom_lines_bom_idx       on production.bom_lines (bom_id);
create index bom_lines_component_idx on production.bom_lines (component_id)
  where component_id is not null;

comment on table production.bom_lines is
  'คอลัมน์ตรงกับใบ costing เดิมทุกช่อง (NET · REC · ชิ้น) '
  'คนที่ทำใบ costing อยู่แล้วกรอกได้เลย ไม่ต้องเรียนใหม่ · '
  'ไม่มีช่อง "ปริมาณที่ต้องซื้อ" และ "มูลค่า" เพราะคำนวณได้ (กฎ A10)';
comment on column production.bom_lines.pieces is
  'จำนวนชิ้นที่ใช้ เช่น เบาะบน + ใต้เบาะ = 2 · ใบเดิมเขียนเป็นคอลัมน์คูณท้ายสุด';

-- ---------------------------------------------------------------------------
-- ราคา 🔒 เจ้าของเท่านั้น
-- ---------------------------------------------------------------------------
create table cost.component_prices (
  id             uuid primary key default gen_random_uuid(),
  component_id   uuid not null references production.components(id),

  -- 4 ตำแหน่งเพราะหนังคิดเป็นสตางค์ต่อตารางฟุต และเศษสตางค์สะสมเป็นหลักร้อยตอนคูณ
  price_per_unit numeric(12,4) not null check (price_per_unit >= 0),

  valid_from     date not null default current_date,
  valid_to       date,

  source         cost.price_source not null default 'ประเมิน',
  is_estimate    boolean not null default false,   -- ★ หลัก C4
  note           text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references core.app_users(id),

  constraint price_range_sane check (valid_to is null or valid_to >= valid_from)
);

create index component_prices_lookup_idx
  on cost.component_prices (component_id, valid_from desc);

-- 1 วัสดุ มีราคาที่ยังไม่ปิดได้ใบเดียว · กันสองราคาซ้อนกันแล้วต้นทุนเดาไม่ถูก
create unique index component_prices_open_idx
  on cost.component_prices (component_id) where valid_to is null;

comment on table cost.component_prices is
  '🔒 ราคาเก็บเป็นประวัติ ไม่ทับของเก่า · ย้อนดูได้ว่าใบเสนอราคาเดือนนั้นคิดที่ราคาเท่าไหร่ · '
  'ซัพพลายเออร์ขึ้นราคา แก้บรรทัดเดียว ต้นทุนทุกรุ่นขยับเอง';
comment on column cost.component_prices.is_estimate is
  '★ true = ยังเดาอยู่ · ใบเสนอราคาเอาไปบอกว่าต้นทุนใบนี้มีส่วนที่ยังเดากี่ % (หลัก C4)';

create table cost.pricing_policy (
  id               uuid primary key default gen_random_uuid(),

  -- ทั้งคู่ว่าง = นโยบายกลาง ใช้กับทุกตัวที่ไม่มีนโยบายเฉพาะ (ตอบ CQ2 แบบไม่ต้องรอ)
  product_id       uuid references catalog.products(id),
  variant_id       uuid references catalog.product_variants(id),

  -- ★ กำไรขั้นต้น ไม่ใช่ markup · ราคา = ต้นทุน ÷ (1 − อัตรา/100)
  gross_margin_pct numeric(5,2) not null
                     check (gross_margin_pct >= 0 and gross_margin_pct < 100),

  -- ราคาที่ ASE ขายให้ Chaw Cher · ก่อน VAT · ว่าง = ซื้อที่ต้นทุนผลิต
  transfer_price   numeric(12,2) check (transfer_price >= 0),

  valid_from       date not null default current_date,
  note             text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references core.app_users(id),

  constraint policy_one_target
    check (not (product_id is not null and variant_id is not null))
);

create index pricing_policy_variant_idx on cost.pricing_policy (variant_id)
  where variant_id is not null;
create index pricing_policy_product_idx on cost.pricing_policy (product_id)
  where product_id is not null;

comment on table cost.pricing_policy is
  '🔒 ลำดับความเฉพาะ: ตัวสินค้า ชนะ รุ่น ชนะ นโยบายกลาง · '
  'ชื่อ gross_margin_pct ตั้งใจไม่ใช้คำว่า markup เพราะใบเดิมเขียนผิดและสูตรจริงเป็นกำไรขั้นต้น';
comment on column cost.pricing_policy.transfer_price is
  '🔒 ราคาที่บริษัทแม่ขายให้แบรนด์ · ก่อน VAT · '
  'ส่วนที่เกินจากราคาตามนโยบาย = ส่วนที่เผื่อไว้ ซึ่งเป็นพื้นส่วนลดที่หายไป';

-- ---------------------------------------------------------------------------
-- จับสูตรเข้ากับตัวสินค้า · ตัวที่ระบุขนาดชนะตัวที่ครอบทุกขนาด
-- ---------------------------------------------------------------------------
create view production.v_variant_bom with (security_invoker = true) as
select distinct on (v.id)
  v.id            as variant_id,
  v.sku,
  v.product_id,
  v.configuration,
  v.material_grade,
  b.id            as bom_id,
  b.size_label,
  b.revision,
  b.effective_from,
  b.source_doc
from catalog.product_variants v
join production.boms b
  on b.product_id     = v.product_id
 and b.status         = 'ใช้อยู่'
 and b.effective_from <= current_date
 and (b.size_label is null or b.size_label = v.configuration)
order by v.id,
         (b.size_label is not null) desc,   -- ระบุขนาด ชนะ ครอบทุกขนาด
         b.revision desc,
         b.effective_from desc;

comment on view production.v_variant_bom is
  'ตัวสินค้า 1 ตัว ได้สูตร 1 ใบ · ตัวไหนไม่โผล่ในวิวนี้คือยังไม่มีสูตร';

-- ---------------------------------------------------------------------------
-- สูตรรายบรรทัด · พนักงานอ่านได้ · ไม่มีราคาสักช่อง
-- ---------------------------------------------------------------------------
create view production.v_bom_lines with (security_invoker = true) as
select
  vb.variant_id,
  vb.sku,
  vb.bom_id,
  vb.revision,
  l.line_no,
  coalesce(c.id, uc.id)                                      as component_id,
  coalesce(c.code, uc.code)                                  as รหัสวัสดุ,
  coalesce(c.name, uc.name)                                  as วัสดุ,
  coalesce(c.kind, uc.kind)                                  as ประเภท,
  coalesce(c.uom,  uc.uom)                                   as หน่วย,
  l.role                                                     as บทบาท,
  l.net_qty                                                  as net,
  coalesce(l.recovery, c.default_recovery, uc.default_recovery, 1) as ได้เนื้อ,
  round(l.net_qty
        / coalesce(l.recovery, c.default_recovery, uc.default_recovery, 1), 4)
                                                             as ปริมาณที่ต้องซื้อ,
  l.pieces                                                   as กี่ชิ้น,
  (l.role = 'วัสดุหุ้ม' and l.component_id is null and uc.id is null)
                                                             as ไม่มีวัสดุเกรดนี้,
  l.note
from production.v_variant_bom vb
join production.bom_lines l on l.bom_id = vb.bom_id
left join production.components c on c.id = l.component_id
left join production.components uc
       on l.component_id is null
      and l.role = 'วัสดุหุ้ม'
      and uc.fills_grade = vb.material_grade
      and uc.status <> 'เลิกใช้';

comment on view production.v_bom_lines is
  'ใบสั่งของของจัดซื้อ · ปริมาณที่ต้องซื้อ = net ÷ ได้เนื้อ คำนวณสด · '
  'ช่องวัสดุหุ้มถูกเติมตามเกรดของตัวสินค้าแล้ว (หลัก C2) · ไม่มีราคา จึงให้พนักงานอ่านได้';

-- ---------------------------------------------------------------------------
-- ราคาวัสดุที่ใช้อยู่วันนี้ 🔒
-- ---------------------------------------------------------------------------
create view cost.v_component_price_now with (security_invoker = true) as
select distinct on (component_id)
  component_id, price_per_unit, source, is_estimate, valid_from
from cost.component_prices
where valid_from <= current_date
  and (valid_to is null or valid_to >= current_date)
order by component_id, valid_from desc, created_at desc;

-- ---------------------------------------------------------------------------
-- ต้นทุนรายบรรทัด 🔒 · หน้าตาเหมือนใบ costing เดิม จึงตรวจย้อนได้ถึงวัสดุ
-- ---------------------------------------------------------------------------
create view cost.v_bom_cost with (security_invoker = true) as
select
  bl.variant_id,
  bl.sku,
  bl.line_no,
  bl.รหัสวัสดุ,
  bl.วัสดุ,
  bl.ประเภท,
  bl.หน่วย,
  bl.net,
  bl.ได้เนื้อ,
  bl.ปริมาณที่ต้องซื้อ,
  bl.กี่ชิ้น,
  p.price_per_unit                                                as ราคาต่อหน่วย,
  -- ปัดที่บรรทัด แล้วค่อยบวก · ตรงกับใบ costing เดิมถึงสตางค์
  round(bl.ปริมาณที่ต้องซื้อ * bl.กี่ชิ้น * p.price_per_unit, 2)   as มูลค่า,
  coalesce(p.is_estimate, true)                                   as เป็นค่าประเมิน,
  p.source                                                        as ราคามาจาก,
  bl.ไม่มีวัสดุเกรดนี้,
  (p.price_per_unit is null)                                      as ยังไม่มีราคา,
  bl.note
from production.v_bom_lines bl
left join cost.v_component_price_now p on p.component_id = bl.component_id
-- ★ ด่านนี้สำคัญกว่าที่เห็น · RLS ปิดแค่ "ตารางราคา" ไม่ได้ปิด "วิวนี้"
--   ถ้าไม่มีบรรทัดนี้ คนไม่มีสิทธิ์จะเห็นบรรทัดสูตรพร้อมราคาว่าง
--   แล้ว sum() ข้างบนจะได้ 0 — ไม่ใช่ "ไม่รู้" แต่เป็น "ศูนย์" ซึ่งโกหก
--   เจอตอนทดสอบข้อ 6 ของ supabase/tests/18_costing.sql
where core.has_capability('cost.read');

comment on view cost.v_bom_cost is
  '🔒 ต้นทุนรายบรรทัด · บรรทัดที่ยังไม่มีราคานับเป็น "ค่าประเมิน" โดยปริยาย '
  'เพราะไม่รู้ย่อมแม่นน้อยกว่าเดา — ไม่ปล่อยให้ช่องว่างดูเหมือนศูนย์ · '
  'คนไม่มี cost.read ได้ 0 แถว ไม่ใช่แถวที่ราคาว่าง';

-- ---------------------------------------------------------------------------
-- ต้นทุนรวมต่อตัวสินค้า 🔒 · ★ วิวใจกลางของโมดูลนี้
-- ---------------------------------------------------------------------------
create view cost.v_variant_cost with (security_invoker = true) as
with agg as (
  select
    variant_id,
    sum(coalesce(มูลค่า, 0))                                           as cost_partial,
    sum(case when เป็นค่าประเมิน then coalesce(มูลค่า, 0) else 0 end)  as est_amount,
    count(*)                                                           as line_count,
    count(*) filter (where ยังไม่มีราคา or ไม่มีวัสดุเกรดนี้)           as gap_count
  from cost.v_bom_cost
  group by variant_id
), a as (
  -- ★ สูตรที่ยังมีบรรทัดไม่มีราคา = ยังตอบต้นทุนไม่ได้ · ตอบเป็นค่าว่าง ไม่ใช่ตัวเลขที่ขาด
  --   ไม่งั้นราคาตามนโยบายกับพื้นส่วนลดจะคำนวณจากต้นทุนที่ต่ำกว่าจริง
  select *, case when gap_count = 0 then cost_partial end as cost_total
  from agg
)
select
  v.id                              as variant_id,
  v.sku,
  catalog.sku_display(v.sku)        as sku_display,
  pr.collection                     as รุ่น,
  v.configuration                   as ขนาด,
  v.material_grade                  as เกรด,

  a.line_count                      as จำนวนบรรทัดในสูตร,
  a.gap_count                       as บรรทัดที่ยังไม่ครบ,

  a.cost_total                      as ต้นทุนผลิต,
  a.cost_partial                    as ต้นทุนที่คิดได้แล้ว,

  pol.gross_margin_pct              as กำไรที่ตั้งไว้_pct,
  case when a.cost_total > 0
       then round(a.cost_total / (1 - pol.gross_margin_pct / 100), 2)
  end                               as ราคาตามนโยบาย,

  pol.transfer_price                as ราคาโอนจาก_ase,

  -- ★ ส่วนที่เผื่อไว้ · ราคาโอน − ราคาตามนโยบาย · นี่คือพื้นส่วนลดที่หายไป
  case when pol.transfer_price is not null and a.cost_total > 0
       then round(pol.transfer_price
                  - a.cost_total / (1 - pol.gross_margin_pct / 100), 2)
  end                               as ส่วนที่เผื่อไว้,

  -- ★ ต้นทุนสองชั้น · พื้นส่วนลดต้องใช้ชั้นที่จ่ายเงินจริง
  coalesce(pol.transfer_price, a.cost_total) as ต้นทุนที่เราจ่ายจริง,
  round(coalesce(pol.transfer_price, a.cost_total)
        * (1 + pricing.vat_rate()), 2)       as พื้นส่วนลดรวม_vat,

  case when a.cost_partial > 0
       then round(100 * a.est_amount / a.cost_partial, 1)
  end                               as ยังเป็นค่าประเมิน_pct
from catalog.product_variants v
join a          on a.variant_id = v.id
join catalog.products pr on pr.id = v.product_id
left join lateral (
  select pp.gross_margin_pct, pp.transfer_price
  from cost.pricing_policy pp
  where pp.valid_from <= current_date
    and (pp.variant_id = v.id
      or pp.product_id = v.product_id
      or (pp.variant_id is null and pp.product_id is null))
  order by (pp.variant_id is not null) desc,
           (pp.product_id is not null) desc,
           pp.valid_from desc
  limit 1
) pol on true
where core.has_capability('cost.read');

comment on view cost.v_variant_cost is
  '🔒 ★ ต้นทุนมีสองชั้น · "ต้นทุนผลิต" คือของจริง · "ต้นทุนที่เราจ่ายจริง" คือราคาโอนจาก ASE · '
  'พื้นส่วนลดใช้ชั้นที่จ่ายเงินจริง ไม่ใช่ชั้นผลิต ไม่งั้นลดจนขาดทุนโดยตัวเลขยังบอกว่ากำไร';

-- ---------------------------------------------------------------------------
-- เทียบราคาขายจริงทั้งแคตตาล็อกกับต้นทุนจริง 🔒
-- ★ ถอด VAT ออกก่อนคิดกำไรเสมอ — กฎที่ Bay ย้ำตั้งแต่ 0005
-- ---------------------------------------------------------------------------
create view cost.v_margin_check with (security_invoker = true) as
select
  c.variant_id,
  c.sku,
  c.sku_display,
  c.รุ่น,
  c.ขนาด,
  c.เกรด,
  p.ราคาขายรวม_vat,
  round(p.ราคาขายรวม_vat / (1 + pricing.vat_rate()), 2)  as ราคาขายก่อน_vat,
  c.ต้นทุนผลิต,
  c.ต้นทุนที่เราจ่ายจริง,

  round(p.ราคาขายรวม_vat / (1 + pricing.vat_rate()) - c.ต้นทุนที่เราจ่ายจริง, 2)
                                                         as กำไรจริง,
  case when p.ราคาขายรวม_vat > 0 then
    round(100 * (p.ราคาขายรวม_vat / (1 + pricing.vat_rate()) - c.ต้นทุนที่เราจ่ายจริง)
          / (p.ราคาขายรวม_vat / (1 + pricing.vat_rate())), 2)
  end                                                    as กำไรจริง_pct,

  -- กำไรที่ "ควรจะได้" ถ้าซื้อที่ต้นทุนผลิต · ส่วนต่างคือสิ่งที่จ่ายให้ชั้นกลาง
  round(c.ต้นทุนที่เราจ่ายจริง - c.ต้นทุนผลิต, 2)         as จ่ายเกินต้นทุนผลิต,

  c.กำไรที่ตั้งไว้_pct,
  c.พื้นส่วนลดรวม_vat,
  c.ยังเป็นค่าประเมิน_pct,
  c.บรรทัดที่ยังไม่ครบ
from cost.v_variant_cost c
join pricing.v_variant_price p on p.variant_id = c.variant_id;

comment on view cost.v_margin_check is
  '🔒 รุ่นไหนกำไรต่ำกว่าที่ตั้งไว้ และจ่ายเกินต้นทุนผลิตไปเท่าไหร่ · '
  'ถอด VAT ออกก่อนลบต้นทุนทุกครั้ง เพราะราคาในไฟล์ราคาเป็นราคารวม VAT แล้ว';

-- ============================================================================
-- เลขที่เอกสาร · ใช้ได้ทุกโมดูล
-- ============================================================================
-- ★ ไม่ใช้ sequence เพราะ sequence เผาเลขทิ้งเมื่อ transaction ล้ม
--   เอกสารการเงินต้องเรียงไม่ขาด สรรพากรถามว่าเลขนี้หายไปไหนต้องตอบได้
create table core.doc_counters (
  series     text primary key,          -- 'quote-2611' · แยกต่อเดือนเพื่อให้เลขรีเซ็ต
  prefix     text not null,             -- 'QT-2611-'
  last_no    int  not null default 0 check (last_no >= 0),
  updated_at timestamptz not null default now()
);

comment on table core.doc_counters is
  'นับเลขเอกสารแบบไม่ขาดช่วง · ล็อกแถวไว้ ใครมาพร้อมกันก็ต่อคิว · '
  'ถ้า transaction ล้ม เลขถูกคืน ไม่เผาทิ้งเหมือน sequence';

create or replace function core.next_doc_no(
  p_series text,
  p_prefix text,
  p_width  int default 4
) returns text
language plpgsql security definer
set search_path = core, public
as $$
declare v_no int;
begin
  if not core.is_staff() then
    raise exception 'ต้องเป็นพนักงานที่ยังใช้งานอยู่ จึงจะออกเลขเอกสารได้'
      using errcode = 'insufficient_privilege';
  end if;

  insert into core.doc_counters (series, prefix, last_no)
  values (p_series, p_prefix, 1)
  on conflict (series) do update
    set last_no    = core.doc_counters.last_no + 1,
        prefix     = excluded.prefix,
        updated_at = now()
  returning last_no into v_no;

  return p_prefix || lpad(v_no::text, p_width, '0');
end;
$$;

-- ============================================================================
-- ใบเสนอราคา
-- ============================================================================
create type sales.quote_status as enum
  ('ร่าง', 'ส่งแล้ว', 'ลูกค้ารับ', 'หมดอายุ', 'ยกเลิก');

-- ★ ช่องที่ใบเสนอราคาเดิมไม่มี และเป็นต้นเหตุของเรื่องนราธิวาส 17,000 บาท
--   PO ไม่ได้ระบุค่าส่ง · sales จำไม่ได้ว่าคุยอะไรไว้ · ลูกค้ารู้หลังจ่ายเงินแล้ว
--   ที่นี่ส่งใบเสนอราคาไม่ได้เลยถ้ายังเป็น 'ยังไม่ได้คุย'
create type sales.shipping_terms as enum (
  'ยังไม่ได้คุย',
  'ส่งฟรี',
  'คิดค่าส่งตามที่ระบุ',
  'ลูกค้าจ่ายตามจริง',
  'ลูกค้ามารับเอง'
);

create table sales.quotes (
  id                    uuid primary key default gen_random_uuid(),
  quote_no              text not null unique check (btrim(quote_no) <> ''),

  customer_id           uuid not null references crm.customers(id),
  shipping_address_id   uuid references crm.customer_addresses(id),

  quoted_on             date not null default current_date,
  valid_until           date not null,

  status                sales.quote_status not null default 'ร่าง',

  -- ★ ล็อกค่าส่ง
  shipping_terms        sales.shipping_terms not null default 'ยังไม่ได้คุย',
  shipping_fee_incl_vat numeric(12,2) not null default 0
                          check (shipping_fee_incl_vat >= 0),
  shipping_note         text,          -- ปลายทาง · ใครยกของ · ตกลงกับใครไว้

  order_id              uuid references sales.orders(id),

  cancel_reason         text,
  note                  text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references core.app_users(id),

  constraint quote_valid_after_quoted check (valid_until >= quoted_on),
  constraint quote_cancel_needs_reason
    check (status <> 'ยกเลิก' or btrim(coalesce(cancel_reason, '')) <> ''),
  -- คิดค่าส่งแล้วต้องมีตัวเลข · ไม่งั้นก็คือยังไม่ได้คุยอยู่ดี
  constraint quote_fee_needs_amount
    check (shipping_terms <> 'คิดค่าส่งตามที่ระบุ' or shipping_fee_incl_vat > 0)
);

create index quotes_customer_idx on sales.quotes (customer_id);
create index quotes_status_idx   on sales.quotes (status) where status <> 'ยกเลิก';
create index quotes_order_idx    on sales.quotes (order_id) where order_id is not null;

comment on table sales.quotes is
  'ไม่มีช่องยอดรวม ยอดก่อน VAT หรือ VAT เพราะคำนวณได้ (กฎ A10) · '
  '★ มีช่องเงื่อนไขค่าส่งที่ว่างไว้ไม่ได้ — ต้นเหตุเรื่องนราธิวาสคือใบที่ไม่มีช่องนี้';
comment on column sales.quotes.shipping_terms is
  '★ ส่งใบเสนอราคาไม่ได้ถ้ายังเป็น "ยังไม่ได้คุย" · '
  'บังคับที่ฐานข้อมูล ไม่ใช่ที่หน้าจอ จึงลืมไม่ได้แม้กรอกผ่านทางอื่น';
comment on column sales.quotes.order_id is
  'ลูกค้ารับแล้วกลายเป็นออเดอร์ · รายการถูกคัดลอกไป ไม่ต้องพิมพ์ใหม่ (เป้าหมายข้อ 4)';

create table sales.quote_lines (
  id                  uuid primary key default gen_random_uuid(),
  quote_id            uuid not null references sales.quotes(id),
  line_no             int  not null check (line_no > 0),

  variant_id          uuid references catalog.product_variants(id),
  description         text not null check (btrim(description) <> ''),

  qty                 numeric(10,2) not null check (qty > 0),
  unit_price_incl_vat numeric(12,2) not null check (unit_price_incl_vat >= 0),
  note                text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references core.app_users(id),

  unique (quote_id, line_no)
);

create index quote_lines_quote_idx   on sales.quote_lines (quote_id);
create index quote_lines_variant_idx on sales.quote_lines (variant_id)
  where variant_id is not null;

comment on table sales.quote_lines is
  'เก็บ description ไว้เสมอแม้ชี้ SKU ได้แล้ว เพราะเป็นข้อความที่ลูกค้าเห็นและตกลงด้วย';

-- ---------------------------------------------------------------------------
-- ยอดของใบเสนอราคา · ฉบับที่ลูกค้าเห็นได้ ไม่มีต้นทุนสักช่อง
-- ---------------------------------------------------------------------------
create view sales.v_quote_totals with (security_invoker = true) as
select
  q.id                                                        as quote_id,
  coalesce(sum(round(l.qty * l.unit_price_incl_vat, 2)), 0)   as ยอดสินค้ารวม_vat,
  q.shipping_fee_incl_vat                                     as ค่าขนส่งรวม_vat,
  coalesce(sum(round(l.qty * l.unit_price_incl_vat, 2)), 0)
    + q.shipping_fee_incl_vat                                 as ยอดรวมทั้งใบ_vat,
  round((coalesce(sum(round(l.qty * l.unit_price_incl_vat, 2)), 0)
         + q.shipping_fee_incl_vat) / (1 + pricing.vat_rate()), 2)
                                                              as ยอดก่อน_vat,
  round((coalesce(sum(round(l.qty * l.unit_price_incl_vat, 2)), 0)
         + q.shipping_fee_incl_vat)
        - (coalesce(sum(round(l.qty * l.unit_price_incl_vat, 2)), 0)
           + q.shipping_fee_incl_vat) / (1 + pricing.vat_rate()), 2)
                                                              as vat,
  count(l.id)                                                 as จำนวนรายการ
from sales.quotes q
left join sales.quote_lines l on l.quote_id = q.id
group by q.id, q.shipping_fee_incl_vat;

create view sales.v_quotes with (security_invoker = true) as
select
  q.id,
  q.quote_no                       as เลขที่,
  c.name                           as ลูกค้า,
  q.quoted_on                      as วันที่,
  q.valid_until                    as ยืนราคาถึง,
  (q.valid_until < current_date
   and q.status in ('ร่าง', 'ส่งแล้ว'))  as เลยวันยืนราคา,
  q.status                         as สถานะ,
  q.shipping_terms                 as เงื่อนไขค่าส่ง,
  t.จำนวนรายการ,
  t.ยอดสินค้ารวม_vat,
  t.ค่าขนส่งรวม_vat,
  t.ยอดรวมทั้งใบ_vat,
  t.ยอดก่อน_vat,
  t.vat,
  q.order_id                       as กลายเป็นออเดอร์,
  q.note
from sales.quotes q
join crm.customers c         on c.id = q.customer_id
join sales.v_quote_totals t  on t.quote_id = q.id;

comment on view sales.v_quotes is
  'รายการใบเสนอราคาพร้อมยอดที่คำนวณสด · ฝ่ายขายเห็นได้ทั้งหมด ไม่มีต้นทุนโผล่มา';

-- ---------------------------------------------------------------------------
-- ใบเสนอราคาพร้อมต้นทุนทุกบรรทัด 🔒
-- ---------------------------------------------------------------------------
create view cost.v_quote_costing with (security_invoker = true) as
select
  l.quote_id,
  q.quote_no,
  l.line_no,
  l.description                                              as รายการ,
  l.variant_id,
  l.qty                                                      as จำนวน,
  l.unit_price_incl_vat                                      as ราคาต่อหน่วยรวม_vat,
  round(l.qty * l.unit_price_incl_vat, 2)                    as ยอดบรรทัดรวม_vat,

  c.ต้นทุนผลิต                                                as ต้นทุนผลิตต่อหน่วย,
  c.ต้นทุนที่เราจ่ายจริง                                        as ต้นทุนจ่ายต่อหน่วย,
  round(l.qty * c.ต้นทุนที่เราจ่ายจริง, 2)                      as ต้นทุนรวมบรรทัด,

  -- ★ ถอด VAT ก่อนลบต้นทุนทุกครั้ง
  round(l.qty * l.unit_price_incl_vat / (1 + pricing.vat_rate())
        - l.qty * c.ต้นทุนที่เราจ่ายจริง, 2)                   as กำไรบรรทัด,
  case when l.unit_price_incl_vat > 0 and c.ต้นทุนที่เราจ่ายจริง is not null then
    round(100 * (l.unit_price_incl_vat / (1 + pricing.vat_rate())
                 - c.ต้นทุนที่เราจ่ายจริง)
          / (l.unit_price_incl_vat / (1 + pricing.vat_rate())), 2)
  end                                                        as กำไรบรรทัด_pct,

  c.พื้นส่วนลดรวม_vat                                          as ลดได้ถึงราคานี้,
  case when l.unit_price_incl_vat > 0 and c.พื้นส่วนลดรวม_vat is not null then
    round(100 * (l.unit_price_incl_vat - c.พื้นส่วนลดรวม_vat)
          / l.unit_price_incl_vat, 2)
  end                                                        as ลดได้สูงสุด_pct,

  c.ส่วนที่เผื่อไว้,
  c.ยังเป็นค่าประเมิน_pct,
  c.บรรทัดที่ยังไม่ครบ,
  (c.variant_id is null)                                     as ยังไม่มีสูตรวัสดุ
from sales.quote_lines l
join sales.quotes q           on q.id = l.quote_id
left join cost.v_variant_cost c on c.variant_id = l.variant_id
-- ★ ไม่มีด่านนี้ คนไม่มีสิทธิ์จะเห็นทุกบรรทัดติดธง "ยังไม่มีสูตรวัสดุ"
--   ซึ่งเป็นคำตอบที่ผิด เหตุผลจริงคือ "คุณไม่มีสิทธิ์ดู" ไม่ใช่ "ยังไม่มีสูตร"
where core.has_capability('cost.read');

comment on view cost.v_quote_costing is
  '🔒 ใบเสนอราคา 1 ใบ พร้อมต้นทุนทุกบรรทัด · ตรวจย้อนลงไปถึงวัสดุได้ที่ cost.v_bom_cost · '
  'ยังไม่มีสูตรวัสดุ = ไม่เดาให้ · บอกตรงๆ ว่าไม่รู้';

-- ============================================================================
-- ฟังก์ชัน · สูตร
-- ============================================================================
-- ★ เติมบรรทัดด้วยรหัสวัสดุ ไม่ใช่ uuid · คนกรอกจากใบ costing อ่านรหัสออก ไม่อ่าน uuid ออก
create or replace function production.add_bom_line(
  p_bom_id         uuid,
  p_component_code text,
  p_net_qty        numeric,
  p_recovery       numeric default null,
  p_pieces         numeric default 1,
  p_note           text    default null
) returns uuid
language plpgsql security definer
set search_path = core, production, catalog, materials, public
as $$
declare v_id uuid; v_comp uuid; v_role production.line_role; v_no int; v_status production.item_status;
begin
  if not (core.has_capability('products.write') or core.has_capability('purchase.write')) then
    raise exception 'ต้องมีสิทธิ์ products.write หรือ purchase.write จึงจะแก้สูตรได้'
      using errcode = 'insufficient_privilege';
  end if;

  select status into v_status from production.boms where id = p_bom_id;
  if not found then raise exception 'ไม่พบสูตรที่อ้างถึง'; end if;
  if v_status <> 'ร่าง' then
    raise exception 'สูตรนี้ใช้งานแล้ว แก้ตรงๆ ไม่ได้ · ต้องออก revision ใหม่';
  end if;

  -- รหัสว่าง = ช่องวัสดุหุ้ม เติมตามเกรดของตัวสินค้า (หลัก C2)
  if btrim(coalesce(p_component_code, '')) = '' then
    v_comp := null;
    v_role := 'วัสดุหุ้ม';
  else
    select id into v_comp from production.components
     where code = btrim(p_component_code);
    if v_comp is null then
      raise exception 'ไม่รู้จักรหัสวัสดุ % · เพิ่มใน production.components ก่อน', p_component_code;
    end if;
  end if;

  select coalesce(max(line_no), 0) + 1 into v_no
    from production.bom_lines where bom_id = p_bom_id;

  insert into production.bom_lines
    (bom_id, line_no, component_id, role, net_qty, recovery, pieces, note)
  values
    (p_bom_id, v_no, v_comp, v_role, p_net_qty, p_recovery, coalesce(p_pieces, 1), p_note)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function production.activate_bom(p_bom_id uuid)
returns void
language plpgsql security definer
set search_path = core, production, catalog, public
as $$
declare n int;
begin
  if not (core.has_capability('products.write') or core.has_capability('purchase.write')) then
    raise exception 'ต้องมีสิทธิ์ products.write หรือ purchase.write จึงจะเปิดใช้สูตรได้'
      using errcode = 'insufficient_privilege';
  end if;

  select count(*) into n from production.bom_lines where bom_id = p_bom_id;
  if n = 0 then raise exception 'สูตรยังไม่มีบรรทัดวัสดุ เปิดใช้ไม่ได้'; end if;

  update production.boms set status = 'ใช้อยู่'
   where id = p_bom_id and status = 'ร่าง';
  if not found then raise exception 'เปิดใช้ได้เฉพาะสูตรที่ยังเป็นร่าง'; end if;
end;
$$;

-- แก้สูตรที่ใช้งานแล้ว = คัดลอกเป็น revision ใหม่ ของเก่ายังอยู่ให้ตรวจย้อน
create or replace function production.new_revision(p_bom_id uuid, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = core, production, catalog, public
as $$
declare v_new uuid; v_rev int; v_prod uuid; v_size text;
begin
  if not (core.has_capability('products.write') or core.has_capability('purchase.write')) then
    raise exception 'ต้องมีสิทธิ์ products.write หรือ purchase.write จึงจะออก revision ใหม่ได้'
      using errcode = 'insufficient_privilege';
  end if;

  select product_id, size_label into v_prod, v_size
    from production.boms where id = p_bom_id;
  if not found then raise exception 'ไม่พบสูตรที่อ้างถึง'; end if;

  select coalesce(max(revision), 0) + 1 into v_rev
    from production.boms
   where product_id = v_prod and coalesce(size_label, '') = coalesce(v_size, '');

  insert into production.boms (product_id, size_label, revision, status, note)
  values (v_prod, v_size, v_rev, 'ร่าง', p_note)
  returning id into v_new;

  insert into production.bom_lines
    (bom_id, line_no, component_id, role, net_qty, recovery, pieces, note)
  select v_new, line_no, component_id, role, net_qty, recovery, pieces, note
    from production.bom_lines where bom_id = p_bom_id
   order by line_no;

  return v_new;
end;
$$;

-- ============================================================================
-- ฟังก์ชัน · ราคา 🔒
-- ============================================================================
-- ปิดใบราคาเดิมแล้วเปิดใบใหม่ · ไม่ทับของเก่า ย้อนดูได้
create or replace function cost.set_component_price(
  p_component_code text,
  p_price          numeric,
  p_source         cost.price_source default 'ประเมิน',
  p_is_estimate    boolean default false,
  p_valid_from     date    default null,
  p_note           text    default null
) returns uuid
language plpgsql security definer
set search_path = core, cost, production, public
as $$
declare v_id uuid; v_comp uuid; v_from date;
begin
  if not core.has_capability('cost.read') then
    raise exception 'ต้องมีสิทธิ์ cost.read จึงจะแก้ราคาวัสดุได้'
      using errcode = 'insufficient_privilege';
  end if;

  select id into v_comp from production.components where code = btrim(p_component_code);
  if v_comp is null then
    raise exception 'ไม่รู้จักรหัสวัสดุ %', p_component_code;
  end if;

  v_from := coalesce(p_valid_from, current_date);

  -- ใบที่เริ่มวันเดียวกันหรือหลังจากนี้ = ช่วงเวลาเดียวกัน · แก้ใบนั้นแทนการเปิดใบใหม่
  -- ไม่ลบแถวไหนเลย (กฎ A7) · ของเดิมอยู่ใน core.audit_log ครบ
  update cost.component_prices
     set price_per_unit = p_price,
         source         = p_source,
         is_estimate    = p_is_estimate,
         note           = coalesce(p_note, note),
         valid_from     = v_from
   where component_id = v_comp and valid_to is null and valid_from >= v_from
  returning id into v_id;

  if v_id is not null then
    return v_id;
  end if;

  -- ปิดใบเดิมที่วันก่อนหน้า · ใบเสนอราคาเดือนที่แล้วจึงยังคิดที่ราคาเดิมได้
  update cost.component_prices
     set valid_to = v_from - 1
   where component_id = v_comp and valid_to is null and valid_from < v_from;

  insert into cost.component_prices
    (component_id, price_per_unit, valid_from, source, is_estimate, note)
  values
    (v_comp, p_price, v_from, p_source, p_is_estimate, p_note)
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================================
-- ฟังก์ชัน · ใบเสนอราคา
-- ============================================================================
create or replace function sales.create_quote(
  p_customer_id         uuid,
  p_valid_days          int  default 30,
  p_shipping_address_id uuid default null,
  p_note                text default null
) returns uuid
language plpgsql security definer
set search_path = core, crm, sales, catalog, pricing, public
as $$
declare v_id uuid; v_no text; v_period text;
begin
  if not core.has_capability('sales.write') then
    raise exception 'ต้องมีสิทธิ์ sales.write จึงจะออกใบเสนอราคาได้'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from crm.customers where id = p_customer_id) then
    raise exception 'ไม่พบลูกค้าที่อ้างถึง';
  end if;

  v_period := to_char(current_date, 'YYMM');
  v_no := core.next_doc_no('quote-' || v_period, 'QT-' || v_period || '-');

  insert into sales.quotes
    (quote_no, customer_id, shipping_address_id, valid_until, note)
  values
    (v_no, p_customer_id, p_shipping_address_id,
     current_date + coalesce(p_valid_days, 30), p_note)
  returning id into v_id;

  return v_id;
end;
$$;

-- ★ ส่ง variant มาตัวเดียวก็พอ · ราคาและคำบรรยายดึงจากแคตตาล็อกเอง
--   นี่คือสิ่งที่ทำให้ "ส่ง requirement มา แล้วออกใบเสนอราคาได้เลย" เป็นจริง
create or replace function sales.add_quote_line(
  p_quote_id    uuid,
  p_variant_id  uuid    default null,
  p_qty         numeric default 1,
  p_unit_price  numeric default null,
  p_description text    default null,
  p_note        text    default null
) returns uuid
language plpgsql security definer
set search_path = core, crm, sales, catalog, pricing, public
as $$
declare
  v_id uuid; v_no int; v_status sales.quote_status;
  v_desc text; v_price numeric;
begin
  if not core.has_capability('sales.write') then
    raise exception 'ต้องมีสิทธิ์ sales.write จึงจะเพิ่มรายการได้'
      using errcode = 'insufficient_privilege';
  end if;

  select status into v_status from sales.quotes where id = p_quote_id;
  if not found then raise exception 'ไม่พบใบเสนอราคาที่อ้างถึง'; end if;
  if v_status not in ('ร่าง', 'ส่งแล้ว') then
    raise exception 'ใบเสนอราคาสถานะ % แก้รายการไม่ได้', v_status;
  end if;

  v_desc  := nullif(btrim(coalesce(p_description, '')), '');
  v_price := p_unit_price;

  if p_variant_id is not null then
    -- ดึงคำบรรยายและราคาจากแคตตาล็อกถ้าไม่ได้ส่งมา
    select
      coalesce(v_desc, concat_ws(' · ',
        p.collection, nullif(pv.configuration, ''), nullif(pv.material_grade, ''))),
      coalesce(v_price, pr.ราคาขายรวม_vat)
    into v_desc, v_price
    from catalog.product_variants pv
    join catalog.products p on p.id = pv.product_id
    left join pricing.v_variant_price pr on pr.variant_id = pv.id
    where pv.id = p_variant_id;

    if v_desc is null then raise exception 'ไม่พบตัวสินค้าที่อ้างถึง'; end if;
  end if;

  if v_desc is null then
    raise exception 'ต้องระบุรายการ หรือชี้ไปที่ตัวสินค้าในแคตตาล็อก';
  end if;
  if v_price is null then
    raise exception 'ตัวสินค้านี้ยังไม่มีราคาในแคตตาล็อก · ต้องใส่ราคามาเอง';
  end if;

  select coalesce(max(line_no), 0) + 1 into v_no
    from sales.quote_lines where quote_id = p_quote_id;

  insert into sales.quote_lines
    (quote_id, line_no, variant_id, description, qty, unit_price_incl_vat, note)
  values
    (p_quote_id, v_no, p_variant_id, v_desc, p_qty, v_price, p_note)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function sales.set_quote_shipping(
  p_quote_id uuid,
  p_terms    sales.shipping_terms,
  p_fee      numeric default 0,
  p_note     text    default null
) returns void
language plpgsql security definer
set search_path = core, sales, public
as $$
begin
  if not (core.has_capability('sales.write') or core.has_capability('delivery.write')) then
    raise exception 'ต้องมีสิทธิ์ sales.write หรือ delivery.write จึงจะตั้งเงื่อนไขค่าส่งได้'
      using errcode = 'insufficient_privilege';
  end if;

  if p_terms = 'คิดค่าส่งตามที่ระบุ' and coalesce(p_fee, 0) <= 0 then
    raise exception 'คิดค่าส่งต้องใส่จำนวนเงิน · ถ้ายังไม่รู้ ให้คงสถานะว่ายังไม่ได้คุย';
  end if;

  update sales.quotes
     set shipping_terms        = p_terms,
         shipping_fee_incl_vat = case when p_terms = 'คิดค่าส่งตามที่ระบุ'
                                      then p_fee else 0 end,
         shipping_note         = coalesce(p_note, shipping_note)
   where id = p_quote_id and status in ('ร่าง', 'ส่งแล้ว');
  if not found then
    raise exception 'ไม่พบใบเสนอราคา หรือใบนี้ปิดไปแล้ว';
  end if;
end;
$$;

-- ★ ประตูที่ปิดเรื่องนราธิวาส · ส่งไม่ได้ถ้ายังไม่ได้ตอบเรื่องค่าส่ง
create or replace function sales.send_quote(p_quote_id uuid)
returns void
language plpgsql security definer
set search_path = core, sales, public
as $$
declare v_terms sales.shipping_terms; n int;
begin
  if not core.has_capability('sales.write') then
    raise exception 'ต้องมีสิทธิ์ sales.write จึงจะส่งใบเสนอราคาได้'
      using errcode = 'insufficient_privilege';
  end if;

  select shipping_terms into v_terms from sales.quotes
   where id = p_quote_id and status = 'ร่าง';
  if not found then raise exception 'ส่งได้เฉพาะใบที่ยังเป็นร่าง'; end if;

  select count(*) into n from sales.quote_lines where quote_id = p_quote_id;
  if n = 0 then raise exception 'ใบเสนอราคายังไม่มีรายการ ส่งไม่ได้'; end if;

  if v_terms = 'ยังไม่ได้คุย' then
    raise exception
      'ยังไม่ได้ระบุเงื่อนไขค่าส่ง · ส่งใบเสนอราคาไม่ได้ '
      '(เรื่องนราธิวาส 17,000 บาท เริ่มจากช่องนี้ว่าง)';
  end if;

  update sales.quotes set status = 'ส่งแล้ว' where id = p_quote_id;
end;
$$;

-- ★ เป้าหมายข้อ 4 · กดปุ่มเดียวกลายเป็นออเดอร์ ไม่ต้องพิมพ์ใหม่
create or replace function sales.accept_quote(p_quote_id uuid, p_order_no text)
returns uuid
language plpgsql security definer
set search_path = core, crm, sales, catalog, public
as $$
declare v_order uuid; v_no text; q record;
begin
  if not core.has_capability('sales.write') then
    raise exception 'ต้องมีสิทธิ์ sales.write จึงจะรับใบเสนอราคาได้'
      using errcode = 'insufficient_privilege';
  end if;

  select * into q from sales.quotes where id = p_quote_id;
  if not found then raise exception 'ไม่พบใบเสนอราคาที่อ้างถึง'; end if;
  if q.order_id is not null then
    raise exception 'ใบนี้กลายเป็นออเดอร์ไปแล้ว';
  end if;
  if q.status not in ('ร่าง', 'ส่งแล้ว') then
    raise exception 'ใบเสนอราคาสถานะ % รับไม่ได้', q.status;
  end if;
  if q.shipping_terms = 'ยังไม่ได้คุย' then
    raise exception 'ยังไม่ได้ระบุเงื่อนไขค่าส่ง · รับเป็นออเดอร์ไม่ได้';
  end if;

  v_no := upper(btrim(coalesce(p_order_no, '')));
  if v_no = '' then raise exception 'ต้องระบุเลขที่ออเดอร์'; end if;
  if exists (select 1 from sales.orders where order_no = v_no) then
    raise exception 'เลขที่ออเดอร์ % มีอยู่แล้ว', v_no;
  end if;

  insert into sales.orders
    (order_no, customer_id, shipping_address_id, shipping_fee_incl_vat, note)
  values
    (v_no, q.customer_id, q.shipping_address_id, q.shipping_fee_incl_vat,
     concat_ws(' · ', 'จากใบเสนอราคา ' || q.quote_no, q.note))
  returning id into v_order;

  insert into sales.order_lines
    (order_id, line_no, variant_id, description, qty, unit_price_incl_vat, note)
  select v_order, line_no, variant_id, description, qty, unit_price_incl_vat, note
    from sales.quote_lines where quote_id = p_quote_id
   order by line_no;

  update sales.quotes
     set status = 'ลูกค้ารับ', order_id = v_order
   where id = p_quote_id;

  return v_order;
end;
$$;

create or replace function sales.cancel_quote(p_quote_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = core, sales, public
as $$
begin
  if not core.has_capability('sales.write') then
    raise exception 'ต้องมีสิทธิ์ sales.write จึงจะยกเลิกใบเสนอราคาได้'
      using errcode = 'insufficient_privilege';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'ยกเลิกต้องบอกเหตุผล · ลูกค้าไม่ตอบ กับ ราคาสูงเกินไป คนละเรื่องกัน';
  end if;

  update sales.quotes
     set status = 'ยกเลิก', cancel_reason = btrim(p_reason)
   where id = p_quote_id and status in ('ร่าง', 'ส่งแล้ว');
  if not found then raise exception 'ยกเลิกได้เฉพาะใบที่ยังเปิดอยู่'; end if;
end;
$$;

-- ============================================================================
-- กฎมาตรฐาน · ห้ามลบ + แตะ updated_at + บันทึกประวัติ
-- ============================================================================
select core.apply_standard_rules('production.components');
select core.apply_standard_rules('production.boms');
select core.apply_standard_rules('cost.component_prices');
select core.apply_standard_rules('cost.pricing_policy');
select core.apply_standard_rules('sales.quotes');
select core.apply_standard_rules('sales.quote_lines');

create trigger audit_components     after insert or update on production.components
  for each row execute function core.write_audit();
create trigger audit_boms           after insert or update on production.boms
  for each row execute function core.write_audit();
create trigger audit_bom_lines      after insert or update on production.bom_lines
  for each row execute function core.write_audit();
create trigger audit_component_prices after insert or update on cost.component_prices
  for each row execute function core.write_audit();
create trigger audit_pricing_policy after insert or update on cost.pricing_policy
  for each row execute function core.write_audit();
create trigger audit_quotes         after insert or update on sales.quotes
  for each row execute function core.write_audit();
create trigger audit_quote_lines    after insert or update on sales.quote_lines
  for each row execute function core.write_audit();

-- bom_lines ไม่ใช้กฎห้ามลบตายตัว · สูตรที่ยังเป็นร่างต้องลบบรรทัดที่พิมพ์ผิดได้
-- ไม่งั้นคนกรอกจะเลี่ยงไปสร้างสูตรใหม่ทิ้งของเก่าเป็นขยะ ซึ่งแย่กว่า
create or replace function production.guard_bom_line_delete()
returns trigger language plpgsql
set search_path = production, public
as $$
begin
  if exists (select 1 from production.boms
              where id = old.bom_id and status = 'ร่าง') then
    return old;
  end if;
  raise exception
    'ลบบรรทัดได้เฉพาะสูตรที่ยังเป็นร่าง · สูตรที่ใช้งานแล้วต้องออก revision ใหม่';
end;
$$;

create trigger guard_delete_bom_lines before delete on production.bom_lines
  for each row execute function production.guard_bom_line_delete();
create trigger touch_bom_lines before update on production.bom_lines
  for each row execute function core.touch_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
-- เส้นแบ่งของโมดูลนี้คือบรรทัดข้างล่าง ไม่ใช่หน้าจอ
--   production  พนักงานอ่านได้ทุกคน · แก้ได้เฉพาะสินค้า/จัดซื้อ
--   cost 🔒     เห็นและแก้ได้เฉพาะคนที่มี cost.read
--   sales.quote พนักงานอ่านได้ทุกคน · แก้ได้เฉพาะฝ่ายขาย
alter table production.components    enable row level security;
alter table production.boms          enable row level security;
alter table production.bom_lines     enable row level security;
alter table cost.component_prices    enable row level security;
alter table cost.pricing_policy      enable row level security;
alter table sales.quotes             enable row level security;
alter table sales.quote_lines        enable row level security;
alter table core.doc_counters        enable row level security;

create policy components_select on production.components for select to authenticated
  using (core.is_staff());
create policy components_write on production.components for all to authenticated
  using (core.has_capability('products.write') or core.has_capability('purchase.write'))
  with check (core.has_capability('products.write') or core.has_capability('purchase.write'));

create policy boms_select on production.boms for select to authenticated
  using (core.is_staff());
create policy boms_write on production.boms for all to authenticated
  using (core.has_capability('products.write') or core.has_capability('purchase.write'))
  with check (core.has_capability('products.write') or core.has_capability('purchase.write'));

create policy bom_lines_select on production.bom_lines for select to authenticated
  using (core.is_staff());
create policy bom_lines_write on production.bom_lines for all to authenticated
  using (core.has_capability('products.write') or core.has_capability('purchase.write'))
  with check (core.has_capability('products.write') or core.has_capability('purchase.write'));

-- 🔒 ราคาต้นทุน · cost.read เท่านั้น ทั้งอ่านและเขียน
create policy component_prices_select on cost.component_prices for select to authenticated
  using (core.has_capability('cost.read'));
create policy component_prices_write on cost.component_prices for all to authenticated
  using (core.has_capability('cost.read')) with check (core.has_capability('cost.read'));

create policy pricing_policy_select on cost.pricing_policy for select to authenticated
  using (core.has_capability('cost.read'));
create policy pricing_policy_write on cost.pricing_policy for all to authenticated
  using (core.has_capability('cost.read')) with check (core.has_capability('cost.read'));

create policy quotes_select on sales.quotes for select to authenticated
  using (core.is_staff());
create policy quotes_insert on sales.quotes for insert to authenticated
  with check (core.has_capability('sales.write'));
create policy quotes_update on sales.quotes for update to authenticated
  using (core.has_capability('sales.write') or core.has_capability('delivery.write'))
  with check (core.has_capability('sales.write') or core.has_capability('delivery.write'));

create policy quote_lines_select on sales.quote_lines for select to authenticated
  using (core.is_staff());
create policy quote_lines_write on sales.quote_lines for all to authenticated
  using (core.has_capability('sales.write'))
  with check (core.has_capability('sales.write'));

-- ตัวนับเลขเอกสาร · ไม่มี policy ใดเลย = แตะตรงๆ ไม่ได้ ต้องผ่าน core.next_doc_no
-- กันคนแก้เลขล่าสุดแล้วออกเลขซ้ำกับใบที่ส่งลูกค้าไปแล้ว

-- ============================================================================
-- สิทธิ์ระดับ schema
-- ============================================================================
grant usage on schema production to authenticated, service_role;
grant select, insert, update on all tables in schema production to authenticated;
alter default privileges in schema production
  grant select, insert, update on tables to authenticated;
-- ลบได้เฉพาะบรรทัดในสูตรที่ยังเป็นร่าง · trigger เป็นคนตัดสิน ไม่ใช่ grant
grant delete on production.bom_lines to authenticated;
revoke all on schema production from anon;

grant select, insert, update on cost.component_prices, cost.pricing_policy to authenticated;
grant select on cost.v_component_price_now, cost.v_bom_cost, cost.v_variant_cost,
                cost.v_margin_check, cost.v_quote_costing to authenticated;

grant select, insert, update on sales.quotes, sales.quote_lines to authenticated;
grant select on sales.v_quote_totals, sales.v_quotes to authenticated;

revoke all on function core.next_doc_no(text, text, int) from public, anon;
revoke all on function production.add_bom_line(uuid, text, numeric, numeric, numeric, text) from public, anon;
revoke all on function production.activate_bom(uuid)                  from public, anon;
revoke all on function production.new_revision(uuid, text)            from public, anon;
revoke all on function cost.set_component_price(text, numeric, cost.price_source, boolean, date, text) from public, anon;
revoke all on function sales.create_quote(uuid, int, uuid, text)      from public, anon;
revoke all on function sales.add_quote_line(uuid, uuid, numeric, numeric, text, text) from public, anon;
revoke all on function sales.set_quote_shipping(uuid, sales.shipping_terms, numeric, text) from public, anon;
revoke all on function sales.send_quote(uuid)                         from public, anon;
revoke all on function sales.accept_quote(uuid, text)                 from public, anon;
revoke all on function sales.cancel_quote(uuid, text)                 from public, anon;

grant execute on function core.next_doc_no(text, text, int) to authenticated;
grant execute on function production.add_bom_line(uuid, text, numeric, numeric, numeric, text) to authenticated;
grant execute on function production.activate_bom(uuid)                  to authenticated;
grant execute on function production.new_revision(uuid, text)            to authenticated;
grant execute on function cost.set_component_price(text, numeric, cost.price_source, boolean, date, text) to authenticated;
grant execute on function sales.create_quote(uuid, int, uuid, text)      to authenticated;
grant execute on function sales.add_quote_line(uuid, uuid, numeric, numeric, text, text) to authenticated;
grant execute on function sales.set_quote_shipping(uuid, sales.shipping_terms, numeric, text) to authenticated;
grant execute on function sales.send_quote(uuid)                         to authenticated;
grant execute on function sales.accept_quote(uuid, text)                 to authenticated;
grant execute on function sales.cancel_quote(uuid, text)                 to authenticated;

-- ============================================================================
-- ทะเบียนโมดูล
-- ============================================================================
insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability,
   home_path, sort_order, is_core, description_th) values
  ('production', 'สูตรวัสดุ', 'Bill of Materials', 'blueprint', 'production',
   '{core,catalog,materials}', 'products.write', '/bom', 5, false,
   'สูตรวัสดุต่อรุ่น · 1 สูตรครอบทุกเกรด · จัดซื้ออ่านได้ ราคาไม่อยู่ที่นี่'),
  ('quotes', 'ใบเสนอราคา', 'Quotations', 'file-text', 'sales',
   '{core,crm,catalog,pricing,cost,production}', 'sales.write', '/quotes', 6, false,
   'ส่ง requirement มา ออกใบเสนอราคาได้เลย · ลูกค้ารับแล้วกลายเป็นออเดอร์ ไม่ต้องพิมพ์ใหม่');

update core.modules set sort_order = sort_order + 2
 where id in ('materials', 'pricing', 'cost', 'marketing', 'content');

-- ⚠️ ขาดบรรทัดนี้ = REST API มองไม่เห็น schema production ทั้งก้อน
alter role authenticator
  set pgrst.db_schemas = 'public, graphql_public, core, catalog, materials, pricing, cost, marketing, stock, content, crm, sales, line_agent, sheets, pos, production';
-- ★ ต้องมี pos ด้วย · ค่านี้เขียนทับกันทั้งก้อน ไม่ได้ต่อท้าย
--   0037_pos.sql เพิ่ม pos ไว้ · ถ้าไฟล์นี้รันทีหลังแล้วลืม pos ไป โมดูลนั้นหายจาก REST API ทันที

notify pgrst, 'reload config';
notify pgrst, 'reload schema';


-- ========================================================================
-- >>> 0040_pos_lookup.sql
-- ========================================================================

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


commit;

-- ============================================================================
-- ตรวจว่าขึ้นครบ · รันแยกหลังจาก commit แล้ว
-- ============================================================================
select 'schema ใหม่' as "ตรวจอะไร",
       coalesce(string_agg(nspname, ' · ' order by nspname), 'ไม่พบ') as "ผลที่ได้"
from pg_namespace where nspname = 'production'
union all
select 'ตาราง production',
       coalesce(string_agg(table_name, ' · ' order by table_name), 'ไม่พบ')
from information_schema.tables where table_schema = 'production'
union all
select 'ตาราง/วิว cost',
       coalesce(string_agg(table_name, ' · ' order by table_name), 'ไม่พบ')
from information_schema.tables where table_schema = 'cost'
union all
select 'ใบเสนอราคาใน sales',
       coalesce(string_agg(table_name, ' · ' order by table_name), 'ไม่พบ')
from information_schema.tables
where table_schema = 'sales' and table_name like '%quote%'
union all
select 'โมดูลใหม่ใน core.modules',
       coalesce(string_agg(id, ' · ' order by id), 'ไม่พบ')
from core.modules where id in ('production','quotes')
union all
select 'คอลัมน์ที่แก้ชื่อแล้ว (0038)',
       coalesce(string_agg(table_name || '.' || column_name, ' · ' order by table_name), 'ไม่พบ')
from information_schema.columns
where table_schema = 'sales' and column_name = 'เลยกำหนดและค้างเงิน'
union all
select 'ฟังก์ชัน POS ย้อนดูบิล (0040)',
       coalesce(string_agg(p.proname, ' · ' order by p.proname), 'ไม่พบ')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'pos' and p.proname in ('list_sales','sale_days')
union all
-- ★ ต้องเห็นทั้ง pos และ production ในบรรทัดนี้
select 'REST API เห็น schema ไหน',
       coalesce((select setconfig::text from pg_db_role_setting s
                 join pg_roles r on r.oid = s.setrole
                 where r.rolname = 'authenticator' limit 1), 'ไม่พบ');

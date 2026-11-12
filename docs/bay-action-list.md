# สิ่งที่ Bay ต้องทำ

อัปเดต 2026-09-21 · หลังเปิดเว็บใช้งานได้จริงและต่อเส้นทางสินค้าครบแล้ว

เอกสารเก่าที่เป็นผลสำรวจโฟลเดอร์ Drive ย้ายไปอยู่ในประวัติ git แล้ว
(เรื่องนั้นจบไปแล้ว — ได้ไฟล์ออกแบบและไฟล์ราคาครบ)

---

## เว็บเปิดใช้งานได้แล้ว

**https://chawcher-os.vercel.app**

| เรื่อง | สถานะ |
|---|---|
| เครื่องแม่ข่าย | สิงคโปร์ (sin1) ใกล้ไทยที่สุด |
| ฐานข้อมูล | Supabase สิงคโปร์ |
| คนนอกที่ยังไม่ล็อกอิน | เข้าไม่ถึงข้อมูลเลยสักตาราง — ตรวจแล้ว |
| การสมัครเอง | ปิด — ผู้ดูแลสร้างบัญชีให้เท่านั้น |

---

## 🔴 ขั้นที่ 1 · สร้างบัญชีตัวเอง (ต้องทำเอง ผมทำให้ไม่ได้)

ผมสร้างบัญชีให้ไม่ได้ เพราะต้องตั้งรหัสผ่าน และรหัสผ่านของพี่
ไม่ควรผ่านมือใครทั้งนั้น รวมถึงผมด้วย

1. เปิด https://supabase.com/dashboard/project/iblnlzttabwuydgcmqts/auth/users
2. กด **Add user** → **Create new user**
3. ใส่อีเมล + รหัสผ่านที่จะใช้
4. ✅ **ติ๊ก Auto Confirm User** (ถ้าไม่ติ๊ก จะล็อกอินไม่ได้)
5. กด Create user

## ขั้นที่ 2 · ล็อกอินครั้งแรก

1. เปิด https://chawcher-os.vercel.app
2. ล็อกอินด้วยอีเมล/รหัสที่เพิ่งตั้ง
3. ระบบจะพาไปหน้าตั้งค่าครั้งแรกเอง → กดปุ่มเดียว

   คนแรกที่ล็อกอินจะได้สิทธิ์ **เจ้าของ** อัตโนมัติ (ครบทั้ง 13 สิทธิ์
   รวมถึงสิทธิ์ดูต้นทุน) และทำได้ครั้งเดียวเท่านั้น คนถัดไปต้องให้พี่เพิ่มสิทธิ์ให้

## ขั้นที่ 3 · เอาสินค้า 751 ตัวเข้าระบบ

1. เข้า **สินค้า** → **อัปโหลดไฟล์ราคา**
2. เลือกไฟล์ `standard-price-2026-grid-view.csv`
   (ไฟล์เดียวกับที่พี่ส่งมา อยู่ใน repo ที่ `docs/source/`)
3. อัปโหลด → จะขึ้นว่าเข้าที่พักข้อมูล 751 แถว จัดเป็น **95 กลุ่ม**

   ตรงนี้ยังไม่ใช่สินค้า ยังไม่มี SKU เซลส์ยังไม่เห็น

## ขั้นที่ 4 · ตรวจ 95 กลุ่ม (งานหลักของพี่)

เข้า **สินค้า** → **ตรวจและอนุมัติสินค้า**

1 การ์ด = 1 รุ่น (Collection + หมวด) ตอบ 3 คำถาม

| คำถาม | ดูจากอะไร |
|---|---|
| ยังขายอยู่ไหม | ชื่อรุ่น + ช่วงราคา |
| รุ่นเดียวกันจริงไหม | กดเปิดดูรายการวัสดุ/รูปทรง/ขนาดข้างใน |
| สเปกถูกไหม | ตารางขนาดและราคารายตัว |

- **อนุมัติ** → ออก SKU ให้ทั้งกลุ่มทันที **ออกแล้วออกเลย เอาคืนไม่ได้**
- **ไม่เอา** → เปลี่ยนสถานะเฉยๆ ไม่ได้ลบ ย้อนดูทีหลังได้

ไม่ต้องทำรวดเดียวจบ ทำค้างไว้ได้ มีแถบความคืบหน้าบอกว่าเหลือกี่กลุ่ม

## ขั้นที่ 5 · จัดโปรได้แล้ว

พอมีสินค้าอนุมัติแล้ว หน้า **การตลาด** จะเลือกสินค้ามาจัดโปรได้
ตั้งส่วนลดแล้วราคาเปลี่ยนทันที ไม่ต้องไปแก้ราคาทีละตัว

---

## เรื่องที่ผมต้องรอคำตอบจากพี่

| เรื่อง | ทำไมต้องถาม |
|---|---|
| ชื่อผ้า/หนังจริง | ตอนนี้มีแต่เกรด (ผ้า A/B/C, หนังแท้) ยังไม่มีชื่อสีจริง — แบบฟอร์มอยู่ที่ `docs/templates/materials-fill-in.csv` |
| HOF เป็นแบรนด์ที่ขายเองหรือรับมาขาย | มีผลว่าจะนับต้นทุนยังไง |
| ใครได้สิทธิ์อะไรบ้าง | ตอนนี้มีแต่พี่คนเดียว ต้องรู้ว่าจะเปิดให้ใครเห็นอะไร |

## เรื่องที่ผมทำต่อได้เลย ไม่ต้องรอ

- โมดูลคลัง — นับเป็นตัว ไม่ใช่จำนวน · ยืมออกงานแฟร์แล้วมีกำหนดกลับ · พิมพ์สติกเกอร์
- ช่องเพิ่มเอง (Custom Fields) — เพิ่มช่องในสินค้า/ลูกค้า/ออเดอร์ได้เองโดยไม่ต้องรอผม
- หน้าจอสำหรับเครื่องยิงบาร์โค้ดในโรงงานและตอนส่งของ


---

## รอบคลังความรู้ + FAQ (2026-11-11) · ทำตามลำดับ

> ลำดับสำคัญ: ฐานข้อมูลก่อน แล้ว merge · ลิงก์ทุกอันกดได้เลย

**ขั้น 1 · ฐานข้อมูล (Supabase)**
1. เปิด https://supabase.com/dashboard/project/iblnlzttabwuydgcmqts/sql/new
2. วางคำสั่งนี้ กด Run: `select to_regclass('line_agent.recent_images');`
   - ผลเป็น `line_agent.recent_images` = เคยรัน 0037 แล้ว **ข้ามไปข้อ 5**
   - ผลว่าง (null) = ยังไม่เคยรัน ทำข้อ 3-4
3. เปิด https://github.com/baysireekahnokrath/Chawcheros/blob/claude/adoring-sagan-q4nlk6/supabase/migrations/0037_line_image_sets.sql → กดไอคอนคัดลอก (Copy raw file) ด้านขวาบนของไฟล์
4. กลับไปหน้า SQL Editor ลบของเก่า วาง กด Run → ต้องขึ้น Success
5. เปิด https://github.com/baysireekahnokrath/Chawcheros/blob/claude/adoring-sagan-q4nlk6/supabase/migrations/0048_line_knowledge.sql → Copy raw file → วางใน https://supabase.com/dashboard/project/iblnlzttabwuydgcmqts/sql/new → Run → ต้องขึ้น Success

**ขั้น 2 · เอาโค้ดขึ้นเว็บจริง**
6. เปิด https://github.com/baysireekahnokrath/Chawcheros/compare/claude/chaw-cher-os-setup-9k21w6...claude/adoring-sagan-q4nlk6 → Create pull request → Merge pull request → Confirm merge
7. รอ ~2 นาทีให้ Vercel ขึ้นเว็บเอง แล้วเปิด https://chawcher-os.vercel.app/api/faq → ต้องเห็นข้อความ JSON ขึ้นต้น `{"updated_at"` (ถ้าเด้งไปหน้า login แปลว่ายังไม่ขึ้น รอเพิ่ม)

**ขั้น 3 · ตั้งค่ากลุ่ม LINE**
8. เปิด https://chawcher-os.vercel.app/line → กลุ่มที่อยากให้บอทตอบจากคลังความรู้ → "ตั้งค่ากลุ่มนี้" → ติ๊ก "ตอบจากคลังความรู้" → บันทึกกลุ่มนี้
9. กลุ่ม PO และกลุ่มเช็คงาน: กดหัวข้อ "เก็บบทสนทนาห้องนี้เข้าคลังความรู้" → คัดลอกประกาศในกล่อง → ไปโพสต์ในกลุ่ม LINE นั้น → กลับมากด "โพสต์แจ้งทีมแล้ว · เริ่มเก็บ"

**ขั้น 4 · ลองใช้**
10. ในกลุ่มทดสอบพิมพ์ `@Team Bay จดเรื่องนี้ <ความรู้จริงสักข้อ>` → ต้องตอบ "จดแล้วครับ"
11. เปิด https://chawcher-os.vercel.app/knowledge → เปิดข้อที่เพิ่งจด → ติ๊ก "ให้บอทตอบ" และ "ขึ้น FAQ สาธารณะ" → เขียนหัวข้อ/คำตอบสำหรับลูกค้า → ยืนยัน
12. ถามบอทในกลุ่มทดสอบ → ต้องตอบจากข้อที่ยืนยัน · ทีหลังกด "สรุปตอนนี้" ในหน้าเดิมเพื่อลองให้ AI ร่าง

**ขั้น 5 · FAQ บน chawcher.com**
13. ดู preview https://chawcher.com/?page_id=18148&preview=true (ต้องล็อกอิน WordPress) → ต้องเห็นข้อที่ยืนยันในข้อ 11
14. พอใจแล้วบอก Claude "publish FAQ" หรือกด Publish เองที่ https://chawcher.com/wp-admin/post.php?post=18148&action=edit

## รอบหน้าข่าว /news (อัปเดต 2026-11-12 · แบบไม่มีค่า API) · ทำตามลำดับ

> ข่าวเข้าชีต **Chaw Cher News** → 07:43 Claude (แพ็กเกจของ Bay) ร่างลงแท็บ "ร่าง" → 09:00 ระบบดึงมาที่ /news → Bay กด Preview / เผยแพร่ / ส่ง LINE
> ไม่ต้องใส่ ANTHROPIC key · รายละเอียด `docs/modules/news/0-idea.md`

**ขั้น 1 · เปิดให้ชีตดึง Google News ได้ (ครั้งเดียว · ต้องใช้คอม)**
1. เปิด https://docs.google.com/spreadsheets/d/19vtyQJyNimSkFeh3RYz7BoE34mlFVIcm4ubce1iGlQA/edit ในเบราว์เซอร์บนคอม (มือถือกดไม่ได้)
2. ไปแท็บ **Google News** → กดช่อง A2 ที่ขึ้น #REF! → กดปุ่ม **Allow access** → รอสักครู่ต้องเห็นรายการข่าว

**ขั้น 2 · ให้ Claude ตอนเช้าเขียนชีตได้**
3. เปิด https://claude.ai/customize/connectors → ตรวจว่า **Google Sheets** (หรือ Google Drive) เชื่อมอยู่
4. เปิดหน้า Routines / งานตั้งเวลาของ Claude Code บนเว็บ https://claude.ai/code → หางานชื่อ **"Chaw Cher News · ร่างข่าวเช้า"** → แก้ไข → เพิ่มตัวเชื่อม **Google Sheets** → บันทึก
   - ⚠️ ผมสร้างงานนี้ให้แล้วแต่แนบตัวเชื่อมจากที่นี่ไม่ได้ · ถ้าไม่เจอปุ่มเพิ่มตัวเชื่อม บอก Claude (จะลบแล้วให้พี่สร้างใหม่จากหน้านั้น)

**ขั้น 3 · สร้างรหัสให้ระบบโพสต์ chawcher.com ได้ (Application Password)**
5. เปิด https://chawcher.com/wp-admin/profile.php → เลื่อนลงล่างสุด **Application Passwords** → ชื่อ `chawcher-os news` → **Add New Application Password**
6. คัดลอกรหัส 24 ตัว (ปิดหน้าแล้วดูไม่ได้อีก) + จดชื่อผู้ใช้ (Username) ด้านบนสุดของหน้า

**ขั้น 4 · ใส่รหัสใน Vercel**
7. เปิด https://vercel.com/bay8/chawcher-os/settings/environment-variables → **Add Environment Variable** (ติ๊ก Production + Preview) → Save
   - `WP_USER` = ชื่อผู้ใช้จากข้อ 6
   - `WP_APP_PASSWORD` = รหัส 24 ตัวจากข้อ 6

**ขั้น 5 · ฐานข้อมูล**
8. เปิด https://github.com/baysireekahnokrath/Chawcheros/blob/claude/sharp-pascal-6wg2mg/supabase/migrations/0049_news.sql → Copy raw file
9. เปิด https://supabase.com/dashboard/project/iblnlzttabwuydgcmqts/sql/new → วาง → Run → ต้องขึ้น Success

**ขั้น 6 · เอาโค้ดขึ้นเว็บจริง**
10. เปิด https://github.com/baysireekahnokrath/Chawcheros/compare/claude/chaw-cher-os-setup-9k21w6...claude/sharp-pascal-6wg2mg → Create pull request → Merge pull request → Confirm merge
11. รอ ~2 นาที → เปิด https://chawcher-os.vercel.app/news → ต้องเห็นข่าว Dior ในแท็บ "ร่างรอตรวจ" และไม่มีแถบเหลือง

**ขั้น 7 · ลองใช้**
12. ข่าว Dior → **Preview ↗** → ok → ติ๊ก "ดู Preview แล้ว" → **เผยแพร่บนเว็บ** → ติ๊กกลุ่ม LINE + ยืนยัน → **ส่ง LINE**
13. ลองใส่ข่าว: ชีตแท็บ **ข่าวเข้า** เพิ่มแถว (แบรนด์ + ลิงก์หรือเล่าเรื่อง) → พรุ่งนี้ 07:43 Claude ร่าง → 09:00 ขึ้นที่ /news (หรือกด **ดึงจากชีต** เมื่อแท็บ "ร่าง" มีแถวแล้ว)

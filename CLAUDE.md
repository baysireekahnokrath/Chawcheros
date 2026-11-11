# Chawcheros

- ทุกงานที่ออกในชื่อ CHAW CHER (สไลด์ โพสต์ หน้าเว็บ ใบรับรอง ป้าย) ใช้ CI ตาม `docs/brand/README.md` (สี ฟอนต์ โลโก้ใน `docs/brand/`)
- โค้ดเว็บอยู่ใน `web/` (อ่าน `web/CLAUDE.md` ก่อนแก้)

## เว็บและเครื่องมือที่เชื่อมไว้แล้ว (อ่านก่อนถาม Bay ว่า "ใช้อะไร / ทำที่ไหน")

- **chawcher.com = WordPress + WooCommerce** (Jetpack) · ใช้เป็นแคตตาล็อก ไม่มีตะกร้า · รายละเอียด `docs/backlog.md` B2
- **แก้ได้ผ่านตัวเชื่อม WordPress.com** (tools ชื่อ `mcp__WordPress_com__*` · โหลดด้วย ToolSearch คำว่า `wpcom`) · เว็บที่ใช้จริงคือ `blog_id 246232891` ("Chaw Cher | ฌ เฌอ") · รายการเว็บที่ขึ้น `chawcher.com/1752944247-dedupe/` (blog_id 236010133) เป็นของเก่าที่ตัดการเชื่อมต่อแล้ว ไม่ต้องใช้
- **หลัก: ระบบเราเป็นเจ้าของความจริง · WordPress เป็นแค่หน้าร้าน** (B2.5) · ห้ามแก้ราคา/สต็อกในหน้า WordPress ให้ต่างจากระบบ · เนื้อหาที่ต้องอัปเดตเองให้ดึงจากระบบ (เช่น FAQ จาก `/api/faq`)
- ตัวเชื่อมอื่นที่มักเปิดไว้: Supabase · Vercel · Figma · Notion · Trello · Google Drive/Sheets/Docs/Slides/Calendar · ดูรายชื่อ tools ใน session แล้วค้นด้วย ToolSearch ก่อนบอกว่าทำไม่ได้
- **ก่อนถาม Bay ว่าอะไรคืออะไร ให้ค้น `docs/` (Grep) และเช็ก tools ที่เชื่อมไว้ก่อนเสมอ** · ทุก session เริ่มจากศูนย์ ความรู้ที่ไม่ได้เขียนลงไฟล์นี้หรือ `docs/` จะหายไป
- ของที่ออกสู่ภายนอก (เผยแพร่หน้าเว็บ ส่งข้อความเข้ากลุ่ม LINE ลูกค้า) ต้องถาม Bay ยืนยันก่อนทุกครั้ง · ร่าง/draft ทำได้เลย
- งาน LINE agent (Team Bay) → เริ่มที่ `docs/modules/line-agent/7-status.md`

## ที่อยู่ของระบบ (ข้อมูลที่ session ใหม่ต้องรู้เลย · อย่าถาม Bay)

- **ระบบ chawcher-os (production): `https://chawcher-os.vercel.app`** · โปรเจกต์ Vercel `chawcher-os` ทีม `bay8` · webhook LINE `https://chawcher-os.vercel.app/api/line/webhook` · หน้าสาธารณะ: `/pos` `/phoenix` `/faq` `/api/faq` · คู่มือกดทีละขั้น `docs/bay-action-list.md`
- Vercel MCP ที่เชื่อมไว้เข้าถึงได้แค่โปรเจกต์อื่น (`bee-coder-islands`) และ `vercel.com` ถูกบล็อกจากเครื่องนี้ (`docs/deploy-vercel.md`) → **ดู/แก้ Vercel เองไม่ได้ · อย่าเสียเวลาลอง** · ใช้ `curl https://chawcher-os.vercel.app/...` เช็กว่าเว็บจริงขึ้นหรือยังได้
- ฐานข้อมูล Supabase: Bay วาง migration ใน SQL Editor เอง (เราทดสอบในเครื่องด้วย `supabase/tests/README.md`) · โค้ดที่ Bay merge ขึ้น branch `claude/chaw-cher-os-setup-9k21w6` ถึงจะขึ้นเว็บจริง · แต่ละ session ทำงานบน branch ของตัวเองตามที่ระบบกำหนด
- ราคาวัสดุ: ชีต “ราคาวัสดุ ฌ เฌอ” (Google Sheet id `1E4yTp2sLiQV4ULlUSwFmX40SuioMLOA-9yti6_TfNyE`) คือที่ระบบดึงราคาวัสดุ · ต้นฉบับราคาโรงงานคือ Master_วัสดุ ใน `MidYear_CostingSystem.xlsx` (Drive id `1orz_ivnE34Xbkauh-pNBz7pEmpKs5D6t`, รหัส M0001-M0209) · กรอกจาก Master แล้ว 2026-11-11 (`docs/products/sofa-1600/README.md`)
- เว็บแบรนด์ chawcher.com: หน้า FAQ draft อยู่ที่ WordPress page id 18148 (`docs/modules/line-agent/8-knowledge.md`)

### กฎกันลืม
เจอข้อมูลที่ต้องถาม Bay (URL, ชื่อโปรเจกต์, เลข id, ใครดูแลอะไร) แล้ว Bay ตอบ → **เขียนลงไฟล์นี้ทันทีในรอบนั้น** ก่อนปิดงาน · ถ้าค้น `docs/` เจอก่อนถาม ให้ใช้เลย แล้วเพิ่มลงไฟล์นี้ถ้ายังไม่มี

## วิธีส่งงานให้ Bay (Bay สั่งไว้ 2026-11-11 · ทำทุกครั้ง)

- งานที่ Bay ต้องทำเอง → **ส่งเป็นขั้นตอนเรียง 1 2 3 ทีละขั้น** บอกว่ากดอะไร ได้ผลอะไร
- **ทุกขั้นที่ต้องเปิดหน้า ให้ใส่ลิงก์เต็ม `https://…` ที่กดแล้วไปถึงเลย** · ห้ามเขียนแค่ path (`/line`) หรือชื่อเมนู ห้ามให้ Bay ไปต่อ URL เอง
- ลิงก์ที่ใช้บ่อย: ระบบ `https://chawcher-os.vercel.app/` · Supabase SQL `https://supabase.com/dashboard/project/iblnlzttabwuydgcmqts/sql/new` · repo `https://github.com/baysireekahnokrath/Chawcheros` · merge ใช้ลิงก์ compare `…/compare/<base>...<branch>` · ไฟล์ SQL ใช้ลิงก์ `…/blob/<branch>/supabase/migrations/<ไฟล์>.sql`
- ข้อความที่ Bay ต้องคัดลอกไปวาง → ใส่ในกล่องโค้ด · ขั้นตอนทั้งหมดจดไว้ใน `docs/bay-action-list.md` ด้วย

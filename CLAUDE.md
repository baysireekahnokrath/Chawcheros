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

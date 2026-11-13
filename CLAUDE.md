# Chaw Cher OS · กฎสำหรับ Claude ทุก session

ไฟล์นี้ถูกโหลดอัตโนมัติทุก session · อ่านแล้วทำตามทุกข้อ · Bay ไม่ควรต้องบอกเรื่องเดิมซ้ำ

## 1 · ก่อนสร้างหรือแก้อะไร ต้องหาของเดิมก่อน (Bay 2026-11-12: "ทำไมทำผิดซ้ำๆ")

ห้ามสร้างจากความจำ · ค้นในเอกสารก่อนเสมอ:

1. `docs/decisions-log.md` · ทุกเรื่องที่ Bay ตัดสินแล้ว (ห้ามถามซ้ำ)
2. `docs/working-method.md` · ทำทีละด่าน
3. เอกสารของโมดูลนั้นใน `docs/modules/<ชื่อ>/` · โดยเฉพาะไฟล์ `*-status.md` ล่าสุด
4. ใช้ `grep -rn "<คำสำคัญ>" docs` หา pattern/แบบที่ Bay เคยให้ไว้ ก่อนออกแบบเอง

### ของที่ Bay ให้ไว้แล้ว และเคยพลาดมาแล้ว

| เรื่อง | ต้องใช้ | อยู่ที่ |
|---|---|---|
| **ตอบราคาลูกค้า** | ส่วนหัวตายตัว: `<Full name> ราคา <เต็ม> ลด <x>% เหลือ <หลังลด>` · ส่วนท้าย = โปรฯ ที่ใช้อยู่วันนั้นจาก `marketing.promotions` (เงินสด · ขั้นบันได · ส่งฟรี · ของแถม) + `และส่วนลดเพิ่มเติมตามโปรฯ ได้ที่ <ลิงก์>` · มีแค่โปรเงินสดสิ้นเดือน = ประโยคในไฟล์ราคาเป๊ะ · โค้ด `web/src/modules/line-agent/price-text.ts` + ทดสอบ `web/scripts/price-sentence.test.mts` | D13 · B41 · B43 · `docs/price-list-analysis.md` หัวข้อ 3 |
| สูตรราคา | ราคาเต็ม × (1−%ลด) × (1−%on top) · ขั้นบันได 50,000 +12% · 100,000 +18% | J5 · J9 ใน decisions-log |
| ไฟล์ที่ Bay ส่งให้ (Google Sheet ฯลฯ) | **อ่านอย่างเดียว ห้ามแก้เด็ดขาด** · ไม่คัดข้อมูลลูกค้าลง repo | B40 |
| ต้นทุน/กำไร | ไม่เข้าบอท ไม่เข้าห้อง LINE เด็ดขาด | กฎ AI 4-5 |
| AI กับลูกค้า | AI ร่าง คนกดส่ง · ยกเว้นข้อความ template ที่ Bay อนุมัติ | กฎ AI 1 · `docs/modules/line-agent/7-status.md` |

## 2 · คุยกับ Bay

- ภาษาไทย · สั้น · **ทีละขั้น** (step by step) เมื่อให้ Bay ไปกดอะไร
- ถามน้อยที่สุด · ข้อที่ตัดสินแทนได้ด้วยค่าที่ปลอดภัย ให้ตัดสินแล้วบอก
- **ลิงก์ต้องกดได้เสมอ** เขียนเป็น `[ข้อความ](https://...)` · **ห้ามใส่ลิงก์ในกล่องโค้ด** ห้ามให้ Bay ก๊อปไปวางเอง
  - ลิงก์ที่ใช้บ่อย:
    - Supabase SQL Editor: [เปิด SQL Editor](https://supabase.com/dashboard/project/iblnlzttabwuydgcmqts/sql/new)
    - Merge โค้ดขึ้นเว็บ: [เปิดหน้า merge](https://github.com/baysireekahnokrath/Chawcheros/compare/claude/chaw-cher-os-setup-9k21w6...claude/lucid-carson-uely21) (เปลี่ยนชื่อ branch ตาม session)
    - ไฟล์ migration: `https://github.com/baysireekahnokrath/Chawcheros/blob/<branch>/supabase/migrations/<ไฟล์>`
    - เว็บระบบ: [chawcher-os.vercel.app](https://chawcher-os.vercel.app) · หลังบ้านบอท [/line](https://chawcher-os.vercel.app/line)
- ซื่อตรง: ยังไม่ได้ทดสอบจริงต้องบอก · พลาดต้องยอมรับ แล้วบอกว่าจะกันไม่ให้พลาดซ้ำยังไง

## 3 · ส่งงาน

- ทดสอบ SQL ในเครื่องก่อนทุกครั้ง: `supabase/tests/README.md`
- web: `npx tsc --noEmit` · `npx eslint` · `npx next build` (ใน `web/`)
- ทุก migration ใหม่ Bay ต้องวางใน Supabase เอง → ให้ลิงก์ไฟล์ + ลิงก์ SQL Editor ที่กดได้
- เขียนสถานะล่าสุดลง `docs/modules/<โมดูล>/*-status.md` ก่อนจบ session

## 4 · ข้อมูลโปรเจกต์

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
- งานต้นทุน / สูตรวัสดุ / เอกสารโรงงาน → เริ่มที่ `docs/modules/production/2-ning-files.md` (★ **ระบบโรงงาน = Microsoft Access** (Bay ยืนยัน 2026-11-12) ปรินต์ "ใบขอเบิกวัตถุดิบ" แยก 6 แผนก (โครงไม้ · ฟองน้ำ · วางแบบ · เย็บ · หุ้ม · QC) พร้อมช่อง *จำนวนตาม STD* → **BOM อยู่ในฐานข้อมูลโรงงานแล้ว** · ห้ามเริ่มด้วยการถอดสูตรจากกระดาษ ให้ขอไฟล์ `.mdb/.accdb` มา import (อ่านด้วย `apt-get install mdbtools` → `mdb-tables` / `mdb-export` ทดสอบแล้วใช้ได้) · ช่อง *ผลต่าง* ที่กรอกมือ **ไม่มีใครเอากลับเข้าระบบ** = ช่องรั่วที่ใหญ่ที่สุด) แล้วค่อย `1-cost-sheet.md` · `0-paper-reality.md` · `docs/modules/costing/2-design.md`
- **ตัวเลขต้นทุน/กำไรห้ามลง repo เด็ดขาด** · เอกสารในโฟลเดอร์ Drive ของโรงงานอ่านอย่างเดียว เก็บได้แค่ "โครงสร้างของใบ"
- **คนที่โรงงาน:** พี่หนิง = เบญจวรรณ (`benjawan694ms@gmail.com`) ทำ costing/จัดซื้อ · **คุณมาลิ** = คนปรับราคาใน COSTING เมื่อราคาวัสดุขึ้นเยอะ · คุณสุทัศน์ · คุณเชียงศักดิ์ = เจ้าของแบบ (DRAWING)
- **กันพลาดซ้ำ (2026-11-13):** ไฟล์ที่ได้จากโรงงาน ต้องถามก่อนว่าเป็น "ของจริงจากระบบ" หรือ "ทำขึ้นให้ดูเฉพาะกิจ" ก่อนจะสรุปอะไรจากตัวเลขในนั้น · เคยสรุปผิดว่าต้นทุนโรงงานต่ำกว่าจริงครึ่งหนึ่ง ทั้งที่ไฟล์นั้นไม่ใช่ฟอร์ม COSTING จริง
- งานข่าว Chaw Cher / ASE (เก็บข่าวทุกเช้า → ร่างโพสต์ WordPress + ข้อความ LINE) → ชีต `Chaw Cher News` (id `19vtyQJyNimSkFeh3RYz7BoE34mlFVIcm4ubce1iGlQA`) → Claude ร่าง 07:43 (งานตั้งเวลา `trig_018WUZozaYetcPKLkCrRFDTi`) → ระบบดึง 09:00 → หน้า `https://chawcher-os.vercel.app/news` · ไม่ใช้ Claude API (Bay สั่ง ไม่เสียตังค์) · `docs/modules/news/0-idea.md` · เพจ ASE: `facebook.com/AseSofa` `instagram.com/ase.living`

## Google Drive ของโปรเจกต์ (Bay ติ 2026-11-12 · ห้ามสร้างไฟล์ไว้หน้าแรกของ Drive)

- **โฟลเดอร์หลัก "Chaw Cher"** `https://drive.google.com/drive/folders/18t2lbbhOzR6-3m5tdlw2XWk9dc5PY0lH` (id `18t2lbbhOzR6-3m5tdlw2XWk9dc5PY0lH`) · โฟลเดอร์ย่อยมีเลขนำหน้า:
  `01 Google Ads` · `02 Landing Pages` · `03 Website Redesign` · `04 Product & Business Data` · `05 QC Checklist & Ad Agent Workflow` · `06 Claude Project Docs` · `07 News` · (`CC CI Images` · `From factory`)
- **ก่อนสร้างไฟล์/ชีต/เอกสารใน Drive ทุกครั้ง** → ใส่ `parentId` เป็นโฟลเดอร์ย่อยที่ตรงเรื่อง · ไม่มีเรื่องที่ตรง = สร้างโฟลเดอร์ใหม่เลขถัดไป (`08 …`) ใน "Chaw Cher" · ห้ามปล่อยไว้ My Drive หน้าแรก
- รูป/ไฟล์ที่ Bay ส่งมาในแชท → เก็บสำเนาใน Drive โฟลเดอร์ของเรื่องนั้นด้วย (ตั้งชื่อ `YYYY-MM-DD เรื่อง`)
- `07 News` = `https://drive.google.com/drive/folders/1xSLD-fGg9TRtZtjOSE9H55Yi4DNzfRxl` · มีชีต Chaw Cher News + โฟลเดอร์ `รูปข่าว` (`1M1vxIqwpP8bTQ0XPmbd8jIFeCXyZcN99`) แยกโฟลเดอร์ละข่าว
- โฟลเดอร์ "chawcher" (`1RDyJ3IIUmxx730qIG8nMGWk_bIAQnobE`) ที่มี chawcher-os / product-launch / google-ads-search / product-facts = ไฟล์ skill ของ Claude · ไม่ใช่ที่เก็บงาน

## ที่อยู่ของระบบ (ข้อมูลที่ session ใหม่ต้องรู้เลย · อย่าถาม Bay)

- **ระบบ chawcher-os (production): `https://chawcher-os.vercel.app`** · โปรเจกต์ Vercel `chawcher-os` ทีม `bay8` · webhook LINE `https://chawcher-os.vercel.app/api/line/webhook` · หน้าสาธารณะ: `/pos` `/phoenix` `/faq` `/api/faq` · คู่มือกดทีละขั้น `docs/bay-action-list.md`
- Vercel MCP ที่เชื่อมไว้เข้าถึงได้แค่โปรเจกต์อื่น (`bee-coder-islands`) และ `vercel.com` ถูกบล็อกจากเครื่องนี้ (`docs/deploy-vercel.md`) → **ดู/แก้ Vercel เองไม่ได้ · อย่าเสียเวลาลอง** · ใช้ `curl https://chawcher-os.vercel.app/...` เช็กว่าเว็บจริงขึ้นหรือยังได้
- ฐานข้อมูล Supabase: Bay วาง migration ใน SQL Editor เอง (เราทดสอบในเครื่องด้วย `supabase/tests/README.md`) · โค้ดที่ Bay merge ขึ้น branch `claude/chaw-cher-os-setup-9k21w6` ถึงจะขึ้นเว็บจริง · แต่ละ session ทำงานบน branch ของตัวเองตามที่ระบบกำหนด
- **WordPress REST จากระบบ:** Vercel มี `WP_USER`=`content-agent` + `WP_APP_PASSWORD` แล้ว (ใส่ 2026-10-06 สำหรับโมดูลคอนเทนต์ R7 · branch `claude/wizardly-clarke-fiby92` ยังไม่ merge) · หน้า /news ใช้ชุดเดียวกัน · ห้ามให้ Bay สร้างใหม่
- บัญชีที่ระบบใช้อ่าน Google Sheet (แชร์ Viewer ให้ตัวนี้): `chawcher-sheets@chaw-cher-1563265514558.iam.gserviceaccount.com`
- เว็บแบรนด์ chawcher.com: หน้า FAQ draft อยู่ที่ WordPress page id 18148 (`docs/modules/line-agent/8-knowledge.md`)

### กฎกันลืม
เจอข้อมูลที่ต้องถาม Bay (URL, ชื่อโปรเจกต์, เลข id, ใครดูแลอะไร) แล้ว Bay ตอบ → **เขียนลงไฟล์นี้ทันทีในรอบนั้น** ก่อนปิดงาน · ถ้าค้น `docs/` เจอก่อนถาม ให้ใช้เลย แล้วเพิ่มลงไฟล์นี้ถ้ายังไม่มี

## วิธีส่งงานให้ Bay (Bay สั่งไว้ 2026-11-11 · ทำทุกครั้ง)

- งานที่ Bay ต้องทำเอง → **ส่งเป็นขั้นตอนเรียง 1 2 3 ทีละขั้น** บอกว่ากดอะไร ได้ผลอะไร
- **ทุกขั้นที่ต้องเปิดหน้า ให้ใส่ลิงก์เต็ม `https://…` ที่กดแล้วไปถึงเลย** · ห้ามเขียนแค่ path (`/line`) หรือชื่อเมนู ห้ามให้ Bay ไปต่อ URL เอง
- ลิงก์ที่ใช้บ่อย: ระบบ `https://chawcher-os.vercel.app/` · Supabase SQL `https://supabase.com/dashboard/project/iblnlzttabwuydgcmqts/sql/new` · repo `https://github.com/baysireekahnokrath/Chawcheros` · merge ใช้ลิงก์ compare `…/compare/<base>...<branch>` · ไฟล์ SQL ใช้ลิงก์ `…/blob/<branch>/supabase/migrations/<ไฟล์>.sql`
- ข้อความที่ Bay ต้องคัดลอกไปวาง → ใส่ในกล่องโค้ด · ขั้นตอนทั้งหมดจดไว้ใน `docs/bay-action-list.md` ด้วย

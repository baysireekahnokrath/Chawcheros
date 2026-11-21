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

- ภาพรวมระบบ แผน และกฎการทำงาน: `docs/it-platform.md` (อ่านก่อนเริ่มงานใหม่)
- **ทุกงานต้องมี mockup** (HTML ไฟล์เดียว ข้อมูลตัวอย่าง) ที่ `docs/<เรื่อง>/mockup.html` ให้ Bay ดูก่อนลงของจริง · งานเล็กก็ทำ
- **UI ทุกหน้าตาม `docs/ui-framework/README.md`** (ร่าง รอ Bay อนุมัติ) · ไม่สร้างเครื่องมือใช้งานนอก chawcher-os
- SQL ที่ Bay ต้องรัน อยู่ใน `docs/sql-todo/` เท่านั้น · รันแล้วย้ายไป `docs/sql-archive/`
- branch ของเว็บจริงคือ `main`
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
- งานโครงการ H2B GR (ASE เป็น supplier ทำโซฟา/เดย์เบด/สตูล 167 ตัวตาม shop drawing · เริ่ม 6/7/2026 · ติดตามด้วย Freeform) → `docs/modules/production/4-h2b-shop-drawings.md` · รูปอยู่ Drive `From factory/example` (id `1H_3oTgOoIID1J1d6-gwEhDuOvEJ_rwES`) · Bay ให้เก็บข้อมูลไว้ก่อน ยังไม่ให้ออกแบบ (2026-11-16) · ★ Bay ยืนยัน: ราคาที่ตกลงกับลูกค้า**ยังไม่ครอบคลุม**การเปลี่ยนเป็นสปริง + MF-20A ยาวขึ้น = ช่องรั่วงานโครงการ จดไว้ที่ `docs/modules/costing/2-design.md` หัวข้อ 13
- **ตัวเลขต้นทุน/กำไรห้ามลง repo เด็ดขาด** · เอกสารในโฟลเดอร์ Drive ของโรงงานอ่านอย่างเดียว เก็บได้แค่ "โครงสร้างของใบ"
- **ไฟล์ฐานข้อมูลโรงงาน:** ตัวจริงคือ `D:\Cost\CostPrg.mdb` บนเครื่อง Windows XP ของพี่หนิง (โฟลเดอร์ `ALL DATA` บนเดสก์ท็อปมีแต่ทางลัด) · ที่ได้มาแล้วคือ `CostPrg2.mdb` = **สำเนาเก่า ข้อมูลหยุดปี 2019** ไม่มีฟีนิกซ์/ทากะ/ขุนทอง · อ่านด้วย `mdbtools` · โครงตารางทั้ง 19 ตารางจดไว้ใน `docs/modules/production/2-ning-files.md` §6.10 · ★ ตาราง `StockIssu` (จำนวนเบิกจริง) กับ `Purchase` **ว่างเปล่า 0 แถว** = โรงงานไม่เคยเก็บของใช้จริง เก็บแต่ STD
- **allowlist เครื่องนี้:** เพิ่ม `drive.google.com` + `drive.usercontent.google.com` แล้ว (2026-11-16) ใช้โหลดไฟล์ Drive ที่ใหญ่เกิน 10 MB ด้วย `curl 'https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t'`
- **เอเซ่รับงานทางแชท** (Bay 2026-11-21) · งาน/คำถามที่จะส่งให้เอเซ่ → เขียนเป็น **ข้อความแชทชุดเดียว ส่งทีเดียวครบทุกข้อ** (ห้ามแบ่งทีละรายการ) ใส่ในกล่องโค้ดให้ Bay ก๊อป · มีรูปประกอบ = ทำ Google Doc แล้วให้ลิงก์ไปด้วยได้ · ไม่ใส่ราคา/ชื่อลูกค้ารายอื่น/ชื่อ supplier เจ้าอื่น · ตัวอย่าง: Doc ขอข้อมูลงานบ้านเขาใหญ่ ชุดที่ 2 (5 ข้อ ล่าสุด) id `1zTDclFnx98SxAJjuK3uxjg13MOPl1ECn775yUWwFY74` · ชุดแรก 6 ข้อ (เลิกใช้) id `1F0WLpf08wO1qTpXbQD8q3Hzl7e2hdxb45eX4dcSqQ5M` (ในโฟลเดอร์ `sofa image for Khaoyai`)
- **ขนาดรุ่นของเอเซ่ที่ไม่มีในใบราคา ฌ เฌอ → ค้น Drive ก่อนถามใคร** (พลาด 2026-11-21: บอก Bay ว่าหาขนาด Scarlet ไม่เจอ ทั้งที่มีใบ spec อยู่ใน Drive) · ใช้ `search_files` คำว่า `fullText contains '<ชื่อรุ่น>'` · ใบ spec ของเอเซ่ (ZETINI COLLECTION) อยู่โฟลเดอร์ id `1Y6O-pPM09f9p8cavzbIvwa3bDxTprv-c` เช่น `SCARLET.pdf` id `1HLexzAWsmgdXjWOS9BK4W2MpgPpMFOIN` → Scarlet Armchair W81 D94 H97 SH43 (ที่นั่งกว้าง 54 ลึก 56) · 3 ที่นั่ง W180 D94 H97 · ขาไม้โอ๊ค/วอลนัท
- **คนที่โรงงาน:** พี่หนิง = เบญจวรรณ (`benjawan694ms@gmail.com`) ทำ costing/จัดซื้อ · **คุณมาลิ** = คนปรับราคาใน COSTING เมื่อราคาวัสดุขึ้นเยอะ · คุณสุทัศน์ · คุณเชียงศักดิ์ = เจ้าของแบบ (DRAWING)
- **กันพลาดซ้ำ (2026-11-13):** ไฟล์ที่ได้จากโรงงาน ต้องถามก่อนว่าเป็น "ของจริงจากระบบ" หรือ "ทำขึ้นให้ดูเฉพาะกิจ" ก่อนจะสรุปอะไรจากตัวเลขในนั้น · เคยสรุปผิดว่าต้นทุนโรงงานต่ำกว่าจริงครึ่งหนึ่ง ทั้งที่ไฟล์นั้นไม่ใช่ฟอร์ม COSTING จริง
- งานข่าว Chaw Cher / ASE (เก็บข่าวทุกเช้า → ร่างโพสต์ WordPress + ข้อความ LINE) → ชีต `Chaw Cher News` (id `19vtyQJyNimSkFeh3RYz7BoE34mlFVIcm4ubce1iGlQA`) → Claude ร่าง 07:43 (งานตั้งเวลา `trig_018WUZozaYetcPKLkCrRFDTi`) → ระบบดึง 09:00 → หน้า `https://chawcher-os.vercel.app/news` · ไม่ใช้ Claude API (Bay สั่ง ไม่เสียตังค์) · `docs/modules/news/0-idea.md` · เพจ ASE: `facebook.com/AseSofa` `instagram.com/ase.living`

## Google Drive ของโปรเจกต์ (Bay ติ 2026-11-12 · ห้ามสร้างไฟล์ไว้หน้าแรกของ Drive)

- **โฟลเดอร์หลัก "Chaw Cher"** `https://drive.google.com/drive/folders/18t2lbbhOzR6-3m5tdlw2XWk9dc5PY0lH` (id `18t2lbbhOzR6-3m5tdlw2XWk9dc5PY0lH`) · โฟลเดอร์ย่อยมีเลขนำหน้า:
  `01 Google Ads` · `02 Landing Pages` · `03 Website Redesign` · `04 Product & Business Data` · `05 QC Checklist & Ad Agent Workflow` · `06 Claude Project Docs` · `07 News` · (`CC CI Images` · `From factory`)
- **ก่อนสร้างไฟล์/ชีต/เอกสารใน Drive ทุกครั้ง** → ใส่ `parentId` เป็นโฟลเดอร์ย่อยที่ตรงเรื่อง · ไม่มีเรื่องที่ตรง = สร้างโฟลเดอร์ใหม่เลขถัดไป (`08 …`) ใน "Chaw Cher" · ห้ามปล่อยไว้ My Drive หน้าแรก
- รูป/ไฟล์ที่ Bay ส่งมาในแชท → เก็บสำเนาใน Drive โฟลเดอร์ของเรื่องนั้นด้วย (ตั้งชื่อ `YYYY-MM-DD เรื่อง`)
- `From Customers` (id `1Yr2mNhm3kYYLvopebuc9AI5V27hknh63` · Bay สร้าง 2026-11-17) = ไฟล์ที่ลูกค้าส่งมา · งานแรก: บ้านเขาใหญ่ PDF 39 หน้า 106 รายการ (แถวแดง = มี supplier แล้ว · แถวเขียว = รับเหมาทำ) → ชีตสรุป id `1cIaKzvSO0EekLXExW-UIPAm8Xe4r1gcihAcx0fZ25HM` · ชีตจับคู่กับรุ่นเรา + รูปคู่ + ราคาตาม format id `15LzXx22UZlbsJbBOVFRcF6y6p0OU0et1lrnnN8bDtPg` (v2 · Bay แก้การจับคู่เอง 33 ข้อ 2026-11-17 · ★ บทเรียน: นอกจากรุ่นในใบราคา ฌ เฌอ ยังมี **แบบที่เอเซ่เคยทำให้ลูกค้ารายอื่น** ที่เอามาเสนอได้ แต่ไม่มีรูป/ราคาในระบบ ต้องขอจากเอเซ่ · Bay รู้จักแบบพวกนี้ Claude ไม่รู้ → งานจับคู่ครั้งหน้าให้ถาม Bay ก่อนว่ามีแบบของเอเซ่ตัวไหนใช้ได้ · รุ่น Oom chair / Spezia arm chair ไม่มีในใบราคา) · ★ **ไฟล์ล่าสุด v8 (ภายใน) id `1IFvaG95wARKeH7pS2OmsnXW-fHuYf3AmbSYQg1FEDm4`** + **ไฟล์สำหรับลูกค้า ฉบับ 2 id `1_puv18jsjkKco6WpjRHaO06G-h26mSEoHTm2ejNhDFE`** (ฉบับแรก เลิกใช้ id `1HMxVdA1SNtK3mEQIShs2HJlNaKm6C4om-rzPWY3Ry_o`) (2026-11-21 · กฎไฟล์ลูกค้าที่ Bay สั่ง: **ประโยคราคาตัดท้าย "ภายใน เดือน… และส่วนลดเพิ่มเติมตามโปรฯ ได้ที่ <ลิงก์>" ออก** (งานโครงการ ไม่ใช่ตอบราคาหน้าร้าน) · เฉพาะแท็บเสนอ · ตัดคอลัมน์คำสั่ง Bay / Claude ทำแล้ว / ตัวเลือกจากใบเสนอราคา · มีคอลัมน์ "งานที่ลูกค้าต้องทำต่อ" · **ราคาทุกช่องรวม VAT** (รุ่นในใบราคารวม VAT อยู่แล้ว · ของ supplier ภายนอกและแบบเอเซ่ ×1.07) · ไม่มีคำว่าเอเซ่/supplier/บุ๊ค · รูป Andaman มาจากร้านอื่น ต้องตัดโลโก้และราคาเขาออก · สคริปต์ `build8.py` อยู่ scratchpad ไม่อยู่ใน repo) · v7 (เลิกใช้) id `14OSSfAes82ucMfJko_GQiiFyQNFUiMe2W4GH_goBuQA` (2026-11-21 · Bay แก้คอลัมน์ AD ใน v4: LF-G-06 เป็นไม่เสนอ → เหลือ 22 รายการ · Bay ยังแก้คำสั่งใน v4 คอลัมน์ AD อยู่ ต้องอ่าน v4 ซ้ำทุกครั้งที่บอกว่า update) · v6 (เลิกใช้) id `1eIkNUFuKoTI1DPwcCr2FhGxWa7wYRkYccRL6wRvNeWk` (ทำใหม่จากคำสั่งใน v4 · แท็บ `เสนอ` 23 รายการ + `ทั้งหมด` เก็บรุ่นเดิมของแถวที่ไม่เสนอไว้ · Bay สั่งรอบใหม่ที่คอลัมน์ V) · ★ **สูตรราคางานโครงการที่ Bay ยืนยัน 2026-11-21:** แบบของเอเซ่ = ราคา M40 ในโน้ตเอเซ่ × 1.5 ปัดหลักร้อย (★ **M40 = ราคาที่เราซื้อจากเอเซ่** = ต้นทุนเรา · Bay ยืนยัน 2026-11-21 · ต้นทุนรุ่นในแคตตาล็อกดูได้จาก Product Master v3 Drive id `1v3dUdgJG6Au-A_k3iHksAeT2Zt0QhsQ7` คอลัมน์ CoGS/Transportation (Non VAT) · ใช้คิดกำไรในแชทได้ ห้ามลง repo) · ของ supplier ภายนอก = **ราคาหลังส่วนลดที่เขาขายให้เรา × 1.3** (แทนกฎ +50% เดิม) · v5 (เลิกใช้) id `1oo9LL5T6VdvMh6mrPvzR5DYlv_V1Ht-Bh3w0wUHY-Nc` (ทำตามคำสั่งในคอลัมน์ AD ของ v4 · แท็บ `เสนอ` 23 รายการ + แท็บ `ทั้งหมด` · **Bay สั่งรอบต่อไปที่คอลัมน์ V "คำสั่งรอบใหม่จาก Bay"** · สูตรราคาที่ Bay ให้: แบบของเอเซ่ = ราคา M40 ในโน้ตเอเซ่ × 1.5 ปัดหลักร้อย) · v4 id `1S1O_mA-UW-g0R1AzH5-t61Pk2AMB2heOXuUuiH9n1Ps` (= v3 + ตัวเลือกจากใบเสนอราคา supplier ภายนอก 17 แถว เป็นคอลัมน์ "ตัวเลือกเพิ่ม" ไม่ทับรุ่นที่ Bay/designer เลือก) · **Bay สั่งงานผ่านคอลัมน์ AD "คำสั่ง / คอมเมนต์จาก Bay" ของชีตล่าสุด** (แท็บ `รายการ`) · Claude อ่านคอลัมน์นี้ทั้งคอลัมน์ทุกครั้งที่ Bay บอกว่าใส่แล้ว · ทำเป็นไฟล์ใหม่ แล้วยกคำสั่งเดิม + สิ่งที่ทำ (คอลัมน์ AE) ไปไฟล์ใหม่ด้วย · v3 หลังคุย designer 2026-11-21 id `1BcDLUF81q_VHayrR73hbBJ5Vs3txQIFdH83MzOGzQTg` (Bay สั่ง: **ทำไฟล์ใหม่ทุกรอบ ห้ามแก้ไฟล์เก่า** · **ห้ามใส่ชื่อ supplier เจ้าอื่นในไฟล์เสนอ** · ของที่มาจาก supplier ภายนอกให้ **บวกราคา 50%** จากราคาที่เขาเสนอ · รูป/ใบเสนอราคา/โน้ตราคาจากเอเซ่อยู่ในโฟลเดอร์ย่อย `sofa image for Khaoyai` id `1_8pU7DLn4KfInB3TVxk9fAz2bRJv4Asp` · ตัวเลขในนั้นเป็นต้นทุน ห้ามลง repo · บุ๊ค = คนเช็ก/คอนเฟิร์มราคาและขนาด) (วิธีใส่รูปลงชีตโดยไม่ต้องเปิดแชร์: สร้าง .xlsx ด้วย openpyxl แปะรูปในเซลล์ แล้วอัปขึ้น Drive ให้แปลงเป็น Google Sheet) · ไฟล์ใน Drive ที่ไม่เปิดแชร์ลิงก์ โหลดด้วย curl ไม่ได้ และตัวเชื่อม Drive อ่าน PDF ภาพไม่ออก → ต้องขอ Bay ก่อนเปิดแชร์ชั่วคราว (ตัวเชื่อมปิดแชร์คืนเองไม่ได้ ต้องให้ Bay ปิด)
- `07 News` = `https://drive.google.com/drive/folders/1xSLD-fGg9TRtZtjOSE9H55Yi4DNzfRxl` · มีชีต Chaw Cher News + โฟลเดอร์ `รูปข่าว` (`1M1vxIqwpP8bTQ0XPmbd8jIFeCXyZcN99`) แยกโฟลเดอร์ละข่าว
- โฟลเดอร์ "chawcher" (`1RDyJ3IIUmxx730qIG8nMGWk_bIAQnobE`) ที่มี chawcher-os / product-launch / google-ads-search / product-facts = ไฟล์ skill ของ Claude · ไม่ใช่ที่เก็บงาน

## ที่อยู่ของระบบ (ข้อมูลที่ session ใหม่ต้องรู้เลย · อย่าถาม Bay)

- **ระบบ chawcher-os (production): `https://chawcher-os.vercel.app`** · โปรเจกต์ Vercel `chawcher-os` ทีม `bay8` · webhook LINE `https://chawcher-os.vercel.app/api/line/webhook` · หน้าสาธารณะ: `/pos` `/phoenix` `/faq` `/api/faq` · คู่มือกดทีละขั้น `docs/bay-action-list.md`
- Vercel MCP ที่เชื่อมไว้เข้าถึงได้แค่โปรเจกต์อื่น (`bee-coder-islands`) และ `vercel.com` ถูกบล็อกจากเครื่องนี้ (`docs/deploy-vercel.md`) → **ดู/แก้ Vercel เองไม่ได้ · อย่าเสียเวลาลอง** · ใช้ `curl https://chawcher-os.vercel.app/...` เช็กว่าเว็บจริงขึ้นหรือยังได้
- ฐานข้อมูล Supabase: Bay วาง migration ใน SQL Editor เอง (เราทดสอบในเครื่องด้วย `supabase/tests/README.md`) · ★ **เว็บจริงรันจาก branch `main` เท่านั้น** (ยืนยัน 2026-11-16 · เคยเข้าใจผิดว่าเป็น `claude/chaw-cher-os-setup-9k21w6` แล้วบอก Bay ว่าโค้ดขึ้นเว็บแล้ว ทั้งที่หน้าใหม่ 404) · แต่ละ session ทำงานบน branch ของตัวเอง → push → **เปิด PR เข้า `main`** แล้ว Bay กด merge ถึงจะขึ้นเว็บ · ก่อนเปิด PR ให้ `git merge origin/main` เข้า branch ตัวเองก่อนเสมอ เพราะ session อื่นก็ merge เข้า main เหมือนกัน
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

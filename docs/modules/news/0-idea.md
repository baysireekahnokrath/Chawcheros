# โมดูลข่าว (Chaw Cher News) · ด่าน 0 · ไอเดีย + เครื่องมือ

เริ่ม 2026-11-11 · Bay สั่ง: เก็บข่าวของ **Chaw Cher** และ **ASE (บริษัท เอเซ่ จำกัด · ผู้ผลิตโซฟาให้ CC · ดู B38)** จากเว็บ + social + ที่ Bay ส่งมาในแชท

## ขั้นตอนที่ Bay ต้องการ
1. ทุกเช้า ไปเช็กข่าวใหม่ · **ข่าวที่ซ้ำไม่ต้องเอามา** (เทียบกับ `seen.md`)
2. ทำข่าว → ร่างโพสต์บน chawcher.com (WordPress blog_id 246232891) + ข้อความสั้นพร้อมภาพสำหรับส่ง LINE
3. หน้าสรุปให้ Bay กด preview → ok กด publish หรือส่ง message

## กฎ
- ร่างได้เลย · **publish / ส่ง LINE ต้อง Bay กดเอง** (CLAUDE.md)
- ข่าวที่มีแบรนด์อื่น (เช่น Dior) หรือคนนอกในภาพ → ถาม Bay ว่าเปิดเผยได้ไหมก่อน publish
- หมวดใน WordPress ตอนนี้มี Design(149) · Lifestyle(150) · Promotion(152) · ยังไม่มี "News" → ใช้ Lifestyle ไปก่อน (โพสต์งานอีเวนต์เดิมก็อยู่หมวดนี้)
- ฟิลด์ `advanced_seo_description` ส่งผ่าน MCP ไม่ติด (WordPress ทิ้ง) → ใช้ excerpt แทน

## ช่องทางที่ค้น (Bay ให้มา 2026-11-11)
- Chaw Cher: chawcher.com · facebook.com/chawcher · instagram.com/chawcher · คำค้น "Chaw Cher" "ฌ เฌอ"
- ASE: https://www.facebook.com/AseSofa · https://www.instagram.com/ase.living/ · คำค้น "ASE Sofa" "เอเซ่ โซฟา"
- แก้รายการได้ที่ `web/src/modules/news/ai.ts` (SOURCES)
- ⚠️ Facebook/IG ส่วนใหญ่ต้องล็อกอิน · ตัวค้นของ Claude เห็นเฉพาะที่ Google เห็น → โพสต์เพจที่ไม่ขึ้นใน Google ต้องใช้ "+ เพิ่มข่าวเอง"

## 2026-11-12 · Bay: "ไม่เสียตังค์" → เปลี่ยนเป็นแบบชีต (ไม่เรียก Claude API เลย)
```
① ข่าวเข้าชีต "Chaw Cher News"      ② 07:43 Claude (แพ็กเกจ Bay)        ③ 09:00 ระบบดึงแท็บ "ร่าง"      ④ Bay approve
   แท็บ "Google News" (IMPORTFEED)  →    อ่านชีต + ค้นเว็บ ≤5 คำ       →    เข้า content.news_items   →    /news: Preview / เผยแพร่ / ส่ง LINE
   แท็บ "ข่าวเข้า" (ทีมใส่เอง)             เขียนแถวในแท็บ "ร่าง"               (กันซ้ำ: รหัส + ลิงก์)
```
| ส่วน | อยู่ที่ |
|---|---|
| ที่เก็บใน Drive | Chaw Cher › `07 News` https://drive.google.com/drive/folders/1xSLD-fGg9TRtZtjOSE9H55Yi4DNzfRxl · รูปแยกโฟลเดอร์ละข่าวใน `07 News › รูปข่าว` (รูป Dior อยู่ใน `2026-11-11 Dior Gold House`) |
| ชีต | https://docs.google.com/spreadsheets/d/19vtyQJyNimSkFeh3RYz7BoE34mlFVIcm4ubce1iGlQA/edit (เจ้าของ arthitbay · แชร์ Viewer ให้ `chawcher-sheets@chaw-cher-1563265514558.iam.gserviceaccount.com` แล้ว) · แท็บ วิธีใช้ / ข่าวเข้า / ร่าง / Google News |
| คอลัมน์แท็บ "ร่าง" | A รหัส YYYY-MM-DD-NN · B วันที่ร่าง · C แบรนด์ · D ลิงก์ต้นทาง · E หัวข้อต้นทาง · F วันที่ต้นทาง · G หัวข่าว · H เนื้อข่าว · I ข้อความ LINE · J ลิงก์รูป · K มาจาก · L สรุปต้นทาง |
| งานตั้งเวลา Claude | `trig_018WUZozaYetcPKLkCrRFDTi` "Chaw Cher News · ร่างข่าวเช้า" · ทุกวัน 07:43 เวลาไทย · session ใหม่ทุกครั้ง · ⚠️ สร้างจาก session นี้แนบตัวเชื่อม Google Sheets ไม่ได้ → Bay ต้องเพิ่มเองที่หน้า Routines |
| ดึงชีต | Vercel Cron `0 2 * * *` UTC (09:00) → `web/src/app/api/news/import/route.ts` → `web/src/modules/news/sheet.ts` · ปุ่ม "ดึงจากชีต" ใน /news |
| ฐานข้อมูล | `supabase/migrations/0049_news.sql` (`content.news_import`) · ทดสอบ `supabase/tests/21_news.sql` |
| ขึ้นเว็บ / ส่ง LINE | `web/src/modules/news/wp.ts` (WP REST + Application Password) · `actions.ts` |
| เพิ่มข่าวเองในเว็บ | พิมพ์หัวข่าว + เนื้อ + รูปจากมือถือ · ไม่มี AI |

- IMPORTFEED ต้องให้ Bay กด "Allow access" ในเบราว์เซอร์คอมครั้งแรก (ก่อนกดขึ้น #REF!)
- รูปจาก Google Drive ต้องแชร์ "ทุกคนที่มีลิงก์" ระบบถึงดึงไปลงเว็บ/LINE ได้

ยังไม่ได้ทดสอบกับของจริง: อ่านชีตด้วย service account · WordPress REST · LINE push รูป · งานตั้งเวลา 07:43 รอบแรก

## 2026-11-12 · Design Watch (Bay: "เอาแท็บ design watch เลย")
ข่าววงการดีไซน์ ให้ Bay อ่านเอง · **ไม่เผยแพร่ ไม่เข้าแท็บ "ร่าง" ไม่เข้าระบบ** (ระบบอ่านแค่ `ร่าง!A2:L500`)
| ส่วน | รายละเอียด |
|---|---|
| แท็บ "Design Watch" (sheetId 5) | IMPORTFEED จาก Google News RSS 4 กลุ่ม 7 วันล่าสุด กลุ่มละ 15 ข่าว · A-E Dezeen+designboom · G-K Wallpaper*/Frame/Sight Unseen/ArchDaily · M-Q เทรนด์/Salone/Maison&Objet/ผ้าหุ้ม · S-W ข่าวไทย โซฟา/เฟอร์นิเจอร์ ดีไซน์ · ทุกคำค้นมีคำว่า sofa/furniture/upholstery กรองให้ |
| แท็บ "Design สรุป" (sheetId 4) | Claude 07:43 เขียน ≤5 เรื่อง/วัน · A วันที่ · B หมวด (เทรนด์/ดีไซเนอร์/สินค้าใหม่/วัสดุ/ผ้า/งานแฟร์/ไทย) · C หัวข้อไทย · D สรุป · E เกี่ยวกับ Chaw Cher ยังไง · F ลิงก์ · G ช่อง Bay จด |
| งานตั้งเวลา | เพิ่มขั้นที่ 5 ใน `trig_018WUZozaYetcPKLkCrRFDTi` · ถ้า Design Watch ขึ้น #REF! ใช้ WebSearch ≤3 คำค้นแทน |
- ⚠️ ยังขึ้น #REF! จนกว่า Bay กด "Allow access" ในชีต (ครั้งเดียวใช้ได้ทุกแท็บ) · ทดสอบ RSS จากเครื่อง Claude ไม่ได้ (ถูกบล็อก) → ยังไม่เห็นผลจริง
- แหล่งอ้างอิงที่ Bay ถามไว้ (เว็บ งานแฟร์ ดีไซเนอร์) สรุปในแชท 2026-11-12: Dezeen · designboom · Wallpaper* · Frame · Sight Unseen · art4d · บ้านและสวน · Salone · Maison&Objet · 3daysofdesign · DEmark

## เครื่องมือ (สถานะ 2026-11-11)
| ส่วน | ใช้อะไร | สถานะ |
|---|---|---|
| ค้นเว็บ/ข่าว | Google News ในชีต (IMPORTFEED) + WebSearch ของงานตั้งเวลา Claude | ✅ |
| แจ้งเตือนข่าวอัตโนมัติ | Google Alerts → ส่งเข้า Gmail → อ่านด้วยตัวเชื่อม Gmail | ⏳ Bay ตั้ง Alerts |
| เพจ FB/IG ของเราเอง | Supermetrics (เชื่อมไว้ ต้องล็อกอินเพจ) | ⏳ ต้อง login |
| FB/IG/TikTok ของคนอื่นที่พูดถึงเรา | เครื่องมือค้นไม่ถึง (ต้องล็อกอิน) → Bay/ทีม ส่งลิงก์หรือภาพมาในแชท | ทางนี้ |
| รันทุกเช้า | Claude 07:43 ร่างในชีต · Vercel Cron 09:00 ดึงเข้าระบบ | ✅ (ต้องแนบตัวเชื่อม Sheets ให้งานตั้งเวลา) |
| ร่างโพสต์เว็บ | ตัวเชื่อม WordPress.com | ✅ |
| หน้าสรุป preview/publish/ส่ง LINE | https://chawcher-os.vercel.app/news | ✅ โค้ดเสร็จ รอ Bay ลง |

## ข่าวที่ทำแล้ว
| วันที่ | เรื่อง | WordPress | สถานะ |
|---|---|---|---|
| 2026-11-11 | ทีมพบคุณกรกช ที่ Dior Gold House คุยเรื่อง collaboration | อยู่ใน /news (seed 0049) · ร่าง WP 18153 เดิมเป็นของบัญชี Bay ไม่ใช้แล้ว (content-agent แก้ไม่ได้) · รูป 18150-18152 ใช้ต่อ | รอ Bay |

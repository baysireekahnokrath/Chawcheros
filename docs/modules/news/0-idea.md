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

## หน้า /news (สร้าง 2026-11-11 · รอ Bay ลง · ขั้นตอน `docs/bay-action-list.md` "รอบหน้าข่าว")
| ส่วน | ไฟล์ |
|---|---|
| ฐานข้อมูล `content.news_items` `content.news_runs` · กันซ้ำด้วยลิงก์ (source_key) · ห้ามลบ · ของออกนอกต้องมี reviewed_by | `supabase/migrations/0049_news.sql` · ทดสอบ `supabase/tests/21_news.sql` |
| ค้นทุกเช้า 08:00 (Vercel Cron `0 1 * * *` UTC) · Claude Sonnet 5.5 + web search ≤10 ครั้ง · เพดาน ฿300/เดือน (env `NEWS_BUDGET_THB`) | `web/src/app/api/news/collect/route.ts` · `web/src/modules/news/ai.ts` |
| Bay เล่าเรื่อง + รูป → Claude Opus 5.5 ร่าง (ย่อรูปในเบราว์เซอร์ก่อนส่ง) | `ai.ts` draftFromNote · `web/src/components/news/ImageForm.tsx` |
| ขึ้นเว็บ: WordPress REST + Application Password (env `WP_USER` `WP_APP_PASSWORD`) · ร่างก่อนเสมอ · publish ต้องติ๊กยืนยัน | `web/src/modules/news/wp.ts` · `actions.ts` |
| ส่ง LINE: บอท Team Bay push รูปปก + ข้อความ เข้ากลุ่มที่อนุมัติแล้วที่ Bay ติ๊ก | `actions.ts` sendLine · `line-agent/line.ts` pushMessages |

ยังไม่ได้ทดสอบกับของจริง: การเรียก Claude (เครื่องนี้ไม่มี API key) · WordPress REST ด้วย Application Password · LINE push รูป

## เครื่องมือ (สถานะ 2026-11-11)
| ส่วน | ใช้อะไร | สถานะ |
|---|---|---|
| ค้นเว็บ/ข่าว | WebSearch ใน session | ✅ มีแล้ว |
| แจ้งเตือนข่าวอัตโนมัติ | Google Alerts → ส่งเข้า Gmail → อ่านด้วยตัวเชื่อม Gmail | ⏳ Bay ตั้ง Alerts |
| เพจ FB/IG ของเราเอง | Supermetrics (เชื่อมไว้ ต้องล็อกอินเพจ) | ⏳ ต้อง login |
| FB/IG/TikTok ของคนอื่นที่พูดถึงเรา | เครื่องมือค้นไม่ถึง (ต้องล็อกอิน) → Bay/ทีม ส่งลิงก์หรือภาพมาในแชท | ทางนี้ |
| รันทุกเช้า 08:00 | Vercel Cron ในระบบ chawcher-os (ไม่พึ่ง session ของ Claude) | ✅ โค้ดเสร็จ รอ merge |
| ร่างโพสต์เว็บ | ตัวเชื่อม WordPress.com | ✅ |
| หน้าสรุป preview/publish/ส่ง LINE | https://chawcher-os.vercel.app/news | ✅ โค้ดเสร็จ รอ Bay ลง |

## ข่าวที่ทำแล้ว
| วันที่ | เรื่อง | WordPress | สถานะ |
|---|---|---|---|
| 2026-11-11 | ทีมพบคุณกรกช ที่ Dior Gold House คุยเรื่อง collaboration | post 18153 (รูป 18150 18151 18152) | draft รอ Bay |

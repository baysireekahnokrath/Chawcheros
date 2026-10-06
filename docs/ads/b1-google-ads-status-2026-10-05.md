# B1 Google Ads: สถานะ ณ 5 ต.ค. 2026

ข้อมูลจาก Supermetrics (อ่านอย่างเดียว) บัญชี 735-056-5194 และ GA4 property 312389270
ยังไม่ได้แก้อะไรในบัญชี ทุกข้อด้านล่าง Bay เป็นคนกดเอง

## งานค้างแคมเปญ 4 "4. Search - Hook Cozy Chair"

| # | งาน | สถานะที่ตรวจได้ |
|---|-----|-----------------|
| 1 | negative keywords ระดับแคมเปญ | ✅ ใส่แล้ว 6 ต.ค. 2026 ผ่าน Supermetrics (Bay อนุมัติ) ครบ 9 คำ phrase · พื้นที่ ภาษา งบ คีย์เวิร์ด ไม่เปลี่ยน |
| 2 | `showroom_appointment_click` เป็น Key Event ใน GA4 | ยังไม่ได้ตั้ง (Is key event = not set, ต่างจาก generate_lead ที่เป็น true) |
| 3 | import เข้า Google Ads + เปลี่ยนเป้าหมายแคมเปญ 4 | ยังไม่มี conversion action ตัวนี้ในบัญชี |

event `showroom_appointment_click` ใน GA4: 18 ก.ย. 1 ครั้ง (google / organic), 28 ก.ย. 1 ครั้ง (google / cpc)
ครั้งล่าสุดคือ 28 ก.ย. จะหลุดจากหน้า import ของ Google Ads ราว 26 ต.ค. ถ้ายังไม่ได้ตั้งเป็น key event

### ข้อ 1: รายการสำหรับวาง (Campaign > Keywords > Negative keywords > เลือกแคมเปญ 4)

```
"ikea"
"muji"
"โฮมโปร"
"โฮม โปร"
"บาร์"
"ล้อเลื่อน"
"พลาสติก"
"สแตนเลส"
"กินข้าว"
```

ไม่ใส่ eames lounge chair / barcelona chair ตามที่ Bay สั่ง
หมายเหตุ: รายงาน search terms แสดงคำไทยแบบเว้นวรรค เช่น "ส แตน เล ส", "กิน ข้าว" ถ้าสัปดาห์หน้ายังเห็นคำพวกนี้หลุดเข้ามา ค่อยเพิ่มแบบเว้นวรรคตาม

### ข้อ 2: GA4
Admin > Data display > Events > หา `showroom_appointment_click` > กดดาว (Mark as key event)

### ข้อ 3: Google Ads
Goals > Conversions > Summary > + New conversion action > Import > Google Analytics 4 > Web > เลือก `showroom_appointment_click`
จากนั้นแคมเปญ 4 > Settings > Goals > ใช้ goal ระดับแคมเปญ เลือกเฉพาะตัวนี้ (ไม่ใช้ Contacts)
วันที่บันทึกข้อนี้เสร็จ = วันเริ่มนับ 1 เดือน (ห้ามเพิ่มงบ ห้ามเพิ่มคีย์เวิร์ด)

## ผลแคมเปญ (13 ก.ย. - 4 ต.ค. 2026, หน่วยบาท)

| แคมเปญ | สถานะ | Impr. | คลิก | ค่าใช้จ่าย | Conv. | IS | เสียให้ rank | เสียให้งบ |
|--------|-------|------:|-----:|-----------:|------:|---:|------------:|----------:|
| Search - General Sofas - อ.เบิร์ด | Limited (bid strategy) | 2,550 | 132 | 1,277.71 | 3 | 46.9% | 52.7% | 0.5% |
| 4. Search - Hook Cozy Chair (เริ่ม 17 ก.ย.) | Limited (bid strategy) | 279 | 14 | 133.54 | 0 | 22.1% | 76.6% | 1.3% |
| Search - Location Based-อ.เบิร์ด | Limited (bid strategy) | 258 | 13 | 87.72 | 0 | 34.5% | 63.9% | 1.7% |
| Search - Sofa 2 ที่นั่ง อ.เบิร์ด | Eligible | 0 | 0 | 0 | 0 | - | - | - |
| Video views - Chaw Cher Armchair | Eligible | 468 | 0 | 62.12 | 0 | - | - | - |

7 วันล่าสุด: General Sofas 47 คลิก 461.77 บาท 0 conv. / Hook 9 คลิก 88.63 บาท / Location 2 คลิก 13.90 บาท

## เรื่องที่ควรรู้ (ยังไม่ได้แก้)

1. **Sofa 2 ที่นั่ง ไม่มี impression เลยตั้งแต่ 13 ก.ย.** ทั้งที่สถานะ Eligible ต้องเปิดดูใน UI ว่าคีย์เวิร์ด/โฆษณาติดอะไร
2. **เป้าหมาย Contacts อาจนับไม่ได้จริง** conversion action "Chawcher - GA4 (web) add_line" ดึง event `add_line` แต่ใน GA4 event ชื่อ `Add Line` (ตัวใหญ่ + เว้นวรรค) และยิงครั้งสุดท้าย 2 ก.ย. จาก Tag Assistant ส่วน `generate_lead` (key event ใน GA4, จาก google/cpc 3 ครั้ง) ยังไม่ได้ import เข้า Ads
3. **ตารางเวลาโฆษณาจะเลื่อน 1 ชม. ตั้งแต่ 1 พ.ย.** เพราะ Pacific Time ออกจาก daylight saving (ไทย-PT ต่างกัน 14 ชม. เป็น 15 ชม.) ตารางเดิมจะกลายเป็นไทย 10:00-23:00 อยู่ในช่วง 1 เดือนที่ปล่อยเดินพอดี อีกเรื่อง: API แสดงช่วงเย็นจบที่ 23 (ไม่โชว์นาที) ควรเช็คใน UI ว่าเป็น 23:45 ตามที่ตั้งไว้
4. **ข้อความโฆษณาแคมเปญ 4 ที่ต้องเทียบกับ product-materials** (หาไฟล์นี้ไม่เจอใน repo และ Drive): "ผ้ากันเปื้อน", "หนังแท้พรีเมียม สะอาดง่าย", "ออกแบบเพื่อสรีระคนเอเชีย", callout "รับประกันโครงสร้าง 5 ปี", sitelink "ส่งออกกว่า 20 ประเทศ" ราคา "เริ่ม 19,900฿ (จาก 38,200฿)" ไม่มีวันหมดเขต ผ่านกฎ

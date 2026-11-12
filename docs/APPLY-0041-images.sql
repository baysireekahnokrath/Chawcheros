-- ============================================================================
-- ใส่รูปสินค้าจาก chawcher.com เข้า catalog.products
-- ============================================================================
-- ต้องรัน supabase/migrations/0041_product_images.sql ก่อน (เพิ่มช่อง image_url)
--
-- ที่มา: chawcher.com/wp-json/wp/v2/product · 102 สินค้า มีรูปหลักครบทุกตัว
-- จับคู่กับไฟล์ราคา 751 แถว ได้ 86 จาก 95 รุ่น ครอบคลุมสินค้า 721 ตัว (96%)
--   72 รุ่น ชื่อตรงกันเอง
--   14 รุ่น ชื่อบนเว็บต่างจากไฟล์ราคา จับมือ เช่น
--          อินทรี อาร์มแชร์ -> INSEE COZY CHAIR
--          เนส โซฟา        -> NEST LOVE SEAT
--          ทากะ อาร์มแชร์/ไม่มีแขน/1R -> TAKA SOFA (ใช้รูปเดียวกัน)
--    9 รุ่น ไม่มีรูปบนเว็บจริงๆ เป็นของเสริมทั้งหมด (ที่พักหัว หมอน ศาลเจ้า โต๊ะข้าง)
--
-- ตารางตรวจทานฉบับอ่านง่าย: docs/source/product-image-map.csv
-- รันซ้ำได้ ไม่เพิ่มแถว เพราะเป็น update ล้วน
-- ============================================================================

begin;

update catalog.products p
   set image_url    = v.url,
       image_source = v.page
  from (values
  ('กระตั้ว', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/kratua1-sofa-website-1.jpg', 'https://chawcher.com/product/kratua-sofa/'),
  ('กระทา', 'ตู้เก็บของ', 'https://chawcher.com/wp-content/uploads/2025/07/krata1-sideboard-website-1.jpg', 'https://chawcher.com/product/krata-sideboard/'),
  ('กระทา', 'เลาจ์แชร์', 'https://chawcher.com/wp-content/uploads/2025/07/krata2-cozychair-website-1.jpg', 'https://chawcher.com/product/krata-cozy-chair/'),
  ('กระทา', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/krata1-sofa-website-1.jpg', 'https://chawcher.com/product/phoenix-sofa-copy-copy/'),
  ('กระสา', 'ชั้นวางทีวี', 'https://chawcher.com/wp-content/uploads/2025/07/krasa1-walnut-tv-website.jpg', 'https://chawcher.com/product/krasa-tv-cabinet-walnut/'),
  ('กระสา', 'ตู้เก็บของ', 'https://chawcher.com/wp-content/uploads/2025/07/krasa-sideboard-website.jpg', 'https://chawcher.com/product/krasa-sideboard/'),
  ('กระสา', 'ม้านั่ง', 'https://chawcher.com/wp-content/uploads/2025/07/krasa1-chair-website-1.jpg', 'https://chawcher.com/product/krasa-bench/'),
  ('กระสา', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/krasa2-armchair-website-1.jpg', 'https://chawcher.com/product/krasa-armchair/'),
  ('กระสา', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/krasa1-sofa-website.jpg', 'https://chawcher.com/product/krasa-sofa/'),
  ('กระสา', 'โต๊ะทานข้าว', 'https://chawcher.com/wp-content/uploads/2025/07/krasa1-dining-table-website.jpg', 'https://chawcher.com/product/krasa-dining-table/'),
  ('กระเรียน', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/krarean1-stool-website.jpg', 'https://chawcher.com/product/krarean-stool/'),
  ('กระเรียน', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/krarean1-sofa-website.jpg', 'https://chawcher.com/product/krarean-sofa/'),
  ('กางเขน', 'ชั้นวางทีวี', 'https://chawcher.com/wp-content/uploads/2025/07/kangkaen1-tv-website.jpg', 'https://chawcher.com/product/kangkaen-tv-cabinet/'),
  ('กางเขน', 'ตู้เก็บของ', 'https://chawcher.com/wp-content/uploads/2025/07/kangkaen1-sideboard-website-1.jpg', 'https://chawcher.com/product/kangkaen-sideboard/'),
  ('กางเขน', 'เตียง', 'https://chawcher.com/wp-content/uploads/2025/07/kangkaen-bed.jpg', 'https://chawcher.com/product/kangkaen-bed/'),
  ('กีวี่', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/kiwi1-stool-website.jpg', 'https://chawcher.com/product/kiwi-stool/'),
  ('กีวี่', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/kiwi-walnut1-armchair-website-2.jpg', 'https://chawcher.com/product/kiwi-armchair-walnut/'),
  ('กีวี่', 'เก้าอี้', 'https://chawcher.com/wp-content/uploads/2025/07/kiwi2-walnut-chair-website-1.jpg', 'https://chawcher.com/product/kiwi-chair-walnut/'),
  ('กีวี่', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/kiwi-walnut1-sofa-website-1.jpg', 'https://chawcher.com/product/kiwi-sofa-walnut/'),
  ('ขมิ้น', 'ชั้นวางทีวี', 'https://chawcher.com/wp-content/uploads/2025/07/kamin1-oak-tv-website.jpg', 'https://chawcher.com/product/kamin-tv-cabinet-oak/'),
  ('ขมิ้น', 'ตู้เก็บของ', 'https://chawcher.com/wp-content/uploads/2025/07/kamin1-walnut-sideboard-website-1.jpg', 'https://chawcher.com/product/kamin-sideboard-walnut/'),
  ('ขมิ้น', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/kamin2-stool-website.jpg', 'https://chawcher.com/product/kamin-stool/'),
  ('ขมิ้น', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/kamin1-sofa-website-1.jpg', 'https://chawcher.com/product/kamin-sofa/'),
  ('ขอนไม้', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/khonmai1-stool-website.jpg', 'https://chawcher.com/product/khonmai-stool/'),
  ('ขุนทอง', 'ชั้นวางทีวี', 'https://chawcher.com/wp-content/uploads/2025/07/koontong1-walnut-tv-website.jpg', 'https://chawcher.com/product/koontong-tv-cabinet-walnut/'),
  ('ขุนทอง', 'ตู้เก็บของ', 'https://chawcher.com/wp-content/uploads/2025/07/koontong1-walnut-sideboardw160-website-1.jpg', 'https://chawcher.com/product/koontong-sideboard-walnut-2/'),
  ('ขุนทอง', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/koontong1-stool-website.jpg', 'https://chawcher.com/product/koontong-stool/'),
  ('ขุนทอง', 'เก้าอี้', 'https://chawcher.com/wp-content/uploads/2025/07/koontong2-chair-website-1.jpg', 'https://chawcher.com/product/koontong-chair/'),
  ('ขุนทอง', 'เตียง', 'https://chawcher.com/wp-content/uploads/2025/07/koontong-bed.jpg', 'https://chawcher.com/product/koontong-bed/'),
  ('ขุนทอง', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/koontong-1-sofa-website.jpg', 'https://chawcher.com/product/koontong-sofa-2/'),
  ('ดิน', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/din1-stool-website.jpg', 'https://chawcher.com/product/din-stool/'),
  ('ทากะ', '1 ที่นั่ง 1 แขน', 'https://chawcher.com/wp-content/uploads/2025/07/taka1-sofa-website-1.jpg', 'https://chawcher.com/product/taka-sofa/'),
  ('ทากะ', '1 ที่นั่ง ไม่มีแขน', 'https://chawcher.com/wp-content/uploads/2025/07/taka1-sofa-website-1.jpg', 'https://chawcher.com/product/taka-sofa/'),
  ('ทากะ', '3 ที่นั่ง ไม่มีแขน', 'https://chawcher.com/wp-content/uploads/2025/07/taka1-sofa-website-1.jpg', 'https://chawcher.com/product/taka-sofa/'),
  ('ทากะ', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/taka1-stool-website.jpg', 'https://chawcher.com/product/taka-stool/'),
  ('ทากะ', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/taka1-sofa-website-1.jpg', 'https://chawcher.com/product/taka-sofa/'),
  ('ทากะ', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/taka1-sofa-website-1.jpg', 'https://chawcher.com/product/taka-sofa/'),
  ('นกยูง', 'เตียง', 'https://chawcher.com/wp-content/uploads/2025/07/nokyoong-bed.jpg', 'https://chawcher.com/product/nokyoong-bed/'),
  ('นกยูง', 'โต๊ะกลาง', 'https://chawcher.com/wp-content/uploads/2025/07/nookyoong-coffee-table-website.jpg', 'https://chawcher.com/product/nokyoong-coffee-table/'),
  ('นกยูง', 'โต๊ะทานข้าว', 'https://chawcher.com/wp-content/uploads/2025/07/nookyoong-dining-table-website.jpg', 'https://chawcher.com/product/nokyoong-dining-table/'),
  ('นกแก้ว', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/nokkaew1-stool-website.jpg', 'https://chawcher.com/product/nokkaew-stool/'),
  ('นกแก้ว', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/nokkaew1-armchair-website-1.jpg', 'https://chawcher.com/product/mininest-armchair-2/'),
  ('นกแก้ว', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/nokkeaw1-sofa-website-1.jpg', 'https://chawcher.com/product/nokkaew-sofa/'),
  ('นางนวล', 'ม้านั่ง', 'https://chawcher.com/wp-content/uploads/2025/07/nangnuan1-chair-website-1.jpg', 'https://chawcher.com/product/nangnuan-bench/'),
  ('นางนวล', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/nangnuan1-sofa-website.jpg', 'https://chawcher.com/product/nangnaun-sofa/'),
  ('นางนวล', 'โต๊ะกลาง', 'https://chawcher.com/wp-content/uploads/2025/07/nangnuan1-table-website.jpg', 'https://chawcher.com/product/nangnuan-coffee-table/'),
  ('นางนวล', 'โต๊ะข้าง', 'https://chawcher.com/wp-content/uploads/2025/07/nangnuan-side-table-website.jpg', 'https://chawcher.com/product/nangnuan-side-table/'),
  ('นางนวล', 'โต๊ะทานข้าว', 'https://chawcher.com/wp-content/uploads/2025/07/nangnuan-dining-table-website.jpg', 'https://chawcher.com/product/nangnuan-dining-table/'),
  ('นางนวล / กระสา', 'โต๊ะทานข้าว', 'https://chawcher.com/wp-content/uploads/2025/07/nangnuan-dining-table-website.jpg', 'https://chawcher.com/product/nangnuan-dining-table/'),
  ('นางแอ่น', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/nangaan2-armchair-website-3.jpg', 'https://chawcher.com/product/nangaaen-armchair/'),
  ('นางแอ่น', 'เตียง', 'https://chawcher.com/wp-content/uploads/2025/07/nangaaen.jpg', 'https://chawcher.com/product/nangaaen-bed/'),
  ('นางแอ่น', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/nangaaen1-sofa-website-1.jpg', 'https://chawcher.com/product/nangaaen-sofa/'),
  ('พัฟฟิน', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/puffin1-stool-website.jpg', 'https://chawcher.com/product/puffin-stool/'),
  ('พัฟฟิน', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/puffin1-sofa-website-2.jpg', 'https://chawcher.com/product/puffin-sofa/'),
  ('พัฟฟิน', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/puffin1-sofa-website-2.jpg', 'https://chawcher.com/product/puffin-sofa/'),
  ('ฟลามิงโก', 'ตู้เก็บของ', 'https://chawcher.com/wp-content/uploads/2025/07/flamingo1-walnut-sideboard-website.jpg', 'https://chawcher.com/product/flamingo-sideboard-walnut/'),
  ('ฟลามิงโก้', 'Recliner', 'https://chawcher.com/wp-content/uploads/2025/07/flamingo-recliner3-cozychair-website-1.jpg', 'https://chawcher.com/product/flamingo-recliner/'),
  ('ฟีนิกซ์', 'ตู้เก็บของ', 'https://chawcher.com/wp-content/uploads/2025/07/phoenix1-sideboard-website.jpg', 'https://chawcher.com/product/phoenix-sideboard/'),
  ('ฟีนิกซ์', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/phoenix1-stool-website.jpg', 'https://chawcher.com/product/phoenix-stool/'),
  ('ฟีนิกซ์', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/phoenix1-sofa-website.jpg', 'https://chawcher.com/product/phoenix-sofa/'),
  ('ฟีนิกซ์', 'โต๊ะกลาง', 'https://chawcher.com/wp-content/uploads/2025/07/phoenix1-coffee-table-website.jpg', 'https://chawcher.com/product/phoenix-coffee-table/'),
  ('มินิเนส', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/mininest2-armchair-website-3.jpg', 'https://chawcher.com/product/mininest-armchair/'),
  ('สวอน', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/swan1-stool-website-1.jpg', 'https://chawcher.com/product/swan-stool/'),
  ('สวอน', 'เก้าอี้', 'https://chawcher.com/wp-content/uploads/2025/07/swan1-chair-website-1.jpg', 'https://chawcher.com/product/swan-chair/'),
  ('สวอน', 'เลาจ์แชร์', 'https://chawcher.com/wp-content/uploads/2025/07/swan1-cozychair-website-1.jpg', 'https://chawcher.com/product/swan-cozy-chair/'),
  ('สวอน', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/swan1-sofa-website-1.jpg', 'https://chawcher.com/product/swan-sofa/'),
  ('สวอน', 'โต๊ะกลาง', 'https://chawcher.com/wp-content/uploads/2025/07/swan-coffee-table-website-1.jpg', 'https://chawcher.com/product/swan-coffee-table/'),
  ('สวอน', 'โต๊ะข้างเตียง', 'https://chawcher.com/wp-content/uploads/2025/07/swan-side-table-website.jpg', 'https://chawcher.com/product/swan-side-table/'),
  ('สวอน', 'โต๊ะทานข้าว', 'https://chawcher.com/wp-content/uploads/2025/07/swan-dining-table-website-1.jpg', 'https://chawcher.com/product/swan-dining-table/'),
  ('อัญชัน', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/aunchan1-stool-website.jpg', 'https://chawcher.com/product/aunchan-stool/'),
  ('อัญชัน', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/aunchan1-armchair-website-1.jpg', 'https://chawcher.com/product/aunchan-armchair/'),
  ('อินทรี', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/insee1-stool-website.jpg', 'https://chawcher.com/product/insee-stool/'),
  ('อินทรี', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/insee1-cozychair-website-1.jpg', 'https://chawcher.com/product/insee-cozy-chair/'),
  ('อินทรี', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/insee2-sofa-website-1.jpg', 'https://chawcher.com/product/insee-sofa/'),
  ('อีมู', 'สตูล', 'https://chawcher.com/wp-content/uploads/2025/07/emu1-stool-website.jpg', 'https://chawcher.com/product/emu-stool/'),
  ('อีมู', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/emu1-armchair-website-1.jpg', 'https://chawcher.com/product/emu-armchair/'),
  ('อีมู', 'เก้าอี้', 'https://chawcher.com/wp-content/uploads/2025/07/emu3-walnut-chair-website-1.jpg', 'https://chawcher.com/product/emu-chair-walnut/'),
  ('อีมู', 'เตียง', 'https://chawcher.com/wp-content/uploads/2025/07/emu-bed.jpg', 'https://chawcher.com/product/emu-bed/'),
  ('อีมู', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/emu1-sofa-website-1.jpg', 'https://chawcher.com/product/emu-sofa/'),
  ('ฮูก', 'อาร์มแชร์', 'https://chawcher.com/wp-content/uploads/2025/07/hook1-armchair-website-1.jpg', 'https://chawcher.com/product/hook-armchair/'),
  ('ฮูก', 'โคซี่แชร์', 'https://chawcher.com/wp-content/uploads/2025/07/hook1-cozychair-website-1.jpg', 'https://chawcher.com/product/hook-cozy-chair/'),
  ('ฮูก', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/hook1-sofa-website-1.jpg', 'https://chawcher.com/product/hook-sofa/'),
  ('เนส', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/nest2-loveseat-website-1.jpg', 'https://chawcher.com/product/nest-love-seat/'),
  ('เบิร์ด', 'ชั้นวางหนังสือ', 'https://chawcher.com/wp-content/uploads/2025/07/shelf-walnut.jpg', 'https://chawcher.com/product/bird-bookshelf-walnut/'),
  ('โอบ', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/oab1-sofa-website.jpg', 'https://chawcher.com/product/oab-sofa/'),
  ('โอมุ', 'โซฟา', 'https://chawcher.com/wp-content/uploads/2025/07/omu1-sofa-website-1.jpg', 'https://chawcher.com/product/omu-sofa/')
  ) as v(collection, category_name, url, page)
  join catalog.categories c on c.name = v.category_name
 where p.collection = v.collection
   and p.category_id = c.id;

commit;

-- ตรวจผล
select count(*) filter (where image_url is not null) as "รุ่นที่มีรูป",
       count(*) filter (where image_url is null)     as "รุ่นที่ยังไม่มีรูป",
       count(*)                                      as "รุ่นทั้งหมด"
from catalog.products;

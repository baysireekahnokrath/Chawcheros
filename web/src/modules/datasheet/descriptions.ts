/**
 * คำอธิบายและลิงก์หน้าสินค้า ดึงมาจาก chawcher.com ครั้งเดียว
 *
 * ทำไมเก็บเป็นไฟล์ ไม่ยิงเว็บสด
 *   ข้อความพวกนี้เปลี่ยนปีละครั้งสองครั้ง แต่หน้า data sheet เปิดทุกวัน
 *   ยิงสดแปลว่าเว็บล่มเมื่อไหร่ หน้านี้พังตาม และช้าลงโดยไม่ได้อะไรเพิ่ม
 *
 * ข้อความผ่านการตัดบรรทัดขนาด หัวข้อตัวพิมพ์ใหญ่ และเครื่องหมาย ** ของ markdown ออกแล้ว
 * รุ่นที่มีหลายหน้าสินค้าแต่เนื้อหาซ้ำกัน เก็บไว้ที่หมวดที่มีสินค้ามากที่สุดหมวดเดียว
 *
 * key คือ "ชื่อคอลเลกชัน|ชื่อหมวด" ตรงกับที่ใบราคาใช้
 * ไม่มี text = เว็บมีแต่บรรทัดขนาด ยังไม่มีข้อความขายของ
 *
 * ★ ไฟล์นี้สร้างด้วย docs/tools/build-datasheets.py อย่าแก้ด้วยมือ
 */
export type WebSpec = { link: string; title: string; text?: string };

export const WEB_SPECS: Record<string, WebSpec> = {
  "กระตั้ว|โซฟา": {
    "link": "https://chawcher.com/product/kratua-sofa/",
    "title": "KRATUA SOFA"
  },
  "กระทา|ตู้เก็บของ": {
    "link": "https://chawcher.com/product/krata-sideboard/",
    "title": "KRATA SIDEBOARD"
  },
  "กระทา|เลาจ์แชร์": {
    "link": "https://chawcher.com/product/krata-cozy-chair/",
    "title": "KRATA COZY CHAIR",
    "text": "Krata Cozy Chair เป็น cozy chair ที่ออกแบบมาให้มีรูปทรงกะทัดรัดมีเส้นสายที่โค้งมนเบาบาง\nมีเสน่ห์ ที่น่าหลงไหลด้วยความโค้งมนนี้แสดงถึงความปราณีตในการผลิต"
  },
  "กระทา|โซฟา": {
    "link": "https://chawcher.com/product/phoenix-sofa-copy-copy/",
    "title": "KRATA SOFA"
  },
  "กระสา|ชั้นวางทีวี": {
    "link": "https://chawcher.com/product/krasa-tv-cabinet-walnut/",
    "title": "KRASA TV CABINET (WALNUT)",
    "text": "สินค้าต้องประกอบขาด้วยตนเอง โดยมีคู่มือและอุปกรณ์ให้ในกล่อง\nออกแบบโดยดีไซเนอร์ญี่ปุ่น มีความนุ่มนวลตามแบบฉบับญี่ปุ่น แต่แฝงไปด้วยเทคนิค และการประกอบที่ใส่ใจในทุกรายละเอียด\n– ออกแบบให้สามารถวางเครื่องเล่นเกมส์ / Andriod Box / Truevision ไว้ในช่องกลางได้ ทั้งนี้ยังะสามารถกด remote ทะลุได้ เพราะการออกแบบที่มีการเว้นช่องว่างไว้\n– หน้าบานเป็น Solid Oak มีกระจกกันฝุ่น\n– Top ด้านบนออกแบบให้ยื่นออกไปข้างหลังประมาณ 2.5 เซ็นติเมตร เพื่อการวางติดกำแพงได้โดยไม่ติดบัวพื้นด้านล่าง\n– ความปลอดภัยจากการใช้วัสดุที่ปลอดสารฟอร์มาลดีไฮด์ระดับ F (เอฟ โฟ สตาร์) ซึ่งเป็นมาตรฐานของญี่ปุ่นที่ใช้ในการผลิตสินค้าประเภทเฟอร์นิเจอร์\n– เก๊ะเป็นไม้คิริซึ่งเป็นวัสดุที่ญี่ปุ่นนิยมทำตู้เก็บกิโมโนเนื่องจากคุณสมบัติของการทนความชื้น"
  },
  "กระสา|ตู้เก็บของ": {
    "link": "https://chawcher.com/product/krasa-sideboard/",
    "title": "KRASA SIDEBOARD"
  },
  "กระสา|ม้านั่ง": {
    "link": "https://chawcher.com/product/krasa-bench/",
    "title": "KRASA BENCH"
  },
  "กระสา|อาร์มแชร์": {
    "link": "https://chawcher.com/product/krasa-armchair/",
    "title": "KRASA ARMCHAIR"
  },
  "กระสา|โซฟา": {
    "link": "https://chawcher.com/product/krasa-sofa/",
    "title": "KRASA SOFA"
  },
  "กระสา|โต๊ะทานข้าว": {
    "link": "https://chawcher.com/product/krasa-dining-table/",
    "title": "KRASA DINING TABLE"
  },
  "กระเรียน|สตูล": {
    "link": "https://chawcher.com/product/krarean-stool/",
    "title": "KRAREAN STOOL",
    "text": "ด้วยสไตล์ที่โดดเด่นไม่เหมือนใคร"
  },
  "กระเรียน|โซฟา": {
    "link": "https://chawcher.com/product/krarean-sofa/",
    "title": "KRAREAN SOFA",
    "text": "1.โซฟา 3-ที่นั่ง ประกอบด้วยหมอนอิง 5 ใบ\n2.โครงผลิตจากไม้เนื้อแข็ง แข็งแรงทนทาน"
  },
  "กางเขน|ชั้นวางทีวี": {
    "link": "https://chawcher.com/product/kangkaen-tv-cabinet/",
    "title": "KANGKAEN TV CABINET",
    "text": "สินค้าต้องประกอบด้วยตนเอง โดยมีอุปกรณ์ให้ในกล่อง\nKANG KAEN TV Cabinet เรียบง่ายทั้งภายในและภายนอกไม่ใช่เฉพาะรูปทรงที่ดูเรียบง่ายเท่านั้น ผู้ใช้งานก็จะมีชีวิตที่เรียบง่ายขึ้นเพราะสินค้าชิ้นนี้สามารถเก็บอุปกรณ์การดูทีวีของคุณเข้าไปไว้ในช่องกระจกและเก็บสายทั้งหมดไว้ด้านหลัง ส่วนลิ้นชักก็ยังมี organizer จัดการให้การเก็บของเป็นระเบียบอีกด้วย นอกจากการออกแบบการใช้งานที่ทำให้ชีวิตคุณเรียบง่ายแล้ว ความปลอดภัยจากการใช้วัสดุที่ปลอดภัยระดับ F4 STARS ก็เป็นมาตรฐานของญี่ปุ่นที่ใช้ในการผลิตสินค้าทั้ง collection นี้อีกด้วย (F4stars คือมาตรฐานการใช้สารเคมีที่น้อยที่สุดในโลกตอนนี้ น้อยกว่า E0 ซึ่งเป็นมาตรฐานที่ดีที่สุดของยุโรป)"
  },
  "กางเขน|ตู้เก็บของ": {
    "link": "https://chawcher.com/product/kangkaen-sideboard/",
    "title": "KANGKAEN SIDEBOARD",
    "text": "สินค้าต้องประกอบด้วยตนเอง โดยมีอุปกรณ์ให้ในกล่อง\nKANGKAEN SIDEBOARD เรียบง่ายทั้งภายใน และภายนอก ไม่ใช่เฉพาะรูปทรงที่ดูเรียบง่ายเท่านั้น ผู้ใช้งานก็จะมีชีวิตที่เรียบง่ายขึ้น\nนอกจากการออกแบบการใช้งานที่ทำให้ชีวิตคุณเรียบง่ายแล้ว ความปลอดภัยจากการใช้วัสดุที่ปลอดภัยระดับ F ก็เป็นมาตรฐานของญี่ปุ่นที่ใช้ในการผลิตสินค้าทั้ง collection นี้อีกด้วย (F4stars คือมาตรฐานการใช้สารเคมีที่น้อยที่สุดในโลกตอนนี้ น้อยกว่า E0 ซึ่งเป็นมาตรฐานที่ดีที่สุดของยุโรป)"
  },
  "กางเขน|เตียง": {
    "link": "https://chawcher.com/product/kangkaen-bed/",
    "title": "KANGKAEN BED",
    "text": "เตียงไม้โอ๊คฐานเตี้ยสไตล์ญีปุ่น ฐานทึบติดพื้นทำให้ฝุ่นไม่ไปสะสมใต้เตียง\nความปลอดภัยจากการใช้วัสดุที่ปลอดภัยระดับ F มีขนาด 5ฟุตและ 6ฟุต"
  },
  "กีวี่|สตูล": {
    "link": "https://chawcher.com/product/kiwi-stool/",
    "title": "KIWI STOOL"
  },
  "กีวี่|อาร์มแชร์": {
    "link": "https://chawcher.com/product/kiwi-armchair-walnut/",
    "title": "KIWI ARMCHAIR (WALNUT)",
    "text": "โซฟาไม้ที่ขายดีที่สุดออกแบบโดยคำนึงถึงผู้ใช้เป็นหลัก เบาะนั่งและเบาะพิงมีส่วนผสมของขนเป็ดเพื่อการนั่งที่ผ่อนคลาย องศาของเบาะนั่งและพนักพิงได้ทำการทดสอบจนได้องศาที่นั่งสบายที่สุด โครงสร้างโปร่งเพื่อให้อากาศถ่ายเทไม่เกิดการสะสมของแบคทีเรีย"
  },
  "กีวี่|เก้าอี้": {
    "link": "https://chawcher.com/product/kiwi-chair-walnut/",
    "title": "KIWI CHAIR (WALNUT)",
    "text": "สินค้า: เก้าอี้ กีวี่\nออกแบบโดยดีไซเนอร์ญี่ปุ่น มีความนุ่มนวลตามแบบฉบับญี่ปุ่น แต่แฝงไปด้วยเทคนิค และการประกอบที่ใส่ใจในทุกรายละเอียด\nเทคนิคการเข้าไม้แบบญี่ปุ่นแท้ๆ ใช้ไม้น้อย แต่แข็งแรง\nเบาะออกแบบให้สามารถเปลี่ยน cover ได้ง่ายๆ สะดวกในการทำความสะอาด และด้านในเป็น PVC กันน้ำอีก 1 ชั้น\nการออกแบบองศาพนักพิงด้วยเทคนิคไม้ดัดทำเป็นโค้งรับหลังที่ให้ความรู้สึกสบายทุกครั้งที่ได้นั่ง\nใส่ใจในเรื่อง Eco Friendly ผ่านขบวนการ Waste Management (การควบคุมการสูญเสีย) ได้แก่การวางแผนการผลิตให้มีการสูญเสียไม้ให้น้อยที่สุด ทั้งนี้ส่วนที่สูญเสียจะนำกลับไป recycle เพื่อเอามาทำเป็นส่วนประกอบอื่นๆในรุ่นอื่นๆได้ด้วย อีกทั้งจะงดใช้สารเคมีที่เป็นอันตรายต่อผู้ใช้งาน ผู้ผลิตสินค้า รวมถึงธรรมชาติอีกด้วย"
  },
  "กีวี่|โซฟา": {
    "link": "https://chawcher.com/product/kiwi-sofa-walnut/",
    "title": "KIWI SOFA (WALNUT)",
    "text": "น้ำหนักโดยรวม 35 kg\nออกแบบโดยคำนึงถึงผู้ใช้เป็นหลัก เบาะนั่งและเบาะพิงมีส่วนผสมของขนเป็ดเพื่อการนั่งที่สบาย องศาเบาะและพนักพิงได้ทำการทดสอบจนได้องศาที่นั่งสบายที่สุด ผ้าหุ้มเบาะสามารถถอดซักได้เพื่อสุขภาพที่ดีของผู้ใช้ โครงสร้างโปร่งเพื่อให้อากาศถ่ายเทไม่เกิดการสะสมของแบคทีเรีย\n– ออกแบบโดยดีไซเนอร์ญี่ปุ่น มีความนุ่มนวลตามแบบฉบับญี่ปุ่น แต่แฝงไปด้วยเทคนิค และการประกอบที่ใส่ใจในทุกรายละเอียด\n– เบาะ และพนักพิงสามารถถอดซักได้\n– เบาะ และพนักพิง เป็นฟองน้ำ 1 ชั้น และเป็นขนเป็ดอีก 1 ชั้น\n– โครงสร้างเป็นไม้โอ๊คแท้ที่อบแห้งและเคลือบน้ำมันมาเป็นอย่างดี\n– ใต้เบาะเป็นตะแกรงไนลอนทำให้อากาศถ่ายเทสะดวกจึงทำให้ผู้ใช้งานไม่ร้อน\n– สินค้าจากโรงงานญี่ปุ่นซึ่งมีความใส่ใจในเรื่อง Eco Friendly ผ่านขบวนการ Waste Management (การควบคุมการสูญเสีย) ได้แก่การวางแผนการผลิตให้มีการสูญเสียไม้ให้น้อยที่สุด ทั้งนี้ส่วนที่สูญเสียจะนำกลับไป recycle เพื่อเอามาทำเป็นส่วนประกอบอื่นๆในรุ่นอื่นๆได้ด้วย อีกทั้งจะงดใช้สารเคมีที่เป็นอันตรายต่อผู้ใช้งาน ผู้ผลิตสินค้า รวมถึงธรรมชาติอีกด้วย"
  },
  "ขมิ้น|ชั้นวางทีวี": {
    "link": "https://chawcher.com/product/kamin-tv-cabinet-oak/",
    "title": "KAMIN TV CABINET (OAK)",
    "text": "สินค้าต้องประกอบขาด้วยตนเอง โดยมีคู่มือและอุปกรณ์ให้ในกล่อง\nออกแบบโดยดีไซเนอร์ญี่ปุ่น มีความนุ่มนวลตามแบบฉบับญี่ปุ่น แต่แฝงไปด้วยเทคนิค และการประกอบที่ใส่ใจในทุกรายละเอียด\n– ออกแบบให้สามารถวางเครื่องเล่นเกมส์ / Andriod Box / Truevision ไว้ในช่องกลางได้ ทั้งนี้ยังสามารถกด remote ทะลุได้ เพราะการออกแบบที่มีการเว้นช่องว่างไว้\n– หน้าบานเป็น Solid Oak\n– Top ด้านบนออกแบบให้ยื่นออกไปข้างหลังประมาณ 2.5 เซ็นติเมตร เพื่อการวางติดกำแพงได้โดยไม่ติดบัวพื้นด้านล่าง\n– ความปลอดภัยจากการใช้วัสดุที่ปลอดสารฟอร์มาลดีไฮด์ระดับ F (เอฟ โฟ สตาร์) ซึ่งเป็นมาตรฐานของญี่ปุ่นที่ใช้ในการผลิตสินค้าประเภทเฟอร์นิเจอร์\n– เก๊ะเป็นไม้คิริซึ่งเป็นวัสดุที่ญี่ปุ่นนิยมทำตู้เก็บกิโมโนเนื่องจากคุณสมบัติของการทนความชื้น"
  },
  "ขมิ้น|ตู้เก็บของ": {
    "link": "https://chawcher.com/product/kamin-sideboard-walnut/",
    "title": "KAMIN SIDEBOARD (WALNUT)"
  },
  "ขมิ้น|สตูล": {
    "link": "https://chawcher.com/product/kamin-stool/",
    "title": "KAMIN STOOL"
  },
  "ขมิ้น|โซฟา": {
    "link": "https://chawcher.com/product/kamin-sofa/",
    "title": "KAMIN SOFA",
    "text": "ตารางสเปกและราคาสำหรับการสั่งผลิตมาตรฐาน (Made-to-Order)\nประเภทวัสดุหุ้ม (เลือกสีได้)\nขนาดสินค้า (กว้าง x ลึก x สูง)\nราคาปกติ (บาท)\nราคาพิเศษส่วนลด 25% (บาท)\nผ้า A\n54,400\n40,800\nผ้า A\n65,300\n48,975\nผ้า B\n62,000\n46,500\nผ้า B\n75,000\n56,250\nผ้า C\n68,125\n51,093.75\nผ้า C\n81,625\n61,218.75\nหนังแท้\n85,100\n63,825\nหนังแท้\n98,400\n73,800"
  },
  "ขอนไม้|สตูล": {
    "link": "https://chawcher.com/product/khonmai-stool/",
    "title": "KHONMAI STOOL",
    "text": "Stool ที่เป็นได้มากกว่าสตูล ไม่ว่าจะใช้ต่อกับโซฟาเพื่อทำให้ได้ที่นั่งเพิ่มมากขึ้น\nหรือจะใช้เป็นที่วางเท้าในวันสบายๆ ก็สามารถปรับเปลี่ยนได้กับทุกความต้องการของคุณ"
  },
  "ขุนทอง|ชั้นวางทีวี": {
    "link": "https://chawcher.com/product/koontong-tv-cabinet-walnut/",
    "title": "KOONTONG TV CABINET (WALNUT)",
    "text": "สินค้าต้องประกอบขาด้วยตนเอง โดยมีคู่มือและอุปกรณ์ให้ในกล่อง\nออกแบบโดยดีไซเนอร์ญี่ปุ่น มีความนุ่มนวลตามแบบฉบับญี่ปุ่น แต่แฝงไปด้วยเทคนิค และการประกอบที่ใส่ใจในทุกรายละเอียด\n– ออกแบบให้สามารถวางเครื่องเล่นเกมส์ / Andriod Box / Truevision ไว้ในช่องกลางได้ ทั้งนี้ยังสามารถกด remote ทะลุได้ เพราะการออกแบบที่มีการเว้นช่องว่างไว้\n– หน้าบานเป็น Solid Oak\n– Top ด้านบนออกแบบให้ยื่นออกไปข้างหลังประมาณ 2.5 เซ็นติเมตร เพื่อการวางติดกำแพงได้โดยไม่ติดบัวพื้นด้านล่าง\n– ความปลอดภัยจากการใช้วัสดุที่ปลอดสารฟอร์มาลดีไฮด์ระดับ F (เอฟ โฟ สตาร์) ซึ่งเป็นมาตรฐานของญี่ปุ่นที่ใช้ในการผลิตสินค้าประเภทเฟอร์นิเจอร์\n– เก๊ะเป็นไม้คิริซึ่งเป็นวัสดุที่ญี่ปุ่นนิยมทำตู้เก็บกิโมโนเนื่องจากคุณสมบัติของการทนความชื้น"
  },
  "ขุนทอง|ตู้เก็บของ": {
    "link": "https://chawcher.com/product/koontong-sideboard-walnut-2/",
    "title": "KOONTONG SIDEBOARD (WALNUT)",
    "text": "สินค้าต้องประกอบได้ด้วยตนเอง โดยมีคู่มือและอุปกรณ์ให้ในกล่อง\nออกแบบโดยดีไซน์เนอร์ญี่ปุ่น มีความนุ่มนวลตามแบบฉบับญี่ปุ่น แต่แฝงไปด้วยเทคนิค และการประกอบที่ใส่ใจในทุกรายละเอียด\n– หน้าบานเป็น Solid Oak\n– Top ออกแบบให้ยื่นออกไปข้างหลังประมาณ 2.5 เซ็นติเมตร เพื่อการวางติดกำแพงได้โดยไม่ติดบัวพื้นด้านล่าง\n– ความปลอดภัยจากการใช้วัสดุที่ปลอดสารฟอร์มาลดีไฮด์ระดับ F (เอฟ โฟ สตาร์) ซึ่งเป็นมาตรฐานของญี่ปุ่นที่ใช้ในการผลิตสินค้าประเภทเฟอร์นิเจอร์\n– เก๊ะเป็นไม้คิริซึ่งเป็นวัสดุที่ญี่ปุ่นนิยมทำตู้เก็บกิโมโนเนื่องจากคุณสมบัติของการทนความชื้น"
  },
  "ขุนทอง|สตูล": {
    "link": "https://chawcher.com/product/koontong-stool/",
    "title": "KOONTONG STOOL"
  },
  "ขุนทอง|เก้าอี้": {
    "link": "https://chawcher.com/product/koontong-chair/",
    "title": "KOONTONG CHAIR"
  },
  "ขุนทอง|เตียง": {
    "link": "https://chawcher.com/product/koontong-bed/",
    "title": "KOONTONG BED",
    "text": "1.โครงสร้างแข็งแรงทนทานภายในทำด้วยไม้\n2.หัวเตียงและขอบเตียงหุ้มด้วยวัสดุซึ่งปลอดภัยต่อการใช้งาน เพื่อให้พื้นผิวที่นุ่มนวล"
  },
  "ขุนทอง|โซฟา": {
    "link": "https://chawcher.com/product/koontong-sofa-2/",
    "title": "KOONTONG SOFA",
    "text": "ใช้วัสดุทีคงทนอย่าง pocket spring ทำให้ปัญหาเรื่องการยุบตัวของโซฟาเกิดขึ้นได้ยากขึ้น\nใช้วัสดุที่ Premium ที่สุดสำหรับโซฟาคือ ขนห่าน ทำให้ความรู้สึกของการนั่งโซฟาขุนทองนุ่มในระดับเดียวกับโซฟาระดับโลก"
  },
  "ดิน|สตูล": {
    "link": "https://chawcher.com/product/din-stool/",
    "title": "DIN STOOL",
    "text": "เบาะรองนั่งที่นั่งสบายที่สุด"
  },
  "ทากะ|1 ที่นั่ง 1 แขน": {
    "link": "https://chawcher.com/product/taka-sofa/",
    "title": "TAKA SOFA"
  },
  "ทากะ|1 ที่นั่ง ไม่มีแขน": {
    "link": "https://chawcher.com/product/taka-sofa/",
    "title": "TAKA SOFA"
  },
  "ทากะ|3 ที่นั่ง ไม่มีแขน": {
    "link": "https://chawcher.com/product/taka-sofa/",
    "title": "TAKA SOFA"
  },
  "ทากะ|สตูล": {
    "link": "https://chawcher.com/product/taka-stool/",
    "title": "TAKA STOOL"
  },
  "ทากะ|อาร์มแชร์": {
    "link": "https://chawcher.com/product/taka-sofa/",
    "title": "TAKA SOFA"
  },
  "ทากะ|โซฟา": {
    "link": "https://chawcher.com/product/taka-sofa/",
    "title": "TAKA SOFA"
  },
  "นกยูง|เตียง": {
    "link": "https://chawcher.com/product/nokyoong-bed/",
    "title": "NOKYOONG BED",
    "text": "ขาเตียงยกสูง ทำความสะอาดได้ง่ายความสูงฐานเตียงสามารถปรับระดับได้\nเพื่อให้เหมาะกับสัดส่วนของลูกค้า ขนาดไม่ใหญ่มาก ทำให้ห้องดูโปร่งสบาย"
  },
  "นกยูง|โต๊ะกลาง": {
    "link": "https://chawcher.com/product/nokyoong-coffee-table/",
    "title": "NOKYOONG COFFEE TABLE"
  },
  "นกยูง|โต๊ะทานข้าว": {
    "link": "https://chawcher.com/product/nokyoong-dining-table/",
    "title": "NOKYOONG DINING TABLE",
    "text": "โต๊ะ นกยูง ผลิตด้วยเทคโนโลยีชั้นสูงของ ญี่ปุ่น"
  },
  "นกแก้ว|สตูล": {
    "link": "https://chawcher.com/product/nokkaew-stool/",
    "title": "NOKKAEW STOOL"
  },
  "นกแก้ว|อาร์มแชร์": {
    "link": "https://chawcher.com/product/mininest-armchair-2/",
    "title": "NOKKAEW ARMCHAIR"
  },
  "นกแก้ว|โซฟา": {
    "link": "https://chawcher.com/product/nokkaew-sofa/",
    "title": "NOKKAEW SOFA",
    "text": "เบาะนั่ง S-Sprin\nเบาะนั่งลึกเหมาะกับคนที่ชอบนั่งแบบ Relax\nมีความสวยงามทนทาน"
  },
  "นางนวล|ม้านั่ง": {
    "link": "https://chawcher.com/product/nangnuan-bench/",
    "title": "NANGNUAN BENCH",
    "text": "Top ไม้สังเคราะห์ทำสี เพื่อความพิเศษและธรรมชาติ\nดู Unique ไม่เหมือนใคร\nขาเป็นไม้โอ๊คสีเข้ม\nมาพร้อมกับความเรียบ สบายตา เข้าได้กับทุกบ้าน\nแข็งแรงและทนทานต่อการใช้งาน\n1.ไม้โอ๊คจริงทุกส่วน\n2.แข็งแรงและทนทานต่อการใช้งาน"
  },
  "นางนวล|โซฟา": {
    "link": "https://chawcher.com/product/nangnaun-sofa/",
    "title": "NANGNUAN SOFA"
  },
  "นางนวล|โต๊ะกลาง": {
    "link": "https://chawcher.com/product/nangnuan-coffee-table/",
    "title": "NANGNUAN COFFEE TABLE"
  },
  "นางนวล|โต๊ะข้าง": {
    "link": "https://chawcher.com/product/nangnuan-side-table/",
    "title": "NANGNUAN SIDE TABLE"
  },
  "นางนวล|โต๊ะทานข้าว": {
    "link": "https://chawcher.com/product/nangnuan-dining-table/",
    "title": "NANGNUAN DINING TABLE"
  },
  "นางนวล / กระสา|โต๊ะทานข้าว": {
    "link": "https://chawcher.com/product/nangnuan-dining-table/",
    "title": "NANGNUAN DINING TABLE"
  },
  "นางแอ่น|อาร์มแชร์": {
    "link": "https://chawcher.com/product/nangaaen-armchair/",
    "title": "NANGAAEN ARMCHAIR"
  },
  "นางแอ่น|เตียง": {
    "link": "https://chawcher.com/product/nangaaen-bed/",
    "title": "NANGAAEN BED",
    "text": "เตียงนางแอ่น เป็นเตียงที่ได้รับความนิยมสูงมาก เนื่องจากยกฐานสูงพอดีกับเมื่อวางฟูกแล้วทำให้ลุกนั่งสะดวก ทั้งยังทำความสะอาดใต้เตียงได้ง่าย\nการผลิตที่เนี๊ยบระดับผู้ผลิตจากญี่ปุ่น ที่ผ่านการส่งต่อกันมาถึงรุ่นที่ 3 โครงไม้นำเข้าสำเร็จรูป ผ่านการผลิตจากเครื่องจักรทำให้ได้มาตรฐานเหมือนกันทุกตัว ยกฐานทำให้ทำความสะอาดได้ง่าย\nการเย็บหุ้มบุหัวเตียงจากโรงงานที่ผลิตและส่งออกไปมากกว่า 15 ประเทศทั่วโลก งานเนี๊ยบมาตรฐานระดับโลก ต้องยกให้ ฌ เฌอ นะครับ"
  },
  "นางแอ่น|โซฟา": {
    "link": "https://chawcher.com/product/nangaaen-sofa/",
    "title": "NANGAAEN SOFA",
    "text": "– หนึ่งในโซฟาสไตล์เกาหลีที่ละมุนที่สุดในตลาด\n– การเย็นที่เนี๊ยบ โค้งที่พอดิบพอดีและเป็นมาตรฐานเหมือนกันทุกตัว\n– แน่นแต่นุ่มคือลักษณะการนั่งของ โซฟานางแอ่น"
  },
  "พัฟฟิน|สตูล": {
    "link": "https://chawcher.com/product/puffin-stool/",
    "title": "PUFFIN STOOL"
  },
  "พัฟฟิน|อาร์มแชร์": {
    "link": "https://chawcher.com/product/puffin-sofa/",
    "title": "PUFFIN SOFA"
  },
  "พัฟฟิน|โซฟา": {
    "link": "https://chawcher.com/product/puffin-sofa/",
    "title": "PUFFIN SOFA",
    "text": "พัฟฟินโซฟา เป็น modular sofa ที่สามารถเลือกได้หลากหลายรูปแบบและหลายขนาดขึ้นอยู่กับความต้องการของลูกค้า\nและขนาดพื้นที่ของลูกค้าที่เหมาะสม\nโครงสร้างเป็นไม้เนื้อแข็ง\nฟองน้ำบุอย่างดี พร้อมผ้าที่มีให้เลือกหลากหลายมากมาย\nโซฟา 1 ที่นั่ง 1 แขน (สามารถสลับซ้ายขวาได้) เลือกผ้ากับทางร้านผ่าน Line Official หรือ Showroom\nเมื่อประกอบกับโซฟา 1 ที่นั่งแบบไม่มีแขน จะออกมาเป็นโซฟา 3 ที่นั่งที่กว้างขวางนั่งสบาย เข้ากับ สรีระของคนเอเชียที่สุด\nดีไซน์องศาการนั่งที่เองนิดหน่อย เบาะนั่ง slope เล็กน้อย ทำให้ การนั่งสบาย พร้อมกับพนักพิงที่ดีไซน์โค้งรับหลังล่าง ทำให้นั่งแล้วไม่เมื่อย"
  },
  "ฟลามิงโก|ตู้เก็บของ": {
    "link": "https://chawcher.com/product/flamingo-sideboard-walnut/",
    "title": "FLAMINGO SIDEBOARD (WALNUT)"
  },
  "ฟลามิงโก้|Recliner": {
    "link": "https://chawcher.com/product/flamingo-recliner/",
    "title": "FLAMINGO RECLINER",
    "text": "เก้าอี้ปรับนอน หนังแท้ รุ่น Flamingo\nสินค้าเราเป็นหนังแท้ ที่เหมาะสำหรับใช้ทำเฟอร์นิเจอร์ มีคุณภาพสูง คงทน"
  },
  "ฟีนิกซ์|ตู้เก็บของ": {
    "link": "https://chawcher.com/product/phoenix-sideboard/",
    "title": "PHOENIX SIDEBOARD"
  },
  "ฟีนิกซ์|สตูล": {
    "link": "https://chawcher.com/product/phoenix-stool/",
    "title": "PHOENIX STOOL"
  },
  "ฟีนิกซ์|โซฟา": {
    "link": "https://chawcher.com/product/phoenix-sofa/",
    "title": "PHOENIX SOFA",
    "text": "โซฟาที่ดีและนั่งสบายที่สุด"
  },
  "ฟีนิกซ์|โต๊ะกลาง": {
    "link": "https://chawcher.com/product/phoenix-coffee-table/",
    "title": "PHOENIX COFFEE TABLE"
  },
  "มินิเนส|อาร์มแชร์": {
    "link": "https://chawcher.com/product/mininest-armchair/",
    "title": "MININEST ARMCHAIR",
    "text": "เฟรมไม้โอ๊ค"
  },
  "สวอน|สตูล": {
    "link": "https://chawcher.com/product/swan-stool/",
    "title": "SWAN STOOL"
  },
  "สวอน|เก้าอี้": {
    "link": "https://chawcher.com/product/swan-chair/",
    "title": "SWAN CHAIR"
  },
  "สวอน|เลาจ์แชร์": {
    "link": "https://chawcher.com/product/swan-cozy-chair/",
    "title": "SWAN COZY CHAIR"
  },
  "สวอน|โซฟา": {
    "link": "https://chawcher.com/product/swan-sofa/",
    "title": "SWAN SOFA"
  },
  "สวอน|โต๊ะกลาง": {
    "link": "https://chawcher.com/product/swan-coffee-table/",
    "title": "SWAN COFFEE TABLE",
    "text": "ฌ เฌอ | โต๊ะกลาง สวอน (Swan Coffee Table) เหล็ก หรือ กระจก เลือกสีได้\nSwan Coffee Table ของ Chaw Cher Modern Collection ที่ผสมผสานความแข็งแกร่งคงทนของเหล็ก\nกับความโค้งอ่อนช้อยของ design ที่ผ่านการคิดและร่วมงานกับทีมงานผลิตชั้นนำทำให้ Swan Coffee Table\nเหมาะแก่การใช้งานในทุกพื้นที่ ไม่ว่าจะเป็นห้องรับแขกในบ้าน หรือแม้กระทั้ง lobby ของ โรงแรม"
  },
  "สวอน|โต๊ะข้างเตียง": {
    "link": "https://chawcher.com/product/swan-side-table/",
    "title": "SWAN SIDE TABLE"
  },
  "สวอน|โต๊ะทานข้าว": {
    "link": "https://chawcher.com/product/swan-dining-table/",
    "title": "SWAN DINING TABLE"
  },
  "อัญชัน|สตูล": {
    "link": "https://chawcher.com/product/aunchan-stool/",
    "title": "AUNCHAN STOOL"
  },
  "อัญชัน|โซฟา": {
    "link": "https://chawcher.com/product/aunchan-armchair/",
    "title": "AUNCHAN ARMCHAIR"
  },
  "อินทรี|สตูล": {
    "link": "https://chawcher.com/product/insee-stool/",
    "title": "INSEE STOOL"
  },
  "อินทรี|อาร์มแชร์": {
    "link": "https://chawcher.com/product/insee-cozy-chair/",
    "title": "INSEE COZY CHAIR",
    "text": "The Signature Armchair ที่นั่งสบายที่สุดตัวหนึ่ง\nเบาะที่นุ่มกำลังดี\nผ้าหรือหนังแบบพิเศษในแบบของ ฌ เฌอ\nดีไซน์โค้งมนที่ลงตัวเป็นเอกลักษณ์\nความพิถีพิถันในการผลิตที่ใส่ใจทุกรายละเอียด\nการไม่ยอมให้สิ่งที่ยังติดค้างในความไม่ผ่านทั้งเรื่องของดีไซน์ และคุณภาพการผลิต\nความใส่ใจแม้แต่สิ่งที่มองไม่เห็นอย่างโคลงสร้างที่แข็งแรงกว่าความโค้งมนที่น่าสัมผัส"
  },
  "อินทรี|โซฟา": {
    "link": "https://chawcher.com/product/insee-sofa/",
    "title": "INSEE SOFA"
  },
  "อีมู|สตูล": {
    "link": "https://chawcher.com/product/emu-stool/",
    "title": "EMU STOOL"
  },
  "อีมู|อาร์มแชร์": {
    "link": "https://chawcher.com/product/emu-armchair/",
    "title": "EMU ARMCHAIR"
  },
  "อีมู|เก้าอี้": {
    "link": "https://chawcher.com/product/emu-chair-walnut/",
    "title": "EMU CHAIR (WALNUT)",
    "text": "ออกแบบมาเพื่อความสบายของทุกคน"
  },
  "อีมู|เตียง": {
    "link": "https://chawcher.com/product/emu-bed/",
    "title": "EMU BED",
    "text": "หัวเตียงวัสดุเป็นโครงไม้หุ้มด้วยผ้า หนังสังเคราะห์ หรือ หนังแท้ (ราคาขึ้นอยู่กับวัสดุที่เลือก)"
  },
  "อีมู|โซฟา": {
    "link": "https://chawcher.com/product/emu-sofa/",
    "title": "EMU SOFA",
    "text": "Variation\nด้วยประสบการณ์การผลิตโซฟาส่งออกญี่ปุ่นมากว่า 28 ปี ทำให้เรามั่นใจในคุณภาพโซฟาหนังทุกตัวที่ผลิตออกมาภายในแบรนด์ ฌ เฌอ ว่าเราจะสามารถผลิตโซฟาที่คุณภาพดีที่สุดเพื่อส่งมอบให้กับลูกค้าเพื่อบ้านของทุกคน เราเลือกผ้าจาก supplier ทั่วโลกเพื่อสร้างความแตกต่างให้กับเฟอร์นิเจอร์ของ ฌ เฌอ และเพื่อทำให้เฟอร์นิเจอร์ตัวนั้นๆ พิเศษสำหรับบ้านของคุณ"
  },
  "ฮูก|อาร์มแชร์": {
    "link": "https://chawcher.com/product/hook-armchair/",
    "title": "HOOK ARMCHAIR"
  },
  "ฮูก|โคซี่แชร์": {
    "link": "https://chawcher.com/product/hook-cozy-chair/",
    "title": "HOOK COZY CHAIR"
  },
  "ฮูก|โซฟา": {
    "link": "https://chawcher.com/product/hook-sofa/",
    "title": "HOOK SOFA"
  },
  "เนส|โซฟา": {
    "link": "https://chawcher.com/product/nest-love-seat/",
    "title": "NEST LOVE SEAT",
    "text": "1.โซฟา Love Seat ประกอบด้วยหมอนอิง 3 ใบ\n2.โครงผลิตจากไม้เนื้อแข็ง แข็งแรงทนทาน"
  },
  "เบิร์ด|ชั้นวางหนังสือ": {
    "link": "https://chawcher.com/product/bird-bookshelf-walnut/",
    "title": "BIRD BOOKSHELF (WALNUT )"
  },
  "โอบ|โซฟา": {
    "link": "https://chawcher.com/product/oab-sofa/",
    "title": "OAB SOFA"
  },
  "โอมุ|โซฟา": {
    "link": "https://chawcher.com/product/omu-sofa/",
    "title": "OMU SOFA"
  }
};

export function webSpecOf(collection: string, category: string): WebSpec | undefined {
  return WEB_SPECS[`${collection}|${category}`];
}

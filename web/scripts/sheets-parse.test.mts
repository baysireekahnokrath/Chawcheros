// ทดสอบตัวแปลงชีต · ข้อมูลตัวอย่างจำลองรูปแบบชีตจริง (ไม่มีข้อมูลลูกค้าจริง)
//   cd web && node --experimental-strip-types scripts/sheets-parse.test.mts
// @ts-expect-error -- node --experimental-strip-types ต้องการนามสกุล .ts
import * as P from '../src/modules/sheets/parse.ts';
let fail = 0; const eq = (a: unknown, b: unknown, m: string) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fail++; console.log('✗', m, JSON.stringify(a), '≠', JSON.stringify(b)); } };
// วันที่
const D: [string, string | null][] = [
  ['อ.10 พ.ย.69', '2026-11-10'], ['2-4/11/69(เพื่อถึงก่อน6/11/69)', '2026-11-04'], ['12-15/10/69', '2026-10-15'],
  ['5/3/26', '2026-03-05'], ['ศ 10/7/2026 เวลา 10.00-11.00 น.', '2026-07-10'], ['จ.2 มี.ค.69 10.00-17.00น.', '2026-03-02'],
  ['1มิถุนายน 2569', '2026-06-01'], ['งานสถาปนิก วันที่ 27 เมษายน 2569', '2026-04-27'], ['ส.18 เม.ย.69', '2026-04-18'],
  ['ปลายเดือน พ.ค./69', null], ['30-45 วันหลังจากได้รับใบสั่งซื้อ', null], ['รอกำหนดส่ง', null], ['กำหนดส่ง 20-25/7/2569', '2026-07-25'],
  ['จัดส่งวันที่  5/3/2569', '2026-03-05'], ['ก่อน 2 ก.ค.69', '2026-07-02'], ['29 ต.ค.69', '2026-10-29'], ['ปลาย มี ค.69', null],
];
for (const [t, w] of D) eq(P.thaiDate(t, 2026), w, 'date ' + t);
eq(P.normBls('ิBLS3175'), 'BLS3175', 'bls1'); eq(P.normBls('BLS3181A'), 'BLS3181A', 'bls2'); eq(P.normBls('Futon 001'), null, 'futon');
eq(P.normBls('งานซ่อม BLS606'), 'BLS606', 'repair'); eq(P.normBls('MEMO.69/26'), null, 'memo');
// Order Tracking
const H = ['PO','w/o','ใบกำกับ/ใบชมพู','วันที่สั่งซื้อ','x','ชื่อลูกค้า','','','','','','','','รายการ','','','','','','','','','กำหนดส่งของ'];
const row = (o: Record<number,string>) => { const r: string[] = []; for (const [k,v] of Object.entries(o)) r[Number(k)] = v; return r; };
const ot = [H,
  row({0:'BLS3167',2:'ก่อนส่ง ถามก่อน มี PO หรือยัง',3:'06/01/2026',5:'ลับ',13:'Sofa A x 1',22:'จัดส่งวันที่  5/3/2569'}),
  row({1:'10/26',13:'Chair B x 2'}), row({}),
  row({0:'ิBLS3175',1:'19/26',3:'16/1/2026',13:'Bird',22:'รอกำหนด'}),
  row({0:'Futon 001',13:'Futon'}), row({13:'should not attach'}),
  row({0:'งานซ่อม BLS606',1:'44/26'}),
  row({22:'กำหนดส่งของ'}),
];
const o = P.parseOrders(ot, 2026);
eq(o.rows.map(r => r.bls), ['BLS3167','BLS3175','BLS606'], 'orders bls');
eq(o.rows[0], {bls:'BLS3167',label:null,wo:'10/26',ordered_on:'2026-01-06',delivery_text:'จัดส่งวันที่  5/3/2569',delivery_on:'2026-03-05',items_text:'Sofa A x 1\nChair B x 2',sheet_rows:'2-4'}, 'order merge');
eq(o.rows[2].label, 'งานซ่อม', 'repair label');
eq(JSON.stringify(o.rows).includes('ลับ'), false, 'no customer');
// PO 3230 shape (ชื่อลูกค้าเป็นของปลอม)
const po = [['PURCHASE ORDER '],['','','','','วันที่ Date:','31/10/2569'],['ใบสั่งซื้อ','','','','เลขที่ No:','BLS3230'],[],
  ['addr','','ชื่อ','คนปลอม'],[],[],[],[],[],[],['สถานที่จัดส่ง Place of delivery','','','','กำหนดส่ง Delivery date'],['บ้านคนปลอม','','','','10 พฤศจิกายน 2569'],[],
  ['No.','รายการสินค้า Descriptions','สี Color','จำนวน\nQTY','ราคา / หน่วย\nUnit Price','จำนวนเงิน\nAmount'],
  ['1','ฌ เฌอ | สตูล  ขมิ้น (Kamin Stool)','','  1 ','  19,700 '],['','หนังแท้เลือกสีได้ ขนาด W70 D50 H44 cm','','','  14,775 ','  14,775 '],
  ['','หนังแท้ สี SM-Wheat และ ขาสีวอลนัท'],['2','ค่าแพ็ค และค่าส่ง','','  1 ','  365 ','  365 '],[],[],
  ['','ธนาคารไทยพาณิชย์'],['  ชำระโดย Method of payment','','','','รวม Total','  15,140 ']];
const pl = P.parsePoTab('BLS3230','3230', po);
eq(pl, [{bls:'BLS3230',line_no:1,name:'ฌ เฌอ | สตูล ขมิ้น (Kamin Stool)',spec:'หนังแท้เลือกสีได้ ขนาด W70 D50 H44 cm',note:'หนังแท้ สี SM-Wheat และ ขาสีวอลนัท',qty:1,unit_price:14775,delivery_text:'10 พฤศจิกายน 2569',tab:'3230'}], 'po lines');
eq(JSON.stringify(pl).includes('คนปลอม'), false, 'po no customer');
eq(P.poTabs(['PO (new template)','3230','1768','1768 (2)','BLS2226']), [{bls:'BLS3230',tab:'3230'},{bls:'BLS1768',tab:'1768'},{bls:'BLS2226',tab:'BLS2226'}], 'po tabs');
// สต็อก
eq(P.latestTab(['CHAW CHER STOCK 16-10-69','CHAW CHER STOCK 2-11-69','STOCKผ้า+หนัง 24-10-69','Report'], /^CHAW CHER STOCK/), 'CHAW CHER STOCK 2-11-69', 'latest tab');
const sh = [['','Product Name','Brand','Categories','Material','Color','ขนาด','สินค้าพร้อมขาย','คงเหลือ','รอส่งลูกค้า','ASE-เพื่อขาย','ชอบใจ\nStudio','ของเสีย(ASE)','หมายเหตุ','Landing Cost','Inventory Value'],
  ['3','Andaman (500*500*500) CHA-04','HOF','โต๊ะข้าง','Oak','ธรรมชาติ','500*500*500','','5','','5','','2 =สีต่าง','','฿9,176.00','฿82,584.00']];
const st = P.parseStock(sh);
eq(st.rows[0].by_place, {'ASE-เพื่อขาย':'5','ของเสีย(ASE)':'2 =สีต่าง'}, 'stock places');
eq(JSON.stringify(st).includes('9,176') || JSON.stringify(st).includes('82,584'), false, 'no landing cost');
eq(st.rows[0].total, 5, 'stock total');
// ผ้า
const fb = [['ผ้า'],['NO','ผ้า A กอง 1','STOCK ','NO','ผ้า A กอง 2','STOCK ','new lot','NO','หนัง','STOCK '],['1','GL-IVORY','86.7','1','GR- BEIGE','33.77','','1','SM-WHEAT','1,777.50'],['7','ASTRO WHEAT','หมด']];
eq(P.parseFabric(fb), [{group_name:'ผ้า A กอง 1',name:'GL-IVORY',stock_text:'86.7',stock:86.7},{group_name:'ผ้า A กอง 2',name:'GR- BEIGE',stock_text:'33.77',stock:33.77},{group_name:'หนัง',name:'SM-WHEAT',stock_text:'1,777.50',stock:1777.5},{group_name:'ผ้า A กอง 1',name:'ASTRO WHEAT',stock_text:'หมด',stock:null}], 'fabric');
// Clearance
const cl = [['Full name','โค้ดสินค้า','ชื่อสินค้า','Brand','Category','Sub Category 1','Collection Name','Product name english','Wood (ประเภทไม้)','Wood Colour (สีไม้)','วัสดุหุ้ม (Upholstery Material)','สีวัสดุหุ้ม (Upholstery Colour)','กว้าง (W)','ลึก (D)','สูง (H)','Size (CM)','NNSKU#',' Retail Price \n(VAT) ','% Discount',' Discount\nAmount ',' Discount price \n(VAT) \n(after disc) '],
  ['ฌ เฌอ | ชั้นวางทีวี  กระสา (Krasa TV cabinet)','Krasa TV cabinet (Oak)','x','ฌ เฌอ','ชั้นวางทีวี','','กระสา','(Krasa TV cabinet) ','ไม้โอ๊ค ','สีธรรมชาติ','','','W180','D44.5','H45','cm','10023918','  49,900.00 ','40%','  19,960.00 ','  29,940.00 ']];
const c = P.parseClearance(cl);
eq([c[0].retail, c[0].disc_pct, c[0].price, c[0].size, c[0].collection], [49900,'40%',29940,'W180 D44.5 H45','กระสา'], 'clearance');
console.log(fail ? `${fail} FAILED` : 'ALL PASS');

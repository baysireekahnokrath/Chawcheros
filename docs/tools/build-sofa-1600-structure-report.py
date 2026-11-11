#!/usr/bin/env python3
"""
Structural test report for SOFA 1600 (A4 landscape HTML -> PDF).
Inputs: docs/products/sofa-1600/structure/revA.json, revB.json, revB-fem1..3.png
        (made by docs/tools/sofa-1600-structure.py A|B <json>)
Output: docs/products/sofa-1600/sofa-1600-structure-report.html (print to PDF)
"""
import base64, html, json, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
D = os.path.join(ROOT, "docs", "products", "sofa-1600", "structure")
A = json.load(open(os.path.join(D, "revA.json")))
B = json.load(open(os.path.join(D, "revB.json")))
css = open(sys.argv[1]).read() if len(sys.argv) > 1 and os.path.exists(sys.argv[1]) else ""
e = lambda s: html.escape(str(s))
img = lambda f: "data:image/png;base64," + base64.b64encode(open(os.path.join(D, f), "rb").read()).decode()
logo = open(os.path.join(ROOT, "docs/brand/logo.svg")).read().replace("currentColor", "#2B4368")
logo_uri = "data:image/svg+xml;base64," + base64.b64encode(logo.encode()).decode()

VERS = "Python 3.13 · NumPy 2.5 · SciPy 1.18 · scikit-fem 12.0.2 · triangle 20250106 · Shapely 2.2 · Matplotlib 3.11"
AI = "Claude Opus 5.5 (claude-opus-5-5) — เขียนโค้ดคำนวณและรันใน session นี้"


def header(t):
    return (f'<header><img src="{logo_uri}"><div><div class="brand">CHAW CHER · SOFA 1600 × 750</div><h1>{e(t)}</h1></div>'
            f'<div class="meta">รายงานทดสอบโครงสร้าง · 2026-11-11<br>โครงไม้อัด CNC · REV A → REV B</div></header>')


def nfail(d):
    return sum(1 for r in d["results"] if not r["ok"])


fixes = [
    ("ขากลาง x850 ชนซี่โครง R4 (ประกอบไม่ได้)", "ย้ายขา L3/L4 ไป x715 กลางช่อง R3–R4"),
    ("คานล่างใต้ขาเป็นไม้ 18 มม. แผ่นเดียว ดัดเกิน 2 เท่า", "แผ่นเสริม LPL ยาวเต็มช่องซี่โครง กาว+สกรูทับคาน = 36 มม."),
    ("T-nut ใต้ขา กดเนื้อไม้เกิน (ขาโดนดันข้าง)", "เพิ่มแหวนอีแปะ Ø40 ใต้ปีก T-nut"),
    ("สายยางยืด ยิงแม็ก 4 นัด ไม่พอ", "พับทบปลาย + แม็ก 6 นัด · เพิ่มเป็น 4 เส้น/ช่อง (20 เส้น)"),
    ("ร่อง B6 ด้านหลังเสาพนัก ทำให้เสาอ่อน (แรงอัด 25 MPa)", "ตัดคาน B6 ออก ไม้อัดดัดหลัง 2 ชั้นทำหน้าที่แทน"),
    ("ช่วงยาวระหว่างขาพึ่งคานแบน 18 มม.", "ไม้อัดดัดหน้า/หลัง อ้อมมุมทาบใต้คาน B1/B2 กาวเต็มหน้า = คานกล่อง · หน้าเป็น 2 ชั้น"),
    ("มุมร่องคาน B3/B4 แรงดึงกระจุก (แรงสายยางดึงคานเข้าหากัน)", "B3/B4 เป็นช่องปิด มีเนื้อไม้คาด 12 มม. · มุมในทุกมุม R6 · ร่องหลบสายยางตื้นลง (30 มม.)"),
    ("ซี่โครง 18 มม. รับแรงคนทิ้งตัวไม่พอ", "ซี่โครง R1–R5 กาวประกบ 2 ชั้น = 36 มม."),
    ("รอยต่อมุมเสาพนักกับฐานไม่เรียบ", "มุมใน R30 สม่ำเสมอ"),
    ("ฝาแกนหมอนข้างยึดด้วยเดือยเดียว", "เพิ่มแกนตั้งหน้า PL4 เป็นกล่องปิด"),
]

models = [
    ("T1", "สายยางยืด + แม็ก", "สายรับแรงแบบยืดหยุ่น (nonlinear cable): หาค่ายุบที่แรงดึงสมดุลกับน้ำหนัก", "เขียนเอง (NumPy)"),
    ("T2", "คานรับสายยาง B3/B4", "คานต่อเนื่องบนซี่โครง (Euler beam, stiffness method) · แรงจากสายยางทุกเส้น · เลื่อนจุดนั่งทุก 15 มม.", "เขียนเอง (NumPy)"),
    ("T3", "ซี่โครง R2–R5", "FEM 2 มิติ plane stress · สามเหลี่ยม P2 · รองรับด้วยสปริง (คานใต้ซี่โครง) · แบ่ง mesh ละเอียดอัตโนมัติ 4 รอบจนค่าคงที่", "scikit-fem + triangle"),
    ("T4", "ช่วงยาวระหว่างขา", "คานต่อเนื่องบนขา · หน้าตัดคานกล่อง (คาน B1+B3 / B2+B5 + ไม้อัดดัด) · ตรวจกาวและแรงเฉือนผิว", "เขียนเอง (NumPy)"),
    ("T5", "ขา + แผ่นรอง", "คำนวณมือ: ดัดคานใต้ขา · แรงงัดที่ T-nut เมื่อขาโดนดันข้าง", "สูตรกลศาสตร์"),
    ("T6", "กล่องแขน", "คำนวณมือ: แรงในเดือย AP1 (ดันแขนออก) · ดัด AP2 (กดแขน)", "สูตรกลศาสตร์"),
    ("T7", "หมอนข้าง", "คำนวณมือ: แรงคู่ในน็อต 2 ตัว · กดเนื้อไม้ที่ T-nut · ดัดแกน", "สูตรกลศาสตร์"),
    ("T8", "การล้ม", "สมดุลโมเมนต์รอบแนวขา (แนวทาง EN 1022) · น้ำหนักโซฟาจากพื้นที่ไม้จริง + ฟองน้ำ + ผ้า", "สูตรกลศาสตร์"),
]

p1 = f"""<section class="page">{header("ผลทดสอบความแข็งแรงโครงสร้าง")}
<div class="kpis"><div class="bad"><span>REV A (แบบชุดแรก)</span><b>ไม่ผ่าน {nfail(A)} / {len(A['results'])} ข้อ</b></div>
<div class="good"><span>REV B (แก้แล้ว · แบบชุดปัจจุบัน)</span><b>ผ่าน {len(B['results']) - nfail(B)} / {len(B['results'])} ข้อ</b></div>
<div><span>วิธีทดสอบ</span><b class="sm">คำนวณด้วยคอมพิวเตอร์ (FEM + คานต่อเนื่อง + สูตรกลศาสตร์)</b></div></div>
<h2>สิ่งที่เจอใน REV A และแก้ใน REV B</h2>
<table><tr><th>#</th><th>ปัญหาที่เจอใน REV A</th><th>แก้ใน REV B</th></tr>
{"".join(f'<tr><td class="r">{i}</td><td>{e(a)}</td><td>{e(b)}</td></tr>' for i, (a, b) in enumerate(fixes, 1))}</table>
<h2>ใช้โมเดลอะไรทดสอบ</h2>
<p class="note"><b>โมเดลวิศวกรรม:</b> แยกโครงเป็น 8 ส่วนตามเส้นทางแรง (ตารางหน้า 2) · ซี่โครงใช้ FEM 2 มิติ ส่วนอื่นใช้คานต่อเนื่องและสูตรกลศาสตร์ · โค้ดอ่านรูปทรงจากไฟล์แบบเดียวกับที่ส่ง CNC
<br><b>ซอฟต์แวร์:</b> {e(VERS)} · โค้ด <code>docs/tools/sofa-1600-structure.py</code>
<br><b>AI ที่ใช้:</b> {e(AI)}</p></section>"""

mat = B["materials"]["ply"]
p2 = f"""<section class="page">{header("วิธีทดสอบ · ค่าวัสดุ · แรงที่ใช้")}
<h2>โมเดลแต่ละส่วน</h2><table><tr><th>รหัส</th><th>ส่วน</th><th>วิธี</th><th>เครื่องมือ</th></tr>
{"".join(f'<tr><td>{a}</td><td><b>{e(b)}</b></td><td>{e(c)}</td><td>{e(d)}</td></tr>' for a, b, c, d in models)}</table>
<div class="two"><div><h2>ค่าวัสดุ (ค่าเชิงอนุรักษ์)</h2><table>
<tr><th>วัสดุ</th><th>ค่า</th></tr>
<tr><td>ไม้อัด 18 มม. (ยาง/ป็อปลาร์ กาว WBP)</td><td>E {mat['E']:.0f} · ดัด {mat['fm']} · ดึง {mat['ft']} · อัด {mat['fc']} · เฉือน {mat['fv']} · กดตั้งฉากผิว {mat['fc90']} MPa</td></tr>
<tr><td>ไม้อัดดัด 4 มม.</td><td>E 2500 · ดัด 15 · เฉือน 2.5 MPa</td></tr>
<tr><td>สายยางยืด 50 มม.</td><td>ขาด 1000 N · ความแข็ง EA 1200 N · ยืดตั้งต้น 8%</td></tr>
<tr><td>แม็ก 1 นัดในไม้อัด</td><td>120 N (พับทบปลาย ×1.6)</td></tr>
<tr><td>กาว PVA</td><td>บนขอบไม้ 2.0 · หน้าไม้อัด 1.0 MPa</td></tr></table>
<p class="note">เป็นค่าต่ำของไม้อัดเกรดเฟอร์นิเจอร์ในไทย ยังไม่ได้ทดสอบตัวอย่างไม้จริงของโรงงาน</p></div>
<div><h2>แรงทดสอบ</h2><table><tr><th>กรณี</th><th>แรง</th><th>เกณฑ์ผ่าน</th></tr>
<tr><td>เบาะ + พนัก (EN 12520 สถิต)</td><td>1300 + 560 N</td><td>หน่วยแรง ≤ กำลัง ÷ 1.5</td></tr>
<tr><td>ขอบหน้าเบาะ</td><td>1300 N</td><td>÷ 1.5</td></tr>
<tr><td>กดแขน / ดันแขนออกข้าง</td><td>750 / 400 N</td><td>÷ 1.5</td></tr>
<tr><td>ขาโดนดันหน้า / ข้าง</td><td>500 / 390 N</td><td>÷ 1.5</td></tr>
<tr><td>ใช้ซ้ำ 50,000 ครั้ง</td><td>เบาะ 1000 · พนัก 300 N</td><td>÷ 2.5</td></tr>
<tr><td>ใช้งานจริง: คน 100 กก. ทิ้งตัว</td><td>2000 N (คูณแรงกระแทก 2)</td><td>÷ 2.0</td></tr>
<tr><td>3 คนทิ้งตัวพร้อมกัน</td><td>3 × 2000 N</td><td>÷ 2.0</td></tr>
<tr><td>การล้ม (EN 1022)</td><td>600 N ห่างขอบ 60 มม. + 20 N</td><td>โมเมนต์ล้ม ≤ โมเมนต์ต้าน</td></tr></table>
<p class="note">ค่าแรง EN 12520:2015 (ที่นั่งใช้ในบ้าน) ตามที่จำได้ ควรตรวจกับเอกสารมาตรฐานฉบับจริงก่อนอ้างอิงทางการ</p></div></div></section>"""


def bar(r):
    if r["limit"] in (0, None):
        return ""
    v = min(r["value"] / r["limit"], 1.4)
    c = "#1F6B3A" if r["ok"] else "#8A2B20"
    return f'<div class="bar"><i style="width:{v / 1.4 * 100:.0f}%;background:{c}"></i><em style="left:{100 / 1.4:.0f}%"></em></div>'


rows = "".join(f'<tr><td>{e(r["code"])}</td><td>{e(r["name"])}<div class="mut small">{e(r["note"])}</div></td><td>{e(r["case"])}</td>'
               f'<td class="r">{r["value"]:,}</td><td class="r">{r["limit"]:,}</td><td>{e(r["unit"])}</td><td style="width:34mm">{bar(r)}</td>'
               f'<td class="r">{(r["value"] / r["limit"] * 100 if r["limit"] else 0):.0f}%</td><td><span class="pill {"ok" if r["ok"] else "hi"}">{"ผ่าน" if r["ok"] else "ไม่ผ่าน"}</span></td></tr>'
               for r in B["results"])
p3 = f"""<section class="page">{header("ผลทุกข้อ · REV B")}
<table class="res"><thead><tr><th>รหัส</th><th>ตรวจอะไร</th><th>กรณี</th><th>ค่าที่ได้</th><th>ค่ายอมให้</th><th>หน่วย</th><th>ใช้ไป</th><th>%</th><th>ผล</th></tr></thead>
<tbody>{rows}</tbody></table>
<p class="note">ใช้ไป = ค่าที่ได้ ÷ ค่ายอมให้ (ค่ายอมให้หักค่าความปลอดภัยแล้ว) · เส้นตั้ง = 100% · ข้อที่เหลือเผื่อน้อยที่สุด: แรงดึงสายยางตอนคนทิ้งตัว (95%) → ห้ามลดจำนวนเส้นหรือจำนวนแม็ก</p></section>"""

fem = B["fem"]
hist = "".join(f'<tr><td>{e(f["label"])}</td>' + "".join(f'<td class="r">{h[0]:,}<br><b>{h[1]:.2f}</b></td>' for h in f["hist"]) + "</tr>" for f in fem)
p4 = f"""<section class="page">{header("ซี่โครง R2–R5 · ผล FEM")}
<div class="three">{"".join(f'<figure><img src="{img(f"revB-fem{i + 1}.png")}"><figcaption>{e(f["label"])} · ดึงสูงสุด {f["tmax"]:.2f} · อัดสูงสุด {f["cmax"]:.2f} MPa</figcaption></figure>' for i, f in enumerate(fem))}</div>
<p class="note">แดง = แรงดึง · น้ำเงิน = แรงอัด (หน่วย MPa) · ซี่โครงหนา 36 มม. (2 ชั้น) · หน้าโซฟาอยู่ทางขวา</p>
<h2>ตรวจว่า mesh ละเอียดพอ (จำนวน element / แรงดึงสูงสุด MPa)</h2>
<table><tr><th>กรณี</th><th>รอบ 0</th><th>รอบ 1</th><th>รอบ 2</th><th>รอบ 3</th><th>รอบ 4</th></tr>{hist}</table>
<p class="note">แบ่ง mesh ละเอียดขึ้นเฉพาะจุดที่หน่วยแรงสูง 4 รอบ ค่าขยับรอบละ ~2% = ลู่เข้าแล้ว ·
ระหว่างทำพบค่าที่โตไม่หยุดจากรูปทรง/การให้แรงที่ไม่ตรงความจริง (มุมคมที่เกิดจากการลดจุดของเส้นโค้ง · ฐานรองแบบยึดตาย · แรงที่จบบนมุมโค้ง)
จึงแก้โมเดลเป็นมุมโค้งเรียบ R6 ตามดอก CNC · ฐานรองแบบสปริง · แรงลงเฉพาะหน้าสัมผัสเรียบ แล้วรันใหม่</p></section>"""

p5 = f"""<section class="page">{header("ข้อจำกัด · ทดสอบจริงก่อนผลิต")}
<div class="two"><div><h2>ข้อจำกัดของการทดสอบนี้</h2><ul>
<li>เป็นการคำนวณ ไม่ใช่การกดของจริง · ผลขึ้นกับค่าวัสดุที่สมมติ (ไม้อัดและกาวของโรงงานจริงอาจต่างได้)</li>
<li>ไม้อัดคิดแบบวัสดุเท่ากันทุกทิศ (ไม้อัดจริงแข็งตามลายผิวมากกว่า) · ฟองน้ำและผ้าไม่นับว่าช่วยรับแรง</li>
<li>รอยต่อคิดว่ากาวเต็มหน้าและอัดแน่น · ถ้ากาวไม่เต็มหรือไม้ชื้น ความแข็งแรงลดลงมาก</li>
<li>ซี่โครงคิดเป็น 2 มิติทีละแผ่น · ช่วงยาวคิดเป็นคาน · ไม่ได้ทำ FEM ทั้งตัวแบบ 3 มิติ</li>
<li>ค่าแรง EN ใช้ตามที่จำได้ ต้องเทียบกับมาตรฐานฉบับจริง</li></ul></div>
<div><h2>ทดสอบจริงกับโครงตัวอย่างตัวแรก (ก่อนบุ)</h2><ol>
<li>ประกอบโครงตามแบบ REV B · ทิ้งกาวแห้ง 24 ชม.</li>
<li>วางถุงทราย 130 กก. (≈1300 N) บนแผ่นไม้ Ø200 กลางเบาะช่องที่ห่างขามากที่สุด 10 ครั้ง ครั้งละ 10 วินาที</li>
<li>วางที่ขอบหน้าเบาะ (ห่างขอบ 80 มม.) ซ้ำแบบเดียวกัน · ดันพนักบน 56 กก. พร้อมกัน</li>
<li>ดันแขน/หมอนข้างออกข้าง 40 กก. · กดบนหมอนข้าง 75 กก.</li>
<li>ผ่านเมื่อ: ไม่มีเสียงแตก ไม่มีรอยร้าว ไม่มีกาวหลุด และกลับคืนรูปเดิม (วัดก่อน/หลัง ต่างไม่เกิน 2 มม.)</li>
<li>ถ่ายรูป/วิดีโอ ส่งเข้าแฟ้มสินค้า แล้วจึงอนุมัติผลิตล็อตแรก</li></ol>
<p class="note">ถ้าต้องการใบรับรองไปใช้ขาย ส่งตัวอย่างทดสอบที่แล็บตามมาตรฐาน EN 12520 / EN 1022 (หรือ มอก. ที่เกี่ยวข้อง)</p></div></div></section>"""

style = """@page{size:A4 landscape;margin:0}*{box-sizing:border-box}
body{margin:0;font-family:'Noto Sans Thai','Montserrat',sans-serif;color:#1E2733;font-size:9.5pt}
.page{width:297mm;min-height:210mm;padding:12mm 13mm;page-break-after:always}.page:last-child{page-break-after:auto}
header{display:flex;align-items:center;gap:5mm;border-bottom:2px solid #83B7BF;padding-bottom:3mm;margin-bottom:5mm}
header img{height:16mm}header .brand{font-family:Montserrat;letter-spacing:.12em;font-size:8.5pt;color:#958C7B;font-weight:500}
header h1{margin:0;font-size:16pt;color:#2B4368;font-weight:600}header .meta{margin-left:auto;text-align:right;font-size:8pt;color:#6B7280}
h2{font-size:11pt;color:#2B4368;margin:5mm 0 2mm}
.kpis{display:flex;gap:4mm}.kpis div{flex:1;background:#F7F8F8;border-left:3px solid #2B4368;padding:3mm 4mm}
.kpis .bad{border-color:#8A2B20}.kpis .good{border-color:#1F6B3A}
.kpis span{display:block;font-size:8.5pt;color:#6B7280}.kpis b{font-size:16pt;color:#2B4368}.kpis b.sm{font-size:10.5pt}
.kpis .bad b{color:#8A2B20}.kpis .good b{color:#1F6B3A}
.two{display:grid;grid-template-columns:1fr 1fr;gap:8mm}.three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4mm}
figure{margin:0}figure img{width:100%}figcaption{font-size:8pt;color:#2F4554;text-align:center}
table{width:100%;border-collapse:collapse}th{background:#2B4368;color:#fff;font-weight:500;text-align:left;padding:1.5mm 2mm;font-size:8.5pt}
td{padding:1.3mm 2mm;border-bottom:1px solid #E3E6EA;vertical-align:top}.r{text-align:right;font-variant-numeric:tabular-nums}
.res{font-size:8pt}.res td{padding:.9mm 1.5mm}.mut{color:#6B7280}.small{font-size:7.3pt}
.pill{display:inline-block;padding:.3mm 2mm;border-radius:3mm;font-size:7.5pt}.ok{background:#DCEFE3;color:#1F6B3A}.hi{background:#F8D7D3;color:#8A2B20}
.bar{position:relative;height:2.6mm;background:#EEF0F2;border-radius:1mm;margin-top:1mm}.bar i{position:absolute;left:0;top:0;bottom:0;border-radius:1mm}
.bar em{position:absolute;top:-.6mm;bottom:-.6mm;width:.4mm;background:#1E2733}
.note{font-size:8.3pt;color:#4B5563}code{font-size:8pt}ul,ol{padding-left:5mm;margin:1mm 0}li{margin-bottom:1.5mm}"""
out = os.path.join(ROOT, "docs", "products", "sofa-1600", "sofa-1600-structure-report.html")
open(out, "w").write(f'<!doctype html><html lang="th"><head><meta charset="utf-8"><title>SOFA 1600 Structural Report</title><style>{css}{style}</style></head><body>{p1}{p2}{p3}{p4}{p5}</body></html>')
print(out)

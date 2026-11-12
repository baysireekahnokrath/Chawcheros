#!/usr/bin/env python3
"""
Structural test report for the curved sofas FI-01 + FI-02 (A4 landscape HTML -> PDF).
Inputs : docs/products/fi-0X-*/structure/fi-0X.json, -fem1..3.png, -plan.png   (docs/tools/sofa-curved-structure.py)
Output : docs/products/fi-01-sofa-1600/fi-01-fi-02-structure-report.html
"""
import base64, html, json, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
M = [("FI-01", "fi-01-sofa-1600"), ("FI-02", "fi-02-sofa-1900")]
D = {m: os.path.join(ROOT, "docs", "products", slug, "structure") for m, slug in M}
R = {m: json.load(open(os.path.join(D[m], m.lower() + ".json"))) for m, _ in M}
css = open(sys.argv[1]).read() if len(sys.argv) > 1 and os.path.exists(sys.argv[1]) else ""
e = lambda s: html.escape(str(s))
img = lambda m, f: "data:image/png;base64," + base64.b64encode(open(os.path.join(D[m], f), "rb").read()).decode()
logo = open(os.path.join(ROOT, "docs/brand/logo.svg")).read().replace("currentColor", "#2B4368")
logo_uri = "data:image/svg+xml;base64," + base64.b64encode(logo.encode()).decode()
VERS = "Python 3.13 · NumPy · SciPy · scikit-fem 12.0.2 · triangle · Shapely 2 · Matplotlib"
AI = "Claude (Anthropic) ผ่าน Claude Code — เขียนโค้ดคำนวณและรันใน session นี้"


def header(t):
    return (f'<header><img src="{logo_uri}"><div><div class="brand">CHAW CHER · FI-01 L1600 / FI-02 L1900 โซฟาโค้ง</div><h1>{e(t)}</h1></div>'
            f'<div class="meta">รายงานทดสอบโครงสร้าง · 2026-11-12<br>โครงไม้อัด CNC · REV A (แบบโค้งตามลูกค้า)</div></header>')


def nfail(d):
    return sum(1 for r in d["results"] if not r["ok"])


fixes = [
    ("หมอนข้างทับเส้นตัวโซฟาในแปลน (แกนหมอนชนโครง)", "โครงเว้าหลบหมอนข้าง 60 มม. · หมอนข้างตั้งในช่องเว้า มีขาซ่อนใต้แกน 1 ขา + น็อต M8 2 ตัวเข้าแผงแขน"),
    ("ขาวางตามแนวคานล่าง (ห่างขอบ 140 มม.) แปลนโค้งยื่นเกินแนวขา → ล้มไปหน้า/หลัง/ข้าง ไม่ผ่าน 5 ข้อ", "เลือกตำแหน่งขาอัตโนมัติให้ส่วนยื่นจากแนวขาน้อยที่สุด (ทุกจุดที่คนนั่ง/พิง) · ยังเป็น 6 ขา + ขาหมอนข้าง"),
    ("ปลายแขน FI-01 ยื่นเลยขาสุดท้าย ~400 มม.", "เพิ่มแผ่นล่างเต็มกล่องแขน (ต่อกับวง BR) ใช้เป็นที่ยึดขา"),
    ("คานรับสายยางช่วงโค้งยาวสุด 613 มม. (FI-01) และปลายคานลอย (FI-02) ดัดเกิน", "เสาค้ำ RP ใต้คานทุกช่วงที่ยาวเกิน 330 มม. และที่ปลายลอย · คาน SB/SF กว้าง 80 → 100 มม."),
    ("สายยาง 50 มม. ทั่วไป (ขาด ~1,000 N) ช่วงที่นั่งลึก 510 มม. รับคนทิ้งตัวไม่พอ", "ระบุเกรดสายยางขาด ≥ 1,500 N · พับทบปลาย ยิงแม็ก 8 นัด"),
]

models = [
    ("T1", "สายยางยืด + แม็ก", "สายรับแรงแบบยืดหยุ่น (nonlinear cable) · ใช้ความลึกที่นั่งจริงของทุกเส้น (ยาวสุด FI-01 510 / FI-02 ~490 มม.)", "เขียนเอง (NumPy)"),
    ("T2", "คานรับสายยาง SB/SF (โค้ง)", "คานต่อเนื่องตามแนวโค้งจริง (ระยะตามความยาวส่วนโค้ง) · รองรับที่ซี่โครง + เสาค้ำ · เลื่อนจุดนั่งทุก 15 มม.", "เขียนเอง (NumPy)"),
    ("T3", "ซี่โครงทุกซี่ที่รับเบาะ", "FEM 2 มิติ plane stress · สามเหลี่ยม P2 · ตำแหน่งร่องจริงของแต่ละซี่ · รองรับแบบสปริงที่ร่องวง BR · แบ่ง mesh ละเอียดอัตโนมัติ 3 รอบ", "scikit-fem + triangle"),
    ("T4", "แนวฐานหน้า/หลัง", "คานกล่องโค้ง (วง BR + คาน SF หรือ BT + ไม้อัดดัด 2 ชั้น) วางบนขาตามตำแหน่งจริง · ตรวจกาวและแรงเฉือนผิว", "เขียนเอง (NumPy)"),
    ("T5", "ขา + แผ่นรอง", "ดัดวงล่าง+แผ่นเสริม 36 มม. ใต้ขาทุกขา · แรงงัด T-nut", "สูตรกลศาสตร์"),
    ("T6", "กล่องแขน", "ดัดวงบน AT · ผิวไม้อัดดัดรับแรงดันแขนออกข้าง", "สูตรกลศาสตร์"),
    ("T7", "หมอนข้าง", "แรงในน็อต 2 ตัว · กดเนื้อไม้ที่ T-nut · ดัดแกน", "สูตรกลศาสตร์"),
    ("T8", "การล้ม", "สมดุลโมเมนต์รอบทุกด้านของรูปหลายเหลี่ยมขาจริง · ไล่จุดกดทุก 15-20 มม. ตามขอบหน้า ปลาย แขน หมอนข้าง และพนัก (แนวทาง EN 1022)", "สูตรกลศาสตร์ + Shapely"),
]

kp = "".join(f'<div class="{"good" if nfail(R[m]) == 0 else "bad"}"><span>{e(R[m]["name"])} · น้ำหนัก ~{R[m]["mass"]:.0f} กก.</span>'
             f'<b>ผ่าน {len(R[m]["results"]) - nfail(R[m])} / {len(R[m]["results"])} ข้อ</b></div>' for m, _ in M)
p1 = f"""<section class="page">{header("ผลทดสอบความแข็งแรงโครงสร้าง · แบบโค้งใหม่")}
<div class="kpis">{kp}<div><span>วิธีทดสอบ</span><b class="sm">คำนวณด้วยคอมพิวเตอร์ (FEM + คานต่อเนื่อง + สูตรกลศาสตร์) จากไฟล์ CNC ชุดเดียวกับที่ส่งตัด</b></div></div>
<h2>สิ่งที่การทดสอบเจอในแบบโค้งรอบแรก และแก้ในแบบที่ส่งผลิต</h2>
<table><tr><th>#</th><th>ปัญหาที่เจอ</th><th>แก้แล้วในแบบชุดนี้</th></tr>
{"".join(f'<tr><td class="r">{i}</td><td>{e(a)}</td><td>{e(b)}</td></tr>' for i, (a, b) in enumerate(fixes, 1))}</table>
<h2>ใช้โมเดลอะไรทดสอบ</h2>
<p class="note"><b>โมเดลวิศวกรรม:</b> แยกโครงเป็น 8 ส่วนตามเส้นทางแรง (หน้า 2) · ซี่โครงทุกซี่ใช้ FEM 2 มิติ ส่วนอื่นใช้คานต่อเนื่องตามแนวโค้งจริงและสูตรกลศาสตร์ · ค่าวัสดุ แรงทดสอบ และเกณฑ์ผ่านเหมือนรายงาน SOFA 1600 REV B ทุกค่า
<br><b>ซอฟต์แวร์:</b> {e(VERS)} · โค้ด <code>docs/tools/sofa-curved-structure.py</code> (อ่านรูปทรงจาก <code>docs/tools/sofa_curved.py</code>)
<br><b>AI ที่ใช้:</b> {e(AI)}</p></section>"""

mat = R["FI-01"]["materials"]["ply"]
p2 = f"""<section class="page">{header("วิธีทดสอบ · ค่าวัสดุ · แรงที่ใช้")}
<h2>โมเดลแต่ละส่วน</h2><table><tr><th>รหัส</th><th>ส่วน</th><th>วิธี</th><th>เครื่องมือ</th></tr>
{"".join(f'<tr><td>{a}</td><td><b>{e(b)}</b></td><td>{e(c)}</td><td>{e(d)}</td></tr>' for a, b, c, d in models)}</table>
<div class="two"><div><h2>ค่าวัสดุ (ค่าเชิงอนุรักษ์)</h2><table><tr><th>วัสดุ</th><th>ค่า</th></tr>
<tr><td>ไม้อัด 18 มม. (ยาง/ป็อปลาร์ กาว WBP)</td><td>E {mat['E']:.0f} · ดัด {mat['fm']} · ดึง {mat['ft']} · อัด {mat['fc']} · เฉือน {mat['fv']} · กดตั้งฉากผิว {mat['fc90']} MPa</td></tr>
<tr><td>ไม้อัดดัด 4 มม.</td><td>E 2500 · ดัด 15 · เฉือน 2.5 MPa</td></tr>
<tr><td><b>สายยางยืด 50 มม. (สเปกซื้อใหม่)</b></td><td><b>ขาด ≥ 1,500 N</b> · EA 1200 N · ยืดตั้งต้น 8%</td></tr>
<tr><td>แม็ก 1 นัดในไม้อัด</td><td>120 N (พับทบปลาย ×1.6) · ใช้ 8 นัด/ปลาย</td></tr>
<tr><td>กาว PVA</td><td>บนขอบไม้ 2.0 · หน้าไม้อัด 1.0 MPa</td></tr></table></div>
<div><h2>แรงทดสอบ</h2><table><tr><th>กรณี</th><th>แรง</th><th>เกณฑ์ผ่าน</th></tr>
<tr><td>เบาะ + พนัก (EN 12520 สถิต)</td><td>1300 + 560 N</td><td>หน่วยแรง ≤ กำลัง ÷ 1.5</td></tr>
<tr><td>ขอบหน้าเบาะ</td><td>1300 N</td><td>÷ 1.5</td></tr>
<tr><td>กดแขน / ดันแขน-หมอนข้างออกข้าง</td><td>750 / 400 N</td><td>÷ 1.5</td></tr>
<tr><td>ขาโดนดันหน้า</td><td>500 N</td><td>÷ 1.5</td></tr>
<tr><td>ใช้ซ้ำ 50,000 ครั้ง</td><td>เบาะ 1000 · พนัก 300 N</td><td>÷ 2.5</td></tr>
<tr><td>ใช้งานจริง: คน 100 กก. ทิ้งตัว</td><td>2000 N</td><td>÷ 2.0</td></tr>
<tr><td>หลายคนทิ้งตัวพร้อมกัน</td><td>2 คน × 2000 N (FI-01) · {R['FI-02']['n_people']} คน (FI-02)</td><td>÷ 2.0</td></tr>
<tr><td>การล้ม (EN 1022)</td><td>600 N ห่างขอบ 60 มม. + 20 N · พิงพนัก 300 N · นั่งปลาย/แขน/หมอนข้าง 750 N</td><td>โมเมนต์ล้ม ≤ โมเมนต์ต้าน</td></tr></table>
<p class="note">ค่าแรง EN 12520 / EN 1022 ตามที่จำได้ ควรตรวจกับเอกสารมาตรฐานฉบับจริงก่อนอ้างอิงทางการ</p></div></div></section>"""


def bar(r):
    if r["limit"] in (0, None):
        return ""
    v = min(r["value"] / r["limit"], 1.4)
    c = "#1F6B3A" if r["ok"] else "#8A2B20"
    return f'<div class="bar"><i style="width:{v / 1.4 * 100:.0f}%;background:{c}"></i><em style="left:{100 / 1.4:.0f}%"></em></div>'


def page_results(m):
    d = R[m]
    res = [r for r in d["results"] if r["code"] != "T5a"]
    t5 = [r for r in d["results"] if r["code"] == "T5a"]
    if t5:
        w = max(t5, key=lambda r: r["value"] / r["limit"])
        res.append(dict(w, name=f"วงล่าง + แผ่นเสริม 36 มม. ใต้ขา ดัด (ขาที่แย่สุดจาก {len(t5)} ขา)"))
    rows = "".join(f'<tr><td>{e(r["code"])}</td><td>{e(r["name"])}<div class="mut small">{e(r["note"])}</div></td><td>{e(r["case"])}</td>'
                   f'<td class="r">{r["value"]:,}</td><td class="r">{r["limit"]:,}</td><td>{e(r["unit"])}</td><td style="width:30mm">{bar(r)}</td>'
                   f'<td class="r">{(r["value"] / r["limit"] * 100 if r["limit"] else 0):.0f}%</td><td><span class="pill {"ok" if r["ok"] else "hi"}">{"ผ่าน" if r["ok"] else "ไม่ผ่าน"}</span></td></tr>'
                   for r in res)
    top = sorted(res, key=lambda r: -(r["value"] / r["limit"]))[:3]
    return f"""<section class="page">{header(f"ผลทุกข้อ · {d['name']}")}
<table class="res"><thead><tr><th>รหัส</th><th>ตรวจอะไร</th><th>กรณี</th><th>ค่าที่ได้</th><th>ค่ายอมให้</th><th>หน่วย</th><th>ใช้ไป</th><th>%</th><th>ผล</th></tr></thead>
<tbody>{rows}</tbody></table>
<p class="note">ใช้ไป = ค่าที่ได้ ÷ ค่ายอมให้ (หักค่าความปลอดภัยแล้ว) · เส้นตั้ง = 100% · เหลือเผื่อน้อยสุด: {" · ".join(f"{e(r['name'][:42])} ({r['value'] / r['limit'] * 100:.0f}%)" for r in top)}</p></section>"""


def page_fem():
    blocks = ""
    for m, _ in M:
        d = R[m]
        rib = max((f for f in d["fem"] if f["label"].startswith("คน")), key=lambda f: max(f["tmax"] / 7.5, f["cmax"] / 9))["rib"]
        fs = [f for f in d["fem"] if f["rib"] == rib]
        blocks += f'<h2>{e(d["name"])} · ซี่โครง {rib} (ซี่ที่หน่วยแรงสูงสุด จาก {len(set(f["rib"] for f in d["fem"]))} ซี่)</h2><div class="three">'
        blocks += "".join(f'<figure><img src="{img(m, f"{m.lower()}-fem{i + 1}.png")}"><figcaption>{e(f["label"])} · ดึง {f["tmax"]:.2f} · อัด {f["cmax"]:.2f} MPa</figcaption></figure>'
                          for i, f in enumerate(fs[:3]))
        blocks += "</div>"
    return f"""<section class="page">{header("ซี่โครง · ผล FEM")}{blocks}
<p class="note">แดง = แรงดึง · น้ำเงิน = แรงอัด (MPa) · ซี่โครงหนา 36 มม. ถึง Z450 · บน 18 มม. · ซ้าย = หลังโซฟา · mesh ละเอียดขึ้นเฉพาะจุดหน่วยแรงสูง 3 รอบ: ค่าสูงสุดยังขยับรอบละ ~4-5% (อยู่ที่มุมโค้ง R6 ของร่องคาน) · ทุกกรณีเหลือเผื่อ ≥ 35% จึงไม่เปลี่ยนผลผ่าน/ไม่ผ่าน</p></section>"""


def page_plan():
    figs = "".join(f'<figure><img src="{img(m, f"{m.lower()}-plan.png")}"><figcaption>{e(R[m]["name"])} · เขียว = พื้นที่ภายในแนวขา · '
                   f'จุดเขียว = ขา {len(R[m]["legs"])} + ขาหมอนข้าง 1 · x แดง = จุดศูนย์ถ่วง · เส้นฟ้า = ซี่โครง</figcaption></figure>' for m, _ in M)
    return f"""<section class="page">{header("ตำแหน่งขา · การล้ม")}<div class="two">{figs}</div>
<p class="note">ขาเลือกด้วยโปรแกรม: วางได้เฉพาะบนวงล่าง BR / แผ่นล่างกล่องแขน ห่างซี่โครง &gt; 45 มม. (มีแผ่นเสริม LPL เต็มช่อง) แล้วหาชุดที่ทำให้ขอบที่คนนั่ง/พิง ยื่นเลยแนวขาน้อยที่สุด
· ตำแหน่งขาจริงอยู่ในแบบแผ่นที่ 2 (L1–L7)</p></section>"""


p_last = """<section class="page">""" + header("ข้อจำกัด · ทดสอบจริงก่อนผลิต") + """
<div class="two"><div><h2>ข้อจำกัดของการทดสอบนี้</h2><ul>
<li>เป็นการคำนวณ ไม่ใช่การกดของจริง · ผลขึ้นกับค่าวัสดุที่สมมติ</li>
<li>ทรงแปลนลอกจากแบบลูกค้า (คลาด ±20 มม.) · ความสูงใช้ตาม SOFA 1600 เดิม (ที่นั่ง 420 · แขน 520 · พนัก 800) ถ้าลูกค้าเปลี่ยน ต้องรันใหม่</li>
<li>ซี่โครงคิด 2 มิติทีละแผ่น · รางและแนวฐานคิดเป็นคานตามแนวโค้ง · ไม่ได้ทำ FEM ทั้งตัว 3 มิติ</li>
<li>น้ำหนักโซฟาประมาณจากพื้นที่ไม้จริง + ฟองน้ำ/ผ้าตามสัดส่วนแปลน (FI-01 ~45 · FI-02 ~54 กก.)</li>
<li>สายยางต้องเป็นเกรดขาด ≥ 1,500 N ตามสเปก · ถ้าใช้สายทั่วไป ข้อ T1d ไม่ผ่าน</li></ul></div>
<div><h2>ทดสอบจริงกับโครงตัวอย่างตัวแรก (ก่อนบุ)</h2><ol>
<li>ประกอบโครงตามแบบ · ทิ้งกาวแห้ง 24 ชม.</li>
<li>ถุงทราย 130 กก. บนแผ่นไม้ Ø200 ตรงช่องที่นั่งลึกที่สุด (ซี่ R02–R03) 10 ครั้ง ครั้งละ 10 วินาที</li>
<li>ขอบหน้าเบาะ (ห่างขอบ 80 มม.) ตรงจุดที่โค้งยื่นที่สุด · ดันพนักบน 56 กก. พร้อมกัน</li>
<li>กดบนแขน 75 กก. · ดันหมอนข้างออกข้าง 40 กก. · นั่งบนหมอนข้าง 75 กก. แล้วดูว่าโซฟาไม่กระดก</li>
<li>คน 100 กก. นั่งริมขอบหน้าจุดที่โค้งยื่นที่สุด และนั่งปลายแขน → ขาทุกขาต้องไม่ลอย</li>
<li>ผ่านเมื่อ: ไม่มีเสียงแตก รอยร้าว กาวหลุด และวัดก่อน/หลังต่างไม่เกิน 2 มม. · ถ่ายรูป/วิดีโอเก็บเข้าแฟ้มสินค้า</li></ol></div></div></section>"""

style = """@page{size:A4 landscape;margin:0}*{box-sizing:border-box}
body{margin:0;font-family:'Noto Sans Thai','Montserrat',sans-serif;color:#1E2733;font-size:9.5pt}
.page{width:297mm;min-height:210mm;padding:12mm 13mm;page-break-after:always}.page:last-child{page-break-after:auto}
header{display:flex;align-items:center;gap:5mm;border-bottom:2px solid #83B7BF;padding-bottom:3mm;margin-bottom:5mm}
header img{height:16mm}header .brand{font-family:Montserrat;letter-spacing:.12em;font-size:8.5pt;color:#958C7B;font-weight:500}
header h1{margin:0;font-size:16pt;color:#2B4368;font-weight:600}header .meta{margin-left:auto;text-align:right;font-size:8pt;color:#6B7280}
h2{font-size:11pt;color:#2B4368;margin:4mm 0 2mm}
.kpis{display:flex;gap:4mm}.kpis div{flex:1;background:#F7F8F8;border-left:3px solid #2B4368;padding:3mm 4mm}
.kpis .bad{border-color:#8A2B20}.kpis .good{border-color:#1F6B3A}
.kpis span{display:block;font-size:8.5pt;color:#6B7280}.kpis b{font-size:16pt;color:#2B4368}.kpis b.sm{font-size:10pt}
.kpis .bad b{color:#8A2B20}.kpis .good b{color:#1F6B3A}
.two{display:grid;grid-template-columns:1fr 1fr;gap:8mm}.three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4mm}
figure{margin:0}figure img{width:100%;max-height:62mm;object-fit:contain}.two figure img{max-height:120mm}figcaption{font-size:8pt;color:#2F4554;text-align:center}
table{width:100%;border-collapse:collapse}th{background:#2B4368;color:#fff;font-weight:500;text-align:left;padding:1.5mm 2mm;font-size:8.5pt}
td{padding:1.3mm 2mm;border-bottom:1px solid #E3E6EA;vertical-align:top}.r{text-align:right;font-variant-numeric:tabular-nums}
.res{font-size:7.4pt}.res td{padding:.55mm 1.5mm}.mut{color:#6B7280}.small{font-size:6.8pt}
.pill{display:inline-block;padding:.2mm 2mm;border-radius:3mm;font-size:7pt}.ok{background:#DCEFE3;color:#1F6B3A}.hi{background:#F8D7D3;color:#8A2B20}
.bar{position:relative;height:2.4mm;background:#EEF0F2;border-radius:1mm;margin-top:.6mm}.bar i{position:absolute;left:0;top:0;bottom:0;border-radius:1mm}
.bar em{position:absolute;top:-.6mm;bottom:-.6mm;width:.4mm;background:#1E2733}
.note{font-size:8.3pt;color:#4B5563}code{font-size:8pt}ul,ol{padding-left:5mm;margin:1mm 0}li{margin-bottom:1.5mm}"""
out = os.path.join(ROOT, "docs", "products", "fi-01-sofa-1600", "fi-01-fi-02-structure-report.html")
body = p1 + p2 + page_results("FI-01") + page_results("FI-02") + page_fem() + page_plan() + p_last
open(out, "w").write(f'<!doctype html><html lang="th"><head><meta charset="utf-8"><title>FI-01 FI-02 Structural Report</title><style>{css}{style}</style></head><body>{body}</body></html>')
print(out)

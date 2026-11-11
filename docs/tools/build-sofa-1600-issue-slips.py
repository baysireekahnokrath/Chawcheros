#!/usr/bin/env python3
"""
SOFA 1600 (REV B) — material issue slips (ใบแจกวัสดุ) per department.

Output (docs/products/sofa-1600/):
  sofa-1600-issue-slips.xlsx   one tab per department · enter the build quantity once, totals follow
  sofa-1600-issue-slips.html   one A4 page per department -> print to PDF
Quantities are per sofa and already include recovery (gross = net / recovery), same as the BOM.
No prices on purpose: these slips go to the shop floor.
Run: python3 docs/tools/build-sofa-1600-issue-slips.py [fonts-inline.css]
"""
import base64, html, importlib.util, math, os, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "docs", "products", "sofa-1600")
CSS = open(sys.argv[1]).read() if len(sys.argv) > 1 and os.path.exists(sys.argv[1]) else ""
QTY = int(os.environ.get("QTY", "1"))
SUFFIX = "" if QTY == 1 else f"-x{QTY}"
spec = importlib.util.spec_from_file_location("dwg", os.path.join(os.path.dirname(__file__), "build-sofa-1600-drawing.py"))
dwg = importlib.util.module_from_spec(spec)
sys.argv = sys.argv[:1]
spec.loader.exec_module(dwg)
_, N_PLY = dwg.nest()
FAB_NET, FAB_BUY = dwg.fabric_meters()
TOTAL = {}                       # batch totals that are not qty x per-unit (nested together)
if QTY > 1:
    _, N_PLY_B = dwg.nest(QTY)
    pcs_b = [dict(p, qty=p["qty"] * QTY) for p in dwg.fabric_pieces()[0]]
    _, used_b = dwg.nest_roll(pcs_b)
    FAB_B = math.ceil(used_b / 1000 * 1.05 * 10) / 10          # one long lay, 5% for matching / ends
    TOTAL = {"M0005": N_PLY_B, "ผ้า B": FAB_B, "—ผ้าดิบ": round(FAB_NET + 0.3, 1)}
FT2 = 10.7639
REC = 0.7                       # foam / fibre recovery (factory standard)
STRIPS = dwg.STRIPS * 5

# same take-off as build-sofa-1600-bom.py: (foam, where, size text, area m2, inch)
FOAM = [
    ("FFC", "ที่นั่ง ชั้นหลัก", "1360 × 520 ตัดตามแปลนโค้ง", 1.36 * 0.52, 4),
    ("SQ", "ที่นั่ง ชั้นนุ่มบน + ห่อจมูกหน้า", "1360 × 670", 1.36 * 0.67, 1),
    ("SQ", "พนักพิง ด้านหน้า (แกะมน)", "1370 × 450", 1.37 * 0.45, 4),
    ("SQ", "พนักพิง หัวมนด้านบน", "1370 × 200", 1.37 * 0.20, 3),
    ("SQ", "พนักพิง ด้านหลัง", "1400 × 720", 1.40 * 0.72, 1),
    ("HR3", "หน้าฐาน + ข้างซ้าย", "หน้า 1400 × 220 + ข้าง 650 × 350", 0.54, 2),
    ("HR3", "ปลายซ้าย ปั้นทรงลาด", "650 × 600", 0.65 * 0.60, 4),
    ("HR3", "ม้วนแขน (แกะตามทรง)", "พื้นที่รวม 0.30 ตร.ม.", 0.30, 4),
    ("HR3", "หมอนข้าง ชั้นใน", "แถบรอบ 710 × 460 + ฝาวงรี 2", 0.41, 1.5),
    ("SQ", "หมอนข้าง ผิวนอก", "แถบรอบ 780 × 500 + ฝาวงรี 2", 0.45, 1),
]
FOAM_CODE = {("FFC", 4): "M0090", ("SQ", 1): "M0093", ("SQ", 4): "—", ("SQ", 3): "—", ("HR3", 2): "M0080",
             ("HR3", 4): "—", ("HR3", 1.5): "M0079+M0078"}
FOAM_NAME = {"FFC": "ฟองน้ำ FFC D26 (อีสเทอร์นโฟม) สีเขียวแก่", "SQ": "ฟองน้ำ SQ D20 (กรุงเทพโฟม) สีชมพู",
             "HR3": "ฟองน้ำ HR3 D26 (กรุงเทพโฟม)"}

# ---------------------------------------------------------------- departments
# item: (code, name, spec, unit, qty_per_sofa, note)
DEPTS = []


def dept(key, name, en, receive_from, send_to, items, extra_title=None, extra_cols=None, extra_rows=None, notes=()):
    DEPTS.append(dict(key=key, name=name, en=en, rf=receive_from, st=send_to, items=items,
                      xt=extra_title, xc=extra_cols, xr=extra_rows or [], notes=list(notes)))


cnc_rows = [(p["code"], p["name"], p["qty"], f'{p["poly"].bounds[2] - p["poly"].bounds[0]:.0f} × {p["poly"].bounds[3] - p["poly"].bounds[1]:.0f}', p["note"]) for p in dwg.PARTS]
dept("frame", "แผนกโครงไม้", "FRAME", "สโตร์ / ร้าน CNC", "แผนกสปริง", [
    ("M0005", "ไม้อัด 18 มม. (เบอร์ 20) 120×240", "ส่งตัด CNC ตามไฟล์ sofa-1600-cnc-18mm.dxf", "แผ่น", N_PLY, "รับคืนเป็นชิ้นงานตามตารางด้านล่าง"),
    ("M0011", "ไม้ดัด (ไม้อัดดัดโค้ง 4 มม.) 120×240", "ตัด SK1 ×2 · SK2 ×2 · SK3 ×1", "แผ่น", 2, "SK1 1430×330 · SK2 1430×760 · SK3 1160×440"),
    ("—", "กาว PVA D3", "ประกบซี่โครง + ทาไม้อัดดัดเต็มหน้า + ทุกรอยต่อ", "กก.", 1.0, "ประกบ R1-R5 · ไม้อัดดัดต้องเต็มหน้า"),
    ("M0040", "สกรู 2\"", "ยึดซี่โครงประกบ 2 ชั้น", "ตัว", 40, "R1-R5 ซี่ละ 8 ตัว"),
    ("M0039", "สกรู 1\"", "คานเข้าซี่โครง · แผ่น LPL · กล่องแขน", "ตัว", 110, ""),
    ("M0044", "ลวดแม็ก 1010/1006", "ยิงไม้อัดดัดทุก 40 มม.", "นัด", 1500, ""),
    ("M0053", "T-nut M8 (น็อตเฟืองจักร)", "ตอกที่ LPL ×4 · LP ×2 · PL3 ×2", "ตัว", 8, ""),
    ("—", "แหวนอีแปะ Ø40 หนา 3 มม.", "รองใต้ปีก T-nut ทุกตัว", "ตัว", 8, "สำคัญ: กันขาดึงทะลุ (ผลทดสอบโครงสร้าง)"),
], "ชิ้นงาน CNC ที่ต้องได้รับครบ (ตรวจนับก่อนประกอบ)", [("รหัส", 14), ("ชิ้น", 62), ("จำนวน", 14), ("ขนาดกรอบ มม.", 30), ("หมายเหตุ", 60)], cnc_rows,
    notes=["R1-R5 กาวประกบ 2 ชั้นก่อนทุกครั้ง (อัดแคลมป์ ทิ้งให้แห้ง)", "ไม้อัดดัด SK1/SK2 อ้อมมุมล่าง ทาบใต้คาน B1/B2 80 มม. ห้ามข้าม (เป็นคานรับน้ำหนัก)",
           "ตรวจระยะขา L3/L4 ที่ x715 (ไม่ใช่ x850)", "แบบ: sofa-1600-drawing.pdf แผ่นที่ 2-6"])

dept("spring", "แผนกสปริง", "SPRING / WEBBING", "แผนกโครงไม้", "แผนกฟองน้ำ", [
    ("M0136", "ยางยืด 5 ซม. (สีขาว)", f"{STRIPS} เส้น × ตัดยาว 520 มม.", "ม.", round(STRIPS * 0.52, 2), "ขึงหน้า-หลัง 4 เส้น/ช่อง"),
    ("M0151", "กระสอบพลาสติก", "ปูทับสายยางทั้งเบาะ", "ตร.ฟุต", round(0.75 * FT2 / 0.8, 1), ""),
    ("M0044", "ลวดแม็ก 1010/1006", "ปลายสายยาง 6 นัด/ปลาย + กระสอบ", "นัด", STRIPS * 2 * 6 + 60, ""),
], notes=["ยืดสายยาง 8-10% (ตัด 520 ขึงบนช่วง ~470)", "พับทบปลายสายยางก่อนยิงแม็ก 6 นัด ทุกปลาย (ผลทดสอบ: 4 นัดไม่พอ)",
          "เว้นระยะสายห่างหน้าซี่โครงเท่ากันทุกช่อง"])

foam_agg = {}
for f, w, size, a, t in FOAM:
    foam_agg.setdefault((f, t), 0.0)
    foam_agg[(f, t)] += a * FT2
foam_items = []
for (f, t), ft2 in sorted(foam_agg.items(), key=lambda k: (k[0][0], k[0][1])):
    gross = ft2 / REC
    note = f"เทียบแผ่น 50×80\" ≈ {gross / 27.78:.2f} แผ่น"
    if t == 1.5:
        note += " · ใช้ 1\" ซ้อน 0.5\" (หรือปอกจาก 2\")"
    foam_items.append((FOAM_CODE.get((f, t), "—"), f"{FOAM_NAME[f]} หนา {t:g}\"", "ตามตารางตัดด้านล่าง", "ตร.ฟุต", round(gross, 1), note))
foam_items += [("M0120", "ใยโพลีเอสเตอร์ FILL 200 GM", "ห่อทุกชิ้นก่อนหุ้ม", "ตร.ฟุต", round(7 * FT2 / REC, 1), ""),
               ("—", "กาวยางพ่นฟองน้ำ", "", "กระป๋อง", 1, "")]
dept("foam", "แผนกฟองน้ำ", "FOAM", "แผนกสปริง", "แผนกหุ้ม", foam_items,
     "ตารางตัดฟองน้ำ", [("ฟองน้ำ", 18), ("หนา", 12), ("ใช้ที่", 60), ("ขนาด (มม.)", 60), ("ชิ้น", 12)],
     [(f, f'{t:g}"', w, s, 1) for f, w, s, a, t in FOAM],
     notes=["ปริมาณเบิกรวมเผื่อเศษ 30% แล้ว (ได้เนื้อ 70%)", "ที่นั่งสำเร็จต้องสูง 420 มม. วัดหลังห่อใย", "แบบรูปตัด: sofa-1600-drawing.pdf แผ่นที่ 1"])

pcs, _ = dwg.fabric_pieces()
dept("pattern", "แผนกวางแบบ", "PATTERN & CUTTING", "สโตร์ผ้า", "แผนกหุ้ม", [
    ("ผ้า B", "ผ้าหุ้ม เกรด B หน้ากว้าง 140", f"ตามแพทเทิร์น F1-F9 · ผังตัด {FAB_NET:.2f} ม.", "ม.", FAB_BUY, "รวมเผื่อจัดลาย/ตัดเสีย 10%"),
    ("—ผ้าดิบ", "ผ้าดิบ (เฉพาะตัวแรก)", "ตัดลองแพทเทิร์นก่อนตัดผ้าจริง", "ม.", round(FAB_NET + 0.3, 1), "ตัวที่ 2 เป็นต้นไปไม่ต้องเบิก"),
], "ชิ้นแพทเทิร์นที่ต้องตัด (ขนาดตัดรวมเผื่อแล้ว)", [("รหัส", 12), ("ชิ้น", 60), ("จำนวน", 14), ("ขนาดตัด มม.", 30), ("หมายเหตุ", 64)],
    [(p["code"], p["name"], p["qty"], f'{p["poly"].bounds[2]:.0f} × {p["poly"].bounds[3]:.0f}', p["note"]) for p in pcs],
    notes=["ไฟล์แพทเทิร์น 1:1: sofa-1600-fabric-pattern.dxf · ผังตัด: แบบแผ่นที่ 7", "ผ้ามีลาย/มีทิศขน ต้องจัดผังใหม่ แจ้งหัวหน้าก่อนตัด",
           "เขียนรหัสชิ้น (F1-F9) ด้านหลังผ้าทุกชิ้น แล้วส่งแผนกหุ้มพร้อมใบนี้"])

dept("upholstery", "แผนกหุ้ม", "UPHOLSTERY", "แผนกฟองน้ำ (ตัวโซฟา) + แผนกวางแบบ (ชิ้นผ้า F1-F9)", "แผนก QC", [
    ("M0185", "ซิปม้วน", "ปลอกหมอนข้าง ด้านหลัง", "ม.", 0.7, ""),
    ("M0186", "หัวซิป", "", "ชิ้น", 1, ""),
    ("—", "ตาไก่ทองเหลือง Ø10", "ผ้าแขน 2 + ผ้าหมอนข้าง 2 (รูน็อตยึดหมอนข้าง)", "ชิ้น", 4, "ตำแหน่งรูตรง Z200 / Z380"),
    ("FORM", "ด้ายเย็บ", "ตามมาตรฐานโรงงาน (GLUE & THREAD)", "หลอด", 1, ""),
    ("M0044", "ลวดแม็ก 1010/1006", "ยิงผ้าเข้าโครง", "นัด", 400, ""),
], "ชิ้นผ้าที่ต้องได้รับจากแผนกวางแบบ (ตรวจนับ)", [("รหัส", 12), ("ชิ้น", 70), ("จำนวน", 14), ("รับแล้ว ✓", 24)],
    [(p["code"], p["name"], p["qty"], "☐") for p in pcs],
    notes=["หมอนข้างหุ้มแยก · เจาะรูตาไก่ให้ตรงรูน็อต", "ยิงแม็กใต้ฐานห่างกัน 30-40 มม. ผ้าตึงเรียบ ไม่ย่น", "ห้ามยิงแม็กทะลุสายยางยืด"])

dept("qc", "แผนก QC", "QC · ประกอบขา + ปิดก้น", "แผนกหุ้ม", "แผนก Packing", [
    ("M0155", "ขาไม้กลึง Ø50 × 80 สีเนเชอรัล", "L1-L6", "ขา", 6, ""),
    ("M0072", "แฮงกะโบ้ 8×60 + น็อต + แหวน", "ขันขาเข้า T-nut", "ชุด", 6, ""),
    ("M0165", "ยางรองขา สีดำ", "ใต้ขาทุกขา", "ชิ้น", 6, ""),
    ("M0170", "สปันบอนด์ 100 GM หน้ากว้าง 100", "ปิดใต้ฐาน", "ม.", round(1.5 / 0.9, 2), ""),
    ("M0063", "สกรูหัวจม M8 (ยาว 100) + แหวน", "ยึดหมอนข้างเข้ากล่องแขน", "ชุด", 2, "Master มี M8×70 · ต้องใช้ยาว 100"),
    ("M0044", "ลวดแม็ก 1010/1006", "ปิดก้น", "นัด", 150, ""),
], "เช็กลิสต์ QC ก่อนส่ง Packing", [("#", 8), ("ตรวจ", 110), ("ผ่าน", 18), ("ไม่ผ่าน", 18)],
    [(1, "ขาครบ 6 ขา ขันแน่น วางพื้นเรียบไม่โยก", "☐", "☐"), (2, "หมอนข้างแน่น น็อต 2 ตัวครบ ไม่คลอน", "☐", "☐"),
     (3, "นั่งทดสอบ 3 จุด ไม่มีเสียงลั่น/เสียงไม้", "☐", "☐"), (4, "ที่นั่งสูง 420 ±10 · รวม 800 ±10 · ยาว 1600 ±10", "☐", "☐"),
     (5, "ผ้าตึงเรียบ ไม่ย่น ตะเข็บตรง ไม่มีคราบ", "☐", "☐"), (6, "ใต้ฐานปิดเรียบ ไม่มีแม็กโผล่", "☐", "☐")],
    notes=["ตัวแรกของล็อต: ทดสอบกดถุงทราย 130 กก. ตามรายงานโครงสร้างก่อนส่งขาย"])

dept("packing", "แผนก Packing", "PACKING", "แผนก QC", "ส่งของ / คลัง", [
    ("—", "บับเบิ้ลกันกระแทก หน้ากว้าง 130 ซม.", "ห่อรอบตัวโซฟา 2 รอบ", "ม.", 8, "ประมาณ · ยืนยันกับแผนก"),
    ("M0150", "กระดาษแข็ง (มุมกันกระแทก)", "มุมบน-ล่าง + ขา", "ชิ้น", 8, ""),
    ("—", "ฟิล์มยืดพันสินค้า", "พันทับบับเบิ้ล", "ม.", 30, "ประมาณ"),
    ("—", "เทป OPP", "", "ม้วน", 0.5, ""),
    ("—", "ป้ายสินค้า + ใบรับประกัน/วิธีดูแล", "SOFA 1600 · ผ้า B · สี ___", "ชุด", 1, ""),
], notes=["ห่อขาแยกด้วยบับเบิ้ลก่อนห่อทั้งตัว", "ติดป้ายด้านที่ห้ามวางคว่ำ / ห้ามซ้อน",
          "ถ้าส่งแบบถอดหมอนข้าง: ใส่น็อต M8 2 ชุดในถุงซิป ติดใต้ฐาน"])

# ---------------------------------------------------------------- HTML (one page each)
e = lambda s: html.escape(str(s))
logo = open(os.path.join(ROOT, "docs/brand/logo.svg")).read().replace("currentColor", "#2B4368")
logo_uri = "data:image/svg+xml;base64," + base64.b64encode(logo.encode()).decode()
FLOW = ["แผนกโครงไม้", "แผนกสปริง", "แผนกฟองน้ำ", "แผนกหุ้ม", "แผนก QC", "แผนก Packing"]


def flow(cur):
    parts = []
    for f in FLOW:
        parts.append(f'<span class="{"on" if f == cur else ""}">{e(f.replace("แผนก", ""))}</span>')
    s = " → ".join(parts)
    vb = '<span class="on">วางแบบ</span>' if cur == "แผนกวางแบบ" else "<span>วางแบบ</span>"
    return f'<div class="flow">{s}<em>วางแบบ ตัดผ้าคู่ขนาน → ส่งแผนกหุ้ม: {vb}</em></div>'


pages = []
for d in DEPTS:
    q = lambda v: f"{v:,.2f}".rstrip("0").rstrip(".") if isinstance(v, float) else f"{v:,}"
    def tot(c, v):
        if QTY == 1:
            return ""
        t = TOTAL.get(c, v * QTY)
        return q(round(t, 2) if isinstance(t, float) else t)
    rows = "".join(f'<tr><td class="c">{i}</td><td>{e(c.lstrip("—") or "—")}</td><td><b>{e(n)}</b><div class="mut">{e(s)}</div></td><td>{e(u)}</td>'
                   f'<td class="r">{q(v)}</td><td class="box r">{tot(c, v)}</td><td class="box"></td><td class="mut">{e(nt)}{" · รวมจากผังตัดพร้อมกัน " + str(QTY) + " ตัว" if c in TOTAL and QTY > 1 else ""}</td></tr>'
                   for i, (c, n, s, u, v, nt) in enumerate(d["items"], 1))
    extra = ""
    if d["xt"]:
        th = "".join(f"<th>{e(c)}</th>" for c, _ in d["xc"])
        tr = "".join("<tr>" + "".join(f"<td>{e(v)}</td>" for v in r) + "</tr>" for r in d["xr"])
        extra = f'<h2>{e(d["xt"])}</h2><table class="x">{th and "<tr>" + th + "</tr>"}{tr}</table>'
    notes = "".join(f"<li>{e(n)}</li>" for n in d["notes"])
    pages.append(f"""<section class="page slip">
<header><img src="{logo_uri}"><div><div class="brand">CHAW CHER · ใบแจกวัสดุ / MATERIAL ISSUE</div><h1>{e(d["name"])} <small>{e(d["en"])}</small></h1></div>
<div class="meta">SOFA 1600 × 750 · REV B<br>ผ้า B · แขนขวา{" · ล็อต " + str(QTY) + " ตัว" if QTY > 1 else ""}</div></header>
{flow(d["name"])}
<div class="fields"><div>เลขที่ใบงาน / ออเดอร์<b></b></div><div>จำนวนผลิต<b>{QTY if QTY > 1 else ""}</b><i>ตัว</i></div><div>วันที่เบิก<b></b></div><div>รับงานจาก<span>{e(d["rf"])}</span></div><div>ส่งต่อ<span>{e(d["st"])}</span></div></div>
<table><tr><th>#</th><th>รหัส</th><th>รายการ</th><th>หน่วย</th><th>ต่อ 1 ตัว</th><th>{"รวม " + str(QTY) + " ตัว" if QTY > 1 else "× จำนวนตัว<br>= ต้องเบิก"}</th><th>จ่ายจริง</th><th>หมายเหตุ</th></tr>{rows}</table>
{extra}
<h2>ข้อควรทำ</h2><ul>{notes}</ul>
<div class="sign"><div>ผู้เบิก (แผนก)<b></b></div><div>ผู้จ่าย (สโตร์)<b></b></div><div>หัวหน้าแผนก<b></b></div><div>วันที่<b></b></div></div>
<footer>ปริมาณต่อ 1 ตัว รวมเผื่อเศษแล้ว · อ้างอิง BOM REV B และแบบ sofa-1600-drawing.pdf · ของเหลือคืนสโตร์พร้อมใบนี้</footer></section>""")

style = """@page{size:A4 portrait;margin:0}*{box-sizing:border-box}
body{margin:0;font-family:'Noto Sans Thai','Montserrat',sans-serif;color:#1E2733;font-size:9.3pt}
.page{width:210mm;min-height:297mm;padding:11mm 12mm 9mm;page-break-after:always;display:flex;flex-direction:column}.page:last-child{page-break-after:auto}
header{display:flex;align-items:center;gap:4mm;border-bottom:2px solid #83B7BF;padding-bottom:2.5mm}
header img{height:15mm}header .brand{font-family:Montserrat;letter-spacing:.1em;font-size:7.5pt;color:#958C7B;font-weight:500}
header h1{margin:0;font-size:19pt;color:#2B4368;font-weight:600}header h1 small{font-size:9pt;color:#958C7B;font-weight:500;letter-spacing:.08em}
header .meta{margin-left:auto;text-align:right;font-size:8pt;color:#6B7280}
.flow{margin:2.5mm 0;font-size:7.8pt;color:#6B7280}.flow span{padding:.4mm 1.5mm;border-radius:2mm}.flow .on{background:#2B4368;color:#fff}
.flow em{display:block;font-style:normal;margin-top:.8mm}
.fields{display:grid;grid-template-columns:1.3fr .9fr .9fr 1.2fr 1fr;gap:2mm;margin:2mm 0 3mm}
.fields div{font-size:7.8pt;color:#6B7280;border:1px solid #C9CED6;padding:1.5mm 2mm;min-height:11mm;position:relative}
.fields b{display:block;height:5mm}.fields i{position:absolute;right:2mm;bottom:1.5mm;font-style:normal}.fields span{display:block;color:#1E2733;font-size:8.5pt;margin-top:.8mm}
table{width:100%;border-collapse:collapse}th{background:#2B4368;color:#fff;font-weight:500;text-align:left;padding:1.4mm 1.6mm;font-size:8pt}
td{padding:1.3mm 1.6mm;border-bottom:1px solid #DDE1E6;vertical-align:top}.r{text-align:right;font-weight:600;font-size:10pt}.c{text-align:center}
td.box{border:1px solid #C9CED6;width:19mm}.mut{color:#6B7280;font-size:7.6pt}
.x th{background:#2F4554}.x td{font-size:8pt;padding:1mm 1.6mm}
h2{font-size:10pt;color:#2B4368;margin:3.5mm 0 1.5mm}ul{margin:0;padding-left:5mm}li{margin-bottom:.8mm}
.sign{margin-top:auto;padding-top:6mm;display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;break-inside:avoid}
.sign div{font-size:8pt;color:#6B7280}.sign b{display:block;border-bottom:1px solid #1E2733;height:9mm}
footer{margin-top:3mm;font-size:7.3pt;color:#958C7B;border-top:1px solid #E3E6EA;padding-top:1.5mm}"""
HTML_PAGES = pages
if __name__ == "__main__":
  open(os.path.join(OUT, f"sofa-1600-issue-slips{SUFFIX}.html"), "w").write(
    f'<!doctype html><html lang="th"><head><meta charset="utf-8"><title>SOFA 1600 Issue Slips</title><style>{CSS}{style}</style></head><body>{"".join(pages)}</body></html>')

# ---------------------------------------------------------------- XLSX (tab per department)
thin = Side(style="thin", color="C9CED6")
BD = Border(left=thin, right=thin, top=thin, bottom=thin)
F = Font(name="Noto Sans Thai", size=10); FB = Font(name="Noto Sans Thai", size=10, bold=True)
FH = Font(name="Noto Sans Thai", size=10, bold=True, color="FFFFFF"); FT = Font(name="Noto Sans Thai", size=15, bold=True, color="2B4368")
NAVY = PatternFill("solid", fgColor="2B4368"); YEL = PatternFill("solid", fgColor="FFF4C2"); GRY = PatternFill("solid", fgColor="2F4554")


def add_dept_tabs(wb, qty=QTY):
  for d in DEPTS:
      ws = wb.create_sheet(d["name"].replace("แผนก", "").strip()[:28])
      ws["A1"] = f'ใบแจกวัสดุ · {d["name"]} ({d["en"]})'; ws["A1"].font = FT
      ws["A2"] = f'SOFA 1600 × 750 · REV B · ผ้า B · รับงานจาก {d["rf"]} → ส่งต่อ {d["st"]}'; ws["A2"].font = F
      ws["A4"] = "จำนวนผลิต (ตัว)"; ws["A4"].font = FB
      ws["C4"] = qty; ws["C4"].fill = YEL; ws["C4"].font = Font(name="Noto Sans Thai", size=12, bold=True); ws["C4"].border = BD
      ws["E4"] = "เลขที่ใบงาน"; ws["E4"].font = FB; ws["F4"].fill = YEL; ws["F4"].border = BD
      ws["G4"] = "วันที่"; ws["G4"].font = FB; ws["H4"].fill = YEL; ws["H4"].border = BD
      cols = [("#", 5), ("รหัส", 12), ("รายการ", 40), ("สเปก / ใช้ที่", 40), ("หน่วย", 9), ("ต่อ 1 ตัว", 11), ("ต้องเบิก", 12), ("จ่ายจริง", 11), ("หมายเหตุ", 42)]
      for i, (n, w) in enumerate(cols, 1):
          c = ws.cell(row=6, column=i, value=n); c.font = FH; c.fill = NAVY; c.border = BD
          ws.column_dimensions[get_column_letter(i)].width = w
      r = 7
      for i, (code, n, s, u, v, nt) in enumerate(d["items"], 1):
          for c, val in enumerate([i, code.lstrip("—") or "—", n, s, u, v, (TOTAL[code] if code in TOTAL and qty == QTY and qty > 1 else f"=F{r}*$C$4"), None, nt], 1):
              x = ws.cell(row=r, column=c, value=val); x.font = FB if c in (3, 7) else F; x.border = BD
              x.alignment = Alignment(vertical="top", wrap_text=c in (3, 4, 9))
              if c in (6, 7):
                  x.number_format = "#,##0.##"
              if c == 8:
                  x.fill = YEL
          r += 1
      if d["xt"]:
          r += 1
          ws.cell(row=r, column=1, value=d["xt"]).font = FB
          r += 1
          for i, (n, _) in enumerate(d["xc"], 1):
              c = ws.cell(row=r, column=i, value=n); c.font = FH; c.fill = GRY; c.border = BD
          r += 1
          for row in d["xr"]:
              for c, val in enumerate(row, 1):
                  x = ws.cell(row=r, column=c, value=val); x.font = F; x.border = BD
                  x.alignment = Alignment(vertical="top", wrap_text=True)
              r += 1
      r += 1
      ws.cell(row=r, column=1, value="ข้อควรทำ").font = FB
      for n in d["notes"]:
          r += 1
          ws.cell(row=r, column=1, value="• " + n).font = F
      r += 2
      for i, t in enumerate(["ผู้เบิก ____________", "ผู้จ่าย (สโตร์) ____________", "หัวหน้าแผนก ____________"]):
          ws.cell(row=r, column=2 + i * 3, value=t).font = F
      ws.freeze_panes = "A7"
      ws.sheet_view.showGridLines = False
      ws.page_setup.orientation = "landscape"; ws.sheet_properties.pageSetUpPr.fitToPage = True
      ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 0


if __name__ == "__main__":
    wb = Workbook(); wb.remove(wb.active)
    add_dept_tabs(wb)
    wb.save(os.path.join(OUT, f"sofa-1600-issue-slips{SUFFIX}.xlsx"))
    for d in DEPTS:
        print(d["name"], len(d["items"]), "items")



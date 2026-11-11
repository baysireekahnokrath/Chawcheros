#!/usr/bin/env python3
"""
SOFA 1600 x 750 — BOM (bill of materials) workbook.

Output: docs/products/sofa-1600/sofa-1600-bom.xlsx
  1. BOM        every line: net qty, recovery, gross qty, unit price, amount (Excel formulas)
  2. ไม้ CNC    cut list of 18 mm plywood parts (from build-sofa-1600-drawing.py)
  3. ฟองน้ำ     foam take-off: area x thickness x price per sq ft per inch (supplier table)
  4. สรุป       totals by group + share of cost that is still an estimate

Columns follow docs/modules/costing/2-design.md (production.bom_lines + cost.component_prices):
net_qty / recovery / pieces / price source (ตารางราคา / ประเมิน / รอใส่).
Yellow cells = Bay/factory should replace with a real quote.
"""
import importlib.util, os, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "docs", "products", "sofa-1600", "sofa-1600-bom.xlsx")

# reuse the geometry from the drawing script (no files are written by importing it)
spec = importlib.util.spec_from_file_location("dwg", os.path.join(os.path.dirname(__file__), "build-sofa-1600-drawing.py"))
dwg = importlib.util.module_from_spec(spec)
sys.argv = sys.argv[:1]
spec.loader.exec_module(dwg)
_, N_PLY = dwg.nest()

NAVY, AQUA, OFF, TAUPE = "2B4368", "83B7BF", "F7F8F8", "958C7B"
YELLOW = "FFF4C2"
FT2 = 10.7639  # sq ft per m2

# foam supplier table (docs/modules/foam/0-data.md · 28/5/69) — price per sq ft per 1 inch
FOAM = {
    "FFC": ("อีสเทอร์นโฟม FFC D26 H15 (ที่นั่ง)", 9.18),
    "SQ": ("กรุงเทพโฟม SQ D20 H6 (ที่พิง)", 7.91),
    "HR3": ("กรุงเทพโฟม HR3 D26 H16 (นั่งข้าง)", 7.91),
}

# ---- foam take-off: (code, where, area m2, thickness inch, recovery, note)
FOAM_LINES = [
    ("FFC", "ที่นั่ง ชั้นหลัก", 1.36 * 0.52, 4, 0.85, "ตัดตามแปลนโค้ง 1360×520 · หนา 100 มม."),
    ("SQ", "ที่นั่ง ชั้นนุ่มบน + ห่อจมูกหน้า", 1.36 * 0.67, 1, 0.90, "25 มม. ใช้แผ่น 1\""),
    ("SQ", "พนักพิง ด้านหน้า (แกะมน)", 1.37 * 0.45, 4, 0.80, "80-120 มม."),
    ("SQ", "พนักพิง หัวมนด้านบน", 1.37 * 0.20, 3, 0.80, "หัวพนัก R60-70"),
    ("SQ", "พนักพิง ด้านหลัง", 1.40 * 0.72, 1, 0.90, "ทับไม้อัดดัด SK2"),
    ("HR3", "หน้าฐาน + ข้างซ้าย", 0.54, 2, 0.85, "หน้าฐานมน R110"),
    ("HR3", "ปลายซ้าย ปั้นทรงลาด", 0.65 * 0.60, 4, 0.75, "พนักลาด 800→600"),
    ("HR3", "ม้วนแขน (แกะ)", 0.30, 4, 0.75, "ปั้นรอบกล่องแขน"),
    ("HR3", "หมอนข้าง ชั้นใน", 0.41, 1.5, 0.80, "40 มม. หุ้มแกน PL"),
    ("SQ", "หมอนข้าง ผิวนอก", 0.45, 1, 0.85, "20 มม. ใช้แผ่น 1\""),
]

# ---- BOM lines: (group, code, item, spec, uom, net, recovery, pieces, price, source, note)
#   source: "ตารางราคา" = real supplier price · "ประเมิน" = rough market guess · "รอใส่" = unknown
P = "ประเมิน"
ply_area = sum(p["poly"].area * p["qty"] for p in dwg.PARTS) / 1e6

BOM = [
    ("1 โครงไม้", "PLY18", "ไม้อัด 18 มม. 1220×2440", "เกรดโครงเฟอร์นิเจอร์ กาว WBP · 17 รายการชิ้น (ดูแท็บ ไม้ CNC)", "แผ่น",
     N_PLY, 1, 1, 850, P, f"ใช้จริง {ply_area:.2f} ตร.ม. จัดผังได้ {N_PLY} แผ่น"),
    ("1 โครงไม้", "CNC", "ค่าตัด CNC", "ตามไฟล์ sofa-1600-cnc-18mm.dxf", "แผ่น", N_PLY, 1, 1, 400, P, "ค่าเครื่อง+ดอก ต่อแผ่น"),
    ("1 โครงไม้", "FLEX4", "ไม้อัดดัด 4 มม. 1220×2440", "SK1 ×1 · SK2 ×2 · SK3 ×1", "แผ่น", 2, 1, 1, 450, P,
     "SK2 ยาว 1430 กว้าง 640 วาง 2 ชิ้นในแผ่นเดียวไม่ได้ → 2 แผ่น"),
    ("1 โครงไม้", "GLUE", "กาว PVA D3", "ประกอบโครง", "กก.", 0.5, 1, 1, 120, P, ""),
    ("1 โครงไม้", "SCREW", "สกรูไม้ 1¼\" + ตะปูลม/ลวดแม็ก", "ทุกจุดต่อ + ยิงไม้อัดดัดทุก 50 มม.", "ชุด", 1, 1, 1, 80, P, ""),
    ("2 ที่นั่ง/ระบบรับน้ำหนัก", "WEB50", "สายยางยืด 50 มม. (Pirelli)", "15 เส้น × ตัด 470 มม. ยืด 8-10%", "ม.",
     round(15 * 0.47, 2), 0.9, 1, 25, P, "เผื่อหัวท้ายยิงแม็ก"),
    ("2 ที่นั่ง/ระบบรับน้ำหนัก", "HESS", "ผ้าใบกระสอบ (hessian)", "ปูทับสายยาง", "ตร.ม.", 0.75, 0.85, 1, 40, P, ""),
]
for i, (code, where, a, t, rec, note) in enumerate(FOAM_LINES):
    name, price = FOAM[code]
    BOM.append(("3 ฟองน้ำ", f"FOAM-{code}", f"ฟองน้ำ {code} · {where}", f"{name} · หนา {t}\"", "ตร.ฟ.-นิ้ว",
                round(a * FT2 * t, 2), rec, 1, price, "ตารางราคา", note + " · ราคา/ตร.ฟ./นิ้ว 28/5/69"))
BOM += [
    ("3 ฟองน้ำ", "FIBER", "ใยโพลีเอสเตอร์ 1 ออนซ์", "ห่อทุกชิ้นก่อนหุ้มผ้า", "ตร.ม.", 7, 0.9, 1, 35, P, ""),
    ("3 ฟองน้ำ", "SPRAY", "กาวยางพ่นฟองน้ำ", "", "กระป๋อง", 1, 1, 1, 180, P, ""),
    ("4 วัสดุหุ้ม", "FABRIC", "ผ้าหุ้ม (บูเคล่/เท็ดดี้) หน้ากว้าง 140", "ตัวโซฟา ~6.0 ม. + หมอนข้าง ~1.0 ม.", "ม.",
     7.0, 0.85, 1, None, "รอใส่", "เติมตามเกรดผ้าที่ลูกค้าเลือก · ปรับหลังตัดแพตเทิร์นตัวแรก"),
    ("4 วัสดุหุ้ม", "LINING", "ผ้าซับใต้ฐาน (ผ้าดิบ/สปันบอนด์)", "ปิดใต้ฐาน", "ม.", 1.2, 0.9, 1, 30, P, ""),
    ("4 วัสดุหุ้ม", "ZIP", "ซิป + ด้าย + ตาไก่ทองเหลือง Ø10", "ตาไก่ 4 ตัว (ผ้าแขน + ผ้าหมอนข้าง)", "ชุด", 1, 1, 1, 60, P, ""),
    ("5 ขา/ฮาร์ดแวร์", "LEG50", "ขาไม้กลึง Ø50 × 80", "ไม้ยาง/บีช สีเนเชอรัล ด้าน", "ขา", 6, 1, 1, 60, P, "ถ้าใช้ขามาตรฐานในสต็อก ให้เปลี่ยนรหัส"),
    ("5 ขา/ฮาร์ดแวร์", "HBOLT", "สกรูสองหัว M8 (hanger bolt)", "ฝังในขา", "ตัว", 6, 1, 1, 5, P, ""),
    ("5 ขา/ฮาร์ดแวร์", "TNUT", "T-nut M8", "LP ×6 · PL3 ×2", "ตัว", 8, 1, 1, 3, P, ""),
    ("5 ขา/ฮาร์ดแวร์", "BOLT", "น็อต M8×100 หัวจม + แหวน", "ยึดหมอนข้าง → AP3", "ตัว", 2, 1, 1, 10, P, ""),
    ("5 ขา/ฮาร์ดแวร์", "GLIDE", "ปุ่มสักหลาดรองขา", "", "ชิ้น", 6, 1, 1, 3, P, ""),
    ("6 ค่าแรง", "LAB-FR", "ค่าแรงประกอบโครง", "ประกอบ + ขึงสายยาง + ไม้อัดดัด", "ชม.", 6, 1, 1, None, "รอใส่", "Bay ใส่อัตราค่าแรง/ชม."),
    ("6 ค่าแรง", "LAB-FO", "ค่าแรงตัด/ปั้นฟองน้ำ", "", "ชม.", 6, 1, 1, None, "รอใส่", ""),
    ("6 ค่าแรง", "LAB-SW", "ค่าแรงตัดเย็บผ้า", "", "ชม.", 8, 1, 1, None, "รอใส่", ""),
    ("6 ค่าแรง", "LAB-UP", "ค่าแรงบุ/หุ้ม", "", "ชม.", 8, 1, 1, None, "รอใส่", ""),
    ("7 บรรจุ/ขนส่ง", "PACK", "บรรจุ (พลาสติกกันกระแทก + กล่อง/มุมกันกระแทก)", "ตัวโซฟา + หมอนข้างแยก", "ชุด", 1, 1, 1, 250, P, ""),
]

# ---------------------------------------------------------------- styles
thin = Side(style="thin", color="C9CED6")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
HEAD = PatternFill("solid", fgColor=NAVY)
GROUP = PatternFill("solid", fgColor="E3EEF0")
YFILL = PatternFill("solid", fgColor=YELLOW)
F_HEAD = Font(name="Noto Sans Thai", bold=True, color="FFFFFF", size=10)
F = Font(name="Noto Sans Thai", size=10)
F_B = Font(name="Noto Sans Thai", size=10, bold=True)
F_T = Font(name="Noto Sans Thai", size=14, bold=True, color=NAVY)
F_S = Font(name="Noto Sans Thai", size=9, color=TAUPE)


def title(ws, t, sub):
    ws["A1"] = t
    ws["A1"].font = F_T
    ws["A2"] = sub
    ws["A2"].font = F_S


def header(ws, row, cols):
    for i, (name, w) in enumerate(cols, 1):
        c = ws.cell(row=row, column=i, value=name)
        c.font, c.fill, c.border = F_HEAD, HEAD, BORDER
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[row].height = 30
    ws.freeze_panes = ws.cell(row=row + 1, column=1)


def cell(ws, r, c, v, fmt=None, bold=False, fill=None):
    x = ws.cell(row=r, column=c, value=v)
    x.font = F_B if bold else F
    x.border = BORDER
    x.alignment = Alignment(vertical="center", wrap_text=isinstance(v, str) and len(v) > 18)
    if fmt:
        x.number_format = fmt
    if fill:
        x.fill = fill
    return x


wb = Workbook()

# ---------------------------------------------------------------- 1. BOM
ws = wb.active
ws.title = "BOM"
title(ws, "BOM · SOFA 1600 × 750 (โครงไม้อัด CNC) · REV A",
      "ต่อ 1 ตัว · อ้างอิงแบบ sofa-1600-drawing.pdf · ช่องเหลือง = ราคาประเมิน/ยังไม่มีราคา ให้แทนด้วยใบเสนอราคาจริง")
cols = [("#", 5), ("หมวด", 20), ("รหัส", 11), ("รายการ", 36), ("สเปก", 40), ("หน่วย", 10), ("ใช้สุทธิ", 10),
        ("อัตราได้เนื้อ", 10), ("ชิ้น", 6), ("ต้องซื้อ", 10), ("ราคา/หน่วย", 11), ("ที่มาราคา", 11), ("รวม (บาท)", 12), ("หมายเหตุ", 44)]
header(ws, 4, cols)
r = 5
group_rows = {}
first = r
for i, (grp, code, item, spec, uom, net, rec, pcs, price, src, note) in enumerate(BOM, 1):
    cell(ws, r, 1, i)
    cell(ws, r, 2, grp)
    cell(ws, r, 3, code)
    cell(ws, r, 4, item)
    cell(ws, r, 5, spec)
    cell(ws, r, 6, uom)
    cell(ws, r, 7, net, "#,##0.00")
    cell(ws, r, 8, rec, "0%")
    cell(ws, r, 9, pcs)
    cell(ws, r, 10, f"=G{r}/H{r}*I{r}", "#,##0.00")
    cell(ws, r, 11, price, "#,##0.00", fill=None if src == "ตารางราคา" else YFILL)
    cell(ws, r, 12, src, fill=None if src == "ตารางราคา" else YFILL)
    cell(ws, r, 13, f"=IF(K{r}=\"\",0,J{r}*K{r})", "#,##0.00")
    cell(ws, r, 14, note)
    group_rows.setdefault(grp, []).append(r)
    r += 1
last = r - 1
cell(ws, r, 12, "รวมทั้งหมด", bold=True)
cell(ws, r, 13, f"=SUM(M{first}:M{last})", "#,##0.00", bold=True)
TOTAL = f"BOM!M{r}"
ws.auto_filter.ref = f"A4:N{last}"

# ---------------------------------------------------------------- 2. CNC parts
ws2 = wb.create_sheet("ไม้ CNC")
title(ws2, "รายการชิ้นไม้อัด 18 มม. (ตัด CNC)", "ตรงกับ sofa-1600-cnc-18mm.dxf · ขนาดกรอบ = กว้าง×ยาวสูงสุดของชิ้น")
header(ws2, 4, [("รหัส", 10), ("ชื่อชิ้น", 34), ("จำนวน", 8), ("กรอบ กว้าง", 11), ("กรอบ ยาว", 11), ("ตร.ม./ชิ้น", 11), ("ตร.ม. รวม", 11), ("รู/ร่อง", 30)])
r = 5
for p in dwg.PARTS:
    b = p["poly"].bounds
    a = p["poly"].area / 1e6
    for c, v, f in ((1, p["code"], None), (2, p["name"], None), (3, p["qty"], None), (4, round(b[2] - b[0]), "#,##0"),
                    (5, round(b[3] - b[1]), "#,##0"), (6, round(a, 4), "0.000"), (7, f"=C{r}*F{r}", "0.000"),
                    (8, p["note"], None)):
        cell(ws2, r, c, v, f)
    r += 1
cell(ws2, r, 6, "รวม", bold=True)
cell(ws2, r, 7, f"=SUM(G5:G{r - 1})", "0.00", bold=True)
cell(ws2, r + 1, 6, "แผ่น 1220×2440", bold=True)
cell(ws2, r + 1, 7, N_PLY, bold=True)
cell(ws2, r + 2, 6, "ใช้เนื้อไม้", bold=True)
cell(ws2, r + 2, 7, f"=G{r}/(G{r + 1}*2.9768)", "0%", bold=True)

# ---------------------------------------------------------------- 3. foam
ws3 = wb.create_sheet("ฟองน้ำ")
title(ws3, "ถอดปริมาณฟองน้ำ", "ราคา = พื้นที่ (ตร.ฟ.) × หนา (นิ้ว) × ราคา/ตร.ฟ./นิ้ว ÷ อัตราได้เนื้อ · ราคาจากตารางฟองน้ำ 28/5/69 (docs/modules/foam/0-data.md)")
header(ws3, 4, [("ฟองน้ำ", 9), ("ใช้ที่", 30), ("พื้นที่ ตร.ม.", 11), ("พื้นที่ ตร.ฟ.", 11), ("หนา นิ้ว", 9),
                 ("อัตราได้เนื้อ", 10), ("ราคา/ตร.ฟ./นิ้ว", 12), ("รวม (บาท)", 12), ("แผ่น 50×80\" เทียบ", 13), ("หมายเหตุ", 34)])
r = 5
for code, where, a, t, rec, note in FOAM_LINES:
    vals = [(1, code, None), (2, where, None), (3, round(a, 3), "0.000"), (4, f"=C{r}*{FT2}", "0.00"), (5, t, "0.0"),
            (6, rec, "0%"), (7, FOAM[code][1], "0.00"), (8, f"=D{r}*E{r}*G{r}/F{r}", "#,##0.00"),
            (9, f"=D{r}*E{r}/F{r}/(27.78*E{r})", "0.00"), (10, note, None)]
    for c, v, f in vals:
        cell(ws3, r, c, v, f)
    r += 1
cell(ws3, r, 7, "รวม", bold=True)
cell(ws3, r, 8, f"=SUM(H5:H{r - 1})", "#,##0.00", bold=True)
ws3.cell(row=r + 2, column=1, value="ช่อง “แผ่น เทียบ” = จำนวนแผ่น 50×80 นิ้วที่ใช้ ณ ความหนานั้น (ไว้คุยกับร้านฟองน้ำว่าสั่งเต็มแผ่นหรือสั่งตัด)").font = F_S

# ---------------------------------------------------------------- 4. summary
ws4 = wb.create_sheet("สรุป", 0)
title(ws4, "สรุปต้นทุนวัสดุ · SOFA 1600 × 750", "ต่อ 1 ตัว · ยังไม่รวมผ้าและค่าแรง จนกว่าจะใส่ราคาในแท็บ BOM")
header(ws4, 4, [("หมวด", 28), ("รวม (บาท)", 14), ("ส่วนที่เป็นราคาประเมิน/ยังไม่มี", 18), ("สัดส่วนของต้นทุน", 14)])
r = 5
for grp, rows in group_rows.items():
    rng = ",".join(f"BOM!M{x}" for x in rows)
    est = ",".join(f"IF(BOM!L{x}=\"ตารางราคา\",0,BOM!M{x})" for x in rows)
    cell(ws4, r, 1, grp)
    cell(ws4, r, 2, f"=SUM({rng})", "#,##0")
    cell(ws4, r, 3, f"=SUM({est})", "#,##0")
    cell(ws4, r, 4, f"=IF({TOTAL}=0,0,B{r}/{TOTAL})", "0%")
    r += 1
cell(ws4, r, 1, "รวม", bold=True)
cell(ws4, r, 2, f"=SUM(B5:B{r - 1})", "#,##0", bold=True)
cell(ws4, r, 3, f"=SUM(C5:C{r - 1})", "#,##0", bold=True)
cell(ws4, r, 4, f"=IF(B{r}=0,0,C{r}/B{r})", "0%", bold=True)
ws4.cell(row=r, column=5, value="← % ของต้นทุนที่ยังเป็นค่าประเมิน").font = F_S
notes = [
    "วิธีใช้",
    "1. ใส่ราคาผ้า (รหัส FABRIC) และอัตราค่าแรง/ชม. (LAB-*) ในแท็บ BOM ช่องเหลือง แล้วตัวเลขรวมจะคำนวณให้เอง",
    "2. ราคาที่ “ประเมิน” เป็นราคาตลาดคร่าวๆ ให้แทนด้วยใบเสนอราคาจริงของโรงงาน/ร้านวัสดุ",
    "3. ราคาฟองน้ำมาจากตารางราคาจริง (กรุงเทพโฟม / อีสเทอร์นโฟม 28/5/69) · ปริมาณเป็นค่าถอดจากแบบ ให้ปรับหลังตัดตัวแรก",
    "4. จำนวนผ้าเป็นค่าประมาณจากพื้นที่ผิว ให้ช่างตัดแพตเทิร์นตัวแรกแล้วแก้ช่อง “ใช้สุทธิ”",
]
for i, t in enumerate(notes):
    c = ws4.cell(row=r + 2 + i, column=1, value=t)
    c.font = F_B if i == 0 else F

for w in wb.worksheets:
    w.sheet_view.showGridLines = False
    w.page_setup.orientation = "landscape"
    w.page_setup.fitToWidth = 1
    w.sheet_properties.pageSetUpPr.fitToPage = True
    w.page_setup.fitToHeight = 0

wb.save(OUT)

# print computed totals for a quick check
tot = est = 0
by = {}
for grp, code, item, spec, uom, net, rec, pcs, price, src, note in BOM:
    amt = (net / rec * pcs * price) if price else 0
    by[grp] = by.get(grp, 0) + amt
    tot += amt
    est += 0 if src == "ตารางราคา" else amt
for g, v in by.items():
    print(f"{g:28} {v:10,.0f}")
print(f"{'รวม':28} {tot:10,.0f}   estimated share {est / tot:.0%}")
print(OUT)

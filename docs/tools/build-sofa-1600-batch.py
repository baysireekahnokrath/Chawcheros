#!/usr/bin/env python3
"""
SOFA 1600 (REV B) — production package for a batch (default 15 units).

Output (docs/products/sofa-1600/):
  sofa-1600-x{N}.xlsx               สรุป · ใบสั่งซื้อ · ผังไม้ CNC · คุ้มทุน CNC · ใบแจกวัสดุ 7 แผนก
  sofa-1600-x{N}.html               A4 portrait pages (print to PDF)
  sofa-1600-cnc-18mm-x{N}.dxf       all plywood parts of the batch nested together
Purchase prices = purchase price @ from the factory Master_วัสดุ (or Bay / estimate, marked).
Run: QTY=15 python3 docs/tools/build-sofa-1600-batch.py [fonts-inline.css]
"""
import base64, html, importlib.util, math, os, re, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

QTY = int(os.environ.get("QTY", "15"))
os.environ["QTY"] = str(QTY)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "docs", "products", "sofa-1600")
CSSARG = sys.argv[1] if len(sys.argv) > 1 else ""
spec = importlib.util.spec_from_file_location("slips", os.path.join(os.path.dirname(__file__), "build-sofa-1600-issue-slips.py"))
sl = importlib.util.module_from_spec(spec)
sys.argv = [sys.argv[0], CSSARG]
spec.loader.exec_module(sl)
dwg = sl.dwg
SHEET_M2 = 1.22 * 2.44
PART_M2 = sum(p["poly"].area * p["qty"] for p in dwg.PARTS) / 1e6
placed, NB = dwg.nest(QTY)
dwg.write_dxf(placed, NB, fname=f"sofa-1600-cnc-18mm-x{QTY}.dxf", title=f"SOFA-1600 x{QTY}", one_to_one=False)
N1 = sl.N_PLY
FAB_B = sl.TOTAL["ผ้า B"]

# ---------------------------------------------------------------- purchase list
# (group, item, code, need, need_unit, buy_unit, buy_qty, price_per_buy_unit, price_source, dept, note)
P = []
P.append(("โครงไม้", "ไม้อัด 18 มม. (เบอร์ 20) 120×240", "M0005", NB, "แผ่น", "แผ่น", NB, 800, "Master @", "โครงไม้",
          f"ผังตัดรวม {QTY} ตัว (ทีละตัวต้องใช้ {N1 * QTY})"))
P.append(("โครงไม้", "ค่าตัด CNC (ตามพื้นที่ชิ้นงานจริง)", "Bay", round(PART_M2 * QTY, 2), "ตร.ม.", "ตร.ม.", round(PART_M2 * QTY, 2), 500, "Bay แจ้ง", "โครงไม้",
          f"{PART_M2:.2f} ตร.ม./ตัว"))
P.append(("โครงไม้", "ไม้ดัด (ไม้อัดดัดโค้ง 4 มม.) 120×240", "M0011", 2 * QTY, "แผ่น", "แผ่น", 2 * QTY, 350, "Master @", "โครงไม้",
          "SK2 1 ชิ้น/แผ่น จึงลดไม่ได้"))
for (f, t), ft2 in sorted(sl.foam_agg.items(), key=lambda k: (k[0][0], k[0][1])):
    need = ft2 / sl.REC * QTY
    per_in = {"FFC": 255.15, "SQ": 220, "HR3": 220}[f]
    parts = [(1, "M0079"), (0.5, "M0078")] if t == 1.5 else [(t, sl.FOAM_CODE.get((f, t), "—"))]
    for tt, code in parts:
        P.append(("ฟองน้ำ", f"{sl.FOAM_NAME[f]} หนา {tt:g}\" (แผ่น 50×80\")", code, round(need, 1), "ตร.ฟุต", "แผ่น",
                  math.ceil(need / 27.78), round(per_in * tt, 2), "ตารางฟองน้ำ / PO", "ฟองน้ำ",
                  "ซ้อน 1\"+0.5\" แทน 1.5\"" if t == 1.5 else ""))
need = 7 * sl.FT2 / sl.REC * QTY
P.append(("ฟองน้ำ", "ใยโพลีเอสเตอร์ FILL 200 GM", "M0120", round(need, 1), "ตร.ฟุต", "ชิ้น 17.5 ตร.ฟ.", math.ceil(need / 17.5), 27.65, "Master @", "ฟองน้ำ", ""))
P.append(("ฟองน้ำ", "กาวยางพ่นฟองน้ำ", "—", QTY, "กระป๋อง", "กระป๋อง", QTY, None, "รวมในเหมา GLUE", "ฟองน้ำ", ""))
web = sl.STRIPS * 0.52 * QTY
P.append(("สปริง", "ยางยืด 5 ซม. (สีขาว)", "M0136", round(web, 1), "ม.", "ม.", math.ceil(web / 10) * 10, 15.95, "Master @", "สปริง", "ถามขนาดม้วนกับร้าน"))
P.append(("สปริง", "กระสอบพลาสติก", "M0151", round(0.75 * sl.FT2 / 0.8 * QTY, 1), "ตร.ฟุต", "ตร.ฟุต", math.ceil(0.75 * sl.FT2 / 0.8 * QTY), 1.25, "Master (คิดต้นทุน)", "สปริง", ""))
P.append(("ผ้า", "ผ้าหุ้ม เกรด B หน้ากว้าง 140", "ผ้า B", FAB_B, "ม.", "ม.", FAB_B, 450, "Bay แจ้ง", "วางแบบ",
          f"ปูยาวตัดพร้อมกัน {QTY} ตัว (ทีละตัว {sl.FAB_BUY * QTY:.1f} ม.)"))
P.append(("ผ้า", "ผ้าดิบ (ลองแพทเทิร์นตัวแรก)", "—", round(sl.FAB_NET + 0.3, 1), "ม.", "ม.", math.ceil(sl.FAB_NET + 0.3), None, "—", "วางแบบ", ""))
P.append(("ผ้า", "สปันบอนด์ 100 GM หน้ากว้าง 100", "M0170", round(1.5 / 0.9 * QTY, 1), "ม.", "ม.", math.ceil(1.5 / 0.9 * QTY), 10, "Master @", "QC", ""))
P.append(("ผ้า", "ซิปม้วน", "M0185", round(0.7 * QTY, 1), "ม.", "ม.", math.ceil(0.7 * QTY), 7.46, "Master @", "หุ้ม", ""))
P.append(("ผ้า", "หัวซิป", "M0186", QTY, "ชิ้น", "ชิ้น", QTY, 1.31, "Master @", "หุ้ม", ""))
P.append(("ผ้า", "ตาไก่ทองเหลือง Ø10", "—", 4 * QTY, "ชิ้น", "ชิ้น", 4 * QTY, 3, "ประเมิน", "หุ้ม", "ไม่มีใน Master"))
for name, code, n, u, pr, src, d, nt in [
        ("ขาไม้กลึง Ø50 × 80", "M0155", 6, "ขา", 80, "Master @", "QC", ""),
        ("แฮงกะโบ้ 8×60 + น็อต + แหวน", "M0072", 6, "ชุด", 2.72, "Master @", "QC", ""),
        ("ยางรองขา สีดำ", "M0165", 6, "ชิ้น", 2, "Master (คิดต้นทุน)", "QC", ""),
        ("สกรูหัวจม M8 ยาว 100 + แหวน", "M0063", 2, "ชุด", 5.5, "Master @ (ยาว 70)", "QC", "ราคาอ้างอิง M8×70"),
        ("T-nut M8 (น็อตเฟืองจักร)", "M0053", 8, "ตัว", 1.5, "Master (คิดต้นทุน)", "โครงไม้", ""),
        ("แหวนอีแปะ Ø40 หนา 3 มม.", "—", 8, "ตัว", 3, "ประเมิน", "โครงไม้", "ไม่มีใน Master")]:
    P.append(("ฮาร์ดแวร์", name, code, n * QTY, u, u, n * QTY, pr, src, d, nt))
P.append(("สิ้นเปลือง", "กาว ด้าย ลวดแม็ก สกรู (เหมาต่อตัวตามฟอร์มโรงงาน)", "FORM", QTY, "ตัว", "ชุด", QTY, 200, "ฟอร์ม costing", "ทุกแผนก",
          "ครอบคลุม PVA ~1 กก. สกรู ~150 ลวดแม็ก ~2,300 ด้าย ต่อตัว"))
P.append(("สิ้นเปลือง", "เหล็ก/คลิป (เหมาต่อตัว)", "FORM", QTY, "ตัว", "ชุด", QTY, 20, "ฟอร์ม costing", "โครงไม้", ""))
for name, n, u in [("บับเบิ้ลกันกระแทก หน้ากว้าง 130", 8, "ม."), ("กระดาษแข็งมุมกันกระแทก (M0150)", 8, "ชิ้น"),
                   ("ฟิล์มยืดพันสินค้า", 30, "ม."), ("เทป OPP", 0.5, "ม้วน"), ("ป้ายสินค้า + ใบดูแล", 1, "ชุด")]:
    P.append(("แพ็คกิ้ง", name, "—", n * QTY, u, u, math.ceil(n * QTY), None, "ยังไม่มีราคา", "Packing", "ประมาณ"))

for r in P:
    pass
tot = sum((r[6] * r[7]) for r in P if r[7] is not None)
missing = [r[1] for r in P if r[7] is None]
saving_ply = (N1 * QTY - NB) * 800
saving_fab = (sl.FAB_BUY * QTY - FAB_B) * 450

# ---------------------------------------------------------------- CNC payback
MACHINES = [("CNC Router 1325 ธรรมดา", 220000, "ประกาศขายออนไลน์ (ผลค้นหา) — ยืนยันราคา"),
            ("1325 โต๊ะดูดสุญญากาศ + เครื่องดูดฝุ่น", 350000, "ประเมิน"),
            ("1325 เปลี่ยนดอกอัตโนมัติ (ATC)", 650000, "ประเมิน")]
OUT_PER_SHEET = 500 * SHEET_M2                       # outsourced, sheet-area basis
OUT_PER_SHEET_PART = 500 * PART_M2 * QTY / NB        # outsourced, part-area basis
VAR = 13 * 0.5 * 5 + 40 + 10                         # kWh x THB + bits + misc per sheet
OPERATOR, MAINT = 15000, 2000
SHEETS_PER_SOFA = NB / QTY


def payback(price, sofas, oper=True, basis=OUT_PER_SHEET_PART):
    sheets = sofas * SHEETS_PER_SOFA
    gain = sheets * (basis - VAR) - MAINT - (OPERATOR if oper else 0)
    return price / gain if gain > 0 else None


# ---------------------------------------------------------------- XLSX
thin = Side(style="thin", color="C9CED6")
BD = Border(left=thin, right=thin, top=thin, bottom=thin)
F = Font(name="Noto Sans Thai", size=10); FB = Font(name="Noto Sans Thai", size=10, bold=True)
FH = Font(name="Noto Sans Thai", size=10, bold=True, color="FFFFFF"); FT = Font(name="Noto Sans Thai", size=15, bold=True, color="2B4368")
NAVY = PatternFill("solid", fgColor="2B4368"); YEL = PatternFill("solid", fgColor="FFF4C2")


def head(ws, r, cols):
    for i, (n, w) in enumerate(cols, 1):
        c = ws.cell(row=r, column=i, value=n); c.font = FH; c.fill = NAVY; c.border = BD
        c.alignment = Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[get_column_letter(i)].width = w


def cell(ws, r, c, v, fmt=None, bold=False, fill=None):
    x = ws.cell(row=r, column=c, value=v); x.font = FB if bold else F; x.border = BD
    x.alignment = Alignment(vertical="top", wrap_text=isinstance(v, str) and len(v) > 20)
    if fmt: x.number_format = fmt
    if fill: x.fill = fill
    return x


wb = Workbook()
ws = wb.active; ws.title = "สรุป"
ws["A1"] = f"ใบสั่งผลิต SOFA 1600 × 750 · REV B · ผ้า B · {QTY} ตัว"; ws["A1"].font = FT
ws["A2"] = "ราคา = ราคาซื้อ @ จาก Master_วัสดุ ของโรงงาน (ก่อน VAT) · ช่องเหลืองแก้ได้"; ws["A2"].font = F
rows = [("จำนวนผลิต", QTY, "ตัว"), ("ไม้อัด 18 มม.", NB, f"แผ่น (ทีละตัว {N1 * QTY} แผ่น · ประหยัด {N1 * QTY - NB})"),
        ("ไม้อัดดัด 4 มม.", 2 * QTY, "แผ่น"), ("ผ้า B", FAB_B, f"ม. (ทีละตัว {sl.FAB_BUY * QTY:.1f} ม.)"),
        ("ค่าวัสดุ + ค่าตัด CNC รวม", "='ใบสั่งซื้อ'!I{}".format(len(P) + 5), "บาท (ยังไม่รวม: " + ", ".join(missing) + ")"),
        ("เฉลี่ยต่อตัว", "=B8/B4", "บาท"),
        ("ประหยัดจากผลิตพร้อมกัน (ไม้อัด + ผ้า)", round(saving_ply + saving_fab), "บาท เทียบกับซื้อ/ตัดทีละตัว"),
        ("ยังไม่รวม", "ค่าแรง · บรรจุ · กล่อง · ขนส่ง", "")]
for i, (a, b, c) in enumerate(rows, 4):
    cell(ws, i, 1, a, bold=True); cell(ws, i, 2, b, "#,##0.##", fill=YEL if i == 4 else None); cell(ws, i, 3, c)
ws.column_dimensions["A"].width = 38; ws.column_dimensions["B"].width = 16; ws.column_dimensions["C"].width = 70

wp = wb.create_sheet("ใบสั่งซื้อ")
wp["A1"] = f"ใบสั่งซื้อวัสดุ · {QTY} ตัว"; wp["A1"].font = FT
head(wp, 3, [("หมวด", 11), ("รายการ", 40), ("รหัส", 9), ("ต้องใช้", 10), ("หน่วยใช้", 9), ("หน่วยซื้อ", 13), ("จำนวนซื้อ", 10),
             ("ราคา/หน่วยซื้อ", 12), ("รวม (บาท)", 13), ("ที่มาราคา", 16), ("แผนกที่ใช้", 10), ("หมายเหตุ", 46)])
r = 4
for g, n, code, need, nu, bu, bq, pr, src, d, nt in P:
    vals = [g, n, code, need, nu, bu, bq, pr, f'=IF(H{r}="","",G{r}*H{r})', src, d, nt]
    for c, v in enumerate(vals, 1):
        cell(wp, r, c, v, "#,##0.##" if c in (4, 7, 8, 9) else None, fill=YEL if c in (7, 8) else None)
    r += 1
cell(wp, r + 1, 8, "รวม", bold=True); cell(wp, r + 1, 9, f"=SUM(I4:I{r - 1})", "#,##0", bold=True)
wp.freeze_panes = "C4"

wn = wb.create_sheet("ผังไม้ CNC")
wn["A1"] = f"ผังตัดไม้อัด 18 มม. รวม {QTY} ตัว · {NB} แผ่น · ไฟล์ sofa-1600-cnc-18mm-x{QTY}.dxf"; wn["A1"].font = FT
head(wn, 3, [("แผ่นที่", 8), ("จำนวนชิ้น", 10), ("พื้นที่ชิ้นงาน ตร.ม.", 14), ("ใช้เนื้อไม้", 10), ("ชิ้นในแผ่น", 120)])
for si in range(NB):
    its = [p for p in placed if p["pos"][0] == si]
    a = sum(p["final"].area for p in its) / 1e6
    for c, v in enumerate([si + 1, len(its), round(a, 3), a / SHEET_M2, ", ".join(p["code"] for p in its)], 1):
        cell(wn, 4 + si, c, v, "0%" if c == 4 else ("0.000" if c == 3 else None))

wc = wb.create_sheet("คุ้มทุน CNC")
wc["A1"] = "ถ้าซื้อเครื่อง CNC เอง คุ้มทุนเมื่อไหร่"; wc["A1"].font = FT
wc["A2"] = "ช่องเหลือง = สมมติฐาน แก้ได้ · ผลลัพธ์คำนวณใหม่เอง"; wc["A2"].font = F
assum = [("ค่าจ้างตัดข้างนอก (บาท/ตร.ม. ชิ้นงาน)", 500), ("พื้นที่ชิ้นงานเฉลี่ยต่อแผ่น (ตร.ม.)", round(PART_M2 * QTY / NB, 4)),
         ("แผ่นต่อโซฟา 1 ตัว (ผลิตเป็นล็อต)", round(SHEETS_PER_SOFA, 3)), ("ค่าไฟ+ดอก+จิปาถะ ต่อแผ่น (บาท)", round(VAR)),
         ("ค่าจ้างช่าง CNC ต่อเดือน (0 = ใช้คนเดิม)", OPERATOR), ("ค่าบำรุงรักษาต่อเดือน", MAINT)]
for i, (a, b) in enumerate(assum, 4):
    cell(wc, i, 1, a, bold=True); cell(wc, i, 2, b, "#,##0.###", fill=YEL)
head(wc, 11, [("เครื่อง", 40), ("ราคาเครื่อง", 14), ("ที่มา", 30), ("15 ตัว/เดือน", 14), ("30 ตัว/เดือน", 14), ("60 ตัว/เดือน", 14)])
for i, (n, pr, src) in enumerate(MACHINES, 12):
    cell(wc, i, 1, n); cell(wc, i, 2, pr, "#,##0", fill=YEL); cell(wc, i, 3, src)
    for j, sofas in enumerate((15, 30, 60)):
        col = get_column_letter(4 + j)
        f = f'=IFERROR(IF(B{i}/({sofas}*$B$6*($B$4*$B$5-$B$7)-$B$8-$B$9)>120,"ไม่คุ้ม",IF(({sofas}*$B$6*($B$4*$B$5-$B$7)-$B$8-$B$9)<=0,"ไม่คุ้ม",B{i}/({sofas}*$B$6*($B$4*$B$5-$B$7)-$B$8-$B$9))),"ไม่คุ้ม")'
        cell(wc, i, 4 + j, f, '0.0" เดือน"')
wc["A16"] = "สูตร: เดือนที่คืนทุน = ราคาเครื่อง ÷ [ (แผ่น/เดือน × (ค่าจ้างตัดต่อแผ่น − ค่าแปรผันต่อแผ่น)) − ค่าช่าง − ค่าบำรุง ]"; wc["A16"].font = F
wc["A17"] = f"ค่าจ้างตัดคิดตามพื้นที่ชิ้นงานจริง {PART_M2:.2f} ตร.ม./ตัว (ไม่คิดทั้งแผ่น)"; wc["A17"].font = F

sl.add_dept_tabs(wb, QTY)
for w in wb.worksheets:
    w.sheet_view.showGridLines = False
wb.save(os.path.join(OUT, f"sofa-1600-x{QTY}.xlsx"))

# ---------------------------------------------------------------- HTML
e = lambda s: html.escape(str(s))
q = lambda v: "" if v is None else (f"{v:,.2f}".rstrip("0").rstrip(".") if isinstance(v, float) else f"{v:,}")
logo = open(os.path.join(ROOT, "docs/brand/logo.svg")).read().replace("currentColor", "#2B4368")
logo_uri = "data:image/svg+xml;base64," + base64.b64encode(logo.encode()).decode()


def hdr(t, sub=""):
    return (f'<header><img src="{logo_uri}"><div><div class="brand">CHAW CHER · ใบสั่งผลิต</div><h1>{e(t)}</h1></div>'
            f'<div class="meta">SOFA 1600 × 750 · REV B<br>ผ้า B · {QTY} ตัว{(" · " + sub) if sub else ""}</div></header>')


prow = "".join(f'<tr><td>{e(g)}</td><td><b>{e(n)}</b><div class="mut">{e(nt)}</div></td><td>{e(c)}</td><td class="r">{q(nd)} {e(nu)}</td>'
               f'<td class="r"><b>{q(bq)}</b> {e(bu)}</td><td class="r">{q(pr)}</td><td class="r">{q(round(bq * pr)) if pr is not None else "—"}</td><td class="mut">{e(d)}</td></tr>'
               for g, n, c, nd, nu, bu, bq, pr, src, d, nt in P)
page1 = f"""<section class="page">{hdr(f"ใบสั่งผลิต {QTY} ตัว · สรุป + ใบสั่งซื้อ")}
<div class="kpis"><div><span>ค่าวัสดุ + ค่าตัด CNC</span><b>{tot:,.0f}</b><i>บาท</i></div><div><span>เฉลี่ยต่อตัว</span><b>{tot / QTY:,.0f}</b><i>บาท</i></div>
<div><span>ไม้อัด 18 มม.</span><b>{NB}</b><i>แผ่น (ทีละตัว {N1 * QTY})</i></div><div><span>ประหยัดจากผลิตพร้อมกัน</span><b>{saving_ply + saving_fab:,.0f}</b><i>บาท</i></div></div>
<p class="warn">ยังไม่รวม ค่าแรง · บรรจุ · กล่อง · ขนส่ง · ราคาวัสดุแพ็คกิ้ง/ผ้าดิบ/กาวพ่น (ยังไม่มีราคา)</p>
<table class="p"><tr><th>หมวด</th><th>รายการ</th><th>รหัส</th><th>ต้องใช้</th><th>ซื้อ</th><th>ราคา/หน่วย</th><th>รวม</th><th>แผนก</th></tr>{prow}
<tr class="tot"><td colspan="6">รวม</td><td class="r">{tot:,.0f}</td><td></td></tr></table></section>"""

thumbs = []
s_ = 0.037
for si in range(NB):
    its = [p for p in placed if p["pos"][0] == si]
    paths = "".join(f'<path d="{"".join("M" + " L".join(f"{x * s_:.1f},{(dwg.SHEET_H - y) * s_:.1f}" for x, y in ring.coords) + "Z" for ring in [p["final"].exterior] + list(p["final"].interiors))}" fill="#EEF5F6" stroke="#2B4368" stroke-width="0.25" fill-rule="evenodd"/>' for p in its)
    a = sum(p["final"].area for p in its) / 1e6
    thumbs.append(f'<figure><svg viewBox="0 0 {dwg.SHEET_W * s_:.1f} {dwg.SHEET_H * s_:.1f}" width="{dwg.SHEET_W * s_:.1f}mm"><rect width="100%" height="100%" fill="#F7F8F8" stroke="#1E2733" stroke-width="0.3"/>{paths}</svg>'
                  f'<figcaption>แผ่นที่ {si + 1} · {len(its)} ชิ้น · ใช้เนื้อไม้ {a / SHEET_M2:.0%}</figcaption></figure>')
nest_pages = []
for k in range(0, NB, 8):
    nest_pages.append(f'<section class="page">{hdr(f"ผังตัดไม้อัด {QTY} ตัว · {NB} แผ่น", f"หน้า {k // 8 + 1}")}'
                      f'<p class="note">ไฟล์ CNC: sofa-1600-cnc-18mm-x{QTY}.dxf · วางตามรูปทรงจริง ซี่โครงกลับหัวสลับเป็นคู่ · ใช้เนื้อไม้รวม {PART_M2 * QTY / (NB * SHEET_M2):.0%}</p>'
                      f'<div class="grid">{"".join(thumbs[k:k + 8])}</div></section>')

def fm(v):
    return "ไม่คุ้ม" if (v is None or v > 120) else f"{v:.0f} ด."


pb_rows = ""
for n, pr, src in MACHINES:
    cells = ""
    for sofas in (15, 30, 60):
        a = payback(pr, sofas, True); b = payback(pr, sofas, False)
        cells += f'<td class="r">{fm(a)} / {fm(b)}</td>'
    pb_rows += f'<tr><td><b>{e(n)}</b><div class="mut">{e(src)}</div></td><td class="r">{pr:,}</td>{cells}</tr>'
pb_rows2 = ""
for n, pr, src in MACHINES[:2]:
    cells = "".join(f'<td class="r">{(lambda v: ("%.0f" % v) if v else "ไม่คุ้ม")(payback(pr, s2, True, OUT_PER_SHEET_PART))} / {(lambda v: ("%.0f" % v) if v else "—")(payback(pr, s2, False, OUT_PER_SHEET_PART))}</td>' for s2 in (15, 30, 60))
    pb_rows2 += f'<tr><td><b>{e(n)}</b></td><td class="r">{pr:,}</td>{cells}</tr>'
page_cnc = f"""<section class="page">{hdr("ถ้าซื้อเครื่อง CNC เอง คุ้มทุนเมื่อไหร่")}
<h2>เดือนที่คืนทุน · จ้างช่างใหม่ / ใช้คนเดิม · ตัดแต่โซฟารุ่นนี้ (ไม่คุ้ม = เกิน 10 ปี)</h2>
<table><tr><th>เครื่อง</th><th>ราคา</th><th>15 ตัว/เดือน</th><th>30 ตัว/เดือน</th><th>60 ตัว/เดือน</th></tr>{pb_rows}</table>
<p class="note">ค่าจ้างตัดข้างนอก 500 บาท/ตร.ม. ตามพื้นที่ชิ้นงานจริง = {PART_M2 * 500:,.0f} บาท/ตัว (~{OUT_PER_SHEET_PART:,.0f} บาท ต่อแผ่นที่ตัด) · โซฟา 1 ตัวใช้ {SHEETS_PER_SOFA:.2f} แผ่นเมื่อผลิตเป็นล็อต ·
ค่าแปรผันถ้าตัดเอง ~{VAR:.0f} บาท/แผ่น (ไฟ 13 kW × 0.5 ชม. × 5 บาท + ดอก 40 + จิปาถะ 10) · ช่างใหม่ {OPERATOR:,} บาท/เดือน · บำรุงรักษา {MAINT:,} บาท/เดือน</p>

<h2>สิ่งที่ต้องคิดเพิ่ม (ไม่อยู่ในตัวเลข)</h2><ul>
<li>เครื่องตัดได้ ~10-12 แผ่น/วัน (~250 แผ่น/เดือน) · โซฟารุ่นนี้ 15 ตัว/เดือนใช้แค่ {15 * SHEETS_PER_SOFA:.0f} แผ่น → ต้องเอาไปตัดสินค้ารุ่นอื่นด้วยถึงจะคุ้มเร็ว</li>
<li>ได้เวลาคืน: ไม่ต้องรอคิวร้าน แก้แบบแล้วตัดใหม่ได้ทันที · ทำตัวอย่างใหม่เร็วขึ้น</li>
<li>ต้องมีพื้นที่ ~4 × 6 ม. · ไฟ 3 เฟส · เครื่องดูดฝุ่น · คนเขียนไฟล์ CAM (ไฟล์ DXF ที่เราทำใช้ได้เลย)</li>
<li>ราคาเครื่องเป็นค่าประมาณ ต้องขอใบเสนอราคาจริง 2-3 เจ้า รวมค่าติดตั้ง/อบรม/ประกัน</li></ul></section>"""

style = """@page{size:A4 portrait;margin:0}*{box-sizing:border-box}
body{margin:0;font-family:'Noto Sans Thai','Montserrat',sans-serif;color:#1E2733;font-size:9pt}
.page{width:210mm;min-height:297mm;padding:11mm 12mm;page-break-after:always}
header{display:flex;align-items:center;gap:4mm;border-bottom:2px solid #83B7BF;padding-bottom:2.5mm;margin-bottom:3.5mm}
header img{height:14mm}header .brand{font-family:Montserrat;letter-spacing:.1em;font-size:7.5pt;color:#958C7B;font-weight:500}
header h1{margin:0;font-size:15pt;color:#2B4368;font-weight:600}header .meta{margin-left:auto;text-align:right;font-size:8pt;color:#6B7280}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}.kpis div{background:#F7F8F8;border-left:3px solid #2B4368;padding:2mm 3mm}
.kpis span{display:block;font-size:7.5pt;color:#6B7280}.kpis b{font-size:15pt;color:#2B4368;font-family:Montserrat}.kpis i{font-style:normal;font-size:7.5pt;color:#6B7280;margin-left:1mm}
.warn{background:#FFF4C2;padding:1.5mm 3mm;font-size:8pt;margin:3mm 0}
table{width:100%;border-collapse:collapse}th{background:#2B4368;color:#fff;font-weight:500;text-align:left;padding:1.3mm 1.6mm;font-size:8pt}
td{padding:1mm 1.6mm;border-bottom:1px solid #E3E6EA;vertical-align:top}.p td{font-size:8pt}.r{text-align:right;white-space:nowrap}
.mut{color:#6B7280;font-size:7.3pt}.tot td{font-weight:600;border-top:2px solid #2B4368;background:#F7F8F8}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm 4mm}figure{margin:0}figcaption{font-size:7.5pt;color:#2F4554}
h2{font-size:10.5pt;color:#2B4368;margin:4mm 0 1.5mm}.note{font-size:8pt;color:#4B5563}ul{padding-left:5mm}li{margin-bottom:1mm}"""
def _scope(css, pre=".slip"):
    out = []
    for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", css.replace("@page{size:A4 portrait;margin:0}", "")):
        sels = []
        for x in sel.split(","):
            x = x.strip()
            if x in ("*", "body"):
                continue
            sels.append(x.replace(".page", pre + ".page") if x.startswith(".page") else f"{pre} {x}")
        if sels:
            out.append(",".join(sels) + "{" + body + "}")
    return "".join(out)


slip_css = _scope(sl.style)
CSS = open(CSSARG).read() if CSSARG and os.path.exists(CSSARG) else ""
doc = (f'<!doctype html><html lang="th"><head><meta charset="utf-8"><title>SOFA 1600 x{QTY}</title><style>{CSS}{style}</style>'
       f'<style>{slip_css}</style></head><body>{page1}{"".join(nest_pages)}{page_cnc}{"".join(sl.HTML_PAGES)}</body></html>')
open(os.path.join(OUT, f"sofa-1600-x{QTY}.html"), "w").write(doc)
print(f"QTY {QTY}: ply {NB} sheets (single {N1 * QTY}), fabric {FAB_B} m (single {sl.FAB_BUY * QTY:.1f}), total {tot:,.0f} THB, per unit {tot / QTY:,.0f}")
for n, pr, src in MACHINES:
    print(n, pr, [(s3, payback(pr, s3, True), payback(pr, s3, False)) for s3 in (15, 30, 60)])

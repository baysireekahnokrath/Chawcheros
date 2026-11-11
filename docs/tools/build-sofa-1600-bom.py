#!/usr/bin/env python3
"""
SOFA 1600 x 750 — BOM with price comparison: internal price list vs market.

Output: docs/products/sofa-1600/sofa-1600-bom.xlsx
  สรุป          totals at internal cost price / purchase price / market mid, status counts
  BOM เทียบราคา  every line: qty, internal code + purchase price (@) + cost price, market low/high,
                % gap, price used, amount, status (formulas, editable)
  แหล่งราคา      where every number came from (internal files + market sources with dates)
  ไม้ CNC        plywood cut list from build-sofa-1600-drawing.py
  ฟองน้ำ         foam take-off

Internal prices = factory costing master "Master_วัสดุ" (codes M0001-M0209,
MidYear_CostingSystem.xlsx, same numbers as "Costing format(1).xlsx" FORM ใหม่ Update 16-6-26,
foam/price update 28/5/26). @ = purchase price written in the item name; ราคาคิดต้นทุน = the
"ราคาต่อหน่วย" column the factory costs with (usually a little above @).
Market = figures found by web search 2026-11-11; the pages themselves could not be opened from
the build machine, so each one is labelled with its source and date and must be checked.
"""
import importlib.util, os, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.formatting.rule import FormulaRule
from openpyxl.utils import get_column_letter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "docs", "products", "sofa-1600", "sofa-1600-bom.xlsx")

spec = importlib.util.spec_from_file_location("dwg", os.path.join(os.path.dirname(__file__), "build-sofa-1600-drawing.py"))
dwg = importlib.util.module_from_spec(spec)
sys.argv = sys.argv[:1]
spec.loader.exec_module(dwg)
_, N_PLY = dwg.nest()

FT2 = 10.7639          # sq ft per m2
SHEET_FT2 = 27.78      # foam sheet 50x80 in
FOAM_REC = 0.7         # factory default recovery for foam / sheet goods

# ---------------------------------------------------------------- sources
SOURCES = [
    ("DB1", "ภายใน", "Master_วัสดุ (รหัส M0001-M0209) ใน MidYear_CostingSystem.xlsx",
     "https://drive.google.com/file/d/1orz_ivnE34Xbkauh-pNBz7pEmpKs5D6t/view", "ราคาอัปเดต 28/5/26 · แก้ไข 10-16/6/26",
     "ราคาชุดเดียวกับ Costing format(1).xlsx (FORM ใหม่ Update 16-6-26) · คอลัมน์ @ = ราคาซื้อ · ราคาต่อหน่วย = ราคาที่โรงงานใช้คิดต้นทุน"),
    ("DB2", "ภายใน", "ตารางราคาฟองน้ำ + PO 0442/26 (docs/modules/foam/0-data.md)", "repo: docs/modules/foam/0-data.md",
     "ตาราง 28/5/69 · PO 08/10/2026", "สูตร ราคา/แผ่น = ราคาต่อนิ้ว × ความหนา ตรวจกับ PO แล้วตรง 4/4 รายการ"),
    ("DB3", "ภายใน", "ราคาวัสดุ ฌ เฌอ (ชีตที่ระบบดึงเข้าฐานข้อมูล)",
     "https://docs.google.com/spreadsheets/d/1E4yTp2sLiQV4ULlUSwFmX40SuioMLOA-9yti6_TfNyE/edit", "สร้าง 7/11/2026",
     "ยังว่าง มีแค่แถวตัวอย่าง → ระบบ chawcher-os ยังไม่มีราคาวัสดุ จึงใช้ DB1 แทน"),
    ("M1", "ตลาด", "thaiplywood.net · สำรวจราคาไม้อัด", "https://www.thaiplywood.net/tag/ราคาไม้อัด/", "ก.พ. 2568 (2025)",
     "ไม้อัดยาง 20 มม. 650 บาท/แผ่น · 15 มม. 389 บาท/แผ่น (ไม่มี 18 มม.) · ข้อมูลเก่า ~1.5 ปี"),
    ("M2", "ตลาด", "ไทวัสดุ · ไม้อัดยาง เบอร์ 20 เกรด AA สิงห์โต 120×240",
     "https://www.thaiwatsadu.com/th/product/60191563", "—", "ระบุว่าเบอร์ 20 หนาจริงประมาณ 17-18 มม. (ใช้ยืนยันว่า PLYWOOD 20 MM ใน DB1 = ไม้ 18 มม. ในแบบ) · ไม่ได้ราคา"),
    ("M3", "ตลาด", "goldendragonpvc.com · ราคาฟองน้ำและใยแผ่น 2026",
     "https://www.goldendragonpvc.com/buy-furniture-foam-and-polyester-fiber-price-2026/", "2026 (อัปเดต ~8 เดือนก่อน)",
     "ฟองน้ำ HR หนา 1\" 150-250 บาท (หน้าเว็บไม่ระบุหน่วยชัด สมมติ = ต่อแผ่น 50×80\") · ใยแผ่น 100-200 กรัม 45-85 บาท/ม. · 400 กรัม 90-120 บาท/ม."),
    ("M4", "ตลาด", "sctprogress.com · ขาโซฟาไม้กลมกรวย 8 ซม. สีธรรมชาติ", "https://www.sctprogress.com/product/195073-205328/",
     "ไม่ระบุวันที่", "30 บาท/ชิ้น · ขาทรงกรวยสำเร็จรูป ไม่ใช่ขากลึง Ø50 ตามแบบ"),
    ("M5", "ตลาด", "BigGo · อะไหล่ขาโซฟา", "https://biggo.co.th/s/อะไหล่ขาโซฟา/", "มี.ค. 2023", "ขากลมทรงกรวย 37 บาท · ข้อมูลเก่า"),
    ("M6", "ตลาด", "NTS Curtain · ผ้าบุโซฟา", "https://ntscurtain.com/sofa-upholstery-fabric/", "—",
     "ผ้าบุโซฟา 460-1,290 บาท/หลา หน้ากว้าง 140-160 ซม. (= 503-1,411 บาท/ม.)"),
    ("M7", "ตลาด", "Prem PVC · ผ้าหุ้มโซฟาผ้าทอ W00", "https://www.prempvc.com/product-page/w00", "—",
     "ผ้าทอโพลีเอสเตอร์ หน้ากว้าง 145 ซม. 139 บาท/ม. (ผ้าเกรดล่าง ไม่ใช่บูเคล่)"),
]
NOT_FOUND = "ค้นแล้วไม่พบราคาตลาดไทย: ไม้อัดดัด 4 มม. · สายยางยืดโซฟา 5 ซม. · ค่าตัด CNC ต่อแผ่น · T-nut / ตาไก่ · ผ้าบูเคล่โดยตรง"

# ---------------------------------------------------------------- foam take-off (code, where, area m2, inch)
FOAM_DB = {  # code: (M-code, DB name, @ per ft2 per inch, cost price per ft2 per inch)
    "FFC": ("M0087-90", "FFC D.Gr @255.15/27.8=9.18", 9.18, 11.0),
    "SQ": ("M0093-94", "SQ @220/27.8=7.91", 7.91, 9.0),
    "HR3": ("M0079-81", "HR-3 @220/27.8=7.91", 7.91, 9.0),
}
FOAM_LINES = [
    ("FFC", "ที่นั่ง ชั้นหลัก", 1.36 * 0.52, 4, "1360×520 หนา 100 มม."),
    ("SQ", "ที่นั่ง ชั้นนุ่มบน + ห่อจมูกหน้า", 1.36 * 0.67, 1, "25 มม."),
    ("SQ", "พนักพิง ด้านหน้า (แกะมน)", 1.37 * 0.45, 4, "80-120 มม."),
    ("SQ", "พนักพิง หัวมนด้านบน", 1.37 * 0.20, 3, "หัวพนัก R60-70"),
    ("SQ", "พนักพิง ด้านหลัง", 1.40 * 0.72, 1, "ทับไม้อัดดัด SK2"),
    ("HR3", "หน้าฐาน + ข้างซ้าย", 0.54, 2, "หน้าฐานมน R110"),
    ("HR3", "ปลายซ้าย ปั้นทรงลาด", 0.65 * 0.60, 4, "พนักลาด 800→600"),
    ("HR3", "ม้วนแขน (แกะ)", 0.30, 4, "ปั้นรอบกล่องแขน"),
    ("HR3", "หมอนข้าง ชั้นใน", 0.41, 1.5, "40 มม."),
    ("SQ", "หมอนข้าง ผิวนอก", 0.45, 1, "20 มม. ใช้แผ่น 1\""),
]
M3_LO, M3_HI = 150 / SHEET_FT2, 250 / SHEET_FT2     # baht per ft2 per inch (market M3)

# ---------------------------------------------------------------- BOM lines
# (group, item, spec, uom, net, rec, code, db_name, buy@, cost, mkt_lo, mkt_hi, mkt_src, used_src, note)
L = []
L.append(("1 โครงไม้", "ไม้อัดยาง 18 มม. (เบอร์ 20) 120×240", "R1-R6 A1 B1-B6 AP PL LP SP (แท็บ ไม้ CNC)", "แผ่น", N_PLY, 1,
          "M0005", "PLYWOOD 20 MM.@800(120x240cm)", 800, 820, 650, 650, "M1, M2", "DB1",
          f"จัดผังแล้วใช้ {N_PLY} แผ่นเต็ม · เบอร์ 20 หนาจริง ~18 มม. (M2)"))
L.append(("1 โครงไม้", "ค่าตัด CNC", "ตามไฟล์ sofa-1600-cnc-18mm.dxf", "แผ่น", N_PLY, 1,
          None, None, None, None, None, None, None, None, "ไม่มีใน DB1 · ไม่พบราคาตลาด → ขอใบเสนอราคาร้าน CNC"))
L.append(("1 โครงไม้", "ไม้ดัด (ไม้อัดดัดโค้ง) 120×240", "SK1 ×1 · SK2 ×2 · SK3 ×1", "แผ่น", 2, 1,
          "M0011", "ไม้ดัด R25 @350/แผ่น", 350, 370, None, None, None, "DB1", "SK2 ยาว 1430 กว้าง 640 วาง 2 ชิ้นในแผ่นเดียวไม่ได้ → 2 แผ่น"))
L.append(("1 โครงไม้", "กาว ด้าย ลวดแม็ก สกรู (เหมาต่อตัว)", "GLUE & THREAD & MAX", "ชุด", 1, 1,
          "FORM", "GLUE & THREAD & MAX", None, 200, None, None, None, "DB1", "ยอดเหมาในฟอร์ม costing โรงงาน"))
L.append(("1 โครงไม้", "เหล็ก/คลิป (เหมาต่อตัว)", "METAL & CLIP", "ชุด", 1, 1,
          "FORM", "METAL & CLIP", None, 20, None, None, None, "DB1", "ยอดเหมาในฟอร์ม costing โรงงาน"))
L.append(("2 ที่นั่ง", "ยางยืด 5 ซม.", "15 เส้น × 470 มม. (รวมเผื่อยิงแม็ก)", "ม.", round(15 * 0.47, 2), 1,
          "M0136", "ยางยืด 5 ซม. (ในประเทศ สีขาว)", 15.95, 16, None, None, None, "DB1", ""))
L.append(("2 ที่นั่ง", "กระสอบพลาสติก ปูทับสายยาง", "0.75 ตร.ม.", "ตร.ฟ.", round(0.75 * FT2, 2), 0.8,
          "M0151", "กระสอบพลาสติก", None, 1.25, None, None, None, "DB1", ""))
for code, where, a, t, note in FOAM_LINES:
    mc, nm, buy, cost = FOAM_DB[code]
    L.append(("3 ฟองน้ำ", f"ฟองน้ำ {code} {t:g}\" · {where}", note, f"ตร.ฟ. (หนา {t:g}\")", round(a * FT2, 2), FOAM_REC,
              mc, f"{nm} × {t:g}\"", round(buy * t, 2), round(cost * t, 2), round(M3_LO * t, 2), round(M3_HI * t, 2), "M3", "DB1",
              "ราคา @ ตรงกับ PO จริง (DB2)"))
L.append(("3 ฟองน้ำ", "ใยโพลีเอสเตอร์ FILL 200 GM", "ห่อทุกชิ้นก่อนหุ้มผ้า ~7 ตร.ม.", "ตร.ฟ.", round(7 * FT2, 1), FOAM_REC,
          "M0120", "FILL 200 GM @ 27.65/17.5 = 1.58", 1.58, 3, round(45 / 16.1, 2), round(85 / 16.1, 2), "M3", "DB1",
          "ตลาดแปลงจากบาท/ม. สมมติหน้ากว้าง 1.5 ม. (16.1 ตร.ฟ./ม.)"))
L.append(("4 วัสดุหุ้ม", "ผ้าหุ้ม บูเคล่/เท็ดดี้ หน้ากว้าง 140", "ตัว ~6.0 ม. + หมอนข้าง ~1.0 ม.", "ม.", 7.0, 0.85,
          None, None, None, None, 503, 1411, "M6, M7", None,
          "ราคาผ้าตามเกรด (A/B/C) อยู่ในตาราง materials ของระบบ แต่ session นี้อ่านฐานข้อมูลไม่ได้ → Bay ใส่เอง"))
L.append(("4 วัสดุหุ้ม", "สปันบอนด์ 100 GM ปิดใต้ฐาน", "หน้ากว้าง 100", "ม.", 1.5, 0.9,
          "M0170", "SPUNDBOND 100 GM w100 / m @ 10/m", 10, 11, None, None, None, "DB1", ""))
L.append(("4 วัสดุหุ้ม", "ซิปม้วน (ปลอกหมอนข้าง)", "", "ม.", 0.7, 1, "M0185", "ซิปม้วน @ 7.46", 7.46, 8, None, None, None, "DB1", ""))
L.append(("4 วัสดุหุ้ม", "หัวซิป", "", "ชิ้น", 1, 1, "M0186", "หัวซิป @1.31", 1.31, 2, None, None, None, "DB1", ""))
L.append(("4 วัสดุหุ้ม", "ตาไก่ทองเหลือง Ø10", "ผ้าแขน + ผ้าหมอนข้าง", "ชิ้น", 4, 1, None, None, None, None, None, None, None, None,
          "ไม่มีใน DB1 · ไม่พบราคาตลาด"))
L.append(("5 ขา/ฮาร์ดแวร์", "ขาไม้กลึง Ø50 × 80", "ไม้ยาง/บีช สีเนเชอรัล", "ขา", 6, 1, "M0155", "ขาไม้ (@80)", 80, 100, 30, 37, "M4, M5",
          "DB1", "ราคาตลาดเป็นขาทรงกรวยสำเร็จรูป เล็กกว่า → ควรขอราคาขากลึงตามแบบ"))
L.append(("5 ขา/ฮาร์ดแวร์", "สกรูสองหัว M8 + น็อต + แหวน", "ยึดขา", "ชุด", 6, 1, "M0072", "แฮงกะโบ้ 8x60 + น็อต + แหวน", 2.72, 3.5,
          None, None, None, "DB1", ""))
L.append(("5 ขา/ฮาร์ดแวร์", "T-nut M8 (น็อตเฟืองจักร)", "LP ×6 · PL3 ×2", "ตัว", 8, 1, "M0053", "NUT เฟืองจักร 6 MM. 8MM.", None, 1.5,
          None, None, None, "DB1", ""))
L.append(("5 ขา/ฮาร์ดแวร์", "สกรูหัวจม M8 (ยึดหมอนข้าง)", "แบบต้องการยาว 100 มม.", "ตัว", 2, 1, "M0063", "สกูรหัวจม M8X70 สีดำ", 5.5, 6,
          None, None, None, "DB1", "DB มีแค่ยาว 70 มม. · ยาว 100 อาจแพงขึ้นเล็กน้อย"))
L.append(("5 ขา/ฮาร์ดแวร์", "ยางรองขา", "", "ชิ้น", 6, 1, "M0165", "ยางรองขา สีดำ", None, 2, None, None, None, "DB1", ""))
for item in ("LABOUR ค่าแรง", "PACKING บรรจุ", "CARTON BOX กล่อง", "TRANSPORTATION ขนส่ง"):
    L.append(("6 ค่าแรง/บรรจุ/ขนส่ง", item, "ยอดเหมาต่อตัว", "ตัว", 1, 1, "FORM", item.split()[0], None, None, None, None, None, None,
              "ฟอร์มโรงงานมีบรรทัดนี้ แต่ยังว่าง → โรงงาน/Bay ใส่"))

# ---------------------------------------------------------------- styles
NAVY, AQUA, OFF, TAUPE = "2B4368", "83B7BF", "F7F8F8", "958C7B"
thin = Side(style="thin", color="C9CED6")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
FILL = lambda c: PatternFill("solid", fgColor=c)
HEAD_DB, HEAD_MK, HEAD = FILL("2F4554"), FILL("6E6656"), FILL(NAVY)
F = Font(name="Noto Sans Thai", size=10)
F_B = Font(name="Noto Sans Thai", size=10, bold=True)
F_H = Font(name="Noto Sans Thai", size=10, bold=True, color="FFFFFF")
F_T = Font(name="Noto Sans Thai", size=15, bold=True, color=NAVY)
F_S = Font(name="Noto Sans Thai", size=9, color="6B7280")
WRAP = Alignment(vertical="top", wrap_text=True)


def put(ws, r, c, v, fmt=None, bold=False, fill=None, wrap=False, align=None):
    x = ws.cell(row=r, column=c, value=v)
    x.font, x.border = (F_B if bold else F), BORDER
    x.alignment = Alignment(vertical="top", wrap_text=wrap, horizontal=align)
    if fmt:
        x.number_format = fmt
    if fill:
        x.fill = fill
    return x


def heads(ws, r, cols, fills=None):
    for i, (n, w) in enumerate(cols, 1):
        c = ws.cell(row=r, column=i, value=n)
        c.font, c.border = F_H, BORDER
        c.fill = (fills or {}).get(i, HEAD)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[r].height = 42


def title(ws, t, s):
    ws["A1"], ws["A2"] = t, s
    ws["A1"].font, ws["A2"].font = F_T, F_S


wb = Workbook()

# ---------------------------------------------------------------- BOM เทียบราคา
ws = wb.active
ws.title = "BOM เทียบราคา"
title(ws, "BOM เทียบราคา · SOFA 1600 × 750 · ต่อ 1 ตัว",
      "ราคาภายใน = Master_วัสดุ ของโรงงาน (DB1) · ราคาตลาด = ค้นเว็บ 11/11/2026 (ดูแท็บ แหล่งราคา) · ส่วนต่าง = ราคาซื้อ @ เทียบกลางช่วงตลาด · ช่องเหลืองแก้ได้")
cols = [("#", 4), ("หมวด", 13), ("รายการ", 30), ("สเปก / ใช้ที่", 26), ("หน่วย", 12), ("ใช้สุทธิ", 9), ("ได้เนื้อ", 8),
        ("ต้องซื้อ", 9), ("รหัส", 9), ("ชื่อใน Master_วัสดุ", 28), ("ราคาซื้อ @", 10), ("ราคาคิดต้นทุน", 10),
        ("ตลาด ต่ำ", 9), ("ตลาด สูง", 9), ("แหล่งตลาด", 9), ("@ เทียบตลาด", 10), ("ราคาที่ใช้", 10), ("ที่มา", 8),
        ("รวม (บาท)", 11), ("สถานะ", 18), ("หมายเหตุ", 44)]
heads(ws, 4, cols, {**{i: HEAD_DB for i in range(9, 13)}, **{i: HEAD_MK for i in range(13, 17)}})
ws.cell(row=3, column=9, value="◀ ราคาภายใน (ฐานข้อมูลโรงงาน) ▶").font = F_B
ws.cell(row=3, column=13, value="◀ ราคาตลาด ▶").font = F_B
YEL = FILL("FFF4C2")
r0 = r = 5
groups = {}
for i, (g, item, spec_, uom, net, rec, code, dbn, buy, cost, mlo, mhi, msrc, usrc, note) in enumerate(L, 1):
    used = cost
    vals = [i, g, item, spec_, uom, net, rec, f"=F{r}/G{r}", code or "—", dbn or "ไม่มีใน Master", buy, cost, mlo, mhi, msrc or "—",
            f'=IF(OR(K{r}="",M{r}=""),"",K{r}/((M{r}+N{r})/2)-1)', used, usrc or "—",
            f'=IF(Q{r}="","",H{r}*Q{r})',
            f'=IF(Q{r}="","ยังไม่มีราคา",IF(I{r}="—","ไม่มีใน Master",IF(P{r}="","ไม่มีราคาตลาดเทียบ",IF(P{r}>0.15,"แพงกว่าตลาด",IF(P{r}<-0.15,"ถูกกว่าตลาด","ใกล้เคียงตลาด")))))',
            note]
    fmts = {6: "#,##0.00", 7: "0%", 8: "#,##0.00", 11: "#,##0.00", 12: "#,##0.00", 13: "#,##0.00", 14: "#,##0.00",
            16: "+0%;-0%;0%", 17: "#,##0.00", 19: "#,##0.00"}
    for c, v in enumerate(vals, 1):
        put(ws, r, c, v, fmts.get(c), wrap=c in (3, 4, 10, 21),
            fill=YEL if (c == 17 and used is None) or c in (6, 7) else None)
    groups.setdefault(g, []).append(r)
    r += 1
last = r - 1
put(ws, r, 18, "รวม", bold=True)
put(ws, r, 19, f"=SUM(S{r0}:S{last})", "#,##0", bold=True)
TOT_ROW = r
ws.freeze_panes = "D5"
ws.auto_filter.ref = f"A4:U{last}"
for status, color in (("แพงกว่าตลาด", "F8D7D3"), ("ถูกกว่าตลาด", "DCEFE3"), ("ใกล้เคียงตลาด", "E3EEF0"),
                      ("ยังไม่มีราคา", "FFE8B3"), ("ไม่มีใน Master", "FFF4C2")):
    ws.conditional_formatting.add(f"T{r0}:T{last}", FormulaRule(formula=[f'$T{r0}="{status}"'], fill=FILL(color)))

# ---------------------------------------------------------------- แหล่งราคา
s2 = wb.create_sheet("แหล่งราคา")
title(s2, "แหล่งที่มาของราคาทุกตัวเลข", "DB = ราคาภายในของเรา/โรงงาน · M = ราคาตลาดจากการค้นเว็บ 11/11/2026")
heads(s2, 4, [("รหัส", 7), ("ชนิด", 8), ("แหล่ง", 42), ("ลิงก์ / ไฟล์", 46), ("วันที่ของราคา", 22), ("ได้ข้อมูลอะไร / ข้อควรระวัง", 70)])
for i, row in enumerate(SOURCES):
    for c, v in enumerate(row, 1):
        put(s2, 5 + i, c, v, wrap=True)
    s2.row_dimensions[5 + i].height = 32
rr = 5 + len(SOURCES) + 1
for t in (NOT_FOUND,
          "หน้าเว็บตลาดเปิดอ่านจากเครื่องที่ทำงานไม่ได้ (เครือข่ายถูกบล็อก) ตัวเลขตลาดมาจากผลการค้นหา ควรเปิดลิงก์เช็กอีกครั้งก่อนใช้ต่อรองราคา",
          "ฐานข้อมูลระบบ chawcher-os (Supabase) session นี้ไม่ได้รับสิทธิ์อ่าน · ชีต DB3 ที่ระบบดึงราคาเข้าไปยังว่าง จึงใช้ Master_วัสดุ (DB1) เป็นราคาภายใน"):
    s2.cell(row=rr, column=1, value="• " + t).font = F
    rr += 1

# ---------------------------------------------------------------- ไม้ CNC
s3 = wb.create_sheet("ไม้ CNC")
title(s3, "รายการชิ้นไม้อัด 18 มม. (ตัด CNC)", "ตรงกับไฟล์ sofa-1600-cnc-18mm.dxf")
heads(s3, 4, [("รหัส", 10), ("ชื่อชิ้น", 34), ("จำนวน", 8), ("กว้าง", 9), ("ยาว", 9), ("ตร.ม./ชิ้น", 11), ("ตร.ม. รวม", 11), ("หมายเหตุ", 34)])
r = 5
for p in dwg.PARTS:
    b = p["poly"].bounds
    for c, v, f in ((1, p["code"], None), (2, p["name"], None), (3, p["qty"], None), (4, round(b[2] - b[0]), "#,##0"),
                    (5, round(b[3] - b[1]), "#,##0"), (6, round(p["poly"].area / 1e6, 4), "0.000"), (7, f"=C{r}*F{r}", "0.000"),
                    (8, p["note"], None)):
        put(s3, r, c, v, f)
    r += 1
put(s3, r, 6, "รวม", bold=True); put(s3, r, 7, f"=SUM(G5:G{r - 1})", "0.00", bold=True)
put(s3, r + 1, 6, "ใช้แผ่น", bold=True); put(s3, r + 1, 7, N_PLY, bold=True)
put(s3, r + 2, 6, "ใช้เนื้อไม้", bold=True); put(s3, r + 2, 7, f"=G{r}/(G{r + 1}*2.928)", "0%", bold=True)

# ---------------------------------------------------------------- ฟองน้ำ
s4 = wb.create_sheet("ฟองน้ำ")
title(s4, "ถอดปริมาณฟองน้ำจากแบบ", f"แผ่นฟองน้ำ 50×80 นิ้ว = {SHEET_FT2} ตร.ฟ. · ได้เนื้อ {FOAM_REC:.0%} ตามค่ามาตรฐานโรงงาน")
heads(s4, 4, [("ฟองน้ำ", 8), ("ใช้ที่", 30), ("ตร.ม.", 9), ("ตร.ฟ.", 9), ("หนา (นิ้ว)", 9), ("แผ่น 50×80 ที่ต้องซื้อ", 12), ("หมายเหตุ", 24)])
r = 5
for code, where, a, t, note in FOAM_LINES:
    for c, v, f in ((1, code, None), (2, where, None), (3, round(a, 3), "0.000"), (4, f"=C{r}*{FT2}", "0.00"), (5, t, "0.0"),
                    (6, f"=D{r}/{FOAM_REC}/{SHEET_FT2}", "0.00"), (7, note, None)):
        put(s4, r, c, v, f)
    r += 1

# ---------------------------------------------------------------- สรุป
s0 = wb.create_sheet("สรุป", 0)
title(s0, "สรุปต้นทุน · SOFA 1600 × 750 · ต่อ 1 ตัว",
      "ยังไม่รวมผ้าหุ้ม · ค่าแรง · บรรจุ · ขนส่ง · ค่าตัด CNC (ยังไม่มีราคา ใส่ในแท็บ BOM เทียบราคา ช่องเหลือง)")
B = "'BOM เทียบราคา'"
heads(s0, 4, [("หมวด", 24), ("ราคาที่ใช้\n(ราคาคิดต้นทุนโรงงาน)", 18), ("ถ้าคิดที่ราคาซื้อ @", 16), ("ถ้าคิดที่ราคากลางตลาด\n(เฉพาะบรรทัดที่มี)", 20),
              ("บรรทัด", 8), ("ยังไม่มีราคา", 11)])
r = 5
for g, rows in groups.items():
    a, b_ = rows[0], rows[-1]
    put(s0, r, 1, g)
    put(s0, r, 2, f"=SUM({B}!S{a}:S{b_})", "#,##0")
    put(s0, r, 3, f"=SUMPRODUCT({B}!H{a}:H{b_},{B}!K{a}:K{b_})", "#,##0")
    put(s0, r, 4, f"=SUMPRODUCT({B}!H{a}:H{b_},({B}!M{a}:M{b_}+{B}!N{a}:N{b_})/2)", "#,##0")
    put(s0, r, 5, len(rows))
    put(s0, r, 6, f'=COUNTIF({B}!T{a}:T{b_},"ยังไม่มีราคา")')
    r += 1
put(s0, r, 1, "รวม", bold=True)
for c in (2, 3, 4, 5, 6):
    put(s0, r, c, f"=SUM({get_column_letter(c)}5:{get_column_letter(c)}{r - 1})", "#,##0", bold=True)
r += 2
s0.cell(row=r, column=1, value="สถานะบรรทัด").font = F_B
r += 1
for st in ("ใกล้เคียงตลาด", "แพงกว่าตลาด", "ถูกกว่าตลาด", "ไม่มีราคาตลาดเทียบ", "ไม่มีใน Master", "ยังไม่มีราคา"):
    put(s0, r, 1, st)
    put(s0, r, 2, f'=COUNTIF({B}!T5:T{last},"{st}")')
    r += 1
r += 1
for t in ("วิธีอ่าน",
          "• ราคาที่ใช้ = คอลัมน์ “ราคาต่อหน่วย” ใน Master_วัสดุ ของโรงงาน (ราคาที่ใช้คิดต้นทุนจริง สูงกว่าราคาซื้อ @ เล็กน้อย)",
          "• ราคาซื้อ @ = ราคาซื้อที่เขียนไว้ในชื่อวัสดุ · ฟองน้ำตรงกับ PO 0442/26",
          "• ตลาด = ราคาที่ค้นเจอ มีแหล่งและวันที่ในแท็บ แหล่งราคา · ส่วนต่างเกิน ±15% จะขึ้นสถานะแพง/ถูกกว่าตลาด",
          "• คอลัมน์ “ถ้าคิดที่ราคากลางตลาด” รวมเฉพาะบรรทัดที่มีราคาตลาด ใช้ดูทิศทาง ไม่ใช่ยอดเต็ม"):
    s0.cell(row=r, column=1, value=t).font = F_B if t == "วิธีอ่าน" else F
    r += 1

for w in wb.worksheets:
    w.sheet_view.showGridLines = False
    w.page_setup.orientation = "landscape"
    w.sheet_properties.pageSetUpPr.fitToPage = True
    w.page_setup.fitToWidth, w.page_setup.fitToHeight = 1, 0
wb.save(OUT)
print(OUT, "lines", len(L))

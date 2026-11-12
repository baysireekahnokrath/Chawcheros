#!/usr/bin/env python3
"""
BOM (internal price vs market) for the curved sofas, reusing build-sofa-1600-bom.py with the curved geometry.

  MODEL=FI-01 python3 docs/tools/build-sofa-curved-bom.py [fonts-inline.css]

Wood, CNC area, bending ply, webbing, fabric, legs and hardware come from the curved CNC model
(docs/tools/sofa_curved.py + <slug>-summary.json written by build-sofa-curved.py).
Foam and fibre are the SOFA 1600 take-off scaled by plan area (estimate: no foam drawing for the curved body yet).
Out: docs/products/<slug>/<slug>-bom.xlsx + <slug>-bom.html (print to PDF)
"""
import importlib.util, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[1:]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    sys.argv = sys.argv[:1]
    spec.loader.exec_module(m)
    return m


bc = load("bc", os.path.join(HERE, "build-sofa-curved.py"))      # patches dwg to the curved model
sc, dwg = bc.sc, bc.dwg
SLUG, NAME = sc.INFO["slug"], sc.INFO["name"]
S = json.load(open(os.path.join(bc.OUT, f"{SLUG}-summary.json")))
K = sc.BODY_FULL.area / 1.10e6                                     # plan area vs SOFA 1600 (~1.10 m2)
NLEG = len(sc.LEGS) + 1                                            # + hidden bolster foot
flex_m2 = (sc.FRAME.exterior.length * 0.33 + sc.REAR.intersection(sc.BACKZONE).length * 0.76) * 2 / 1e3
N_FLEX = math.ceil(flex_m2 / (1.22 * 2.44 * 0.8))
seat_m2 = S["seat_area_m2"]

src = open(os.path.join(HERE, "build-sofa-1600-bom.py")).read()
R = [
    ('OUT = os.path.join(ROOT, "docs", "products", "sofa-1600", "sofa-1600-bom.xlsx")',
     f'OUT = os.path.join(ROOT, "docs", "products", "{SLUG}", "{SLUG}-bom.xlsx")'),
    ('spec = importlib.util.spec_from_file_location("dwg", os.path.join(os.path.dirname(__file__), "build-sofa-1600-drawing.py"))\n'
     'dwg = importlib.util.module_from_spec(spec)\n', ''),
    ('spec.loader.exec_module(dwg)\n', ''),
    ('_, N_PLY = dwg.nest()', 'N_PLY = S["sheets"]'),
    ('FAB_NET_M, FAB_BUY_M = dwg.fabric_meters()', 'FAB_NET_M, FAB_BUY_M = S["fabric_net_m"], S["fabric_buy_m"]'),
    ('M3_LO, M3_HI = ', 'FOAM_LINES = [(c, w, a * K, t, n + f" · ×{K:.2f} ตามพื้นที่แปลน (ประมาณ)") for c, w, a, t, n in FOAM_LINES]\nM3_LO, M3_HI = '),
    ('"REV B: R1-R5 ×2 ชั้น · R6 A1 B1-B5 AP PL LPL LP SP (แท็บ ไม้ CNC)"',
     'f"ซี่โครง {S[\'ribs\']} ตำแหน่ง ({S[\'doubled\']} ซี่ประกบ 2 ชั้น) · รางโค้ง BR SB SF BT AT · RP LPL PL BM SP (แท็บ ไม้ CNC)"'),
    ('"ไม้ดัด (ไม้อัดดัดโค้ง) 120×240", "SK1 ×2 · SK2 ×2 · SK3 ×1 (REV B)", "แผ่น", 2, 1,',
     '"ไม้ดัด (ไม้อัดดัดโค้ง) 120×240", f"หุ้มรอบฐาน สูง 330 ×2 ชั้น + หลังพนัก ×2 · รวม {flex_m2:.1f} ตร.ม.", "แผ่น", N_FLEX, 1,'),
    ('"แผ่นละ SK2 + SK1 และวาง SK3 แนวขวางในเศษแผ่นแรก → 2 แผ่น"', 'f"{flex_m2:.1f} ตร.ม. ÷ (2.98 × ได้เนื้อ 80%) → {N_FLEX} แผ่น · โค้งแปลนแรง ต้องดัดตามลายไม้"'),
    ('"ยางยืด 5 ซม.", f"{dwg.STRIPS * 5} เส้น × 520 มม. (พับทบ 2 ปลาย ยิงแม็ก 6 นัด)", "ม.", round(dwg.STRIPS * 5 * 0.52, 2), 1,',
     '"ยางยืด 5 ซม. เกรดแรงดึงขาด ≥ 1,500 N", f"{sc.STRIPS} เส้น/ช่อง ยาวตามความลึกที่นั่งจริง (พับทบ 2 ปลาย ยิงแม็ก 8 นัด)", "ม.", S["webbing_m"], 1,'),
    ('"M0136", "ยางยืด 5 ซม. (ในประเทศ สีขาว)", 15.95, 16, None, None, None, "DB1", ""))',
     '"M0136", "ยางยืด 5 ซม. (ในประเทศ สีขาว)", 15.95, 16, None, None, None, "DB1", "สเปกใหม่จากทดสอบโครงสร้าง: ต้องขอใบรับรองแรงขาด ≥ 1,500 N · ราคาอาจสูงกว่า M0136"))'),
    ('"กระสอบพลาสติก ปูทับสายยาง", "0.75 ตร.ม.", "ตร.ฟ.", round(0.75 * FT2, 2),',
     '"กระสอบพลาสติก ปูทับสายยาง", f"{seat_m2 + 0.1:.2f} ตร.ม.", "ตร.ฟ.", round((seat_m2 + 0.1) * FT2, 2),'),
    ('"ห่อทุกชิ้นก่อนหุ้มผ้า ~7 ตร.ม.", "ตร.ฟ.", round(7 * FT2, 1),', 'f"ห่อทุกชิ้นก่อนหุ้มผ้า ~{7 * K:.1f} ตร.ม.", "ตร.ฟ.", round(7 * K * FT2, 1),'),
    ('"ขาไม้กลึง Ø50 × 80", "ไม้ยาง/บีช สีเนเชอรัล", "ขา", 6,', 'f"ขาไม้กลึง Ø50 × 80", f"{len(sc.LEGS)} ขา + ขาซ่อนใต้หมอนข้าง 1", "ขา", NLEG,'),
    ('"สกรูสองหัว M8 + น็อต + แหวน", "ยึดขา", "ชุด", 6,', '"สกรูสองหัว M8 + น็อต + แหวน", "ยึดขา", "ชุด", NLEG,'),
    ('"T-nut M8 (น็อตเฟืองจักร)", "LPL ×4 · LP ×2 · PL3 ×2", "ตัว", 8,', 'f"T-nut M8 (น็อตเฟืองจักร)", f"LPL ×{len(sc.LEGS)} · ขาหมอนข้าง ×1 · PL3 ×2", "ตัว", NLEG + 2,'),
    ('"แหวนอีแปะ Ø40 หนา 3 มม. (ใต้ปีก T-nut)", "REV B · กระจายแรงขาโดนดันข้าง", "ตัว", 8,', '"แหวนอีแปะ Ø40 หนา 3 มม. (ใต้ปีก T-nut)", "กระจายแรงขาโดนดันข้าง", "ตัว", NLEG + 2,'),
    ('"ยางรองขา", "", "ชิ้น", 6,', '"ยางรองขา", "", "ชิ้น", NLEG,'),
    ('ตรงกับไฟล์ sofa-1600-cnc-18mm.dxf', f'ตรงกับไฟล์ {SLUG}-cnc-18mm.dxf'),
    ('SOFA 1600 × 750', NAME),
    ('โครง REV B ผ่านทดสอบโครงสร้าง', 'โครงผ่านทดสอบโครงสร้าง 41/41 ข้อ (fi-01-fi-02-structure-report.pdf)'),
    ('BOM REV B · 2026-11-11', 'BOM REV A · 2026-11-12'),
    ('<title>SOFA 1600 BOM</title>', f'<title>{sc.MODEL} BOM</title>'),
    ('html_path = os.path.join(ROOT, "docs", "products", "sofa-1600", "sofa-1600-bom.html")',
     f'html_path = os.path.join(ROOT, "docs", "products", "{SLUG}", "{SLUG}-bom.html")'),
]
for a, b in R:
    if a not in src:
        raise SystemExit(f"pattern not found in build-sofa-1600-bom.py: {a[:70]}")
    src = src.replace(a, b)
sys.argv = [os.path.join(HERE, "build-sofa-1600-bom.py")] + ARGS
g = dict(__name__="__main__", __file__=os.path.join(HERE, "build-sofa-1600-bom.py"), dwg=dwg, sc=sc, S=S, K=K, NLEG=NLEG,
         N_FLEX=N_FLEX, flex_m2=flex_m2, seat_m2=seat_m2)
exec(compile(src, "build-sofa-1600-bom.py (curved)", "exec"), g)

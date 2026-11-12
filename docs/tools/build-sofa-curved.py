#!/usr/bin/env python3
"""
Drawings + CNC DXF + fabric pattern for the curved-plan sofas (FI-01 L1600, FI-02 L1900).
Geometry: docs/tools/sofa_curved.py · helpers (title block, nesting, DXF, fabric layout) from
docs/tools/build-sofa-1600-drawing.py.
Run: MODEL=FI-01 python3 docs/tools/build-sofa-curved.py [fonts-inline.css]
Out: docs/products/<slug>/<slug>-drawing.html (print to PDF) · -cnc-18mm.dxf · -parts-1to1.dxf · -fabric-pattern.dxf
"""
import html, importlib.util, json, math, os, sys
from shapely.geometry import box, Polygon, Point, LineString
from shapely.ops import unary_union
from shapely import affinity

HERE = os.path.dirname(os.path.abspath(__file__))
css_path = sys.argv[1] if len(sys.argv) > 1 else ""


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    sys.argv = sys.argv[:1]
    spec.loader.exec_module(m)
    return m


sc = load("sc", os.path.join(HERE, "sofa_curved.py"))
dwg = load("dwg", os.path.join(HERE, "build-sofa-1600-drawing.py"))
SLUG = sc.INFO["slug"]
OUT = os.path.join(sc.ROOT, "docs", "products", SLUG)
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- point the shared helpers at this model
dwg.PARTS[:] = sc.PARTS
dwg._PAIR_CACHE.clear()
dwg.PAIR_CODES = tuple()                      # ribs are all different here: no head-to-tail pairs
dwg.OUT = OUT
dwg.PRODUCT_LINE = f"{sc.INFO['name']} — โซฟาโค้ง {sc.INFO['L']} มม."
dwg.REV = "A · แบบโค้งตามลูกค้า (12/11/2026)"
dwg.DATE = "2026-11-12"
dwg.N_SHEETS = 7
Sheet, View, view_title, table, note_block = dwg.Sheet, dwg.View, dwg.view_title, dwg.table, dwg.note_block
NAVY, TAUPE, AQUA, OFF, INK = dwg.NAVY, dwg.TAUPE, dwg.AQUA, dwg.OFF, dwg.INK
FONT = dwg.FONT


# ---------------------------------------------------------------- fabric pattern for the curved body
def fabric_pieces():
    seat_len = 500 + 340 + 120                        # seat top + front drop + under
    back_len = sc.REAR.intersection(sc.BACKZONE).length
    front_len = sc.FRONT.intersection(sc.SEATZONE).length
    S, ST, TK = dwg.SEAM, dwg.STAPLE, dwg.TUCK
    pcs = []

    def split(code, name, w, h, note, add_h=(0, 0)):
        n = math.ceil((w + 2 * S) / 1350)
        for k in range(n):
            pcs.append(dwg.strip(code + (chr(97 + k) if n > 1 else ""), name + (f" ท่อน {k + 1}/{n}" if n > 1 else ""),
                                 1, w / n + (60 if n > 1 else 0), h, note + (" · ต่อตะเข็บตามแนวรัศมี" if n > 1 else ""), add_h=add_h))
    split("F1", "เบาะนั่ง + หน้าฐาน", front_len, seat_len, f"ยาวตามขอบหน้า {front_len:.0f} · คลี่ {seat_len}", (TK, ST))
    split("F2", "พนักพิงด้านใน + หัวพนัก", back_len, 560, f"ยาวตามแนวพนัก {back_len:.0f}", (TK, 0))
    split("F3", "พนักพิงด้านหลัง", sc.REAR.length * 0.92, 700, f"ยาวตามแนวหลัง {sc.REAR.length:.0f}", (0, ST))
    end = sc.BODY.intersection(box(sc.XMIN, sc.YMIN, sc.XMIN + 260, sc.YMAX))
    pcs.append(dwg.shaped("F4", "ปลายซ้าย (ฝาปิดตามแปลน)", 1, affinity.translate(end, -end.bounds[0], -end.bounds[1]), "ปิดหัวท้ายด้านซ้าย"))
    arm = sc.ARMZONE.buffer(sc.FOAM_SIDE)
    pcs.append(dwg.shaped("F5", "แขน ฝาบน (ตามแปลน)", 1, affinity.translate(arm, -arm.bounds[0], -arm.bounds[1]), "ฝาบนกล่องแขน"))
    pcs.append(dwg.strip("F6", "แขน แถบรอบ", 1, arm.exterior.length * 0.6, 440, "รอบกล่องแขนด้านนอก", add_h=(0, ST)))
    a, b = sc.BOL_A, sc.BOL_B
    pcs.append(dwg.shaped("F8", "หมอนข้าง ฝาบน/ล่าง", 2, affinity.scale(Point(0, 0).buffer(1, 64), b, a), f"วงรี {2 * b:.0f}×{2 * a:.0f}"))
    per = math.pi * (3 * (a + b) - math.sqrt((3 * a + b) * (a + 3 * b)))
    pcs.append(dwg.strip("F9", "หมอนข้าง แถบรอบ", 1, per, 460, f"รอบวงรี {per:.0f} · ซิป 0.7 ม."))
    return pcs, {}


dwg.fabric_pieces = fabric_pieces


# ---------------------------------------------------------------- finished silhouettes
def front_silhouette():
    xs = [sc.XMIN + i * (sc.XMAX - sc.XMIN) / 200 for i in range(201)]
    top = []
    for x in xs:
        if x >= sc.X_ARM:
            z = 500
        else:
            line = LineString([(x, sc.YMIN - 10), (x, sc.YMAX + 10)])
            z = 800 if sc.ROLLU.intersects(line) else 420
        top.append(z)
    # soften
    sm = [sum(top[max(0, i - 6):i + 7]) / len(top[max(0, i - 6):i + 7]) for i in range(len(top))]
    return Polygon([(sc.XMIN, 80)] + [(x, z) for x, z in zip(xs, sm)] + [(sc.XMAX, 80)]).buffer(-40, join_style=1).buffer(40, join_style=1)


REP = max([r for r in sc.RIBS if not r["arm"] and "seat" in r], key=lambda r: r["seat"][1] - r["seat"][0])


def finished_section(r):
    p = box(r["ya"] - 50, 80, r["yb"] + 50, sc.SEAT_H)
    for p0, p1, rear_first in r["post"]:
        a, b = (p0 - 15, p1 + 70) if rear_first else (p0 - 70, p1 + 15)
        p = p.union(box(a, 300, b, sc.H))
    return p.buffer(-45, join_style=1).buffer(45, join_style=1)


# ---------------------------------------------------------------- sheets
def sheet_ga():
    sh = Sheet(1, "ภาพรวมและขนาด (GENERAL ARRANGEMENT)", "1:10 / 1:20")
    s = 0.1 if sc.INFO["L"] <= 1650 else 0.085
    v = View(sh, 26, 112, s)
    view_title(sh, 20, 20, "รูปด้านหน้า · FRONT ELEVATION", "มองจากด้านหน้า")
    v.poly(front_silhouette(), fill=OFF, sw=0.45)
    bb = sc.BOLSTER.bounds
    v.poly(box(bb[0], 60, bb[2], 520).buffer(-80, join_style=1).buffer(80, join_style=1), fill="#fff", sw=0.5)
    for lx, ly in sc.LEGS + [sc.BOLSTER_FOOT]:
        v.poly(box(lx - 25, 0, lx + 25, 80), fill="#E9DFCF", sw=0.3)
    v.line([(sc.XMIN - 50, 0), (sc.XMAX + 50, 0)], sw=0.25)
    v.dim((sc.XMIN, 0), (sc.XMAX, 0), 9, "h", f"A = {sc.INFO['L']}")
    v.dim((sc.XMAX, 0), (sc.XMAX, sc.SEAT_H), 6, "v", "420")
    v.dim((sc.XMAX, 0), (sc.XMAX, sc.ARM_H), 13, "v", "520")
    v.dim((sc.XMAX, 0), (sc.XMAX, sc.H), 20, "v", "800")
    p = View(sh, 26, 143, s, flip=False)
    view_title(sh, 20, 131, "รูปแปลน · PLAN (ตามแบบลูกค้า 12/11/2026)")
    p.poly(sc.BODY, fill=OFF, sw=0.45)
    for r in sc.ROLLS:
        p.poly(r, fill="#EFE6D6", stroke=TAUPE, sw=0.3)
    p.poly(sc.BOLSTER, fill="#fff", sw=0.5)
    p.dim((sc.XMIN, sc.YMIN), (sc.XMAX, sc.YMIN), -5, "h", f"{sc.INFO['L']}")
    p.dim((sc.XMAX, sc.YMIN), (sc.XMAX, sc.YMAX), 6, "v", f"{sc.YMAX - sc.YMIN:.0f}")
    p.text(REP["x"], (REP["seat"][0] + REP["seat"][1]) / 2, f"ที่นั่ง ลึก {REP['seat'][1] - REP['seat'][0] + 100:.0f}", 2.2, TAUPE)
    p.text((sc.XMIN + sc.XMAX) / 2, sc.YMAX + 60, "เส้นทรงตามแบบลูกค้า (ลอกจากไฟล์ที่ส่งมา สเกลจากความยาวรวม) · พนัก 250 · ที่นั่ง 450-500", 2.0, TAUPE)
    sv = View(sh, 268, 118, 0.1)
    view_title(sh, 250, 20, f"รูปตัด ที่ X{REP['x']:.0f}", f"ซี่โครง {REP['code']} · ที่นั่งลึกที่สุด")
    fin = finished_section(REP)
    off = -fin.bounds[0]
    sv2 = View(sh, 268 + off * 0.1, 118, 0.1)
    sv2.poly(fin, fill=OFF, sw=0.5)
    sv2.poly(REP["poly"], fill="url(#hatch)", stroke=TAUPE, sw=0.25)
    sv2.line([(fin.bounds[0] - 20, 0), (fin.bounds[2] + 20, 0)], sw=0.25)
    sv2.dim((fin.bounds[2], 0), (fin.bounds[2], sc.SEAT_H), 6, "v", "420")
    sv2.dim((fin.bounds[0], 0), (fin.bounds[0], sc.H), -6, "v", "800")
    sv2.dim((fin.bounds[0], 0), (fin.bounds[2], 0), 8, "h")
    note_block(sh, 20, 262, "หมายเหตุ", [
        "!ทรงแปลนลอกจากแบบลูกค้า: ความยาวรวมตรง · ระยะอื่นคลาดได้ ±20 มม. ตามความหนาเส้นในแบบ — ยืนยันกับลูกค้าก่อนตัด",
        "ความสูง (ที่นั่ง 420 · แขน/หมอนข้าง 520 · พนัก 800) ใช้ตามรุ่น SOFA 1600 เดิม (ลูกค้าไม่ได้ระบุในแบบใหม่)",
        "หมอนข้างตั้งในช่องเว้าของตัวโซฟา (โครงเว้าหลบ 60 มม.) · มีขาซ่อนใต้แกน 1 ขา · ยึดน็อต M8 2 ตัวผ่านแผ่น BM เข้าแผงแขน",
    ], size=2.1, lh=3.4)
    return sh


def sheet_frame():
    s = 1 / 10 if sc.INFO["L"] <= 1650 else 1 / 12
    sh = Sheet(2, "โครงสร้างไม้อัด CNC (FRAME LAYOUT)", f"1:{round(1 / s)} / 3D ไม่ตามมาตรา")
    p = View(sh, 26, 40, s, flip=False)
    view_title(sh, 20, 20, "แปลนโครง · FRAME PLAN", "ซี่โครงขนานแนวหน้า-หลัง · รางโค้งตามแปลน (ตัดเป็นท่อน ต่อในร่องซี่โครง)")
    p.poly(sc.BODY, stroke="#C9CED6", sw=0.2, dash="1,1")
    fills = {"BR": OFF, "SB": AQUA, "SF": AQUA, "BT": TAUPE, "AT": "#E9DFCF"}
    for k, (g, *_r) in sc.RAILS.items():
        p.poly(g, fill=fills[k], sw=0.2, op=0.6)
    p.poly(sc.POST, fill=NAVY, sw=0.1, op=0.3)
    for r in sc.RIBS:
        t = 36 if r["dbl"] else 18
        p.poly(box(r["x"] - t / 2, r["ya"], r["x"] + t / 2, r["yb"]), fill="#8A2B20" if r["arm"] else NAVY, sw=0.1)
        p.text(r["x"], r["ya"] - 20, r["code"], 2.0, NAVY, weight=600)
    for i, (x, y) in enumerate(sc.LEGS + [sc.BOLSTER_FOOT], 1):
        p.circle(x, y, 25, stroke="#9A3B2E", sw=0.35)
        p.text(x, y + 8, f"L{i}" if i <= len(sc.LEGS) else f"L{i} หมอนข้าง", 1.6, "#9A3B2E", weight=600)
    p.poly(sc.BOLSTER, stroke=TAUPE, sw=0.25, dash="1.5,1")
    for q in sc.RAIL_POSTS:
        p.poly(box(q["x"] - 12, q["y"] - 12, q["x"] + 12, q["y"] + 12), fill="#9A3B2E", sw=0.1)
        p.text(q["x"], q["y"] - 22, "RP", 1.6, "#9A3B2E", weight=600)
    xs = [r["x"] for r in sc.RIBS]
    for a, b in zip(xs[:-1], xs[1:]):
        p.dim((a, sc.YMIN - 30), (b, sc.YMIN - 30), -6, "h")
    bx = sc.BODY.bounds
    note_block(sh, 20, 40 + (bx[3] - bx[1]) * s + 10, "ชิ้นส่วน", [
        "น้ำเงินเข้ม = ซี่โครง (เส้นหนา = ประกบชั้นเสริมถึง Z450) · แดง = แผงกล่องแขน (ตัน)",
        "BR วงล่าง Z80-98 (+ แผ่นล่างเต็มกล่องแขน) · SB/SF คานรับสายยาง กว้าง 100 Z272-290 (ช่องปิด) · BT คานบนพนัก Z702-720 · AT วงบนแขน Z440-458 · RP เสาค้ำใต้คาน",
        f"!สายยางยืด 50 มม. เกรดแรงดึงขาด ≥ 1,500 N · {sc.STRIPS} เส้น/ช่อง ขึง SB→SF · พับทบปลาย แม็ก 8 นัด · วงแดง = ขา (บนแผ่นเสริม LPL เต็มช่อง)",
        "ไม้อัดดัด 4 มม. ×2 หุ้มรอบฐาน อ้อมมุมทาบใต้วง BR กาวเต็มหน้า (คานกล่อง) · หลังพนัก ×2",
    ], size=2.0, lh=3.3)
    view_title(sh, 225, 20, "ภาพ 3 มิติโครง · FRAME 3D", "ไม่ตามมาตราส่วน")
    ox, oy, k = 232, 175, 0.085 if sc.INFO["L"] <= 1650 else 0.075

    def path3(pts):
        q = [dwg.obl(*pt) for pt in pts]
        return "M" + " L".join(f"{ox + a * k:.2f},{oy + b * k:.2f}" for a, b in q) + "Z"
    layers = []
    for r in sc.RIBS:
        for xx, shade in ((r["x"] - 9, "#CFE2E5"), (r["x"] + 9, "#EEF5F6")):
            rings = [[(xx, yy, zz) for yy, zz in r["poly"].exterior.coords]] + [[(xx, yy, zz) for yy, zz in ri.coords] for ri in r["poly"].interiors]
            layers.append((xx, f'<path d="{"".join(path3(ri) for ri in rings)}" fill="{shade}" fill-rule="evenodd" stroke="{NAVY}" stroke-width="0.2" fill-opacity="0.9"/>'))
    for kk, (g, z0, z1, _c) in sc.RAILS.items():
        for gg in getattr(g, "geoms", [g]):
            pts = [(x, y, z1) for x, y in gg.exterior.coords]
            layers.append((gg.centroid.x, f'<path d="{path3(pts)}" fill="#EFE6D6" stroke="{TAUPE}" stroke-width="0.2" fill-opacity="0.85"/>'))
    for q in sc.RAIL_POSTS:
        a, b = dwg.obl(q["x"], q["y"], 272); c, d = dwg.obl(q["x"], q["y"], 98)
        layers.append((q["x"], f'<line x1="{ox + a * k:.2f}" y1="{oy + b * k:.2f}" x2="{ox + c * k:.2f}" y2="{oy + d * k:.2f}" stroke="{NAVY}" stroke-width="{18 * k:.2f}"/>'))
    for x, y in sc.LEGS:
        a, b = dwg.obl(x, y, 80); c, d = dwg.obl(x, y, 0)
        layers.append((x, f'<line x1="{ox + a * k:.2f}" y1="{oy + b * k:.2f}" x2="{ox + c * k:.2f}" y2="{oy + d * k:.2f}" stroke="#B5835A" stroke-width="{50 * k:.2f}"/>'))
    for _, svg in sorted(layers, key=lambda t: t[0]):
        sh.add(svg)
    return sh


def sheet_ribs():
    sh = Sheet(3, "แบบชิ้นส่วน CNC ① ซี่โครง / แผงแขน", "1:20")
    view_title(sh, 20, 20, f"ซี่โครงทุกตัว ({len(sc.RIBS)} ตำแหน่ง) · มองจากด้านขวา", "เส้นประฟ้า = ชั้นเสริม (ตัดสูงถึง Z450 ประกบด้านใน) · มุมในร่อง R6 · ร่องเผื่อ +2 มม./ข้าง · ขนาดจริงตามไฟล์ DXF")
    s = 0.05
    x, y, rowh = 22, 34, 0
    for r in sc.RIBS:
        b = r["poly"].bounds
        w, h = (b[2] - b[0]) * s, (b[3] - b[1]) * s
        if x + w > 395:
            x, y, rowh = 22, y + rowh + 14, 0
        v = View(sh, x - b[0] * s, y + h + b[1] * s, s)
        v.poly(r["poly"], fill="#EEF5F6", stroke=INK, sw=0.3)
        if r["dbl"]:
            v.poly(r["dpoly"], stroke=AQUA, sw=0.4, dash="1.5,1")
        sh.add(f'<text x="{x}" y="{y - 1.5}" font-size="2.3" font-weight="600" fill="{NAVY}" font-family="{FONT}">{r["code"]} · X{r["x"]:.0f}{" · แผงแขน" if r["arm"] else (" + " + r["code"] + "-D" if r["dbl"] else "")}</text>')
        sh.add(f'<text x="{x}" y="{y + h + 4}" font-size="1.9" fill="{TAUPE}" font-family="{FONT}">{b[2] - b[0]:.0f} × {b[3] - b[1]:.0f}</text>')
        x += w + 10
        rowh = max(rowh, h + 4)
    note_block(sh, 22, 228, "ข้อกำหนดตัด", [
        "ไม้อัด 18 มม. (เบอร์ 20) · ดอก Ø6 · มุมในตามไฟล์ R6 · ลบมุมขอบรางที่เข้าร่อง 6 มม.",
        "ซี่โครงแต่ละตัวไม่เหมือนกัน: เขียนรหัสบนชิ้น + ลูกศร FRONT ทุกชิ้น · ประกบชั้นเสริมก่อนประกอบ",
        "ตำแหน่ง X วัดจากปลายซ้ายสุดของโซฟา (ขนานกับแนวยาว)",
    ], size=2.05, lh=3.3)
    return sh


def sheet_rails():
    sh = Sheet(4, "แบบชิ้นส่วน CNC ② รางโค้ง / แกนหมอนข้าง", "1:20")
    view_title(sh, 20, 20, "รางโค้ง (ตัดเป็นท่อนละ 2 ช่องซี่โครง)", "มองจากด้านบน · ต่อกันในร่องซี่โครง ทากาว+สกรู")
    s = 0.05
    x, y, rowh = 22, 34, 0
    for pp in sc.PARTS:
        if pp["code"][:2] not in ("BR", "SB", "SF", "BT", "AT"):
            continue
        b = pp["poly"].bounds
        w, h = (b[2] - b[0]) * s, (b[3] - b[1]) * s
        if x + w > 395:
            x, y, rowh = 22, y + rowh + 10, 0
        v = View(sh, x - b[0] * s, y - b[1] * s, s, flip=False)
        v.poly(pp["poly"], fill="#EEF5F6", stroke=INK, sw=0.25)
        sh.add(f'<text x="{x}" y="{y - 1}" font-size="2" font-weight="600" fill="{NAVY}" font-family="{FONT}">{pp["code"]}</text>')
        x += w + 7
        rowh = max(rowh, h + 3)
    y += rowh + 14
    view_title(sh, 20, y, "แกนหมอนข้าง + แผ่นยึด", "1:10")
    x = 22
    for code in [c for c in ("PL1-2", "PL3-4", "BM", "SP", "LPL", "RP") if any(q["code"] == c for q in sc.PARTS)]:
        pp = sc.part(code)
        b = pp["poly"].bounds
        v = View(sh, x - b[0] * 0.1, y + 10 - b[1] * 0.1, 0.1, flip=False)
        v.poly(pp["poly"], fill="#EEF5F6", stroke=INK, sw=0.3)
        for hx, hy, d in pp["holes"]:
            v.circle(hx, hy, d / 2, sw=0.3)
        sh.add(f'<text x="{x}" y="{y + 8}" font-size="2" font-weight="600" fill="{NAVY}" font-family="{FONT}">{code} ×{pp["qty"]}</text>')
        x += (b[2] - b[0]) * 0.1 + 12
    return sh


def sheet_bom(nsheets):
    sh = Sheet(5, "รายการชิ้นส่วน (BOM โครง)", "—")
    view_title(sh, 20, 20, "รายการตัดไม้อัด 18 มม. (CNC)")
    rows, tot = [], 0
    for pp in sc.PARTS:
        b = pp["poly"].bounds
        a = pp["poly"].area * pp["qty"] / 1e6
        tot += a
        rows.append((pp["code"], pp["name"][:40], pp["qty"], f"{b[2] - b[0]:.0f} × {b[3] - b[1]:.0f}", f"{a:.3f}"))
    half = math.ceil(len(rows) / 2)
    table(sh, 20, 26, [("รหัส", 14), ("ชื่อชิ้น", 62), ("จำนวน", 11), ("กรอบ (มม.)", 24), ("ตร.ม.", 13)], rows[:half], size=1.85, rh=3.4)
    table(sh, 214, 26, [("รหัส", 14), ("ชื่อชิ้น", 62), ("จำนวน", 11), ("กรอบ (มม.)", 24), ("ตร.ม.", 13)], rows[half:], size=1.85, rh=3.4)
    per = sc.FRAME.exterior.length
    note_block(sh, 20, 30 + (half + 1) * 3.4 + 6, "สรุป", [
        f"พื้นที่ชิ้นงานรวม {tot:.2f} ตร.ม. · จัดผังได้ {nsheets} แผ่น 1220×2440 (แผ่นที่ 6) · น้ำหนักโครง ~{tot * 0.018 * 560:.0f} กก.",
        f"ไม้อัดดัด 4 มม.: ฐานรอบตัว ยาว {per:.0f} × สูง 330 × 2 ชั้น · หลังพนัก ยาว {sc.REAR.intersection(sc.BACKZONE).length:.0f} × 760 × 2 ชั้น",
        f"ขาไม้ Ø50 × 80: {len(sc.LEGS)} ขา + ขาซ่อนหมอนข้าง 1 · T-nut M8 + แหวน Ø40: {len(sc.LEGS) + 3} ชุด · สายยางยืด 50 มม. (ขาด ≥ 1,500 N): {webbing_m():.1f} ม.",
    ], size=2.05, lh=3.4)
    return sh


def webbing_m():
    tot = 0
    xs = [r["x"] for r in sc.RIBS if not r["arm"]]
    for a, b in zip(xs[:-1], xs[1:]):
        for j in range(sc.STRIPS):
            x = a + (b - a) * (j + 0.5) / sc.STRIPS
            sb, sf = sc._intervals(sc.SB, x), sc._intervals(sc.SF, x)
            if sb and sf:
                tot += (sf[0][0] - sb[-1][0]) + 2 * 60
    return tot / 1000


def main():
    placed, nsheets = dwg.nest()
    dwg.write_dxf(placed, nsheets, fname=f"{SLUG}-cnc-18mm.dxf", title=sc.MODEL)
    one = os.path.join(OUT, "sofa-1600-parts-1to1.dxf")
    if os.path.exists(one):
        os.replace(one, os.path.join(OUT, f"{SLUG}-parts-1to1.dxf"))
    fab, net_m, buy_m = dwg.sheet_fabric()
    f = os.path.join(OUT, "sofa-1600-fabric-pattern.dxf")
    if os.path.exists(f):
        os.replace(f, os.path.join(OUT, f"{SLUG}-fabric-pattern.dxf"))
    sheets = [sheet_ga(), sheet_frame(), sheet_ribs(), sheet_rails(), sheet_bom(nsheets), dwg.sheet_nest(placed, nsheets), fab]
    css = open(css_path).read() if css_path and os.path.exists(css_path) else ""
    doc = (f'<!doctype html><html lang="th"><head><meta charset="utf-8"><title>{sc.MODEL} drawing</title><style>{css}'
           '@page { size: 420mm 297mm; margin: 0 } html,body{margin:0;padding:0;background:#fff} .sheet{width:420mm;height:297mm;page-break-after:always;overflow:hidden} .sheet:last-child{page-break-after:auto} svg{display:block}'
           f'</style></head><body>{"".join(dwg.render_sheet(s) for s in sheets)}</body></html>')
    doc = doc.replace("sofa-1600-cnc-18mm", f"{SLUG}-cnc-18mm").replace("sofa-1600-parts-1to1", f"{SLUG}-parts-1to1").replace("sofa-1600-fabric-pattern", f"{SLUG}-fabric-pattern")
    open(os.path.join(OUT, f"{SLUG}-drawing.html"), "w").write(doc)
    info = dict(sc.summary(), sheets=nsheets, fabric_net_m=round(net_m, 2), fabric_buy_m=buy_m, webbing_m=round(webbing_m(), 1))
    json.dump(info, open(os.path.join(OUT, f"{SLUG}-summary.json"), "w"), ensure_ascii=False, indent=1, default=float)
    print(json.dumps(info, ensure_ascii=False, default=float))


if __name__ == "__main__":
    main()

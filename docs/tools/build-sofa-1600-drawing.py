#!/usr/bin/env python3
"""
SOFA 1600 x 750 — technical drawing set + CNC DXF.

Output (docs/products/sofa-1600/):
  sofa-1600-drawing.html   -> printed to PDF (A3 landscape, 6 sheets)
  sofa-1600-cnc-18mm.dxf   -> CNC parts nested on 1220x2440 plywood sheets (1:1, mm)
  sofa-1600-parts-1to1.dxf -> every CNC part once, not nested (for CAM re-nesting)

Coordinates (mm):  X = along length (0 = left end, 1600 = right end/arm)
                   Y = depth (0 = back at centre, + towards front)
                   Z = height (0 = floor)
Ribs are drawn in their own (y, z) "local" plane; the plan curve shifts each
rib forward by delta(x).

Run:  python3 docs/tools/build-sofa-1600-drawing.py [path/to/fonts-inline.css]
"""
import base64, math, os, sys, html
from shapely.geometry import box, Polygon, Point, MultiPolygon
from shapely.ops import unary_union
from shapely import affinity
import ezdxf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "docs", "products", "sofa-1600")
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- brand
NAVY, SLATE, AQUA, TAUPE, OFF = "#2B4368", "#2F4554", "#83B7BF", "#958C7B", "#F7F8F8"
INK = "#1E2733"

# ---------------------------------------------------------------- key dims
W, D, H = 1600, 750, 800          # overall
SEAT_H, ARM_H, LEG_H = 420, 520, 80
SEAT_DEPTH = 500
SECTION_D = 670                   # back -> seat front, measured in section
SAG = 30                          # plan curve: ends come forward by 30
T = 18                            # plywood thickness
RIB_X = {"R1": 40, "R2": 310, "R3": 580, "R4": 850, "R5": 1120, "R6": 1390}
A1_X = 1560
RY0, RYF = 15, 620                # rib rear / front edge (local y)
POST_B, POST_T = 105, 75          # back-post front edge at Z290 / at top
DIP, DIP_Z = (270, 470), 230      # webbing clearance dip
HOLE = (290, 110, 450, 190)       # lightening hole (y0, z0, y1, z1)
LEG_Y = (95, 550)                 # rear / front leg (local y) = centre of B2 / B1


def delta(x):
    return SAG * ((x - 700.0) / 700.0) ** 2


DA = delta(RIB_X["R6"])            # arm parts use the R6 shift

# ---------------------------------------------------------------- geometry helpers


def rrect(x0, y0, x1, y1, r):
    return box(x0, y0, x1, y1).buffer(-r, join_style=1).buffer(r, join_style=1)


def round_corner(poly, cx, cy, r, sx, sy):
    """Round the convex corner at (cx,cy); (sx,sy) points into the material."""
    sq = box(min(cx, cx + sx * r), min(cy, cy + sy * r), max(cx, cx + sx * r), max(cy, cy + sy * r))
    cut = sq.difference(Point(cx + sx * r, cy + sy * r).buffer(r, 64))
    return poly.difference(cut)


def fillet_in(poly, cx, cy, r, sx, sy):
    """Add a concave fillet at inside corner (cx,cy); (sx,sy) points into the empty space."""
    sq = box(min(cx, cx + sx * r), min(cy, cy + sy * r), max(cx, cx + sx * r), max(cy, cy + sy * r))
    add = sq.difference(Point(cx + sx * r, cy + sy * r).buffer(r, 64))
    return poly.union(add)


def notch(y0, z0, y1, z1, clr=1.0):
    """Slot/notch for an 18 mm member: +1 mm clearance on the width each side."""
    return box(y0 - clr, z0 - 0.0, y1 + clr, z1 + 0.0)


def clean(p):
    p = p.buffer(0)
    if isinstance(p, MultiPolygon):
        p = max(p.geoms, key=lambda g: g.area)
    return Polygon([(round(x, 2), round(y, 2)) for x, y in p.exterior.coords],
                   [[(round(x, 2), round(y, 2)) for x, y in i.coords] for i in p.interiors]).simplify(0.05)


# ---------------------------------------------------------------- bands (horizontal members, local y range, z range, x range)
BANDS = {
    #       y0   y1   z0   z1    x0                  x1                  name TH
    "B1": (500, 600, 80, 98, RIB_X["R1"] - 9, RIB_X["R6"] + 9, "คานล่างหน้า"),
    "B2": (45, 145, 80, 98, RIB_X["R1"] - 9, RIB_X["R6"] + 9, "คานล่างหลัง"),
    "B3": (520, 620, 272, 290, RIB_X["R1"] - 9, RIB_X["R6"] + 9, "คานรับสายยางหน้า"),
    "B4": (130, 230, 272, 290, RIB_X["R1"] - 9, RIB_X["R6"] + 9, "คานรับสายยางหลัง"),
    "B5": (20, 70, 702, 720, RIB_X["R2"] - 9, RIB_X["R6"] + 9, "คานบนพนักพิง"),
    "B6": (15, 55, 490, 508, RIB_X["R1"] - 9, RIB_X["R6"] + 9, "คานกลางพนักพิงหลัง"),
}


def rib_profile(kind):
    top = {"R1": 600}.get(kind, 720)
    base = box(RY0, 80, RYF, 290)
    post = Polygon([(RY0, 280), (POST_B, 280), (POST_T, top), (RY0, top)])
    p = base.union(post)
    if kind == "R6":
        arm = box(RY0, 80, 490, 480)
        arm = round_corner(arm, 490, 480, 80, -1, -1)
        p = p.union(arm)
    p = round_corner(p, RYF, 80, 60, -1, 1)      # front-bottom
    p = round_corner(p, RY0, 80, 40, 1, 1)       # rear-bottom
    if kind != "R6":
        p = fillet_in(p, POST_B, 290, 30, 1, 1)
        p = p.difference(box(DIP[0], DIP_Z, DIP[1], 300))          # webbing clearance dip
        p = p.difference(rrect(*HOLE, 25))                         # lightening hole
    else:
        p = p.difference(rrect(240, 115, 420, 230, 30))
        p = p.difference(rrect(190, 300, 420, 410, 30))
    # band notches
    for k, (y0, y1, z0, z1, x0, x1, _) in BANDS.items():
        if k == "B5" and kind == "R1":
            continue
        p = p.difference(notch(y0, z0, y1, z1))
    if kind == "R6":
        p = p.difference(arm_slots())
    return clean(p)


AP1_TABS = [(200, 260), (360, 420)]       # y ranges, top plate z 440..458
AP2_TABS = [(200, 280), (360, 440)]       # y ranges, bottom plate z 80..98 (edge notch)
AP3_TABS = [(160, 240), (320, 400)]       # z ranges, front plate y 452..470


def arm_slots():
    s = []
    for a, b in AP1_TABS:
        s.append(notch(a, 440, b, 458))
    for a, b in AP2_TABS:
        s.append(notch(a, 80, b, 98))
    for a, b in AP3_TABS:
        s.append(box(452 - 1, a - 1, 470 + 1, b + 1))
    return unary_union(s)


def a1_profile():
    p = box(RY0, 80, 490, 480)
    p = round_corner(p, RY0, 480, 150, 1, -1)
    p = round_corner(p, 490, 480, 60, -1, -1)
    p = round_corner(p, RY0, 80, 30, 1, 1)
    p = round_corner(p, 490, 80, 30, -1, 1)
    p = p.difference(rrect(150, 160, 400, 380, 40))
    p = p.difference(arm_slots())
    return clean(p)


def band_plan(k, n=80):
    """Band in plan (x, y global)."""
    y0, y1, z0, z1, x0, x1, _ = BANDS[k]
    xs = [x0 + (x1 - x0) * i / n for i in range(n + 1)]
    pts = [(x, y0 + delta(x)) for x in xs] + [(x, y1 + delta(x)) for x in reversed(xs)]
    return Polygon(pts)


# arm plates (between R6 outer face 1399 and A1 inner face 1551), tabs 18 into each
XA0, XA1 = RIB_X["R6"] + 9, A1_X - 9


def plate_with_tabs(v0, v1, tabs):
    """Plate spanning u = XA0..XA1 (x) and v = v0..v1, tabs (v ranges) extend 18 each side."""
    p = box(XA0, v0, XA1, v1)
    for a, b in tabs:
        p = p.union(box(XA0 - T, a, XA1 + T, b))
    return clean(p)


def ap1():
    return plate_with_tabs(140, 450, AP1_TABS)


def ap2():
    p = plate_with_tabs(40, 470, AP2_TABS)
    p = p.difference(rrect(XA0 + 20, 250, XA1 - 20, 360, 25))   # hand hole to reach pill bolts
    return clean(p)


AP3_BOLTS_Z = [200, 380]


def ap3():
    return plate_with_tabs(98 + 1, 440 - 1, AP3_TABS)          # (x, z)


# pill / bolster core (global coords)
PILL_C = (1500, 625)
PILL_R = (70, 100)        # core ellipse semi-axes (x, y)
PILL_SPINE_Y = (545, 563)
PILL_TAB_X = (1480, 1520)


def ellipse(cx, cy, rx, ry):
    return affinity.scale(Point(cx, cy).buffer(1, 128), rx, ry)


def pl_disc():
    p = ellipse(*PILL_C, *PILL_R)
    p = p.difference(box(PILL_TAB_X[0] - 1, PILL_SPINE_Y[0] - 1, PILL_TAB_X[1] + 1, PILL_SPINE_Y[1] + 1))
    return clean(p)


def pl_spine():  # (x, z) plane
    p = box(1460, 118, 1540, 462)
    p = p.union(box(PILL_TAB_X[0], 100, PILL_TAB_X[1], 480))
    return clean(p)


def leg_pad():
    return clean(box(0, 0, 90, 90))


def spacer_disc():
    return clean(Point(0, 0).buffer(35, 64))


# ---------------------------------------------------------------- parts list
PARTS = []   # dict(code, name, qty, poly, holes(list of (x,y,d)), note)


def add(code, name, qty, poly, holes=(), note=""):
    PARTS.append(dict(code=code, name=name, qty=qty, poly=poly, holes=list(holes), note=note))


add("R1", "ซี่โครงปลายซ้าย (พนักต่ำ)", 1, rib_profile("R1"), note="พนักสูงถึง Z600 · ปลายมนด้วยฟองน้ำ")
add("R2-R5", "ซี่โครงมาตรฐาน", 4, rib_profile("R2"), note="ตำแหน่ง X310 / 580 / 850 / 1120")
add("R6", "แผงข้างใน-ที่เท้าแขน", 1, rib_profile("R6"), note="ตัน · ร่องรับแผ่น AP1-3")
add("A1", "แผงข้างนอก-ที่เท้าแขน", 1, a1_profile(), note="X1560")
for k in BANDS:
    add(k, BANDS[k][6], 1, clean(band_plan(k)), note="โค้งตามแปลน · ยาวตามปลายซี่โครง")
add("AP1", "แผ่นบนกล่องแขน", 1, ap1())
add("AP2", "แผ่นล่างกล่องแขน", 1, ap2(), holes=[(1475, LEG_Y[0], 10), (1475, 420, 10)], note="รูขาเตรียม Ø10")
add("AP3", "แผ่นหน้ากล่องแขน (ยึดหมอนข้าง)", 1, ap3(), holes=[(1500, z, 9) for z in AP3_BOLTS_Z], note="รูน็อต M8")
add("PL1-2", "แผ่นบน/ล่าง แกนหมอนข้าง", 2, pl_disc())
add("PL3", "แกนตั้ง หมอนข้าง", 1, pl_spine(), holes=[(1500, z, 9) for z in AP3_BOLTS_Z], note="ตอกตะปูเกลียว T-nut M8 ด้านหน้า")
add("LP", "แผ่นรองขา", 6, leg_pad(), holes=[(45, 45, 10)], note="ฝัง T-nut M8 จากด้านบน")
add("SP", "แผ่นรองระยะ หมอนข้าง", 4, spacer_disc(), holes=[(0, 0, 9)], note="กาวติดหลัง PL3 ซ้อน 2 ชั้น/จุด")


def part(code):
    return next(p for p in PARTS if p["code"] == code)


# ---------------------------------------------------------------- finished (upholstered) shape
def zt(x):
    """Back top in front elevation."""
    if x < 30:
        return 560
    if x < 330:
        t = (x - 30) / 300
        return 600 + 200 * math.sin(t * math.pi / 2)
    if x < 1180:
        return 800
    t = min(1, (x - 1180) / 220)
    return 800 - 150 * (1 - math.cos(t * math.pi / 2))


def finished_plan():
    xs = [i * 1400 / 120 for i in range(121)]
    body = Polygon([(x, delta(x)) for x in xs] + [(x, delta(x) + SECTION_D) for x in reversed(xs)])
    body = body.buffer(-150, join_style=1).buffer(150, join_style=1)
    arm = box(1380, DA, 1600, DA + 500)
    arm = round_corner(arm, 1600, DA, 160, -1, 1)
    arm = round_corner(arm, 1600, DA + 500, 90, -1, -1)
    pill = ellipse(1500, 625, 100, 125)
    return body, arm, pill


def finished_section():
    seat = box(0, 80, SECTION_D, SEAT_H)
    seat = round_corner(seat, SECTION_D, SEAT_H, 70, -1, -1)
    seat = round_corner(seat, SECTION_D, 80, 110, -1, 1)
    seat = round_corner(seat, 0, 80, 50, 1, 1)
    back = Polygon([(0, 300), (172, 300), (172, SEAT_H), (128, H), (0, H)])
    back = back.buffer(-60, join_style=1).buffer(60, join_style=1)
    p = seat.union(back)
    p = fillet_in(p, 171, SEAT_H, 25, 1, 1)
    return clean(p)


# ---------------------------------------------------------------- SVG helpers
FONT = "'Noto Sans Thai','Montserrat',sans-serif"


class Sheet:
    def __init__(self, no, title, scale_note):
        self.no, self.title, self.scale_note = no, title, scale_note
        self.e = []

    def add(self, s):
        self.e.append(s)


class View:
    def __init__(self, sheet, ox, oy, s, flip=True):
        self.sh, self.ox, self.oy, self.s, self.flip = sheet, ox, oy, s, flip

    def P(self, x, y):
        return (self.ox + x * self.s, self.oy - y * self.s if self.flip else self.oy + y * self.s)

    def poly(self, poly, stroke=INK, fill="none", sw=0.35, dash=None, op=1):
        if isinstance(poly, MultiPolygon):
            for g in poly.geoms:
                self.poly(g, stroke, fill, sw, dash, op)
            return
        d = ""
        for ring in [poly.exterior] + list(poly.interiors):
            pts = [self.P(x, y) for x, y in ring.coords]
            d += "M" + " L".join(f"{a:.2f},{b:.2f}" for a, b in pts) + "Z "
        da = f' stroke-dasharray="{dash}"' if dash else ""
        self.sh.add(f'<path d="{d}" fill="{fill}" fill-rule="evenodd" fill-opacity="{op}" stroke="{stroke}" stroke-width="{sw}"{da} stroke-linejoin="round"/>')

    def line(self, pts, stroke=INK, sw=0.3, dash=None):
        q = [self.P(x, y) for x, y in pts]
        da = f' stroke-dasharray="{dash}"' if dash else ""
        self.sh.add(f'<polyline points="{" ".join(f"{a:.2f},{b:.2f}" for a, b in q)}" fill="none" stroke="{stroke}" stroke-width="{sw}"{da}/>')

    def circle(self, x, y, r, stroke=INK, fill="none", sw=0.3, dash=None):
        a, b = self.P(x, y)
        da = f' stroke-dasharray="{dash}"' if dash else ""
        self.sh.add(f'<circle cx="{a:.2f}" cy="{b:.2f}" r="{r * self.s:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{da}/>')

    def text(self, x, y, t, size=2.4, color=INK, anchor="middle", weight=400, dx=0, dy=0, rot=0):
        a, b = self.P(x, y)
        a += dx
        b += dy
        tr = f' transform="rotate({rot} {a:.2f} {b:.2f})"' if rot else ""
        self.sh.add(f'<text x="{a:.2f}" y="{b:.2f}" font-size="{size}" fill="{color}" text-anchor="{anchor}" font-weight="{weight}" font-family="{FONT}"{tr}>{html.escape(t)}</text>')

    def label(self, x, y, t, lx, ly, size=2.3, color=NAVY):
        """Leader from real point (x,y) to paper offset (lx,ly)."""
        a, b = self.P(x, y)
        c, d = a + lx, b + ly
        self.sh.add(f'<circle cx="{a:.2f}" cy="{b:.2f}" r="0.5" fill="{color}"/>')
        self.sh.add(f'<polyline points="{a:.2f},{b:.2f} {c:.2f},{d:.2f}" stroke="{color}" stroke-width="0.2" fill="none"/>')
        anc = "start" if lx >= 0 else "end"
        self.sh.add(f'<text x="{c + (0.8 if lx >= 0 else -0.8):.2f}" y="{d + 0.8:.2f}" font-size="{size}" fill="{color}" text-anchor="{anc}" font-family="{FONT}" font-weight="500">{html.escape(t)}</text>')

    def dim(self, p1, p2, off, orient="h", text=None, color=TAUPE, size=2.5):
        (a1, b1), (a2, b2) = self.P(*p1), self.P(*p2)
        val = abs(p2[0] - p1[0]) if orient == "h" else abs(p2[1] - p1[1])
        t = text if text is not None else f"{val:.0f}"
        out = []
        if orient == "h":
            yd = (min(b1, b2) + off) if off < 0 else (max(b1, b2) + off)
            for a, b in ((a1, b1), (a2, b2)):
                s = 1 if yd > b else -1
                out.append(f'<line x1="{a:.2f}" y1="{b + s * 1:.2f}" x2="{a:.2f}" y2="{yd + s * 1.5:.2f}"/>')
            out.append(f'<line x1="{a1:.2f}" y1="{yd:.2f}" x2="{a2:.2f}" y2="{yd:.2f}"/>')
            for a, sgn in ((min(a1, a2), 1), (max(a1, a2), -1)):
                out.append(f'<path d="M{a:.2f},{yd:.2f} l{sgn * 2.2:.2f},-0.7 l0,1.4 Z" fill="{color}" stroke="none"/>')
            tx, ty, rot = (a1 + a2) / 2, yd - 0.9, 0
        else:
            xd = (min(a1, a2) + off) if off < 0 else (max(a1, a2) + off)
            for a, b in ((a1, b1), (a2, b2)):
                s = 1 if xd > a else -1
                out.append(f'<line x1="{a + s * 1:.2f}" y1="{b:.2f}" x2="{xd + s * 1.5:.2f}" y2="{b:.2f}"/>')
            out.append(f'<line x1="{xd:.2f}" y1="{b1:.2f}" x2="{xd:.2f}" y2="{b2:.2f}"/>')
            for b, sgn in ((min(b1, b2), 1), (max(b1, b2), -1)):
                out.append(f'<path d="M{xd:.2f},{b:.2f} l-0.7,{sgn * 2.2:.2f} l1.4,0 Z" fill="{color}" stroke="none"/>')
            tx, ty, rot = xd - 0.9, (b1 + b2) / 2, -90
        tr = f' transform="rotate({rot} {tx:.2f} {ty:.2f})"' if rot else ""
        out.append(f'<text x="{tx:.2f}" y="{ty:.2f}" font-size="{size}" fill="{color}" stroke="none" text-anchor="middle" font-family="{FONT}" font-weight="500"{tr}>{html.escape(t)}</text>')
        self.sh.add(f'<g stroke="{color}" stroke-width="0.2">' + "".join(out) + "</g>")


def view_title(sheet, x, y, t, sub=""):
    sheet.add(f'<text x="{x}" y="{y}" font-size="3.6" font-weight="600" fill="{NAVY}" font-family="{FONT}" letter-spacing="0.3">{html.escape(t)}</text>')
    if sub:
        sheet.add(f'<text x="{x}" y="{y + 4}" font-size="2.3" fill="{TAUPE}" font-family="{FONT}">{html.escape(sub)}</text>')
    sheet.add(f'<line x1="{x}" y1="{y + 1.2 + (4 if sub else 0)}" x2="{x + 60}" y2="{y + 1.2 + (4 if sub else 0)}" stroke="{AQUA}" stroke-width="0.5"/>')


def hatch_defs():
    return (f'<defs><pattern id="hatch" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
            f'<line x1="0" y1="0" x2="0" y2="2" stroke="{TAUPE}" stroke-width="0.35"/></pattern>'
            f'<pattern id="foam" width="3" height="3" patternUnits="userSpaceOnUse">'
            f'<circle cx="1.5" cy="1.5" r="0.35" fill="{AQUA}"/></pattern></defs>')


LOGO = open(os.path.join(ROOT, "docs/brand/logo.svg")).read().replace("currentColor", NAVY)
LOGO_URI = "data:image/svg+xml;base64," + base64.b64encode(LOGO.encode()).decode()
N_SHEETS = 6
REV = "A · ร่างเพื่อตรวจ"
DATE = "2026-11-11"


def frame_svg(sheet):
    s = [f'<rect x="8" y="8" width="404" height="281" fill="none" stroke="{INK}" stroke-width="0.6"/>',
         f'<rect x="10" y="10" width="400" height="277" fill="none" stroke="{INK}" stroke-width="0.25"/>']
    # title block
    x0, y0 = 262, 252
    s.append(f'<rect x="{x0}" y="{y0}" width="148" height="35" fill="{OFF}" stroke="{INK}" stroke-width="0.3"/>')
    s.append(f'<image href="{LOGO_URI}" x="{x0 + 3}" y="{y0 + 3}" width="14" height="28"/>')
    s.append(f'<line x1="{x0 + 20}" y1="{y0}" x2="{x0 + 20}" y2="{y0 + 35}" stroke="{INK}" stroke-width="0.2"/>')
    t = lambda x, y, txt, sz=2.2, w=400, c=INK: s.append(
        f'<text x="{x}" y="{y}" font-size="{sz}" font-weight="{w}" fill="{c}" font-family="{FONT}">{html.escape(txt)}</text>')
    t(x0 + 23, y0 + 5, "CHAW CHER · SOFA 1600 — โซฟาโค้ง 1600 × 750", 2.8, 600, NAVY)
    t(x0 + 23, y0 + 10.5, sheet.title, 3.2, 600, INK)
    s.append(f'<line x1="{x0 + 20}" y1="{y0 + 13.5}" x2="{x0 + 148}" y2="{y0 + 13.5}" stroke="{INK}" stroke-width="0.2"/>')
    cells = [("แผ่นที่ / SHEET", f"{sheet.no} / {N_SHEETS}"), ("มาตราส่วน / SCALE", sheet.scale_note),
             ("หน่วย / UNIT", "มม. (mm)"), ("วันที่ / DATE", DATE),
             ("แก้ไข / REV", REV), ("โครง / FRAME", "ไม้อัด 18 มม. CNC")]
    for i, (k, v) in enumerate(cells):
        cx = x0 + 23 + (i % 3) * 42
        cy = y0 + 18 + (i // 3) * 8.5
        t(cx, cy, k, 1.7, 400, TAUPE)
        t(cx, cy + 3.6, v, 2.3, 500, INK)
    t(x0 + 23, y0 + 33.5, "ผู้ออกแบบ: CHAW CHER   ·   ผู้อนุมัติ: ____________ (Bay)   ·   ผู้ผลิต: ____________", 1.8, 400, TAUPE)
    return "".join(s)


def render_sheet(sheet):
    return (f'<section class="sheet"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 297" width="420mm" height="297mm">'
            f'<rect width="420" height="297" fill="#fff"/>{hatch_defs()}{frame_svg(sheet)}{"".join(sheet.e)}</svg></section>')


def note_block(sheet, x, y, title, lines, size=2.25, lh=3.6, width=None):
    sheet.add(f'<text x="{x}" y="{y}" font-size="2.8" font-weight="600" fill="{NAVY}" font-family="{FONT}">{html.escape(title)}</text>')
    yy = y + 4.5
    for ln in lines:
        w = 600 if ln.startswith("!") else 400
        c = "#9A3B2E" if ln.startswith("!") else INK
        ln = ln.lstrip("!")
        sheet.add(f'<text x="{x}" y="{yy}" font-size="{size}" font-weight="{w}" fill="{c}" font-family="{FONT}">{html.escape(ln)}</text>')
        yy += lh
    return yy


def table(sheet, x, y, cols, rows, size=2.1, rh=4.0, head_fill=NAVY):
    tw = sum(w for _, w in cols)
    sheet.add(f'<rect x="{x}" y="{y}" width="{tw}" height="{rh}" fill="{head_fill}"/>')
    cx = x
    for name, w in cols:
        sheet.add(f'<text x="{cx + 1}" y="{y + rh - 1.2}" font-size="{size}" font-weight="600" fill="#fff" font-family="{FONT}">{html.escape(name)}</text>')
        cx += w
    yy = y + rh
    for i, r in enumerate(rows):
        if i % 2 == 0:
            sheet.add(f'<rect x="{x}" y="{yy}" width="{tw}" height="{rh}" fill="{OFF}"/>')
        cx = x
        for (name, w), v in zip(cols, r):
            sheet.add(f'<text x="{cx + 1}" y="{yy + rh - 1.2}" font-size="{size}" fill="{INK}" font-family="{FONT}">{html.escape(str(v))}</text>')
            cx += w
        yy += rh
    sheet.add(f'<rect x="{x}" y="{y}" width="{tw}" height="{yy - y}" fill="none" stroke="{INK}" stroke-width="0.25"/>')
    return yy


# ---------------------------------------------------------------- SHEET 1 · GA
def sheet_ga():
    sh = Sheet(1, "ภาพรวมและขนาด (GENERAL ARRANGEMENT)", "1:10")
    body, arm, pill = finished_plan()

    # front elevation
    v = View(sh, 30, 120, 0.1)
    view_title(sh, 20, 20, "รูปด้านหน้า · FRONT ELEVATION", "มองจากด้านหน้า (ฝั่งนั่ง)")
    xs = [20 + i * (1380 / 100) for i in range(101)]
    back = Polygon([(20, 300)] + [(x, zt(x)) for x in xs] + [(1400, 300)])
    v.poly(back, fill=OFF, sw=0.45)
    seat = rrect(0, 80, 1405, SEAT_H, 1)
    seat = round_corner(seat, 0, SEAT_H, 110, 1, -1)
    seat = round_corner(seat, 0, 80, 70, 1, 1)
    v.poly(seat, fill="#fff", sw=0.45)
    armf = box(1380, 80, 1600, 500)
    armf = round_corner(armf, 1600, 500, 100, -1, -1)
    armf = round_corner(armf, 1380, 500, 60, 1, -1)
    armf = round_corner(armf, 1600, 80, 60, -1, 1)
    v.poly(armf, fill=OFF, sw=0.45)
    v.poly(rrect(1400, 60, 1600, 520, 99), fill="#fff", sw=0.5)
    for lx in (150, 850):
        v.poly(box(lx - 25, 0, lx + 25, 80), fill="#E9DFCF", sw=0.35)
    v.poly(box(1450, 0, 1500, 60), fill="#E9DFCF", sw=0.3, dash="1.2,0.8")
    v.line([(-60, 0), (1660, 0)], sw=0.25)
    v.dim((0, 0), (1600, 0), 10, "h", "A = 1600")
    v.dim((1600, 0), (1600, SEAT_H), 6, "v", "420 (เบาะนั่ง)")
    v.dim((1600, 0), (1600, ARM_H), 14, "v", "520 (ที่เท้าแขน)")
    v.dim((1600, 0), (1600, H), 22, "v", "800 (รวม)")
    v.dim((0, SEAT_H), (0, H), -6, "v", "380")
    v.dim((0, 0), (0, LEG_H), -6, "v", "80")
    v.label(150, 40, "ขาไม้กลม Ø50 × 80 (6 ขา)", -8, 10)
    v.label(1500, 300, "หมอนข้าง (ชิ้นแยก ยึดน็อต)", 6, -28)
    v.label(700, 640, "พนักพิง ฟองน้ำ SQ", 0, -28)

    # plan
    p = View(sh, 30, 150, 0.1, flip=False)
    view_title(sh, 20, 136, "รูปแปลน · PLAN (มองจากด้านบน)")
    p.poly(body, fill=OFF, sw=0.45)
    p.poly(arm, fill=OFF, sw=0.45)
    p.poly(pill, fill="#fff", sw=0.5)
    xs2 = [i * 1400 / 80 for i in range(81)]
    p.line([(x, delta(x) + 172) for x in xs2 if 60 < x < 1385], sw=0.25, dash="2,1")   # back face
    p.line([(x, delta(x) + 120) for x in xs2 if 60 < x < 1385], sw=0.18, dash="0.8,0.8")
    p.text(700, 90, "พนักพิง", 2.3, TAUPE)
    p.text(420, 430, "ที่นั่ง", 2.6, TAUPE)
    p.dim((0, -20), (1600, -20), -5, "h", "A = 1600")
    p.dim((0, delta(0)), (0, delta(0) + SECTION_D), -7, "v", f"B = {SECTION_D + delta(0):.0f}")
    p.dim((1610, DA), (1610, DA + SECTION_D), 6, "v", f"C = {SECTION_D:.0f}")
    p.dim((1610, DA + SECTION_D), (1610, 750), 14, "v", "")
    p.text(1640, 745, f"D = {750 - DA - SECTION_D:.0f}", 2.5, TAUPE, "start", 500, dx=4)
    p.dim((1650, 0), (1650, 750), 22, "v", "รวม 750")
    p.line([(1380, DA + SECTION_D), (1640, DA + SECTION_D)], sw=0.15, dash="1,1")
    p.line([(700, 0), (1660, 0)], sw=0.15, dash="1,1")
    p.line([(1500, 750), (1660, 750)], sw=0.15, dash="1,1")
    p.dim((700, delta(700) + 172), (700, delta(700) + SECTION_D), 6, "v", "500")
    p.text(80, 790, f"แนวโค้ง: ปลายทั้งสองข้างยื่นมาหน้า {SAG} มม. เทียบกึ่งกลาง (โค้งพาราโบลา ลากผ่าน X0 / X700 / X1400)", 2.1, TAUPE, "start")

    # section
    s = View(sh, 268, 120, 0.1)
    view_title(sh, 250, 20, "รูปตัด 1-1 · SECTION", "ตัดที่ X850 (กลางตัว)")
    sec = finished_section()
    s.poly(sec, fill=OFF, sw=0.5)
    s.poly(part("R2-R5")["poly"], fill="url(#hatch)", stroke=TAUPE, sw=0.25)
    s.line([(-30, 0), (720, 0)], sw=0.25)
    for ly in LEG_Y:
        s.poly(box(ly - 25, 0, ly + 25, 80), fill="#E9DFCF", sw=0.3)
    s.dim((0, 0), (SECTION_D, 0), 8, "h", f"{SECTION_D}")
    s.dim((172, SEAT_H), (SECTION_D, SEAT_H), -14, "h", "ลึกที่นั่ง 500")
    s.dim((SECTION_D, 0), (SECTION_D, SEAT_H), 6, "v", "420")
    s.dim((0, 0), (0, H), -6, "v", "800")
    s.label(400, 290, "สายยางยืด 50 มม.", 8, 6)
    s.label(300, 380, "ฟองน้ำที่นั่ง", 18, -14)
    s.label(60, 650, "พนักพิง", -6, -10)
    s.text(420, 760, "ส่วนลาย = โครงไม้อัด (แผ่นที่ 3)", 2.0, TAUPE)

    # right side elevation
    r = View(sh, 268, 232, 0.1)
    view_title(sh, 250, 132, "รูปด้านข้างขวา · RIGHT SIDE", "ด้านที่เท้าแขน")
    r.poly(finished_section(), fill=OFF, sw=0.3, dash="1.5,1")
    a = box(0, 80, 500, 500)
    a = round_corner(a, 0, 500, 160, 1, -1)
    a = round_corner(a, 500, 500, 90, -1, -1)
    a = round_corner(a, 0, 80, 50, 1, 1)
    r.poly(a, fill="#fff", sw=0.45)
    r.poly(rrect(500, 60, 750, 520, 110), fill="#fff", sw=0.5)
    r.line([(-30, 0), (780, 0)], sw=0.25)
    r.poly(box(LEG_Y[0] - 25, 0, LEG_Y[0] + 25, 80), fill="#E9DFCF", sw=0.3)
    r.poly(box(395, 0, 445, 80), fill="#E9DFCF", sw=0.3, dash="1,0.8")
    r.dim((750, 0), (750, ARM_H), 6, "v", "520")
    r.dim((500, 0), (750, 0), 8, "h", "250")
    r.dim((0, 0), (500, 0), 8, "h", "500")
    r.dim((750, 0), (750, 60), 14, "v", "60")

    note_block(sh, 20, 262, "หมายเหตุ", [
        "!ขนาด B C D ในภาพสเก็ตช์ยังไม่ระบุตัวเลข — ค่าในแบบนี้เป็นค่าเสนอ ให้ Bay ยืนยันก่อนตัด CNC",
        "ขนาดเป็นขนาดสำเร็จหุ้มผ้าแล้ว (± 10 มม.) · ความสูงที่นั่ง 420 วัดที่เบาะยังไม่นั่งทับ",
        "ผ้า: บูเคล่ / เท็ดดี้ ตามที่ลูกค้าเลือก · หมอนข้างเป็นชิ้นแยก หุ้มผ้าแยก ยึดน็อต M8 2 ตัว ถอดส่งได้",
    ], size=2.15, lh=3.5)
    return sh


# ---------------------------------------------------------------- SHEET 2 · frame layout
def obl(x, y, z):
    """Cabinet oblique: front plane true, depth goes back up-right at 35 deg, half scale."""
    d = (750 - y) * 0.5
    return (x + d * math.cos(math.radians(35)), -z - d * math.sin(math.radians(35)))


LEGS = [(150, LEG_Y[1] + delta(150)), (150, LEG_Y[0] + delta(150)), (850, LEG_Y[1] + delta(850)),
        (850, LEG_Y[0] + delta(850)), (1475, LEG_Y[0] + DA), (1475, 420 + DA)]


def sheet_frame():
    sh = Sheet(2, "โครงสร้างไม้อัด CNC (FRAME LAYOUT)", "1:10 / 3D ไม่ตามมาตรา")
    # ---- plan of frame
    p = View(sh, 30, 42, 0.1, flip=False)
    view_title(sh, 20, 20, "แปลนโครง · FRAME PLAN", "ตำแหน่งซี่โครง คาน และขา (มองจากด้านบน ด้านล่างของภาพ = หน้า)")
    for k in BANDS:
        p.poly(part(k)["poly"], fill=AQUA if k in ("B3", "B4") else OFF, sw=0.3, op=0.45)
    for k, x in RIB_X.items():
        y0, y1 = RY0 + delta(x), RYF + delta(x)
        p.poly(box(x - 9, y0, x + 9, y1), fill=NAVY, sw=0.2)
        p.text(x, y0 - 14, k, 2.3, NAVY, weight=600)
    p.poly(box(A1_X - 9, RY0 + DA, A1_X + 9, 490 + DA), fill=NAVY, sw=0.2)
    p.text(A1_X, RY0 + DA - 14, "A1", 2.3, NAVY, weight=600)
    p.poly(affinity.translate(ap1(), 0, DA), stroke=TAUPE, sw=0.25, dash="1,0.6")
    p.poly(box(XA0, 452 + DA, XA1, 470 + DA), fill=TAUPE, sw=0.2)
    p.text(1475, 300 + DA, "AP1", 1.9, TAUPE, weight=600)
    p.text(1475, 505 + DA, "AP3", 1.9, TAUPE, weight=600)
    p.poly(pl_disc(), stroke=NAVY, sw=0.3)
    p.poly(box(1460, PILL_SPINE_Y[0], 1540, PILL_SPINE_Y[1]), fill=NAVY, sw=0.2)
    p.text(1500, 690, "PL", 1.9, NAVY, weight=600)
    for i, (x, y) in enumerate(LEGS):
        p.circle(x, y, 25, stroke="#9A3B2E", sw=0.35)
        p.text(x, y + 9, f"L{i + 1}", 1.6, "#9A3B2E", weight=600)
    xs = list(RIB_X.values())
    for b in range(5):
        xa, xb = xs[b] + 9, xs[b + 1] - 9
        for j in range(3):
            xc = xa + (xb - xa) * (j + 0.5) / 3
            for dx in (-25, 25):
                p.line([(xc + dx, 180 + delta(xc)), (xc + dx, 570 + delta(xc))], stroke=AQUA, sw=0.25)
    for t, yy in (("B2 B5 B6", 70), ("B4", 180), ("B1 B3", 560)):
        p.text(-25, yy + delta(31) + 7, t, 1.9, TAUPE, "end", 600)
    allx = [0] + xs + [A1_X, 1600]
    for a, b in zip(allx[:-1], allx[1:]):
        p.dim((a, -10), (b, -10), -11, "h")
    p.text(0, 800, "ระยะ = กึ่งกลางความหนาไม้ · ซี่โครงทุกแผ่นตั้งฉากแกน X และเลื่อนไปหน้าตามแนวโค้ง delta(x) (ตารางแผ่นที่ 4)", 2.0, TAUPE, "start")
    p.text(0, 835, "เส้นฟ้า = สายยางยืด 50 มม. แนวหน้า-หลัง 3 เส้น/ช่อง รวม 15 เส้น · วงแดง = ขา L1-L6 · แถบฟ้า = คานรับสายยาง B3 B4", 2.0, TAUPE, "start")

    # ---- 3D (oblique)
    view_title(sh, 215, 20, "ภาพ 3 มิติโครง · FRAME 3D", "ไม่ตามมาตราส่วน · มองจากด้านหน้า-ขวา-บน")
    ox, oy, sc = 222, 150, 0.098

    def path3(pts):
        q = [obl(*pt) for pt in pts]
        return "M" + " L".join(f"{ox + a * sc:.2f},{oy + b * sc:.2f}" for a, b in q) + "Z"

    layers = []   # (order, svg)
    profs = {k: (part("R2-R5")["poly"] if k in ("R2", "R3", "R4", "R5") else part(k)["poly"]) for k in RIB_X}
    for k, x in RIB_X.items():
        prof, dy = profs[k], delta(x)
        for xx, shade in ((x - 9, "#CFE2E5"), (x + 9, "#EEF5F6")):
            rings = [[(xx, yy + dy, zz) for yy, zz in prof.exterior.coords]] + \
                    [[(xx, yy + dy, zz) for yy, zz in r.coords] for r in prof.interiors]
            layers.append((xx, f'<path d="{"".join(path3(r) for r in rings)}" fill="{shade}" fill-rule="evenodd" stroke="{NAVY}" stroke-width="0.2" fill-opacity="0.9"/>'))
    a1 = part("A1")["poly"]
    for xx, shade in ((A1_X - 9, "#CFE2E5"), (A1_X + 9, "#EEF5F6")):
        rings = [[(xx, yy + DA, zz) for yy, zz in a1.exterior.coords]] + [[(xx, yy + DA, zz) for yy, zz in r.coords] for r in a1.interiors]
        layers.append((xx, f'<path d="{"".join(path3(r) for r in rings)}" fill="{shade}" fill-rule="evenodd" stroke="{NAVY}" stroke-width="0.2" fill-opacity="0.9"/>'))
    # bands: draw each band segment between ribs so ordering with ribs works
    for k in BANDS:
        y0, y1, z0, z1, x0, x1, _ = BANDS[k]
        cuts = [x0] + [x for x in RIB_X.values() if x0 + 1 < x < x1 - 1] + [x1]
        for a, b in zip(cuts[:-1], cuts[1:]):
            n = 6
            xs2 = [a + (b - a) * i / n for i in range(n + 1)]
            top = [(x, y0 + delta(x), z1) for x in xs2] + [(x, y1 + delta(x), z1) for x in reversed(xs2)]
            front = [(x, y1 + delta(x), z1) for x in xs2] + [(x, y1 + delta(x), z0) for x in reversed(xs2)]
            svg = (f'<path d="{path3(front)}" fill="#D8CBB5" stroke="{TAUPE}" stroke-width="0.15"/>'
                   f'<path d="{path3(top)}" fill="#EFE6D6" stroke="{TAUPE}" stroke-width="0.2"/>')
            layers.append(((a + b) / 2, svg))
    q = [(XA0, 140 + DA, 458), (XA1, 140 + DA, 458), (XA1, 450 + DA, 458), (XA0, 450 + DA, 458)]
    layers.append((1475, f'<path d="{path3(q)}" fill="#EFE6D6" stroke="{TAUPE}" stroke-width="0.2"/>'))
    q = [(XA0, 470 + DA, 98), (XA1, 470 + DA, 98), (XA1, 470 + DA, 440), (XA0, 470 + DA, 440)]
    layers.append((1476, f'<path d="{path3(q)}" fill="#D8CBB5" stroke="{TAUPE}" stroke-width="0.2"/>'))
    e = pl_disc()
    pill = (f'<path d="{path3([(x, y, 118) for x, y in e.exterior.coords])}" fill="#CFE2E5" stroke="{NAVY}" stroke-width="0.2"/>'
            f'<path d="{path3([(1460, 563, 118), (1540, 563, 118), (1540, 563, 462), (1460, 563, 462)])}" fill="#CFE2E5" stroke="{NAVY}" stroke-width="0.2"/>'
            f'<path d="{path3([(x, y, 480) for x, y in e.exterior.coords])}" fill="#EEF5F6" stroke="{NAVY}" stroke-width="0.2"/>')
    layers.append((1700, pill))
    for (x, y) in LEGS:
        a, b = obl(x, y, 80)
        c, d = obl(x, y, 0)
        layers.append((x + 0.5, f'<line x1="{ox + a * sc:.2f}" y1="{oy + b * sc:.2f}" x2="{ox + c * sc:.2f}" y2="{oy + d * sc:.2f}" stroke="#B5835A" stroke-width="{50 * sc:.2f}" stroke-linecap="butt"/>'))
    for _, svg in sorted(layers, key=lambda t: t[0]):
        sh.add(svg)

    def tag(x, y, z, t, dx, dy):
        a, b = obl(x, y, z)
        a, b = ox + a * sc, oy + b * sc
        sh.add(f'<line x1="{a:.2f}" y1="{b:.2f}" x2="{a + dx:.2f}" y2="{b + dy:.2f}" stroke="{NAVY}" stroke-width="0.2"/>'
               f'<circle cx="{a:.2f}" cy="{b:.2f}" r="0.6" fill="{NAVY}"/>'
               f'<text x="{a + dx + (0.8 if dx >= 0 else -0.8):.2f}" y="{b + dy + 0.8:.2f}" font-size="2.3" font-weight="600" fill="{NAVY}" text-anchor="{"start" if dx >= 0 else "end"}" font-family="{FONT}">{html.escape(t)}</text>')
    tag(40, 300, 550, "R1", -6, -6)
    tag(310, 40, 680, "R2", -4, -10)
    tag(1120, 40, 690, "R5", 0, -10)
    tag(800, 45, 720, "B5", 4, -16)
    tag(1000, 35, 508, "B6", 8, -24)
    tag(250, 570 + delta(250), 290, "B3", -12, 10)
    tag(450, 180 + delta(450), 290, "B4", -10, -16)
    tag(450, 550 + delta(450), 80, "B1", 2, 14)
    tag(1390, 300, 600, "R6", 0, -12)
    tag(1475, 300 + DA, 458, "AP1", 6, -12)
    tag(1475, 470 + DA, 300, "AP3", 14, 8)
    tag(1500, 680, 480, "PL1-3", 14, -2)
    tag(A1_X, 300 + DA, 200, "A1", 20, 6)
    tag(150, LEG_Y[1], 30, "ขา", -10, 8)

    # ---- rib key
    s = View(sh, 50, 264, 0.1)
    view_title(sh, 20, 176, "ซี่โครง + ตำแหน่งชิ้นส่วน · RIB KEY", "ภาพตัดแนวลึก (Y-Z) มาตราส่วน 1:10 · หน้าอยู่ทางขวา")
    s.poly(part("R2-R5")["poly"], fill="#EEF5F6", stroke=NAVY, sw=0.35)
    for k, (y0, y1, z0, z1, *_r) in BANDS.items():
        s.poly(box(y0, z0, y1, z1), fill=TAUPE, stroke=TAUPE, sw=0.1)
    for k, dx, dy in (("B1", 0, 4), ("B2", 0, 4), ("B3", 0, -3), ("B4", 0, -3), ("B5", 6, -2), ("B6", -6, 1)):
        y0, y1, z0, z1 = BANDS[k][:4]
        s.text((y0 + y1) / 2, (z0 + z1) / 2, k, 1.9, TAUPE, weight=600, dx=dx, dy=dy)
    s.line([(BANDS["B4"][0], 293), (BANDS["B3"][1], 293)], stroke=AQUA, sw=0.8)
    s.line([(RYF + 4, 98), (RYF + 4, 290)], stroke="#9A3B2E", sw=0.5)
    s.line([(RY0 - 4, 98), (RY0 - 4, 720)], stroke="#9A3B2E", sw=0.5)
    s.line([(POST_B + 4, 300), (POST_T + 4, 715)], stroke="#9A3B2E", sw=0.5)
    s.label(350, 293, "สายยางยืด 50 มม.", 6, -12, color="#2E7F8A")
    s.label(RYF + 4, 200, "SK1 ไม้อัดดัด 4 มม.", 5, 0, color="#9A3B2E")
    s.label(RY0 - 4, 400, "SK2 ไม้อัดดัด 4 มม. ×2", -4, 0, color="#9A3B2E")
    s.label(POST_T + 18, 560, "SK3 ไม้อัดดัด 4 มม.", 12, -4, color="#9A3B2E")
    s.dim((RY0, 80), (RYF, 80), 6, "h")
    s.dim((RYF, 80), (RYF, 290), 5, "v")
    note_block(sh, 120, 196, "วิธีประกอบ (ย่อ)", [
        "1. ตั้งซี่โครง R1-R6 บนจิ๊ก ตามระยะ X และเลื่อนหน้าตาม delta(x)",
        "2. สอดคาน B1 B2 (ล่าง) → B3 B4 (รับสายยาง) → B6 → B5 ลงร่อง",
        "   ทากาว PVA D3 + ยิงตะปูลม/สกรู 1¼\" ทุกจุดตัด",
        "3. ประกอบกล่องแขน AP1 AP2 AP3 เสียบเดือยระหว่าง R6 ↔ A1",
        "4. ตอก T-nut M8 ที่ LP แล้วกาว+สกรูทับคาน ณ ตำแหน่งขา",
        "5. ดัดไม้อัด SK1 SK2 SK3 ทาบ ยิงแม็กทุก 50 มม.",
        "6. ขึงสายยางยืด 15 เส้น ยืด 8-10% ยิงแม็ก 4 นัด/ปลาย",
        "7. วัดเช็กแนวทแยง + ระดับ + ไม่โยก ก่อนส่งบุฟองน้ำ",
    ], size=2.1, lh=3.4)
    return sh


# ---------------------------------------------------------------- SHEET 3 · parts (ribs & arm panels)
def sheet_parts_a():
    sh = Sheet(3, "แบบชิ้นส่วน CNC ① ซี่โครง / แผงแขน", "1:5 และ 1:10")
    rib = part("R2-R5")["poly"]
    v = View(sh, 34, 190, 0.2)
    view_title(sh, 20, 20, "R2-R5 · ซี่โครงมาตรฐาน (4 แผ่น)", "มาตราส่วน 1:5 · ไม้อัด 18 มม. · หน้าโซฟาอยู่ทางขวา")
    v.poly(rib, fill="#EEF5F6", stroke=INK, sw=0.4)
    v.dim((RY0, 80), (RYF, 80), 14, "h")
    v.dim((RY0, 720), (POST_T, 720), -6, "h")
    v.dim((RY0, 80), (RY0, 720), -16, "v")
    v.dim((RYF, 80), (RYF, 290), 8, "v")
    v.dim((POST_T, 290), (POST_B, 290), 4, "h", f"{POST_B - POST_T}")
    for k, off in (("B2", 5), ("B1", 5)):
        y0, y1 = BANDS[k][:2]
        v.dim((y0, 80), (y1, 80), off, "h", f"{k} {y1 - y0}")
    v.dim((RY0, 80), (BANDS["B2"][0], 80), 5, "h")
    v.dim((BANDS["B1"][1], 80), (RYF, 80), 5, "h")
    for k in ("B4", "B3"):
        y0, y1 = BANDS[k][:2]
        v.dim((y0, 290), (y1, 290), -5, "h", f"{k} {y1 - y0}")
    v.dim((DIP[0], DIP_Z), (DIP[1], DIP_Z), -16, "h", f"ร่องหลบสายยาง {DIP[1] - DIP[0]}")
    v.dim((DIP[1], DIP_Z), (DIP[1], 290), 3, "v", f"{290 - DIP_Z}")
    v.dim((HOLE[0], HOLE[1]), (HOLE[2], HOLE[1]), 4, "h")
    v.dim((HOLE[2], HOLE[1]), (HOLE[2], HOLE[3]), 3, "v")
    v.dim((RY0, 490), (BANDS["B6"][1], 490), -5, "h", f"B6 {BANDS['B6'][1] - BANDS['B6'][0]}")
    v.label(45, 711, "B5 50×18", 18, -6)
    v.label(POST_B + 8, 298, "R30", 14, 4)
    v.label(RYF - 18, 98, "R60", 10, 6)
    v.label(RY0 + 12, 92, "R40", -8, 8)
    v.label(370, 150, "ช่องลดน้ำหนัก R25", 30, 6)
    sh.add(f'<text x="22" y="234" font-size="2.15" fill="{INK}" font-family="{FONT}">ร่องคานทุกร่อง: ลึก 18 · กว้าง = กว้างคาน + 2 มม. (เผื่อมุมโค้งแปลน) · มุมในร่องทำ dog-bone Ø6</text>')
    zz = " · ".join(f"{k} Z{BANDS[k][2]}-{BANDS[k][3]}" for k in BANDS)
    sh.add(f'<text x="22" y="238" font-size="2.15" fill="{INK}" font-family="{FONT}">ระดับคาน: {zz} (B6 บากจากด้านหลัง)</text>')

    v1 = View(sh, 200, 115, 0.1)
    view_title(sh, 185, 20, "R1 · ซี่โครงปลายซ้าย (1)", "1:10 · เหมือน R2-R5 แต่พนักสูงถึง Z600 · ไม่มีร่อง B5")
    v1.poly(part("R1")["poly"], fill="#EEF5F6", stroke=INK, sw=0.4)
    v1.dim((RY0, 80), (RY0, 600), -6, "v")
    v1.dim((RY0, 80), (RYF, 80), 6, "h")
    v6 = View(sh, 300, 115, 0.1)
    view_title(sh, 290, 20, "R6 · แผงข้างใน-แขน (1)", "1:10 · ตันถึง Z480 · ร่อง AP1 AP2 AP3")
    v6.poly(part("R6")["poly"], fill="#EEF5F6", stroke=INK, sw=0.4)
    v6.dim((RY0, 80), (RY0, 720), -6, "v")
    v6.dim((490, 80), (490, 480), 16, "v")
    v6.dim((RY0, 80), (RYF, 80), 6, "h")
    v6.dim((RY0, 80), (490, 80), 12, "h")
    va = View(sh, 200, 225, 0.1)
    view_title(sh, 185, 140, "A1 · แผงข้างนอก-แขน (1)", "1:10 · ร่อง AP1 AP2 AP3 ตำแหน่งเดียวกับ R6")
    va.poly(part("A1")["poly"], fill="#EEF5F6", stroke=INK, sw=0.4)
    va.dim((RY0, 80), (490, 80), 6, "h")
    va.dim((490, 80), (490, 480), 4, "v")
    va.label(70, 430, "R150", -6, -6)
    va.label(470, 470, "R60", 6, -6)
    table(sh, 270, 150, [("ร่องใน R6 / A1", 40), ("แนว Y", 30), ("แนว Z", 30)], [
        ("AP1 เดือย ×2 (ปิด)", " / ".join(f"{a}-{b}" for a, b in AP1_TABS), "440-458"),
        ("AP2 เดือย ×2 (บาก)", " / ".join(f"{a}-{b}" for a, b in AP2_TABS), "80-98"),
        ("AP3 เดือย ×2 (ปิด)", "452-470", " / ".join(f"{a}-{b}" for a, b in AP3_TABS)),
        ("B3 / B4 ใน R6", f"{BANDS['B3'][0]}-{BANDS['B3'][1]} / {BANDS['B4'][0]}-{BANDS['B4'][1]}", "272-290"),
    ], size=1.95, rh=3.8)
    note_block(sh, 270, 180, "ข้อกำหนดตัด CNC", [
        "ไม้อัด 18 มม. เกรดโครงเฟอร์นิเจอร์ (ยาง/ป็อปลาร์ กาว WBP)",
        "ไฟล์ตัด: sofa-1600-cnc-18mm.dxf (1:1 หน่วย มม.)",
        "เลเยอร์ CUT_OUT ตัดนอก · CUT_IN ตัดใน (ตัดก่อน)",
        "DRILL เจาะรู · LABEL ไม่ต้องตัด (เขียนรหัสบนชิ้น)",
        "ดอก Ø6 · ร่องเผื่อ +1 มม./ข้าง แล้วในไฟล์",
        "ความคลาดเคลื่อน ±0.5 มม. · ขัดลบคมทุกขอบ",
        "เขียนรหัสชิ้น + ลูกศรด้านหน้า (FRONT) ทุกชิ้น",
    ], size=2.05, lh=3.4)
    return sh


# ---------------------------------------------------------------- SHEET 4 · parts (bands, plates, pill)
def sheet_parts_b():
    sh = Sheet(4, "แบบชิ้นส่วน CNC ② คาน / แผ่นแขน / แกนหมอนข้าง", "1:10 และ 1:5")
    view_title(sh, 20, 20, "คาน B1-B6 · มองจากด้านบน (โค้งตามแปลน)", "1:10 · เส้นประ = กึ่งกลางซี่โครงที่คานพาดผ่าน · ด้านล่างของภาพ = หน้าโซฟา")
    for i, k in enumerate(BANDS):
        y0, y1, z0, z1, x0, x1, name = BANDS[k]
        poly = part(k)["poly"]
        bb = poly.bounds
        col, row = i % 2, i // 2
        bx, by = 22 + col * 150, 38 + row * 23
        v = View(sh, bx - x0 * 0.1, by - bb[1] * 0.1, 0.1, flip=False)
        v.poly(poly, fill="#EEF5F6", stroke=INK, sw=0.35)
        for x in RIB_X.values():
            if x0 + 1 < x < x1 - 1 or abs(x - 9 - x0) < 2 or abs(x + 9 - x1) < 2:
                v.line([(x, y0 + delta(x) - 8), (x, y1 + delta(x) + 8)], stroke=TAUPE, sw=0.2, dash="1,0.6")
        sh.add(f'<text x="{bx}" y="{by - 2}" font-size="2.3" font-weight="600" fill="{NAVY}" font-family="{FONT}">{k} · {name}</text>')
        sh.add(f'<text x="{bx + 52}" y="{by - 2}" font-size="1.95" fill="{INK}" font-family="{FONT}">ยาว {x1 - x0:.0f} · กว้าง {y1 - y0:.0f} · ระยะโค้ง {bb[3] - bb[1] - (y1 - y0):.1f} · ระดับ Z{z0}-{z1}</text>')
    table(sh, 20, 110, [("รหัส", 14), ("ปลายซ้าย X", 22), ("ปลายขวา X", 22), ("ระยะกึ่งกลางซี่โครง วัดจากปลายซ้ายคาน (ตามแนว X)", 82)], [
        (k, f"{BANDS[k][4]:.0f}", f"{BANDS[k][5]:.0f}",
         " / ".join(f"{x - BANDS[k][4]:.0f}" for x in RIB_X.values() if x - 9 >= BANDS[k][4] - 1))
        for k in BANDS], size=1.95, rh=3.7)
    sh.add(f'<text x="20" y="139" font-size="2.0" fill="{TAUPE}" font-family="{FONT}">แนวโค้ง delta(x) = {SAG} × ((x − 700) / 700)²  · x40 = {delta(40):.1f} · x310 = {delta(310):.1f} · x700 = 0 · x1120 = {delta(1120):.1f} · x1390 = {delta(1390):.1f} มม. (ไฟล์ DXF ใช้สูตรนี้แล้ว)</text>')

    view_title(sh, 20, 150, "แผ่นกล่องแขน AP1 / AP2 / AP3", "1:5 · เดือยยื่น 18 มม. ทั้งสองข้าง")
    for i, (code, poly, ttl) in enumerate((("AP1", ap1(), "AP1 แผ่นบน"), ("AP2", ap2(), "AP2 แผ่นล่าง"), ("AP3", ap3(), "AP3 แผ่นหน้า (X-Z)"))):
        bx = 25 + i * 55
        b = poly.bounds
        v = View(sh, bx - b[0] * 0.2, 167 - b[1] * 0.2, 0.2, flip=False)
        v.poly(poly, fill="#EEF5F6", stroke=INK, sw=0.35)
        for (hx, hy, d) in part(code)["holes"]:
            v.circle(hx, hy, d / 2, sw=0.3)
        sh.add(f'<text x="{bx}" y="163" font-size="2.2" font-weight="600" fill="{NAVY}" font-family="{FONT}">{ttl}</text>')
        v.dim((b[0], b[3]), (b[2], b[3]), 5, "h")
        v.dim((b[2], b[1]), (b[2], b[3]), 4, "v")
    sh.add(f'<text x="25" y="268" font-size="2.0" fill="{INK}" font-family="{FONT}">AP2: รูขา Ø10 ที่ Y{LEG_Y[0]} / Y420 · ช่องมือไว้ขันน็อตหมอนข้าง</text>')
    sh.add(f'<text x="25" y="272" font-size="2.0" fill="{INK}" font-family="{FONT}">AP3: รูน็อต Ø9 ที่ Z200 / Z380 (วัดจากพื้น) กึ่งกลางหมอนข้าง X1500</text>')

    view_title(sh, 200, 150, "แกนหมอนข้าง PL1-PL3 + แผ่นรอง", "1:5")
    d = pl_disc()
    b = d.bounds
    v = View(sh, 205 - b[0] * 0.2, 170 - b[1] * 0.2, 0.2, flip=False)
    v.poly(d, fill="#EEF5F6", stroke=INK, sw=0.35)
    v.dim((b[0], b[3]), (b[2], b[3]), 4, "h")
    v.dim((b[2], b[1]), (b[2], b[3]), 4, "v")
    sh.add(f'<text x="205" y="166" font-size="2.1" font-weight="600" fill="{NAVY}" font-family="{FONT}">PL1-2 วงรี ×2</text>')
    s = pl_spine()
    b = s.bounds
    v = View(sh, 262 - b[0] * 0.2, 170 - b[1] * 0.2, 0.2, flip=False)
    v.poly(s, fill="#EEF5F6", stroke=INK, sw=0.35)
    for (hx, hy, dd) in part("PL3")["holes"]:
        v.circle(hx, hy, dd / 2, sw=0.3)
    v.dim((b[0], b[3]), (b[2], b[3]), 4, "h")
    v.dim((b[2], b[1]), (b[2], b[3]), 4, "v")
    sh.add(f'<text x="262" y="166" font-size="2.1" font-weight="600" fill="{NAVY}" font-family="{FONT}">PL3 แกนตั้ง</text>')
    v = View(sh, 300, 175, 0.2, flip=False)
    v.poly(leg_pad(), fill="#EEF5F6", stroke=INK, sw=0.35)
    v.circle(45, 45, 5, sw=0.3)
    sh.add(f'<text x="300" y="172" font-size="2.1" font-weight="600" fill="{NAVY}" font-family="{FONT}">LP 90×90 ×6</text>')
    v = View(sh, 345, 182, 0.2, flip=False)
    v.poly(spacer_disc(), fill="#EEF5F6", stroke=INK, sw=0.35)
    v.circle(0, 0, 4.5, sw=0.3)
    sh.add(f'<text x="334" y="172" font-size="2.1" font-weight="600" fill="{NAVY}" font-family="{FONT}">SP Ø70 ×4</text>')
    note_block(sh, 300, 205, "การยึดหมอนข้าง", [
        "น็อต M8×100 หัวจม 2 ตัว + แหวน",
        "ขันจากในกล่องแขน (ผ่านช่องมือ AP2)",
        "→ AP3 → ผ้าแขน → ผ้าหมอน → SP×2 → PL3",
        "T-nut M8 ตอกหน้า PL3 · เจาะผ้า ใส่ตาไก่",
    ], size=2.05, lh=3.4)
    return sh


# ---------------------------------------------------------------- SHEET 5 · cut list / foam / hardware
def area_m2(poly):
    return poly.area / 1e6


def sheet_bom(nest_info):
    sh = Sheet(5, "รายการชิ้นส่วน · ฟองน้ำ · อุปกรณ์ (BOM)", "—")
    view_title(sh, 20, 20, "1. รายการตัดไม้อัด 18 มม. (CNC)")
    rows = []
    tot = 0
    for p in PARTS:
        b = p["poly"].bounds
        a = area_m2(p["poly"]) * p["qty"]
        tot += a
        rows.append((p["code"], p["name"], p["qty"], f"{b[2] - b[0]:.0f} × {b[3] - b[1]:.0f}", f"{a:.3f}", p["note"]))
    y = table(sh, 20, 26, [("รหัส", 14), ("ชื่อชิ้น", 52), ("จำนวน", 12), ("ขนาดกรอบ (มม.)", 26), ("ตร.ม.", 14), ("หมายเหตุ", 62)], rows, size=1.95, rh=3.65)
    kg = tot * 0.018 * 560
    sh.add(f'<text x="20" y="{y + 4}" font-size="2.1" fill="{INK}" font-family="{FONT}">พื้นที่ไม้รวม {tot:.2f} ตร.ม. · ใช้ไม้อัด 18 มม. 1220×2440 จำนวน {nest_info["sheets"]} แผ่น (ดูแผ่นที่ 6) · น้ำหนักโครงประมาณ {kg:.0f} กก.</text>')

    view_title(sh, 20, y + 12, "2. ไม้อัดดัด / ไม้จริง (ตัดเลื่อย ไม่ใช้ CNC)")
    arc = sum(math.hypot(1, 2 * SAG * (x - 700) / 700 ** 2) for x in range(31, 1399)) + 60
    y2 = table(sh, 20, y + 18, [("รหัส", 14), ("รายการ", 70), ("จำนวน", 12), ("ขนาดตัด (มม.)", 34), ("หมายเหตุ", 50)], [
        ("SK1", "ไม้อัดดัด 4 มม. หุ้มหน้าฐาน", 1, f"{arc:.0f} × 200", "ลายเสี้ยนขวางแนวโค้ง"),
        ("SK2", "ไม้อัดดัด 4 มม. หุ้มหลัง (ฐาน+พนัก)", 2, f"{arc:.0f} × 640", "2 ชั้น สลับรอยต่อ · ตัดแต่งตาม R1"),
        ("SK3", "ไม้อัดดัด 4 มม. หน้าพนักพิง", 1, f"{arc - 270:.0f} × 440", "R2→R6 · เจาะรูระบายอากาศ Ø30 @150"),
        ("LEG", "ขาไม้ยาง/บีชกลึง Ø50 × 80 + สกรูสองหัว M8", 6, "Ø50 × 80", "สีเนเชอรัล ด้าน · ปุ่มสักหลาดรองใต้ขา"),
    ], size=1.95, rh=3.65)

    view_title(sh, 215, 20, "3. ฟองน้ำ (รหัสตามตารางฟองน้ำ ใน docs/modules/foam)")
    y3 = table(sh, 215, 26, [("ส่วน", 26), ("ชั้น / ฟองน้ำ", 70), ("หนา", 14), ("หมายเหตุ", 65)], [
        ("ที่นั่ง", "ผ้าใบกระสอบ (hessian) ทับสายยาง", "—", "ยิงแม็กรอบ"),
        ("", "FFC อีสเทอร์นโฟม D26 H15", "100", "ชั้นหลัก ตัดตามแปลนโค้ง"),
        ("", "SQ กรุงเทพโฟม D20 H6", "25", "ชั้นนุ่มบน"),
        ("", "ใยโพลีเอสเตอร์ 1 ออนซ์ หุ้มรอบ", "~5", "ได้ที่นั่งสำเร็จ 420"),
        ("พนักพิง", "SQ D20 H6 แกะทรงมน", "80-120", "ด้านหน้า+บน · หัวมน R60-70"),
        ("", "SQ D20 H6 หลัง", "30", "ทับ SK2"),
        ("ข้าง/หน้าฐาน", "HR3 D26 H16", "30-60", "หน้าฐานมน R110 ล่าง"),
        ("แขน", "HR3 D26 H16 แกะม้วน", "30-160", "ปั้นทรงม้วนรอบกล่องแขน"),
        ("หมอนข้าง", "HR3 D26 H16 หุ้มแกน", "40", "ทรงแคปซูล 200×250×460"),
        ("", "SQ D20 H6 + ใย", "20", "ผิวนอก"),
        ("ปลายซ้าย", "HR3 + SQ แกะมน", "—", "พนักลาดลงจาก 800 → 600"),
    ], size=1.95, rh=3.65)

    view_title(sh, 215, y3 + 8, "4. อุปกรณ์ / ฮาร์ดแวร์")
    y4 = table(sh, 215, y3 + 14, [("รายการ", 90), ("จำนวน", 20), ("ใช้ที่", 65)], [
        ("สายยางยืด 50 มม. (Pirelli)", "~8 ม.", "15 เส้น × ตัด 480 (ยืด 8-10%)"),
        ("T-nut M8", 8, "LP ×6 · PL3 ×2"),
        ("สกรูสองหัว M8 (hanger bolt)", 6, "ขา"),
        ("น็อตหัวจม M8×100 + แหวน", 2, "หมอนข้าง → AP3"),
        ("ตาไก่ทองเหลือง Ø10", 4, "ผ้าแขน + ผ้าหมอนข้าง"),
        ("กาว PVA D3 / กาวยางพ่นฟองน้ำ", "—", "โครง / ฟองน้ำ"),
        ("สกรูไม้ 1¼\" + ลวดแม็ก", "—", "ทุกจุดต่อ / ไม้อัดดัด"),
    ], size=1.95, rh=3.65)
    note_block(sh, 215, y4 + 8, "5. ต้องยืนยันก่อนผลิต", [
        f"!• B / C / D (ค่าเสนอ B={SECTION_D + delta(0):.0f} C={SECTION_D} D={750 - DA - SECTION_D:.0f}) — Bay ยืนยัน",
        "!• ผ้า รุ่น/สี · สีขา · ฝั่งแขน (แบบนี้ = แขนขวา เมื่อนั่งหันหน้าออก)",
        "• ต้องการสลับแขนซ้าย: กลับด้านไฟล์ DXF ทั้งชุด (mirror X) ได้เลย",
        "• ตัวอย่างแรก: ประกอบโครง → ถ่ายรูป/วัด → ค่อยบุ",
    ], size=2.05, lh=3.5)
    return sh


# ---------------------------------------------------------------- nesting
SHEET_W, SHEET_H, MARGIN, GAP = 2440, 1220, 15, 14


def nest():
    """MaxRects (best-short-side-fit) on bounding boxes, rotation 0/90."""
    items = []
    for p in PARTS:
        for i in range(p["qty"]):
            items.append(dict(code=p["code"] + (f"-{i + 1}" if p["qty"] > 1 else ""), base=p["code"],
                              poly=p["poly"], holes=p["holes"]))
    for it in items:
        b = it["poly"].bounds
        it["w0"], it["h0"] = b[2] - b[0] + GAP, b[3] - b[1] + GAP
    items.sort(key=lambda t: -max(t["w0"], t["h0"]) * min(t["w0"], t["h0"]))
    W0, H0 = SHEET_W - 2 * MARGIN + GAP, SHEET_H - 2 * MARGIN + GAP
    sheets = []

    def place(free, w, h):
        best = None
        for fr in free:
            for rot, (ww, hh) in ((False, (w, h)), (True, (h, w))):
                if ww <= fr[2] and hh <= fr[3]:
                    sc = (min(fr[2] - ww, fr[3] - hh), max(fr[2] - ww, fr[3] - hh))
                    if best is None or sc < best[0]:
                        best = (sc, fr[0], fr[1], ww, hh, rot)
        return best

    def split(free, x, y, w, h):
        out = []
        for fx, fy, fw, fh in free:
            if x >= fx + fw or x + w <= fx or y >= fy + fh or y + h <= fy:
                out.append((fx, fy, fw, fh))
                continue
            if x > fx:
                out.append((fx, fy, x - fx, fh))
            if x + w < fx + fw:
                out.append((x + w, fy, fx + fw - x - w, fh))
            if y > fy:
                out.append((fx, fy, fw, y - fy))
            if y + h < fy + fh:
                out.append((fx, y + h, fw, fy + fh - y - h))
        out = [f for f in out if f[2] > 1 and f[3] > 1]
        return [f for f in out if not any(g is not f and g[0] <= f[0] and g[1] <= f[1] and
                                           g[0] + g[2] >= f[0] + f[2] and g[1] + g[3] >= f[1] + f[3] and g != f for g in out)]

    for it in items:
        for si, free in enumerate(sheets):
            r = place(free, it["w0"], it["h0"])
            if r:
                break
        else:
            sheets.append([(0, 0, W0, H0)])
            si, free = len(sheets) - 1, sheets[-1]
            r = place(free, it["w0"], it["h0"])
        _, x, y, ww, hh, rot = r
        sheets[si] = split(free, x, y, ww, hh)
        poly = affinity.rotate(it["poly"], 90, origin=(0, 0)) if rot else it["poly"]
        b = poly.bounds
        it["rot"], it["off"] = rot, (-b[0], -b[1])
        it["pos"] = (si, x + MARGIN, y + MARGIN)
        it["final"] = affinity.translate(poly, x + MARGIN - b[0], y + MARGIN - b[1])

        def tf(px, py, it=it, x=x + MARGIN, y=y + MARGIN):
            if it["rot"]:
                px, py = -py, px
            return px + it["off"][0] + x, py + it["off"][1] + y
        it["tf"] = tf
    return items, len(sheets)


def holes_of(it):
    out = []
    for (hx, hy, d) in it["holes"]:
        out.append((*it["tf"](hx, hy), d))
    return out


def write_dxf(placed, nsheets):
    doc = ezdxf.new("R2010", setup=True)
    doc.units = ezdxf.units.MM
    msp = doc.modelspace()
    for name, col in (("SHEET", 8), ("CUT_OUT", 1), ("CUT_IN", 5), ("DRILL", 3), ("LABEL", 7)):
        doc.layers.add(name, color=col)
    for s in range(nsheets):
        ox = s * (SHEET_W + 300)
        msp.add_lwpolyline([(ox, 0), (ox + SHEET_W, 0), (ox + SHEET_W, SHEET_H), (ox, SHEET_H)], close=True, dxfattribs={"layer": "SHEET"})
        msp.add_text(f"SHEET {s + 1}/{nsheets}  PLY 18mm 1220x2440  SOFA-1600", height=30,
                     dxfattribs={"layer": "LABEL"}).set_placement((ox, SHEET_H + 40))
    for it in placed:
        si = it["pos"][0]
        ox = si * (SHEET_W + 300)
        poly = affinity.translate(it["final"], ox, 0)
        msp.add_lwpolyline(list(poly.exterior.coords), close=True, dxfattribs={"layer": "CUT_OUT"})
        for r in poly.interiors:
            msp.add_lwpolyline(list(r.coords), close=True, dxfattribs={"layer": "CUT_IN"})
        for hx, hy, d in holes_of(it):
            msp.add_circle((hx + ox, hy), d / 2, dxfattribs={"layer": "DRILL"})
        c = poly.representative_point()
        msp.add_text(it["code"], height=22, dxfattribs={"layer": "LABEL"}).set_placement((c.x, c.y))
    doc.saveas(os.path.join(OUT, "sofa-1600-cnc-18mm.dxf"))

    # unnested 1:1 parts
    doc2 = ezdxf.new("R2010", setup=True)
    doc2.units = ezdxf.units.MM
    m2 = doc2.modelspace()
    for name, col in (("CUT_OUT", 1), ("CUT_IN", 5), ("DRILL", 3), ("LABEL", 7)):
        doc2.layers.add(name, color=col)
    x = 0
    for p in PARTS:
        b = p["poly"].bounds
        q = affinity.translate(p["poly"], x - b[0], -b[1])
        m2.add_lwpolyline(list(q.exterior.coords), close=True, dxfattribs={"layer": "CUT_OUT"})
        for r in q.interiors:
            m2.add_lwpolyline(list(r.coords), close=True, dxfattribs={"layer": "CUT_IN"})
        for hx, hy, d in p["holes"]:
            m2.add_circle((hx - b[0] + x, hy - b[1]), d / 2, dxfattribs={"layer": "DRILL"})
        m2.add_text(f'{p["code"]}  x{p["qty"]}', height=25, dxfattribs={"layer": "LABEL"}).set_placement((x, -60))
        x += (b[2] - b[0]) + 120
    doc2.saveas(os.path.join(OUT, "sofa-1600-parts-1to1.dxf"))


def sheet_nest(placed, nsheets):
    sh = Sheet(6, "ผังวางชิ้นบนแผ่นไม้อัด (NESTING)", "1:12.5")
    view_title(sh, 20, 20, f"ไม้อัด 18 มม. 1220 × 2440 · {nsheets} แผ่น", "ตรงกับไฟล์ sofa-1600-cnc-18mm.dxf · ระยะห่างชิ้น 14 มม. · ขอบ 15 มม.")
    s = 0.08
    for si in range(nsheets):
        ox, oy = 22, 40 + si * 108
        sh.add(f'<text x="{ox}" y="{oy - 2}" font-size="2.4" font-weight="600" fill="{NAVY}" font-family="{FONT}">แผ่นที่ {si + 1}</text>')
        v = View(sh, ox, oy, s, flip=False)
        v.poly(box(0, 0, SHEET_W, SHEET_H), fill=OFF, stroke=INK, sw=0.3)
        for it in placed:
            if it["pos"][0] != si:
                continue
            v.poly(it["final"], fill="#EEF5F6", stroke=NAVY, sw=0.2)
            c = it["final"].representative_point()
            v.text(c.x, c.y, it["code"], 2.0, NAVY, weight=600, dy=0.7)
    note_block(sh, 235, 44, "หมายเหตุ", [
        "ผังนี้วางตามกรอบสี่เหลี่ยมของชิ้น (เผื่อเหลือ)",
        "โรงงานจัดผังใหม่ในโปรแกรม CAM ได้ ใช้ไฟล์ sofa-1600-parts-1to1.dxf",
        "ชิ้นเล็ก (LP SP PL) วางในช่องว่างของซี่โครงได้ เพื่อลดเศษ",
        "ลายเสี้ยนไม้: ไม่บังคับ ยกเว้นคาน B ให้เสี้ยนตามความยาว",
    ], size=2.1, lh=3.5)
    return sh


# ---------------------------------------------------------------- main
def main():
    css_path = sys.argv[1] if len(sys.argv) > 1 else None
    if css_path and os.path.exists(css_path):
        fontcss = open(css_path).read()
        fontlink = ""
    else:
        fontcss = ""
        fontlink = ('<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;700'
                    '&family=Montserrat:wght@400;500;600&display=swap" rel="stylesheet">')
    placed, nsheets = nest()
    write_dxf(placed, nsheets)
    sheets = [sheet_ga(), sheet_frame(), sheet_parts_a(), sheet_parts_b(), sheet_bom({"sheets": nsheets}), sheet_nest(placed, nsheets)]
    doc = f"""<!doctype html><html lang="th"><head><meta charset="utf-8">
<title>SOFA 1600 Technical Drawing</title>{fontlink}
<style>{fontcss}
@page {{ size: 420mm 297mm; margin: 0 }}
html,body {{ margin:0; padding:0; background:#fff }}
.sheet {{ width:420mm; height:297mm; page-break-after: always; overflow:hidden }}
.sheet:last-child {{ page-break-after: auto }}
svg {{ display:block }}
</style></head><body>{"".join(render_sheet(s) for s in sheets)}</body></html>"""
    path = os.path.join(OUT, "sofa-1600-drawing.html")
    open(path, "w").write(doc)
    print("sheets of ply:", nsheets)
    for p in PARTS:
        b = p["poly"].bounds
        print(f'{p["code"]:6} x{p["qty"]}  {b[2] - b[0]:.0f} x {b[3] - b[1]:.0f}')
    print(path)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Curved-plan sofa frame generator (FI-01 L1600, FI-02 L1900) — CNC plywood.

Plan outlines come from the customer drawing (docs/source/customer/fi-01-fi-02-plan-2026-11-12.jpg),
traced to millimetres in docs/source/customer/fi-plan-outlines-mm.json (y grows toward the front).

Frame concept (works for any plan shape, including curled ends):
  * ribs are parallel to Y (front-back), every <= 270 mm along X; each rib is the true section
    of the sofa at that X: base slab + back post where the plane cuts the back, solid panel in the arm
  * rails follow the plan curves and are cut in segments of two bays:
        BR  bottom ring   z 80-98     (90-190 mm in from the finished outline, all round)
        SB  seat back rail z 272-290  (140-220 mm in front of the rear face, under the back)
        SF  seat front rail z 272-290 (50-130 mm behind the seat front)
        BT  back top rail  z 702-720  (15-65 mm in from the rear face)
        AT  arm top plate  z 440-458  (arm zone)
  * same detailing as SOFA 1600 REV B (passed 34/34 structural checks): ribs 18 mm + a doubler
    layer up to Z450, closed slots for SB/SF, R6 inside corners, 30 mm webbing dip, bending-ply
    skins wrapped under the bottom ring, legs on full-bay doublers, bolster bolted to a mount plate.

Use as a module (MODEL env var) — build-sofa-curved.py makes the drawings / DXF / reports.
"""
import json, math, os
import numpy as np
import shapely
from shapely.geometry import Polygon, LineString, Point, MultiPolygon, box
from shapely.ops import unary_union, linemerge
from shapely import affinity

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODEL = os.environ.get("MODEL", "FI-01")
SRC = json.load(open(os.path.join(ROOT, "docs/source/customer/fi-plan-outlines-mm.json")))[MODEL]
INFO = {"FI-01": dict(name="FI-01 Sofa L1600", L=1600, slug="fi-01-sofa-1600"),
        "FI-02": dict(name="FI-02 Sofa L1900", L=1890, slug="fi-02-sofa-1900")}[MODEL]

T = 18.0
SEAT_H, ARM_H, H, LEG_H = 420, 520, 800, 80
RIB_STEP = 270
FOAM_SIDE = 50
NOTCH_R = 6
BRIDGE = 12
RIB_DBL_Z = 450
STRIPS = 4                                   # webbing strips per bay

_body = Polygon(SRC["body"]).buffer(0)
ROLLS = [Polygon(r).buffer(0) for r in SRC["rolls"]]
ROLLU = unary_union(ROLLS)
BOLSTER = Polygon(SRC["bolster"]).buffer(0)
# the bolster hides part of the body outline in the drawing: fill the body behind it (inside the body's hull)
BODY_FULL = unary_union([_body, ROLLU, BOLSTER.intersection(_body.convex_hull)]).buffer(2).buffer(-2)
if isinstance(BODY_FULL, MultiPolygon):
    BODY_FULL = max(BODY_FULL.geoms, key=lambda g: g.area)
# the bolster is a standing column at the front-right corner: the body (frame + foam) stops 10 mm short of it
BODY = BODY_FULL.difference(BOLSTER.buffer(10)).buffer(-25, join_style=1).buffer(25, join_style=1)
if isinstance(BODY, MultiPolygon):
    BODY = max(BODY.geoms, key=lambda g: g.area)
FRAME = BODY.buffer(-FOAM_SIDE)
XMIN, YMIN, XMAX, YMAX = BODY.bounds


def _chains(poly):
    """Split the exterior at the leftmost / rightmost points -> (rear chain, front chain)."""
    c = list(poly.exterior.coords)[:-1]
    i0 = min(range(len(c)), key=lambda i: (c[i][0], c[i][1]))
    i1 = max(range(len(c)), key=lambda i: (c[i][0], -c[i][1]))
    a = c[i0:i1 + 1] if i0 < i1 else c[i0:] + c[:i1 + 1]
    b = c[i1:i0 + 1] if i1 < i0 else c[i1:] + c[:i0 + 1]
    la, lb = LineString(a), LineString(b)
    return (la, lb) if np.mean([p[1] for p in a]) < np.mean([p[1] for p in b]) else (lb, la)


REAR, FRONT = _chains(BODY)
X_ARM = ROLLU.bounds[2] - 20                 # back roll ends here; arm box from here to the right end


def band_from(chain, d0, d1, clip=None):
    g = BODY.intersection(chain.buffer(d1, quad_segs=16)).difference(chain.buffer(d0, quad_segs=16))
    if clip is not None:
        g = g.intersection(clip)
    return g.buffer(0)


BACKZONE = ROLLU.buffer(90).intersection(box(XMIN - 10, YMIN - 10, X_ARM + 5, YMAX + 10))
SEATEND = X_ARM + 45                         # seat rails run into the first arm panel (X_ARM + 25)
POST = band_from(REAR, 15, 105, BACKZONE)                          # back-post footprint (frame)
SB = band_from(REAR, 140, 240, ROLLU.buffer(90).intersection(box(XMIN - 10, YMIN - 10, SEATEND, YMAX + 10)))                           # seat back rail
SEATZONE = box(XMIN - 10, YMIN - 10, SEATEND, YMAX + 10)
SF = band_from(FRONT, 50, 150, SEATZONE).difference(BACKZONE.buffer(-60))   # seat front rail
BT = band_from(REAR, 15, 65, BACKZONE)                             # back top rail
ARMZONE = FRAME.intersection(box(X_ARM, YMIN - 10, XMAX + 10, YMAX + 10))
if isinstance(ARMZONE, MultiPolygon):
    ARMZONE = max(ARMZONE.geoms, key=lambda g: g.area)
BR = unary_union([BODY.buffer(-90).difference(BODY.buffer(-190)),      # bottom ring (all round)
                  ARMZONE.buffer(-40, join_style=1)]).buffer(0)         # + solid bottom plate of the arm box (legs)
if isinstance(BR, MultiPolygon):
    BR = max(BR.geoms, key=lambda g: g.area)
AT = ARMZONE.buffer(-40).difference(ARMZONE.buffer(-160))          # arm top ring
RAILS = {  # code: (plan polygon, z0, z1, closed-slot?)
    "BR": (BR, 80, 98, False), "SB": (SB, 272, 290, True), "SF": (SF, 272, 290, True),
    "BT": (BT, 702, 720, False), "AT": (AT, 440, 458, False)}

# ---------------------------------------------------------------- stations
_x0, _x1 = FRAME.bounds[0] + 30, X_ARM + 25
n_bays = math.ceil((_x1 - _x0) / RIB_STEP)
STATIONS = list(np.linspace(_x0, _x1, n_bays + 1)) + [FRAME.bounds[2] - 35]   # seat ribs ... arm inner panel, arm outer panel
RIB_THK = {}                                  # station index -> thickness (36 = with doubler, 18 single)


def _intervals(geom, x, half=0.0):
    """y-intervals of geom crossed by the slab x-half .. x+half (projected)."""
    if half > 0:
        g = geom.intersection(box(x - half, YMIN - 50, x + half, YMAX + 50))
    else:
        g = geom.intersection(LineString([(x, YMIN - 50), (x, YMAX + 50)]))
    if g.is_empty:
        return []
    parts = getattr(g, "geoms", [g])
    out = []
    for p in parts:
        b = p.bounds
        out.append((b[1], b[3]))
    out.sort()
    merged = []
    for a, b in out:
        if merged and a <= merged[-1][1] + 1:
            merged[-1] = (merged[-1][0], max(merged[-1][1], b))
        else:
            merged.append((a, b))
    return merged


def rrect(y0, z0, y1, z1, r):
    return box(y0, z0, y1, z1).buffer(-r, join_style=1).buffer(r, join_style=1)


def rib_section(i):
    """Rib i profile in (y, z): y = plan y (front positive), z = height."""
    x = STATIONS[i]
    base_iv = _intervals(FRAME, x)
    if not base_iv:
        return None, {}
    ya, yb = min(a for a, _ in base_iv), max(b for _, b in base_iv)    # full span: base always under the post
    arm = x >= X_ARM
    p = box(ya, 80, yb, 290)
    info = dict(x=x, ya=ya, yb=yb, arm=arm, post=[])
    if arm:
        p = p.union(box(ya, 80, yb, 480))
        p = p.buffer(-60, join_style=1).buffer(60, join_style=1).union(box(ya + 60, 80, yb - 60, 140))
    else:
        for p0, p1 in _intervals(POST, x):
            if p1 - p0 < 30:
                continue
            # rear side = the end nearer the rear chain
            rear_first = REAR.distance(Point(x, p0)) < REAR.distance(Point(x, p1))
            top = 720 if (p1 - p0) < 400 else 720
            lean = 30
            if rear_first:
                post = Polygon([(p0, 280), (p1, 280), (p1 - lean, top), (p0, top)])
            else:
                post = Polygon([(p0, 280), (p1, 280), (p1, top), (p0 + lean, top)])
            p = p.union(post)
            info["post"].append((p0, p1, rear_first))
        for k in ("SB", "SF"):
            for a, b in _intervals(RAILS[k][0], x, 18):
                p = p.union(box(a - 20, 280, b + 20, 290 + BRIDGE))
        p = p.buffer(30, join_style=1, quad_segs=32).buffer(-30, join_style=1, quad_segs=32)
    # front / rear bottom corners
    p = p.difference(box(ya - 1, 79, ya + 40, 120).difference(Point(ya + 40, 120).buffer(40, 64)))
    p = p.difference(box(yb - 60, 79, yb + 1, 140).difference(Point(yb - 60, 140).buffer(60, 64)))
    # webbing dip + lightening hole between seat rails
    if not arm:
        sb = _intervals(SB, x, 18)
        sf = _intervals(SF, x, 18)
        if sb and sf:
            d0, d1 = sb[-1][1] + 110, sf[0][0] - 110
            if d1 - d0 > 60:
                p = p.difference(box(d0, 260, d1, 310))
            h0, h1 = sb[-1][1] + 90, sf[0][0] - 90
            if h1 - h0 > 120:
                p = p.difference(rrect(h0, 110, h1, 190, 25))
            info["seat"] = (sb[-1][1], sf[0][0])
    else:
        L = yb - ya
        if L > 300:
            p = p.difference(rrect(ya + 120, 130, yb - 120, 230, 30))
            p = p.difference(rrect(ya + 120, 300, yb - 140, 410, 30))
    # rail notches / slots (slab of the rib thickness so angled rails fit)
    for k, (g, z0, z1, closed) in RAILS.items():
        for a, b in _intervals(g, x, 18):
            p = p.difference(box(a - 2, z0, b + 2, z1))
    p = p.buffer(NOTCH_R, join_style=1, quad_segs=32).buffer(-NOTCH_R, join_style=1, quad_segs=32)
    p = p.buffer(0)
    if isinstance(p, MultiPolygon):
        p = max(p.geoms, key=lambda g: g.area)
    p = Polygon([(round(a, 2), round(b, 2)) for a, b in p.exterior.coords],
                [[(round(a, 2), round(b, 2)) for a, b in r.coords] for r in p.interiors]).simplify(0.01)
    return p, info


RIBS = []
for i in range(len(STATIONS)):
    prof, info = rib_section(i)
    if prof is None:
        continue
    info["i"] = i
    info["code"] = f"R{len(RIBS) + 1:02d}"
    info["poly"] = prof
    dbl = (not info["arm"]) and len(info["post"]) > 0
    info["dbl"] = dbl
    if dbl:
        d = prof.intersection(box(-1e4, 0, 1e4, RIB_DBL_Z)).buffer(0)
        if isinstance(d, MultiPolygon):
            d = max(d.geoms, key=lambda g: g.area)
        info["dpoly"] = d
    RIBS.append(info)
HALF = {r["code"]: (18 if r["dbl"] else 9) for r in RIBS}


# ---------------------------------------------------------------- rail segments (two bays each)
def rail_segments(code):
    g, z0, z1, closed = RAILS[code]
    xs = [r["x"] for r in RIBS]
    cuts = xs[::2]
    if cuts[0] > g.bounds[0]:
        cuts = [g.bounds[0] - 1] + cuts
    if cuts[-1] < g.bounds[2]:
        cuts = cuts + [g.bounds[2] + 1]
    segs = []
    for a, b in zip(cuts[:-1], cuts[1:]):
        piece = g.intersection(box(a, YMIN - 50, b, YMAX + 50))
        for pp in getattr(piece, "geoms", [piece]):
            if pp.area > 6000:
                segs.append(pp.buffer(0))
    return segs


def _clean(p):
    p = p.buffer(0)
    if isinstance(p, MultiPolygon):
        p = max(p.geoms, key=lambda g: g.area)
    return Polygon([(round(a, 2), round(b, 2)) for a, b in p.exterior.coords],
                   [[(round(a, 2), round(b, 2)) for a, b in r.coords] for r in p.interiors]).simplify(0.05)


# ---------------------------------------------------------------- legs
# ---------------------------------------------------------------- posts under long seat-rail spans
RAIL_CHAIN = {"SB": REAR, "SF": FRONT}
RAIL_INSET = {"SB": 190, "SF": 100}
POST_SPAN = 330                                # rail span (along the curve) above which a post is added


def _rail_line(code):
    """smooth centre line of a seat rail: chain samples pulled onto the inset ring, in chain order"""
    inner = BODY.buffer(-RAIL_INSET[code], join_style=1)
    inner = max(getattr(inner, "geoms", [inner]), key=lambda g: g.area).exterior
    ch = RAIL_CHAIN[code]
    pts = []
    for d in np.arange(0, ch.length, 5):
        q = inner.interpolate(inner.project(ch.interpolate(d)))
        if not pts or math.hypot(q.x - pts[-1][0], q.y - pts[-1][1]) > 2:
            pts.append((q.x, q.y))
    return LineString(pts)


RAIL_LINE = {k: _rail_line(k) for k in ("SB", "SF")}


def rail_arc_supports(code):
    out = []
    for r in RIBS:
        iv = _intervals(RAILS[code][0], r["x"], 18)
        if iv:
            a, b = iv[-1] if code == "SB" else iv[0]
            out.append(RAIL_LINE[code].project(Point(r["x"], (a + b) / 2)))
    return sorted(out)


def rail_extent(code):
    g = RAILS[code][0]
    g = max(getattr(g, "geoms", [g]), key=lambda q: q.area)
    s = [RAIL_LINE[code].project(Point(c)) for c in g.exterior.coords]
    return min(s), max(s)


def _rail_posts():
    posts = []
    for code in ("SB", "SF"):
        sup = rail_arc_supports(code)
        line = RAIL_LINE[code]
        e0, e1 = rail_extent(code)
        at = []
        for s0, s1 in zip(sup[:-1], sup[1:]):
            if s1 - s0 > POST_SPAN:
                n = math.ceil((s1 - s0) / POST_SPAN) - 1
                at += [s0 + (s1 - s0) * k / (n + 1) for k in range(1, n + 1)]
        if sup[0] - e0 > 120:                      # free end of the rail beyond the first / last rib
            at.append(e0 + 50)
        if e1 - sup[-1] > 120:
            at.append(e1 - 50)
        for sp in sorted(at):
            q = line.interpolate(sp)
            posts.append(dict(code=code, s=sp, x=q.x, y=q.y))
    return posts


RAIL_POSTS = _rail_posts()
BOLSTER_FOOT = (BOLSTER.centroid.x, BOLSTER.centroid.y)     # hidden leg under the bolster core


# ---------------------------------------------------------------- legs
LEGS_N = {"FI-01": 6, "FI-02": 6}


def _leg_targets():
    """points that people load near the edge: seat front / ends / arm (60 mm in) + bolster"""
    inner = BODY.buffer(-60, join_style=1)
    inner = max(getattr(inner, "geoms", [inner]), key=lambda g: g.area).exterior
    pts = [inner.interpolate(d) for d in np.arange(0, inner.length, 15)]
    pts += [BOLSTER.buffer(-60).exterior.interpolate(d) for d in np.arange(0, BOLSTER.length, 30)]
    return shapely.points([(p.x, p.y) for p in pts])


def _legs(n=None):
    """Legs under the bottom ring / arm plate (mid-bay, clear of ribs and rail posts), chosen greedily so that the
    support polygon leaves the smallest overhang at the loaded edge points (stability)."""
    n = n or LEGS_N.get(MODEL, 6)
    xs = [r["x"] for r in RIBS]
    zone = BR.buffer(-35, join_style=1)
    cand = [(x, y) for x in np.arange(XMIN, XMAX, 10) for y in np.arange(YMIN, YMAX, 10)
            if min(abs(x - r) for r in xs) > 45 and zone.contains(Point(x, y))
            and all(math.hypot(x - p["x"], y - p["y"]) > 60 for p in RAIL_POSTS)]
    tg = _leg_targets()

    def over(sel):
        h = shapely.convex_hull(shapely.multipoints(sel))
        d = shapely.distance(h, tg)
        return float(d.max()), float(d.sum())
    foot = [BOLSTER_FOOT]                          # the bolster stands on its own foot (fixed)
    a = max(cand, key=lambda q: q[0] - q[1] * 0.2)
    b = max(cand, key=lambda q: math.hypot(q[0] - a[0], q[1] - a[1]))
    sel = [a, b]
    while len(sel) < n:
        sel.append(min(cand, key=lambda q: over(foot + sel + [q])))
    for _ in range(3):                             # local improvement: move each leg to its best candidate
        for i in range(n):
            rest = sel[:i] + sel[i + 1:]
            sel[i] = min(cand, key=lambda q: over(foot + rest + [q]))
    return sorted(sel)


LEGS = _legs()


# ---------------------------------------------------------------- bolster
def _ellipse_fit(poly):
    pts = np.array(poly.exterior.coords)
    c = pts.mean(axis=0)
    cov = np.cov((pts - c).T)
    w, v = np.linalg.eigh(cov)
    ang = math.degrees(math.atan2(v[1, 1], v[0, 1]))
    rot = affinity.rotate(poly, -ang, origin=tuple(c))
    b = rot.bounds
    return tuple(c), (b[2] - b[0]) / 2, (b[3] - b[1]) / 2, ang


BOL_C, BOL_A, BOL_B, BOL_ANG = _ellipse_fit(BOLSTER)          # a along long axis
mount_x = min([r["x"] for r in RIBS], key=lambda x: abs(x - BOL_C[0]))


def bolster_parts():
    """Core: two discs (ellipse, 40 mm inside the bolster) + two spines; mount plate on the frame front."""
    a, b = BOL_A - 40, BOL_B - 40
    disc = affinity.scale(Point(0, 0).buffer(1, 64), b, a)            # local: x = short axis, y = long axis
    for sy in (-a * 0.55, a * 0.55):
        disc = disc.difference(box(-21, sy - 10, 21, sy + 10))
    spine = box(-b * 0.75, 0, b * 0.75, 480 - 100 - 36).union(box(-20, -18, 20, 480 - 100 - 18))
    return _clean(disc), _clean(spine)


# ---------------------------------------------------------------- parts list (same structure as build-sofa-1600-drawing.PARTS)
PARTS = []


def add(code, name, qty, poly, holes=(), note=""):
    PARTS.append(dict(code=code, name=name, qty=qty, poly=_clean(poly) if not isinstance(poly, Polygon) or True else poly,
                      holes=list(holes), note=note))


for r in RIBS:
    kind = "แผงกล่องแขน (ตัน)" if r["arm"] else "ซี่โครง"
    add(r["code"], f"{kind} X{r['x']:.0f}", 1, r["poly"], note=f"ตั้งที่ X{r['x']:.0f} · ด้าน y จริง {r['ya']:.0f}-{r['yb']:.0f}")
    if r["dbl"]:
        add(r["code"] + "-D", f"ชั้นเสริม {r['code']} (ถึง Z{RIB_DBL_Z})", 1, r["dpoly"], note=f"ประกบ {r['code']} กาว+สกรู 8 ตัว")
for k in RAILS:
    names = {"BR": "วงล่าง", "SB": "คานรับสายยางหลัง", "SF": "คานรับสายยางหน้า", "BT": "คานบนพนัก", "AT": "วงบนกล่องแขน"}
    for j, seg in enumerate(rail_segments(k), 1):
        add(f"{k}{j}", f"{names[k]} ท่อนที่ {j} (Z{RAILS[k][1]}-{RAILS[k][2]})", 1, seg, note="โค้งตามแปลน · ปลายต่อในร่องซี่โครง")
disc, spine = bolster_parts()
add("PL1-2", "แผ่นบน/ล่าง แกนหมอนข้าง", 2, disc)
add("PL3-4", "แกนตั้ง หมอนข้าง (หลัง/หน้า)", 2, spine, holes=[(0, 100, 9), (0, 260, 9)], note="รูน็อตเฉพาะแผ่นหลัง")
add("BM", "แผ่นยึดหมอนข้าง (หน้าฐาน)", 1, box(0, 0, 220, 172), holes=[(110, 50, 9), (110, 130, 9)], note=f"กาว+สกรูหน้าฐานที่ X{mount_x:.0f}")
add("SP", "แผ่นรองระยะ หมอนข้าง", 4, Point(0, 0).buffer(35, 64), holes=[(0, 0, 9)])
xs = [r["x"] for r in RIBS]
for j, (lx, ly) in enumerate(LEGS, 1):
    pass
bay = min(b - a for a, b in zip(xs[:-1], xs[1:])) - 36
if RAIL_POSTS:
    add("RP", "เสาค้ำใต้คานรับสายยาง (ช่วงยาว)", len(RAIL_POSTS), box(0, 0, 100, 272 - 98),
        note="ตั้งบนวง BR ใต้คาน " + ", ".join(f"{p['code']} ({p['x']:.0f},{p['y']:.0f})" for p in RAIL_POSTS) + " · กาว+สกรู 2 ตัวบน/ล่าง")
add("LPL", "แผ่นเสริมคานใต้ขา (เต็มช่องซี่โครง)", len(LEGS), box(0, 0, bay, 90), holes=[(bay / 2, 45, 10)], note="T-nut M8 + แหวน Ø40")


def part(code):
    return next(p for p in PARTS if p["code"] == code)


# ---------------------------------------------------------------- summary for reports
def summary():
    seat = BODY.difference(ROLLU.buffer(0)).difference(ARMZONE.buffer(60))
    return dict(model=MODEL, L=INFO["L"], plan=[round(v) for v in BODY.bounds], ribs=len(RIBS),
                doubled=sum(r["dbl"] for r in RIBS), arm_ribs=sum(r["arm"] for r in RIBS),
                rear_len=round(REAR.length), front_len=round(FRONT.length), seat_area_m2=round(seat.area / 1e6, 3),
                legs=[(round(x), round(y)) for x, y in LEGS], bolster=dict(c=[round(v) for v in BOL_C], a=round(BOL_A), b=round(BOL_B), ang=round(BOL_ANG)),
                parts=len(PARTS), part_area_m2=round(sum(p["poly"].area * p["qty"] for p in PARTS) / 1e6, 3))


if __name__ == "__main__":
    print(json.dumps(summary(), ensure_ascii=False, default=float))

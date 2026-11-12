#!/usr/bin/env python3
"""
Structural check for the curved sofas FI-01 / FI-02 (frame from docs/tools/sofa_curved.py).

  MODEL=FI-01 python3 docs/tools/sofa-curved-structure.py <out.json>

Same materials, loads and acceptance as sofa-1600-structure.py (REV B), applied to the curved geometry:
  T1 webbing strips (nonlinear cable)         - span = real seat depth at each strip
  T2 seat rails SB / SF (continuous beam along the curved rail, supports = ribs at their arc position)
  T3 every seat rib: 2-D FEM (plane stress, P2, spring supports, adaptive refinement), real notch positions
  T4 base lines front / rear: box beam (bottom ring + top rail + bending-ply skin) along the outline, supports = legs
  T5 legs, T6 arm box, T7 bolster mount, T8 stability (support polygon of the real leg positions)
"""
import json, math, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import sofa_curved as sc                                           # noqa: E402
from shapely.geometry import Point, MultiPoint, LineString, box as sbox   # noqa: E402

OUTJ = sys.argv[1] if len(sys.argv) > 1 else None

PLY = dict(E=5500.0, nu=0.3, fm=25.0, ft=15.0, fc=18.0, fv=3.5, fr=0.9, fc90=5.0)
FLEX = dict(E=2500.0, fm=15.0, fv=2.5)
WEB = dict(EA=1200.0, T0_strain=0.08, Fbreak=1500.0)       # 50 mm elastic webbing, purchase spec: break >= 1500 N
STAPLE_N, GLUE_EDGE, GLUE_FACE, T = 120.0, 2.0, 1.0, 18.0
SF = {"static": 1.5, "fatigue": 2.5, "use": 2.0}
LOADS = {"seat_static": 1300, "back_static": 560, "front_edge": 1300, "arm_down": 750, "arm_side": 400,
         "seat_fatigue": 1000, "back_fatigue": 300, "leg_fwd": 500, "person_drop": 2000, "person_back": 400}
SEAT_H, H, LEG_H = 420, 800, 80
STAPLES = 8
results = []


def check(code, name, value, limit, unit, case, note=""):
    ok = value <= limit
    results.append(dict(code=code, name=name, value=round(float(value), 2), limit=round(float(limit), 2), unit=unit,
                        ratio=round(float(value / limit), 2) if limit else None, ok=bool(ok), case=case, note=note))
    return ok


# ================================================================ geometry from the CNC model
RIBS = sc.RIBS
SEAT_RIBS = [r for r in RIBS if not r["arm"] and r.get("seat") and r["seat"][1] - r["seat"][0] > 150]


def iv(code, x, half=18):
    return sc._intervals(sc.RAILS[code][0], x, half)


def seat_span(x):
    sb, sf = sc._intervals(sc.SB, x), sc._intervals(sc.SF, x)
    if not sb or not sf:
        return None
    a, b = sb[-1][1], sf[0][0]
    return (a, b) if b - a > 100 else None


# webbing strips: STRIPS per bay between neighbouring ribs that both carry the seat rails
STRIPS = []
for r0, r1 in zip(RIBS[:-1], RIBS[1:]):
    if not (iv("SB", r0["x"]) or iv("SF", r0["x"])) and not (iv("SB", r1["x"]) or iv("SF", r1["x"])):
        continue
    xa, xb = r0["x"] + sc.HALF[r0["code"]], r1["x"] - sc.HALF[r1["code"]]
    for j in range(sc.STRIPS):
        x = xa + (xb - xa) * (j + 0.5) / sc.STRIPS
        sp = seat_span(x)
        if sp:
            STRIPS.append(dict(x=x, y0=sp[0], y1=sp[1], L=sp[1] - sp[0]))
SX = np.array([s["x"] for s in STRIPS])
LMAX = max(s["L"] for s in STRIPS)


def webbing(Q, a_frac=0.5, L=None):
    L = L or LMAX
    a, b = a_frac * L, (1 - a_frac) * L
    T0 = WEB["EA"] * WEB["T0_strain"]
    lo, hi = 0.0, 400.0
    for _ in range(80):
        s = (lo + hi) / 2
        la, lb = math.hypot(a, s), math.hypot(b, s)
        Tn = T0 + WEB["EA"] * (la + lb - L) / L
        V = Tn * s / la + Tn * s / lb
        lo, hi = (s, hi) if V < Q else (lo, s)
    la, lb = math.hypot(a, s), math.hypot(b, s)
    return dict(sag=s, T=Tn, Vb=Tn * s / la, Vf=Tn * s / lb, H=Tn * a / la)


def pad_to_strips(P, xc, spread=400.0):
    w = np.clip(1 - np.abs(SX - xc) / (spread / 2), 0, None)
    return P * w / w.sum() if w.sum() else np.zeros_like(SX)


XS_SEAT = np.arange(SX.min(), SX.max() + 1, 15)
q1 = max(max(pad_to_strips(1, xc)) for xc in XS_SEAT)
wb = webbing(LOADS["seat_static"] * q1)
check("T1a", f"แรงดึงสายยางยืด (เบาะ 1300 N · ช่วงยาวสุด {LMAX:.0f} มม.)", wb["T"], WEB["Fbreak"] / SF["static"], "N", "EN seat static", f"ยุบ {wb['sag']:.0f} มม.")
cap = STAPLES * STAPLE_N * 1.6
check("T1b", f"ปลายสายยาง ยิงแม็ก {STAPLES} นัด + พับทบ (สายเกรดขาด ≥ 1500 N)", wb["T"], cap / SF["static"], "N", "EN seat static")
wf = webbing(LOADS["seat_fatigue"] * q1)
check("T1c", "แรงดึงสายยาง ใช้ซ้ำ 50,000 ครั้ง", wf["T"], cap / SF["fatigue"], "N", "EN seat fatigue")
wu = webbing(LOADS["person_drop"] * q1)
check("T1d", "แรงดึงสายยาง คนทิ้งตัวนั่ง 100 กก.", wu["T"], min(WEB["Fbreak"], cap) / SF["use"], "N", "ใช้งานจริง", f"ยุบ {wu['sag']:.0f} มม.")


# ================================================================ beam solver
def beam(xs_nodes, EI, supports, loads):
    nodes = sorted(set([round(x, 3) for x in list(xs_nodes) + list(supports) + [x for x, _ in loads]]))
    n = len(nodes)
    K = np.zeros((2 * n, 2 * n)); F = np.zeros(2 * n)
    for i in range(n - 1):
        L = nodes[i + 1] - nodes[i]
        k = EI / L ** 3 * np.array([[12, 6 * L, -12, 6 * L], [6 * L, 4 * L * L, -6 * L, 2 * L * L],
                                    [-12, -6 * L, 12, -6 * L], [6 * L, 2 * L * L, -6 * L, 4 * L * L]])
        idx = [2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 3]
        K[np.ix_(idx, idx)] += k
    for x, P in loads:
        F[2 * nodes.index(round(x, 3))] += -P
    fixed = [2 * nodes.index(round(s, 3)) for s in supports]
    free = [d for d in range(2 * n) if d not in fixed]
    u = np.zeros(2 * n)
    u[free] = np.linalg.solve(K[np.ix_(free, free)], F[free])
    R = K @ u - F
    Ms, Vs = [], []
    for i in range(n - 1):
        L = nodes[i + 1] - nodes[i]
        d = u[[2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 3]]
        for xi in np.linspace(0, 1, 9):
            B2 = np.array([-6 + 12 * xi, L * (-4 + 6 * xi), 6 - 12 * xi, L * (-2 + 6 * xi)]) / L ** 2
            Ms.append(abs(EI * B2 @ d))
        Vs.append(abs(EI * np.array([12, 6 * L, -12, 6 * L]) @ d / L ** 3))
    return dict(R={s: R[2 * nodes.index(round(s, 3))] for s in supports}, Mmax=max(Ms), wmax=abs(u[0::2]).max(), Vmax=max(Vs))


# ================================================================ T2 seat rails along their curved path
RW = 100.0                                  # seat rail width in plan (band 100 mm)
I_weak, W_weak = RW * T ** 3 / 12, RW * T ** 2 / 6
I_strong, W_strong = T * RW ** 3 / 12, T * RW ** 2 / 6
CHAIN = {"SB": sc.REAR, "SF": sc.FRONT}


def rail_s(code, x, y):
    return sc.RAIL_LINE[code].project(Point(x, y))


def rail_supports(code):
    out = {}
    for r in RIBS:
        ii = iv(code, r["x"])
        if ii:
            a, b = ii[-1] if code == "SB" else ii[0]
            out[r["code"]] = rail_s(code, r["x"], (a + b) / 2)
    return out


SUPS = {k: rail_supports(k) for k in ("SB", "SF")}
POSTS = {k: [p["s"] for p in sc.RAIL_POSTS if p["code"] == k] for k in ("SB", "SF")}
STRIP_S = {k: [rail_s(k, s["x"], s["y0"] if k == "SB" else s["y1"]) for s in STRIPS] for k in ("SB", "SF")}
SPAN_MAX = {k: max(b - a for a, b in zip(sorted(list(v.values()) + POSTS[k])[:-1], sorted(list(v.values()) + POSTS[k])[1:])) for k, v in SUPS.items()}


def rail_case(P, a_frac):
    best = 0.0
    RF = {r["code"]: 0.0 for r in RIBS}; RB = dict(RF); RH = dict(RF)
    for xc in XS_SEAT:
        q = pad_to_strips(P, xc)
        lf, lb, hf, hb = [], [], [], []
        for k, (s, Q) in enumerate(zip(STRIPS, q)):
            if Q <= 0:
                continue
            w = webbing(Q, a_frac, s["L"])
            lf.append((STRIP_S["SF"][k], w["Vf"])); lb.append((STRIP_S["SB"][k], w["Vb"]))
            hf.append((STRIP_S["SF"][k], w["H"])); hb.append((STRIP_S["SB"][k], w["H"]))
        res = {}
        for code, lv, lh, RV in (("SF", lf, hf, RF), ("SB", lb, hb, RB)):
            sup = list(SUPS[code].values()) + POSTS[code]
            bv = beam(STRIP_S[code], PLY["E"] * I_weak, sup, lv)
            bh = beam(STRIP_S[code], PLY["E"] * I_strong, sup, lh)
            res[code] = bv["Mmax"] / W_weak + bh["Mmax"] / W_strong
            inv = {v: c for c, v in SUPS[code].items()}
            for s_, R in bv["R"].items():
                if s_ in inv:
                    RV[inv[s_]] = max(RV[inv[s_]], R)
            for s_, R in bh["R"].items():
                if s_ in inv:
                    RH[inv[s_]] = max(RH[inv[s_]], abs(R))
        best = max(best, max(res.values()))
    return best, RF, RB, RH


r_s, RF_s, RB_s, RH_s = rail_case(LOADS["seat_static"], 0.5)
span_txt = f"ช่วงคานตามแนวโค้ง หน้า {SPAN_MAX['SF']:.0f} · หลัง {SPAN_MAX['SB']:.0f} มม."
check("T2a", "คานรับสายยาง SB/SF ดัด (เบาะ 1300 N)", r_s, PLY["fm"] / SF["static"], "MPa", "EN seat static", span_txt)
r_e, RF_e, RB_e, _ = rail_case(LOADS["front_edge"], 0.85)
check("T2b", "คาน SF ดัด (ขอบหน้าเบาะ 1300 N)", r_e, PLY["fm"] / SF["static"], "MPa", "EN front edge")
r_u, RF_u, RB_u, RH_u = rail_case(LOADS["person_drop"], 0.5)
check("T2c", "คาน SB/SF ดัด (คนทิ้งตัว 2000 N)", r_u, PLY["fm"] / SF["use"], "MPa", "ใช้งานจริง")

# ================================================================ T3 rib FEM (every seat rib)
import triangle                                                     # noqa: E402
from skfem import MeshTri, Basis, FacetBasis, ElementVector, ElementTriP2, asm, BilinearForm, LinearForm, solve   # noqa: E402
from skfem.models.elasticity import lame_parameters                 # noqa: E402
from shapely.geometry import Polygon                                # noqa: E402

REFINE = int(os.environ.get("REFINE", 3))
T_RIB, ZC, NR = 36.0, float(sc.RIB_DBL_Z), sc.NOTCH_R


def mesh_poly(poly, area=float(os.environ.get("MESH_AREA", 60))):
    poly = poly.buffer(3, join_style=1, quad_segs=32).buffer(-3, join_style=1, quad_segs=32).simplify(0.01)
    verts, segs, holes = [], [], []

    def ring(coords):
        c = list(coords)[:-1]
        s = len(verts)
        verts.extend(c)
        segs.extend([(s + i, s + (i + 1) % len(c)) for i in range(len(c))])
    ring(poly.exterior.coords)
    for r in poly.interiors:
        ring(r.coords)
        holes.append(Polygon(r).representative_point().coords[0])
    data = dict(vertices=np.array(verts), segments=np.array(segs))
    if holes:
        data["holes"] = np.array(holes)
    tri = triangle.triangulate(data, f"pq30a{area}")
    return MeshTri(tri["vertices"].T, tri["triangles"].T)


def _solve(m, loads, supports, dbl):
    e = ElementVector(ElementTriP2())
    ib = Basis(m, e)
    lam, mu = lame_parameters(PLY["E"], PLY["nu"])
    lam_ps = 2 * lam * mu / (lam + 2 * mu)
    from skfem.helpers import ddot, sym_grad, trace, eye

    @BilinearForm
    def elast(u_, v_, w):
        th = np.where(w.x[1] < (ZC if dbl else -1), T_RIB, T)
        Cu = 2.0 * mu * sym_grad(u_) + lam_ps * eye(trace(sym_grad(u_)), 2)
        return th * ddot(Cu, sym_grad(v_))
    K = asm(elast, ib)
    f = np.zeros(K.shape[0])
    bf = m.boundary_facets()
    mids = m.p[:, m.facets[:, bf]].mean(axis=1)

    def pick(bx):
        sel = bf[(mids[0] >= bx[0]) & (mids[0] <= bx[2]) & (mids[1] >= bx[1]) & (mids[1] <= bx[3])]
        if len(sel) == 0:
            raise ValueError(f"no facets in {bx}")
        return sel
    for bx, Fy, Fz in loads:
        sel = pick(bx)
        fb = FacetBasis(m, e, facets=sel)
        length = sum(np.linalg.norm(m.p[:, m.facets[0, k]] - m.p[:, m.facets[1, k]]) for k in sel)

        @LinearForm
        def trac(v, w, ty=Fy / length, tz=Fz / length):
            return ty * v[0] + tz * v[1]
        f += asm(trac, fb)
    tb = T_RIB if dbl else T
    kb = PLY["E"] / T / T
    for bx, which in supports:
        fb = FacetBasis(m, e, facets=pick(bx))
        cu, cv = (1.0 if "u" in which else 0.0), (1.0 if "v" in which else 0.0)

        @BilinearForm
        def spring(u_, v_, w, cu=cu, cv=cv):
            return kb * tb * (cu * u_[0] * v_[0] + cv * u_[1] * v_[1])
        K = K + asm(spring, fb)
    u = solve(K, f)
    du = ib.interpolate(u).grad
    exx, ezz, exz = du[0, 0], du[1, 1], 0.5 * (du[0, 1] + du[1, 0])
    c = PLY["E"] / (1 - PLY["nu"] ** 2)
    sxx = c * (exx + PLY["nu"] * ezz); szz = c * (ezz + PLY["nu"] * exx); sxz = PLY["E"] / (1 + PLY["nu"]) * exz
    avg = (sxx + szz) / 2; rad = np.sqrt(((sxx - szz) / 2) ** 2 + sxz ** 2)
    s1, s2 = (avg + rad).mean(axis=1), (avg - rad).mean(axis=1)
    cent = m.p[:, m.t].mean(axis=1)
    return dict(mesh=m, s1=s1, s2=s2, tmax=float(s1.max()), cmax=float(-s2.min()),
                at_t=cent[:, s1.argmax()].tolist(), at_c=cent[:, s2.argmin()].tolist(), umax=float(np.abs(u).max()))


def rib_fem(poly, loads, supports, dbl):
    m = mesh_poly(poly)
    hist = []
    for it in range(REFINE + 1):
        r = _solve(m, loads, supports, dbl)
        hist.append((int(m.t.shape[1]), r["tmax"], r["cmax"]))
        if it == REFINE:
            break
        mark = np.nonzero((r["s1"] > 0.55 * r["s1"].max()) | (-r["s2"] > 0.55 * -r["s2"].min()))[0]
        m = m.refined(mark)
    r["hist"] = hist
    return r


def rib_model(r, Vf, Vb, H, back):
    x = r["x"]
    sf, sb = iv("SF", x)[0], iv("SB", x)[-1]
    L = [((sf[0] + 4, 271, sf[1] - 4, 273), 0, -Vf),
         ((sb[0] + 4, 271, sb[1] - 4, 273), 0, -Vb),
         ((sf[0] - 3.5, 272 + NR, sf[0] - 0.5, 290 - NR), -H, 0),
         ((sb[1] + 0.5, 272 + NR, sb[1] + 3.5, 290 - NR), H, 0)]
    if back and r["post"]:
        p0, p1, rear_first = r["post"][0]
        L.append(((p1 - 36, 560, p1 + 3, 700), -back, 0) if rear_first else ((p0 - 3, 560, p0 + 36, 700), back, 0))
    S = []
    for a, b in iv("BR", x):
        S += [((a + 4, 97, b - 4, 99), "v"), ((a - 3.5, 82, a - 0.5, 92), "u"), ((b + 0.5, 82, b + 3.5, 92), "u")]
    return L, S


FEM = []
for r in SEAT_RIBS:
    c = r["code"]
    for name, Vf, Vb, H, back, sf_, case in [
        ("เบาะ 1300 + พนัก 560 N", RF_s[c], RB_s[c], RH_s[c], 0.7 * LOADS["back_static"], SF["static"], "EN seat+back static"),
        ("ขอบหน้าเบาะ 1300 N", RF_e[c], RB_e[c], RH_s[c], 0, SF["static"], "EN front edge"),
        ("คนทิ้งตัว 2000 N + พิง 400 N", RF_u[c], RB_u[c], RH_u[c], 0.7 * LOADS["person_back"], SF["use"], "ใช้งานจริง")]:
        Lds, Sup = rib_model(r, Vf, Vb, H, back)
        res = rib_fem(r["poly"], Lds, Sup, r["dbl"])
        res.update(rib=c, label=name, sf=sf_, case=case, Vf=Vf, Vb=Vb, H=H, back=back)
        FEM.append(res)
for name, sf_, case in [("เบาะ 1300 + พนัก 560 N", SF["static"], "EN seat+back static"), ("ขอบหน้าเบาะ 1300 N", SF["static"], "EN front edge"),
                        ("คนทิ้งตัว 2000 N + พิง 400 N", SF["use"], "ใช้งานจริง")]:
    rs = [f for f in FEM if f["label"] == name]
    wt = max(rs, key=lambda f: f["tmax"]); wc = max(rs, key=lambda f: f["cmax"])
    check("T3", f"ซี่โครง (36 มม. ถึง Z{sc.RIB_DBL_Z}) ดึงสูงสุด · {name}", wt["tmax"], PLY["ft"] / sf_, "MPa", case,
          f"{wt['rib']} ที่ y{wt['at_t'][0]:.0f} z{wt['at_t'][1]:.0f} · ตรวจ {len(rs)} ซี่")
    check("T3", f"ซี่โครง อัด/กดสูงสุด · {name}", wc["cmax"], PLY["fc"] / sf_, "MPa", case,
          f"{wc['rib']} ที่ y{wc['at_c'][0]:.0f} z{wc['at_c'][1]:.0f}")

# ================================================================ T4 base lines (box beams along the outline)
LEGS = list(sc.LEGS)
LINE_CHAIN = {"front": sc.FRONT, "rear": sc.REAR}


def leg_line(p):
    return "front" if sc.FRONT.distance(Point(p)) < sc.REAR.distance(Point(p)) else "rear"


def section(line):
    if line == "front":       # BR (100x18 @ z89) + SF (80x18 @ z281) + skin 2 x 4 mm, h 210
        fl = [(100 * T, 89.0), (RW * T, 281.0)]; web_t, z0, z1 = 8.0, 80.0, 290.0      # front: BR + SF
    else:                     # BR + BT (50x18 @ z711) + back skin 2 x 4 mm, h 640
        fl = [(100 * T, 89.0), (50 * T, 711.0)]; web_t, z0, z1 = 8.0, 80.0, 720.0
    hw = z1 - z0
    A = sum(a for a, _ in fl) + web_t * hw
    zc = (sum(a * z for a, z in fl) + web_t * hw * (z0 + hw / 2)) / A
    I = sum(a * (z - zc) ** 2 for a, z in fl) + web_t * hw ** 3 / 12 + web_t * hw * (z0 + hw / 2 - zc) ** 2
    c = max(abs(z - zc) for _, z in fl) + T / 2
    return PLY["E"] * I, I / c, I, zc, hw


def rib_split(r, Vf, Vb, back):
    """vertical rib reactions -> (front line, rear line) by lever rule between the BR notches"""
    brs = iv("BR", r["x"])
    tot = Vf + Vb
    if len(brs) < 2:
        y = (brs[0][0] + brs[0][1]) / 2
        return (tot, 0.0) if sc.FRONT.distance(Point(r["x"], y)) < sc.REAR.distance(Point(r["x"], y)) else (0.0, tot)
    yr, yf = (brs[0][0] + brs[0][1]) / 2, (brs[-1][0] + brs[-1][1]) / 2
    sfi, sbi = iv("SF", r["x"]), iv("SB", r["x"])
    ysf = (sfi[0][0] + sfi[0][1]) / 2 if sfi else yf
    ysb = (sbi[-1][0] + sbi[-1][1]) / 2 if sbi else yr
    mom = Vf * (ysf - yr) + Vb * (ysb - yr) - back * (650 - 89)
    f = mom / (yf - yr)
    return f, tot - f


def rib_s(r, line):
    brs = iv("BR", r["x"])
    y = (brs[-1][0] + brs[-1][1]) / 2 if line == "front" else (brs[0][0] + brs[0][1]) / 2
    return LINE_CHAIN[line].project(Point(r["x"], y))


def lines_case(people, back_each):
    load = {"front": {}, "rear": {}}
    for xc, P in people:
        q = pad_to_strips(P, xc)
        lf, lb = [], []
        for k, (s, Q) in enumerate(zip(STRIPS, q)):
            if Q <= 0:
                continue
            w = webbing(Q, 0.5, s["L"]); lf.append((STRIP_S["SF"][k], w["Vf"])); lb.append((STRIP_S["SB"][k], w["Vb"]))
        bf = beam(STRIP_S["SF"], PLY["E"] * I_weak, list(SUPS["SF"].values()) + POSTS["SF"], lf)
        bb = beam(STRIP_S["SB"], PLY["E"] * I_weak, list(SUPS["SB"].values()) + POSTS["SB"], lb)
        near = min(SEAT_RIBS, key=lambda r: abs(r["x"] - xc))["code"]
        for r in RIBS:
            Vf = bf["R"].get(SUPS["SF"].get(r["code"]), 0.0)
            Vb = bb["R"].get(SUPS["SB"].get(r["code"]), 0.0)
            if Vf == 0 and Vb == 0:
                continue
            f_, b_ = rib_split(r, Vf, Vb, back_each * 0.7 if r["code"] == near and r["post"] else 0)
            for line, v in (("front", f_), ("rear", b_)):
                s = rib_s(r, line)
                load[line][s] = load[line].get(s, 0) + v
    out = {}
    for line in ("front", "rear"):
        sup = sorted(LINE_CHAIN[line].project(Point(p)) for p in LEGS if leg_line(p) == line)
        EI, W, I, zc, hw = section(line)
        if len(sup) < 2:
            sup = sorted(LINE_CHAIN[line].project(Point(p)) for p in LEGS)
        res = beam(list(load[line].keys()), EI, sup, list(load[line].items()))
        out[line] = dict(sig=res["Mmax"] / W, w=res["wmax"], R=res["R"], V=res["Vmax"], I=I, zc=zc, hw=hw)
    return out


seat_x0, seat_x1 = SX.min(), SX.max()
n_people = max(2, int((seat_x1 - seat_x0 + 200) // 550))
people = [(seat_x0 + (seat_x1 - seat_x0) * (k + 0.5) / n_people, 2000) for k in range(n_people)]
leg_R = 0.0
cases_T4 = [("เบาะ 1300 N ที่ปลายซ้าย", [(seat_x0 + 60, LOADS["seat_static"])], LOADS["back_static"], SF["static"], "EN seat static"),
            ("เบาะ 1300 N กลางเบาะ", [((seat_x0 + seat_x1) / 2, LOADS["seat_static"])], LOADS["back_static"], SF["static"], "EN seat static"),
            (f"{n_people} คนทิ้งตัวนั่งพร้อมกัน", people, LOADS["person_back"], SF["use"], "ใช้งานจริง")]
for name, ppl, back, sf_, case in cases_T4:
    o = lines_case(ppl, back)
    for line in ("front", "rear"):
        check("T4", f"แนวฐาน{'หน้า' if line == 'front' else 'หลัง'} (คานกล่องโค้ง) ดัด · {name}", o[line]["sig"], PLY["fm"] / sf_, "MPa", case,
              f"แอ่น {o[line]['w']:.1f} มม.")
        leg_R = max(leg_R, max(abs(v) for v in o[line]["R"].values()))
o = lines_case(people, LOADS["person_back"])
for line, lbl in (("front", "หน้า"), ("rear", "หลัง")):
    EI, W, I, zc, hw = section(line)
    Q = 100 * T * abs(89 - zc)
    q = o[line]["V"] * Q / I
    check("T4g", f"กาวไม้อัดดัด{lbl}ทับใต้วง BR (lap 80 มม.)", q / 80, GLUE_FACE / SF["use"], "MPa", "ใช้งานจริง")
    check("T4w", f"ไม้อัดดัด{lbl} 2×4 มม. รับแรงเฉือน", o[line]["V"] / (8 * hw), FLEX["fv"] / SF["use"], "MPa", "ใช้งานจริง")

# ================================================================ T5 legs
xs = [r["x"] for r in RIBS]
for lx, ly in LEGS:
    left = max([x for x in xs if x <= lx], default=None); right = min([x for x in xs if x >= lx], default=None)
    if left is None or right is None:
        continue
    if min(abs(lx - left), abs(lx - right)) < 30:
        check("T5c", f"ขา ({lx:.0f},{ly:.0f}) ชนซี่โครง", 1, 0.0001, "", "เรขาคณิต")
        continue
    a, b_ = lx - left, right - lx
    M = leg_R * a * b_ / (right - left)
    check("T5a", f"วงล่าง + แผ่นเสริม 36 มม. ใต้ขา ({lx:.0f},{ly:.0f}) ดัด", M / (100 * 36 ** 2 / 6), PLY["fm"] / SF["use"], "MPa", "ใช้งานจริง",
          f"แรงขาสูงสุด {leg_R:.0f} N · ช่วงซี่โครง {right - left:.0f}")
Tbolt = LOADS["leg_fwd"] * LEG_H / (0.7 * 25)
check("T5b", "T-nut M8 กดเนื้อไม้ (ขาโดนดันข้าง 500 N) · แหวน Ø40", Tbolt / (math.pi / 4 * (40 ** 2 - 9 ** 2)), PLY["fc90"] / SF["static"], "MPa", "EN leg forward")

# ================================================================ T6 arm box
arm = [r for r in RIBS if r["arm"]]
span_arm = max((b["x"] - a["x"] for a, b in zip(arm[:-1], arm[1:])), default=200) - 18
at_w = 120.0
check("T6a", f"วงบนกล่องแขน AT ดัด (กดแขน 750 N · ช่วง {span_arm:.0f})", LOADS["arm_down"] * span_arm / 4 / (at_w * T ** 2 / 6), PLY["fm"] / SF["static"], "MPa", "EN arm down")
arm_depth = min(r["yb"] - r["ya"] for r in arm)
check("T6b", "ไม้อัดดัดรอบกล่องแขน รับแรงดันแขนออกข้าง 400 N", LOADS["arm_side"] / (8 * min(arm_depth, 300)), FLEX["fv"] / SF["static"], "MPa", "EN arm sideways",
      "ผิวโค้งรอบปลายแขนทำหน้าที่ผนังรับแรงเฉือน")
check("T6c", "กาวผิวทับใต้แผ่นล่างกล่องแขน (ดันแขนออกข้าง)", LOADS["arm_side"] * (480 - 80) / 300 / (80 * 300), GLUE_FACE / SF["static"], "MPa", "EN arm sideways")

# ================================================================ T7 bolster
mount = min(RIBS, key=lambda r: abs(r["x"] - sc.BOL_C[0]))
lever = sc.FRAME.exterior.distance(Point(sc.BOL_C)) if not sc.FRAME.contains(Point(sc.BOL_C)) else 0
lever = max(lever, sc.BOL_B + 60)
bm = sc.part("BM")
hz = sorted(h[1] for h in bm["holes"])
bolt_d = hz[-1] - hz[0]
Tb = max(LOADS["arm_side"] * (480 - 100) / bolt_d, 0.5 * LOADS["arm_down"] * lever / bolt_d)
check("T7a", f"น็อต M8 หมอนข้าง แรงดึง (ดันหมอนข้างออก 400 N ที่ Z480 / กดบน 750 N ครึ่งหนึ่งลงขาหมอน)", Tb, 8000 / SF["static"], "N", "EN arm sideways / down",
      f"หมอนข้างมีขาซ่อนใต้แกน · ระยะน็อต {bolt_d:.0f} มม.")
check("T7b", "T-nut ในแกนหมอนข้าง กดเนื้อไม้ (แหวน Ø40)", Tb / (math.pi / 4 * (40 ** 2 - 9 ** 2)), PLY["fc90"] / SF["static"], "MPa", "EN arm down")
check("T7c", "แกนหมอนข้าง (กล่อง 2 แผ่นตั้ง) ดัด", 0.5 * LOADS["arm_down"] * (sc.BOL_B - 40) / (T * 80 ** 2 / 6), PLY["fm"] / SF["static"], "MPa", "EN arm down")

# ================================================================ T8 stability (real support polygon)
part_m2 = sum(p["poly"].area * p["qty"] for p in sc.PARTS) / 1e6
scale = sc.BODY_FULL.area / 1.10e6                       # SOFA 1600: ~1.10 m2 plan -> foam 9 kg, fabric 4 kg
mass = 0.56 * part_m2 * 18 + 13 * scale + 1.5 + 4
Wt = mass * 9.81
G = sc.BODY_FULL.centroid
SUPPORTS = LEGS + [sc.BOLSTER_FOOT]
hull = MultiPoint(SUPPORTS).convex_hull
hc = list(hull.exterior.coords)
edges = [(Point(a), Point(b)) for a, b in zip(hc[:-1], hc[1:])]


def sdist(p, e):
    """signed distance of p to edge line, positive inside the support polygon"""
    (x1, y1), (x2, y2) = (e[0].x, e[0].y), (e[1].x, e[1].y)
    nx, ny = y2 - y1, -(x2 - x1)
    L = math.hypot(nx, ny)
    d = ((p[0] - x1) * nx + (p[1] - y1) * ny) / L
    c = hull.centroid
    sgn = 1 if ((c.x - x1) * nx + (c.y - y1) * ny) > 0 else -1
    return d * sgn


def edge_normal(e):
    """outward unit normal of a support-polygon edge"""
    (x1, y1), (x2, y2) = (e[0].x, e[0].y), (e[1].x, e[1].y)
    nx, ny = y2 - y1, -(x2 - x1)
    L = math.hypot(nx, ny); nx, ny = nx / L, ny / L
    c = hull.centroid
    return (nx, ny) if ((x1 - c.x) * nx + (y1 - c.y) * ny) > 0 else (-nx, -ny)


def tip(points, F, Fh=0.0, h=0.0, extra=(), dirs=None):
    """worst overturning / restoring moment over all support edges and load points.
    F vertical load at the point; Fh horizontal push at height h in direction dirs[i] (unit)."""
    worst = (0, 1, None)
    for e in edges:
        dG = sdist((G.x, G.y), e)
        ne = edge_normal(e)
        for i, p in enumerate(points):
            dp = sdist(p, e)
            push = Fh * h * max(0.0, dirs[i][0] * ne[0] + dirs[i][1] * ne[1]) if dirs else Fh * h
            Mo = F * max(-dp, 0) + push
            Mr = Wt * dG + F * max(dp, 0) + sum(Fe * sdist(pe, e) for pe, Fe in extra)
            if Mo <= 0:
                continue
            if worst[2] is None or Mo / Mr > worst[0] / worst[1]:
                worst = (Mo, Mr, p)
    return worst


inner = sc.BODY.buffer(-60, join_style=1)
inner = max(getattr(inner, "geoms", [inner]), key=lambda g: g.area)
ring_pts = [inner.exterior.interpolate(d) for d in np.arange(0, inner.exterior.length, 20)]
front_pts = [(p.x, p.y) for p in ring_pts if sc.FRONT.distance(p) < sc.REAR.distance(p) and p.x < sc.X_ARM]
inner100 = sc.BODY.buffer(-100, join_style=1)
inner100 = max(getattr(inner100, "geoms", [inner100]), key=lambda g: g.area)
front100 = [(p.x, p.y) for p in (inner100.exterior.interpolate(d) for d in np.arange(0, inner100.exterior.length, 20))
            if sc.FRONT.distance(p) < sc.REAR.distance(p) and p.x < sc.X_ARM]
end_pts = [(p.x, p.y) for p in ring_pts if p.x > sc.X_ARM or p.x < sc.XMIN + 250]
Mo, Mr, p = tip(front_pts, 600, 20, SEAT_H)
check("T8a", "ล้มไปหน้า (600 N ห่างขอบหน้า 60 มม. + ดัน 20 N)", Mo, Mr, "N·mm", "EN 1022 แนวทาง", f"น้ำหนักโซฟา ~{mass:.0f} กก. · จุดแย่สุด ({p[0]:.0f},{p[1]:.0f})" if p else f"~{mass:.0f} กก.")
Mo, Mr, p = tip(front100, 750)
check("T8d", "ล้มไปหน้า (คน 100 กก. นั่งริมขอบหน้า 75% บนเบาะ)", Mo, Mr, "N·mm", "ใช้งานจริง", f"จุดแย่สุด ({p[0]:.0f},{p[1]:.0f})" if p else "จุดนั่งทุกจุดอยู่ในแนวขา")
back_top, back_dir = [], []
for d in np.arange(0, sc.REAR.length, 20):
    q = sc.REAR.interpolate(d)
    if sc.BACKZONE.distance(q) > 20:
        continue
    t0, t1 = sc.REAR.interpolate(max(d - 10, 0)), sc.REAR.interpolate(min(d + 10, sc.REAR.length))
    tx, ty = t1.x - t0.x, t1.y - t0.y
    L = math.hypot(tx, ty) or 1
    nx, ny = ty / L, -tx / L                              # normal; pick the one pointing away from the seat
    if (q.x + nx * 50 - G.x) ** 2 + (q.y + ny * 50 - G.y) ** 2 < (q.x - G.x) ** 2 + (q.y - G.y) ** 2:
        nx, ny = -nx, -ny
    back_top.append((q.x, q.y)); back_dir.append((nx, ny))
seat_c = sc.BODY.difference(sc.ROLLU.buffer(100)).centroid
Mo, Mr, p = tip(back_top, 0, 300, H - 80, extra=[((seat_c.x, seat_c.y), 600)], dirs=back_dir)
check("T8b", "ล้มไปหลัง (พิงพนักบน 300 N + นั่ง 600 N)", Mo, Mr, "N·mm", "EN 1022 แนวทาง")
Mo, Mr, p = tip(end_pts, 750)
check("T8c", "ล้มไปข้าง (นั่ง/กดปลายแขนหรือปลายซ้าย 750 N)", Mo, Mr, "N·mm", "EN 1022 แนวทาง", f"จุดแย่สุด ({p[0]:.0f},{p[1]:.0f})" if p else "จุดกดทุกจุดอยู่ในแนวขา")
bol_pts = [(p.x, p.y) for p in (sc.BOLSTER.buffer(-40).exterior.interpolate(d) for d in np.arange(0, sc.BOLSTER.length, 20))]
Mo, Mr, p = tip(bol_pts, 750)
check("T8e", "ล้ม เมื่อนั่ง/ยันบนหมอนข้าง 750 N", Mo, Mr, "N·mm", "ใช้งานจริง", f"จุดแย่สุด ({p[0]:.0f},{p[1]:.0f})" if p else "หมอนข้างอยู่ในแนวขา")

# ================================================================ output
fails = [r for r in results if not r["ok"]]
print(f"{sc.MODEL}: {len(results)} checks, {len(fails)} fail · mass {mass:.0f} kg · legs {[(round(x), round(y)) for x, y in LEGS]}")
for r in results:
    print(("PASS " if r["ok"] else "FAIL ") + f"{r['code']:4} {r['name'][:66]:66} {r['value']:>12} / {r['limit']:<12} {r['unit']:5} {r['note']}")
if OUTJ:
    res = dict(model=sc.MODEL, name=sc.INFO["name"], materials=dict(ply=PLY, flex=FLEX, web=WEB), loads=LOADS, sf=SF, mass=mass,
               legs=LEGS, strips=len(STRIPS), span_max=LMAX, rail_span=SPAN_MAX, n_people=n_people, results=results,
               fem=[dict(rib=f["rib"], label=f["label"], tmax=f["tmax"], cmax=f["cmax"], hist=f["hist"], Vf=f["Vf"], Vb=f["Vb"], H=f["H"]) for f in FEM])
    json.dump(res, open(OUTJ, "w"), ensure_ascii=False, indent=1, default=float)
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.tri as mtri
    worst = max((f for f in FEM if f["label"].startswith("คน")), key=lambda f: max(f["tmax"] / f["sf"], f["cmax"] / f["sf"]))
    for k, lbl in enumerate(["เบาะ 1300 + พนัก 560 N", "ขอบหน้าเบาะ 1300 N", "คนทิ้งตัว 2000 N + พิง 400 N"]):
        f = next(f for f in FEM if f["rib"] == worst["rib"] and f["label"] == lbl)
        fig, ax = plt.subplots(figsize=(5.6, 4.6), dpi=170)
        m = f["mesh"]
        tr = mtri.Triangulation(m.p[0], m.p[1], m.t.T)
        val = np.where(f["s1"] > -f["s2"], f["s1"], f["s2"])
        lim = max(abs(val).max(), 1)
        tp = ax.tripcolor(tr, facecolors=val, cmap="RdBu_r", vmin=-lim, vmax=lim, edgecolors="none")
        ax.set_aspect("equal"); ax.axis("off")
        cb = fig.colorbar(tp, ax=ax, shrink=0.6); cb.set_label("MPa  (+ tension / - compression)")
        fig.savefig(OUTJ.replace(".json", f"-fem{k + 1}.png"), bbox_inches="tight")
        plt.close(fig)
    # plan of legs / support polygon
    fig, ax = plt.subplots(figsize=(7, 4.6), dpi=170)
    for g, c, lw in [(sc.BODY_FULL, "#C9CED6", 0.8), (sc.BODY, "#2B4368", 1.0), (sc.BOLSTER, "#958C7B", 1.0), (hull, "#1F6B3A", 1.0)]:
        x, y = g.exterior.xy; ax.plot(x, y, color=c, lw=lw)
    ax.fill(*hull.exterior.xy, color="#DCEFE3", alpha=.6)
    for x, y in SUPPORTS:
        ax.plot(x, y, "o", color="#1F6B3A", ms=6)
    ax.plot(G.x, G.y, "x", color="#8A2B20", ms=8)
    for r in RIBS:
        ax.plot([r["x"], r["x"]], [r["ya"], r["yb"]], color="#83B7BF", lw=1.4)
    ax.set_aspect("equal"); ax.invert_yaxis(); ax.axis("off")
    fig.savefig(OUTJ.replace(".json", "-plan.png"), bbox_inches="tight")
    plt.close(fig)

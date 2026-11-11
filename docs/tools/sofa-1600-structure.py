#!/usr/bin/env python3
"""
SOFA 1600 — structural check of the CNC plywood frame.

Reads the frame geometry from build-sofa-1600-drawing.py (whatever revision is there) and runs:
  T1  elastic webbing + staples            nonlinear cable model (sag / tension equilibrium)
  T2  seat rails B3 / B4                    continuous beam on rib supports (stiffness method)
  T3  rib (R2-R5)                           2D plane-stress FEM, P2 triangles (scikit-fem)
  T4  longitudinal spans between legs       continuous beam on leg supports, section per revision
  T5  legs + leg pads                       hand calc (bending of pad/band, T-nut bearing)
  T6  arm box                               hand calc (tab glue shear, plate bending)
  T7  bolster attachment                    hand calc (bolt couple, core plate bending)
  T8  stability (overturning)               rigid body moments about leg lines
Loads: EN 12520:2015 domestic seating test levels (as remembered, verify against the standard)
plus a real-use case (3 adults of 100 kg sitting down hard, dynamic factor 2).

Usage: python3 docs/tools/sofa-1600-structure.py REV  [out.json]
REV = "A" (frame as first issued) or "B" (frame after fixes) — only changes design assumptions
that are not in the drawing geometry (leg x, skin wrap, staples, bolster core).
"""
import importlib.util, json, math, os, sys
import numpy as np

REV = sys.argv[1] if len(sys.argv) > 1 else "B"
OUTJ = sys.argv[2] if len(sys.argv) > 2 else None
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
spec = importlib.util.spec_from_file_location("dwg", os.path.join(os.path.dirname(__file__), "build-sofa-1600-drawing.py"))
dwg = importlib.util.module_from_spec(spec)
sys.argv = sys.argv[:1]
spec.loader.exec_module(dwg)

# ---------------------------------------------------------------- materials (characteristic, conservative)
PLY = dict(E=5500.0, nu=0.3, fm=25.0, ft=15.0, fc=18.0, fv=3.5, fr=0.9, fc90=5.0)   # 18 mm rubberwood/poplar WBP ply
FLEX = dict(E=2500.0, fm=15.0, fv=2.5)                                               # 4 mm bending ply
WEB = dict(EA=1200.0, T0_strain=0.08, Fbreak=1000.0)                                 # 50 mm elastic webbing
STAPLE_N = 120.0       # one 10 mm crown staple in plywood, lateral, characteristic
GLUE_EDGE = 2.0        # PVA on plywood edge, shear MPa (characteristic, conservative)
GLUE_FACE = 1.0        # PVA face-to-face on ply, limited by rolling shear of veneers
T = 18.0

# acceptance: stress <= f_k / SF
SF = {"static": 1.5, "fatigue": 2.5, "use": 2.0}

# ---------------------------------------------------------------- loads (N)
LOADS = {
    "seat_static": 1300, "back_static": 560, "front_edge": 1300, "arm_down": 750, "arm_side": 400,
    "seat_fatigue": 1000, "back_fatigue": 300, "leg_fwd": 500, "leg_side": 390,
    "person_drop": 2000, "person_back": 400,
}

DESIGN = {
    "A": dict(legs_x=[150, 850], leg_pad="90x90", skin_box=False, staples=4, bolster_box=False, strips=3, washer=22),
    "B": dict(legs_x=list(getattr(dwg, "LEG_X", (150, 715))), leg_pad="full-bay", skin_box=True, staples=6,
              bolster_box=True, strips=getattr(dwg, "STRIPS", 4), washer=40, sk1_layers=2),
}[REV]

RIB_X = list(dwg.RIB_X.values())
B = dwg.BANDS
results = []


def check(code, name, value, limit, unit, case, note=""):
    ok = value <= limit
    results.append(dict(code=code, name=name, value=round(value, 2), limit=round(limit, 2), unit=unit,
                        ratio=round(value / limit, 2) if limit else None, ok=ok, case=case, note=note))
    return ok


# ================================================================ T1 webbing
SPAN = B["B3"][0] - B["B4"][1]      # free span between rail inner edges
STRIP_PITCH = None


def webbing(Q, a_frac=0.5):
    """Point load Q on one strip at a_frac of span. Returns sag, tension, end reactions (V_back, V_front, H)."""
    L = SPAN
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


def strips():
    xs = []
    for i in range(len(RIB_X) - 1):
        hv = list(getattr(dwg, "HALF", {k: 9 for k in dwg.RIB_X}).values())
        xa, xb = RIB_X[i] + hv[i], RIB_X[i + 1] - hv[i + 1]
        n = DESIGN["strips"]
        for j in range(n):
            xs.append(xa + (xb - xa) * (j + 0.5) / n)
    return np.array(xs)


SX = strips()


def pad_to_strips(P, xc, spread=400.0):
    w = np.clip(1 - np.abs(SX - xc) / (spread / 2), 0, None)
    return P * w / w.sum() if w.sum() else np.zeros_like(SX)


wb = webbing(LOADS["seat_static"] * max(pad_to_strips(1, 700)), 0.5)
check("T1a", "แรงดึงสายยางยืด (เบาะ 1300 N)", wb["T"], WEB["Fbreak"] / SF["static"], "N", "EN seat static",
      f"ยุบ {wb['sag']:.0f} มม.")
cap = DESIGN["staples"] * STAPLE_N * (1.6 if DESIGN["staples"] >= 6 else 1.0)
check("T1b", f"ปลายสายยาง ยิงแม็ก {DESIGN['staples']} นัด" + (" + พับทบ" if DESIGN["staples"] >= 6 else ""),
      wb["T"], cap / SF["static"], "N", "EN seat static")
wf = webbing(LOADS["seat_fatigue"] * max(pad_to_strips(1, 700)), 0.5)
check("T1c", "แรงดึงสายยาง ใช้ซ้ำ 50,000 ครั้ง", wf["T"], cap / SF["fatigue"], "N", "EN seat fatigue")
wu = webbing(LOADS["person_drop"] * max(pad_to_strips(1, 700)), 0.5)
check("T1d", "แรงดึงสายยาง คนทิ้งตัวนั่ง 100 กก.", wu["T"], min(WEB["Fbreak"], cap) / SF["use"], "N", "ใช้งานจริง",
      f"ยุบ {wu['sag']:.0f} มม.")


# ================================================================ beam solver (Euler, stiffness method)
def beam(xs_nodes, EI, supports, loads):
    """Continuous beam: nodes sorted, point loads [(x,P)], pinned supports at x in `supports` (added as nodes)."""
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
    # moments along beam
    Ms = []
    for i in range(n - 1):
        L = nodes[i + 1] - nodes[i]
        d = u[[2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 3]]
        for xi in np.linspace(0, 1, 9):
            B2 = np.array([-6 + 12 * xi, L * (-4 + 6 * xi), 6 - 12 * xi, L * (-2 + 6 * xi)]) / L ** 2
            Ms.append(abs(EI * B2 @ d))
    Vs = []
    for i in range(n - 1):
        L = nodes[i + 1] - nodes[i]
        d = u[[2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 3]]
        Vs.append(abs(EI * np.array([12, 6 * L, -12, 6 * L]) @ d / L ** 3))
    return dict(nodes=nodes, u=u, R={s: R[2 * nodes.index(round(s, 3))] for s in supports}, Mmax=max(Ms),
                wmax=abs(u[0::2]).max(), Vmax=max(Vs))


# ================================================================ T2 seat rails
I_weak = 100 * T ** 3 / 12
I_strong = T * 100 ** 3 / 12
W_weak = 100 * T ** 2 / 6
W_strong = T * 100 ** 2 / 6
rail_x0, rail_x1 = B["B3"][4], B["B3"][5]


def rail_case(P, a_frac):
    """Worst over pad positions: rail stress and max rib reactions (front, back)."""
    worst = dict(sig=0, sigH=0, Rf={}, Rb={})
    rib_front = {x: 0 for x in RIB_X}; rib_back = {x: 0 for x in RIB_X}; rib_h = {x: 0 for x in RIB_X}
    best = None
    for xc in np.arange(120, 1300, 15):
        q = pad_to_strips(P, xc)
        lf, lb, hf = [], [], []
        for x, Q in zip(SX, q):
            if Q <= 0: continue
            w = webbing(Q, a_frac)
            lf.append((x, w["Vf"])); lb.append((x, w["Vb"])); hf.append((x, w["H"]))
        bf = beam(SX, PLY["E"] * I_weak, RIB_X, lf)
        bb = beam(SX, PLY["E"] * I_weak, RIB_X, lb)
        bh = beam(SX, PLY["E"] * I_strong, RIB_X, hf)
        sig = max(bf["Mmax"], bb["Mmax"]) / W_weak + bh["Mmax"] / W_strong
        if best is None or sig > best["sig"]:
            best = dict(sig=sig, xc=xc)
        for x in RIB_X:
            rib_front[x] = max(rib_front[x], bf["R"][x]); rib_back[x] = max(rib_back[x], bb["R"][x])
            rib_h[x] = max(rib_h[x], abs(bh["R"][x]))
    return best, rib_front, rib_back, max(rib_h.values())


r_s, RF_s, RB_s, H_s = rail_case(LOADS["seat_static"], 0.5)
check("T2a", "คานรับสายยาง B3/B4 ดัด (เบาะ 1300 N)", r_s["sig"], PLY["fm"] / SF["static"], "MPa", "EN seat static")
r_e, RF_e, RB_e, _ = rail_case(LOADS["front_edge"], 0.85)
check("T2b", "คาน B3 ดัด (ขอบหน้าเบาะ 1300 N)", r_e["sig"], PLY["fm"] / SF["static"], "MPa", "EN front edge")
r_u, RF_u, RB_u, H_u = rail_case(LOADS["person_drop"], 0.5)
check("T2c", "คาน B3/B4 ดัด (คนทิ้งตัว 2000 N)", r_u["sig"], PLY["fm"] / SF["use"], "MPa", "ใช้งานจริง")

# ================================================================ T3 rib FEM
import triangle
import skfem
from skfem import MeshTri, Basis, FacetBasis, ElementVector, ElementTriP2, asm, BilinearForm, LinearForm, condense, solve
from skfem.models.elasticity import linear_elasticity, lame_parameters
from shapely.geometry import Polygon, box as sbox


def mesh_poly(poly, area=float(os.environ.get("MESH_AREA", 40))):
    poly = poly.buffer(3, join_style=1, quad_segs=32).buffer(-3, join_style=1, quad_segs=32)   # >= r3 at concave corners (Ø6 tool)
    poly = poly.simplify(0.01)        # keep the corner arcs smooth: a coarse polyline makes artificial sharp corners
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
    return MeshTri(tri["vertices"].T, tri["triangles"].T), poly


def rib_fem(poly, loads, supports, label):
    """loads: list of (box(y0,z0,y1,z1), Fy, Fz) total forces spread on boundary facets inside box.
       supports: list of (box, dofs) with dofs 'u','v' or 'uv' on boundary facets inside box."""
    m, poly2 = mesh_poly(poly)
    hist = []
    for it in range(REFINE + 1):
        r = _solve(m, loads, supports)
        hist.append((m.t.shape[1], float(r["s1"].max()), float(-r["s2"].min()), r["at_t"], r["at_c"]))
        if it == REFINE:
            break
        mark = np.nonzero((r["s1"] > 0.55 * r["s1"].max()) | (-r["s2"] > 0.55 * -r["s2"].min()))[0]
        m = m.refined(mark)
    r.update(label=label, poly=poly2, hist=hist)
    return r


REFINE = int(os.environ.get("REFINE", 4))
T_RIB = float(getattr(dwg, "RIB_T", {"R2": 18})["R2"])     # rib thickness used by the FEM (REV B: 2 x 18 glued)


def _solve(m, loads, supports):
    e = ElementVector(ElementTriP2())
    ib = Basis(m, e)
    lam, mu = lame_parameters(PLY["E"], PLY["nu"])
    lam_ps = 2 * lam * mu / (lam + 2 * mu)
    K = asm(linear_elasticity(lam_ps, mu), ib) * T_RIB
    f = np.zeros(K.shape[0])
    bf_all = m.boundary_facets()
    mids = m.p[:, m.facets[:, bf_all]].mean(axis=1)
    for bx, Fy, Fz in loads:
        sel = bf_all[(mids[0] >= bx[0]) & (mids[0] <= bx[2]) & (mids[1] >= bx[1]) & (mids[1] <= bx[3])]
        if len(sel) == 0:
            raise ValueError(f"no facets for load box {bx}")
        fb = FacetBasis(m, e, facets=sel)
        length = sum(np.linalg.norm(m.p[:, m.facets[0, k]] - m.p[:, m.facets[1, k]]) for k in sel)

        @LinearForm
        def trac(v, w, ty=Fy / length, tz=Fz / length):
            return ty * v[0] + tz * v[1]
        f += asm(trac, fb)
    # supports = elastic bed (the band under / beside the rib): k = E / band thickness, per mm2 of contact
    kb = PLY["E"] / T / T            # N/mm3 per unit rib thickness (K is already x T)
    for bx, which in supports:
        sel = bf_all[(mids[0] >= bx[0]) & (mids[0] <= bx[2]) & (mids[1] >= bx[1]) & (mids[1] <= bx[3])]
        if len(sel) == 0:
            raise ValueError(f"no facets for support box {bx}")
        fb = FacetBasis(m, e, facets=sel)
        cu, cv = (1.0 if "u" in which else 0.0), (1.0 if "v" in which else 0.0)

        @BilinearForm
        def spring(u_, v_, w, cu=cu, cv=cv):
            return kb * T_RIB * (cu * u_[0] * v_[0] + cv * u_[1] * v_[1])
        K = K + asm(spring, fb)
    u = solve(K, f)
    # stresses at quadrature points
    du = ib.interpolate(u).grad
    exx, ezz = du[0, 0], du[1, 1]
    exz = 0.5 * (du[0, 1] + du[1, 0])
    c = PLY["E"] / (1 - PLY["nu"] ** 2)
    sxx = c * (exx + PLY["nu"] * ezz); szz = c * (ezz + PLY["nu"] * exx); sxz = PLY["E"] / (2 * (1 + PLY["nu"])) * 2 * exz
    avg = (sxx + szz) / 2; rad = np.sqrt(((sxx - szz) / 2) ** 2 + sxz ** 2)
    s1, s2 = avg + rad, avg - rad
    vm = np.sqrt(s1 ** 2 - s1 * s2 + s2 ** 2)
    # ignore the 2 mm next to boundary corners singularities? -> report element-mean values (smooths the r3 fillets)
    s1e, s2e, vme = s1.mean(axis=1), s2.mean(axis=1), vm.mean(axis=1)
    cent = m.p[:, m.t].mean(axis=1)
    disp = u[ib.nodal_dofs].reshape(2, -1) if False else None
    umax = np.abs(u).max()
    # reactions
    R = K @ u - f
    return dict(mesh=m, s1=s1e, s2=s2e, vm=vme, cent=cent, umax=umax,
                tmax=float(s1e.max()), cmax=float(-s2e.min()), at_t=cent[:, s1e.argmax()].tolist(),
                at_c=cent[:, s2e.argmin()].tolist(), nel=m.t.shape[1])


rib = dwg.part("R2-R5")["poly"]
b1, b2, b3, b4 = B["B1"], B["B2"], B["B3"], B["B4"]


NR = getattr(dwg, "NOTCH_R", 3)


def rib_loads(Vf, Vb, H, back):
    # contact faces only (flat part of the notch floor / wall, clear of the corner fillets and the mouth)
    L = [((b3[0] + NR, b3[2] - 1, b3[1] - 1, b3[2] + 1), 0, -Vf),       # front rail on notch floor
         ((b4[0] + NR, b4[2] - 1, b4[1] - NR, b4[2] + 1), 0, -Vb),      # back rail on notch floor
         ((b3[0] - 3.5, b3[2] + NR, b3[0] + 0.5, b3[3] - NR), -H, 0),   # webbing pulls front rail rearward
         ((b4[1] - 0.5, b4[2] + NR, b4[1] + 3.5, b4[3] - NR), H, 0)]    # and back rail forward
    if back:
        L.append(((dwg.POST_T - 5, 560, dwg.POST_B + 5, 700), -back, 0))  # back load on post front edge
    return L


SUP = [((b1[0] + NR, b1[3] - 1, b1[1] - NR, b1[3] + 1), "v"),
       ((b2[0] + NR, b2[3] - 1, b2[1] - NR, b2[3] + 1), "v"),
       ((b2[0] - 3.5, b2[2], b2[0] + 0.5, b2[3] - NR), "u"),
       ((b2[1] - 0.5, b2[2], b2[1] + 3.5, b2[3] - NR), "u"),
       ((b1[0] - 3.5, b1[2], b1[0] + 0.5, b1[3] - NR), "u"),
       ((b1[1] - 0.5, b1[2], b1[1] + 3.5, b1[3] - NR), "u")]
Hrib = lambda Hr: Hr     # horizontal rib reaction from the rail strong-axis beam (rail_case)
fem_cases = []
for name, Vf, Vb, H, back, sf, case in [
    ("เบาะ 1300 + พนัก 560 N", max(RF_s.values()), max(RB_s.values()), Hrib(H_s), 0.7 * LOADS["back_static"], SF["static"], "EN seat+back static"),
    ("ขอบหน้าเบาะ 1300 N", max(RF_e.values()), max(RB_e.values()), Hrib(H_s), 0, SF["static"], "EN front edge"),
    ("คนทิ้งตัว 2000 N + พิง 400 N", max(RF_u.values()), max(RB_u.values()), Hrib(H_u), 0.7 * LOADS["person_back"], SF["use"], "ใช้งานจริง"),
]:
    r = rib_fem(rib, rib_loads(Vf, Vb, H, back), SUP, name)
    fem_cases.append((r, Vf, Vb, H, back))
    check("T3", f"ซี่โครง R2-R5 ({T_RIB:.0f} มม.) แรงดึงสูงสุด · {name}", r["tmax"], PLY["ft"] / sf, "MPa", case,
          f"ที่ y{r['at_t'][0]:.0f} z{r['at_t'][1]:.0f}")
    check("T3", f"ซี่โครง R2-R5 ({T_RIB:.0f} มม.) แรงอัด/กดสูงสุด · {name}", r["cmax"], PLY["fc"] / sf, "MPa", case,
          f"ที่ y{r['at_c'][0]:.0f} z{r['at_c'][1]:.0f}")

# ================================================================ T4 longitudinal spans (front / back lines)
# rib vertical loads -> split to front/back lines by lever rule between B1 and B2 centres
yB1, yB2 = (b1[0] + b1[1]) / 2, (b2[0] + b2[1]) / 2


def split(Vf, Vb, back):
    yf, yb = (b3[0] + b3[1]) / 2, (b4[0] + b4[1]) / 2
    tot_f = (Vf * (yf - yB2) + Vb * (yb - yB2)) / (yB1 - yB2)
    tot = Vf + Vb
    mom_back = back * (650 - 89) / (yB1 - yB2) if back else 0      # back push overturns rib: front line lifts, back line loaded
    return tot_f - mom_back, tot - tot_f + mom_back


def section(line):
    """EI and section modulus of the front / back longitudinal line."""
    if DESIGN["skin_box"]:
        # closed box: bottom band + top member, joined by the bending ply skin wrapped and lapped under the bottom band
        if line == "front":
            fl = [(100 * T, (b1[2] + b1[3]) / 2), (100 * T, (b3[2] + b3[3]) / 2)]
            web_t, web_h = 4.0 * DESIGN.get("sk1_layers", 1), b3[3] - b1[2]
        else:
            b5 = B["B5"]
            fl = [(100 * T, (b2[2] + b2[3]) / 2), ((b5[1] - b5[0]) * T, (b5[2] + b5[3]) / 2)]
            web_t, web_h = 8.0, b5[3] - b2[2]
        A = sum(a for a, _ in fl) + web_t * web_h
        zc = (sum(a * z for a, z in fl) + web_t * web_h * (fl[0][1] + web_h / 2)) / A
        I = sum(a * (z - zc) ** 2 + 100 * T ** 3 / 12 for a, z in fl) + web_t * web_h ** 3 / 12 + web_t * web_h * (fl[0][1] + web_h / 2 - zc) ** 2
        c = max(abs(z - zc) for _, z in fl) + T / 2
        return PLY["E"] * I, I / c, I, dict(A=A, zc=zc)
    # REV A: bands act flat (skin not tied to the bottom band, so no box)
    I = 2 * I_weak
    return PLY["E"] * I, 2 * W_weak, I, {}


def lines_case(people, back_each):
    """people: list of (x, P). returns per line max stress and leg reactions."""
    ribF = {x: 0.0 for x in RIB_X}; ribB = {x: 0.0 for x in RIB_X}
    for xc, P in people:
        q = pad_to_strips(P, xc)
        lf, lb = [], []
        for x, Q in zip(SX, q):
            if Q <= 0: continue
            w = webbing(Q, 0.5); lf.append((x, w["Vf"])); lb.append((x, w["Vb"]))
        bf = beam(SX, PLY["E"] * I_weak, RIB_X, lf); bb = beam(SX, PLY["E"] * I_weak, RIB_X, lb)
        near = min(RIB_X, key=lambda r: abs(r - xc))
        for x in RIB_X:
            f_, b_ = split(bf["R"][x], bb["R"][x], back_each * 0.7 if x == near else 0)
            ribF[x] += f_; ribB[x] += b_
    supports = sorted(set([x for x in DESIGN["legs_x"]] + [RIB_X[-1]]))
    out = {}
    for line, rib_loads_ in (("front", ribF), ("back", ribB)):
        EI, W, I, _ = section(line)
        res = beam(RIB_X, EI, supports, [(x, P) for x, P in rib_loads_.items()])
        out[line] = dict(sig=res["Mmax"] / W, w=res["wmax"], R=res["R"], I=I, V=res["Vmax"])
    return out


cases_T4 = [
    ("เบาะ 1300 N ที่ปลายซ้าย", [(80, LOADS["seat_static"])], LOADS["back_static"], SF["static"], "EN seat static"),
    ("เบาะ 1300 N กลางช่วงขา", [((DESIGN["legs_x"][0] + DESIGN["legs_x"][1]) / 2, LOADS["seat_static"])], LOADS["back_static"], SF["static"], "EN seat static"),
    ("3 คนทิ้งตัวนั่งพร้อมกัน", [(260, 2000), (700, 2000), (1140, 2000)], LOADS["person_back"], SF["use"], "ใช้งานจริง"),
]
leg_R = 0
for name, people, back, sf, case in cases_T4:
    o = lines_case(people, back)
    for line in ("front", "back"):
        check("T4", f"คานยาว{'หน้า' if line == 'front' else 'หลัง'} ดัด · {name}", o[line]["sig"], PLY["fm"] / sf, "MPa", case,
              f"แอ่น {o[line]['w']:.1f} มม.")
        leg_R = max(leg_R, max(abs(v) for k, v in o[line]["R"].items() if k in DESIGN["legs_x"]))

# skin glue (REV B box only): shear flow at bottom lap and top edge
if DESIGN["skin_box"]:
    o = lines_case([(260, 2000), (700, 2000), (1140, 2000)], LOADS["person_back"])
    EI, W, I, extra = section("front")
    Vmax = o["front"]["V"]
    Q = 100 * T * abs((b1[2] + b1[3]) / 2 - extra["zc"])
    q = Vmax * Q / I
    check("T4g", "กาวไม้อัดดัดหน้าทับใต้คาน B1 (lap 80 มม.)", q / 80, GLUE_FACE / SF["use"], "MPa", "ใช้งานจริง")
    check("T4g", "กาวไม้อัดดัดหน้ากับขอบคาน B3 (18 มม.)", q / 18, GLUE_EDGE / SF["use"], "MPa", "ใช้งานจริง")
    tw = 4 * DESIGN.get("sk1_layers", 1)
    check("T4w", f"ไม้อัดดัดหน้า {tw} มม. รับแรงเฉือน", Vmax / (tw * (b3[3] - b1[2])), FLEX["fv"] / SF["use"], "MPa", "ใช้งานจริง")

# ================================================================ T5 legs
# local bending of the bottom band (+pad) between ribs where the leg sits
for lx in DESIGN["legs_x"]:
    left = max(x for x in RIB_X if x <= lx) if any(x <= lx for x in RIB_X) else None
    right = min(x for x in RIB_X if x >= lx)
    if left == right or abs(lx - right) < 12 or (left is not None and abs(lx - left) < 12):
        check("T5c", f"ขา x{lx} ชนซี่โครง", 1, 0.0001, "", "เรขาคณิต", "สลักขาโดนซี่โครง ประกอบไม่ได้")
        continue
    a, bb_ = lx - left, right - lx
    Lb = right - left
    M = leg_R * a * bb_ / Lb
    t_eff = 2 * T if DESIGN["leg_pad"] == "full-bay" else T            # small 90 pad does not span to the ribs
    Wb = 100 * t_eff ** 2 / 6
    check("T5a", f"คานล่างใต้ขา x{lx} ดัด (แรงขา {leg_R:.0f} N)", M / Wb, PLY["fm"] / SF["use"], "MPa", "ใช้งานจริง",
          "แผ่นรองยาวเต็มช่อง 36 มม." if t_eff > T else "แผ่นรอง 90×90 ไม่ถึงซี่โครง = คานบาง 18 มม.")
# leg sideways / forward static: prying on T-nut flange
Mleg = LOADS["leg_fwd"] * dwg.LEG_H
Tbolt = Mleg / (0.7 * 25) + leg_R * 0
dw = DESIGN["washer"]
check("T5b", f"T-nut M8 กดเนื้อไม้ (ขาโดนดันข้าง 500 N) · ปีก/แหวน Ø{dw}", Tbolt / (math.pi / 4 * (dw ** 2 - 9 ** 2)), PLY["fc90"] / SF["static"], "MPa", "EN leg forward")

# ================================================================ T6 arm box
h_ap = 449 - 89
Mside = LOADS["arm_side"] * (480 - 80)
Ttop = Mside / h_ap + LOADS["arm_side"] / 2
tab_area = 2 * 2 * (60 + T) * T        # 2 tabs, 4 faces each ~ (2 faces long + 2 short) x depth 18
check("T6a", "เดือย AP1 ในแผงแขน A1 (ดันแขนออกข้าง 400 N)", Ttop / tab_area, GLUE_EDGE / SF["static"], "MPa", "EN arm sideways")
# arm down 750 N on top of A1 -> AP2 plate with leg at middle
Map2 = 750 * 152 / 4
check("T6b", "แผ่นล่างกล่องแขน AP2 ดัด (กดแขน 750 N)", Map2 / (430 * T ** 2 / 6), PLY["fm"] / SF["static"], "MPa", "EN arm down")

# ================================================================ T7 bolster
pill_c = dwg.PILL_C[1]
ap3_face = 470 + dwg.DA
lever = pill_c - ap3_face
Mp = LOADS["arm_down"] * lever
zb = sorted(dwg.AP3_BOLTS_Z)
Tb = Mp / (zb[1] - zb[0])
check("T7a", "น็อต M8 หมอนข้าง แรงดึง (นั่งบนหมอนข้าง 750 N)", Tb, 8000 / SF["static"], "N", "EN arm down")
check("T7b", "T-nut ในแกนหมอนข้าง กดเนื้อไม้", Tb / (math.pi / 4 * (22 ** 2 - 9 ** 2)), PLY["fc90"] / SF["static"], "MPa", "EN arm down")
spine_lever = pill_c - dwg.PILL_SPINE_Y[1]
if DESIGN["bolster_box"]:
    # top disc carried by rear AND front spines: plate bends in its plane only
    check("T7c", "แกนหมอนข้าง (กล่อง 2 แผ่นตั้ง) ดัด", 0.5 * LOADS["arm_down"] * spine_lever / (T * 80 ** 2 / 6), PLY["fm"] / SF["static"], "MPa", "EN arm down")
else:
    check("T7c", "แกน PL3 แผ่นเดียว ดัดแนวอ่อน (ฝาบนยื่นจาก PL3)", LOADS["arm_down"] * spine_lever / (80 * T ** 2 / 6), PLY["fm"] / SF["static"], "MPa", "EN arm down",
          "ฝาบนยึดด้วยเดือยเดียว รับโมเมนต์ไม่ได้")

# ================================================================ T8 stability
mass = 0.56 * sum(p["poly"].area * p["qty"] for p in dwg.PARTS) / 1e6 * 18 + 9 + 4 + 1.5    # ply + foam + fabric + legs (kg)
Wt = mass * 9.81
xg = 760.0; yg = 300.0
legs_front_y = dwg.LEG_Y[1]; legs_back_y = dwg.LEG_Y[0]
x_left = min(DESIGN["legs_x"])
# forward: 600 N at front edge centre -> tipping about front leg line
Mo = 600 * (dwg.SECTION_D - 60 - legs_front_y) + 20 * dwg.SEAT_H; Mr = Wt * (legs_front_y - yg)
check("T8a", "ล้มไปหน้า (600 N ห่างขอบหน้า 60 มม. + ดัน 20 N)", Mo, Mr, "N·mm", "EN 1022 แนวทาง", f"น้ำหนักโซฟา ~{mass:.0f} กก.")
Mo2 = 750 * (dwg.SECTION_D - 100 - legs_front_y)
check("T8d", "ล้มไปหน้า (คน 100 กก. นั่งริมขอบหน้า น้ำหนักบนเบาะ 75%)", Mo2, Mr, "N·mm", "ใช้งานจริง",
      "จุดนั่ง 100 มม. จากขอบหน้า · อีก 25% ลงที่เท้า")
# rearward: 600 N on seat + 300 N push at top of back
Mo = 300 * (dwg.H - 80) - 600 * (400 - legs_back_y); Mr = Wt * (yg - legs_back_y)
check("T8b", "ล้มไปหลัง (พิงพนักบน 300 N)", max(Mo, 0), Mr, "N·mm", "EN 1022 แนวทาง")
# sideways at left end: 600 N sitting on left end x=60, legs at x_left
Mo = 600 * max(x_left - 60, 0); Mr = Wt * (xg - x_left)
check("T8c", "ล้มไปข้างซ้าย (นั่งปลายซ้ายสุด 600 N)", Mo, Mr, "N·mm", "EN 1022 แนวทาง")

res = dict(rev=REV, design=DESIGN, materials=dict(ply=PLY, flex=FLEX, web=WEB), loads=LOADS, sf=SF,
           webbing=dict(static=wb, use=wu), results=results,
           fem=[dict(label=r["label"], nel=r["nel"], tmax=r["tmax"], cmax=r["cmax"], umax=r["umax"], Vf=Vf, Vb=Vb, H=H, back=bk, hist=r["hist"])
                for r, Vf, Vb, H, bk in fem_cases])
if OUTJ:
    json.dump(res, open(OUTJ, "w"), ensure_ascii=False, indent=1, default=float)
    # stress plots
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.tri as mtri
    for k, (r, *_x) in enumerate(fem_cases):
        fig, ax = plt.subplots(figsize=(5.2, 5.4), dpi=170)
        m = r["mesh"]
        tr = mtri.Triangulation(m.p[0], m.p[1], m.t.T)
        val = np.where(r["s1"] > -r["s2"], r["s1"], r["s2"])
        lim = max(abs(val).max(), 1)
        tp = ax.tripcolor(tr, facecolors=val, cmap="RdBu_r", vmin=-lim, vmax=lim, edgecolors="none")
        ax.set_aspect("equal"); ax.axis("off")
        cb = fig.colorbar(tp, ax=ax, shrink=0.6); cb.set_label("MPa  (+ tension / - compression)")
        fig.savefig(OUTJ.replace(".json", f"-fem{k + 1}.png"), bbox_inches="tight", transparent=False)
        plt.close(fig)
fails = [r for r in results if not r["ok"]]
print(f"REV {REV}: {len(results)} checks, {len(fails)} fail")
for r in results:
    print(("PASS " if r["ok"] else "FAIL ") + f"{r['code']:4} {r['name'][:60]:60} {r['value']:>10} / {r['limit']:<9} {r['unit']:5} {r['note']}")

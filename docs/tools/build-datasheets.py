# -*- coding: utf-8 -*-
"""ทำความสะอาดคำอธิบายสินค้าจาก chawcher.com แล้วเขียนเป็น descriptions.ts

   ★ ไฟล์นี้ไม่สร้างรหัสสินค้าแล้ว
     เคยสร้างทั้งรหัสและโมดูลที่นี่ ขณะที่แอปก็สร้างเองอีกชุดใน
     web/src/modules/datasheet/build.ts · สองชุดเพี้ยนจากกันไปแล้วหนึ่งรอบ
     (ชุดโต๊ะอาหารนางนวล/กระสา ได้รหัสคนละแบบ)
     ตอนนี้รหัสมีที่มาเดียวคือ build.ts · ส่งออกด้วย
     cd web && node --experimental-strip-types scripts/datasheet-export.mts

   รัน: python3 docs/tools/build-datasheets.py
   ต้องมี docs/source/web-specs.json (ดึงจาก chawcher.com/wp-json/wp/v2/product)
"""
import csv, io, json, re, sys, collections

import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCR  = os.environ.get('WEB_SPECS_DIR', os.path.join(ROOT, 'docs', 'source'))

# ---------------------------------------------------------------------------
# ทำความสะอาดคำอธิบายจากเว็บ
#   เว็บเขียนปนกันหมด: บรรทัดขนาด หัวข้อตัวพิมพ์ใหญ่ เครื่องหมาย ** ของ markdown
#   และบางรุ่นมีสองหน้าสินค้าที่เนื้อหาเกือบเหมือนกัน
# ---------------------------------------------------------------------------

def _is_noise(l):
    t = l.strip()
    if not t: return True
    if re.fullmatch(r"[\s(]*[\d.'’]+[\s)]*", t): return True
    if re.match(r"^[A-Z0-9().'’\s/-]*W\s*[\d.]+\s*([xX×]\s*)?D\s*[\d.]+", t): return True
    if re.match(r"^(KING|QUEEN|SIZE|[\d.]+\s*(ฟุต|'))[:\s]", t, re.I): return True
    if re.fullmatch(r"[A-Z0-9][A-Z0-9\s()'’.:/-]{1,26}", t): return True
    if re.fullmatch(r"(highlight|hilight|spec|specification)\s*:?", t, re.I): return True
    if re.match(r"^\*?\s*AVAILABLE\b", t, re.I): return True
    # "ขนาด: W510 x D550 x H790" แทรกกลางย่อหน้า ไม่ได้ขึ้นต้นบรรทัด
    if re.search(r"(ขนาด|SIZE)\s*[:：]\s*W\s*[\d.]+", t, re.I): return True
    return False

def clean_spec(spec):
    out = []
    for l in (spec or '').split('\n'):
        l = l.replace('**', '').strip()
        l = re.sub(r'^[–—-]\s*', '– ', l)
        if _is_noise(l): continue
        out.append(l)
    return '\n'.join(out).strip()

def dedupe(texts):
    """ข้อความหนึ่งกินความอีกอันอยู่แล้ว เก็บอันยาว ทิ้งอันสั้น"""
    uniq = []
    for t in sorted({t for t in texts if t}, key=len, reverse=True):
        key = re.sub(r'\s+', '', t)
        if any(key in re.sub(r'\s+', '', u) for u in uniq): continue
        uniq.append(t)
    return uniq

def _is_noise(l):
    t = l.strip()
    if not t: return True
    if re.fullmatch(r"[\s(]*[\d.'’]+[\s)]*", t): return True
    if re.match(r"^[A-Z0-9().'’\s/-]*W\s*[\d.]+\s*([xX×]\s*)?D\s*[\d.]+", t): return True
    if re.match(r"^(KING|QUEEN|SIZE|[\d.]+\s*(ฟุต|'))[:\s]", t, re.I): return True
    if re.fullmatch(r"[A-Z0-9][A-Z0-9\s()'’.:/-]{1,26}", t): return True
    if re.fullmatch(r"(highlight|hilight|spec|specification)\s*:?", t, re.I): return True
    if re.match(r"^\*?\s*AVAILABLE\b", t, re.I): return True
    # "ขนาด: W510 x D550 x H790" แทรกกลางย่อหน้า ไม่ได้ขึ้นต้นบรรทัด
    if re.search(r"(ขนาด|SIZE)\s*[:：]\s*W\s*[\d.]+", t, re.I): return True
    return False

def clean_spec(spec):
    out = []
    for l in (spec or '').split('\n'):
        l = l.replace('**', '').strip()
        l = re.sub(r'^[–—-]\s*', '– ', l)
        if _is_noise(l): continue
        out.append(l)
    return '\n'.join(out).strip()

def dedupe(texts):
    """ข้อความหนึ่งกินความอีกอันอยู่แล้ว เก็บอันยาว ทิ้งอันสั้น"""
    uniq = []
    for t in sorted({t for t in texts if t}, key=len, reverse=True):
        key = re.sub(r'\s+', '', t)
        if any(key in re.sub(r'\s+', '', u) for u in uniq): continue
        uniq.append(t)
    return uniq

def num(s):
    m = re.search(r'([\d.]+)', s or '')
    return float(m.group(1)) if m else None

def num2(s):
    """ใบราคาเขียนค่าที่สองไว้ในวงเล็บ · 'H72 (46)' = สูง 72 สูงที่นั่ง 46
       'D162 (90)' = ลึกสุด 162 ช่วงหลังลึก 90"""
    m = re.findall(r'([\d.]+)', s or '')
    return float(m[1]) if len(m) > 1 else None

rows = list(csv.DictReader(io.open(f'{ROOT}/docs/source/standard-price-2026-grid-view.csv',
                                   encoding='utf-8-sig')))
specs = json.load(io.open(os.path.join(SCR, 'web-specs.json'), encoding='utf-8'))
imap  = list(csv.DictReader(io.open(f'{ROOT}/docs/source/product-image-map.csv',
                                    encoding='utf-8-sig')))


rows = []   # ไม่ใช้แล้ว เก็บไว้ให้โครงเดิมอ่านง่าย
specs = json.load(io.open(os.path.join(SCR, 'web-specs.json'), encoding='utf-8'))
imap  = list(csv.DictReader(io.open(os.path.join(ROOT, 'docs', 'source', 'product-image-map.csv'),
                                    encoding='utf-8-sig')))

def slug_of(url):
    m = re.search(r'/product/([^/]+)', url or '')
    return m.group(1) if m else None

# ---------------------------------------------------------------------------
# เขียน web/src/modules/datasheet/descriptions.ts ให้แอปใช้
#   ข้อความเดียวกันอาจอยู่หลายหมวด · ยกให้หมวดที่มีสินค้ามากที่สุด เพราะนั่นคือเจ้าของเรื่อง
# ---------------------------------------------------------------------------
_by_coll = {}
for r in imap:
    sl = slug_of(r['หน้าสินค้า'])
    if not sl or sl not in specs: continue
    try: cnt = int(r['จำนวนตัวสินค้า'] or 0)
    except ValueError: cnt = 0
    _by_coll.setdefault(r['collection'], []).append((r['category'], sl, cnt))

_out = {}
for coll, items in _by_coll.items():
    texts = dedupe([clean_spec(specs[sl]['spec']) for _, sl, _ in items])
    owner = {}
    for t in texts:
        cands = [(cnt, cat) for cat, sl, cnt in items if clean_spec(specs[sl]['spec']) == t]
        if cands: owner[t] = max(cands)[1]
    for cat, sl, _ in items:
        t = clean_spec(specs[sl]['spec'])
        e = {'link': specs[sl]['link'], 'title': specs[sl]['title']}
        if t and owner.get(t) == cat: e['text'] = t
        _out[f'{coll}|{cat}'] = e

_ts = """/**
 * คำอธิบายและลิงก์หน้าสินค้า ดึงมาจาก chawcher.com ครั้งเดียว
 *
 * ทำไมเก็บเป็นไฟล์ ไม่ยิงเว็บสด
 *   ข้อความพวกนี้เปลี่ยนปีละครั้งสองครั้ง แต่หน้า data sheet เปิดทุกวัน
 *   ยิงสดแปลว่าเว็บล่มเมื่อไหร่ หน้านี้พังตาม และช้าลงโดยไม่ได้อะไรเพิ่ม
 *
 * ข้อความผ่านการตัดบรรทัดขนาด หัวข้อตัวพิมพ์ใหญ่ และเครื่องหมาย ** ของ markdown ออกแล้ว
 * รุ่นที่มีหลายหน้าสินค้าแต่เนื้อหาซ้ำกัน เก็บไว้ที่หมวดที่มีสินค้ามากที่สุดหมวดเดียว
 *
 * key คือ "ชื่อคอลเลกชัน|ชื่อหมวด" ตรงกับที่ใบราคาใช้
 * ไม่มี text = เว็บมีแต่บรรทัดขนาด ยังไม่มีข้อความขายของ
 *
 * ★ ไฟล์นี้สร้างด้วย docs/tools/build-datasheets.py อย่าแก้ด้วยมือ
 */
export type WebSpec = { link: string; title: string; text?: string };

export const WEB_SPECS: Record<string, WebSpec> = """ + json.dumps(_out, ensure_ascii=False, indent=2) + """;

export function webSpecOf(collection: string, category: string): WebSpec | undefined {
  return WEB_SPECS[`${collection}|${category}`];
}
"""
_dst = os.path.join(ROOT, 'web', 'src', 'modules', 'datasheet', 'descriptions.ts')
io.open(_dst, 'w', encoding='utf-8').write(_ts)
print('descriptions.ts · คีย์', len(_out), '· มีคำอธิบาย', sum(1 for v in _out.values() if 'text' in v))

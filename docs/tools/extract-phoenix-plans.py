# -*- coding: utf-8 -*-
"""ดึงรูปด้านหน้าและผังด้านบนของแต่ละรหัส ออกจาก Phoenix data sheet

   ต้นฉบับ: Phoenix data sheet.pdf ในไดรฟ์บริษัท
            id 1aGCPlo6Jl343MlrqG0YKvWxhUpOga8kH
   ผลลัพธ์: web/public/plans/phoenix/*.png + docs/source/phoenix-plans.json

   รัน:  pdftotext -bbox phoenix.pdf -  แล้วเก็บเป็น words.json ก่อน
         จากนั้น python3 docs/tools/extract-phoenix-plans.py

   วิธี: ใช้ตัวเลขบอกความกว้างใต้รูปด้านหน้าเป็นหมุด (มีทุกบล็อก)
   แล้วคำนวณกรอบจากมาตราส่วนของแบบ ซึ่งวัดได้จากหน้า 3
     รูปกว้าง 349 px ที่ 300 dpi = สินค้ากว้าง 1900 มม.
   เสร็จแล้ว trim ขอบขาวออก
"""
import json, io, re, subprocess, os

DPI = 300
S   = DPI / 72.0
MM  = 349 / 1900 / S        # pt ต่อ 1 มม. ของสินค้าจริง
res = json.load(io.open('words.json', encoding='utf-8'))

def size_of(code):
    """ความกว้าง × ความลึก ของสินค้าจริง หน่วยมิลลิเมตร อ่านจากรหัส"""
    m = re.match(r'^PHX-C[LR](\d+)X(\d+)$', code)
    if m: return int(m.group(1)) * 10, int(m.group(2)) * 10
    m = re.match(r'^PHX(\d{3})', code)
    if m:
        w = int(m.group(1)) * 10
        return w, 960
    if code == 'PHX-STOOL':    return 1250, 910
    if code == 'PHX-HEADREST': return 620, 210   # ใบราคา: W62 D21 ซม.
    return 1500, 960

def run(*a):
    r = subprocess.run(a, capture_output=True, text=True)
    if r.returncode: print('!!', a[0], r.stderr[:160])
    return r

def crop(page, x, y, w, h, dst):
    tmp = '/tmp/_c'
    run('pdftoppm', '-r', str(DPI), '-png', '-f', str(page), '-l', str(page),
        '-x', str(int(x*S)), '-y', str(int(y*S)), '-W', str(int(w*S)), '-H', str(int(h*S)),
        'phoenix.pdf', tmp)
    src = f'{tmp}-{page:02d}.png'
    if not os.path.exists(src): src = f'{tmp}-{page}.png'
    run('convert', src, '-fuzz', '4%', '-trim', '+repage', dst)
    try: os.remove(src)
    except OSError: pass
    s = subprocess.run(['identify','-format','%w %h',dst],capture_output=True,text=True).stdout.split()
    return (int(s[0]), int(s[1])) if len(s)==2 else None

out = {}
for p in res:
    page = p['page']
    sk = [w for w in p['words'] if re.match(r'^PHX[\w-]+$', w[4])]
    if not sk: continue
    for x0, y0, x1, y1, code in sk:
        wmm, dmm = size_of(code)
        col = [w for w in p['words']
               if x0 - 6 <= w[0] <= x0 + 250 and y0 + 20 < w[1] < y0 + 100
               and re.fullmatch(r'\d{3,4}', w[4])]
        if not col:
            print('!! ไม่เจอเลขบอกขนาดของ', code); continue
        anchor = max(w[3] for w in col)          # ขอบล่างของเส้นบอกขนาดอันล่างสุด
        top    = anchor + 8
        ph, pw = dmm * MM + 16, wmm * MM + 22
        out[code] = {'page': page,
                     'plan':  crop(page, x0 - 4, top, pw, ph, f'plans/{code}.png'),
                     'front': crop(page, x0 - 4, y0 + 14, pw, anchor - y0 - 24, f'fronts/{code}.png'),
                     'mm': [wmm, dmm]}
io.open('plans/index.json','w',encoding='utf-8').write(json.dumps(out,ensure_ascii=False,indent=1))
print('ดึงได้', len(out), 'รหัส')
bad=[c for c,v in out.items() if not v['plan'] or not v['front']]
print('มีปัญหา', bad)
# ตรวจว่าความกว้างรูปสัมพันธ์กับความกว้างจริง
for c,v in sorted(out.items())[:6]:
    w,d = v['mm']; pw,ph = v['plan']
    print(f"  {c:16} จริง {w}×{d} มม. · ผัง {pw}×{ph} px · px/มม. {pw/w:.4f} กับ {ph/d:.4f}")

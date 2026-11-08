# -*- coding: utf-8 -*-
"""สร้าง data sheet ทุกคอลเลกชัน จากใบราคา 2569 + สเปคบนเว็บ chawcher.com
   รูปแบบตาม Phoenix/koontong data sheet ของโรงงาน: คำอธิบาย + สเปคโครงสร้าง + ตารางโมดูล
   ไม่ใส่ราคา เพราะ data sheet โรงงานไม่ใส่ และราคาเปลี่ยนบ่อยกว่าขนาด"""
import csv, io, json, re, sys, collections

ROOT = '/home/user/Chawcheros'
SCR  = '/tmp/claude-0/-home-user-Chawcheros/8dfb96be-79b3-5c16-b64e-d08642b109ad/scratchpad'

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
specs = json.load(io.open(f'{SCR}/web/specs.json', encoding='utf-8'))
imap  = list(csv.DictReader(io.open(f'{ROOT}/docs/source/product-image-map.csv',
                                    encoding='utf-8-sig')))

# ── เว็บ: slug -> สเปค · และ collection+category -> slug ──
def slug_of(url): 
    m = re.search(r'/product/([^/]+)', url or ''); return m.group(1) if m else None
web = {}
for r in imap:
    s = slug_of(r['หน้าสินค้า'])
    if s and s in specs:
        web[(r['collection'], r['category'])] = dict(specs[s], image=r['image_url'])

# ── ชื่ออังกฤษของคอลเลกชัน ──
def en_name(rs):
    """ชื่ออังกฤษของคอลเลกชัน = คำขึ้นต้นที่ชื่อสินค้าทุกชิ้นใช้ร่วมกัน
       'Nang Aaen Armchair' + 'Nang Aaen Bed' -> 'Nang Aaen'"""
    names = [re.sub(r'[()]', '', r['Product name english']).strip().split()
             for r in rs if r['Product name english'].strip()]
    if not names: return ''
    if len(names) == 1: return ' '.join(names[0])
    pre = []
    for i in range(min(len(n) for n in names)):
        w = names[0][i]
        if all(n[i].lower() == w.lower() for n in names): pre.append(w)
        else: break
    if pre: return ' '.join(pre)
    return collections.Counter(n[0] for n in names).most_common(1)[0][0]

# ── รหัสสินค้า · PHX กับ KT มาจาก data sheet จริง ที่เหลือเป็นรหัสที่เสนอ ──
REAL = {'ฟีนิกซ์':'PHX', 'ขุนทอง':'KT'}
MANUAL = {'ทากะ':'TK','สวอน':'SW','อีมู':'EMU','พัฟฟิน':'PF','นางแอ่น':'NA','อัญชัน':'AC',
          'นกแก้ว':'NK','กระเรียน':'KR','โอมุ':'OM','อินทรี':'IS','กระสา':'KS','ขมิ้น':'KM',
          'นางนวล':'NN','ฮูก':'HK','นางนวล / กระสา':'NNKS','ฟลามิงโก้':'FL','กระทา':'KTA',
          'กีวี่':'KW','ขอนไม้':'KN','นกยูง':'NY','กางเขน':'KK','มินิเนส':'MN','เบิร์ด':'BD',
          'เนส':'NS','โอบ':'OB','กระตั้ว':'KTU','กีวี่ โซฟา':'KWS','ฟลามิงโก':'FLS',
          'ดิน':'DN','ชิน':'CH','ฌ เฌอ':'CC'}

CAT_SUFFIX = {'โซฟา':'', 'สตูล':'-ST', 'อาร์มแชร์':'-AC', 'เลาจ์แชร์':'-LC', 'โคซี่แชร์':'-CZ',
              'เก้าอี้':'-CH', 'เตียง':'-BED', 'ที่พักหัว':'-HR', 'หมอน':'-PL',
              'โต๊ะกลาง':'-CT', 'โต๊ะข้าง':'-SDT', 'โต๊ะข้างเตียง':'-NT', 'โต๊ะทานข้าว':'-DT',
              'ม้านั่ง':'-BN', 'ตู้เก็บของ':'-SB', 'ชั้นวางทีวี':'-TV',
              'ชั้นวางหนังสือ':'-BS', 'Recliner':'-RC', 'ศาลเจ้า (ตี่จู่เอี๊ยะ)':'-SH',
              '1 ที่นั่ง 1 แขน':'-1R', '1 ที่นั่ง ไม่มีแขน':'-1NA', '3 ที่นั่ง ไม่มีแขน':'-3NA'}

MM = lambda v: str(int(round(v * 10))) if v else ''

def code_for(coll, pre, cat, sub, w, d):
    """ฟีนิกซ์กับขุนทองใช้รหัสจริงจาก data sheet โรงงาน · ที่เหลือเป็นรหัสที่เสนอ"""
    if coll == 'ฟีนิกซ์':
        m = re.match(r'3S \((\d+)\)', sub)
        if m: return f'PHX{int(m.group(1))*10}-2AR'
        m = re.match(r'3RT \((\d+)\)', sub)
        if m: return f'PHX{(int(m.group(1))+40)*10}RA-T'
        m = re.match(r'(\d+) cm with Table', sub)
        if m: return f'PHX{(int(m.group(1))+40)*10}RA-T'
        m = re.match(r'DAYBED-R/L \((\d+)\)', sub)
        if m: return f'PHX{int(m.group(1))*10}R'
        if cat == 'โซฟา' and sub in ('เดย์เบด', 'CL (125*166)'):
            return f'PHX-CR{int(w)}X{int(d)}'
        if cat == 'สตูล':      return 'PHX-STOOL-' + ('M' if (w or 0) > 110 else 'S')
        if cat == 'ที่พักหัว':  return 'PHX-HEADREST' + ('-2' if (d or 0) < 20 else '')
        if cat == 'หมอน':      return f'PHX-CUSHION-{int(w)}'
    if coll == 'ขุนทอง':
        if cat == 'โซฟา' and sub in ('2 ที่นั่ง', '3 ที่นั่ง'): return f'KT{int(w)*10}'
        if cat == 'โซฟา' and sub == 'เดย์เบด':  return f'KTC{int(w)}X{int(d)}'
        if cat == 'สตูล':                      return 'KT-STOOL'
    code = pre + MM(w) + CAT_SUFFIX.get(cat, '-' + cat[:2])
    tag = SUB_TAG.get(sub.strip(), None)
    if tag is None:
        tag = re.sub(r'[^A-Za-z0-9]', '', (sub or '').upper())[:6]
    if tag: code += '-' + tag
    return code

def uniq(code, used, h=None):
    """ชนกันเมื่อไหร่ ให้ต่อท้ายด้วยความสูง เพราะที่ชนกันจริง ๆ คือรุ่นหัวเตียงสูง/เตี้ย"""
    if code not in used: used.add(code); return code
    if h and f'{code}-H{int(h)}' not in used:
        used.add(f'{code}-H{int(h)}'); return f'{code}-H{int(h)}'
    i = 2
    while f'{code}-{i}' in used: i += 1
    used.add(f'{code}-{i}'); return f'{code}-{i}'

SUB_TAG = {
  '2 ที่นั่ง':'2S', '3 ที่นั่ง':'3S', '1 ที่นั่ง':'1S', 'เดย์เบด':'DB', 'L-shape':'L',
  'Size S':'S', 'Size M':'M', 'Size L':'L', 'Size XL':'XL',
  '3.5 ฟุต':'35F', '5 ฟุต':'5F', '6 ฟุต':'6F', '3 ฟุต':'3F',
  'พนักสูง':'HB', 'พนักเตี้ย':'LB', 'ม้านั่ง':'BN', '':'',
  '5 ฟุต (เฉพาะฐานเตียง)':'5F-BASE', '6 ฟุต (เฉพาะฐานเตียง)':'6F-BASE',
  '3.5 ฟุต (เฉพาะฐานเตียง)':'35F-BASE',
}

by = collections.OrderedDict()
for r in rows: by.setdefault(r['Collection Name'].strip(), []).append(r)

sheets = []
for coll, rs in sorted(by.items(), key=lambda kv: -len(kv[1])):
    pre = REAL.get(coll) or MANUAL.get(coll) or 'XX'
    cats = collections.OrderedDict()
    for r in rs:
        cats.setdefault(r['Category'].strip(), []).append(r)

    groups = []
    for cat, crs in cats.items():
        mods = collections.OrderedDict()
        for r in crs:
            w, d, h = num(r['กว้าง (W)']), num(r['ลึก (D)']), num(r['สูง (H)'])
            sub = r['Sub Category 1'].strip()
            key = (sub, w, d, h)
            e = mods.setdefault(key, {'sub':sub, 'w':w, 'd':d, 'h':h,
                                      'd2':num2(r['ลึก (D)']), 'h2':num2(r['สูง (H)']),
                                      'mats':[], 'wood':[], 'colour':[]})
            cl = r['Wood Colour (สีไม้)'].strip()
            if cl and cl not in e['colour']: e['colour'].append(cl)
            m = r['วัสดุหุ้ม (Upholstery Material)'].strip()
            if m and m not in e['mats']: e['mats'].append(m)
            wd = r['Wood (ประเภทไม้)'].strip()
            if wd and wd not in e['wood']: e['wood'].append(wd)
        out = []
        used = set()
        for (sub, w, d, h), e in mods.items():
            e['code'] = uniq(code_for(coll, pre, cat, sub, w, d), used, h)
            out.append(e)
        groups.append({'cat':cat, 'mods':out, 'web':web.get((coll, cat))})

    sheets.append({'th':coll, 'en':en_name(rs), 'prefix':pre,
                   'code_real': coll in REAL, 'rows':len(rs), 'groups':groups})

io.open(f'{SCR}/gen/sheets.json','w',encoding='utf-8').write(
    json.dumps(sheets, ensure_ascii=False, indent=1))
print('คอลเลกชัน', len(sheets))
print('มีสเปคจากเว็บ', sum(1 for s in sheets for g in s['groups'] if g['web']),
      'จาก', sum(len(s['groups']) for s in sheets), 'หมวด')
codes = [m['code'] for s in sheets for g in s['groups'] for m in g['mods']]
dup = [c for c,n in collections.Counter(codes).items() if n > 1]
print('โมดูลรวม', len(codes), '· รหัสซ้ำ', len(dup), dup[:8])

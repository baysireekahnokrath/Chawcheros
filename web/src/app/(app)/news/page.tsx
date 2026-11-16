import { createClient } from '@/lib/supabase/server';
import { getMyCapabilities } from '@/modules/registry';
import { addNews, importNow, publishNews, saveNews, sendLine, setNewsStatus } from '@/modules/news/actions';
import { editUrl, previewUrl, wpConfig, type NewsImage } from '@/modules/news/wp';
import { lineSecrets } from '@/modules/line-agent/line';
import { NEWS_SHEET_URL } from '@/modules/news/sheet';
import ImageForm from '@/components/news/ImageForm';

export const metadata = { title: 'ข่าว Chaw Cher · Chaw Cher OS' };

type Item = {
  id: string; brand: 'Chaw Cher' | 'ASE'; source: string; source_url: string | null; source_title: string | null;
  source_date: string | null; note: string | null; post_title: string; post_body: string; line_text: string;
  images: NewsImage[]; status: 'ร่าง' | 'เผยแพร่แล้ว' | 'ไม่ใช้'; wp_post_id: number | null; wp_link: string | null;
  published_at: string | null; line_sent_at: string | null; line_sent_to: { name: string | null; at: string }[]; created_at: string;
};
type Run = { run_by: string; created_at: string; rows_read: number; created: number; skipped_dupes: number; error: string | null };

const TABS = [['draft', 'ร่างรอตรวจ', 'ร่าง'], ['pub', 'เผยแพร่แล้ว', 'เผยแพร่แล้ว'], ['off', 'ไม่ใช้', 'ไม่ใช้']] as const;
const card = 'rounded-2xl border border-border bg-surface p-4';
const input = 'w-full rounded-lg border border-border bg-bg p-2 text-sm';
const btn = 'rounded-xl border border-border px-3 py-1.5 text-sm';
const btnMain = 'rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg';
const pill = (tone: 'ok' | 'warn' | 'bad' | 'mute') =>
  'rounded-lg px-2 py-0.5 text-xs ' +
  (tone === 'ok' ? 'bg-ok/15 text-ok' : tone === 'warn' ? 'bg-warn/15 text-warn' : tone === 'bad' ? 'bg-danger/15 text-danger' : 'bg-border text-muted');
const when = (iso: string) =>
  new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export default async function NewsPage({ searchParams }: PageProps<'/news'>) {
  const caps = await getMyCapabilities();
  if (!caps.has('admin')) return <p className={card + ' text-sm text-muted'}>หน้านี้สำหรับ Bay เท่านั้น</p>;

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tab = TABS.find(([k]) => k === one(sp.tab)) ?? TABS[0];
  const ok = one(sp.ok); const err = one(sp.err);

  const supabase = await createClient();
  const db = supabase.schema('content');
  const [{ data }, counts, runs, rooms] = await Promise.all([
    db.from('news_items').select('*').eq('status', tab[2]).order('created_at', { ascending: false }).limit(60),
    Promise.all(TABS.map(([, , st]) => db.from('news_items').select('id', { count: 'exact', head: true }).eq('status', st))),
    db.from('news_runs').select('*').order('created_at', { ascending: false }).limit(1),
    supabase.schema('line_agent').from('rooms').select('id, name').eq('status', 'อนุมัติ').order('name'),
  ]);
  const items = (data ?? []) as Item[];
  const n = counts.map((c) => c.count ?? 0);
  const runList = (runs.data ?? []) as Run[];
  const last = runList[0];
  const roomList = (rooms.data ?? []) as { id: string; name: string | null }[];
  const wpReady = !!wpConfig();
  const lineReady = !!lineSecrets();

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">ข่าว Chaw Cher · ASE</h1>
      <p className="mt-1 text-sm text-muted">
        ข่าวเข้าชีต <a className="underline" href={NEWS_SHEET_URL} target="_blank" rel="noreferrer">Chaw Cher News ↗</a> (Google News + ที่ทีมใส่) ·
        08:00 Claude ร่างลงแท็บ &quot;ร่าง&quot; · 09:00 ระบบดึงมาที่นี่ (ข่าวซ้ำไม่เอา) ·
        ตรวจ → Preview → เผยแพร่ หรือส่ง LINE · ไม่มีอะไรออกไปข้างนอกถ้า Bay ไม่กด · ไม่มีค่า API
      </p>

      {ok && <p className={pill('ok') + ' mt-3 block !rounded-xl !px-3 !py-2 text-sm'}>{ok}</p>}
      {err && <p className={pill('bad') + ' mt-3 block !rounded-xl !px-3 !py-2 text-sm'}>{err}</p>}
      {(!wpReady || !lineReady) && (
        <p className={pill('warn') + ' mt-3 block !rounded-xl !px-3 !py-2 text-sm'}>
          ยังตั้งค่าไม่ครบ: {!wpReady && 'WP_USER / WP_APP_PASSWORD (ขึ้นเว็บ + เก็บรูป) '}{!lineReady && 'LINE token'} · ขั้นตอนใน docs/bay-action-list.md
        </p>
      )}

      <div className={card + ' mt-4 flex items-center justify-between gap-3 text-sm'}>
        <div className="text-xs text-muted">
          {last ? <>ดึงชีตล่าสุด {when(last.created_at)} ({last.run_by}) · อ่าน {last.rows_read} แถว · ใหม่ {last.created} · ซ้ำ {last.skipped_dupes}
            {last.error ? <span className="text-danger"> · {last.error}</span> : null}</> : 'ยังไม่เคยดึง · ระบบดึงเองทุกเช้า 09:00 หรือกดปุ่มขวา'}
        </div>
        <form action={importNow}><button className={btnMain + ' shrink-0'}>ดึงจากชีต</button></form>
      </div>

      <details className={card + ' mt-3 text-sm'}>
        <summary className="cursor-pointer font-medium">+ เพิ่มข่าวเอง (พิมพ์เอง + รูปจากมือถือ · อยากให้ Claude เขียน ใส่ในชีตแท็บ &quot;ข่าวเข้า&quot;)</summary>
        <ImageForm action={addNews} className="mt-3 space-y-2">
          <select name="brand" defaultValue="Chaw Cher" className={input}>
            <option>Chaw Cher</option><option>ASE</option>
          </select>
          <input name="post_title" placeholder="หัวข่าว" className={input} />
          <textarea name="note" rows={4} className={input}
            placeholder="เนื้อข่าว (เว้นบรรทัด = ย่อหน้าใหม่)" />
          <label className="block text-xs text-muted">รูป (เลือกได้หลายรูป · รูปแรก = รูปปก + รูปที่ส่ง LINE)
            <input type="file" name="images" accept="image/*" multiple className={input + ' mt-1'} /></label>
          <button className={btnMain}>เพิ่มข่าว</button>
        </ImageForm>
      </details>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map(([k, label], i) => (
          <a key={k} href={`/news?tab=${k}`} className={'rounded-xl border px-3 py-1.5 text-sm ' +
            (k === tab[0] ? 'border-accent bg-accent text-accent-fg' : 'border-border')}>
            {label} <span className="opacity-70">{n[i]}</span>
          </a>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        {items.length === 0 && <p className={card + ' text-sm text-muted'}>ไม่มีรายการ</p>}
        {items.map((it) => (
          <article key={it.id} id={'n-' + it.id} className={card + ' text-sm'}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={pill(it.brand === 'ASE' ? 'warn' : 'ok')}>{it.brand}</span>
              <span className={pill('mute')}>{it.source}</span>
              {it.wp_post_id && <span className={pill(it.status === 'เผยแพร่แล้ว' ? 'ok' : 'mute')}>
                {it.status === 'เผยแพร่แล้ว' ? 'อยู่บนเว็บ' : `ร่างบนเว็บ #${it.wp_post_id}`}</span>}
              {it.line_sent_at && <span className={pill('ok')}>ส่ง LINE แล้ว {it.line_sent_to.length} กลุ่ม</span>}
              <span className="text-xs text-muted">{when(it.created_at)}</span>
            </div>
            {(it.source_url || it.note) && (
              <div className="mt-2 rounded-lg bg-bg p-2 text-xs text-muted">
                {it.source_url && <div>ต้นทาง: <a className="underline" href={it.source_url} target="_blank" rel="noreferrer">
                  {it.source_title || it.source_url}</a>{it.source_date ? ` · ${it.source_date}` : ''}</div>}
                {it.note && <div className="mt-1 whitespace-pre-line">{it.source === 'Bay ส่งเอง' ? 'Bay เขียน: ' : 'สรุปต้นทาง: '}{it.note}</div>}
              </div>
            )}

            <ImageForm action={saveNews} className="mt-3 space-y-2">
              <input type="hidden" name="id" value={it.id} />
              <label className="block text-xs text-muted">หัวข่าว
                <input name="post_title" defaultValue={it.post_title} required className={input} /></label>
              <label className="block text-xs text-muted">เนื้อข่าว (เว้นบรรทัด = ขึ้นย่อหน้าใหม่)
                <textarea name="post_body" defaultValue={it.post_body} rows={7} className={input} /></label>

              <div className="text-xs text-muted">รูป · ⦿ = รูปปก/รูปที่ส่ง LINE · ☐ ลบ = เอาออก</div>
              <div className="flex flex-wrap gap-2">
                {it.images.map((im, i) => (
                  <div key={im.url} className="w-28 text-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element -- รูปจาก chawcher.com / ต้นทาง */}
                    <img src={im.preview || im.url} alt={im.alt ?? ''} className="h-28 w-28 rounded-lg object-cover" />
                    <label className="mt-1 flex items-center gap-1"><input type="radio" name="cover" value={im.url} defaultChecked={i === 0} /> ปก</label>
                    <label className="flex items-center gap-1"><input type="checkbox" name="drop" value={im.url} /> ลบ</label>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <input type="file" name="images" accept="image/*" multiple className={input + ' flex-1'} />
                <input name="image_url" placeholder="หรือวางลิงก์รูป https://…" className={input + ' flex-1'} />
              </div>

              <label className="block text-xs text-muted">ข้อความ LINE (ลิงก์ข่าวเติมให้เองหลังขึ้นเว็บ)
                <textarea name="line_text" defaultValue={it.line_text} rows={4} className={input} /></label>

              <div className="flex flex-wrap gap-2">
                <button name="act" value="save" className={btn}>บันทึก</button>
                <button name="act" value="wp" className={btnMain} disabled={!wpReady}>
                  บันทึก + {it.wp_post_id ? 'อัปเดตร่างบนเว็บ' : 'สร้างร่างบนเว็บ'}</button>
              </div>
            </ImageForm>

            {it.wp_post_id && (
              <div className="mt-3 rounded-lg border border-border p-3">
                <div className="font-medium">① ดูบนเว็บ</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <a className={btn} href={it.status === 'เผยแพร่แล้ว' && it.wp_link ? it.wp_link : previewUrl(it.wp_post_id)} target="_blank" rel="noreferrer">
                    {it.status === 'เผยแพร่แล้ว' ? 'เปิดข่าวบนเว็บ ↗' : 'Preview ↗'}</a>
                  <a className={btn} href={editUrl(it.wp_post_id)} target="_blank" rel="noreferrer">แก้ใน WordPress ↗</a>
                </div>
                {it.status === 'ร่าง' && (
                  <form action={publishNews} className="mt-3 space-y-2">
                    <input type="hidden" name="id" value={it.id} />
                    <div className="font-medium">② เผยแพร่บนเว็บ chawcher.com</div>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="confirm" className="h-4 w-4" />
                      ดู Preview แล้ว · คนในรูปและแบรนด์ที่พูดถึงโอเคให้ลงแล้ว</label>
                    <button className={btnMain} disabled={!wpReady}>เผยแพร่บนเว็บ</button>
                  </form>
                )}
              </div>
            )}

            {it.status !== 'ไม่ใช้' && (
              <form action={sendLine} className="mt-3 space-y-2 rounded-lg border border-border p-3">
                <input type="hidden" name="id" value={it.id} />
                <div className="font-medium">{it.wp_post_id ? '③' : '①'} ส่ง LINE (รูปปก + ข้อความ{it.status === 'เผยแพร่แล้ว' ? ' + ลิงก์ข่าว' : ' · ยังไม่มีลิงก์เพราะยังไม่ขึ้นเว็บ'})</div>
                <pre className="whitespace-pre-wrap rounded-lg bg-bg p-2 font-sans text-xs">{it.line_text}{it.status === 'เผยแพร่แล้ว' && it.wp_link ? `\n\nอ่านต่อ 👉 ${it.wp_link}` : ''}</pre>
                {roomList.length === 0 ? <p className="text-xs text-muted">ยังไม่มีกลุ่ม LINE ที่อนุมัติ · คัดลอกข้อความข้างบนไปส่งเองได้</p> : (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {roomList.map((r) => (
                      <label key={r.id} className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="room" value={r.id} className="h-4 w-4" />{r.name ?? r.id}</label>
                    ))}
                  </div>
                )}
                {it.line_sent_to.length > 0 && <p className="text-xs text-muted">ส่งแล้ว: {it.line_sent_to.map((s) => `${s.name ?? '?'} (${when(s.at)})`).join(' · ')}</p>}
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="confirm" className="h-4 w-4" /> ยืนยันส่งเข้ากลุ่มที่ติ๊ก</label>
                <button className={btn} disabled={!lineReady || roomList.length === 0}>ส่ง LINE</button>
              </form>
            )}

            {it.status !== 'เผยแพร่แล้ว' && (
              <form action={setNewsStatus} className="mt-3">
                <input type="hidden" name="id" value={it.id} />
                <input type="hidden" name="to" value={it.status === 'ไม่ใช้' ? 'ร่าง' : 'ไม่ใช้'} />
                <button className={'text-xs underline ' + (it.status === 'ไม่ใช้' ? 'text-muted' : 'text-danger')}>
                  {it.status === 'ไม่ใช้' ? 'กลับเป็นร่าง' : 'ไม่ใช้ข่าวนี้'}</button>
              </form>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

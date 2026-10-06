'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ChatPanel from './ChatPanel';
import AgentPanel from './AgentPanel';
import {
  updateBrief, saveCopy, submitForReview, markPosted, tickNote,
  addPlacement, setPlacementDate, skipPlacement, addImage, moveImageUp, removeImage,
} from '@/modules/content/actions';
import {
  PHASE1_WORK_STAGES, PHASE1_CHANNELS, LIMITS, MAX_ALBUM, TONE, channelName, channelShort,
  type Item, type Placement, type ItemImage, type Pillar, type Theme, type Model, type Person,
  type ReviewNote, type Message, type Version, type AgentQuestion,
} from '@/modules/content/types';

const input =
  'mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base outline-none focus:border-accent';
const label = 'block text-sm font-medium';
const hint = 'font-normal text-muted text-xs';
const panel = 'rounded-2xl border border-border bg-surface p-4';

type Props = {
  item: Item;
  brandName: string;
  placements: Placement[];
  images: ItemImage[];
  models: string[];
  pillars: Pillar[];
  themes: Theme[];
  campaigns: { id: string; name: string }[];
  allModels: Model[];
  team: Person[];
  canApprove: boolean;
  notes: ReviewNote[];
  messages: Message[];
  versions: Version[];
  questions: AgentQuestion[];
  me: string | null;
};

type Result = { ok: true } | { ok: false; error: string };

/** ลิงก์ที่เป็นไฟล์ภาพตรงๆ โชว์ภาพได้ · ลิงก์ Drive/Figma โชว์เป็นกล่องแทน */
const isDirectImage = (u: string) => /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(u);

function Counter({ len, max }: { len: number; max: number }) {
  const over = len > max;
  return (
    <span className={'text-xs tabular-nums ' + (over ? 'font-medium text-danger' : 'text-muted')}>
      {len.toLocaleString()} / {max.toLocaleString()}{over ? ' · ยาวเกินที่รับได้' : ''}
    </span>
  );
}

export default function ItemDetail(props: Props) {
  const { item, brandName, placements, images, models, pillars, themes, campaigns, allModels, team, canApprove, notes, messages, versions, questions, me } = props;
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [tab, setTab] = useState(placements.find((p) => !p.skipped_reason)?.channel_id ?? '');
  const [picked, setPicked] = useState<string[]>(models);
  const [imgUrl, setImgUrl] = useState('');
  const router = useRouter();

  const textOnly = item.format === 'ข้อความล้วน';
  const approved = item.stage === 'พร้อมโพสต์' || item.stage === 'โพสต์แล้ว';
  const editable = item.stage !== 'โพสต์แล้ว' && item.stage !== 'พับไว้';
  const canSubmit = ['ไอเดีย', 'กำลังทำ', 'ตีกลับแก้'].includes(item.stage);
  const currentNotes = item.stage === 'ตีกลับแก้' ? notes.filter((n) => n.version === item.version) : [];
  const openNotes = notes.filter((n) => !n.done_at).length;
  const imagesPassed = images.every((m) => m.passed_at);
  const canPost = (p: Placement) => !!p.passed_at && imagesPassed;
  const partLabels = [...images.map((_, i) => `ภาพ ${i + 1}`), ...placements.filter((p) => !p.skipped_reason).map((p) => channelName(p.channel_id))];
  const live = placements.filter((p) => !p.skipped_reason);
  const current = live.find((p) => p.channel_id === tab);
  const unused = PHASE1_CHANNELS.filter(
    (c) => !placements.some((p) => p.channel_id === c.id) && !(c.id === 'instagram' && textOnly),
  );
  const myPillars = pillars.filter((p) => p.brand_id === item.brand_id && (p.active || p.id === item.pillar_id));
  const myThemes = themes.filter((t) => t.brand_id === item.brand_id && (t.active || t.id === item.theme_id));
  const myModels = allModels.filter((m) => m.brand_id === item.brand_id);

  function run(fn: () => Promise<Result>, okMsg?: string, after?: () => void) {
    setError(null); setNote(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else { if (okMsg) setNote(okMsg); after?.(); router.refresh(); }
    });
  }

  function onSaveBrief(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('id', item.id);
    picked.forEach((m) => fd.append('models', m));
    run(() => updateBrief(fd), 'บันทึกแล้ว');
  }

  function onSaveCopy(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(() => saveCopy(fd), `บันทึกข้อความ ${channelName(tab)} แล้ว`);
  }

  return (
    <div className="space-y-4">
      {/* ── หัว ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">{brandName} · {item.format}</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{item.hook || item.title}</h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-lg px-2.5 py-1 text-xs ${TONE[item.stage] ?? ''}`}>{item.stage}</span>
          {item.off_plan && <span className="rounded-md bg-warn/10 px-1.5 text-[11px] font-medium text-warn">นอกแผน</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className={'rounded-lg border px-2.5 py-1 ' + (live.some((p) => p.copy_text) ? 'border-ok/40 text-ok' : 'border-border text-warn')}>
          ข้อความ {live.every((p) => p.copy_text) && live.length ? '✓' : '⏳'}
        </span>
        {!textOnly && (
          <span className={'rounded-lg border px-2.5 py-1 ' + (images.length ? 'border-ok/40 text-ok' : 'border-border text-warn')}>
            ภาพ {images.length ? `✓ ${images.length}` : '⏳'}
          </span>
        )}
        <span className={'rounded-lg border px-2.5 py-1 ' + (approved ? 'border-ok/40 text-ok' : 'border-border text-muted')}>
          Bay ตรวจ {approved ? '✓' : ''}
        </span>
      </div>

      {item.review_note && (
        <div className={'rounded-2xl border p-4 text-sm ' + (item.stage === 'ตีกลับแก้' || item.stage === 'รอตรวจ' ? 'border-danger/40 bg-danger/5' : 'border-ok/40 bg-ok/5')}>
          <div className="font-medium">{item.stage === 'ตีกลับแก้' ? 'ถูกตีกลับ' : 'หมายเหตุจากคนตรวจ'}</div>
          <p className="mt-1">{item.review_note}</p>
        </div>
      )}
      {approved && editable && (
        <div className="rounded-2xl border border-warn/40 bg-warn/5 p-3 text-xs">
          อนุมัติแล้ว · แก้ brief ข้อความ หรือภาพ ระบบจะถอนอนุมัติเองและต้องส่งตรวจใหม่
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4 text-sm">
          <div className="font-medium text-danger">ทำไม่สำเร็จ</div>
          <p className="mt-1">{error}</p>
        </div>
      )}
      {note && <div className="rounded-2xl border border-ok/40 bg-ok/5 p-4 text-sm text-ok">{note}</div>}

      {/* ── คนตรวจ ── */}
      {canApprove && item.stage === 'รอตรวจ' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-locked/40 bg-locked/5 p-4">
          <div>
            <div className="text-sm font-medium text-locked">รอคุณตรวจ · v{item.version}</div>
            <p className="mt-0.5 text-xs text-muted">ติ๊กผ่านหรือไม่ผ่านทีละส่วน · ส่วนที่ผ่านแล้วไม่ต้องตรวจซ้ำ</p>
          </div>
          <Link href={`/content/${item.id}/review`} className="rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-fg">ไปหน้าตรวจ</Link>
        </div>
      )}

      {/* ── ต้องแก้ · ติ๊กทีละข้อ (Q-42) ── */}
      {currentNotes.length > 0 && (
        <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-medium text-danger">ต้องแก้ · ติ๊กข้อที่แก้แล้ว</div>
            <span className="text-xs text-muted">v{item.version}</span>
          </div>
          <ul className="mt-2 divide-y divide-danger/15">
            {currentNotes.map((n) => (
              <li key={n.id}>
                <label className="flex cursor-pointer items-start gap-3 py-2">
                  <input type="checkbox" checked={!!n.done_at} disabled={pending}
                    onChange={(e) => run(() => tickNote(n.id, e.target.checked, item.id))}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
                  <span className={'text-sm ' + (n.done_at ? 'text-muted line-through' : '')}>
                    <b>{n.part_label}</b> · {n.note}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button disabled={pending || openNotes > 0} onClick={() => run(() => submitForReview(item.id), 'ส่งตรวจอีกครั้งแล้ว')}
            className="mt-2 w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-fg disabled:opacity-50">
            {openNotes > 0 ? `ส่งตรวจอีกครั้ง · เหลือ ${openNotes} ข้อ` : 'ส่งตรวจอีกครั้ง'}
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4">
          <AgentPanel itemId={item.id} questions={questions} placements={placements} canAnswer={canApprove}
            canWrite={['ไอเดีย', 'กำลังทำ', 'ตีกลับแก้', 'รอตรวจ'].includes(item.stage)} />

          {/* ── ข้อความต่อช่องทาง ── */}
          <section className={panel}>
            <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist">
              {live.map((p) => (
                <button key={p.id} role="tab" aria-selected={tab === p.channel_id} onClick={() => setTab(p.channel_id)}
                  className={'whitespace-nowrap border-b-2 px-3 py-2 text-sm ' + (tab === p.channel_id ? 'border-accent font-semibold' : 'border-transparent text-muted')}>
                  {channelName(p.channel_id)}{p.passed_at ? ' ✓' : ''}
                </button>
              ))}
            </div>

            {!current ? (
              <p className="mt-3 text-sm text-muted">ยังไม่ได้เลือกช่องทาง — เพิ่มได้ในกล่อง “ลงที่ไหน วันไหน”</p>
            ) : (
              <CopyForm key={`${current.id}:${current.ai_request_id ?? ''}`} p={current} itemId={item.id} editable={editable} pending={pending} onSubmit={onSaveCopy} />
            )}
          </section>

          {/* ── brief ── */}
          {editable && (
            <form onSubmit={onSaveBrief} className={panel + ' space-y-3'}>
              <div className="text-sm font-medium">Brief</div>
              <input type="hidden" name="title" value={item.title} />
              <div>
                <label className={label} htmlFor="hook">Hook</label>
                <input id="hook" name="hook" defaultValue={item.hook ?? ''} className={input} />
              </div>
              <div>
                <label className={label} htmlFor="km">เนื้อหา <span className={hint}>ข้อความหลักข้อเดียว</span></label>
                <input id="km" name="key_message" defaultValue={item.key_message ?? ''} className={input} />
              </div>
              {!textOnly && (
                <div>
                  <label className={label} htmlFor="vs">Visual</label>
                  <input id="vs" name="visual" defaultValue={item.visual ?? ''} className={input} />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={label} htmlFor="pl">Pillar</label>
                  <select id="pl" name="pillar_id" defaultValue={item.pillar_id ?? ''} className={input}>
                    <option value="">ไม่ผูก</option>
                    {myPillars.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="th">ธีม</label>
                  <select id="th" name="theme_id" defaultValue={item.theme_id ?? ''} className={input}>
                    <option value="">ไม่ผูก</option>
                    {myThemes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="cp">แคมเปญ</label>
                  <select id="cp" name="campaign_id" defaultValue={item.campaign_id ?? ''} className={input}>
                    <option value="">ไม่ผูก</option>
                    {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="ow">คนทำ</label>
                  <select id="ow" name="owner_id" defaultValue={item.owner_id ?? ''} className={input}>
                    <option value="">ยังไม่ระบุ</option>
                    {team.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              </div>
              {myModels.length > 0 && (
                <div>
                  <span className={label}>สินค้าที่พูดถึง</span>
                  <div className="mt-1.5 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                    {myModels.map((m) => (
                      <button key={m.id} type="button" aria-pressed={picked.includes(m.id)}
                        onClick={() => setPicked(picked.includes(m.id) ? picked.filter((x) => x !== m.id) : [...picked, m.id])}
                        className={'rounded-full border px-3 py-1.5 text-xs ' + (picked.includes(m.id) ? 'border-accent bg-accent text-accent-fg' : 'border-border')}>
                        {m.collection}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className={label} htmlFor="src">ลิงก์ต้นทาง</label>
                <input id="src" name="source_url" type="url" defaultValue={item.source_url ?? ''} className={input} />
                {item.source_url && (
                  <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-muted underline">เปิดต้นทาง ↗</a>
                )}
              </div>
              <div>
                <label className={label} htmlFor="st">ขั้น</label>
                <select id="st" name="stage" defaultValue={item.stage} className={input}>
                  {PHASE1_WORK_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  {!PHASE1_WORK_STAGES.includes(item.stage) && <option value={item.stage}>{item.stage} (ปัจจุบัน)</option>}
                  <option value="พับไว้">พับไว้</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={pending}
                  className="flex-1 rounded-xl border border-border px-4 py-3.5 text-sm font-medium disabled:opacity-50">
                  {pending ? 'กำลังบันทึก…' : 'บันทึก brief'}
                </button>
                {canSubmit && currentNotes.length === 0 && (
                  <button type="button" disabled={pending || openNotes > 0}
                    onClick={() => run(() => submitForReview(item.id), 'ส่งตรวจแล้ว')}
                    className="flex-1 rounded-xl bg-accent px-4 py-3.5 text-sm font-medium text-accent-fg disabled:opacity-50">
                    ส่งตรวจ
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        <div className="space-y-4">
          <ChatPanel itemId={item.id} messages={messages} parts={partLabels} team={team} me={me} />

          {/* ── ภาพ ── */}
          {!textOnly && (
            <section className={panel}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-medium">
                  ภาพ{item.format === 'อัลบั้มภาพ' ? ` · ${images.length} / ${MAX_ALBUM}` : ''}
                </h2>
                <span className="text-xs text-muted">ภาพ 1 = key visual</span>
              </div>
              {images.length === 0 && <p className="mt-2 text-sm text-muted">ยังไม่มีภาพ · แปะลิงก์ Drive/Figma ทีละภาพ</p>}
              <ol className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {images.map((m, i) => (
                  <li key={m.id} className="space-y-1">
                    <a href={m.url} target="_blank" rel="noreferrer"
                      className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-border bg-bg text-xs text-muted">
                      {isDirectImage(m.url)
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={m.url} alt={`ภาพ ${i + 1}`} className="h-full w-full object-cover" />
                        : <span>เปิดภาพ ↗</span>}
                    </a>
                    <div className="flex items-center justify-between text-xs">
                      <span>ภาพ {i + 1}{i === 0 ? ' ★' : ''}{m.passed_at ? <span className="text-ok"> ✓</span> : null}</span>
                      {editable && (
                        <span className="flex gap-1">
                          {i > 0 && (
                            <button onClick={() => run(() => moveImageUp(item.id, m.id))} disabled={pending}
                              aria-label={`เลื่อนภาพ ${i + 1} ขึ้น`} className="rounded bg-bg px-1.5">↑</button>
                          )}
                          <button onClick={() => run(() => removeImage(item.id, m.id), 'เอาภาพออกแล้ว')} disabled={pending}
                            aria-label={`เอาภาพ ${i + 1} ออก`} className="rounded bg-bg px-1.5 text-danger">×</button>
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {editable && (item.format === 'อัลบั้มภาพ' ? images.length < MAX_ALBUM : images.length < 1) && (
                <div className="mt-3 flex gap-2">
                  <input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="วางลิงก์ภาพ" aria-label="ลิงก์ภาพ"
                    className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
                  <button onClick={() => run(() => addImage(item.id, imgUrl), 'เพิ่มภาพแล้ว', () => setImgUrl(''))}
                    disabled={pending || !imgUrl.trim()}
                    className="rounded-xl border border-border px-4 text-sm disabled:opacity-50">เพิ่ม</button>
                </div>
              )}
            </section>
          )}

          {/* ── ที่ลง ── */}
          <section className={panel}>
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium">ลงที่ไหน วันไหน</h2>
              <span className="text-xs text-muted">ลงแล้ว {live.filter((p) => p.published_url).length} จาก {live.length}</span>
            </div>
            <ul className="mt-2 divide-y divide-border">
              {placements.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <span className="rounded-md border border-border px-1.5 text-[11px] font-bold tracking-wide text-muted">{channelShort(p.channel_id)}</span>
                  {p.skipped_reason ? (
                    <>
                      <span className="flex-1 text-xs text-muted">ไม่ลงที่นี่แล้ว · {p.skipped_reason}</span>
                      {editable && (
                        <button onClick={() => run(() => skipPlacement(p.id, '', item.id), 'กลับมาลงที่นี่')} disabled={pending}
                          className="text-xs text-muted underline">กลับมาลง</button>
                      )}
                    </>
                  ) : (
                    <>
                      <input type="date" defaultValue={p.planned_on ?? ''} disabled={!editable || pending} aria-label={`วันลง ${channelName(p.channel_id)}`}
                        onChange={(e) => run(() => setPlacementDate(p.id, e.target.value, item.id), 'เปลี่ยนวันแล้ว')}
                        className="rounded-lg border border-border bg-bg px-2 py-1 text-sm" />
                      <span className="flex-1" />
                      {p.published_url ? (
                        <a href={p.published_url} target="_blank" rel="noreferrer" className="text-xs text-ok">ลงแล้ว ↗</a>
                      ) : canPost(p) ? (
                        <button
                          onClick={() => {
                            const u = prompt(`ลง ${channelName(p.channel_id)} แล้ว — วางลิงก์โพสต์จริง`, '');
                            if (u === null) return;
                            run(() => markPosted(p.id, u, item.id), 'บันทึกแล้ว');
                          }}
                          disabled={pending} className="rounded-lg border border-border px-2.5 py-1 text-xs">บันทึกว่าลงแล้ว</button>
                      ) : null}
                      {!p.published_url && editable && (
                        <button
                          onClick={() => {
                            const r = prompt(`ไม่ลง ${channelName(p.channel_id)} แล้ว เพราะอะไร`, '');
                            if (!r) return;
                            run(() => skipPlacement(p.id, r, item.id), 'ถอดช่องทางนี้แล้ว');
                          }}
                          disabled={pending} className="text-xs text-muted underline">ไม่ลงที่นี่แล้ว</button>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {editable && unused.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 border-t border-border pt-3">
                {unused.map((c) => (
                  <button key={c.id} onClick={() => run(() => addPlacement(item.id, c.id), `เพิ่ม ${c.name} แล้ว`)} disabled={pending}
                    className="rounded-full border border-border px-3 py-1.5 text-xs">+ {c.name}</button>
                ))}
              </div>
            )}
          </section>

          {versions.length > 0 && (
            <section className={panel}>
              <h2 className="text-sm font-medium">ประวัติการส่งตรวจ</h2>
              <ul className="mt-2 space-y-1.5 text-xs">
                {versions.map((v) => {
                  const vn = notes.filter((n) => n.version === v.version);
                  return (
                    <li key={v.version}>
                      <b>v{v.version}</b> · {new Date(v.submitted_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {vn.length > 0 && <span className="text-muted"> · ไม่ผ่าน {vn.map((n) => n.part_label).join(', ')}</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/** ฟอร์มข้อความของช่องทางเดียว · FB/IG = ข้อความโพสต์ · เว็บ = บทความบล็อก SEO */
function CopyForm({ p, itemId, editable, pending, onSubmit }: {
  p: Placement; itemId: string; editable: boolean; pending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const web = p.channel_id === 'website';
  const [text, setText] = useState(p.copy_text ?? '');
  const [title, setTitle] = useState(p.web_title ?? '');
  const [meta, setMeta] = useState(p.web_meta ?? '');
  const [copied, setCopied] = useState(false);
  const max = p.channel_id === 'instagram' ? LIMITS.instagram : LIMITS.facebook;

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3">
      <input type="hidden" name="placement_id" value={p.id} />
      <input type="hidden" name="item_id" value={itemId} />
      {p.human_edited ? <p className="text-xs text-muted">คนแก้ช่องนี้แล้ว · agent จะไม่เขียนทับ</p>
        : p.ai_request_id && <p className="text-xs text-muted">ร่างโดย Content agent · แก้แล้วบันทึก = agent จะไม่เขียนทับ</p>}

      {web ? (
        <>
          <div>
            <label className="flex items-baseline justify-between text-sm font-medium" htmlFor={`wt-${p.id}`}>
              หัวเรื่อง <Counter len={title.length} max={LIMITS.web_title} />
            </label>
            <input id={`wt-${p.id}`} name="web_title" value={title} onChange={(e) => setTitle(e.target.value)} readOnly={!editable} className={input} />
          </div>
          <div>
            <label className={label} htmlFor={`wk-${p.id}`}>คำค้นหลัก</label>
            <input id={`wk-${p.id}`} name="web_keyword" defaultValue={p.web_keyword ?? ''} readOnly={!editable} className={input} />
          </div>
          <div>
            <label className="flex items-baseline justify-between text-sm font-medium" htmlFor={`wm-${p.id}`}>
              Meta description <Counter len={meta.length} max={LIMITS.web_meta} />
            </label>
            <textarea id={`wm-${p.id}`} name="web_meta" rows={2} value={meta} onChange={(e) => setMeta(e.target.value)} readOnly={!editable} className={input} />
          </div>
          <div>
            <label className={label} htmlFor={`wb-${p.id}`}>เนื้อบทความ</label>
            <textarea id={`wb-${p.id}`} name="copy_text" rows={12} value={text} onChange={(e) => setText(e.target.value)} readOnly={!editable} className={input} />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className={label} htmlFor={`h-${p.id}`}>Hook ของช่องนี้ <span className={hint}>เว้นว่าง = ใช้ hook ของชิ้นงาน</span></label>
            <input id={`h-${p.id}`} name="hook" defaultValue={p.hook ?? ''} readOnly={!editable} className={input} />
          </div>
          <div>
            <label className="flex items-baseline justify-between text-sm font-medium" htmlFor={`c-${p.id}`}>
              ข้อความโพสต์ <Counter len={text.length} max={max} />
            </label>
            <textarea id={`c-${p.id}`} name="copy_text" rows={8} value={text} onChange={(e) => setText(e.target.value)} readOnly={!editable} className={input} />
          </div>
          <div>
            <label className={label} htmlFor={`fc-${p.id}`}>คอมเมนต์แรก <span className={hint}>เตรียมไว้คัดลอกตอนโพสต์</span></label>
            <div className="flex gap-2">
              <input id={`fc-${p.id}`} name="first_comment" defaultValue={p.first_comment ?? ''} readOnly={!editable} className={input} />
              <button type="button" className="mt-1.5 rounded-xl border border-border px-3 text-sm"
                onClick={async (e) => {
                  const v = (e.currentTarget.previousElementSibling as HTMLInputElement).value;
                  try { await navigator.clipboard.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* เลือกข้อความเองได้ */ }
                }}>
                {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
              </button>
            </div>
          </div>
        </>
      )}
      {editable && (
        <button type="submit" disabled={pending}
          className="w-full rounded-xl border border-border px-4 py-3 text-sm font-medium disabled:opacity-50">
          {pending ? 'กำลังบันทึก…' : `บันทึกข้อความ ${channelName(p.channel_id)}`}
        </button>
      )}
    </form>
  );
}

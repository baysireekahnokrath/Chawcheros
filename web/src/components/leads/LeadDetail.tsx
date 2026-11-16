'use client';

import { useState } from 'react';
import {
  closeBought, closeLost, confirmTags, markFollowupSent, markReplied, reopenLead,
  setAppointment, setCounted, setNeedBy, setNextAction, setStage, setTag,
} from '@/modules/leads/actions';
import {
  FLOW, HEATS, PRODUCTS, REASONS, SOURCES, TOPICS, WHEN, isOneOf, isOpen, type Lead,
} from '@/modules/leads/constants';
import { DRAFT_LABEL, draftKindFor, draftText } from '@/modules/leads/drafts';
import DraftBox from './DraftBox';
import { btn, btnGhost, chipCls, field, useRun } from './useRun';

const box = 'mt-3 rounded-2xl border border-border bg-surface p-4';
const h3 = 'mb-2 flex flex-wrap items-baseline gap-2 text-sm font-semibold';
const hint = 'text-xs text-muted';
const note = 'rounded-md border border-dashed border-border px-1.5 text-xs font-normal';

function Step({ n }: { n: number }) {
  return (
    <span className="inline-grid h-[22px] w-[22px] place-items-center rounded-full border border-border text-xs font-normal">{n}</span>
  );
}

/** หน้ารายละเอียดของ 1 คน · ป้าย → คำถามคัดกรอง → ขั้น/วันทำต่อ → ร่างข้อความ → ผลสุดท้าย */
export default function LeadDetail({ lead, initialOut }: { lead: Lead; initialOut: 'buy' | 'lost' | null }) {
  const { pending, error, done, run, setError } = useRun();
  const open = isOpen(lead.stage);
  const idx = (FLOW as readonly string[]).indexOf(lead.stage);

  const [needBy, setNeedByText] = useState(lead.need_by ?? '');
  const [apptOn, setApptOn] = useState(lead.appointment_on ?? '');
  const [apptTime, setApptTime] = useState((lead.appointment_time ?? '').slice(0, 5));
  const [nextOn, setNextOn] = useState(lead.next_action_on ?? '');
  const [nextNote, setNextNote] = useState(lead.next_action_note ?? '');
  const [out, setOut] = useState<'buy' | 'lost' | null>(open ? initialOut : null);
  const [pick, setPick] = useState<string>(
    initialOut === 'buy' && isOneOf(SOURCES, lead.channel) ? lead.channel : '',
  );

  const id = lead.id;
  const anySuggested =
    (lead.topic_suggested && lead.topic) || (lead.product_suggested && lead.product) || lead.readiness_suggested;

  function goStage(s: string) {
    if (s === lead.stage) return;
    if (s === 'นัดแล้ว' && !apptOn) {
      setError('ใส่วันนัดโชว์รูมก่อน แล้วค่อยกด “นัดแล้ว”');
      document.getElementById('apptin')?.focus();
      return;
    }
    run(() => setStage(id, s, s === 'นัดแล้ว' ? apptOn : null, s === 'นัดแล้ว' ? apptTime || null : null), `ขั้นตอนนี้: ${s}`);
  }

  function tagGroup(key: 'topic' | 'product' | 'readiness', title: string, opts: readonly string[]) {
    const value = lead[key];
    const suggested = lead[`${key}_suggested`];
    return (
      <div className="mb-3">
        <div className={`${hint} mb-1 flex flex-wrap items-center gap-1.5`}>
          {title}
          {suggested && value && <span className={note}>ระบบเสนอ รอคนยืนยัน</span>}
          {!value && <span className={note}>ระบบจับไม่ได้ รอคนใส่</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {opts.map((o) => (
            <button
              key={o}
              type="button"
              disabled={pending}
              aria-pressed={value === o}
              onClick={() => run(() => setTag(id, key, o))}
              className={chipCls(value === o)}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const kind = draftKindFor(lead);
  const draftLead = { ...lead, appointment_on: lead.appointment_on, appointment_time: lead.appointment_time };

  return (
    <>
      {error && (
        <p className="mt-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {done && !error && (
        <p className="mt-3 rounded-xl border border-ok/40 bg-ok/10 p-3 text-sm text-ok" role="status">
          {done}
        </p>
      )}

      {!open && (
        <div className={box}>
          <h3 className={h3}>ผลของรายการนี้</h3>
          <p>
            {lead.stage === 'ซื้อ' ? (
              <>ซื้อแล้ว · ที่มา <b>{lead.outcome_source}</b></>
            ) : (
              <>หาย · เหตุผล <b>{lead.lost_reason}</b></>
            )}
          </p>
          <p className={`${hint} mt-1.5`}>
            {lead.stage === 'หาย' ? 'ถ้าลูกค้าทักกลับมา เปิดรายการเดิมต่อได้ ไม่ต้องสร้างใหม่' : 'กดผิด แก้กลับได้'}
          </p>
          <button type="button" disabled={pending} onClick={() => run(() => reopenLead(id), 'เปิดรายการเดิมแล้ว')} className={btnGhost + ' mt-3'}>
            {lead.stage === 'หาย' ? 'ลูกค้าทักกลับมา เปิดรายการเดิม' : 'ย้อนกลับไปขั้นก่อนหน้า'}
          </button>
        </div>
      )}

      {open && lead.awaiting_reply_since && (
        <div className={box}>
          <h3 className={h3}>ลูกค้าทักมา ยังไม่ได้กด “ตอบแล้ว”</h3>
          <p className={hint}>ไปตอบในแชท {lead.channel} แล้วกลับมากดปุ่มนี้ ระบบไม่ส่งถึงลูกค้าเอง</p>
          {lead.stage === 'ใหม่' && <DraftBox key={`${id}-first`} label={DRAFT_LABEL.first} text={draftText(draftLead, 'first')} />}
          <button type="button" disabled={pending} onClick={() => run(() => markReplied(id), 'จดว่าตอบแล้ว')} className={btn + ' mt-3 w-full'}>
            ตอบแล้ว
          </button>
        </div>
      )}

      <div className={box}>
        <h3 className={h3}><Step n={1} />ป้าย แตะเพื่อเปลี่ยน</h3>
        {tagGroup('topic', 'เรื่อง', TOPICS)}
        {tagGroup('product', 'สินค้า', PRODUCTS)}
        {tagGroup('readiness', 'ความพร้อม', HEATS)}
        {anySuggested ? (
          <button type="button" disabled={pending} onClick={() => run(() => confirmTags(id), 'ยืนยันป้ายแล้ว')} className={btnGhost}>
            ป้ายถูกแล้ว ยืนยัน
          </button>
        ) : (
          <p className={hint}>ป้ายที่คนตั้งแล้ว ระบบจะไม่เปลี่ยนให้เอง</p>
        )}
      </div>

      <div className={box}>
        <h3 className={h3}><Step n={2} />คำถามคัดกรอง “ต้องการใช้ช่วงไหน”</h3>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {WHEN.map((w) => (
            <button
              key={w.label}
              type="button"
              disabled={pending}
              aria-pressed={lead.need_by === w.label}
              onClick={() => {
                setNeedByText(w.label);
                run(() => setNeedBy(id, w.label, w.heat));
              }}
              className={chipCls(lead.need_by === w.label)}
            >
              {w.label}
            </button>
          ))}
        </div>
        <label className={hint} htmlFor="whenin">คำตอบของลูกค้า (พิมพ์เองได้)</label>
        <div className="mt-1 flex gap-2">
          <input id="whenin" value={needBy} onChange={(e) => setNeedByText(e.target.value)} maxLength={200} className={field} placeholder="เช่น ย้ายเข้าบ้านต้นเดือนหน้า" />
          <button type="button" disabled={pending || needBy === (lead.need_by ?? '')} onClick={() => run(() => setNeedBy(id, needBy, null), 'จดแล้ว')} className={btnGhost}>
            จด
          </button>
        </div>
        <p className={`${hint} mt-1.5`}>
          แตะตัวเลือกด้านบน ระบบจะเสนอความพร้อมให้: ภายใน 1 เดือน = ร้อน · 1 ถึง 3 เดือน = อุ่น · นานกว่านั้นหรือยังไม่รู้ = เย็น
        </p>
      </div>

      {open && (
        <>
          <div className={box}>
            <h3 className={h3}><Step n={3} />ขั้น และสิ่งที่ต้องทำต่อ</h3>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {FLOW.map((s, i) => (
                <button key={s} type="button" disabled={pending} aria-pressed={lead.stage === s} onClick={() => goStage(s)} className={chipCls(lead.stage === s, i < idx)}>
                  {i + 1} {s}
                </button>
              ))}
            </div>

            {(
              <div className="mb-3 grid grid-cols-2 gap-2">
                <label className={hint}>
                  วันนัดโชว์รูม
                  <input id="apptin" type="date" value={apptOn} onChange={(e) => setApptOn(e.target.value)} className={field + ' mt-1'} />
                </label>
                <label className={hint}>
                  เวลา
                  <input type="time" value={apptTime} onChange={(e) => setApptTime(e.target.value)} className={field + ' mt-1'} />
                </label>
                {idx >= 3 && (
                  <button
                    type="button"
                    disabled={pending || !apptOn || (apptOn === (lead.appointment_on ?? '') && apptTime === (lead.appointment_time ?? '').slice(0, 5))}
                    onClick={() => run(() => setAppointment(id, apptOn, apptTime || null), 'จดนัดแล้ว')}
                    className={btnGhost + ' col-span-2'}
                  >
                    บันทึกวันนัด
                  </button>
                )}
              </div>
            )}

            {idx < FLOW.length - 1 ? (
              <button type="button" disabled={pending} onClick={() => goStage(FLOW[idx + 1])} className={btn + ' w-full'}>
                ไปขั้นถัดไป: {FLOW[idx + 1]}
              </button>
            ) : (
              <p className={hint}>ลูกค้ามาโชว์รูมแล้ว เหลือบันทึกผลด้านล่าง (ประมาณ 9 ใน 10 คนที่มาโชว์รูมซื้อ)</p>
            )}
            {idx < 3 && <p className={`${hint} mt-1.5`}>จะกด “นัดแล้ว” ต้องใส่วันนัดโชว์รูมด้านบนก่อน</p>}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className={hint}>
                วันที่ต้องทำต่อ
                <input type="date" value={nextOn} onChange={(e) => setNextOn(e.target.value)} className={field + ' mt-1'} />
              </label>
              <label className={hint}>
                จะทำอะไร
                <input value={nextNote} onChange={(e) => setNextNote(e.target.value)} maxLength={200} className={field + ' mt-1'} placeholder="เช่น ทักตาม" />
              </label>
              <button
                type="button"
                disabled={pending || (nextOn === (lead.next_action_on ?? '') && nextNote === (lead.next_action_note ?? ''))}
                onClick={() => run(() => setNextAction(id, nextOn || null, nextNote), 'ตั้งวันทำต่อแล้ว')}
                className={btnGhost + ' col-span-2'}
              >
                บันทึกวันทำต่อ
              </button>
            </div>
            <p className={`${hint} mt-1.5`}>ถึงวันนั้น รายการนี้จะขึ้นในหน้า “วันนี้” เอง</p>
          </div>

          {idx >= 1 && idx < 4 && (
            <div className={box}>
              <h3 className={h3}><Step n={4} />{kind === 'confirm' ? 'ยืนยันนัดโชว์รูม' : 'ชวนมาโชว์รูม'}</h3>
              <p className={hint}>ระบบร่างให้ พนักงานคัดลอกไปวางในแชท {lead.channel} แล้วกดส่งเอง ระบบไม่ส่งถึงลูกค้า</p>
              <DraftBox
                key={`${id}-${kind}-${lead.appointment_on}-${lead.appointment_time}-${lead.product}`}
                label={DRAFT_LABEL[kind]}
                text={draftText(draftLead, kind)}
                primary
              />
              <button type="button" disabled={pending} onClick={() => run(() => markFollowupSent(id), 'จดว่าส่งแล้ว')} className={btnGhost + ' mt-2 w-full'}>
                ส่งแล้ว
              </button>
              {lead.followup_count > 0 && (
                <p className={`${hint} mt-1.5`}>ทักตามไปแล้ว <span className="tabular-nums">{lead.followup_count}</span> ครั้ง</p>
              )}
            </div>
          )}

          <div className={box} id="outcome">
            <h3 className={h3}><Step n={5} />ผลสุดท้าย</h3>
            {!out ? (
              <>
                <p className={hint}>ทุกรายการต้องจบที่ ซื้อ หรือ หาย ไม่มีรายการค้างตลอดไป</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => { setOut('buy'); setPick(isOneOf(SOURCES, lead.channel) ? lead.channel : ''); }} className={btn + ' flex-1'}>
                    ซื้อ
                  </button>
                  <button type="button" onClick={() => { setOut('lost'); setPick(''); }} className={btnGhost + ' flex-1'}>
                    หาย
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={`${hint} mb-1.5`}>
                  {out === 'buy' ? 'ลูกค้าคนนี้มาจากช่องทางไหน (ที่มาของออเดอร์)' : 'เลือกเหตุผล 1 ข้อ'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(out === 'buy' ? SOURCES : REASONS).map((s) => (
                    <button key={s} type="button" aria-pressed={pick === s} onClick={() => setPick(s)} className={chipCls(pick === s)}>
                      {s}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={pending || !pick}
                    onClick={() =>
                      run(() => (out === 'buy' ? closeBought(id, pick) : closeLost(id, pick)), out === 'buy' ? 'ปิดเป็น ซื้อ แล้ว' : 'ปิดเป็น หาย แล้ว', () => setOut(null))
                    }
                    className={btn + ' flex-1'}
                  >
                    ยืนยัน {out === 'buy' ? 'ซื้อ' : 'หาย'}
                  </button>
                  <button type="button" onClick={() => { setOut(null); setPick(''); }} className={btnGhost}>
                    ยกเลิก
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div className="mt-3 text-right">
        <button type="button" disabled={pending} onClick={() => run(() => setCounted(id, !lead.counted), lead.counted ? 'ไม่นับรายการนี้แล้ว' : 'กลับมานับรายการนี้แล้ว')} className="text-xs text-muted underline underline-offset-2 disabled:opacity-50">
          {lead.counted ? 'สร้างผิดหรือเป็นรายการทดสอบ กดเพื่อไม่นับ (ลบไม่ได้)' : 'รายการนี้ไม่ถูกนับ กดเพื่อกลับมานับ'}
        </button>
      </div>
    </>
  );
}

/**
 * จัดการเหตุการณ์จาก LINE ทีละอัน
 *
 * ลำดับ: ห้องนี้อนุมัติไหม → ทักบอทไหม → พักอยู่ไหม → ซ้ำไหม → "ตอบผิด"? → งบพอไหม
 *        → Claude เลือกว่าจะดึงอะไร → โค้ดดึงและเขียนคำตอบ → reply → บันทึก
 */
import { call } from './db';
import { classify, LINE_MODELS, worstThb, type Intent } from './intent';
import { groupName, memberName, mentionedText, reply, type LineEvent } from './line';
import { HELP, render } from './render';

type Budget = { model: string; thb_per_usd: number; paused: boolean; remaining_thb: number };
type State = { room: 'รออนุมัติ' | 'อนุมัติ' | 'ปฏิเสธ' | 'บอทออกแล้ว' | null; budget: Budget };

const RETRACT = /ตอบผิด|ผิดนะ|ไม่ถูก(ต้อง)?นะ|มั่ว/;

export async function handleEvent(ev: LineEvent, token: string) {
  const groupId = ev.source.groupId ?? ev.source.roomId;

  // บอทถูกเชิญเข้าห้อง → ลงทะเบียน รอ Bay อนุมัติ (LR-3) · ไม่พูดอะไรในห้อง
  if (ev.type === 'join' && groupId) {
    await call('room_join', { p_group_id: groupId, p_name: await groupName(token, groupId) });
    return;
  }
  if (ev.type === 'leave' && groupId) {
    await call('room_leave', { p_group_id: groupId });
    return;
  }

  // แชทส่วนตัวกับบอท · เฟส 1 ยังไม่ทำ (หมวด ค) · เงียบ
  if (ev.type !== 'message' || ev.message?.type !== 'text' || !groupId || !ev.replyToken) return;

  // ไม่ได้ทัก = เงียบ และไม่เก็บอะไรเลย (D1 · D3)
  const question = mentionedText(ev);
  if (question === null) return;

  const state = await call<State>('room_state', { p_group_id: groupId });
  if (state.room === null) {
    // ห้องที่บอทอยู่ก่อนระบบจะมี · ลงทะเบียนให้ Bay เห็น แล้วเงียบ
    await call('room_join', { p_group_id: groupId, p_name: await groupName(token, groupId) });
    return;
  }
  if (state.room !== 'อนุมัติ') return;          // LR-2
  if (state.budget.paused) return;                // LR-21

  // LR-4 · รับเหตุการณ์นี้ครั้งเดียว
  const fresh = await call<boolean>('claim_event', {
    p_event_id: ev.webhookEventId, p_group_id: groupId, p_question: question,
  });
  if (!fresh) return;

  const who = ev.source.userId ? await memberName(token, groupId, ev.source.userId) : null;
  const base = { line_user_id: ev.source.userId ?? null, display_name: who };
  const finish = (p: Record<string, unknown>) =>
    call('finish_request', { p_event_id: ev.webhookEventId, p: { ...base, ...p } });

  // LR-28 · ถอนคำตอบ · ไม่ต้องเรียก Claude
  if (RETRACT.test(question) && question.length < 40) {
    const q = await call<string | null>('flag_last', { p_group_id: groupId });
    const answer = q
      ? `⚠️ คำตอบก่อนหน้าของผม (${q.slice(0, 60)}) อาจผิด\nอย่าเพิ่งใช้นะครับ รอทีม CC ยืนยันอีกที\nผมแจ้ง Bay ให้ตรวจแล้วครับ`
      : 'ยังไม่มีคำตอบให้ถอนครับ';
    const r = await reply(token, ev.replyToken, answer);
    await finish({ status: r.ok ? 'ถอนคำตอบ' : 'ล้มเหลว', answer, error: r.error ?? null, data_used: 'flag_last' });
    return;
  }

  if (question.length === 0) {
    const r = await reply(token, ev.replyToken, HELP);
    await finish({ status: r.ok ? 'ตอบแล้ว' : 'ล้มเหลว', answer: HELP, error: r.error ?? null, data_used: '—' });
    return;
  }

  // งบ · เช็กแบบกรณีแย่สุด เหมือน content agent (LR-22)
  const price = LINE_MODELS.find((m) => m.id === state.budget.model) ?? LINE_MODELS[0];
  const thb = Number(state.budget.thb_per_usd);
  const cost = { model: price.id, usd_per_mtok_in: price.in, usd_per_mtok_out: price.out, thb_per_usd: thb };
  if (worstThb(price, question, thb) > Number(state.budget.remaining_thb)) {
    const answer = 'งบผู้ช่วยเดือนนี้หมดแล้วครับ · Bay เพิ่มงบได้ในระบบ';
    const r = await reply(token, ev.replyToken, answer);
    await finish({ status: 'งบหมด', answer, error: r.error ?? null, ...cost });
    return;
  }

  const c = await classify(price, question);
  if (!c.ok) {
    const answer = 'ขอโทษครับ ตอนนี้ผมตอบไม่ได้ ลองใหม่อีกครั้งนะครับ';
    const r = await reply(token, ev.replyToken, answer);
    await finish({ status: r.ok ? 'ล้มเหลว' : 'ไม่ทัน', answer, error: c.error, ...cost, ...(c.usage ?? {}) });
    return;
  }

  let out: Awaited<ReturnType<typeof render>>;
  try {
    out = await render(c.intent as Intent);
  } catch (e) {
    const answer = 'ขอโทษครับ ดึงข้อมูลจากระบบไม่ได้ ลองใหม่อีกครั้งนะครับ';
    await reply(token, ev.replyToken, answer);
    await finish({ status: 'ล้มเหลว', answer, intent: c.intent, error: String(e), ...cost, ...c.usage });
    return;
  }

  const r = await reply(token, ev.replyToken, out.answer);
  await finish({
    status: r.ok ? out.status : 'ไม่ทัน',
    answer: out.answer, intent: c.intent, data_used: out.dataUsed, error: r.error ?? null,
    ...cost, ...c.usage,
  });
}

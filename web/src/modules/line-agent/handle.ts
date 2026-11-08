/**
 * จัดการเหตุการณ์จาก LINE ทีละอัน
 *
 * ลำดับ: ห้องนี้อนุมัติไหม → ทักบอทไหม → พักอยู่ไหม → ซ้ำไหม → "ตอบผิด"? → เลือก BLS ของสลิป?
 *        → รูปงานเสร็จ? → งบพอไหม → สลิป? → Claude เลือกว่าจะดึงอะไร → โค้ดเขียนคำตอบตามสิทธิ์กลุ่ม → reply → บันทึก
 */
import { call } from './db';
import { syncAll } from '@/modules/sheets/sync';
import { classify, LINE_MODELS, worstThb } from './intent';
import { saveLineImage } from './images';
import { groupName, memberName, mentionedText, reply, type LineEvent } from './line';
import { HELP, render, thDate, type Flags } from './render';
import { readSlip, SLIP_IMAGE_TOKENS, SLIP_MAX_TOKENS } from './slip';

type Budget = { model: string; thb_per_usd: number; paused: boolean; remaining_thb: number };
type State = { room: 'รออนุมัติ' | 'อนุมัติ' | 'ปฏิเสธ' | 'บอทออกแล้ว' | null; flags: Flags; budget: Budget };
type SlipRow = {
  id: string; status: string; bls: string | null; amount: number | null; paid_on: string | null; bank: string | null;
  payer_name: string | null; candidates: { bls: string; customer_name: string | null; balance: number | null; score: number }[];
  ok?: boolean;
};

const NUM = ['①', '②', '③', '④', '⑤'];
const baht = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 }));
const blsIn = (t: string) => {
  const m = t.replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '').match(/(?:bls\s*)?(?<!\d)(\d{3,4}[a-z]?)(?!\d)/i);
  return m ? 'BLS' + m[1].toUpperCase() : null;
};

/** ข้อความถามยืนยันสลิป · เลือก BLS จากผู้ที่น่าจะใช่ (ชุด B) */
function slipReply(s: SlipRow) {
  const head = `🧾 สลิป ฿${baht(s.amount)}${s.paid_on ? ` · ${thDate(s.paid_on)}` : ''}${s.bank ? ` · ${s.bank}` : ''}${s.payer_name ? `\nผู้โอน: ${s.payer_name}` : ''}`;
  if (s.status === 'ไม่ใช่สลิป') return 'รูปนี้ไม่น่าใช่สลิปโอนเงินครับ · ถ้าใช่ แจ้งพี่ษาในระบบได้ครับ';
  if (s.status === 'ซ้ำ') return `${head}\n⚠️ สลิปนี้เคยส่งแล้ว (เลขอ้างอิงเดิม) · ไม่บันทึกซ้ำครับ`;
  if (s.status === 'รอการเงินยืนยัน') return `${head}\nผูกกับ ${s.bls} แล้ว · รอพี่ษายืนยันในระบบครับ`;
  const c = s.candidates ?? [];
  if (c.length === 0) return `${head}\nหาออเดอร์จากชื่อผู้โอนไม่เจอครับ · ตอบ "@Team Bay BLS…" เพื่อผูกเลขงาน`;
  if (c.length === 1 || c[0].score > (c[1]?.score ?? 0)) {
    const x = c[0];
    return `${head}\nน่าจะเป็น ${x.bls}${x.customer_name ? ` · ${x.customer_name}` : ''} (ค้าง ฿${baht(x.balance)})\nใช่ไหมครับ · ตอบ "@Team Bay ใช่" หรือพิมพ์เลข BLS ที่ถูก`;
  }
  return `${head}\nเป็นออเดอร์ไหนครับ\n` + c.map((x, i) => `${NUM[i]} ${x.bls}${x.customer_name ? ` · ${x.customer_name}` : ''} · ค้าง ฿${baht(x.balance)}`).join('\n')
    + '\nตอบ "@Team Bay 1" ตามข้อ หรือพิมพ์เลข BLS';
}

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

  // ชุด B · ตอบเลือก BLS ของสลิปที่รออยู่ ("ใช่" · "2" · "BLS3230") · ไม่ต้องเรียก Claude
  if (state.flags?.can_slip && ev.source.userId && question.length <= 20
      && /^(ใช่|ถูก|ok|โอเค|yes|y|[1-5]|(bls\s*)?\d{3,5}[a-z]?)$/i.test(question.trim())) {
    const picked = await call<SlipRow | null>('slip_pick', { p_group_id: groupId, p_line_user_id: ev.source.userId, p_choice: question });
    if (picked?.ok) {
      const answer = `✅ ผูกสลิป ฿${baht(picked.amount)} กับ ${picked.bls} แล้ว · รอพี่ษายืนยันในระบบครับ`;
      const r = await reply(token, ev.replyToken, answer);
      await finish({ status: r.ok ? 'ตอบแล้ว' : 'ไม่ทัน', answer, error: r.error ?? null, data_used: 'slip_pick' });
      return;
    }
  }

  // ชุด B · รูปงานเสร็จ · Reply รูป → "@Team Bay งานเสร็จ BLS3230" · ไม่ต้องเรียก Claude
  const quoted = ev.message?.quotedMessageId;
  if (quoted && /งานเสร็จ|เสร็จแล้ว/.test(question)) {
    const bls = blsIn(question);
    let answer: string;
    if (!state.flags?.can_photo) answer = 'กลุ่มนี้ไม่ได้เปิดให้เก็บรูปงานเสร็จครับ · ใช้ในกลุ่มเช็คงานได้ครับ';
    else if (!bls) answer = 'ขอเลข BLS ด้วยครับ เช่น "@Team Bay งานเสร็จ BLS3230"';
    else {
      try {
        const img = await saveLineImage(token, quoted, 'work');
        const n = await call<number>('photo_add', { p: { group_id: groupId, bls, line_message_id: quoted,
          image_path: img.path, line_user_id: ev.source.userId, display_name: who } });
        answer = `📷 เก็บรูปงานเสร็จ ${bls} แล้วครับ (รูปที่ ${n})`;
      } catch (e) {
        answer = 'เก็บรูปไม่สำเร็จครับ · ' + (e instanceof Error ? e.message : String(e));
      }
    }
    const r = await reply(token, ev.replyToken, answer);
    await finish({ status: r.ok ? (answer.startsWith('📷') ? 'ตอบแล้ว' : 'ตอบไม่ได้') : 'ไม่ทัน', answer, error: r.error ?? null, data_used: 'photo_add' });
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

  // ชุด B · สลิป · Reply รูป → "@Team Bay สลิป" · Claude อ่านรูป · ฐานข้อมูลจับคู่ BLS · คนยืนยัน
  if (quoted && /สลิป|slip|โอน/i.test(question)) {
    let answer: string; let usage = {};
    if (!state.flags?.can_slip) answer = 'กลุ่มนี้ไม่ได้เปิดให้อ่านสลิปครับ · ส่งในกลุ่ม PO ได้ครับ';
    else if (((SLIP_IMAGE_TOKENS + 800) * price.in + SLIP_MAX_TOKENS * price.out) / 1e6 * thb > Number(state.budget.remaining_thb)) {
      answer = 'งบผู้ช่วยเดือนนี้หมดแล้วครับ · Bay เพิ่มงบได้ในระบบ';
    } else {
      try {
        const img = await saveLineImage(token, quoted, 'slips');
        const read = await readSlip(price, img.data, img.type);
        if (!read.ok) throw new Error('อ่านสลิปไม่ได้ · ' + read.error);
        usage = read.usage;
        const row = await call<SlipRow>('slip_add', { p: {
          group_id: groupId, line_message_id: quoted, image_path: img.path, line_user_id: ev.source.userId,
          display_name: who, bls: blsIn(question.replace(/สลิป|slip/gi, '')), ...read.slip, ai_raw: read.slip } });
        answer = slipReply(row);
      } catch (e) {
        answer = 'อ่านสลิปไม่สำเร็จครับ · ' + (e instanceof Error ? e.message : String(e));
      }
    }
    const r = await reply(token, ev.replyToken, answer);
    await finish({ status: r.ok ? (answer.startsWith('🧾') ? 'ตอบแล้ว' : 'ตอบไม่ได้') : 'ไม่ทัน', answer,
      error: r.error ?? null, data_used: 'slip', ...cost, ...usage });
    return;
  }

  // ข้อมูลชีตเก่ากว่า 10 นาที → ดึงใหม่ระหว่างรอ Claude (S3) · ดึงไม่ได้ก็ตอบจากข้อมูลเดิม
  const sync = call<number>('sheets_age_minutes')
    .then((age) => (age > 10 ? syncAll().then(() => undefined) : undefined))
    .catch((e) => console.error('sheets sync', e));
  const [c] = await Promise.all([classify(price, question), sync]);
  if (!c.ok) {
    const answer = 'ขอโทษครับ ตอนนี้ผมตอบไม่ได้ ลองใหม่อีกครั้งนะครับ';
    const r = await reply(token, ev.replyToken, answer);
    await finish({ status: r.ok ? 'ล้มเหลว' : 'ไม่ทัน', answer, error: c.error, ...cost, ...(c.usage ?? {}) });
    return;
  }

  let out: Awaited<ReturnType<typeof render>>;
  try {
    out = await render(c.items, { groupId, flags: state.flags });
    // ชุด C · คำขอเลื่อน/เปลี่ยน จดค้างไว้ให้คน CC ปิด
    for (const it of c.items.filter((x) => x.intent === 'handoff')) {
      await call('change_add', { p_group_id: groupId, p_bls: it.order_no, p_text: question, p_name: who });
    }
  } catch (e) {
    const answer = 'ขอโทษครับ ดึงข้อมูลจากระบบไม่ได้ ลองใหม่อีกครั้งนะครับ';
    await reply(token, ev.replyToken, answer);
    await finish({ status: 'ล้มเหลว', answer, intent: c.items, error: String(e), ...cost, ...c.usage });
    return;
  }

  const r = await reply(token, ev.replyToken, out.answer);
  await finish({
    status: r.ok ? out.status : 'ไม่ทัน',
    answer: out.answer, intent: c.items, data_used: out.dataUsed, error: r.error ?? null,
    ...cost, ...c.usage,
  });
}

/**
 * จัดการเหตุการณ์จาก LINE ทีละอัน
 *
 * ลำดับ: ห้องนี้อนุมัติไหม → ทักบอทไหม (ไม่ทัก = เก็บเข้าคลังถ้าห้องเปิดเก็บ) → พักอยู่ไหม → ซ้ำไหม → "ตอบผิด"? → เลือก BLS ของสลิป?
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
// คำสั่งต้องขึ้นต้นข้อความ และไม่ใช่คำถาม · "3230 เสร็จแล้วหรือยัง" = ถามสถานะ ไม่ใช่สั่งเก็บรูป
const CMD_PHOTO = /^\s*(รูป)?งานเสร็จ/;
const CMD_SLIP = /^\s*(สลิป|slip)/i;
const ASKING = /(ยัง|ไหม|มั้ย|หรือเปล่า|\?)/;
// "@Team Bay จดเรื่องนี้ …" · ต้องขึ้นต้นด้วย "จดเรื่องนี้" หรือ "จดไว้" เท่านั้น (กัน "จดทะเบียน…" หลุดเข้ามา)
const CMD_NOTE = /^\s*จด(เรื่องนี้|ไว้)[\s:：\-–]*/;

/**
 * เก็บบทสนทนา (KB-B) · เฉพาะห้องที่ Bay เปิดเก็บและโพสต์แจ้งทีมแล้ว (R2) · ฐานข้อมูลเป็นคนตัดสิน ไม่ใช่โค้ดนี้
 * ข้อความที่ทักบอทไม่เก็บตรงนี้ (อยู่ใน requests อยู่แล้ว) · ผิดพลาดตรงนี้ต้องไม่ทำให้บอทตอบไม่ได้
 */
async function collect(ev: LineEvent, groupId: string, token: string) {
  try {
    const text = ev.message?.text;
    if (!text || !ev.message?.id) return;
    const r = await call<{ logged: boolean; need_name: boolean }>('kb_log_message', {
      p: {
        group_id: groupId, message_id: ev.message.id, line_user_id: ev.source.userId ?? null, text,
        sent_at: new Date(ev.timestamp ?? Date.now()).toISOString(),
      },
    });
    if (r?.need_name && ev.source.userId) {
      const name = await memberName(token, groupId, ev.source.userId);
      if (name) await call('kb_member_name', { p_user: ev.source.userId, p_name: name });
    }
  } catch (e) {
    console.error('kb collect', ev.webhookEventId, e);
  }
}

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

  // รูปในกลุ่มที่เปิดสลิป/รูปงาน · จำแค่เลขรูป 1 ชั่วโมง (0037) · ไม่ดึงรูป ไม่ตอบ
  // เพื่อให้คำสั่งเดียวได้ทั้งอัลบั้ม · กลุ่มอื่นฐานข้อมูลไม่จำ
  if (ev.type === 'message' && ev.message?.type === 'image' && groupId && ev.message.id) {
    await call('image_seen', {
      p_group_id: groupId, p_line_user_id: ev.source.userId ?? null, p_message_id: ev.message.id,
      p_set_id: ev.message.imageSet?.id ?? null, p_index: ev.message.imageSet?.index ?? null,
      p_total: ev.message.imageSet?.total ?? null,
    });
    return;
  }

  // แชทส่วนตัวกับบอท · เฟส 1 ยังไม่ทำ (หมวด ค) · เงียบ
  if (ev.type !== 'message' || ev.message?.type !== 'text' || !groupId || !ev.replyToken) return;

  // ไม่ได้ทัก = เงียบ · เก็บข้อความเข้าคลังเฉพาะห้องที่ Bay เปิดเก็บและแจ้งทีมแล้ว (D1 · R2)
  const question = mentionedText(ev);
  if (question === null) { await collect(ev, groupId, token); return; }

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

  // คลังความรู้ · "@Team Bay จดเรื่องนี้ …" หรือ Reply ข้อความที่เก็บไว้ · ไม่เรียก Claude · เป็นแค่ร่าง Bay ต้องตรวจก่อนใช้ (R4)
  if (CMD_NOTE.test(question)) {
    const res = await call<{ ok: boolean; title?: string; error?: string }>('kb_note_add', {
      p: { group_id: groupId, text: question.replace(CMD_NOTE, ''), quoted_message_id: ev.message?.quotedMessageId ?? null, display_name: who },
    });
    const answer = res.ok
      ? `📝 จดแล้วครับ: "${res.title}"\nBay จะตรวจในคลังความรู้ก่อนใช้จริงครับ`
      : res.error === 'no_quoted'
        ? 'จดจากข้อความที่ Reply ไม่ได้ครับ (ผมไม่ได้เก็บข้อความนั้นไว้) · พิมพ์เนื้อหาต่อท้ายคำสั่งแทนนะครับ เช่น "@Team Bay จดเรื่องนี้ …"'
        : res.error === 'empty'
          ? 'ขอเนื้อหาที่จะจดด้วยครับ · พิมพ์ "@Team Bay จดเรื่องนี้ …" หรือ Reply ข้อความที่ต้องการจด'
          : 'จดไม่ได้ครับ · ' + (res.error ?? '');
    const r = await reply(token, ev.replyToken, answer);
    await finish({ status: r.ok ? (res.ok ? 'ตอบแล้ว' : 'ตอบไม่ได้') : 'ไม่ทัน', answer, error: r.error ?? null, data_used: 'kb_note_add' });
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
  const quoted = ev.message?.quotedMessageId ?? null;
  /** รูปที่คำสั่งนี้หมายถึง · Reply รูปในอัลบั้ม = ทั้งอัลบั้ม · ไม่ Reply = รูปของคนนี้ใน 10 นาที */
  const imagesFor = () => call<string[]>('images_for', {
    p_group_id: groupId, p_line_user_id: ev.source.userId ?? null, p_quoted: quoted,
  });

  // ชุด B · รูปงานเสร็จ · "@Team Bay งานเสร็จ BLS3230" (Reply รูป หรือพิมพ์หลังส่งรูป) · ไม่ต้องเรียก Claude
  if (CMD_PHOTO.test(question) && !ASKING.test(question) && (quoted || state.flags?.can_photo)) {
    const bls = blsIn(question);
    let answer: string; let ok = false;
    if (!state.flags?.can_photo) answer = 'กลุ่มนี้ไม่ได้เปิดให้เก็บรูปงานเสร็จครับ · ใช้ในกลุ่มเช็คงานได้ครับ';
    else if (!bls) answer = 'ขอเลข BLS ด้วยครับ เช่น "@Team Bay งานเสร็จ BLS3230"';
    else {
      const ids = await imagesFor();
      if (ids.length === 0) answer = 'ไม่เจอรูปครับ · ส่งรูปก่อน แล้วพิมพ์ "@Team Bay งานเสร็จ BLS…" ภายใน 10 นาที หรือกดค้างที่รูปแล้ว Reply';
      else {
        let saved = 0; let total = 0; const errs: string[] = [];
        for (const id of ids) {
          try {
            const img = await saveLineImage(token, id, 'work');
            total = await call<number>('photo_add', { p: { group_id: groupId, bls, line_message_id: id,
              image_path: img.path, line_user_id: ev.source.userId, display_name: who } });
            saved++;
          } catch (e) { errs.push(e instanceof Error ? e.message : String(e)); }
        }
        ok = saved > 0;
        answer = ok
          ? `📷 เก็บรูปงานเสร็จ ${bls} แล้ว ${saved} รูปครับ (รวม ${total} รูป)` + (errs.length ? `\n⚠️ ไม่สำเร็จ ${errs.length} รูป` : '')
          : 'เก็บรูปไม่สำเร็จครับ · ' + errs[0];
      }
    }
    const r = await reply(token, ev.replyToken, answer);
    await finish({ status: r.ok ? (ok ? 'ตอบแล้ว' : 'ตอบไม่ได้') : 'ไม่ทัน', answer, error: r.error ?? null, data_used: 'photo_add' });
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

  // ชุด B · สลิป · "@Team Bay สลิป" (Reply รูป หรือพิมพ์หลังส่งรูป) · Claude อ่านทีละรูป · ฐานข้อมูลจับคู่ BLS · คนยืนยัน
  if (CMD_SLIP.test(question) && !ASKING.test(question) && (quoted || state.flags?.can_slip)) {
    let answer: string; let ok = false;
    const usage = { input_tokens: 0, output_tokens: 0 };
    const perSlip = ((SLIP_IMAGE_TOKENS + 800) * price.in + SLIP_MAX_TOKENS * price.out) / 1e6 * thb;
    if (!state.flags?.can_slip) answer = 'กลุ่มนี้ไม่ได้เปิดให้อ่านสลิปครับ · ส่งในกลุ่ม PO ได้ครับ';
    else {
      const ids = (await imagesFor()).slice(0, 5);
      if (ids.length === 0) answer = 'ไม่เจอรูปสลิปครับ · ส่งรูปก่อน แล้วพิมพ์ "@Team Bay สลิป" ภายใน 10 นาที หรือกดค้างที่รูปแล้ว Reply';
      else if (perSlip * ids.length > Number(state.budget.remaining_thb)) answer = 'งบผู้ช่วยเดือนนี้หมดแล้วครับ · Bay เพิ่มงบได้ในระบบ';
      else {
        const typed = blsIn(question.replace(/สลิป|slip/gi, ''));
        const parts: string[] = [];
        for (const [i, id] of ids.entries()) {
          try {
            const img = await saveLineImage(token, id, 'slips');
            const read = await readSlip(price, img.data, img.type);
            if (!read.ok) throw new Error(read.error);
            usage.input_tokens += read.usage.input_tokens; usage.output_tokens += read.usage.output_tokens;
            const row = await call<SlipRow>('slip_add', { p: {
              group_id: groupId, line_message_id: id, image_path: img.path, line_user_id: ev.source.userId,
              display_name: who, bls: ids.length === 1 ? typed : null, ...read.slip, ai_raw: read.slip } });
            parts.push((ids.length > 1 ? `${NUM[i]} ` : '') + slipReply(row));
            ok = true;
          } catch (e) {
            parts.push((ids.length > 1 ? `${NUM[i]} ` : '') + 'อ่านรูปนี้ไม่สำเร็จ · ' + (e instanceof Error ? e.message : String(e)));
          }
        }
        answer = parts.join('\n\n') + (ids.length > 1 ? '\n\nหลายใบ · ผูก BLS ได้ทีละใบในกลุ่ม หรือให้พี่ษาเลือกในหน้าสลิปครับ' : '');
      }
    }
    const r = await reply(token, ev.replyToken, answer);
    await finish({ status: r.ok ? (ok ? 'ตอบแล้ว' : 'ตอบไม่ได้') : 'ไม่ทัน', answer,
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

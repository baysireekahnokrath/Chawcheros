/**
 * ร่างข้อความถึงลูกค้า · ข้อความตายตัว เติมแค่ชื่อ สินค้า วันนัด · ไม่เรียก AI
 *
 * ระบบไม่ส่งเอง · พนักงานคัดลอกไปวางในแชทเดิมแล้วกดส่ง (กฎ AI 1 · LD-29)
 * ถ้อยคำมาจาก docs/modules/leads/mockup.html · ไม่มีราคา โปรฯ ที่อยู่ ในร่างพวกนี้
 * (ตอบราคาใช้ประโยคราคาตายตัวของ priceSentence() เท่านั้น ห้ามมีประโยคราคาแบบที่สอง)
 */
export type DraftKind = 'first' | 'brochure' | 'invite' | 'confirm';

export const SHOWROOM_PAGE = 'https://chawcher.com/showroom-visit/';

export type DraftInput = {
  display_name: string;
  product: string | null;
  topic: string | null;
  stage: string;
  appointment_on: string | null;
  appointment_time: string | null;
};

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

/** 2026-11-17 → "วันอังคารที่ 17 พ.ย." · คิดจากตัวเลขวันที่ตรงๆ ไม่ขึ้นกับเขตเวลาของเครื่อง */
export function thaiDate(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `วัน${DAYS[d.getUTCDay()]}ที่ ${+m[3]} ${MONTHS[+m[2] - 1]}`;
}

export const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');

/** ร่างแบบไหนที่เหมาะกับขั้นตอนนี้ของลูกค้า */
export function draftKindFor(l: Pick<DraftInput, 'stage' | 'topic'>): DraftKind {
  if (l.stage === 'ใหม่') return 'first';
  if (l.stage === 'นัดแล้ว') return 'confirm';
  if (l.stage === 'ตอบแล้ว' && l.topic === 'ขอโบรชัวร์') return 'brochure';
  return 'invite';
}

export const DRAFT_LABEL: Record<DraftKind, string> = {
  first: 'ร่างคำตอบแรก',
  brochure: 'ร่างข้อความทักตามหลังส่งโบรชัวร์',
  invite: 'ร่างข้อความชวนมาโชว์รูม',
  confirm: 'ร่างข้อความยืนยันนัด',
};

export function draftText(l: DraftInput, kind: DraftKind): string {
  const n = l.display_name.trim();
  const hi = `สวัสดีครับ${n ? ' ' + n : ''}`;
  if (kind === 'first') {
    return `${hi} ขอบคุณที่สนใจ CHAW CHER ครับ เดี๋ยวผมส่งรายละเอียดให้นะครับ ขอถามนิดเดียวครับ ต้องการใช้ช่วงไหนครับ`;
  }
  if (kind === 'brochure') {
    return `${hi} โบรชัวร์ที่ส่งให้ มีรุ่นไหนที่สนใจเป็นพิเศษไหมครับ ถ้าอยากเห็นของจริง เชิญมาลองนั่งที่โชว์รูม CHAW CHER ได้เลยครับ สะดวกวันไหนบอกผมได้ครับ`;
  }
  if (kind === 'confirm') {
    const when = [thaiDate(l.appointment_on), l.appointment_time ? `เวลา ${hhmm(l.appointment_time)} น.` : '']
      .filter(Boolean).join(' ');
    return `${hi} ยืนยันนัดชมโชว์รูม CHAW CHER${when ? ' ' + when : ''} นะครับ ถ้าต้องการเปลี่ยนเวลา แจ้งผมได้เลยครับ แล้วพบกันครับ`;
  }
  return `${hi} ${l.product ?? 'สินค้า'}ที่สอบถามไว้ ผมอยากชวนมาดูตัวจริงที่โชว์รูม CHAW CHER ครับ จะได้ลองนั่ง ดูผ้าจริง และเทียบขนาดกับห้องได้เลย สะดวกวันไหนครับ ผมจองเวลาไว้ให้ครับ ดูรายละเอียดการนัดได้ที่ ${SHOWROOM_PAGE}`;
}

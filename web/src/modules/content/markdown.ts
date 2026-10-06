/**
 * แปลงบทความ markdown ที่ agent เขียน → HTML สำหรับ WordPress (W-02)
 * รองรับเท่าที่ agent ใช้: หัวข้อ · ย่อหน้า · ตัวหนา/เอียง · ลิงก์ · รายการ · อ้างอิง
 * หัวเรื่อง # บรรทัดแรกตัดทิ้ง เพราะ WordPress แสดงหัวเรื่องเองแล้ว
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s: string): string {
  return esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  // ตัดหัวเรื่องบรรทัดแรก
  const firstReal = lines.findIndex((l) => l.trim() !== '');
  if (firstReal >= 0 && /^#\s/.test(lines[firstReal])) lines.splice(firstReal, 1);

  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;
  let quote: string[] = [];

  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
    if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; }
    if (quote.length) { out.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`); quote = []; }
  };

  for (const raw of lines) {
    const l = raw.trimEnd();
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    const ul = l.match(/^\s*[-*+]\s+(.*)$/);
    const ol = l.match(/^\s*\d+[.)]\s+(.*)$/);
    const q = l.match(/^>\s?(.*)$/);
    if (!l.trim()) { flush(); continue; }
    if (/^(-{3,}|\*{3,})$/.test(l.trim())) { flush(); out.push('<hr />'); continue; }
    if (h) {
      flush();
      // H1 ในเนื้อเป็น H2 · บทความมี H1 เดียวคือหัวเรื่อง (SEO)
      const lv = Math.max(2, h[1].length);
      out.push(`<h${lv}>${inline(h[2])}</h${lv}>`);
      continue;
    }
    if (ul || ol) {
      const tag = ul ? 'ul' : 'ol';
      if (para.length || quote.length || (list && list.tag !== tag)) flush();
      list ??= { tag, items: [] };
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    if (q) {
      if (para.length || list) flush();
      quote.push(q[1]);
      continue;
    }
    if (list || quote.length) flush();
    para.push(l.trim());
  }
  flush();
  return out.join('\n');
}

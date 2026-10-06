-- ============================================================================
-- 0029 · งาน AI ประเภท "ร่างแผน" · agent ร่างแผนเดือนให้การตลาดแก้ต่อ (Bay ขอ 2026-09-23)
-- ============================================================================
alter table content.ai_requests drop constraint ai_requests_kind_check;
alter table content.ai_requests add constraint ai_requests_kind_check
  check (kind in ('เขียนข้อความ', 'ไอเดียด่วน', 'สัมภาษณ์', 'แชท @AI', 'สรุปคู่แข่ง', 'คิดไอเดีย', 'ร่างแผน'));

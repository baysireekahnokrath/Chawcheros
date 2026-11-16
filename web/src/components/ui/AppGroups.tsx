import Link from 'next/link';
import Icon from '@/components/Icon';
import type { ModuleRow } from '@/modules/registry';
import { groupModules } from '@/modules/nav';

/** แอปทั้งหมดแยกหมวด · ใช้ทั้งหน้าแรกและหน้าเมนู */
export default function AppGroups({ modules }: { modules: ModuleRow[] }) {
  const groups = groupModules(modules);

  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        ยังไม่มีแอปที่คุณเข้าได้ · ให้ผู้ดูแลระบบให้สิทธิ์ก่อน
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`g-${g.id}`}>
          <h2 id={`g-${g.id}`} className="text-[11px] font-medium uppercase tracking-[0.14em] text-taupe">
            {g.label}
          </h2>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {g.items.map((m) => (
              <Link
                key={m.id}
                href={m.home_path ?? '/'}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-surface p-3 text-center text-[13px] transition hover:border-aqua"
              >
                <span
                  className={`inline-flex rounded-lg p-2 ${
                    m.id === 'cost' ? 'bg-locked/10 text-locked' : 'bg-aqua-soft text-accent'
                  }`}
                >
                  <Icon name={m.icon} className="h-5 w-5" />
                </span>
                <span className="leading-tight">{m.name_th}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

import { getMyModules } from '@/modules/registry';
import AppGroups from '@/components/ui/AppGroups';

/** เมนู · ช่องขวาสุดของแถบล่างบนมือถือ · แอปทั้งหมดแยกหมวด */
export default async function MenuPage() {
  const modules = await getMyModules();
  return (
    <div className="grid gap-5">
      <h1 className="text-xl font-semibold tracking-tight text-accent">เมนูทั้งหมด</h1>
      <AppGroups modules={modules} />
    </div>
  );
}

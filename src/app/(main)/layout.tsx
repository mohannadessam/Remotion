import { BottomNav } from "@/components/bottom-nav";
import { getCurrentProfile } from "@/lib/auth";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  return (
    <>
      <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom))]">{children}</div>
      <BottomNav role={profile?.role ?? null} />
    </>
  );
}

import { RESERVES_ENABLED } from '@/lib/features';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from './sign-out-button';

// يحمي كل /app بتسجيل الدخول. حجب الاشتراك نفسه في (pro)/layout.tsx.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div dir="rtl" className="flex-1 bg-[#f7f6f2]">
      <header className="border-b border-[#e8e6df] bg-white">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xl font-extrabold">
            فائض<span className="text-[#b98b42]">.</span>{' '}
            <span className="text-xs font-medium text-[#173f35] align-middle">PRO</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/app/account" className="text-[#737373] hover:text-[#173f35]">حسابي</Link>
            <SignOutButton />
          </div>
          <nav className="w-full flex items-center gap-5 text-sm overflow-x-auto whitespace-nowrap pb-1">
            <Link href="/app/plan" className="text-[#171717] hover:text-[#173f35] font-bold">الخطة</Link>
            {RESERVES_ENABLED && <Link href="/app/reserves" className="text-[#171717] hover:text-[#173f35] font-bold">فلوس محجوزة</Link>}
            <Link href="/app/windfall" className="text-[#171717] hover:text-[#173f35] font-bold">وصلني مبلغ</Link>
            <Link href="/app/history" className="text-[#171717] hover:text-[#173f35] font-bold">السجل</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">{children}</main>
    </div>
  );
}

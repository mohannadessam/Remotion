import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DeleteAccountButton from './delete-account-button';

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-3xl font-extrabold">حسابي</h1>

      <div className="bg-white border border-[#e8e6df] rounded-3xl p-6 text-sm leading-7">
        <div className="text-[#737373]">البريد</div>
        <div className="font-bold" dir="ltr">{user.email}</div>
      </div>

      <div className="bg-white border border-[#e8e6df] rounded-3xl p-6 space-y-3">
        <h2 className="font-bold">حذف الحساب</h2>
        <p className="text-sm text-[#737373] leading-7">
          يمسح حسابك وكل خططك ومبالغك وسجلك نهائيًا، وما يمكن استرجاعها.
          لو عندك اشتراك مدفوع، ألغه أول من رابط إدارة الاشتراك في بريد إيصال الدفع، لأن حذف الحساب ما يوقف التجديد.
        </p>
        <DeleteAccountButton />
      </div>
    </div>
  );
}

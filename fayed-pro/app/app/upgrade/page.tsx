import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasProAccess, type SubscriptionRow } from '@/lib/subscription';
import { isNativeApp } from '@/lib/native';

// يبني رابط الدفع مع معرّف المستخدم وبريده، عشان الـ webhook يعرف مين دفع.
// Lemon Squeezy يمرر checkout[custom][...] كـ meta.custom_data في كل أحداث الاشتراك.
function buildCheckoutUrl(base: string, userId: string, email: string) {
  const url = new URL(base);
  url.searchParams.set('checkout[custom][user_id]', userId);
  url.searchParams.set('checkout[email]', email);
  return url.toString();
}

const FEATURES = [
  'سجل كامل لخططك شهر بشهر مع رسم بياني لتطور صندوق الطوارئ',
  'تقرير شهري تلقائي بالبريد + تذكير لما يحين وقت الخطة',
  'تهنئة لما توصل 25% و50% و75% و100% من هدف الطوارئ',
  'عداد الأشهر المتتالية عشان تحافظ على العادة',
];

export default async function UpgradePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, ends_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (hasProAccess(sub as SubscriptionRow | null)) redirect('/app/plan');

  // داخل تطبيق الجوال ما نعرض الدفع الخارجي: Apple وGoogle يرفضون التطبيق لو فيه شراء اشتراك
  // رقمي بغير نظام الدفع حقهم. الاشتراك المدفوع من الموقع يشتغل في التطبيق تلقائيًا (نفس الحساب).
  const native = await isNativeApp();
  const base = process.env.NEXT_PUBLIC_LEMON_SQUEEZY_CHECKOUT_URL;
  const checkoutUrl = base && user.email ? buildCheckoutUrl(base, user.id, user.email) : null;
  const lapsed = sub?.status === 'cancelled' || sub?.status === 'expired';

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold mb-2">
          {lapsed ? 'انتهى اشتراكك' : 'فعّل فائض PRO'}
        </h1>
        <p className="text-[#737373] leading-7">
          {lapsed
            ? 'سجلك محفوظ وتقدر تشوفه بعد التجديد. جدّد عشان تكمل تتبّع خطتك من حيث وقفت.'
            : 'حوّل الحاسبة من لقطة لمرة وحدة إلى متابعة مستمرة لوضعك المالي.'}
        </p>
      </div>

      <ul className="bg-white border border-[#e8e6df] rounded-3xl p-6 space-y-3">
        {FEATURES.map((f) => (
          <li key={f} className="flex gap-3 text-sm leading-6">
            <span className="text-[#173f35] font-bold">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {native ? (
        <p className="bg-white border border-[#e8e6df] rounded-2xl p-4 text-sm text-center leading-7">
          الاشتراك غير متاح من داخل التطبيق. لو عندك اشتراك فعّال على نفس البريد، يشتغل هنا تلقائيًا.
        </p>
      ) : checkoutUrl ? (
        <a
          href={checkoutUrl}
          className="block text-center bg-[#173f35] text-white rounded-xl py-3.5 font-bold"
        >
          {lapsed ? 'جدّد الاشتراك' : 'اشترك الآن'}
        </a>
      ) : (
        <p className="text-sm text-[#9d3b35] text-center">
          رابط الدفع غير مُعدّ بعد (NEXT_PUBLIC_LEMON_SQUEEZY_CHECKOUT_URL).
        </p>
      )}

      <p className="text-xs text-[#737373] text-center leading-6">
        {native ? 'اشتركت للتو؟' : 'دفعت للتو؟'} تفعيل الاشتراك يأخذ عادة أقل من دقيقة.{' '}
        <Link href="/app/upgrade" className="underline">
          حدّث الصفحة
        </Link>
      </p>
    </div>
  );
}

import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// إعداد هذا الرابط في Lemon Squeezy: Settings → Webhooks
// الرابط: https://<your-domain>/api/webhooks/lemon-squeezy
// الأحداث: subscription_created, subscription_updated, subscription_cancelled,
//          subscription_resumed, subscription_expired, subscription_paused, subscription_unpaused

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(digest, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch {
    return false;
  }
}

// نعالج فقط أحداث كائن الاشتراك نفسه. أحداث subscription_payment_* تحمل فاتورة
// (status = paid/failed...) مو اشتراك، ومعالجتها هنا كانت تعطّل المشترك مع كل تجديد.
const SUBSCRIPTION_EVENTS = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_resumed',
  'subscription_expired',
  'subscription_paused',
  'subscription_unpaused',
]);

const STATUS_MAP: Record<string, 'active' | 'cancelled' | 'expired' | 'inactive'> = {
  active: 'active',
  on_trial: 'active',
  past_due: 'active', // مهلة سماح بينما Lemon Squeezy يعيد محاولة الخصم
  paused: 'inactive',
  unpaid: 'inactive',
  cancelled: 'cancelled', // ألغى التجديد، لكن مدته المدفوعة مستمرة حتى ends_at
  expired: 'expired',
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get('x-signature'))) {
    return NextResponse.json({ error: 'توقيع غير صالح' }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'JSON غير صالح' }, { status: 400 });
  }

  const eventName = payload?.meta?.event_name as string | undefined;
  const userId = payload?.meta?.custom_data?.user_id as string | undefined; // من checkout[custom][user_id]
  const attrs = payload?.data?.attributes;

  if (
    !eventName ||
    !SUBSCRIPTION_EVENTS.has(eventName) ||
    payload?.data?.type !== 'subscriptions' ||
    !userId ||
    !attrs
  ) {
    return NextResponse.json({ received: true, skipped: true });
  }

  const status = STATUS_MAP[attrs.status as string];
  if (!status) {
    // حالة جديدة ما نعرفها — لا نغيّر وصول المستخدم بناءً على تخمين
    return NextResponse.json({ received: true, skipped: 'unknown status' });
  }

  const supabase = createAdminClient();
  const eventTime = attrs.updated_at ? new Date(attrs.updated_at) : new Date();

  // الأحداث قد تصل بغير ترتيبها — نتجاهل أي حدث أقدم من آخر حدث طبّقناه
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('provider_updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing?.provider_updated_at && new Date(existing.provider_updated_at) > eventTime) {
    return NextResponse.json({ received: true, skipped: 'stale event' });
  }

  const { error } = await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      status,
      provider: 'lemon_squeezy',
      provider_customer_id: String(attrs.customer_id ?? ''),
      provider_subscription_id: String(payload.data.id ?? ''),
      renewed_at: attrs.renews_at ?? null,
      ends_at: attrs.ends_at ?? null,
      provider_updated_at: eventTime.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  // 23503: المستخدم حذف حسابه (/api/account/delete) — ما فيه أحد نحدّث اشتراكه، فلا داعي لإعادة المحاولة
  if (error?.code === '23503') {
    return NextResponse.json({ received: true, skipped: 'user deleted' });
  }
  if (error) {
    // 500 يخلي Lemon Squeezy يعيد المحاولة لاحقًا
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

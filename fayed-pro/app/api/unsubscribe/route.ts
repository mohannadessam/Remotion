import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyUnsubscribe } from '@/lib/unsubscribe';

// POST فقط: برامج البريد وفاحصات الروابط تفتح روابط GET تلقائيًا، فما نلغي عند مجرد الفتح.
// يُستدعى من زر صفحة /unsubscribe، ومن زر "إلغاء الاشتراك" في Gmail (RFC 8058).
export async function POST(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('u');
  if (!verifyUnsubscribe(userId, url.searchParams.get('t'))) {
    return NextResponse.json({ error: 'رابط غير صالح' }, { status: 400 });
  }
  const { error } = await createAdminClient()
    .from('email_prefs')
    .upsert({ user_id: userId, unsubscribed: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: 'تعذّر الحفظ' }, { status: 500 });
  return NextResponse.json({ unsubscribed: true });
}

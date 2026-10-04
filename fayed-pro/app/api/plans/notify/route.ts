import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeStreak, reachedMilestones } from '@/lib/retention';
import { renderMilestoneEmail } from '@/lib/email/milestone';
import { hasProAccess, type SubscriptionRow } from '@/lib/subscription';
import { claimNotification, releaseNotification } from '@/lib/notifications';
import { unsubscribeHeaders, unsubscribeLinks } from '@/lib/unsubscribe';

// يُستدعى من الواجهة بعد نجاح حفظ خطة الشهر. يرجع عداد الاستمرارية، ويرسل بريد
// تهنئة مرة واحدة فقط في عمر الحساب لكل عتبة (25/50/75/100%) من هدف الطوارئ.

interface PlanRow {
  month: string;
  essential: number;
  emergency: number;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { month?: string };
  const month = body.month;
  if (!month || !/^\d{4}-\d{2}-01$/.test(month)) {
    return NextResponse.json({ error: 'صيغة الشهر غير صحيحة' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'غير مسجّل دخول' }, { status: 401 });
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, ends_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!hasProAccess(sub as SubscriptionRow | null)) {
    return NextResponse.json({ error: 'يتطلب اشتراك PRO' }, { status: 403 });
  }

  const { data: plans, error } = await supabase
    .from('plans')
    .select('month, essential, emergency')
    .eq('user_id', user.id)
    .order('month', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (plans ?? []) as PlanRow[];
  const streak = computeStreak(rows.map((r) => r.month));
  const current = rows.find((r) => r.month === month);
  if (!current) {
    return NextResponse.json({ streak, milestone: null });
  }

  const emergencyGoal = current.essential * 6;
  const reached = reachedMilestones((current.emergency / emergencyGoal) * 100);
  if (reached.length === 0) {
    return NextResponse.json({ streak, milestone: null });
  }

  const top = reached[reached.length - 1];
  const admin = createAdminClient();
  const isNew = await claimNotification(admin, user.id, 'milestone', String(top));
  if (!isNew) {
    // هنّأناه على هذي العتبة (أو أعلى منها) من قبل
    return NextResponse.json({ streak, milestone: null });
  }

  // نعلّم العتبات الأدنى كمُحتفل بها أيضًا، عشان ما يوصله "25%" بعد ما هنّأناه على 75%
  const lower = reached.slice(0, -1).map((t) => ({ user_id: user.id, kind: 'milestone', ref: String(t) }));
  if (lower.length > 0) {
    await admin
      .from('notifications_sent')
      .upsert(lower, { onConflict: 'user_id,kind,ref', ignoreDuplicates: true });
  }

  let emailSent = false;
  const resendKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const { data: prefs } = await admin.from('email_prefs').select('unsubscribed').eq('user_id', user.id).maybeSingle();
  // التهنئة تظهر في الواجهة دائمًا؛ البريد فقط لو ما أوقف الرسائل
  if (resendKey && emailFrom && appUrl && process.env.UNSUBSCRIBE_SECRET && !prefs?.unsubscribed) {
    const links = unsubscribeLinks(appUrl, user.id);
    const { error: sendError } = await new Resend(resendKey).emails.send({
      from: emailFrom,
      to: user.email,
      subject:
        top === 100
          ? '🏆 صندوق طوارئك مكتمل — فائض PRO'
          : `${top}% من هدف صندوق الطوارئ — فائض PRO`,
      headers: unsubscribeHeaders(links),
      html: renderMilestoneEmail({
        appUrl,
        milestone: top,
        emergency: current.emergency,
        emergencyGoal,
        streak,
        unsubscribeUrl: links.page,
      }),
    });
    if (sendError) {
      // نلغي حجز العتبة الأعلى فقط، عشان تنجح المحاولة في الحفظ القادم
      await releaseNotification(admin, user.id, 'milestone', String(top));
    } else {
      emailSent = true;
    }
  }

  return NextResponse.json({ streak, milestone: top, emailSent });
}

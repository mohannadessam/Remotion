import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';
import { renderMonthlyReportEmail, renderReminderEmail } from '@/lib/email/monthly-report';
import { monthKey, previousMonthKey, monthLabel } from '@/lib/month';
import { hasProAccess, type SubscriptionRow } from '@/lib/subscription';
import { claimNotification, releaseNotification, type NotificationKind } from '@/lib/notifications';
import { unsubscribeHeaders, unsubscribeLinks } from '@/lib/unsubscribe';
import type { Allocation } from '@/lib/calculator';
import type { Step } from '@/lib/planner';

// يُستدعى أول كل شهر (vercel.json). لكل مشترك له حق الوصول:
//  - لو حفظ خطة الشهر اللي انتهى → تقرير عن ذاك الشهر + دعوة لخطة الشهر الجديد
//  - لو ما حفظها → تذكير بخطة الشهر الجديد
// كل إرسال محجوز مسبقًا في notifications_sent، فإعادة تشغيل الكرون ما تكرر أي بريد.

export const maxDuration = 300;

interface PlanRow {
  month: string;
  surplus: number;
  essential: number;
  emergency: number;
  allocation: Allocation | null;
  steps: Step[] | null;
  done: Record<string, boolean> | null;
}

export async function GET(request: Request) {
  return handleRun(request);
}

export async function POST(request: Request) {
  return handleRun(request);
}

async function handleRun(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== expected) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!resendKey || !emailFrom || !appUrl || !process.env.UNSUBSCRIBE_SECRET) {
    return NextResponse.json(
      { error: 'إعدادات البريد غير مكتملة (RESEND_API_KEY / EMAIL_FROM / NEXT_PUBLIC_APP_URL / UNSUBSCRIBE_SECRET)' },
      { status: 500 }
    );
  }

  const resend = new Resend(resendKey);
  const admin = createAdminClient();

  const { data: subs, error: subsError } = await admin
    .from('subscriptions')
    .select('user_id, status, ends_at')
    .in('status', ['active', 'cancelled']);
  if (subsError) {
    return NextResponse.json({ error: subsError.message }, { status: 500 });
  }

  // الكرون يشتغل 06:00 UTC يوم 1 = 09:00 بتوقيت السعودية، نفس الشهر في التوقيتين
  const newMonth = monthKey(new Date());
  const endedMonth = previousMonthKey(newMonth);
  const newLabel = monthLabel(newMonth);
  const endedLabel = monthLabel(endedMonth);

  // اللي أوقفوا الرسائل ما نرسل لهم
  const { data: optedOut } = await admin.from('email_prefs').select('user_id').eq('unsubscribed', true);
  const skip = new Set((optedOut ?? []).map((r) => r.user_id));

  const eligible = (subs ?? []).filter(
    (s) => hasProAccess(s as SubscriptionRow) && !skip.has(s.user_id)
  ) as (SubscriptionRow & { user_id: string })[];

  const results: { userId: string; outcome: string }[] = [];

  for (const sub of eligible) {
    let claimed: { kind: NotificationKind; ref: string } | null = null;
    try {
      const { data: userRes } = await admin.auth.admin.getUserById(sub.user_id);
      const email = userRes?.user?.email;
      if (!email) {
        results.push({ userId: sub.user_id, outcome: 'skipped: no email' });
        continue;
      }

      // آخر خطتين حتى نهاية الشهر المنتهي
      const { data: plans } = await admin
        .from('plans')
        .select('month, surplus, essential, emergency, allocation, steps, done')
        .eq('user_id', sub.user_id)
        .lte('month', endedMonth)
        .order('month', { ascending: false })
        .limit(2);
      const rows = (plans ?? []) as PlanRow[];
      const ended = rows[0]?.month === endedMonth ? rows[0] : null;
      const links = unsubscribeLinks(appUrl, sub.user_id);
      const headers = unsubscribeHeaders(links);

      if (ended) {
        claimed = { kind: 'monthly_report', ref: endedMonth };
        if (!(await claimNotification(admin, sub.user_id, claimed.kind, claimed.ref))) {
          results.push({ userId: sub.user_id, outcome: 'skipped: already sent' });
          continue;
        }
        const previous = rows[1] ?? null;
        const emergencyGoal = ended.essential * 6;
        // رصيد الطوارئ آخر الشهر = أوله + حصته لو أشّر إنه حوّلها
        // + حصص الطوارئ المؤكدة من مبالغ وصلته في نفس الشهر
        const { data: wfs } = await admin.from('windfalls').select('steps, done').eq('user_id', sub.user_id).eq('month', endedMonth);
        const fromWindfalls = ((wfs ?? []) as { steps: Step[] | null; done: Record<string, boolean> | null }[])
          .filter((w) => w.done?.emergency)
          .reduce((a, w) => a + Number(w.steps?.find((x) => x.id === 'emergency')?.amount ?? 0), 0);
        const emergencyEnd =
          Number(ended.emergency) + (ended.done?.emergency ? Number(ended.allocation?.emergency ?? 0) : 0) + fromWindfalls;
        const steps = ended.steps ?? [];
        const { error } = await resend.emails.send({
          from: emailFrom,
          to: email,
          subject: `ملخص ${endedLabel} — فائض PRO`,
          headers,
          html: renderMonthlyReportEmail({
            appUrl,
            monthLabel: endedLabel,
            nextMonthLabel: newLabel,
            emergency: emergencyEnd,
            emergencyGoal,
            emergencyProgress: (emergencyEnd / emergencyGoal) * 100,
            emergencyDelta: previous ? emergencyEnd - Number(previous.emergency) : null,
            surplus: Number(ended.surplus),
            stepsDone: steps.filter((s) => ended.done?.[s.id]).length,
            stepsTotal: steps.length,
            unsubscribeUrl: links.page,
          }),
        });
        if (error) throw new Error(error.message);
        results.push({ userId: sub.user_id, outcome: 'report_sent' });
      } else {
        claimed = { kind: 'monthly_reminder', ref: newMonth };
        if (!(await claimNotification(admin, sub.user_id, claimed.kind, claimed.ref))) {
          results.push({ userId: sub.user_id, outcome: 'skipped: already sent' });
          continue;
        }
        const { error } = await resend.emails.send({
          from: emailFrom,
          to: email,
          subject: `حان وقت خطة ${newLabel} — فائض`,
          headers,
          html: renderReminderEmail({ appUrl, monthLabel: newLabel, unsubscribeUrl: links.page }),
        });
        if (error) throw new Error(error.message);
        results.push({ userId: sub.user_id, outcome: 'reminder_sent' });
      }

      // مهلة بسيطة لتفادي حد معدل الإرسال في الخطط المجانية
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      if (claimed) await releaseNotification(admin, sub.user_id, claimed.kind, claimed.ref);
      results.push({
        userId: sub.user_id,
        outcome: `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return NextResponse.json({ endedMonth, newMonth, processed: results.length, results });
}

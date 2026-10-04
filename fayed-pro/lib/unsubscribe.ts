import { createHmac, timingSafeEqual } from 'crypto';

// روابط إلغاء الرسائل موقّعة، عشان ما يقدر أحد يلغي رسائل غيره بتغيير المعرّف في الرابط.
// للخادم فقط (يستخدم UNSUBSCRIBE_SECRET).

function sign(userId: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET غير مضبوط');
  return createHmac('sha256', secret).update(`unsubscribe:${userId}`).digest('hex').slice(0, 32);
}

export function verifyUnsubscribe(userId: unknown, token: unknown): userId is string {
  if (typeof userId !== 'string' || typeof token !== 'string' || token.length !== 32) return false;
  try {
    return timingSafeEqual(Buffer.from(sign(userId)), Buffer.from(token));
  } catch {
    return false;
  }
}

/** رابط الصفحة (للزر في البريد) ورابط الإلغاء بضغطة (لترويسة List-Unsubscribe) */
export function unsubscribeLinks(appUrl: string, userId: string) {
  const q = `u=${encodeURIComponent(userId)}&t=${sign(userId)}`;
  return { page: `${appUrl}/unsubscribe?${q}`, oneClick: `${appUrl}/api/unsubscribe?${q}` };
}

/** ترويسات تخلي Gmail وغيره يعرضون زر "إلغاء الاشتراك" بجانب المرسل */
export function unsubscribeHeaders(links: { oneClick: string }) {
  return {
    'List-Unsubscribe': `<${links.oneClick}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

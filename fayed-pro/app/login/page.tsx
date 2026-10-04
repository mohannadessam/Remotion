'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// الدخول بالبريد: رابط سحري، أو رمز من نفس الرسالة.
// الرمز ضروري لتطبيق الجوال: الرابط ينفتح في متصفح الجوال وجلسته ما توصل للتطبيق،
// أما الرمز فينكتب داخل التطبيق نفسه فتنحفظ الجلسة فيه.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus('error');
      setError('تعذّر إرسال رابط الدخول. تأكد من صحة البريد وحاول مرة أخرى.');
      return;
    }
    setStatus('sent');
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setStatus('verifying');
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    if (error) {
      setStatus('sent');
      setError('الرمز غير صحيح أو انتهت صلاحيته. تأكد منه أو اطلب رمزًا جديدًا.');
      return;
    }
    router.replace('/app/plan');
    router.refresh();
  }

  const codeStage = status === 'sent' || status === 'verifying';

  return (
    <main className="flex-1 flex items-center justify-center bg-[#f7f6f2] px-4" dir="rtl">
      <div className="w-full max-w-sm bg-white border border-[#e8e6df] rounded-3xl p-8 shadow-sm">
        <div className="text-2xl font-extrabold mb-1">
          فائض<span className="text-[#b98b42]">.</span> <span className="text-sm font-medium text-[#173f35]">PRO</span>
        </div>
        <p className="text-[#737373] text-sm mb-6 leading-7">
          سجّل دخولك ببريدك الإلكتروني — بدون كلمة مرور، نرسل لك رابط دخول ورمزًا.
        </p>

        {codeStage ? (
          <div className="space-y-4">
            <div className="bg-[#dfece7] text-[#173f35] rounded-xl p-4 text-sm leading-7">
              أرسلنا رسالة الدخول إلى <strong>{email}</strong>. اضغط الرابط اللي فيها، أو اكتب الرمز هنا.
            </div>
            <form onSubmit={handleVerify} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="[0-9]{6,10}"
                placeholder="الرمز من البريد"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full border border-[#e8e6df] rounded-xl px-4 py-3 outline-none focus:border-[#173f35] text-center tracking-[0.4em] text-lg"
                dir="ltr"
              />
              {error && <p className="text-[#9d3b35] text-sm">{error}</p>}
              <button
                type="submit"
                disabled={status === 'verifying'}
                className="w-full bg-[#173f35] text-white rounded-xl py-3 font-bold disabled:opacity-60"
              >
                {status === 'verifying' ? 'جاري التحقق...' : 'دخول'}
              </button>
            </form>
            <button
              type="button"
              onClick={() => { setStatus('idle'); setCode(''); setError(''); }}
              className="w-full text-sm text-[#737373] underline"
            >
              غيّر البريد أو أرسل من جديد
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="بريدك الإلكتروني"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[#e8e6df] rounded-xl px-4 py-3 outline-none focus:border-[#173f35]"
              dir="ltr"
            />
            {status === 'error' && <p className="text-[#9d3b35] text-sm">{error}</p>}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full bg-[#173f35] text-white rounded-xl py-3 font-bold disabled:opacity-60"
            >
              {status === 'sending' ? 'جاري الإرسال...' : 'أرسل رابط الدخول'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

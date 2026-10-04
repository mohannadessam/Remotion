'use client';

import { useState } from 'react';

// تأكيد بخطوتين داخل الصفحة (بدل confirm() اللي ما يشتغل بنفس الشكل في كل WebView)
export default function DeleteAccountButton() {
  const [stage, setStage] = useState<'idle' | 'confirm' | 'busy' | 'error'>('idle');

  async function handleDelete() {
    setStage('busy');
    const res = await fetch('/api/account/delete', { method: 'POST' }).catch(() => null);
    if (!res?.ok) {
      setStage('error');
      return;
    }
    window.location.replace('/login');
  }

  if (stage === 'idle') {
    return (
      <button onClick={() => setStage('confirm')} className="w-full border border-[#9d3b35] text-[#9d3b35] rounded-xl py-3 font-bold">
        حذف حسابي
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-[#9d3b35]">متأكد؟ هذي الخطوة نهائية.</p>
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={stage === 'busy'}
          className="flex-1 bg-[#9d3b35] text-white rounded-xl py-3 font-bold disabled:opacity-60"
        >
          {stage === 'busy' ? 'جاري الحذف...' : 'نعم، احذف نهائيًا'}
        </button>
        <button onClick={() => setStage('idle')} disabled={stage === 'busy'} className="flex-1 border border-[#e8e6df] rounded-xl py-3 font-bold">
          تراجع
        </button>
      </div>
      {stage === 'error' && <p className="text-xs text-[#9d3b35]">تعذّر حذف الحساب. حاول مرة ثانية.</p>}
    </div>
  );
}

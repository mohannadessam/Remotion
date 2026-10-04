'use client';

import { useState } from 'react';

export default function UnsubscribeButton({ query }: { query: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function run() {
    setState('busy');
    const res = await fetch(`/api/unsubscribe?${query}`, { method: 'POST' }).catch(() => null);
    setState(res?.ok ? 'done' : 'error');
  }

  if (state === 'done') return <p className="text-sm font-bold text-[#173f35]">✓ تم. ما راح توصلك رسائل من فائض.</p>;
  return (
    <>
      <button onClick={run} disabled={state === 'busy'} className="w-full bg-[#173f35] text-white rounded-xl py-3 font-bold disabled:opacity-60">
        {state === 'busy' ? 'جاري الإيقاف...' : 'أوقف الرسائل'}
      </button>
      {state === 'error' && <p className="text-sm text-[#9d3b35]">تعذّر الإيقاف، حاول مرة ثانية.</p>}
    </>
  );
}

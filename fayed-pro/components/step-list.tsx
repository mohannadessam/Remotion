'use client';

import type { Step } from '@/lib/planner';

/** قائمة خطوات قابلة للتأشير — نفسها للخطة الشهرية ولـ"وصلني مبلغ" */
export default function StepList({ steps, done, onToggle, disabled }: {
  steps: Step[];
  done: Record<string, boolean>;
  onToggle: (stepId: string, checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {steps.map((s) => {
        const isDone = !!done[s.id];
        return (
          <label key={s.id} className={`flex items-start gap-3 rounded-xl p-3 border cursor-pointer text-sm leading-6 ${isDone ? 'bg-[#dfece7] border-transparent' : 'border-[#e8e6df]'}`}>
            <input type="checkbox" checked={isDone} disabled={disabled} onChange={(e) => onToggle(s.id, e.target.checked)} className="mt-1 w-4 h-4 accent-[#173f35] shrink-0" />
            <span className={isDone ? 'line-through text-[#737373]' : ''}>{s.text}</span>
          </label>
        );
      })}
    </div>
  );
}

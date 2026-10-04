'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { loadPlans, loadReserves, loadWindfalls } from '@/lib/data';
import { buildReportData, buildWindfallReportData, renderReportCanvas, reportFile, canvasBlob } from '@/lib/report';
import { monthLabel } from '@/lib/month';
import { saveFile } from '@/lib/save-file';

// زر يفتح معاينة تقرير (شهر، أو مبلغ محفوظ لو تحدد windfallId)، ويحفظه صورة أو PDF.
// يجلب بياناته طازجة وقت الفتح، فيعكس آخر خطوات أشّر عليها المستخدم.
export default function ReportButton({ month, windfallId, title, label = 'احفظ تقرير الشهر (صورة أو PDF)', className }: {
  month?: string;
  windfallId?: string;
  title?: string;
  label?: string;
  className?: string;
}) {
  const heading = title ?? (month ? `تقرير ${monthLabel(month)}` : 'تقرير');
  const filename = useRef('');
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'err'; text: string }>({ kind: 'idle', text: '' });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function openDialog() {
    setOpen(true);
    setStatus({ kind: 'busy', text: 'جاري تجهيز التقرير...' });
    try {
      const supabase = createClient();
      let data;
      if (windfallId) {
        const [plans, windfalls] = await Promise.all([loadPlans(supabase), loadWindfalls(supabase)]);
        data = buildWindfallReportData(windfalls, windfallId, plans);
      } else if (month) {
        const [plans, reserves, windfalls] = await Promise.all([loadPlans(supabase), loadReserves(supabase), loadWindfalls(supabase)]);
        data = buildReportData(plans, reserves, month, windfalls);
      }
      if (!data) throw new Error('no data');
      filename.current = data.filename;
      const c = renderReportCanvas(data);
      canvasRef.current = c;
      setPreview(URL.createObjectURL(await canvasBlob(c, 'image/png')));
      setStatus({ kind: 'idle', text: '' });
    } catch {
      setStatus({ kind: 'err', text: 'تعذّر تجهيز التقرير. حاول مرة ثانية.' });
    }
  }

  async function save(kind: 'png' | 'pdf') {
    if (!canvasRef.current) return;
    setStatus({ kind: 'busy', text: 'جاري التجهيز...' });
    try {
      const f = await reportFile(canvasRef.current, kind, filename.current);
      const how = await saveFile(f.blob, f.filename);
      setStatus(how === 'shared'
        ? { kind: 'idle', text: '' }
        : { kind: 'ok', text: kind === 'pdf' ? 'انحفظ ملف PDF.' : 'انحفظت الصورة.' });
    } catch {
      setStatus({ kind: 'err', text: 'تعذّر إنشاء الملف. حاول مرة ثانية.' });
    }
  }

  return (
    <>
      <button type="button" onClick={openDialog} className={className ?? 'w-full border border-[#e8e6df] rounded-xl py-3 font-bold text-sm bg-white hover:border-[#173f35]'}>
        {label}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={heading}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[calc(100%-2rem)] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8e6df]">
              <strong>{heading}</strong>
              <button onClick={() => setOpen(false)} className="text-2xl leading-none text-[#737373] px-2" aria-label="إغلاق">×</button>
            </div>
            <div className="overflow-auto p-4 bg-[#f7f6f2] min-h-40">
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt={`معاينة ${heading}`} className="w-full rounded-lg border border-[#e8e6df]" />
              )}
            </div>
            <div className="p-4 border-t border-[#e8e6df] space-y-2">
              <div className="flex gap-2">
                <button disabled={!preview || status.kind === 'busy'} onClick={() => save('png')} className="flex-1 bg-[#173f35] text-white rounded-xl py-3 font-bold disabled:opacity-50">حفظ صورة</button>
                <button disabled={!preview || status.kind === 'busy'} onClick={() => save('pdf')} className="flex-1 border border-[#e8e6df] rounded-xl py-3 font-bold disabled:opacity-50">حفظ PDF</button>
              </div>
              {status.text && (
                <p className={`text-xs text-center ${status.kind === 'err' ? 'text-[#9d3b35]' : status.kind === 'ok' ? 'text-[#173f35]' : 'text-[#737373]'}`}>{status.text}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

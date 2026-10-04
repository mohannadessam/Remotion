import { verifyUnsubscribe } from '@/lib/unsubscribe';
import UnsubscribeButton from './unsubscribe-button';

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { u, t } = await searchParams;
  const valid = verifyUnsubscribe(u, t);

  return (
    <main dir="rtl" className="flex-1 flex items-center justify-center bg-[#f7f6f2] px-4">
      <div className="w-full max-w-sm bg-white border border-[#e8e6df] rounded-3xl p-8 space-y-4">
        <div className="text-2xl font-extrabold">
          فائض<span className="text-[#b98b42]">.</span>
        </div>
        {valid ? (
          <>
            <h1 className="text-lg font-bold">إيقاف رسائل فائض</h1>
            <p className="text-sm text-[#737373] leading-7">
              ما راح يوصلك التقرير الشهري ولا التذكير ولا رسائل التهنئة. حسابك وخططك يبقون زي ما هم.
            </p>
            <UnsubscribeButton query={`u=${encodeURIComponent(u as string)}&t=${encodeURIComponent(t as string)}`} />
          </>
        ) : (
          <p className="text-sm text-[#9d3b35] leading-7">الرابط غير صالح. استخدم الرابط الموجود في آخر رسالة وصلتك.</p>
        )}
      </div>
    </main>
  );
}

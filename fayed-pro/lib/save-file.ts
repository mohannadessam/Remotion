// حفظ ملف (صورة أو PDF التقرير) من المتصفح أو من تطبيق الجوال.
// داخل التطبيق (Capacitor) رابط التنزيل ما يشتغل، فنكتب الملف بإضافة Filesystem ونفتح قائمة
// المشاركة (حفظ في الصور/الملفات، واتساب...). الإضافتان مثبّتتان في mobile/package.json.

// الموقع ما يضمّن @capacitor/core، فنستخدم الجسر اللي يحقنه التطبيق في window.Capacitor مباشرة
type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
  nativePromise?: <T>(plugin: string, method: string, options: object) => Promise<T>;
};

function capacitor(): Required<CapacitorBridge> | null {
  const cap = (globalThis as { Capacitor?: CapacitorBridge }).Capacitor;
  if (!cap?.isNativePlatform?.() || !cap.nativePromise || !cap.isPluginAvailable) return null;
  if (!cap.isPluginAvailable('Filesystem') || !cap.isPluginAvailable('Share')) return null;
  return cap as Required<CapacitorBridge>;
}

function toBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

// يرجّع 'shared' لو انفتحت قائمة المشاركة، و'downloaded' لو نزل الملف مباشرة
export async function saveFile(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  const cap = capacitor();
  if (cap) {
    const { uri } = await cap.nativePromise<{ uri: string }>('Filesystem', 'writeFile', {
      path: filename,
      data: await toBase64(blob),
      directory: 'CACHE',
    });
    try {
      await cap.nativePromise('Share', 'share', { title: filename, files: [uri] });
    } catch (e) {
      // إغلاق قائمة المشاركة بدون اختيار مو خطأ
      if (!/cancel/i.test(String((e as Error)?.message ?? e))) throw e;
    }
    return 'shared';
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

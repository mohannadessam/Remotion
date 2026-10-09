"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { DEMO_MODE } from "@/lib/demo/mode";
import { createClient } from "@/lib/supabase/client";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Uploads to a public bucket under `<userId>/`, as required by the storage policies. */
export function ImageUpload({
  bucket,
  userId,
  value,
  onChange,
  labels,
}: {
  bucket: "menu-images" | "truck-logos";
  userId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  labels: { add: string; change: string; remove: string; failed: string };
}) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function upload(file: File) {
    const ext = EXT[file.type];
    if (!ext) return setFailed(true);
    setBusy(true);
    setFailed(false);
    const supabase = createClient();
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
    setBusy(false);
    if (error) return setFailed(true);
    onChange(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl);
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
        {value ? (
          <Image src={value} alt="" fill sizes="80px" className="object-cover" />
        ) : (
          <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
        )}
      </div>
      {/* Uploads need Supabase Storage, which demo mode doesn't have. */}
      {DEMO_MODE ? null : (
      <div className="flex flex-col gap-1">
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
        <Button asChild variant="outline" size="sm" aria-disabled={busy}>
          <label htmlFor={inputId} className="cursor-pointer">
            {value ? labels.change : labels.add}
          </label>
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 aria-hidden />
            {labels.remove}
          </Button>
        ) : null}
        {failed ? (
          <p role="alert" className="text-sm text-destructive">
            {labels.failed}
          </p>
        ) : null}
      </div>
      )}
    </div>
  );
}

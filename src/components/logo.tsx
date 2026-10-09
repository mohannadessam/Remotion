import { cn } from "@/lib/utils";

/** Brand mark: circle with a truck glyph and a green "live" dot. */
export function Logo({ className, withWordmark = true, label }: { className?: string; withWordmark?: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG */}
      <img src="/logo.svg" alt={withWordmark ? "" : label} width={36} height={36} className="size-9" />
      {withWordmark ? <span className="text-xl font-extrabold text-primary">{label}</span> : null}
    </span>
  );
}

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { CrowdLevel } from "@/lib/crowd";
import { cn } from "@/lib/utils";

const DOT: Record<CrowdLevel | "offline", string> = {
  empty: "bg-crowd-empty",
  moderate: "bg-crowd-moderate",
  busy: "bg-crowd-busy",
  offline: "bg-crowd-offline",
};

export function CrowdBadge({ level, className }: { level: CrowdLevel | "offline"; className?: string }) {
  const t = useTranslations("crowd");
  return (
    <Badge variant={level} className={className} data-testid="crowd-badge" data-level={level}>
      <span aria-hidden className={cn("size-2 rounded-full", DOT[level], level !== "offline" && "animate-pulse")} />
      {t(level)}
    </Badge>
  );
}

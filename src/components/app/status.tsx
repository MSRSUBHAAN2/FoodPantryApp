import { cn } from "@/lib/utils";
import type { DateStatus } from "@/lib/dates";

const STYLE: Record<DateStatus, string> = {
  fresh: "bg-fresh-soft text-fresh",
  soon: "bg-soon-soft text-soon",
  past_quality: "bg-soon-soft text-soon",
  past_safety: "bg-danger-soft text-danger",
  frozen: "bg-frost-soft text-frost",
  unknown: "bg-muted text-muted-foreground",
};
const DOT: Record<DateStatus, string> = {
  fresh: "bg-fresh", soon: "bg-soon", past_quality: "bg-soon", past_safety: "bg-danger", frozen: "bg-frost", unknown: "bg-muted-foreground",
};

export function StatusPill({ status, text, className }: { status: DateStatus; text: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", STYLE[status], className)}>
      <span className={cn("size-2 rounded-full", DOT[status])} aria-hidden />
      {text}
    </span>
  );
}

export function DoubtNote() {
  return <p className="text-sm font-semibold text-danger">When in doubt, throw it out.</p>;
}

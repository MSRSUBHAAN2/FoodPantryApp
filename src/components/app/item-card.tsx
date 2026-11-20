import { Link } from "@tanstack/react-router";
import type { PantryItem } from "@/lib/food-types";
import { LOCATION_LABEL, type Location } from "@/lib/food-types";
import { summariseDates, todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { StatusPill } from "./status";

/** Compact stock row: name, then quantity · location · date as distinct pieces, status on the right. */
export function ItemCard({ item, row }: { item: PantryItem; row?: boolean }) {
  const s = summariseDates(item, todayIso());
  const date = s.safety ?? s.quality;
  return (
    <Link to="/item/$id" params={{ id: item.id }}
      className={cn("grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-muted/50", !row && "rounded-2xl border bg-card")}>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{item.name}{item.brand ? <span className="font-normal text-muted-foreground"> · {item.brand}</span> : null}</span>
        <span className="mt-0.5 flex min-w-0 flex-wrap gap-x-2 text-sm">
          <span className="font-semibold tabular-nums">{item.quantity} {item.unit}</span>
          <span className="text-muted-foreground">{LOCATION_LABEL[item.location as Location]}{item.opened_date ? " · opened" : ""}{item.frozen_date && !item.thawed_date ? " · frozen" : ""}</span>
          {date && <span className="truncate text-muted-foreground">{date.label.replace(" (printed)", "")}: {new Date(date.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</span>}
        </span>
      </span>
      <StatusPill status={s.status} text={s.statusText} />
    </Link>
  );
}

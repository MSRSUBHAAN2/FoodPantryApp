import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, Empty, ErrorNote, OfflineBanner } from "@/components/app/shell";
import { ItemCard } from "@/components/app/item-card";
import { Input } from "@/components/ui/input";
import { useItems } from "@/lib/data";
import { CATEGORIES, LOCATIONS, LOCATION_LABEL } from "@/lib/food-types";
import { summariseDates, todayIso, toDay } from "@/lib/dates";
import { pageHead } from "@/lib/page-head";
import { useOnline } from "@/lib/use-online";

const VIEWS = ["all", ...LOCATIONS, "soon", "opened", "past"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABEL: Record<View, string> = { all: "All", fridge: "Fridge", freezer: "Freezer", cupboard: "Cupboard", pantry: "Pantry", soon: "Use soon", opened: "Opened", past: "Finished" };

export const Route = createFileRoute("/inventory")({
  validateSearch: (s: Record<string, unknown>): { view: View } => ({
    view: VIEWS.includes(s["view"] as View) ? (s["view"] as View) : "all",
  }),
  head: () => pageHead("Your food — Use It Up", "Everything in your fridge, freezer, cupboard and pantry."),
  component: InventoryPage,
});

function InventoryPage() {
  const { view } = Route.useSearch();
  const q = useItems();
  const online = useOnline();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const today = todayIso();

  const list = useMemo(() => {
    const items = q.data?.items ?? [];
    return items
      .filter((i) => (view === "past" ? i.status !== "active" : i.status === "active"))
      .filter((i) => {
        if ((LOCATIONS as readonly string[]).includes(view)) return i.location === view;
        if (view === "opened") return !!i.opened_date;
        if (view === "soon") {
          const s = summariseDates(i, today).status;
          return s === "soon" || s === "past_safety" || s === "past_quality";
        }
        return true;
      })
      .filter((i) => !cat || i.category === cat)
      .filter((i) => !search || `${i.name} ${i.brand ?? ""}`.toLowerCase().includes(search.toLowerCase()))
      .map((i) => ({ i, s: summariseDates(i, today) }))
      .sort((a, b) => {
        const da = a.s.safety?.date ?? a.s.quality?.date;
        const db = b.s.safety?.date ?? b.s.quality?.date;
        return (da ? toDay(da) : Infinity) - (db ? toDay(db) : Infinity);
      });
  }, [q.data, view, cat, search, today]);

  return (
    <AppShell title={VIEW_LABEL[view] === "All" ? "Your food" : VIEW_LABEL[view]}>
      {(q.data?.offline || !online) && <OfflineBanner />}
      <div className="sticky top-[68px] z-10 -mx-4 space-y-2 bg-background/95 px-4 py-2 backdrop-blur">
      <nav aria-label="Locations" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {VIEWS.map((v) => (
          <Link key={v} to="/inventory" search={{ view: v }}
            className={`shrink-0 inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${v === view ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
            {VIEW_LABEL[v]}
          </Link>
        ))}
      </nav>
      <div className="flex gap-2">
        <Input aria-label="Search food" placeholder="Search…" className="h-12" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Category" className="h-12 rounded-md border bg-background px-2" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All types</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      </div>
      {q.isLoading && <p className="text-muted-foreground">Loading your food…</p>}
      {q.error && <ErrorNote error={q.error} />}
      {q.data && list.length === 0 && (
        <Empty title={search || cat ? "Nothing matches" : `No food ${view === "all" ? "yet" : `in ${VIEW_LABEL[view].toLowerCase()}`}`}>
          <Link to="/add" className="font-semibold text-primary underline">Add food</Link>
        </Empty>
      )}
      {list.length > 0 && <p className="text-sm text-muted-foreground" aria-live="polite">{list.length} item{list.length === 1 ? "" : "s"}, soonest date first</p>}
      {list.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {list.map(({ i }) => <li key={i.id}><ItemCard item={i} row /></li>)}
        </ul>
      )}
    </AppShell>
  );
}

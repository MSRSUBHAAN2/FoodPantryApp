import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, ChefHat, Plus } from "lucide-react";
import { DayGoals, goalsFrom } from "@/components/app/day-goals";
import { AppShell, Empty, ErrorNote, OfflineBanner } from "@/components/app/shell";
import { ItemCard } from "@/components/app/item-card";
import { DoubtNote, StatusPill } from "@/components/app/status";
import { useDiary, useEvents, useItems, useSettings } from "@/lib/data";
import { reminderDue, summariseDates, todayIso, toDay } from "@/lib/dates";
import { sumNutrients, type NutrientKey } from "@/lib/nutrition";
import { pageHead } from "@/lib/page-head";
import { useOnline } from "@/lib/use-online";

export const Route = createFileRoute("/")({
  head: () => pageHead("Use It Up — what to eat first", "See food to use soon, today's calories and ideas for what to cook."),
  component: Dashboard,
});

function Dashboard() {
  const items = useItems();
  const online = useOnline();
  const settings = useSettings();
  const today = todayIso();
  const diary = useDiary(today);
  const events = useEvents();

  const active = useMemo(() => (items.data?.items ?? []).filter((i) => i.status === "active"), [items.data]);
  const withDates = active.map((i) => ({ i, s: summariseDates(i, today) }));
  const alerts = settings.data
    ? withDates.map((x) => ({ ...x, due: reminderDue(x.s, settings.data!.reminder_days, settings.data!.overdue_alerts) })).filter((x) => x.due)
        .sort((a, b) => (a.s.daysLeft ?? 0) - (b.s.daysLeft ?? 0))
    : [];
  const recent = [...active].sort((a, b) => toDay(b.opened_date ?? b.created_at) - toDay(a.opened_date ?? a.created_at)).slice(0, 4);
  const totals = sumNutrients((diary.data ?? []).map((e) => ({ values: (e.nutrients ?? {}) as Partial<Record<NutrientKey, number>> })));

  const since = Date.now() - 30 * 86_400_000;
  const ev = (events.data ?? []).filter((e) => new Date(e.created_at).getTime() >= since);
  const used = new Set(ev.filter((e) => ["consumed", "cooked", "finished"].includes(e.kind)).map((e) => e.item_id)).size;
  const thrown = ev.filter((e) => e.kind === "discarded").length;

  return (
    <AppShell title="Use It Up">
      {(items.data?.offline || !online) && <OfflineBanner />}
      {items.error && <ErrorNote error={items.error} />}

      <section aria-labelledby="use-first" className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="use-first" className="flex items-center gap-2 text-lg font-semibold"><Bell className="size-5 shrink-0" aria-hidden /> Use first</h2>
          {alerts.length > 0 && <span className="text-sm text-muted-foreground">{alerts.length} item{alerts.length === 1 ? "" : "s"}</span>}
        </div>
        {items.isLoading && <p className="text-sm text-muted-foreground">Loading your food…</p>}
        {items.data && alerts.length === 0 && <Empty title={active.length ? "Nothing needs using soon" : "Your kitchen is empty"}>{active.length ? "Alerts appear here before dates arrive." : <Link to="/add" className="font-semibold text-primary underline">Add your first food</Link>}</Empty>}
        {alerts.length > 0 && (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {alerts.slice(0, 6).map(({ i, s, due }) => (
              <li key={i.id}>
                <Link to="/item/$id" params={{ id: i.id }} className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <span className="min-w-0"><span className="block truncate font-semibold">{i.name}</span><span className="block truncate text-sm text-muted-foreground">{due} · {s.safety ? s.safety.label : s.quality?.label}</span></span>
                  <StatusPill status={s.status} text={s.statusText} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {alerts.some((a) => a.s.status === "past_safety") && <DoubtNote />}
        {alerts.length > 6 && <Link to="/inventory" search={{ view: "soon" }} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">See all {alerts.length}</Link>}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Link to="/recipes" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-3 text-sm font-semibold text-primary-foreground sm:text-base"><ChefHat className="size-5 shrink-0" aria-hidden /> What can I cook?</Link>
        <Link to="/add" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border bg-card px-3 text-sm font-semibold sm:text-base"><Plus className="size-5 shrink-0" aria-hidden /> Add food</Link>
      </div>

      <section aria-labelledby="today" className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="today" className="text-lg font-semibold">Today</h2>
          <Link to="/diary" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">Open diary</Link>
        </div>
        <DayGoals totals={totals} goals={goalsFrom(settings.data)} hasEntries={(diary.data ?? []).length > 0} />
        {!settings.data?.calorie_goal && !settings.data?.protein_goal_g && <Link to="/settings" className="mt-2 inline-flex min-h-11 items-center text-sm text-muted-foreground underline">Set daily goals (optional)</Link>}
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="recent" className="space-y-2">
          <h2 id="recent" className="text-lg font-semibold">Recently added or opened</h2>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">{recent.map((i) => <li key={i.id}><ItemCard item={i} row /></li>)}</ul>
        </section>
      )}

      <section aria-labelledby="month" className="rounded-2xl border bg-card p-4">
        <h2 id="month" className="font-semibold">Last 30 days</h2>
        <p className="mt-1 text-sm"><b className="text-fresh">{used}</b> eaten or used up · <b className="text-danger">{thrown}</b> thrown away</p>
        <p className="text-xs text-muted-foreground">Counted from actions you recorded in the app.</p>
      </section>
    </AppShell>
  );
}

import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell, Empty, ErrorNote } from "@/components/app/shell";
import { ItemEditor } from "@/components/app/item-editor";
import { ConsumeDialog } from "@/components/app/consume-dialog";
import { DoubtNote, StatusPill } from "@/components/app/status";
import { NutrientLine } from "@/components/app/nutrient-line";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDeleteItem, useItems, useUpdateItem } from "@/lib/data";
import { DATE_TYPE_LABEL, LOCATIONS, LOCATION_LABEL, type DateType, type Location, type PantryItem } from "@/lib/food-types";
import { FSA_CHILLING_URL, FSA_DATES_URL, summariseDates, todayIso } from "@/lib/dates";
import { parseNutrition } from "@/lib/nutrition";
import { draftFromItem, draftToRow, type ItemDraft } from "@/lib/item-form";
import { pageHead } from "@/lib/page-head";
import { useOnline } from "@/lib/use-online";

export const Route = createFileRoute("/item/$id")({
  head: () => pageHead("Food details — Use It Up", "Dates, storage history and nutrition for one item."),
  component: ItemPage,
});

function ItemPage() {
  const { id } = Route.useParams();
  const q = useItems();
  const online = useOnline();
  const item = q.data?.items.find((i) => i.id === id);
  return (
    <AppShell title={item?.name ?? "Food"}>
      {q.isLoading && <p className="text-muted-foreground">Loading…</p>}
      {q.error && <ErrorNote error={q.error} />}
      {q.data && !item && <Empty title="This item isn't in your stock."><Link to="/inventory" search={{ view: "all" }} className="text-primary underline">Back to stock</Link></Empty>}
      {item && <Detail key={item.updated_at} item={item} readOnly={(q.data?.offline ?? false) || !online} />}
    </AppShell>
  );
}

function Detail({ item, readOnly }: { item: PantryItem; readOnly: boolean }) {
  const update = useUpdateItem();
  const del = useDeleteItem();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<ItemDraft | null>(null);
  const [consume, setConsume] = useState(false);
  const [opening, setOpening] = useState(false);
  const today = todayIso();
  const s = summariseDates(item, today);
  const n = parseNutrition(item.nutrition);
  const active = item.status === "active";

  const act = (patch: Parameters<typeof update.mutate>[0]["patch"], event: string, msg: string) =>
    update.mutate({ item, patch, event }, { onSuccess: () => toast.success(msg), onError: (e) => toast.error(e.message) });

  if (editing) {
    return (
      <div className="space-y-4">
        <ItemEditor draft={editing} onChange={setEditing} />
        <div className="sticky bottom-[72px] z-10 -mx-4 grid grid-cols-2 gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur">
          <Button variant="outline" className="h-12" onClick={() => setEditing(null)}>Cancel</Button>
          <Button className="h-12" onClick={() => {
            try {
              update.mutate({ item, patch: draftToRow(editing) }, { onSuccess: () => { toast.success("Saved"); setEditing(null); }, onError: (e) => toast.error(e.message) });
            } catch (e) { toast.error(e instanceof Error ? e.message : "Invalid"); }
          }}>Save</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-3xl border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={s.status} text={s.statusText} />
          {item.status !== "active" && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold capitalize">{item.status}</span>}
        </div>
        <p className="text-sm text-muted-foreground">
          {item.brand && `${item.brand} · `}{item.quantity} {item.unit} · {LOCATION_LABEL[item.location as Location]} · {item.category}
        </p>
        <dl className="space-y-2 text-sm">
          <Row k="Printed date" v={s.printed ? `${DATE_TYPE_LABEL[s.printed.type as DateType]} ${s.printed.date}` : "None recorded"} sub={s.printed?.meaning} />
          {s.deadlines.map((d) => <Row key={d.label + d.date} k={d.kind === "safety" ? "Safety deadline" : "Quality date"} v={`${d.date} — ${d.label}`} sub={`Source: ${d.source}`} />)}
          {s.safety && s.deadlines.filter((d) => d.kind === "safety").length > 1 && <p className="text-xs">Reminders use the earliest safety deadline: <b>{s.safety.date}</b>.</p>}
          <Row k="Bought" v={item.purchase_date} />
          {item.opened_date && <Row k="Opened" v={item.opened_date} />}
          {item.frozen_date && <Row k="Frozen" v={item.frozen_date} />}
          {item.thawed_date && <Row k="Thawed" v={item.thawed_date} />}
          <Row k="Allergens" v={item.allergens == null ? "Unknown — check the label" : item.allergens.length ? item.allergens.join(", ") : "None listed"} />
        </dl>
        {s.notes.map((t) => <p key={t} className="rounded-xl bg-soon-soft p-3 text-sm">{t}</p>)}
        {(s.status === "past_safety" || s.status === "unknown" || s.notes.length > 0) && <DoubtNote />}
        <p className="text-xs text-muted-foreground">Guidance: <a className="underline" href={FSA_DATES_URL} target="_blank" rel="noreferrer">FSA dates</a> · <a className="underline" href={FSA_CHILLING_URL} target="_blank" rel="noreferrer">FSA chilling &amp; defrosting</a></p>
      </section>

      <section className="space-y-2 rounded-3xl border bg-card p-5">
        <h2 className="font-semibold">Nutrition {n && <span className="text-sm font-normal text-muted-foreground">per {n.basis_amount} {n.basis_unit} · {n.source}</span>}</h2>
        {n ? <NutrientLine values={n.values} /> : <p className="text-sm text-muted-foreground">No nutrition recorded. Edit to add values from the label.</p>}
      </section>

      {!readOnly && (
        <section className="grid grid-cols-2 gap-2">
          {active && <Button className="h-12" onClick={() => setConsume(true)} disabled={item.quantity <= 0}>Use some</Button>}
          <Button variant="secondary" className="h-12" onClick={() => setEditing(draftFromItem(item))}>Edit</Button>
          {active && !item.opened_date && <Button variant="secondary" className="h-12" onClick={() => setOpening(true)}>Mark opened</Button>}
          {active && !item.frozen_date && (
            <Button variant="secondary" className="h-12" onClick={() => {
              if (s.status === "past_safety") return void toast.error("This is past its safety date — it should not be frozen.");
              act({ frozen_date: today, thawed_date: null, location: "freezer" }, "frozen", "Frozen — original date kept");
            }}>Freeze</Button>
          )}
          {active && item.frozen_date && !item.thawed_date && (
            <Button variant="secondary" className="h-12" onClick={() => act({ thawed_date: today, location: "fridge" }, "thawed", "Thawed — use within 24 hours")}>Thaw (to fridge)</Button>
          )}
          {active && (
            <select aria-label="Move to" className="h-12 rounded-md border bg-secondary px-3 text-sm font-medium" value="" onChange={(e) => e.target.value && act({ location: e.target.value }, "moved", `Moved to ${LOCATION_LABEL[e.target.value as Location]}`)}>
              <option value="">Move to…</option>
              {LOCATIONS.filter((l) => l !== item.location).map((l) => <option key={l} value={l}>{LOCATION_LABEL[l]}</option>)}
            </select>
          )}
          {active && <Button variant="secondary" className="h-12" onClick={() => act({ status: "finished" }, "finished", "Marked finished")}>Finished</Button>}
          {active && <Button variant="outline" className="h-12 border-danger text-danger" onClick={() => act({ status: "discarded" }, "discarded", "Recorded as thrown away")}>Throw away</Button>}
          {!active && <Button variant="secondary" className="h-12" onClick={() => act({ status: "active" }, "restored", "Back in stock")}>Back in stock</Button>}
          <Button variant="ghost" className="h-12 text-danger" onClick={() => {
            if (!confirm(`Delete ${item.name} permanently? This won't count as waste.`)) return;
            del.mutate(item.id, { onSuccess: () => { toast.success("Deleted"); navigate({ to: "/inventory", search: { view: "all" } }); } });
          }}>Delete</Button>
        </section>
      )}
      {consume && <ConsumeDialog item={item} open={consume} onOpenChange={setConsume} />}
      <OpenDialog item={item} open={opening} onOpenChange={setOpening} onSave={(days, src) => {
        act({ opened_date: today, open_life_days: days, open_life_source: days != null ? src || "Package instructions" : null }, "opened", "Marked opened");
        setOpening(false);
      }} />
    </div>
  );
}

function Row({ k, v, sub }: { k: string; v: string; sub?: string | undefined }) {
  return (
    <div>
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function OpenDialog({ item, open, onOpenChange, onSave }: { item: PantryItem; open: boolean; onOpenChange: (o: boolean) => void; onSave: (days: number | null, src: string) => void }) {
  const [days, setDays] = useState(item.open_life_days == null ? "" : String(item.open_life_days));
  const [src, setSrc] = useState(item.open_life_source ?? "");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Opened {item.name} today</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm">Does the package say “once opened, use within…”? Enter it so we can work out the after-opening date. Leave blank if it doesn't — the date will be shown as unknown.</p>
          <div className="space-y-1.5"><Label htmlFor="o-days">Use within (days)</Label><Input id="o-days" type="number" className="h-12" value={days} onChange={(e) => setDays(e.target.value)} /></div>
          {days && <div className="space-y-1.5"><Label htmlFor="o-src">Label wording</Label><Input id="o-src" className="h-12" placeholder="Once opened, keep refrigerated and use within 3 days" value={src} onChange={(e) => setSrc(e.target.value)} /></div>}
          <Button className="h-12 w-full" onClick={() => onSave(days ? Number(days) : null, src ? `Package: ${src}` : "")}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

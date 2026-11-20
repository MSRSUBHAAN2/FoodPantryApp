import { DayGoals, goalsFrom } from "@/components/app/day-goals";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Empty, ErrorNote } from "@/components/app/shell";
import { ConsumeDialog } from "@/components/app/consume-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDiary, useItems, useSettings } from "@/lib/data";
import { MEALS, UNITS, type DiaryEntry, type PantryItem } from "@/lib/food-types";
import { NUTRIENTS, sumNutrients, type NutrientKey } from "@/lib/nutrition";
import { addDays, todayIso } from "@/lib/dates";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/diary")({
  head: () => pageHead("Food diary — Use It Up", "Log breakfast, lunch, dinner and snacks and see your daily nutrition."),
  component: DiaryPage,
});

const vals = (e: DiaryEntry) => (e.nutrients ?? {}) as Partial<Record<NutrientKey, number>>;

function DiaryPage() {
  const [date, setDate] = useState(todayIso());
  const q = useDiary(date);
  const settings = useSettings();
  const [adding, setAdding] = useState<string | null>(null);
  const entries = q.data ?? [];
  const totals = sumNutrients(entries.map((e) => ({ values: vals(e) })));

  return (
    <AppShell title="Diary">
      <div className="flex items-center gap-2">
        <Button variant="outline" className="h-12" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>‹</Button>
        <Input type="date" aria-label="Date" className="h-12 flex-1" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <Button variant="outline" className="h-12" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}>›</Button>
      </div>

      <section aria-labelledby="day-total" className="rounded-2xl border bg-card p-4">
        <h2 id="day-total" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Day total</h2>
        <DayGoals totals={totals} goals={goalsFrom(settings.data)} hasEntries={entries.length > 0} />
        {entries.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {NUTRIENTS.slice(4).map((n) => `${n.label} ${totals.values[n.key] === undefined ? "n/a" : `${totals.values[n.key]} ${n.unit}${totals.partial[n.key] ? "*" : ""}`}`).join(" · ")}
          </p>
        )}
      </section>

      {q.error && <ErrorNote error={q.error} />}
      {MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m);
        const t = sumNutrients(list.map((e) => ({ values: vals(e) })));
        return (
          <section key={m} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold"><span className="capitalize">{m}</span> <span className="text-sm font-normal text-muted-foreground">{list.length ? `${t.values.energy_kcal ?? "n/a"} kcal${t.partial.energy_kcal ? "*" : ""}` : ""}</span></h2>
              <Button variant="secondary" className="h-11" onClick={() => setAdding(m)}>+ Add</Button>
            </div>
            {list.length === 0 ? <p className="text-sm text-muted-foreground">Nothing logged.</p> : (
              <ul className="space-y-2">{list.map((e) => <EntryRow key={e.id} e={e} />)}</ul>
            )}
          </section>
        );
      })}
      {entries.length === 0 && !q.isLoading && <Empty title="No food logged for this day">Add from your stock, a recipe, or a separate food.</Empty>}
      {adding && <AddEntry meal={adding} date={date} onClose={() => setAdding(null)} />}
    </AppShell>
  );
}

function EntryRow({ e }: { e: DiaryEntry }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [amt, setAmt] = useState(String(e.amount));
  const v = vals(e);
  async function remove() {
    if (!confirm(e.item_id ? "Remove this entry? The amount will go back into your stock." : "Remove this entry?")) return;
    const { error } = await supabase.rpc("delete_diary_entry", { _entry_id: e.id });
    if (error) return void toast.error(error.message);
    toast.success(e.item_id ? "Removed and stock restored" : "Removed");
    qc.invalidateQueries();
  }
  async function save() {
    const a = Number(amt);
    if (!(a > 0)) return void toast.error("Enter an amount above 0");
    const f = a / e.amount;
    const scaled = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Math.round((x as number) * f * 10) / 10]));
    const { error } = await supabase.rpc("update_diary_amount", {
      _entry_id: e.id, _new_amount: a, _new_stock: (e.stock_deducted != null ? e.stock_deducted * f : null) as number, _nutrients: scaled as never,
    });
    if (error) return void toast.error(error.message);
    toast.success(e.item_id ? "Updated — stock adjusted" : "Updated");
    setEdit(false);
    qc.invalidateQueries();
  }
  return (
    <li className="rounded-2xl border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{e.name}</p>
          <p className="text-xs text-muted-foreground">
            {e.amount} {e.unit}
            {e.nutrition_source ? ` · ${e.nutrition_source}${e.nutrition_basis ? ` ${e.nutrition_basis}` : ""}` : " · no nutrition source"}
            {e.item_id ? " · from stock" : ""}
          </p>
          <p className="mt-0.5 text-sm tabular-nums">
            <b>{v.energy_kcal ?? "n/a"}</b> kcal <span className="text-muted-foreground">·</span> Protein {v.protein_g ?? "n/a"}{v.protein_g != null ? " g" : ""} <span className="text-muted-foreground">·</span> Carbs {v.carbs_g ?? "n/a"}{v.carbs_g != null ? " g" : ""} <span className="text-muted-foreground">·</span> Fat {v.fat_g ?? "n/a"}{v.fat_g != null ? " g" : ""}
          </p>
        </div>
        <div className="flex">
          <Button size="icon" variant="ghost" className="size-11" aria-label="Edit amount" onClick={() => setEdit(!edit)}><Pencil className="size-4" /></Button>
          <Button size="icon" variant="ghost" className="size-11" aria-label="Remove" onClick={remove}><Trash2 className="size-4" /></Button>
        </div>
      </div>
      {edit && (
        <div className="mt-2 flex gap-2">
          <Input aria-label="New amount" type="number" step="any" className="h-11" value={amt} onChange={(x) => setAmt(x.target.value)} />
          <Button className="h-11" onClick={save}>Save</Button>
        </div>
      )}
    </li>
  );
}

function AddEntry({ meal, date, onClose }: { meal: string; date: string; onClose: () => void }) {
  const items = useItems();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"stock" | "other">("stock");
  const [item, setItem] = useState<PantryItem | null>(null);
  const [f, setF] = useState({ name: "", amount: "1", unit: "servings", source: "", n: {} as Record<string, string> });
  const active = (items.data?.items ?? []).filter((i) => i.status === "active" && i.quantity > 0);

  async function saveOther() {
    if (!f.name.trim() || !(Number(f.amount) > 0)) return void toast.error("Enter a name and amount");
    const values = Object.fromEntries(Object.entries(f.n).filter(([, x]) => x !== "").map(([k, x]) => [k, Number(x)]));
    const complete = ["energy_kcal", "protein_g", "carbs_g", "fat_g", "fibre_g"].every((k) => k in values);
    const { error } = await supabase.from("diary_entries").insert({
      entry_date: date, meal, name: f.name.trim(), amount: Number(f.amount), unit: f.unit, nutrients: values,
      nutrition_source: Object.keys(values).length ? f.source || "User entered" : null, nutrition_complete: complete,
    });
    if (error) return void toast.error(error.message);
    toast.success("Logged");
    qc.invalidateQueries();
    onClose();
  }

  if (item) return <ConsumeDialog item={item} meal={meal} date={date} open onOpenChange={(o) => !o && onClose()} />;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="capitalize">Add to {meal}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button variant={tab === "stock" ? "default" : "secondary"} className="h-11" onClick={() => setTab("stock")}>From stock</Button>
          <Button variant={tab === "other" ? "default" : "secondary"} className="h-11" onClick={() => setTab("other")}>Other food</Button>
        </div>
        {tab === "stock" ? (
          active.length === 0 ? <p className="text-sm text-muted-foreground">No stock to log from.</p> : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {active.map((i) => (
                <li key={i.id}><button className="flex min-h-12 w-full justify-between rounded-xl px-3 text-left hover:bg-muted" onClick={() => setItem(i)}>
                  <span>{i.name}</span><span className="text-sm text-muted-foreground">{i.quantity} {i.unit}</span>
                </button></li>
              ))}
            </ul>
          )
        ) : (
          <div className="space-y-3">
            <Input aria-label="Food name" placeholder="Food name" className="h-12" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input aria-label="Amount" type="number" step="any" className="h-12" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
              <Input aria-label="Unit" list="d-units" className="h-12" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
              <datalist id="d-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
            </div>
            <p className="text-xs text-muted-foreground">Nutrition for this amount — leave blank if unknown.</p>
            <div className="grid grid-cols-2 gap-2">
              {NUTRIENTS.slice(0, 5).map((n) => (
                <div key={n.key} className="space-y-1"><Label htmlFor={`d-${n.key}`} className="text-xs">{n.label} ({n.unit})</Label>
                  <Input id={`d-${n.key}`} type="number" step="any" className="h-11" value={f.n[n.key] ?? ""} onChange={(e) => setF({ ...f, n: { ...f.n, [n.key]: e.target.value } })} /></div>
              ))}
            </div>
            <Input aria-label="Nutrition source" placeholder="Source (e.g. package label)" className="h-12" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} />
            <Button className="h-12 w-full" onClick={saveOther}>Log food</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


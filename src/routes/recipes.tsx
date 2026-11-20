import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, Clock, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Empty, ErrorNote } from "@/components/app/shell";
import { NutrientLine } from "@/components/app/nutrient-line";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useItems, useSettings } from "@/lib/data";
import { useUserId } from "@/lib/auth";
import { suggestRecipes } from "@/lib/food.functions";
import { checkRecipe, eligibleItems, type AiRecipe, type CheckedRecipe } from "@/lib/recipes";
import { todayIso } from "@/lib/dates";
import { MEALS } from "@/lib/food-types";
import { defaultMeal } from "@/components/app/consume-dialog";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/recipes")({
  head: () => pageHead("Recipe ideas — Use It Up", "Dishes built from the food you have, using what needs eating first."),
  component: RecipesPage,
});

function RecipesPage() {
  const uid = useUserId();
  const items = useItems();
  const settings = useSettings();
  const suggest = useServerFn(suggestRecipes);
  const [raw, setRaw] = useState<AiRecipe[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kcalCap, setKcalCap] = useState("");
  const [open, setOpen] = useState<CheckedRecipe | null>(null);
  const key = `uiu-recipes-${uid}`;
  const today = todayIso();

  useEffect(() => {
    const s = sessionStorage.getItem(key);
    if (s) setRaw(JSON.parse(s));
  }, [key]);

  const st = settings.data;
  const all = items.data?.items ?? [];
  const eligible = useMemo(() => (st ? eligibleItems(all, st.allergies, today) : []), [all, st, today]);
  const soonIds = useMemo(() => new Set(eligible.filter((e) => e.soon).map((e) => e.item.id)), [eligible]);

  const recipes = useMemo(() => {
    if (!raw || !st) return [];
    return raw
      .map((r) => checkRecipe(r, all, st.allergies, st.dislikes, soonIds))
      .filter((r): r is CheckedRecipe => !!r)
      .filter((r) => r.minutes <= st.max_cook_minutes)
      .filter((r) => r.equipment.every((e) => st.equipment.some((x) => e.toLowerCase().includes(x.toLowerCase()) || x.toLowerCase().includes(e.toLowerCase()))))
      .filter((r) => !kcalCap || r.perServing.energy_kcal === undefined || r.perServing.energy_kcal <= Number(kcalCap))
      .sort((a, b) => b.usesSoon - a.usesSoon || a.missingRequired.length - b.missingRequired.length);
  }, [raw, all, st, soonIds, kcalCap]);

  async function run() {
    if (!st) return;
    setBusy(true);
    setError(null);
    try {
      const r = await suggest({
        data: {
          items: eligible.sort((a, b) => b.priority - a.priority).map(({ item, priority }) => ({
            id: item.id, name: item.name, quantity: item.quantity, unit: item.unit, location: item.location, priority, allergens: item.allergens,
          })),
          prefs: { dietary: st.dietary, allergies: st.allergies, dislikes: st.dislikes, maxMinutes: st.max_cook_minutes, servings: st.servings, equipment: st.equipment, kcalPerServing: kcalCap ? Number(kcalCap) : null },
        },
      });
      setRaw(r);
      sessionStorage.setItem(key, JSON.stringify(r));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't get recipes");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Recipes">
      <section className="space-y-3 rounded-3xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          Using {eligible.length} item{eligible.length === 1 ? "" : "s"} from all four locations (past-safety, frozen and allergen items left out).
          Filters: {st?.dietary === "none" ? "no diet" : st?.dietary}, allergies {st?.allergies.join(", ") || "none"}, ≤{st?.max_cook_minutes} min, {st?.servings} servings.{" "}
          <Link to="/settings" className="text-primary underline">Change</Link>
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1"><Label htmlFor="cap">Max kcal per serving (optional)</Label>
            <Input id="cap" type="number" className="h-12" value={kcalCap} onChange={(e) => setKcalCap(e.target.value)} /></div>
          <Button className="h-12" onClick={run} disabled={busy || eligible.length === 0}>{busy ? "Thinking…" : raw ? "New ideas" : "Suggest dishes"}</Button>
        </div>
        {eligible.length === 0 && items.data && <p className="text-sm">Add some food first — ideas are built only from your real stock.</p>}
      </section>
      {error && <ErrorNote error={new Error(error)} />}
      {raw && recipes.length === 0 && <Empty title="No ideas fit your filters">Try a longer cook time or fewer restrictions.</Empty>}
      <ul className="space-y-3">
        {recipes.map((r) => (
          <li key={r.title}>
            <button onClick={() => setOpen(r)} className="w-full rounded-3xl border bg-card p-5 text-left hover:bg-muted/40">
              <p className="text-lg font-semibold">{r.title}</p>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock className="size-4" />{r.minutes} min</span>
                <span className="inline-flex items-center gap-1"><Users className="size-4" />{r.servings}</span>
                <span>{r.perServing.energy_kcal !== undefined ? `${r.perServing.energy_kcal} kcal/serving${r.nutritionPartial ? " (partial)" : ""}` : "Calories unavailable"}</span>
              </p>
              <p className="mt-2 text-sm">
                {r.usesSoon > 0 && <span className="mr-2 rounded-full bg-soon-soft px-2 py-0.5 text-xs font-semibold text-soon">Uses {r.usesSoon} use-soon item{r.usesSoon > 1 ? "s" : ""}</span>}
                {r.missingRequired.length ? `Missing ${r.missingRequired.length}` : "You have everything"}
              </p>
            </button>
          </li>
        ))}
      </ul>
      {open && <RecipeDetail r={open} onClose={() => setOpen(null)} />}
    </AppShell>
  );
}

function RecipeDetail({ r, onClose }: { r: CheckedRecipe; onClose: () => void }) {
  const [cooking, setCooking] = useState(false);
  async function addMissing() {
    const rows = r.missingRequired.map((m) => ({ name: m.name, quantity: `${m.amount} ${m.unit}` }));
    if (!rows.length) return;
    const { error } = await supabase.from("shopping_items").insert(rows);
    if (error) return void toast.error(error.message);
    toast.success(`${rows.length} added to your shopping list`);
  }
  if (cooking) return <CookDialog r={r} onClose={onClose} />;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{r.title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{r.minutes} min · {r.servings} servings · {r.equipment.join(", ")}</p>
        {r.allergenWarnings.length > 0 && (
          <div className="rounded-2xl bg-soon-soft p-3 text-sm">
            <p className="flex items-center gap-1 font-semibold"><AlertTriangle className="size-4" /> Check allergens</p>
            <ul className="list-disc pl-5">{r.allergenWarnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        )}
        <h3 className="font-semibold">Ingredients</h3>
        <ul className="space-y-1 text-sm">
          {r.checked.map((c, i) => (
            <li key={i} className="flex items-start gap-2">
              {c.onHand ? <Check className="mt-0.5 size-4 shrink-0 text-fresh" /> : <X className="mt-0.5 size-4 shrink-0 text-danger" />}
              <span>{c.amount} {c.unit} {c.name}{c.optional ? " (optional)" : ""}
                <span className="text-muted-foreground"> — {c.onHand ? `on hand (${c.item!.quantity} ${c.item!.unit})` : c.note ?? (c.optional ? "optional, not in stock" : "need to buy")}</span></span>
            </li>
          ))}
        </ul>
        <h3 className="font-semibold">Per serving</h3>
        <NutrientLine values={r.perServing} />
        <p className="text-xs text-muted-foreground">{r.nutritionPartial ? "Partial: calculated only from stock items with recorded nutrition and matching units." : "Calculated from your items' recorded nutrition."}</p>
        <h3 className="font-semibold">Method</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="h-12" disabled={!r.missingRequired.length} onClick={addMissing}>Add missing to list</Button>
          <Button className="h-12" onClick={() => setCooking(true)}>I cooked this</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CookDialog({ r, onClose }: { r: CheckedRecipe; onClose: () => void }) {
  const qc = useQueryClient();
  const used = r.checked.filter((c) => c.item);
  const [amounts, setAmounts] = useState(() => used.map((c) => String(Math.min(c.amount, c.item!.quantity))));
  const [ids] = useState(() => used.map(() => crypto.randomUUID()));
  const [step, setStep] = useState<"deduct" | "eat">("deduct");
  const [portion, setPortion] = useState("1");
  const [meal, setMeal] = useState(defaultMeal());
  const [busy, setBusy] = useState(false);

  async function deduct() {
    setBusy(true);
    for (let i = 0; i < used.length; i++) {
      const a = Number(amounts[i]);
      if (!(a > 0)) continue;
      const { error } = await supabase.rpc("consume_item", {
        _item_id: used[i]!.item!.id, _amount: a, _request_id: ids[i]!, _log: false, _meal: "dinner", _entry_date: todayIso(),
        _name: used[i]!.name, _diary_amount: a, _diary_unit: used[i]!.unit, _nutrients: {}, _source: "", _basis: "", _complete: false, _kind: "cooked",
      });
      if (error) { setBusy(false); qc.invalidateQueries(); return void toast.error(`${used[i]!.name}: ${error.message}. Retrying won't deduct twice.`); }
    }
    setBusy(false);
    qc.invalidateQueries();
    toast.success("Stock updated");
    setStep("eat");
  }

  async function logPortion() {
    const p = Number(portion);
    if (!(p > 0)) return void toast.error("Enter servings eaten");
    const values = Object.fromEntries(Object.entries(r.perServing).map(([k, v]) => [k, Math.round((v as number) * p * 10) / 10]));
    const { error } = await supabase.from("diary_entries").insert({
      entry_date: todayIso(), meal, name: r.title, amount: p, unit: "servings", nutrients: values,
      nutrition_source: Object.keys(values).length ? "Calculated from ingredients" : null,
      nutrition_basis: `1 of ${r.servings} servings`, nutrition_complete: !r.nutritionPartial,
    });
    if (error) return void toast.error(error.message);
    toast.success("Logged in your diary");
    qc.invalidateQueries();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{step === "deduct" ? "What did you use?" : "How much did you eat?"}</DialogTitle></DialogHeader>
        {step === "deduct" ? (
          <div className="space-y-3">
            {used.length === 0 && <p className="text-sm">No stock items to deduct.</p>}
            {used.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Label htmlFor={`u-${i}`} className="flex-1">{c.item!.name} <span className="text-muted-foreground">({c.item!.quantity} {c.item!.unit} left)</span></Label>
                <Input id={`u-${i}`} type="number" step="any" className="h-11 w-24" value={amounts[i]} onChange={(e) => setAmounts(amounts.map((x, j) => (j === i ? e.target.value : x)))} />
              </div>
            ))}
            <Button className="h-12 w-full" disabled={busy} onClick={deduct}>{busy ? "Updating…" : "Confirm and update stock"}</Button>
            <Button variant="ghost" className="h-11 w-full" onClick={() => setStep("eat")}>Skip — don't change stock</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="portion">Servings eaten (of {r.servings})</Label>
              <Input id="portion" type="number" step="any" className="h-12" value={portion} onChange={(e) => setPortion(e.target.value)} /></div>
            <select aria-label="Meal" className="h-12 w-full rounded-md border bg-background px-3 capitalize" value={meal} onChange={(e) => setMeal(e.target.value)}>
              {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">This logs the meal only — ingredients were handled in the previous step, so nothing is deducted twice.</p>
            <Button className="h-12 w-full" onClick={logPortion}>Log to diary</Button>
            <Button variant="ghost" className="h-11 w-full" onClick={onClose}>Don't log</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MEALS, type PantryItem } from "@/lib/food-types";
import { parseNutrition, scaleNutrition } from "@/lib/nutrition";
import { todayIso } from "@/lib/dates";
import { Link } from "@tanstack/react-router";
import { NutrientLine } from "./nutrient-line";

export function defaultMeal() {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 15 ? "lunch" : h < 21 ? "dinner" : "snacks";
}

export function ConsumeDialog({ item, open, onOpenChange, meal: initialMeal, date }: { item: PantryItem; open: boolean; onOpenChange: (o: boolean) => void; meal?: string; date?: string }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("1");
  const [log, setLog] = useState(true);
  const [meal, setMeal] = useState(initialMeal ?? defaultMeal());
  const [busy, setBusy] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID()); // same id on retry = no double deduction
  const n = parseNutrition(item.nutrition);
  const scaled = useMemo(() => scaleNutrition(n, Number(amount) || 0, item.unit), [n, amount, item.unit]);

  async function submit() {
    const a = Number(amount);
    if (!(a > 0) || a > item.quantity) return void toast.error(`Enter an amount between 0 and ${item.quantity}`);
    setBusy(true);
    const { error } = await supabase.rpc("consume_item", {
      _item_id: item.id, _amount: a, _request_id: requestId, _log: log, _meal: meal, _entry_date: date ?? todayIso(),
      _name: item.brand ? `${item.name} (${item.brand})` : item.name, _diary_amount: a, _diary_unit: item.unit,
      _nutrients: scaled.values as never, _source: n?.source ?? "", _basis: n ? `per ${n.basis_amount} ${n.basis_unit}` : "",
      _complete: scaled.complete, _kind: "consumed",
    });
    setBusy(false);
    if (error) return void toast.error(`${error.message}. You can safely try again.`);
    toast.success(log ? "Stock updated and logged in your diary" : "Stock updated");
    qc.invalidateQueries();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Use some {item.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-amt">Amount ({item.unit}) — {item.quantity} left</Label>
            <Input id="c-amt" type="number" step="any" className="h-12" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <Checkbox checked={log} onCheckedChange={(v) => setLog(v === true)} /> Log what I ate in the diary
          </label>
          {log && (
            <>
              <select aria-label="Meal" className="h-12 w-full rounded-md border bg-background px-3 capitalize" value={meal} onChange={(e) => setMeal(e.target.value)}>
                {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              {scaled.ok ? <NutrientLine values={scaled.values} missing={scaled.missing} /> : <div className="space-y-1 rounded-xl bg-muted p-3 text-sm"><p>Calories and macros unavailable for this amount: {scaled.reason}.</p>{scaled.needsConfirmation && <Link to="/item/$id" params={{ id: item.id }} onClick={() => onOpenChange(false)} className="font-semibold text-primary underline">Open item to check conversion</Link>}</div>}
            </>
          )}
          <Button className="h-12 w-full" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Confirm"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

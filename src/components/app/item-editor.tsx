import { useState, type ReactNode } from "react";
import { searchFoods } from "@/lib/common-foods";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CATEGORIES, DATE_TYPES, DATE_TYPE_LABEL, LOCATIONS, LOCATION_LABEL, UNITS } from "@/lib/food-types";
import { NUTRIENTS } from "@/lib/nutrition";
import { editStock, type ItemDraft } from "@/lib/item-form";
import { FSA_DATES_URL } from "@/lib/dates";

const sel = "h-12 w-full rounded-md border border-input bg-background px-3 text-base";

function Field({ label, id, children, hint }: { label: string; id: string; children: ReactNode; hint?: string | undefined }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function UnitSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const opts: string[] = [...UNITS];
  if (value && !opts.includes(value)) opts.unshift(value);
  return (
    <select id={id} className={sel} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose…</option>
      {opts.map((u) => <option key={u} value={u}>{u}</option>)}
    </select>
  );
}

export function ItemEditor({ draft, onChange }: { draft: ItemDraft; onChange: (d: ItemDraft) => void }) {
  const [showFoods, setShowFoods] = useState(false);
  const matches = showFoods ? searchFoods(draft.name) : [];
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => {
    if ((k === "quantity" || k === "unit") && typeof v === "string") onChange(editStock(draft, k, v));
    else onChange({ ...draft, [k]: v });
  };
  const txt = (k: keyof ItemDraft, label: string, type = "text", hint?: string) => (
    <Field label={label} id={`f-${k}`} hint={hint}>
      <Input id={`f-${k}`} type={type} className="h-12" value={draft[k] as string} onChange={(e) => set(k, e.target.value as never)} />
    </Field>
  );
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Product name" id="f-name" hint="Start typing to search common foods like apples or bananas">
          <div className="relative">
            <Input id="f-name" className="h-12" autoComplete="off" role="combobox" aria-expanded={matches.length > 0} aria-controls="food-list"
              value={draft.name} onFocus={() => setShowFoods(true)} onBlur={() => setTimeout(() => setShowFoods(false), 150)}
              onChange={(e) => { setShowFoods(true); set("name", e.target.value); }} />
            {matches.length > 0 && (
              <ul id="food-list" role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                {matches.map((f) => (
                  <li key={f.name} role="option" aria-selected={false}>
                    <button type="button" className="flex w-full justify-between px-3 py-2.5 text-left hover:bg-muted focus-visible:bg-muted"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setShowFoods(false); onChange({ ...editStock(draft, "unit", f.unit), name: f.name, category: f.category, location: f.location }); }}>
                      <span>{f.name}</span><span className="text-xs text-muted-foreground">{f.category} · {f.unit}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Field>
        {txt("brand", "Brand")}
        <Field label="Location" id="f-location">
          <select id="f-location" className={sel} value={draft.location} onChange={(e) => set("location", e.target.value)}>
            {LOCATIONS.map((l) => <option key={l} value={l}>{LOCATION_LABEL[l]}</option>)}
          </select>
        </Field>
        <Field label="Category" id="f-category">
          <select id="f-category" className={sel} value={draft.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        {txt("barcode", "Barcode")}
        {txt("purchase_date", "Purchase date", "date")}
      </section>

      <section aria-labelledby="g-stock" className="space-y-3 rounded-2xl border p-4">
        <div><h3 id="g-stock" className="font-semibold">Stock amount</h3><p className="text-xs text-muted-foreground">How much you have now. Not the serving size or the nutrition basis.</p></div>
        <div className="grid grid-cols-2 gap-4">
        {txt("quantity", "Stock amount", "number")}
        <Field label="Unit" id="f-unit">
          <UnitSelect id="f-unit" value={draft.unit} onChange={(v) => set("unit", v)} />
        </Field>
        {draft.pack_description && <p className="text-sm text-muted-foreground col-span-2">Pack size: {draft.pack_description}</p>}
        {draft.stock_needs_confirmation && (
          <div className="space-y-2 col-span-2">
            <p className="text-sm text-soon">Pack size is missing or ambiguous. Confirm the number of packs, or enter a stock amount and unit.</p>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <Checkbox checked={false} onCheckedChange={(v) => { if (v === true) onChange({ ...draft, stock_needs_confirmation: false, stock_user_entered: true }); }} />
              Confirm stock: {draft.quantity || "—"} {draft.unit || "—"}
            </label>
          </div>
        )}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border p-4">
        <h3 className="font-semibold">Package dates</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date type" id="f-date_type">
            <select id="f-date_type" className={sel} value={draft.date_type} onChange={(e) => set("date_type", e.target.value)}>
              {DATE_TYPES.map((t) => <option key={t} value={t}>{DATE_TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          {draft.date_type !== "none" && txt("printed_date", "Date exactly as printed", "date")}
        </div>
        <p className="text-xs text-muted-foreground">
          Use by = safety. Best before = quality. Sell by = for the shop. <a className="underline" href={FSA_DATES_URL} target="_blank" rel="noreferrer">FSA guidance</a>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {txt("opened_date", "Opened on", "date")}
          {txt("open_life_days", "Once opened, use within (days)", "number", "Only from the label's own instruction.")}
          {draft.open_life_days && txt("open_life_source", "Where this instruction comes from", "text", "e.g. “Package: once opened use within 3 days”")}
          {txt("frozen_date", "Frozen on", "date")}
          {txt("thawed_date", "Thawed on", "date")}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border p-4">
        <h3 className="font-semibold">Allergens</h3>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <Checkbox checked={draft.allergens_known} onCheckedChange={(v) => set("allergens_known", v === true)} />
          I've checked the label's allergen information
        </label>
        {draft.allergens_known && (
          <Input aria-label="Allergens" placeholder="e.g. milk, gluten — leave empty if none" className="h-12" value={draft.allergens} onChange={(e) => set("allergens", e.target.value)} />
        )}
        {!draft.allergens_known && <p className="text-xs text-muted-foreground">Unknown allergens are treated cautiously in recipe ideas.</p>}
      </section>

      <section className="space-y-4 rounded-2xl border p-4">
        <div><h3 className="font-semibold">Serving and nutrition</h3><p className="text-xs text-muted-foreground">Nutrition values are for the "Per" amount below — separate from your stock amount.</p></div>
        {txt("serving_size", "Serving size (as printed)", "text", "For reference only — e.g. “1 can (330 ml)”.")}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Per" id="f-basis_amount">
            <Input id="f-basis_amount" type="number" className="h-12" value={draft.basis_amount} onChange={(e) => set("basis_amount", e.target.value)} />
          </Field>
          <Field label="Unit" id="f-basis_unit">
            <UnitSelect id="f-basis_unit" value={draft.basis_unit} onChange={(v) => set("basis_unit", v)} />
          </Field>
          <Field label="Source" id="f-nsrc">
            <Input id="f-nsrc" className="h-12" value={draft.nutrition_source} onChange={(e) => set("nutrition_source", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NUTRIENTS.map((n) => (
            <Field key={n.key} label={`${n.label} (${n.unit})`} id={`n-${n.key}`}>
              <Input id={`n-${n.key}`} type="number" step="any" className="h-12" placeholder="—" value={draft.nutrients[n.key] ?? ""}
                onChange={(e) => onChange({ ...draft, nutrients: { ...draft.nutrients, [n.key]: e.target.value } })} />
            </Field>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Leave blank if not on the label — blanks are shown as unavailable, never zero.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Conversion: 1 …" id="f-conv_unit" hint="e.g. slices">
            <UnitSelect id="f-conv_unit" value={draft.conv_unit} onChange={(v) => onChange({ ...draft, conv_unit: v, conv_confirmed: false })} />
          </Field>
          <Field label={`= how many ${draft.basis_unit}`} id="f-conv_amount" hint="Only if you've confirmed it">
            <Input id="f-conv_amount" type="number" step="any" className="h-12" value={draft.conv_amount} onChange={(e) => onChange({ ...draft, conv_amount: e.target.value, conv_confirmed: false })} />
          </Field>
        </div>
        {draft.conv_unit && Number(draft.conv_amount) > 0 && (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <Checkbox checked={draft.conv_confirmed === true} onCheckedChange={(v) => onChange({ ...draft, conv_confirmed: v === true })} />
            I've checked on the pack that 1 {draft.conv_unit} = {draft.conv_amount} {draft.basis_unit}
          </label>
        )}
        {draft.conv_unit && !draft.conv_confirmed && <p className="text-xs text-soon">Unconfirmed conversions are not used for calories or macros.</p>}
      </section>

      <Field label="Notes" id="f-notes">
        <Textarea id="f-notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
    </div>
  );
}

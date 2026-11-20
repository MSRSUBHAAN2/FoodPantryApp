import type { PantryItem } from "@/lib/food-types";
import type { Nutrition, NutrientKey } from "@/lib/nutrition";
import { todayIso } from "@/lib/dates";
import { validateStock } from "@/lib/pack-size";

export interface ItemDraft {
  name: string;
  brand: string;
  barcode: string;
  category: string;
  location: string;
  quantity: string;
  unit: string;
  pack_description?: string;
  stock_needs_confirmation?: boolean;
  stock_user_entered?: boolean;
  quantity_entered?: boolean;
  unit_entered?: boolean;
  serving_size: string;
  purchase_date: string;
  printed_date: string;
  date_type: string;
  opened_date: string;
  open_life_days: string;
  open_life_source: string;
  frozen_date: string;
  thawed_date: string;
  allergens: string; // comma separated
  allergens_known: boolean;
  notes: string;
  nutrition_source: string;
  basis_amount: string;
  basis_unit: string;
  nutrients: Partial<Record<NutrientKey, string>>;
  conv_unit: string;
  conv_amount: string;
  conv_confirmed?: boolean;
}

export function emptyDraft(): ItemDraft {
  return {
    name: "", brand: "", barcode: "", category: "Other", location: "fridge", quantity: "1", unit: "pieces",
    serving_size: "", purchase_date: todayIso(), printed_date: "", date_type: "none", opened_date: "",
    open_life_days: "", open_life_source: "", frozen_date: "", thawed_date: "", allergens: "", allergens_known: false,
    notes: "", nutrition_source: "Package label", basis_amount: "100", basis_unit: "g", nutrients: {}, conv_unit: "", conv_amount: "",
  };
}

export function draftFromItem(i: PantryItem): ItemDraft {
  const n = i.nutrition as unknown as Nutrition | null;
  const conv = n?.conversions?.[0];
  return {
    name: i.name, brand: i.brand ?? "", barcode: i.barcode ?? "", category: i.category, location: i.location,
    quantity: String(i.quantity), unit: i.unit, serving_size: i.serving_size ?? "", purchase_date: i.purchase_date,
    printed_date: i.printed_date ?? "", date_type: i.date_type, opened_date: i.opened_date ?? "",
    open_life_days: i.open_life_days == null ? "" : String(i.open_life_days), open_life_source: i.open_life_source ?? "",
    frozen_date: i.frozen_date ?? "", thawed_date: i.thawed_date ?? "", allergens: (i.allergens ?? []).join(", "),
    allergens_known: i.allergens != null, notes: i.notes, nutrition_source: n?.source ?? "Package label",
    basis_amount: String(n?.basis_amount ?? 100), basis_unit: n?.basis_unit ?? "g",
    nutrients: Object.fromEntries(Object.entries(n?.values ?? {}).map(([k, v]) => [k, String(v)])),
    conv_unit: conv?.unit ?? "", conv_amount: conv ? String(conv.amount) : "",
    conv_confirmed: conv?.confirmed === true,
  };
}

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function draftToRow(d: ItemDraft) {
  if (!d.name.trim()) throw new Error("Give the item a name.");
  const { quantity, unit } = validateStock(d.quantity, d.unit, d.stock_needs_confirmation);
  if (d.date_type !== "none" && !d.printed_date) throw new Error("Enter the printed date, or choose “No printed date”.");
  const values: Partial<Record<NutrientKey, number>> = {};
  for (const [k, v] of Object.entries(d.nutrients)) {
    const n = num(v ?? "");
    if (n !== null && Number.isFinite(n)) values[k as NutrientKey] = n;
  }
  const basis = Number(d.basis_amount);
  const nutrition: Nutrition | null =
    Object.keys(values).length > 0 && basis > 0
      ? {
          basis_amount: basis, basis_unit: d.basis_unit, source: d.nutrition_source || "User entered", values,
          ...(d.conv_unit && Number(d.conv_amount) > 0
            ? { conversions: [{ unit: d.conv_unit, amount: Number(d.conv_amount), to_unit: d.basis_unit, ...(d.conv_confirmed === true ? { confirmed: true } : {}) }] }
            : {}),
        }
      : null;
  const old = num(d.open_life_days);
  return {
    name: d.name.trim(), brand: d.brand.trim() || null, barcode: d.barcode.trim() || null, category: d.category,
    location: d.location, quantity, unit, serving_size: d.serving_size.trim() || null,
    purchase_date: d.purchase_date || todayIso(), printed_date: d.date_type === "none" ? null : d.printed_date,
    date_type: d.date_type, opened_date: d.opened_date || null, open_life_days: old,
    open_life_source: old != null ? d.open_life_source.trim() || "Package instructions" : null,
    frozen_date: d.frozen_date || null, thawed_date: d.thawed_date || null,
    allergens: d.allergens_known ? d.allergens.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean) : null,
    notes: d.notes, nutrition: nutrition as never,
  };
}

/** Downscale a photo to a JPEG data URL for reading. */
export async function photoToDataUrl(file: File, max = 1600): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const context = c.getContext("2d");
  if (!context) throw new Error("Could not prepare the photo.");
  context.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

/** An edit to a scan's default pack count must not implicitly confirm a mass/volume. */
export function editStock<T extends { quantity: string; unit: string; stock_needs_confirmation?: boolean; stock_user_entered?: boolean; quantity_entered?: boolean; unit_entered?: boolean }>(d: T, key: "quantity" | "unit", value: string): T {
  const quantity_entered = d.quantity_entered === true || key === "quantity";
  const unit_entered = d.unit_entered === true || key === "unit";
  return { ...d, [key]: value, quantity_entered, unit_entered, stock_user_entered: true,
    stock_needs_confirmation: d.stock_needs_confirmation === true && !(quantity_entered && unit_entered) };
}

export function mergeScannedDraft(previous: ItemDraft | null, scanned: ItemDraft): ItemDraft {
  if (!previous?.stock_user_entered) return scanned;
  return { ...scanned, quantity: previous.quantity, unit: previous.unit,
    stock_user_entered: true, quantity_entered: previous.quantity_entered === true,
    unit_entered: previous.unit_entered === true, stock_needs_confirmation: previous.stock_needs_confirmation === true };
}

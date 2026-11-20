import { emptyDraft, type ItemDraft } from "@/lib/item-form";
import { scannedStock, type PackAmount } from "@/lib/pack-size";
import type { Nutrition, NutrientKey } from "@/lib/nutrition";

function stockDraft(text: string | null, pack: PackAmount | null): ItemDraft {
  const d = emptyDraft();
  const s = pack ? scannedStock({ amount: pack.amount, unit: pack.unit }) : scannedStock({});
  d.quantity = s.quantity;
  d.unit = s.unit;
  d.stock_needs_confirmation = s.needsConfirmation;
  d.pack_description = pack ? `${text || `${pack.amount} ${pack.unit}`}${pack.count > 1 ? ` · ${pack.count} units in one pack` : ""}` : text || "";
  return d;
}

export function barcodeDraft(barcode: string, p?: {
  name: string; brand: string | null; package_quantity: string | null; pack: PackAmount | null;
  serving_size: string | null; allergens: string[] | null; nutrition: Nutrition | null;
}): ItemDraft {
  const d = stockDraft(p?.package_quantity ?? null, p?.pack ?? null);
  d.barcode = barcode.replace(/\D/g, "");
  if (!p) return d;
  d.name = p.name;
  d.brand = p.brand ?? "";
  d.serving_size = p.serving_size ?? "";
  if (p.allergens) { d.allergens_known = true; d.allergens = p.allergens.join(", "); }
  if (p.nutrition) {
    d.basis_amount = String(p.nutrition.basis_amount);
    d.basis_unit = p.nutrition.basis_unit;
    d.nutrition_source = "Open Food Facts";
    d.nutrients = Object.fromEntries(Object.entries(p.nutrition.values).map(([k, v]) => [k, String(v)]));
  }
  return d;
}

export interface LabelRead {
  name: string | null; brand: string | null; pack_size_text: string | null; serving_size: string | null;
  printed_date: string | null; date_type: string; open_life_days: number | null; open_instruction: string | null;
  allergens: string[] | null;
  nutrition: ({ basis_amount: number; basis_unit: string } & Partial<Record<NutrientKey, number | null>>) | null;
}

export function labelDraft(l: LabelRead): ItemDraft {
  const s = scannedStock({ text: l.pack_size_text });
  const d = stockDraft(l.pack_size_text, s.pack);
  d.name = l.name ?? "";
  d.brand = l.brand ?? "";
  d.date_type = l.printed_date ? l.date_type : "none";
  d.printed_date = l.printed_date ?? "";
  if (l.open_life_days != null) { d.open_life_days = String(l.open_life_days); d.open_life_source = `Package: ${l.open_instruction ?? "once opened instruction"}`; }
  d.serving_size = l.serving_size ?? "";
  if (l.allergens) { d.allergens_known = true; d.allergens = l.allergens.join(", "); }
  if (l.nutrition) {
    const { basis_amount, basis_unit, ...values } = l.nutrition;
    d.basis_amount = String(basis_amount);
    d.basis_unit = basis_unit;
    d.nutrition_source = "Package label (photo)";
    d.nutrients = Object.fromEntries(Object.entries(values).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
  }
  return d;
}

export interface ReceiptRow {
  name: string; quantity: string; unit: string; location: string; keep: boolean;
  stock_needs_confirmation: boolean; stock_user_entered?: boolean; quantity_entered?: boolean; unit_entered?: boolean;
  pack_description: string;
}

export function receiptDraft(i: { name: string; purchase_count: number | null; pack_size_text: string | null }): ReceiptRow {
  const s = scannedStock({ text: i.pack_size_text }, i.purchase_count);
  return { name: i.name, quantity: s.quantity, unit: s.unit, stock_needs_confirmation: s.needsConfirmation,
    location: "fridge", keep: false, pack_description: i.pack_size_text || "" };
}
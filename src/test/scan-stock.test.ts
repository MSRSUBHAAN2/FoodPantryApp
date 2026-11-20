import { describe, expect, it } from "vitest";
import { resolvePack, scannedStock, validateStock } from "@/lib/pack-size";
import { barcodeDraft, labelDraft, receiptDraft, type LabelRead } from "@/lib/scan-drafts";
import { draftToRow, emptyDraft, editStock, mergeScannedDraft } from "@/lib/item-form";
import { scaleNutrition } from "@/lib/nutrition";

const product = {
  name: "Artic Coffee Double Shot", brand: null, package_quantity: "250 ml", pack: resolvePack({ text: "250 ml" }),
  serving_size: "125 ml", allergens: null,
  nutrition: { basis_amount: 100, basis_unit: "g", source: "Open Food Facts", values: { energy_kcal: 62 } },
};
const label: LabelRead = {
  name: "Test milk", brand: null, pack_size_text: "1 litre", serving_size: "200 ml", printed_date: null,
  date_type: "none", open_life_days: null, open_instruction: null, allergens: null,
  nutrition: { basis_amount: 100, basis_unit: "ml", energy_kcal: 50 },
};

describe("verified net pack evidence", () => {
  it.each([["0.5 kg", 500, "g"], ["25 cl", 250, "ml"], ["1,5 l", 1500, "ml"], ["6 x 330 ml", 1980, "ml"], ["4 × 125 g", 500, "g"], ["12 pieces", 12, "pieces"]])("converts %s explicitly", (text, amount, unit) => {
    expect(resolvePack({ text: String(text) })).toMatchObject({ amount, unit });
  });
  it("reads verified numeric pack fields without text", () => {
    expect(resolvePack({ amount: 0.25, unit: "kg" })).toEqual({ amount: 250, unit: "g", count: 1 });
  });
  it("accepts equivalent explicit conversions but never g-to-ml equivalence", () => {
    expect(resolvePack({ text: "6 x 330 ml (1.98 l)" })).toEqual({ amount: 1980, unit: "ml", count: 6 });
    expect(resolvePack({ text: "500 g = 0.5 kg" })).toMatchObject({ amount: 500, unit: "g" });
    expect(resolvePack({ text: "500 g (500 ml)" })).toBeNull();
    expect(resolvePack({ text: "1pcs" })).toMatchObject({ amount: 1, unit: "pieces" });
  });
  it("requires confirmation for invalid purchase counts instead of assuming one", () => {
    expect(scannedStock({ text: "250 ml" }, 1.5)).toMatchObject({ quantity: "", unit: "packs", needsConfirmation: true });
  });
  it.each(["250", "250 g / 300 ml", "2-4 x 250 ml", "about 500 g", "500 ml (drained 300 g)", "Double Shot 250", "per 100 g"])("requires confirmation for ambiguous %s", (text) => {
    expect(resolvePack({ text, amount: 250, unit: "ml" })).toBeNull();
  });
  it("rejects contradictory pack fields", () => {
    expect(resolvePack({ text: "330 ml", amount: 100, unit: "g" })).toBeNull();
  });
  it("uses pack count rather than default 1 g/ml when no size exists", () => {
    expect(scannedStock({}, 2)).toMatchObject({ quantity: "2", unit: "packs", needsConfirmation: true });
  });
});

describe("scan to saved stock", () => {
  it("keeps 250 ml stock, 125 ml serving and per-100 g nutrition independent", () => {
    const d = barcodeDraft("123456789", product);
    const row = draftToRow(d);
    expect(row.quantity).toBe(250);
    expect(row.unit).toBe("ml");
    expect(row.serving_size).toBe("125 ml");
    expect(row.nutrition).toMatchObject({ basis_amount: 100, basis_unit: "g" });
    expect(scaleNutrition(product.nutrition, 250, "ml").ok).toBe(false);
  });
  it("blocks missing size until amount/unit or pack count is confirmed", () => {
    const d = barcodeDraft("123456789", { ...product, pack: null, package_quantity: null });
    expect(d.unit).toBe("packs");
    expect(() => draftToRow(d)).toThrow(/Confirm/);
    expect(() => draftToRow(editStock(d, "unit", "g"))).toThrow(/Confirm/);
    expect(draftToRow({ ...d, stock_needs_confirmation: false }).quantity).toBe(1);
    expect(draftToRow(editStock(editStock(d, "quantity", "400"), "unit", "g"))).toMatchObject({ quantity: 400, unit: "g" });
  });
  it("preserves explicitly entered amounts and units across a new lookup", () => {
    const entered = editStock(editStock(emptyDraft(), "quantity", "750"), "unit", "ml");
    expect(draftToRow(mergeScannedDraft(entered, barcodeDraft("123456789", product)))).toMatchObject({ quantity: 750, unit: "ml" });
  });
  it("preserves a user-entered unit without silently borrowing a scan amount", () => {
    const entered = editStock(emptyDraft(), "unit", "pieces");
    expect(mergeScannedDraft(entered, barcodeDraft("123456789", product))).toMatchObject({ quantity: "1", unit: "pieces" });
  });
  it("keeps manual stock entry working", () => {
    expect(draftToRow({ ...emptyDraft(), name: "Apple" })).toMatchObject({ quantity: 1, unit: "pieces" });
  });
  it("never saves blank quantity as zero or falls back to one", () => {
    expect(() => validateStock("", "g")).toThrow();
    expect(() => validateStock("bad", "ml")).toThrow();
    expect(() => validateStock("250", "")).toThrow();
  });
  it("reads label net amount independently of serving and per-100 ml", () => {
    const row = draftToRow(labelDraft(label));
    expect(row).toMatchObject({ quantity: 1000, unit: "ml", serving_size: "200 ml", nutrition: { basis_amount: 100, basis_unit: "ml" } });
  });
  it("label-only nutrition cannot become stock size", () => {
    const d = labelDraft({ ...label, pack_size_text: null });
    expect(d).toMatchObject({ quantity: "1", unit: "packs", stock_needs_confirmation: true, basis_unit: "ml" });
    expect(() => draftToRow(d)).toThrow(/Confirm/);
  });
  it("receipt purchase count multiplies explicit net pack size, not price/name", () => {
    expect(receiptDraft({ name: "Coffee Double Shot", purchase_count: 2, pack_size_text: "250 ml" })).toMatchObject({ quantity: "500", unit: "ml", stock_needs_confirmation: false });
    expect(receiptDraft({ name: "Milk 100", purchase_count: 2, pack_size_text: null })).toMatchObject({ quantity: "2", unit: "packs", stock_needs_confirmation: true });
    expect(receiptDraft({ name: "Tomatoes", purchase_count: null, pack_size_text: "0.42 kg" })).toMatchObject({ quantity: "420", unit: "g" });
  });
});
describe("conversion provenance in the item form", () => {
  it("saves a conversion as confirmed only when the user ticks the check", () => {
    const base = { ...emptyDraft(), name: "Bread", unit: "slices", quantity: "10", nutrients: { energy_kcal: "250" }, conv_unit: "slices", conv_amount: "30" };
    const unconfirmed = draftToRow(base).nutrition as unknown as { conversions: { confirmed?: boolean }[] };
    expect(unconfirmed.conversions[0]?.confirmed).toBeUndefined();
    const confirmed = draftToRow({ ...base, conv_confirmed: true }).nutrition as unknown as { conversions: { confirmed?: boolean }[] };
    expect(confirmed.conversions[0]?.confirmed).toBe(true);
  });
});

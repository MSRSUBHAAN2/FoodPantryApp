import { describe, expect, it } from "vitest";
import { summariseDates, reminderDue, type DateInputs } from "@/lib/dates";
import { scaleNutrition, sumNutrients, type Nutrition } from "@/lib/nutrition";

const base: DateInputs = {
  printed_date: null, date_type: "none", opened_date: null, open_life_days: null,
  open_life_source: null, frozen_date: null, thawed_date: null, location: "fridge",
};

describe("date rules", () => {
  it("use-by is a safety deadline and turns red the day after", () => {
    const s = summariseDates({ ...base, printed_date: "2026-11-20", date_type: "use_by" }, "2026-11-21");
    expect(s.status).toBe("past_safety");
  });
  it("opening with label instructions uses the earlier date and never extends use-by", () => {
    const early = summariseDates({ ...base, printed_date: "2026-11-30", date_type: "use_by", opened_date: "2026-11-20", open_life_days: 3 }, "2026-11-20");
    expect(early.safety?.date).toBe("2026-11-23");
    const late = summariseDates({ ...base, printed_date: "2026-11-22", date_type: "use_by", opened_date: "2026-11-20", open_life_days: 5 }, "2026-11-20");
    expect(late.safety?.date).toBe("2026-11-22");
  });
  it("opening without instructions says the after-opening date is unknown", () => {
    const s = summariseDates({ ...base, printed_date: "2026-11-30", date_type: "use_by", opened_date: "2026-11-20" }, "2026-11-20");
    expect(s.notes.join(" ")).toMatch(/After-opening date unknown/);
  });
  it("best before is never a safety date", () => {
    const s = summariseDates({ ...base, printed_date: "2026-11-01", date_type: "best_before" }, "2026-11-20");
    expect(s.safety).toBeNull();
    expect(s.status).toBe("past_quality");
  });
  it("sell by gives no deadline", () => {
    const s = summariseDates({ ...base, printed_date: "2026-11-01", date_type: "sell_by" }, "2026-11-20");
    expect(s.status).toBe("unknown");
  });
  it("freezing keeps the printed date and thawing gives 24 hours", () => {
    const frozen = summariseDates({ ...base, printed_date: "2026-11-22", date_type: "use_by", frozen_date: "2026-11-21", location: "freezer" }, "2026-12-10");
    expect(frozen.status).toBe("frozen");
    expect(frozen.printed?.date).toBe("2026-11-22");
    const thawed = summariseDates({ ...base, printed_date: "2026-11-22", date_type: "use_by", frozen_date: "2026-11-21", thawed_date: "2026-12-10" }, "2026-12-10");
    expect(thawed.safety?.date).toBe("2026-12-11");
  });
  it("freezing after the use-by date is unsafe", () => {
    const s = summariseDates({ ...base, printed_date: "2026-11-20", date_type: "use_by", frozen_date: "2026-11-22" }, "2026-11-22");
    expect(s.status).toBe("past_safety");
  });
  it("reminders fire at 7, 3 and 1 days and when overdue", () => {
    const at = (d: string) => summariseDates({ ...base, printed_date: "2026-11-27", date_type: "use_by" }, d);
    expect(reminderDue(at("2026-11-20"), [7, 3, 1], true)).toBe("Due in 7 days");
    expect(reminderDue(at("2026-11-19"), [7, 3, 1], true)).toBeNull();
    expect(reminderDue(at("2026-11-28"), [7, 3, 1], true)).toBe("Past its safety date");
  });
});

describe("nutrition", () => {
  const n: Nutrition = { basis_amount: 100, basis_unit: "g", source: "Package label", values: { energy_kcal: 200, protein_g: 10 } };
  it("scales by matching basis and marks missing nutrients as unavailable, not zero", () => {
    const s = scaleNutrition(n, 50, "g");
    expect(s.values.energy_kcal).toBe(100);
    expect(s.values.fat_g).toBeUndefined();
    expect(s.complete).toBe(false);
  });
  it("refuses to convert units without a confirmed conversion", () => {
    expect(scaleNutrition(n, 2, "slices").ok).toBe(false);
    expect(scaleNutrition({ ...n, conversions: [{ unit: "slices", amount: 30, to_unit: "g", confirmed: true }] }, 2, "slices").values.energy_kcal).toBe(120);
  });
  it("ignores a legacy cross-unit conversion with no confirmed provenance (1 ml = 330 g)", () => {
    const coffee = { basis_amount: 100, basis_unit: "g", source: "Open Food Facts", values: { energy_kcal: 55, protein_g: 3, carbs_g: 8.9, fat_g: 0.8 }, conversions: [{ unit: "ml", amount: 330, to_unit: "g" }] };
    const s = scaleNutrition(coffee, 1, "ml");
    expect(s.ok).toBe(false);
    expect(s.needsConfirmation).toBe(true);
    expect(s.values.energy_kcal).toBeUndefined();
    expect(s.values.protein_g).toBeUndefined();
  });
  it("never assumes g equals ml", () => {
    expect(scaleNutrition({ ...n, basis_unit: "g" }, 100, "ml").ok).toBe(false);
  });
  it("keeps same-unit math exact for calories and all three macros", () => {
    const s = scaleNutrition({ basis_amount: 100, basis_unit: "ml", source: "x", values: { energy_kcal: 64, protein_g: 3.4, carbs_g: 4.8, fat_g: 3.6 } }, 250, "ml");
    expect(s.values).toMatchObject({ energy_kcal: 160, protein_g: 8.5, carbs_g: 12, fat_g: 9 });
  });
  it("flags totals as partial when an entry lacks a nutrient", () => {
    const t = sumNutrients([{ values: { energy_kcal: 100, fat_g: 2 } }, { values: { energy_kcal: 50 } }]);
    expect(t.values.energy_kcal).toBe(150);
    expect(t.partial.fat_g).toBe(true);
  });
});

import { goalRows } from "@/lib/nutrition";
describe("daily goals", () => {
  const t = sumNutrients([{ values: { energy_kcal: 500, protein_g: 20, carbs_g: 60 } }]);
  it("shows remaining only for goals the user set", () => {
    const rows = goalRows(t, { energy_kcal: 2000, protein_g: 100, carbs_g: null }, true);
    expect(rows.find((r) => r.key === "energy_kcal")).toMatchObject({ remaining: 1500, pct: 25 });
    expect(rows.find((r) => r.key === "protein_g")).toMatchObject({ remaining: 80, pct: 20 });
    expect(rows.find((r) => r.key === "carbs_g")).toMatchObject({ goal: null, remaining: null });
  });
  it("marks fat as unavailable, not zero, when no entry has it", () => {
    expect(goalRows(t, { fat_g: 70 }, true).find((r) => r.key === "fat_g")).toMatchObject({ eaten: null, partial: true });
  });
});

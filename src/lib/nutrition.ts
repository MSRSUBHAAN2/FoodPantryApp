export const NUTRIENTS = [
  { key: "energy_kcal", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g" },
  { key: "fibre_g", label: "Fibre", unit: "g" },
  { key: "sugars_g", label: "Sugars", unit: "g" },
  { key: "salt_g", label: "Salt", unit: "g" },
] as const;
export type NutrientKey = (typeof NUTRIENTS)[number]["key"];
export const CORE: NutrientKey[] = ["energy_kcal", "protein_g", "carbs_g", "fat_g", "fibre_g"];

export interface Nutrition {
  basis_amount: number; // e.g. 100
  basis_unit: string; // e.g. "g"
  source: string; // "Open Food Facts", "Package label", "User entered"
  values: Partial<Record<NutrientKey, number>>;
  conversions?: { unit: string; amount: number; to_unit: string; confirmed?: boolean }[]; // only `confirmed: true` is trusted, e.g. 1 slice = 30 g
}

export interface Scaled {
  values: Partial<Record<NutrientKey, number>>;
  missing: NutrientKey[];
  complete: boolean;
  ok: boolean; // false = no matching basis, nothing could be calculated
  reason?: string;
  needsConfirmation?: boolean; // a stored conversion exists but has no verified provenance
}

export function parseNutrition(raw: unknown): Nutrition | null {
  if (!raw || typeof raw !== "object") return null;
  const n = raw as Nutrition;
  if (typeof n.basis_amount !== "number" || !n.basis_unit || !n.values) return null;
  return n;
}

/** Scale nutrition to an amount. Only converts with a matching basis or a user-confirmed conversion. */
export function scaleNutrition(n: Nutrition | null, amount: number, unit: string): Scaled {
  const none: Scaled = { values: {}, missing: [...CORE], complete: false, ok: false };
  if (!n) return { ...none, reason: "No nutrition recorded" };
  let qty = amount;
  if (unit !== n.basis_unit) {
    const match = n.conversions?.find((c) => c.unit === unit && c.to_unit === n.basis_unit);
    const conv = match && match.confirmed === true && Number.isFinite(match.amount) && match.amount > 0 ? match : undefined;
    if (!conv) {
      return match
        ? { ...none, needsConfirmation: true, reason: `The saved ${unit}-to-${n.basis_unit} conversion isn't confirmed. Edit the item to check it against the pack` }
        : { ...none, reason: `No confirmed conversion from ${unit} to ${n.basis_unit}` };
    }
    qty = amount * conv.amount;
  }
  const f = qty / n.basis_amount;
  const values: Partial<Record<NutrientKey, number>> = {};
  for (const { key } of NUTRIENTS) {
    const v = n.values[key];
    if (typeof v === "number" && Number.isFinite(v)) values[key] = Math.round(v * f * 10) / 10;
  }
  const missing = CORE.filter((k) => values[k] === undefined);
  return { values, missing, complete: missing.length === 0, ok: true };
}

export interface Totals {
  values: Partial<Record<NutrientKey, number>>;
  partial: Partial<Record<NutrientKey, boolean>>; // true = at least one entry lacked this nutrient
}

export function sumNutrients(entries: { values: Partial<Record<NutrientKey, number>> }[]): Totals {
  const values: Partial<Record<NutrientKey, number>> = {};
  const partial: Partial<Record<NutrientKey, boolean>> = {};
  for (const { key } of NUTRIENTS) {
    for (const e of entries) {
      const v = e.values[key];
      if (typeof v === "number") values[key] = Math.round(((values[key] ?? 0) + v) * 10) / 10;
      else partial[key] = true;
    }
  }
  return { values, partial };
}

export const GOAL_KEYS = ["energy_kcal", "protein_g", "carbs_g", "fat_g"] as const;
export type GoalKey = (typeof GOAL_KEYS)[number];
export type Goals = Partial<Record<GoalKey, number | null>>;

export interface GoalRow { key: GoalKey; label: string; unit: string; eaten: number | null; partial: boolean; goal: number | null; remaining: number | null; pct: number | null }

/** Daily status per nutrient. Goals are opt-in: no goal → no remaining/progress, never an invented default. */
export function goalRows(t: Totals, goals: Goals, hasEntries: boolean): GoalRow[] {
  return GOAL_KEYS.map((key) => {
    const meta = NUTRIENTS.find((n) => n.key === key)!;
    const v = t.values[key];
    const eaten = hasEntries ? (v ?? null) : 0;
    const g = goals[key];
    const goal = typeof g === "number" && g > 0 ? g : null;
    const base = eaten ?? 0;
    return { key, label: meta.label, unit: meta.unit, eaten, partial: hasEntries && t.partial[key] === true, goal,
      remaining: goal == null ? null : Math.round((goal - base) * 10) / 10,
      pct: goal == null ? null : Math.min(100, Math.round((base / goal) * 100)) };
  });
}

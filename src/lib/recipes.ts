import type { PantryItem } from "@/lib/food-types";
import { summariseDates, usePriority } from "@/lib/dates";
import { parseNutrition, scaleNutrition, sumNutrients, type NutrientKey } from "@/lib/nutrition";

export interface AiRecipe {
  title: string;
  minutes: number;
  servings: number;
  equipment: string[];
  ingredients: { name: string; item_id: string | null; amount: number; unit: string; optional: boolean }[];
  steps: string[];
}

export interface CheckedIngredient {
  name: string; amount: number; unit: string; optional: boolean;
  item: PantryItem | null; onHand: boolean; note?: string;
}

export interface CheckedRecipe extends AiRecipe {
  checked: CheckedIngredient[];
  missingRequired: CheckedIngredient[];
  perServing: Partial<Record<NutrientKey, number>>;
  nutritionPartial: boolean;
  allergenWarnings: string[];
  usesSoon: number;
}

const has = (text: string, words: string[]) => words.find((w) => w && text.toLowerCase().includes(w.toLowerCase()));

/** Items eligible for recipes: in stock, not frozen solid, not past a safety deadline, no listed user allergen. */
export function eligibleItems(items: PantryItem[], allergies: string[], today: string) {
  return items
    .filter((i) => i.status === "active" && i.quantity > 0)
    .map((i) => ({ i, s: summariseDates(i, today) }))
    .filter(({ s }) => s.status !== "past_safety" && s.status !== "frozen")
    .filter(({ i }) => !(i.allergens ?? []).some((a) => has(a, allergies)) && !has(i.name, allergies))
    .map(({ i, s }) => ({ item: i, priority: usePriority(s, !!i.opened_date), soon: s.status === "soon" }));
}

export function checkRecipe(r: AiRecipe, items: PantryItem[], allergies: string[], dislikes: string[], soonIds: Set<string>): CheckedRecipe | null {
  const byId = new Map(items.map((i) => [i.id, i]));
  const warnings: string[] = [];
  const checked: CheckedIngredient[] = r.ingredients.map((ing) => {
    const item = ing.item_id ? byId.get(ing.item_id) ?? null : null;
    if (!item) return { ...ing, item: null, onHand: false };
    if (item.unit !== ing.unit) return { ...ing, item, onHand: false, note: `Recipe uses ${ing.unit}; your stock is in ${item.unit}` };
    const enough = item.quantity >= ing.amount;
    return { ...ing, item, onHand: enough, ...(enough ? {} : { note: `Only ${item.quantity} ${item.unit} left` }) };
  });
  // Conservative allergen check on every ingredient name, plus unknown allergen info.
  for (const c of checked) {
    if (has(c.name, allergies) || has(c.name, dislikes)) return null;
    if (c.item && c.item.allergens == null && allergies.length) warnings.push(`${c.item.name}: allergen info not recorded`);
    if (!c.item && allergies.length) warnings.push(`${c.name}: check the label for ${allergies.join(", ")}`);
  }
  const used = checked.filter((c) => c.item && c.item.unit === c.unit);
  const parts = used.map((c) => scaleNutrition(parseNutrition(c.item!.nutrition), c.amount, c.unit));
  const total = sumNutrients(parts.map((p) => ({ values: p.values })));
  const servings = Math.max(1, r.servings);
  const perServing = Object.fromEntries(Object.entries(total.values).map(([k, v]) => [k, Math.round(((v as number) / servings) * 10) / 10]));
  const nutritionPartial =
    checked.some((c) => !c.item || c.item.unit !== c.unit) || parts.some((p) => !p.complete) || used.length === 0;
  return {
    ...r, checked, missingRequired: checked.filter((c) => !c.onHand && !c.optional),
    perServing, nutritionPartial, allergenWarnings: warnings,
    usesSoon: checked.filter((c) => c.item && soonIds.has(c.item.id)).length,
  };
}

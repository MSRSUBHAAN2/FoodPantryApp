import { describe, expect, it } from "vitest";
import { checkRecipe, eligibleItems } from "@/lib/recipes";
import type { PantryItem } from "@/lib/food-types";

const item = (p: Partial<PantryItem>) => ({
  status: "active", quantity: 1000, unit: "ml", allergens: [], printed_date: null, date_type: "none", opened_date: null,
  open_life_days: null, open_life_source: null, frozen_date: null, thawed_date: null, location: "fridge", ...p,
}) as unknown as PantryItem;

const coffee = item({ id: "c", name: "Artic Coffee Double Shot", allergens: ["milk"], nutrition: {
  basis_amount: 100, basis_unit: "g", source: "Open Food Facts", values: { energy_kcal: 55, protein_g: 3 },
  conversions: [{ unit: "ml", amount: 330, to_unit: "g" }] } as never });
const water = item({ id: "w", name: "Oat drink", nutrition: { basis_amount: 100, basis_unit: "ml", source: "Label", values: { energy_kcal: 40, protein_g: 1 } } as never });

const recipe = { title: "Iced coffee", minutes: 5, servings: 1, equipment: [], steps: [], ingredients: [
  { name: "Artic Coffee Double Shot", item_id: "c", amount: 100, unit: "ml", optional: false },
  { name: "Oat drink", item_id: "w", amount: 100, unit: "ml", optional: false },
] };

describe("recipe nutrition", () => {
  it("leaves the unconfirmed legacy ml-to-g conversion out and marks the recipe partial", () => {
    const r = checkRecipe(recipe, [coffee, water], [], [], new Set())!;
    expect(r.perServing.energy_kcal).toBe(40);
    expect(r.nutritionPartial).toBe(true);
  });
  it("excludes items listing an allergen the user avoids", () => {
    expect(eligibleItems([coffee, water], ["milk"], "2026-11-20").map((e) => e.item.id)).toEqual(["w"]);
  });
});

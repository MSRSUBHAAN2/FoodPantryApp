export type CommonFood = { name: string; category: string; location: "fridge" | "freezer" | "cupboard" | "pantry"; unit: string };
const P = (name: string, location: CommonFood["location"] = "pantry", unit = "pieces"): CommonFood => ({ name, category: "Produce", location, unit });
export const COMMON_FOODS: CommonFood[] = [
  P("Apples", "fridge"), P("Bananas"), P("Oranges"), P("Lemons", "fridge"), P("Limes", "fridge"), P("Pears", "fridge"),
  P("Grapes", "fridge", "g"), P("Strawberries", "fridge", "g"), P("Blueberries", "fridge", "g"), P("Avocados"),
  P("Tomatoes", "fridge"), P("Cucumber", "fridge"), P("Lettuce", "fridge"), P("Spinach", "fridge", "g"),
  P("Carrots", "fridge"), P("Broccoli", "fridge"), P("Peppers", "fridge"), P("Mushrooms", "fridge", "g"),
  P("Onions"), P("Garlic"), P("Potatoes", "pantry", "g"), P("Sweet potatoes"), P("Courgettes", "fridge"),
  { name: "Milk", category: "Dairy", location: "fridge", unit: "ml" },
  { name: "Eggs", category: "Dairy", location: "fridge", unit: "pieces" },
  { name: "Butter", category: "Dairy", location: "fridge", unit: "g" },
  { name: "Cheddar cheese", category: "Dairy", location: "fridge", unit: "g" },
  { name: "Yoghurt", category: "Dairy", location: "fridge", unit: "g" },
  { name: "Chicken breast", category: "Meat & fish", location: "fridge", unit: "g" },
  { name: "Beef mince", category: "Meat & fish", location: "fridge", unit: "g" },
  { name: "Salmon fillets", category: "Meat & fish", location: "fridge", unit: "pieces" },
  { name: "Bread", category: "Bakery", location: "cupboard", unit: "slices" },
  { name: "Rice", category: "Dry goods", location: "cupboard", unit: "g" },
  { name: "Pasta", category: "Dry goods", location: "cupboard", unit: "g" },
  { name: "Oats", category: "Dry goods", location: "cupboard", unit: "g" },
  { name: "Chopped tomatoes", category: "Tins & jars", location: "cupboard", unit: "cans" },
  { name: "Baked beans", category: "Tins & jars", location: "cupboard", unit: "cans" },
  { name: "Frozen peas", category: "Frozen", location: "freezer", unit: "g" },
];
export function searchFoods(q: string, limit = 6): CommonFood[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return COMMON_FOODS.filter((f) => f.name.toLowerCase().includes(s))
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(s)) - Number(!b.name.toLowerCase().startsWith(s)))
    .slice(0, limit);
}

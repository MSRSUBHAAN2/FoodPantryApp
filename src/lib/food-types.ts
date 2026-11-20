import type { Database } from "@/integrations/supabase/types";

export type PantryItem = Database["public"]["Tables"]["pantry_items"]["Row"];
export type DiaryEntry = Database["public"]["Tables"]["diary_entries"]["Row"];
export type ShoppingItem = Database["public"]["Tables"]["shopping_items"]["Row"];
export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];
export type ItemEvent = Database["public"]["Tables"]["item_events"]["Row"];

export const LOCATIONS = ["fridge", "freezer", "cupboard", "pantry"] as const;
export type Location = (typeof LOCATIONS)[number];
export const LOCATION_LABEL: Record<Location, string> = {
  fridge: "Fridge",
  freezer: "Freezer",
  cupboard: "Cupboard",
  pantry: "Pantry",
};
export const DATE_TYPES = ["use_by", "best_before", "sell_by", "none"] as const;
export type DateType = (typeof DATE_TYPES)[number];
export const DATE_TYPE_LABEL: Record<DateType, string> = {
  use_by: "Use by",
  best_before: "Best before",
  sell_by: "Sell by",
  none: "No printed date",
};
export const UNITS = ["g", "ml", "packs", "pieces", "slices", "cans", "servings"] as const;
export const MEALS = ["breakfast", "lunch", "dinner", "snacks"] as const;
export type Meal = (typeof MEALS)[number];
export const CATEGORIES = ["Produce", "Dairy", "Meat & fish", "Bakery", "Tins & jars", "Dry goods", "Frozen", "Drinks", "Snacks", "Other"];

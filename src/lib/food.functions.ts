import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod/v4";
import { resolvePack } from "@/lib/pack-size";

const MODEL = "openai/gpt-6-astra";

async function aiObject<T>(schema: z.ZodType<T>, instructions: string, content: unknown[]): Promise<T> {
  const { createOpenAI } = await import("@ai-sdk/openai");
  const { streamText, Output } = await import("ai");
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI service is not configured.");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  let failure: unknown = null;
  const result = streamText({
    model: provider.responses(MODEL),
    instructions,
    messages: [{ role: "user", content: content as never }],
    output: Output.object({ schema }),
    onError: ({ error }) => {
      failure = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  try {
    for await (const _ of result.textStream) void _;
    return (await result.output) as T;
  } catch (e) {
    const err = (failure ?? e) as { statusCode?: number; message?: string };
    console.error("AI request failed", err);
    if (err.statusCode === 429) throw new Error("The AI service is busy. Please try again in a minute.");
    if (err.statusCode === 402) throw new Error("AI credits have run out for this workspace.");
    throw new Error("The AI service could not read this. Please enter the details manually.");
  }
}

// ---------- Barcode lookup (Open Food Facts) ----------
export const lookupBarcode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { barcode: string }) => {
    const code = String(d.barcode ?? "").replace(/\D/g, "");
    if (code.length < 6 || code.length > 14) throw new Error("Enter a barcode of 6–14 digits.");
    return { barcode: code };
  })
  .handler(async ({ data }) => {
    const url = `https://world.openfoodfacts.org/api/v2/product/${data.barcode}.json?fields=product_name,brands,quantity,product_quantity,product_quantity_unit,serving_size,nutriments,allergens_tags,categories_tags,nutrition_data_per`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": "UseItUp/1.0 (food inventory app)" } });
    } catch {
      return { found: false as const, error: "Could not reach Open Food Facts. Check your connection or enter the product manually." };
    }
    if (res.status === 404) return { found: false as const, error: "This barcode is not in Open Food Facts. Enter the details from the label." };
    if (!res.ok) return { found: false as const, error: `Open Food Facts returned an error (${res.status}). Enter the product manually.` };
    const json = (await res.json()) as { status?: number; product?: Record<string, unknown> };
    if (json.status !== 1 || !json.product) return { found: false as const, error: "This barcode is not in Open Food Facts. Enter the details from the label." };
    const p = json.product as {
      product_name?: string; brands?: string; quantity?: string; serving_size?: string;
      product_quantity?: number; product_quantity_unit?: string; nutrition_data_per?: string;
      nutriments?: Record<string, number>; allergens_tags?: string[];
    };
    const n = p.nutriments ?? {};
    const pick = (k: string) => (typeof n[k] === "number" ? n[k] : null);
    // OFF's _100g values are not a net pack amount. Only an explicit nutrition
    // basis changes their unit; a liquid package is NOT a g-to-ml conversion.
    const nutritionUnit = p.nutrition_data_per === "100ml" ? "ml" : "g";
    const values = {
      energy_kcal: pick("energy-kcal_100g"), protein_g: pick("proteins_100g"), carbs_g: pick("carbohydrates_100g"),
      fat_g: pick("fat_100g"), fibre_g: pick("fiber_100g"), sugars_g: pick("sugars_100g"), salt_g: pick("salt_100g"),
    };
    const hasAny = Object.values(values).some((v) => v !== null);
    return {
      found: true as const,
      product: {
        name: p.product_name?.trim() || "",
        brand: p.brands?.split(",")[0]?.trim() || null,
        package_quantity: p.quantity || null,
        pack: resolvePack({ text: p.quantity ?? null, amount: p.product_quantity ?? null, unit: p.product_quantity_unit ?? null }),
        serving_size: p.serving_size || null,
        allergens: p.allergens_tags && p.allergens_tags.length ? p.allergens_tags.map((t) => t.replace(/^\w+:/, "")) : null,
        nutrition: hasAny
          ? {
              basis_amount: 100, basis_unit: nutritionUnit, source: "Open Food Facts",
              values: Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null)),
            }
          : null,
      },
    };
  });

// ---------- Photo / receipt reading ----------
const nn = z.number().nullable();
const labelSchema = z.object({
  name: z.string().nullable(),
  brand: z.string().nullable(),
  printed_date: z.string().nullable().describe("YYYY-MM-DD exactly as printed, null if not visible"),
  date_type: z.enum(["use_by", "best_before", "sell_by", "none"]),
  open_life_days: z.number().nullable().describe("Only if label says 'once opened use within N days'"),
  open_instruction: z.string().nullable().describe("Verbatim after-opening instruction text"),
  pack_size_text: z.string().nullable().describe("Verbatim explicit net weight/volume or pack count, including multipacks such as 6 x 330 ml. Null if absent/ambiguous. Never take this from product name, serving size or nutrition basis."),
  serving_size: z.string().nullable(),
  allergens: z.array(z.string()).nullable().describe("Allergens in bold/listed on label; null if no ingredients list visible"),
  nutrition: z
    .object({
      basis_amount: z.number(),
      basis_unit: z.enum(["g", "ml"]),
      energy_kcal: nn, protein_g: nn, carbs_g: nn, fat_g: nn, fibre_g: nn, sugars_g: nn, salt_g: nn,
    })
    .nullable(),
  unreadable: z.string().nullable().describe("What could not be read, if anything"),
});
const receiptSchema = z.object({
  items: z.array(z.object({ name: z.string(),
    purchase_count: nn.describe("Number of packages bought, only from explicit purchase quantity; NOT grams, price or pack size."),
    pack_size_text: z.string().nullable().describe("Verbatim explicit net pack amount or weighed amount bought, including units/multipacks. Null if absent or ambiguous. Never guess size from a product name."),
  })),
  unreadable: z.string().nullable(),
});

export const readFoodImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { image: string; mode: "label" | "receipt" }) => {
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(d.image)) throw new Error("Please use a JPG, PNG or WebP photo.");
    if (d.image.length > 8_000_000) throw new Error("Photo is too large.");
    return { image: d.image, mode: d.mode === "receipt" ? ("receipt" as const) : ("label" as const) };
  })
  .handler(async ({ data }) => {
    const img = { type: "image", image: new URL(data.image) };
    if (data.mode === "receipt") {
      return {
        mode: "receipt" as const,
        receipt: await aiObject(receiptSchema,
          "Read a grocery receipt. List only food products bought, with readable names (expand abbreviations only when certain). Never invent items, dates or expiry information. Keep purchase count separate from net pack size. Transcribe a net or weighed amount only when explicitly printed as an amount and unit. For weighted produce purchase_count is null: the weighed amount is already the total. Do not treat price, a product name number, serving size or nutrition basis as pack size. Use null when unknown.",
          [{ type: "text", text: "Extract the food items from this receipt." }, img]),
      };
    }
    return {
      mode: "label" as const,
      label: await aiObject(labelSchema,
        "Read food packaging. Transcribe ONLY what is printed: product name, brand, date and its exact type (use by / best before / sell by; 'display until' = sell_by), after-opening instructions, nutrition table values with their basis (per 100g/100ml), allergens. Keep net pack weight/volume/count in pack_size_text, serving size in serving_size and nutrition basis separate. Never use per-100g/ml or serving size as net contents. Never infer a pack amount from a product name or convert g to ml. Use null for anything not clearly visible. Never guess dates or nutrient values.",
        [{ type: "text", text: "Read this food label." }, img]),
    };
  });

// ---------- Recipes ----------
const recipeSchema = z.object({
  recipes: z.array(
    z.object({
      title: z.string(),
      minutes: z.number(),
      servings: z.number(),
      equipment: z.array(z.string()),
      ingredients: z.array(
        z.object({
          name: z.string(),
          item_id: z.string().nullable().describe("id of the on-hand item used, or null if it must be bought"),
          amount: z.number(),
          unit: z.string().describe("Use the on-hand item's unit when item_id is set"),
          optional: z.boolean(),
        }),
      ),
      steps: z.array(z.string()),
    }),
  ),
});

export const suggestRecipes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: {
    items: { id: string; name: string; quantity: number; unit: string; location: string; priority: number; allergens: string[] | null }[];
    prefs: { dietary: string; allergies: string[]; dislikes: string[]; maxMinutes: number; servings: number; equipment: string[]; kcalPerServing: number | null };
  }) => {
    if (!Array.isArray(d.items) || d.items.length === 0) throw new Error("Add some food to your inventory first.");
    return { items: d.items.slice(0, 80), prefs: d.prefs };
  })
  .handler(async ({ data }) => {
    const { prefs } = data;
    const out = await aiObject(recipeSchema,
      `You suggest 4 practical home recipes using the user's real stock. Prioritise items with the highest priority (closer dates / opened). Never use more of an item than its quantity. Use the item's exact unit and id. Missing ingredients get item_id null; mark pantry staples like salt as optional. Strictly obey: diet "${prefs.dietary}", must NOT contain allergens: ${prefs.allergies.join(", ") || "none"}; avoid: ${prefs.dislikes.join(", ") || "nothing"}; max ${prefs.maxMinutes} minutes; ${prefs.servings} servings; only equipment: ${prefs.equipment.join(", ")}.${prefs.kcalPerServing ? ` Aim for about ${prefs.kcalPerServing} kcal per serving or less.` : ""} Do not state calories. Steps must be concrete.`,
      [{ type: "text", text: JSON.stringify(data.items) }]);
    return out.recipes;
  });

// ---------- Account deletion ----------
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    for (const t of ["diary_entries", "item_events", "pantry_items", "shopping_items", "user_settings"] as const) {
      const { error } = await supabaseAdmin.from(t).delete().eq("user_id", uid);
      if (error) throw new Error(`Could not delete ${t}`);
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error("Your data was deleted but the account could not be removed. Please try again.");
    return { ok: true };
  });

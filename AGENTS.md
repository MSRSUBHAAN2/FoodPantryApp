<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Application architecture
- Browser reads/writes user data directly through the Supabase client under owner-only RLS; stock+diary changes go through SQL functions (`consume_item`, `delete_diary_entry`, `update_diary_amount`) so they stay atomic and idempotent by request id.
- Server functions (`src/lib/food.functions.ts`) only handle external calls (Open Food Facts, AI photo reading, AI recipes) and account deletion; the bearer token is attached by `src/lib/auth-bearer.ts`.
- Food date and nutrition rules live in pure modules (`src/lib/dates.ts`, `src/lib/nutrition.ts`) covered by `src/test/food-rules.test.ts`; change rules there, not in components.
- Resolve scanned stock only from explicit net-pack evidence in `pack-size.ts` and shared scan draft adapters; never derive it from nutrition/servings, so all scan paths preserve quantity/unit semantics without rewriting saved items.
- Live barcode scanning decodes frames locally with ZXing in `barcode-camera.tsx` (no BarcodeDetector) and validates codes in `retail-barcode.ts`; the camera opens only on tap and must stop its tracks on every exit path.

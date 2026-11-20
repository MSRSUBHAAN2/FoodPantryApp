import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Empty, ErrorNote } from "@/components/app/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useShopping } from "@/lib/data";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/shopping")({
  head: () => pageHead("Shopping list — Use It Up", "Ingredients you need to buy."),
  component: ShoppingPage,
});

function ShoppingPage() {
  const q = useShopping();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["shopping"] });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("shopping_items").insert({ name: name.trim() });
    if (error) return void toast.error(error.message);
    setName("");
    refresh();
  }
  return (
    <AppShell title="Shopping list">
      <form onSubmit={add} className="flex gap-2">
        <Input aria-label="Item to buy" placeholder="Add an item" className="h-12" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" className="h-12">Add</Button>
      </form>
      {q.error && <ErrorNote error={q.error} />}
      {q.data?.length === 0 && <Empty title="Your list is empty">Add missing recipe ingredients from a recipe.</Empty>}
      <ul className="space-y-2">
        {q.data?.map((s) => (
          <li key={s.id} className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4">
            <Checkbox aria-label={`Bought ${s.name}`} checked={s.done} onCheckedChange={async (v) => { await supabase.from("shopping_items").update({ done: v === true }).eq("id", s.id); refresh(); }} />
            <span className={`flex-1 ${s.done ? "text-muted-foreground line-through" : ""}`}>{s.name} <span className="text-sm text-muted-foreground">{s.quantity}</span></span>
            <Button size="icon" variant="ghost" className="size-11" aria-label="Remove" onClick={async () => { await supabase.from("shopping_items").delete().eq("id", s.id); refresh(); }}><Trash2 className="size-4" /></Button>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

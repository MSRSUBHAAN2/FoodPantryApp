import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, ErrorNote } from "@/components/app/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { useSaveSettings, useSettings } from "@/lib/data";
import { deleteMyAccount } from "@/lib/food.functions";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/settings")({
  head: () => pageHead("Settings — Use It Up", "Food preferences, calorie goal, reminders and your data."),
  component: SettingsPage,
});

const list = (s: string) => s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

function SettingsPage() {
  const q = useSettings();
  const save = useSaveSettings();
  const { session } = useAuth();
  const del = useServerFn(deleteMyAccount);
  const [f, setF] = useState<Record<string, string>>({});
  const [overdue, setOverdue] = useState(true);
  useEffect(() => {
    const s = q.data;
    if (!s) return;
    setF({
      goal: s.calorie_goal?.toString() ?? "", protein: s.protein_goal_g?.toString() ?? "", carbs: s.carbs_goal_g?.toString() ?? "", fat: s.fat_goal_g?.toString() ?? "", dietary: s.dietary, allergies: s.allergies.join(", "), dislikes: s.dislikes.join(", "),
      minutes: String(s.max_cook_minutes), servings: String(s.servings), equipment: s.equipment.join(", "), days: s.reminder_days.join(", "),
    });
    setOverdue(s.overdue_alerts);
  }, [q.data]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const opt = (k: string) => { const n = Number(f[k]); return f[k] && n > 0 ? n : null; };
    const days = list(f["days"] ?? "").map(Number).filter((n) => Number.isInteger(n) && n >= 0);
    save.mutate({
      calorie_goal: opt("goal"), protein_goal_g: opt("protein"), carbs_goal_g: opt("carbs"), fat_goal_g: opt("fat"), dietary: f["dietary"] || "none", allergies: list(f["allergies"] ?? ""),
      dislikes: list(f["dislikes"] ?? ""), max_cook_minutes: Number(f["minutes"]) || 45, servings: Number(f["servings"]) || 2,
      equipment: list(f["equipment"] ?? ""), reminder_days: days.length ? days : [7, 3, 1], overdue_alerts: overdue,
    }, { onSuccess: () => toast.success("Saved"), onError: (e) => toast.error(e.message) });
  }

  async function exportData() {
    const tables = ["pantry_items", "item_events", "diary_entries", "shopping_items", "user_settings"] as const;
    const out: Record<string, unknown> = {};
    for (const t of tables) {
      const { data, error } = await supabase.from(t).select("*");
      if (error) return void toast.error(error.message);
      out[t] = data;
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `use-it-up-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    if (prompt("This permanently deletes your account and all your data. Type DELETE to confirm.") !== "DELETE") return;
    try {
      await del();
      await supabase.auth.signOut();
      toast.success("Account deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete account");
    }
  }

  const field = (k: string, label: string, hint?: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`s-${k}`}>{label}</Label>
      <Input id={`s-${k}`} type={type} className="h-12" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <AppShell title="Settings">
      {q.error && <ErrorNote error={q.error} />}
      {q.isLoading && <p className="text-muted-foreground">Loading your settings…</p>}
      {q.data && <form onSubmit={submit} className="space-y-4 rounded-3xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Daily goals</h2>
        <p className="-mt-2 text-sm text-muted-foreground">All optional. Leave a box blank for no goal — nothing is filled in for you.</p>
        {field("goal", "Calories (kcal)", undefined, "number")}
        <div className="grid grid-cols-3 gap-3">{field("protein", "Protein (g)", undefined, "number")}{field("carbs", "Carbs (g)", undefined, "number")}{field("fat", "Fat (g)", undefined, "number")}</div>
        <h2 className="pt-2 text-lg font-semibold">Food preferences</h2>
        {field("dietary", "Diet", "e.g. none, vegetarian, vegan, pescatarian, halal")}
        {field("allergies", "Allergies", "Comma separated, e.g. peanuts, milk, gluten")}
        {field("dislikes", "Dislikes", "Comma separated")}
        <div className="grid grid-cols-2 gap-3">{field("minutes", "Max cook time (min)", undefined, "number")}{field("servings", "Servings", undefined, "number")}</div>
        {field("equipment", "Equipment", "e.g. hob, oven, microwave, air fryer")}
        <h2 className="pt-2 text-lg font-semibold">Reminders</h2>
        {field("days", "Remind me this many days before a date", "Default: 7, 3, 1")}
        <label className="flex min-h-11 items-center justify-between gap-3"><span>Alert when food is past its date</span><Switch checked={overdue} onCheckedChange={setOverdue} /></label>
        <div className="rounded-2xl bg-muted p-3 text-sm">
          <p className="font-semibold">In-app alerts: on</p>
          <p className="mt-1">Email reminders: <b>not configured</b>. Sending email needs a verified sending domain, which hasn't been set up yet. Alerts show on your Home screen in the meantime.</p>
        </div>
        <Button type="submit" className="h-12 w-full" disabled={save.isPending}>Save settings</Button>
      </form>}

      <section className="space-y-3 rounded-3xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Account</h2>
        <p className="text-sm text-muted-foreground">Signed in as {session?.user.email}</p>
        <Button variant="secondary" className="h-12 w-full" onClick={exportData}>Download my data</Button>
        <Button variant="secondary" className="h-12 w-full" onClick={() => supabase.auth.signOut()}>Sign out</Button>
        <Button variant="outline" className="h-12 w-full border-danger text-danger" onClick={deleteAccount}>Delete account and data</Button>
      </section>
    </AppShell>
  );
}

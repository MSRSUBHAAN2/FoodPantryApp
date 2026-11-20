import { goalRows, type Goals, type Totals } from "@/lib/nutrition";
import type { UserSettings } from "@/lib/food-types";

export function goalsFrom(s: UserSettings | undefined): Goals {
  return { energy_kcal: s?.calorie_goal ?? null, protein_g: s?.protein_goal_g ?? null, carbs_g: s?.carbs_goal_g ?? null, fat_g: s?.fat_goal_g ?? null };
}

const fmt = (n: number, unit: string) => `${Math.round(n * 10) / 10}${unit === "kcal" ? " kcal" : " g"}`;

/** Calories and the three macros together: eaten, goal, remaining. */
export function DayGoals({ totals, goals, hasEntries }: { totals: Totals; goals: Goals; hasEntries: boolean }) {
  const rows = goalRows(totals, goals, hasEntries);
  const anyPartial = rows.some((r) => r.partial);
  return (
    <div>
      <dl className="divide-y">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 py-2.5 first:pt-0">
            <dt className={r.key === "energy_kcal" ? "font-semibold" : "text-sm"}>{r.label}</dt>
            <dd className="text-right tabular-nums">
              <span className={r.key === "energy_kcal" ? "text-xl font-bold" : "font-semibold"}>
                {r.eaten == null ? "n/a" : fmt(r.eaten, r.unit)}{r.partial && r.eaten != null ? "*" : ""}
              </span>
              <span className="ml-2 text-sm text-muted-foreground">
                {r.goal == null ? "no goal" : r.remaining! >= 0 ? `${fmt(r.remaining!, r.unit)} left of ${fmt(r.goal, r.unit)}` : `${fmt(-r.remaining!, r.unit)} over ${fmt(r.goal, r.unit)}`}
              </span>
            </dd>
            {r.pct != null && (
              <div className="col-span-2 mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${r.label} progress`} aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100}>
                <div className={`h-full rounded-full ${r.remaining! < 0 ? "bg-soon" : "bg-primary"}`} style={{ width: `${r.pct}%` }} />
              </div>
            )}
          </div>
        ))}
      </dl>
      {anyPartial && <p className="mt-2 text-xs text-muted-foreground">* Partial total, or n/a: some entries have no value for this nutrient.</p>}
    </div>
  );
}

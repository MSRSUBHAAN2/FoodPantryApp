import { NUTRIENTS, type NutrientKey } from "@/lib/nutrition";

export function NutrientLine({ values, missing, partial }: { values: Partial<Record<NutrientKey, number>>; missing?: NutrientKey[]; partial?: Partial<Record<NutrientKey, boolean>> }) {
  return (
    <dl className="grid grid-cols-4 gap-2 text-center text-xs">
      {NUTRIENTS.slice(0, 4).map((n) => {
        const v = values[n.key];
        const isPartial = partial?.[n.key] && v !== undefined;
        return (
          <div key={n.key} className="rounded-xl bg-muted p-2">
            <dt className="text-muted-foreground">{n.label}</dt>
            <dd className="font-semibold">{v === undefined ? "n/a" : `${v}${n.unit === "kcal" ? "" : "g"}`}{isPartial ? "*" : ""}</dd>
          </div>
        );
      })}
      {(missing?.length || Object.values(partial ?? {}).some(Boolean)) ? (
        <p className="col-span-4 text-left text-muted-foreground">{missing?.length ? "n/a = not on record. " : ""}{partial ? "* partial total — some entries lack this value." : ""}</p>
      ) : null}
    </dl>
  );
}

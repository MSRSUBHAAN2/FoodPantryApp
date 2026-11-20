// Date rules follow UK FSA consumer guidance:
// https://www.food.gov.uk/food-safety-and-hygiene/best-before-and-use-by-dates
// https://www.food.gov.uk/food-safety-and-hygiene/chilling
export const FSA_DATES_URL = "https://www.food.gov.uk/food-safety-and-hygiene/best-before-and-use-by-dates";
export const FSA_CHILLING_URL = "https://www.food.gov.uk/food-safety-and-hygiene/chilling";

export interface DateInputs {
  printed_date: string | null;
  date_type: string;
  opened_date: string | null;
  open_life_days: number | null;
  open_life_source: string | null;
  frozen_date: string | null;
  thawed_date: string | null;
  location: string;
}

export interface Deadline {
  date: string;
  kind: "safety" | "quality";
  label: string;
  source: string;
}

export type DateStatus = "fresh" | "soon" | "past_quality" | "past_safety" | "frozen" | "unknown";

export interface DateSummary {
  printed: { date: string; type: string; meaning: string } | null;
  safety: Deadline | null; // the earliest applicable safety deadline
  quality: Deadline | null;
  deadlines: Deadline[];
  notes: string[];
  status: DateStatus;
  daysLeft: number | null; // days to the deadline that drives status
  statusText: string;
}

const DAY = 86_400_000;
export function toDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}
export function addDays(iso: string, days: number): string {
  return new Date(toDay(iso) + days * DAY).toISOString().slice(0, 10);
}
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toDay(toIso) - toDay(fromIso)) / DAY);
}
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const SOON_DAYS = 3;

export function summariseDates(item: DateInputs, today: string): DateSummary {
  const notes: string[] = [];
  const deadlines: Deadline[] = [];
  let printed: DateSummary["printed"] = null;

  if (item.printed_date && item.date_type !== "none") {
    const meaning =
      item.date_type === "use_by"
        ? "Safety date: do not eat after this date, even if it looks and smells fine."
        : item.date_type === "best_before"
          ? "Quality date: food may be past its best after this, but is not a safety expiry."
          : "Retail date for the shop — not a safety or quality date.";
    printed = { date: item.printed_date, type: item.date_type, meaning };
  }

  const frozenNow = !!item.frozen_date && !item.thawed_date;
  const usedBy = item.date_type === "use_by" ? item.printed_date : null;

  // Freezing must happen on or before the use-by date.
  if (item.frozen_date && usedBy && toDay(item.frozen_date) > toDay(usedBy)) {
    return {
      printed,
      safety: { date: usedBy, kind: "safety", label: "Use by (printed)", source: "Package label" },
      quality: null,
      deadlines: [{ date: usedBy, kind: "safety", label: "Use by (printed)", source: "Package label" }],
      notes: ["Frozen after its use-by date. FSA guidance: food must be frozen before the use-by date. Do not eat it."],
      status: "past_safety",
      daysLeft: daysBetween(today, usedBy),
      statusText: "Frozen after use-by — do not eat",
    };
  }

  if (item.thawed_date) {
    if (!item.frozen_date) notes.push("Thawed date recorded without a frozen date — storage history is incomplete.");
    deadlines.push({
      date: addDays(item.thawed_date, 1),
      kind: "safety",
      label: "Use within 24 hours of defrosting",
      source: "FSA chilling guidance",
    });
  } else if (usedBy && !frozenNow) {
    deadlines.push({ date: usedBy, kind: "safety", label: "Use by (printed)", source: "Package label" });
  }

  if (item.opened_date) {
    if (item.open_life_days != null) {
      deadlines.push({
        date: addDays(item.opened_date, item.open_life_days),
        kind: "safety",
        label: `Once opened, use within ${item.open_life_days} day${item.open_life_days === 1 ? "" : "s"}`,
        source: item.open_life_source || "Package instructions",
      });
    } else if (!frozenNow) {
      notes.push("After-opening date unknown. Check the label for “once opened, use within…” and record it.");
    }
  }

  if (item.date_type === "best_before" && item.printed_date && !frozenNow) {
    deadlines.push({ date: item.printed_date, kind: "quality", label: "Best before (printed)", source: "Package label" });
  }
  if (item.date_type === "sell_by") notes.push("Sell-by dates are for shops only. Look for a use-by or best-before date.");

  const safety =
    deadlines.filter((d) => d.kind === "safety").sort((a, b) => toDay(a.date) - toDay(b.date))[0] ?? null;
  const quality = deadlines.find((d) => d.kind === "quality") ?? null;

  if (frozenNow) {
    notes.push(
      `Frozen on ${item.frozen_date}. The original printed date stays on record. No freezer time limit is recorded — follow the label's freezing instructions.`,
    );
    return { printed, safety: null, quality: null, deadlines, notes, status: "frozen", daysLeft: null, statusText: "Frozen" };
  }

  let status: DateStatus = "unknown";
  let daysLeft: number | null = null;
  let statusText = "Date unknown";
  if (safety) {
    daysLeft = daysBetween(today, safety.date);
    if (daysLeft < 0) {
      status = "past_safety";
      statusText = `Past safety date (${-daysLeft}d ago)`;
    } else if (daysLeft <= SOON_DAYS) {
      status = "soon";
      statusText = daysLeft === 0 ? "Use today" : `Use within ${daysLeft}d`;
    } else {
      status = "fresh";
      statusText = `Fresh · ${daysLeft}d left`;
    }
  }
  if (quality && status !== "past_safety") {
    const q = daysBetween(today, quality.date);
    if (!safety || q < (daysLeft ?? Infinity)) {
      if (q < 0) {
        status = "past_quality";
        statusText = "Past best before — check quality";
        daysLeft = q;
      } else if (q <= SOON_DAYS && status !== "soon") {
        status = "soon";
        statusText = `Best before in ${q}d`;
        daysLeft = q;
      } else if (!safety) {
        status = "fresh";
        statusText = `Best before in ${q}d`;
        daysLeft = q;
      }
    }
  }
  if (status === "unknown") notes.push("No applicable date recorded. When in doubt, throw it out.");
  return { printed, safety, quality, deadlines, notes, status, daysLeft, statusText };
}

/** Reminder alerts due today for an item given the user's chosen lead days. */
export function reminderDue(summary: DateSummary, reminderDays: number[], overdue: boolean): string | null {
  if (summary.daysLeft == null) return null;
  if (summary.status === "past_safety") return overdue ? "Past its safety date" : null;
  if (summary.status === "past_quality") return overdue ? "Past best before" : null;
  const max = Math.max(0, ...reminderDays);
  if (summary.daysLeft <= max) {
    return summary.daysLeft === 0 ? "Due today" : `Due in ${summary.daysLeft} day${summary.daysLeft === 1 ? "" : "s"}`;
  }
  return null;
}

/** Higher = use first. Past-safety items are excluded from recipes elsewhere. */
export function usePriority(summary: DateSummary, opened: boolean): number {
  let p = 0;
  if (summary.daysLeft != null) p += Math.max(0, 30 - summary.daysLeft);
  if (opened) p += 10;
  return p;
}

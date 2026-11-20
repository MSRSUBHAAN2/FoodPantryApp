/** Only explicit net-quantity fields/text belong here, never names or nutrition. */
export interface PackEvidence {
  text?: string | null;
  amount?: number | string | null;
  unit?: string | null;
}

export interface PackAmount {
  amount: number;
  unit: "g" | "ml" | "pieces";
  count: number;
}

const units: Record<string, { unit: PackAmount["unit"]; factor: number }> = {
  g: { unit: "g", factor: 1 }, gram: { unit: "g", factor: 1 }, grams: { unit: "g", factor: 1 },
  kg: { unit: "g", factor: 1000 }, kilogram: { unit: "g", factor: 1000 }, kilograms: { unit: "g", factor: 1000 },
  mg: { unit: "g", factor: 0.001 },
  ml: { unit: "ml", factor: 1 }, millilitre: { unit: "ml", factor: 1 }, millilitres: { unit: "ml", factor: 1 },
  cl: { unit: "ml", factor: 10 }, l: { unit: "ml", factor: 1000 }, litre: { unit: "ml", factor: 1000 }, litres: { unit: "ml", factor: 1000 },
  oz: { unit: "g", factor: 28.349523125 }, lb: { unit: "g", factor: 453.59237 }, lbs: { unit: "g", factor: 453.59237 },
  piece: { unit: "pieces", factor: 1 }, pieces: { unit: "pieces", factor: 1 }, count: { unit: "pieces", factor: 1 },
  pcs: { unit: "pieces", factor: 1 }, pc: { unit: "pieces", factor: 1 },
};
const number = "(\\d+(?:[.,]\\d+)?)";
const unitPattern = Object.keys(units).sort((a, b) => b.length - a.length).join("|");
const single = new RegExp(`^${number}\\s*(${unitPattern})$`, "i");
const multi = new RegExp(`^(\\d+)\\s*[x×]\\s*${number}\\s*(${unitPattern})$`, "i");

function measured(amount: number, rawUnit: string, count = 1): PackAmount | null {
  const u = units[rawUnit.trim().toLowerCase()];
  if (!u || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(count) || count < 1) return null;
  return { amount: Number((amount * u.factor * count).toPrecision(12)), unit: u.unit, count };
}

export function parsePackText(raw: string): PackAmount | null {
  const text = raw.trim().toLowerCase().replace(/^(?:net(?:\s+(?:weight|volume|contents))?|contents)\s*[:：]?\s*/, "");
  const equivalent = text.match(/^([^()=]+)\s*(?:=\s*([^()=]+)|\(([^()=]+)\))$/);
  if (equivalent?.[1] && (equivalent[2] || equivalent[3])) {
    const left = parsePackText(equivalent[1]);
    const right = parsePackText(equivalent[2] || equivalent[3] || "");
    return left && right && left.unit === right.unit && Math.abs(left.amount - right.amount) <= 0.01 ? left : null;
  }
  const m = text.match(multi);
  if (m?.[1] && m[2] && m[3]) return measured(Number(m[2].replace(",", ".")), m[3], Number(m[1]));
  const s = text.match(single);
  if (s?.[1] && s[2]) return measured(Number(s[1].replace(",", ".")), s[2]);
  return null;
}

export function resolvePack(e: PackEvidence): PackAmount | null {
  const field = e.amount != null && e.unit ? measured(Number(e.amount), e.unit) : null;
  if (!e.text?.trim()) return field;
  const text = parsePackText(e.text);
  // Ambiguous printed text must not be rescued by a possibly normalised field.
  if (!text) return null;
  if (field && (field.unit !== text.unit || Math.abs(field.amount - text.amount) > 0.01)) return null;
  return text;
}

export function scannedStock(e: PackEvidence, purchaseCount?: number | null) {
  const pack = resolvePack(e);
  if (purchaseCount != null && (!Number.isInteger(purchaseCount) || purchaseCount <= 0)) {
    return { quantity: "", unit: "packs", needsConfirmation: true, pack: null };
  }
  const count = purchaseCount != null && Number.isInteger(purchaseCount) && purchaseCount > 0 ? purchaseCount : 1;
  return pack
    ? { quantity: String(Number((pack.amount * count).toPrecision(12))), unit: pack.unit, needsConfirmation: false, pack }
    : { quantity: String(count), unit: "packs", needsConfirmation: true, pack: null };
}

export function validateStock(quantity: string, unit: string, needsConfirmation = false) {
  if (needsConfirmation) throw new Error("Confirm the stock amount and unit, or confirm the number of packs.");
  if (!quantity.trim() || !Number.isFinite(Number(quantity)) || Number(quantity) < 0) throw new Error("Enter a valid stock amount.");
  if (!unit.trim()) throw new Error("Enter the stock unit.");
  return { quantity: Number(quantity), unit: unit.trim() };
}
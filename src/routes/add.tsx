import { useCallback, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Barcode, Camera, ImageUp, PenLine, Receipt } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell, ErrorNote } from "@/components/app/shell";
import { ItemEditor } from "@/components/app/item-editor";
import { BarcodeCamera } from "@/components/app/barcode-camera";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useAddItems } from "@/lib/data";
import { emptyDraft, draftToRow, photoToDataUrl, mergeScannedDraft, editStock, type ItemDraft } from "@/lib/item-form";
import { lookupBarcode, readFoodImage } from "@/lib/food.functions";
import { LOCATIONS, LOCATION_LABEL } from "@/lib/food-types";
import { pageHead } from "@/lib/page-head";
import { barcodeDraft, labelDraft, receiptDraft, type ReceiptRow } from "@/lib/scan-drafts";
import { validateStock } from "@/lib/pack-size";

export const Route = createFileRoute("/add")({
  head: () => pageHead("Add food — Use It Up", "Add food by hand, barcode, label photo or receipt."),
  component: AddPage,
});

type Mode = "manual" | "barcode" | "label" | "receipt";

function AddPage() {
  const [mode, setMode] = useState<Mode>("manual");
  const [draft, setDraft] = useState<ItemDraft | null>(emptyDraft());
  const [scanNote, setScanNote] = useState<string | null>(null);
  const add = useAddItems();
  const navigate = useNavigate();

  function pick(m: Mode) {
    setMode(m);
    setScanNote(null);
    setDraft((previous) => previous?.stock_user_entered ? previous : m === "manual" ? emptyDraft() : null);
  }

  async function save() {
    if (!draft) return;
    try {
      const row = draftToRow(draft);
      await add.mutateAsync([row]);
      toast.success(`${row.name} added`);
      navigate({ to: "/inventory", search: { view: row.location as never } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  const MODES = [
    { m: "manual" as const, label: "Manual", icon: PenLine, hint: "Type the details from the pack." },
    { m: "barcode" as const, label: "Barcode", icon: Barcode, hint: "Scan or type the barcode to fill in product details." },
    { m: "label" as const, label: "Label photo", icon: Camera, hint: "Photograph the label, date or nutrition panel." },
    { m: "receipt" as const, label: "Receipt", icon: Receipt, hint: "Photograph a receipt to add several items at once." },
  ];

  return (
    <AppShell title="Add food">
      <div className="grid grid-cols-4 gap-1 rounded-2xl border bg-muted p-1" role="tablist" aria-label="How to add food">
        {MODES.map(({ m, label, icon: Icon }) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => pick(m)}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-xs font-semibold text-muted-foreground aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:shadow-sm">
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <p className="-mt-3 text-sm text-muted-foreground">{MODES.find((x) => x.m === mode)?.hint}</p>
      {mode === "barcode" && <BarcodeStep onDraft={(d, note) => { setDraft((previous) => mergeScannedDraft(previous, d)); setScanNote(note); }} />}
      {mode === "label" && <LabelStep onDraft={(d, note) => { setDraft((previous) => mergeScannedDraft(previous, d)); setScanNote(note); }} />}
      {mode === "receipt" && <ReceiptStep />}

      {draft && mode !== "receipt" && (
        <section className="space-y-4">
          {scanNote && <p className="rounded-2xl bg-soon-soft p-3 text-sm">{scanNote}</p>}
          <ItemEditor draft={draft} onChange={setDraft} />
          <div className="sticky bottom-[72px] z-10 -mx-4 grid grid-cols-[1fr_2fr] gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur">
            <Button variant="outline" className="h-12 text-base" onClick={() => navigate({ to: "/inventory", search: { view: "all" } })} disabled={add.isPending}>Cancel</Button>
            <Button className="h-12 w-full text-base" onClick={save} disabled={add.isPending}>
              {add.isPending ? "Saving…" : mode === "manual" ? "Add to stock" : "Confirm and add"}
            </Button>
          </div>
        </section>
      )}
    </AppShell>
  );
}

function BarcodeStep({ onDraft }: { onDraft: (d: ItemDraft, note: string) => void }) {
  const lookup = useServerFn(lookupBarcode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);

  const run = useCallback(async (raw: string) => {
    setCamera(false);
    setCode(raw);
    setBusy(true);
    setError(null);
    try {
      const r = await lookup({ data: { barcode: raw } });
      const d = barcodeDraft(raw);
      if (!r.found) {
        setError(r.error);
        onDraft(d, "Not found — fill in the details from the package.");
        return;
      }
      const p = r.product;
      const foundDraft = barcodeDraft(raw, p);
      onDraft(foundDraft, `Found in Open Food Facts${p.package_quantity ? ` (${p.package_quantity})` : ""}. Check everything — and enter the date printed on YOUR package; barcodes don't carry expiry dates.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  }, [lookup, onDraft]);

  return (
    <section className="space-y-3 rounded-3xl border bg-card p-4">
      {camera ? <BarcodeCamera onCode={run} onCancel={() => setCamera(false)} /> : (
        <Button variant="secondary" className="h-12 w-full" onClick={() => setCamera(true)}>
          <Camera className="size-5" /> Scan with camera
        </Button>
      )}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(code); }}>
        <Input aria-label="Barcode number" inputMode="numeric" placeholder="Type barcode digits" className="h-12" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button type="submit" className="h-12" disabled={busy}>{busy ? "Looking up…" : "Look up"}</Button>
      </form>
      {error && <ErrorNote error={new Error(error)} />}
      <p className="text-xs text-muted-foreground">Product data from Open Food Facts (openfoodfacts.org).</p>
    </section>
  );
}

function LabelStep({ onDraft }: { onDraft: (d: ItemDraft, note: string) => void }) {
  const read = useServerFn(readFoodImage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      const image = await photoToDataUrl(f);
      const r = await read({ data: { image, mode: "label" } });
      if (r.mode !== "label") return;
      const l = r.label;
      const d = labelDraft(l);
      onDraft(d, `Read from your photo — check every field against the package before saving.${l.unreadable ? ` Couldn't read: ${l.unreadable}` : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read the photo");
      onDraft(barcodeDraft(""), "Photo reading failed — enter the details by hand.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-3xl border bg-card p-4">
      <PhotoPicker busy={busy} busyText="Reading label…" icon={<Camera className="size-6" />} prompt="Add a photo of the label, date or nutrition panel" onFile={onFile} />
      {error && <ErrorNote error={new Error(error)} />}
    </section>
  );
}


function ReceiptStep() {
  const read = useServerFn(readFoodImage);
  const add = useAddItems();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      const r = await read({ data: { image: await photoToDataUrl(f, 2000), mode: "receipt" } });
      if (r.mode !== "receipt") return;
      if (!r.receipt.items.length) setError("No food items could be read from this receipt.");
      setRows(r.receipt.items.map(receiptDraft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read the receipt");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const chosen = rows.filter((r) => r.keep && r.name.trim());
    if (!chosen.length) return void toast.error("Tick the items you actually want to add.");
    try {
      await add.mutateAsync(chosen.map((r) => ({ name: r.name.trim(), ...validateStock(r.quantity, r.unit, r.stock_needs_confirmation), location: r.location })));
      toast.success(`${chosen.length} item(s) added. Add their printed dates from the packages.`);
      navigate({ to: "/inventory", search: { view: "all" } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  const upd = (i: number, p: Partial<ReceiptRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));

  return (
    <section className="space-y-3 rounded-3xl border bg-card p-4">
      <PhotoPicker busy={busy} busyText="Reading receipt…" icon={<Receipt className="size-6" />} prompt="Add a photo of your receipt" onFile={onFile} />
      {error && <ErrorNote error={new Error(error)} />}
      {rows.length > 0 && (
        <>
          <p className="rounded-2xl bg-soon-soft p-3 text-sm">Tick and correct the items to add. Receipts don't show dates — add the printed date from each package afterwards.</p>
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={i} className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-2xl bg-muted/60 p-3">
                <Checkbox aria-label={`Add ${r.name}`} checked={r.keep} onCheckedChange={(v) => upd(i, { keep: v === true })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input aria-label="Name" className="col-span-2 h-11" value={r.name} onChange={(e) => upd(i, { name: e.target.value })} />
                  <Input aria-label="Quantity" type="number" className="h-11" value={r.quantity} onChange={(e) => upd(i, editStock(r, "quantity", e.target.value))} />
                  <Input aria-label="Stock unit" className="h-11" value={r.unit} onChange={(e) => upd(i, editStock(r, "unit", e.target.value))} />
                  {r.pack_description && <p className="col-span-2 text-xs text-muted-foreground">Pack size: {r.pack_description}</p>}
                  {r.stock_needs_confirmation && <label className="col-span-2 flex items-center gap-2 text-sm"><Checkbox aria-label={`Confirm stock for ${r.name}`} checked={false} onCheckedChange={(v) => { if (v === true) upd(i, { stock_needs_confirmation: false }); }} />Confirm stock: {r.quantity} {r.unit} — size not verified</label>}
                  <select aria-label="Location" className="h-11 rounded-md border bg-background px-2" value={r.location} onChange={(e) => upd(i, { location: e.target.value })}>
                    {LOCATIONS.map((l) => <option key={l} value={l}>{LOCATION_LABEL[l]}</option>)}
                  </select>
                </div>
              </li>
            ))}
          </ul>
          <Button className="h-12 w-full" onClick={save} disabled={add.isPending}>Add ticked items</Button>
        </>
      )}
    </section>
  );
}


/** Two ways in: take a new photo (opens the camera on phones) or upload an existing image file. */
function PhotoPicker({ busy, busyText, icon, prompt, onFile }: { busy: boolean; busyText: string; icon: ReactNode; prompt: string; onFile: (f: File | undefined) => void }) {
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => { onFile(e.target.files?.[0]); e.target.value = ""; };
  const btn = "flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border bg-secondary px-3 text-sm font-semibold focus-within:ring-[3px] focus-within:ring-ring";
  return (
    <div className="space-y-3 rounded-2xl border-2 border-dashed p-4 text-center">
      <div className="flex flex-col items-center gap-2 text-sm font-semibold">{icon}{busy ? busyText : prompt}</div>
      <div className="grid grid-cols-2 gap-2">
        <label className={btn}><Camera className="size-4" /> Take photo
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy} onChange={pick} />
        </label>
        <label className={btn}><ImageUp className="size-4" /> Upload image
          <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={pick} />
        </label>
      </div>
    </div>
  );
}

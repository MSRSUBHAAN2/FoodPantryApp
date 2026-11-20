import { useEffect, useRef, useState } from "react";
import { RefreshCw, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cameraErrorMessage, validRetailCode, type RetailFormat } from "@/lib/retail-barcode";

/**
 * Live barcode scanner. Mounted only after the user taps "Scan with camera".
 * Frames are decoded locally with ZXing (no BarcodeDetector, nothing uploaded).
 * Tracks stop on success, cancel, unmount/navigation, and if permission arrives late.
 */
export function BarcodeCamera({ onCode, onCancel }: { onCode: (code: string) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<{ text: string; embedded: boolean } | null>(null);
  const [status, setStatus] = useState("Starting camera…");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    const embedded = window.self !== window.top;
    let stream: MediaStream | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stopAll = () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      if (video.current) video.current.srcObject = null;
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError({ text: cameraErrorMessage("Unsupported", embedded), embedded });
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } },
        });
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; } // late permission
        stream = s;
        const v = video.current!;
        v.srcObject = s;
        await v.play().catch(() => {});
        navigator.mediaDevices.enumerateDevices().then((all) => !cancelled && setDevices(all.filter((d) => d.kind === "videoinput"))).catch(() => {});
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        if (cancelled) return;
        const fmts: Record<number, RetailFormat> = {
          [BarcodeFormat.EAN_13]: "EAN_13", [BarcodeFormat.EAN_8]: "EAN_8", [BarcodeFormat.UPC_A]: "UPC_A", [BarcodeFormat.UPC_E]: "UPC_E",
        };
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, Object.keys(fmts).map(Number));
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints);
        const canvas = document.createElement("canvas");
        setStatus("Point the camera at the barcode");
        const tick = () => {
          if (cancelled) return;
          if (v.videoWidth) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight;
            canvas.getContext("2d", { willReadFrequently: true })?.drawImage(v, 0, 0);
            try {
              const r = reader.decodeFromCanvas(canvas);
              const fmt = fmts[r.getBarcodeFormat()];
              const code = fmt ? validRetailCode(r.getText(), fmt) : null;
              if (code) { stopAll(); onCodeRef.current(code); return; }
            } catch { /* no barcode in this frame */ }
          }
          timer = setTimeout(tick, 120);
        };
        tick();
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof Error || e instanceof DOMException ? e.name : "";
        setError({ text: cameraErrorMessage(name, embedded), embedded });
      }
    })();
    return stopAll;
  }, [deviceId]);

  if (error) {
    return (
      <div className="space-y-3 rounded-2xl bg-muted p-3 text-sm" role="alert">
        <p>{error.text}</p>
        <div className="flex flex-wrap gap-2">
          {error.embedded && (
            <Button asChild variant="secondary" className="h-11">
              <a href={window.location.href} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Open in its own tab</a>
            </Button>
          )}
          <Button variant="outline" className="h-11" onClick={onCancel}>Type it instead</Button>
        </div>
      </div>
    );
  }

  const switchCamera = () => {
    const i = devices.findIndex((d) => d.deviceId === deviceId);
    const next = devices[(i + 1) % devices.length];
    if (next) setDeviceId(next.deviceId);
  };

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl bg-muted">
        <video ref={video} className="aspect-video w-full object-cover" muted playsInline aria-label="Barcode camera" />
        <div aria-hidden className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-danger/80" />
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">{status} — scanned on your device, nothing is uploaded.</p>
      <div className="flex gap-2">
        {devices.length > 1 && <Button variant="secondary" className="h-11 flex-1" onClick={switchCamera}><RefreshCw className="size-4" /> Switch camera</Button>}
        <Button variant="outline" className="h-11 flex-1" onClick={onCancel}><X className="size-4" /> Stop camera</Button>
      </div>
    </div>
  );
}

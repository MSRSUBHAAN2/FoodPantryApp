/** Retail barcode checks. Codes stay strings so leading zeros are never lost. */
export type RetailFormat = "EAN_13" | "EAN_8" | "UPC_A" | "UPC_E";

function checkDigitOk(digits: string): boolean {
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

/** Expand an 8-digit UPC-E code to its 12-digit UPC-A form. */
export function upcEToA(e: string): string | null {
  if (!/^[01]\d{7}$/.test(e)) return null;
  const ns = e[0]!, d = e.slice(1, 7), check = e[7]!;
  const last = d[5]!;
  let m: string;
  if ("012".includes(last)) m = d.slice(0, 2) + last + "0000" + d.slice(2, 5);
  else if (last === "3") m = d.slice(0, 3) + "00000" + d.slice(3, 5);
  else if (last === "4") m = d.slice(0, 4) + "00000" + d[4];
  else m = d.slice(0, 5) + "0000" + last;
  return ns + m + check;
}

/** Returns the code if it is a valid EAN-13/EAN-8/UPC-A/UPC-E, else null. */
export function validRetailCode(raw: string, format?: RetailFormat): string | null {
  const code = raw.trim();
  if (!/^\d+$/.test(code)) return null;
  if (format === "UPC_E" || (!format && code.length === 8 && upcEToA(code) && checkDigitOk(upcEToA(code)!) && !checkDigitOk(code))) {
    const a = upcEToA(code);
    return a && checkDigitOk(a) ? code : null;
  }
  if (![8, 12, 13].includes(code.length)) return null;
  if (format === "EAN_13" && code.length !== 13) return null;
  if (format === "EAN_8" && code.length !== 8) return null;
  if (format === "UPC_A" && code.length !== 12) return null;
  return checkDigitOk(code) ? code : null;
}

/** Plain-language explanation for a camera error. */
export function cameraErrorMessage(name: string, embedded: boolean): string {
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return embedded
        ? "The camera is blocked inside this embedded preview. Open the app in its own tab to scan, or type the barcode."
        : "Camera access was denied. Allow the camera in your browser's site settings, or type the barcode.";
    case "NotReadableError":
    case "AbortError":
      return "The camera is busy in another app or tab. Close it there and try again, or type the barcode.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device. Type the barcode digits instead.";
    case "Unsupported":
      return embedded
        ? "Camera access isn't available in this embedded preview. Open the app in its own tab, or type the barcode."
        : "This browser can't open the camera here (it needs a secure https page). Type the barcode instead.";
    default:
      return "Couldn't open the camera. Try again, or type the barcode.";
  }
}

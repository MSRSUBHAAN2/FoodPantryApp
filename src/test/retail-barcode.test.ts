import { describe, expect, it } from "vitest";
import { validRetailCode, upcEToA, cameraErrorMessage } from "@/lib/retail-barcode";

describe("retail barcodes", () => {
  it("accepts a valid EAN-13", () => expect(validRetailCode("5449000000996", "EAN_13")).toBe("5449000000996"));
  it("rejects a bad check digit", () => expect(validRetailCode("5449000000997", "EAN_13")).toBeNull());
  it("keeps leading zeros on UPC-A and EAN-13", () => {
    expect(validRetailCode("036000291452", "UPC_A")).toBe("036000291452");
    expect(validRetailCode("0036000291452", "EAN_13")).toBe("0036000291452");
  });
  it("accepts EAN-8", () => expect(validRetailCode("96385074", "EAN_8")).toBe("96385074"));
  it("validates UPC-E through its UPC-A expansion and keeps the leading zero", () => {
    expect(upcEToA("04252614")).toBe("042100005264");
    expect(validRetailCode("04252614", "UPC_E")).toBe("04252614");
  });
  it("rejects non-digits and wrong lengths", () => {
    expect(validRetailCode("12345")).toBeNull();
    expect(validRetailCode("abc")).toBeNull();
  });
  it("explains embedded blocks differently from denial", () => {
    expect(cameraErrorMessage("NotAllowedError", true)).toMatch(/own tab/);
    expect(cameraErrorMessage("NotAllowedError", false)).toMatch(/denied/);
    expect(cameraErrorMessage("NotReadableError", false)).toMatch(/busy/);
  });
});

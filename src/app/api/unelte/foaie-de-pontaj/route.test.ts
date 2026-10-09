import JSZip from "jszip";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "./route";

const cere = (interogare: string) =>
  GET(new NextRequest(`http://localhost/api/unelte/foaie-de-pontaj?${interogare}`));

async function parte(r: Response, cale: string): Promise<string> {
  const zip = await JSZip.loadAsync(await r.arrayBuffer());
  return (await zip.file(cale)?.async("string")) ?? "";
}

const SAPTEZECI = encodeURIComponent(
  Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n"),
);

describe("ruta foii de pontaj", () => {
  it("Excel-ul cu nume iese cu cache-control private, no-store", async () => {
    const r = await cere("luna=10&an=2026&angajati=Ion+Popa");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("spreadsheetml");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("PDF-ul trece prin răspunsul comun, cu același antet", async () => {
    const r = await cere("luna=10&an=2026&angajati=Ion+Popa&format=pdf");
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("Excelul spune că lista a fost tăiată la 60", async () => {
    const r = await cere(`an=2026&luna=12&angajati=${SAPTEZECI}`);
    expect(await parte(r, "xl/sharedStrings.xml")).toContain(
      "Documentul cuprinde primii 60 din 70 de angajați trimiși; ceilalți 10 nu apar aici.",
    );
  });

  it("Word-ul la fel", async () => {
    const r = await cere(`an=2026&luna=12&format=docx&angajati=${SAPTEZECI}`);
    expect(await parte(r, "word/document.xml")).toContain("ceilalți 10 nu apar aici");
  });

  it("fără tăiere, fără notă", async () => {
    const r = await cere("an=2026&luna=12&angajati=Popa%20Ion");
    expect(await parte(r, "xl/sharedStrings.xml")).not.toContain("nu apar aici");
  });

  it("Excelul foii (fără raspunsDocument) primește numele curățate de B3", async () => {
    // exceljs lasă U+FFFE, care rupe sharedStrings.xml, și lipește cuvintele la
    // U+000B. Excelul foii nu trece prin `raspunsDocument`; îl apără `citesteAngajati`.
    const siruri = await parte(
      await cere("an=2026&luna=12&angajati=Popa%EF%BF%BEIon%0AIlie%0BMaria"),
      "xl/sharedStrings.xml",
    );
    expect(siruri).toContain("PopaIon");
    expect(siruri).toContain("Ilie");
    expect(siruri).toContain("Maria");
    expect(siruri).not.toContain("\u{FFFE}");
  });

  it("Excelul scrie norma în ceas, fără virgulă mobilă", async () => {
    const siruri = await parte(await cere("an=2026&luna=6&ore=7.3"), "xl/sharedStrings.xml");
    expect(siruri).toContain("21 de zile lucrătoare × 7:18 h = 153:18 h normă");
    expect(siruri).not.toContain("153.2999");
  });
});

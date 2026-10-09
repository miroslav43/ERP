import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { UNELTE } from "@/lib/unelte/registru";

import { GET } from "./route";

const cere = (cale: string, slug: string) =>
  GET(new NextRequest(`http://localhost${cale}`), { params: Promise.resolve({ unealta: slug }) });

describe("ruta comună de descărcare", () => {
  it("o unealtă necunoscută primește 404", async () => {
    expect((await cere("/api/unelte/constructor", "constructor")).status).toBe(404);
  });

  it("cererea de concediu nu mai trece pe aici: are ruta ei, cu scrisoarea", async () => {
    // Ruta statică `/api/unelte/cerere-concediu` are prioritate în Next; registrul
    // nu mai are intrarea, deci un apel direct aici nu produce formularul vechi.
    expect((await cere("/api/unelte/cerere-concediu", "cerere-concediu")).status).toBe(404);
  });

  it("fișierul generat iese cu cache-control private, no-store", async () => {
    // Condica are rută statică din E12; ruta comună se verifică pe o unealtă din `UNELTE`.
    const r = await cere("/api/unelte/fisa-evaluare?format=pdf", "fisa-evaluare");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("formatul cu majuscule dă formatul cerut, nu PDF", async () => {
    const r = await cere("/api/unelte/fisa-evaluare?format=DOCX", "fisa-evaluare");
    expect(r.headers.get("content-type")).toContain("wordprocessingml");
  });
});

describe("fișa de instruire SSM se descarcă doar în Word și PDF", () => {
  it("Excel primește 400 cu formatele disponibile, nu un fișier fără jumătate din anexă", async () => {
    const r = await cere(
      "/api/unelte/fisa-instruire-ssm?format=xlsx&nume=Popa",
      "fisa-instruire-ssm",
    );
    expect(r.status).toBe(400);
    expect(await r.text()).toBe("Unealta asta se descarcă doar în PDF sau Word.");
  });

  it("PDF și Word răspund cu fișierul", async () => {
    const pdf = await cere("/api/unelte/fisa-instruire-ssm?format=pdf", "fisa-instruire-ssm");
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    const docx = await cere("/api/unelte/fisa-instruire-ssm?format=docx", "fisa-instruire-ssm");
    expect(docx.status).toBe(200);
    expect(docx.headers.get("content-type")).toContain("wordprocessingml");
  });

  it("celelalte unelte din registru își păstrează Excelul", async () => {
    // E12, F12, G6 și I7 mută condica, cererea, foaia de parcurs și fișa de
    // evaluare pe rute statice, iar K8–K10 adaugă unelte noi. Fișa SSM poate
    // rămâne singura din `UNELTE`; atunci nu e nimic de verificat aici, iar
    // `formatePentru` e păzit de `registru.test.ts`.
    const alta = Object.keys(UNELTE).find((s) => s !== "fisa-instruire-ssm");
    const r = alta === undefined ? null : await cere(`/api/unelte/${alta}?format=xlsx`, alta);
    expect(r === null || r.status === 200, alta).toBe(true);
  });
});

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

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

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "./route";

const cere = (cale: string, slug: string) =>
  GET(new NextRequest(`http://localhost${cale}`), { params: Promise.resolve({ unealta: slug }) });

describe("ruta comună de descărcare", () => {
  it("o cerere cu interval inversat primește 400 cu motivul, nu un fișier", async () => {
    const r = await cere(
      "/api/unelte/cerere-concediu?tip=odihna&de_la=2026-12-20&pana_la=2026-12-10&format=pdf",
      "cerere-concediu",
    );
    expect(r.status).toBe(400);
    expect(await r.text()).toMatch(/\S/u);
  });

  it("o unealtă necunoscută primește 404", async () => {
    expect((await cere("/api/unelte/constructor", "constructor")).status).toBe(404);
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

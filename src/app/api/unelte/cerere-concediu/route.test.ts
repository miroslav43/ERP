import JSZip from "jszip";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET as GETAlias } from "../cerere-concediu-de-odihna/route";
import { GET } from "./route";

const cere = (cale: string, antete: Record<string, string> = {}) =>
  GET(new NextRequest(`http://localhost${cale}`, { headers: antete }));

const BROWSER = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "sec-fetch-mode": "navigate",
};

describe("descărcarea cererii de concediu", () => {
  it("un client de API primește 400 cu motivul, pentru un interval inversat", async () => {
    const r = await cere(
      "/api/unelte/cerere-concediu?de_la=2026-12-20&pana_la=2026-12-10&format=pdf",
    );
    expect(r.status).toBe(400);
    expect(await r.text()).toMatch(/înaintea/u);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("o dată prezentă dar invalidă e 400, nu un document pe altă perioadă", async () => {
    const r = await cere(
      "/api/unelte/cerere-concediu?de_la=2036-01-05&pana_la=2036-01-09&format=docx",
    );
    expect(r.status).toBe(400);
    expect(await r.text()).toMatch(/2036/u);
  });

  it("din browser, eroarea întoarce omul pe pagină, cu formularul completat", async () => {
    const r = await cere(
      "/api/unelte/cerere-concediu?de_la=2026-12-20&pana_la=2026-12-10&salariat=Popa&format=pdf",
      BROWSER,
    );
    expect(r.status).toBe(303);
    const inapoi = r.headers.get("location") ?? "";
    expect(inapoi.startsWith("/unelte/cerere-concediu-de-odihna?")).toBe(true);
    expect(inapoi).toContain("salariat=Popa");
    expect(inapoi).not.toContain("format=");
    expect(inapoi.endsWith("#documentul")).toBe(true);
    // Redirecționarea poartă numele omului în adresă: niciun cache n-o păstrează.
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("ajunge oricare dintre cele două antete de navigare", async () => {
    const cale = "/api/unelte/cerere-concediu?de_la=2026-11-14&pana_la=2026-11-15&format=pdf";
    expect((await cere(cale, { "sec-fetch-mode": "navigate" })).status).toBe(303);
    expect((await cere(cale, { accept: "text/html" })).status).toBe(303);
    expect((await cere(cale, { accept: "*/*" })).status).toBe(400);
  });

  it("un format necunoscut e refuzat; Excel nu mai e servit; majusculele trec", async () => {
    const baza = "/api/unelte/cerere-concediu?de_la=2026-11-16&pana_la=2026-11-20";
    expect((await cere(`${baza}&format=xlsx`)).status).toBe(400);
    expect((await cere(`${baza}&format=exe`)).status).toBe(400);
    const word = await cere(`${baza}&format=DOCX`);
    expect(word.status).toBe(200);
    expect(word.headers.get("content-type")).toContain("wordprocessingml");
  });

  it("Word: scrisoarea, cu numele fișierului, fără cache public, subsolul spre pagină", async () => {
    const r = await cere(
      "/api/unelte/cerere-concediu?de_la=2026-11-16&pana_la=2026-11-20&format=docx",
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="cerere-odihna-2026-11-16.docx"',
    );
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    expect((await zip.file("word/document.xml")?.async("string")) ?? "").toContain("CERERE");
    expect((await zip.file("word/_rels/footer1.xml.rels")?.async("string")) ?? "").toMatch(
      /\/unelte\/cerere-concediu-de-odihna\?utm_source=fisier/u,
    );
  });

  it("adresa cu slug-ul paginii dă același fișier", async () => {
    const r = await GETAlias(
      new NextRequest(
        "http://localhost/api/unelte/cerere-concediu-de-odihna?de_la=2026-11-16&pana_la=2026-11-20&format=pdf",
      ),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
  });
});

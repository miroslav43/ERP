// src/lib/documents/generator.test.ts
//
// Motorul comun al documentelor: șablonul firmei bate seed-ul de platformă,
// variabilele lipsă OPRESC emiterea (cu lista lor), valorile se evadează mereu,
// numerotarea pe serie reîncearcă doar la coliziune (23505), iar pagina de
// tipărit pune blocul firmei unde a ales firma.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AntetOrganizatie } from "@/lib/documents/bloc-firma";
import { areFiltru, clientFals, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { genereazaDocument, paginaTiparibila, type ParametriDocument } from "./generator";

const ORG = "11111111-1111-4111-8111-111111111111";
const ANGAJAT = "66666666-6666-4666-8666-666666666666";

const sablon = (continut = "<p>Salariatul {{angajat_nume}}, funcția {{ functie }}.</p>") => ({
  id: "sablon-1",
  denumire: "Adeverință",
  continut_html: continut,
  serie: "ADV",
});

const parametri = (peste: Partial<ParametriDocument> = {}): ParametriDocument => ({
  organizationId: ORG,
  employeeId: ANGAJAT,
  codSablon: "adeverinta_salariat",
  emisDe: "33333333-3333-4333-8333-333333333333",
  valori: new Map([
    ["angajat_nume", "Ion Pop"],
    ["functie", "Contabil"],
  ]),
  ...peste,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-15T07:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("genereazaDocument", () => {
  it("caută șablonul activ, viu, al firmei sau de platformă — al firmei întâi", async () => {
    const db = clientFals();
    db.raspunde("hr_document_templates", "select", { data: null });

    await expect(genereazaDocument(db.client, parametri())).rejects.toMatchObject({
      code: "NEGASIT",
      message: "Șablonul „adeverinta_salariat” nu este configurat pentru organizația ta.",
    });
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "cod", "adeverinta_salariat")).toBe(true);
    expect(areFiltru(apel, "eq", "activ", true)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.filtre).toEqual(
      expect.arrayContaining([
        { metoda: "or", argumente: [`organization_id.eq.${ORG},organization_id.is.null`] },
        { metoda: "order", argumente: ["organization_id", { ascending: true, nullsFirst: false }] },
        { metoda: "limit", argumente: [1] },
      ]),
    );
  });

  it("emite: număr = maximul seriei + 1, afișat cu anul și șase cifre, cu amprentă SHA-256", async () => {
    const db = clientFals();
    db.raspunde("hr_document_templates", "select", { data: sablon() });
    db.raspunde("hr_issued_documents", "select", { data: { numar: 41 } });
    db.raspunde("hr_issued_documents", "insert", { data: { id: "doc-1" } });

    const r = await genereazaDocument(db.client, parametri({ scop: "bancă" }));

    expect(r.id).toBe("doc-1");
    expect(r.numarAfisat).toBe("ADV 2026/000042");
    expect(r.html).toBe("<p>Salariatul Ion Pop, funcția Contabil.</p>");
    expect(r.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.codVerificare).toMatch(/^[A-Za-z0-9_-]{22}$/);

    const [numar] = db.apeluriPe("hr_issued_documents", "select");
    expect(areFiltru(numar, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(numar, "eq", "serie", "ADV")).toBe(true);
    expect(numar?.filtre).toContainEqual({
      metoda: "order",
      argumente: ["numar", { ascending: false }],
    });

    const [insert] = db.apeluriPe("hr_issued_documents", "insert");
    expect(insert?.payload).toMatchObject({
      organization_id: ORG,
      template_id: "sablon-1",
      employee_id: ANGAJAT,
      serie: "ADV",
      numar: 42,
      numar_afisat: "ADV 2026/000042",
      titlu: "Adeverință",
      emis_la: "2026-09-15",
      continut_checksum: r.hash,
      cod_verificare: r.codVerificare,
      date_document: { angajat_nume: "Ion Pop", functie: "Contabil" },
      scop: "bancă",
    });
    expect(insert?.payload).not.toHaveProperty("contract_id");
  });

  it("prima emitere pe serie începe de la 1", async () => {
    const db = clientFals();
    db.raspunde("hr_document_templates", "select", { data: sablon() });
    db.raspunde("hr_issued_documents", "select", { data: null });
    db.raspunde("hr_issued_documents", "insert", { data: { id: "doc-1" } });
    const r = await genereazaDocument(db.client, parametri({ contractId: "c1" }));
    expect(r.numarAfisat).toBe("ADV 2026/000001");
    expect(db.apeluriPe("hr_issued_documents", "insert")[0]?.payload).toMatchObject({
      contract_id: "c1",
    });
  });

  it("valorile se evadează: o valoare cu HTML nu ajunge cod în document", async () => {
    const db = clientFals();
    db.raspunde("hr_document_templates", "select", { data: sablon() });
    db.raspunde("hr_issued_documents", "select", { data: null });
    db.raspunde("hr_issued_documents", "insert", { data: { id: "doc-1" } });

    const r = await genereazaDocument(
      db.client,
      parametri({
        valori: new Map([
          ["angajat_nume", '<script>alert("x")</script>'],
          ["functie", "R&D"],
        ]),
      }),
    );

    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
    expect(r.html).toContain("R&amp;D");
  });

  it("variabilele lipsă sau goale OPRESC emiterea, cu lista lor, înainte de numerotare", async () => {
    const db = clientFals();
    db.raspunde("hr_document_templates", "select", {
      data: sablon("{{angajat_nume}} {{functie}} {{cnp_complet}}"),
    });

    await expect(
      genereazaDocument(
        db.client,
        parametri({
          valori: new Map([
            ["angajat_nume", "Ion"],
            ["functie", ""],
          ]),
        }),
      ),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message:
        "Documentul nu poate fi emis: lipsesc date din fișă (functie, cnp_complet). Completează-le și încearcă din nou.",
    });
    expect(db.apeluriPe("hr_issued_documents")).toHaveLength(0);
  });

  it("acoladele care nu sunt variabile valide rămân text", async () => {
    const db = clientFals();
    db.raspunde("hr_document_templates", "select", {
      data: sablon("{{Nume}} {{ 1x }} {angajat_nume}"),
    });
    db.raspunde("hr_issued_documents", "select", { data: null });
    db.raspunde("hr_issued_documents", "insert", { data: { id: "d" } });
    const r = await genereazaDocument(db.client, parametri());
    expect(r.html).toBe("{{Nume}} {{ 1x }} {angajat_nume}");
  });

  it("coliziune pe număr (23505): realocă și reîncearcă", async () => {
    const db = clientFals();
    db.raspunde("hr_document_templates", "select", { data: sablon() });
    db.raspunde("hr_issued_documents", "select", { data: { numar: 5 } });
    db.raspunde("hr_issued_documents", "insert", { error: eroarePostgrest("23505") });
    db.raspunde("hr_issued_documents", "select", { data: { numar: 6 } });
    db.raspunde("hr_issued_documents", "insert", { data: { id: "doc-7" } });

    const r = await genereazaDocument(db.client, parametri());

    expect(r).toMatchObject({ id: "doc-7", numarAfisat: "ADV 2026/000007" });
    expect(
      db
        .apeluriPe("hr_issued_documents", "insert")
        .map((a) => (a.payload as { numar: number }).numar),
    ).toEqual([6, 7]);
  });

  it("altă eroare decât coliziunea: nu reîncearcă, CONFLICT generic", async () => {
    const db = clientFals();
    db.raspunde("hr_document_templates", "select", { data: sablon() });
    db.raspunde("hr_issued_documents", "select", { data: null });
    db.raspunde("hr_issued_documents", "insert", { error: eroarePostgrest("42501") });
    await expect(genereazaDocument(db.client, parametri())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Documentul nu a putut fi înregistrat. Încearcă din nou.",
    });
    expect(db.apeluriPe("hr_issued_documents", "insert")).toHaveLength(1);
  });

  it("cinci coliziuni la rând: „numerotarea este ocupată”, fără a șasea încercare", async () => {
    const db = clientFals();
    db.raspunde("hr_document_templates", "select", { data: sablon() });
    for (let i = 0; i < 6; i += 1) {
      db.raspunde("hr_issued_documents", "select", { data: { numar: i } });
      db.raspunde("hr_issued_documents", "insert", { error: eroarePostgrest("23505") });
    }
    await expect(genereazaDocument(db.client, parametri())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Numerotarea documentelor este ocupată. Încearcă din nou peste câteva secunde.",
    });
    expect(db.apeluriPe("hr_issued_documents", "insert")).toHaveLength(5);
  });
});

describe("paginaTiparibila", () => {
  const antet = (peste: Partial<AntetOrganizatie> = {}): AntetOrganizatie => ({
    denumire: "Firma <Test>",
    formaJuridica: "SRL",
    cui: "RO123",
    regCom: "J40/1/2020",
    adresa: "Str. Lungă 1, Cluj",
    capitalSocial: 200,
    capitalVarsat: null,
    sistemDualist: false,
    telefon: null,
    email: null,
    pozitie: "antet",
    sigla: null,
    ...peste,
  });
  const document = {
    id: "d",
    numarAfisat: 'ADV 2026/000001 <"x">',
    html: "<p>Conținut</p>",
    hash: "a".repeat(64),
    codVerificare: "cod-123",
  };

  it("blocul firmei sus când firma a ales antet; numărul și codul evadate; amprenta scurtă", () => {
    const html = paginaTiparibila(document, antet());
    expect(html.startsWith('<!doctype html><html lang="ro">')).toBe(true);
    expect(html.indexOf('class="firma"')).toBeLessThan(html.indexOf("<p>Conținut</p>"));
    expect(html).toContain("Firma &lt;Test&gt;");
    expect(html).toContain("<title>ADV 2026/000001 &lt;&quot;x&quot;&gt;</title>");
    expect(html).toContain(`amprentă SHA-256: ${"a".repeat(16)}…`);
    expect(html).not.toContain("a".repeat(17));
    expect(html).toContain("Cod de verificare: cod-123");
    // Fără resurse externe.
    expect(html).not.toMatch(/(src|href)="https?:/);
  });

  it("blocul firmei jos când firma a ales subsol", () => {
    const html = paginaTiparibila(document, antet({ pozitie: "subsol" }));
    expect(html.indexOf('class="firma"')).toBeGreaterThan(html.indexOf("<p>Conținut</p>"));
    expect(html.indexOf('class="firma"')).toBeLessThan(html.indexOf("<footer>"));
  });

  it("sigla se încorporează ca `data:` URI, nu ca URL semnat care expiră", () => {
    const html = paginaTiparibila(
      document,
      antet({ sigla: { octeti: new Uint8Array([1, 2, 3]), tip: "image/png" } }),
    );
    expect(html).toContain('src="data:image/png;base64,AQID"');
  });
});

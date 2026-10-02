// src/app/(app)/angajati/import/actions.test.ts
//
// Importul în masă din Excel: pregătirea încărcării, analiza (cu criptarea
// CNP/IBAN la parsare) și aplicarea pe loturi. Straturile comune ale lui
// `createAction` sunt verificate în testul canonic (`salarizare/actions.test.ts`).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("@/lib/teste/actiune")).falsuri.nextHeaders());
vi.mock("next/server", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextServer(await orig()),
);
vi.mock("next/cache", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextCache(await orig()),
);
vi.mock("@/lib/tenant/resolve-tenant", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.resolveTenant(await orig()),
);
vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);
vi.mock("@/lib/supabase/admin", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseAdmin(),
);
vi.mock("@/lib/auth/features", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.features(await orig()),
);
vi.mock("@/lib/auth/permissions", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.permissions(await orig()),
);

import * as ExcelJS from "exceljs";

import { configureazaActiunea, ID_1, ID_2, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { catreBytea, encrypt, versiuneCaNumar } from "@/lib/crypto/aes-gcm";
import {
  aplicaImportAngajati,
  analizeazaImportAngajati,
  pregatesteIncarcareaImportului,
} from "./actions";

const PERMIS = { "employees:create": "all" } as const;
const SUB_PRAG = { "employees:create": "team" } as const;
const BUCKET = "org-documents";
const BATCH = ID_1;
const PREFIX = `${ORG_ID}/employees/${BATCH}/`;
const CALE_LOT = `${PREFIX}lot-validat.json`;
const CNP = "1960101010109";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

type Fals = ReturnType<typeof configureazaActiunea>["server"];

async function excel(randuri: readonly (readonly string[])[]): Promise<Blob> {
  const registru = new ExcelJS.Workbook();
  const foaie = registru.addWorksheet("Angajați");
  for (const rand of randuri) foaie.addRow([...rand]);
  const octeti = await registru.xlsx.writeBuffer();
  return new Blob([octeti as ArrayBuffer]);
}

function lot(randuri: readonly Record<string, unknown>[]): Blob {
  return new Blob([JSON.stringify(randuri)], { type: "application/json" });
}

// ── pregatesteIncarcareaImportului ───────────────────────────────────────────

describe("pregatesteIncarcareaImportului", () => {
  it("employees:create sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: SUB_PRAG });
    const r = await pregatesteIncarcareaImportului({ numeFisier: "a.xlsx", dimensiune: 100 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("succes: un lot nou, cu calea sub prefixul lui, sub organizația din sesiune", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeStocare(BUCKET, "createSignedUploadUrl", { data: { signedUrl: "https://u" } });

    const r = await pregatesteIncarcareaImportului({
      numeFisier: "Personal.xlsx",
      dimensiune: 100,
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.batchId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(r.data.cale.startsWith(`${ORG_ID}/employees/${r.data.batchId}/`)).toBe(true);
    expect(r.data.urlSemnat).toBe("https://u");
  });

  it.each([
    ["un CSV", { numeFisier: "a.csv", dimensiune: 100 }],
    ["peste 5 MB", { numeFisier: "a.xlsx", dimensiune: 6 * 1024 * 1024 }],
  ])("%s: VALIDARE, nicio semnare", async (_n, intrare) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await pregatesteIncarcareaImportului(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("semnarea eșuează: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeStocare(BUCKET, "createSignedUploadUrl", { error: { message: "x" } });
    const r = await pregatesteIncarcareaImportului({ numeFisier: "a.xlsx", dimensiune: 100 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

// ── analizeazaImportAngajati ─────────────────────────────────────────────────

describe("analizeazaImportAngajati", () => {
  const cale = `${PREFIX}abc-personal.xlsx`;

  async function programeaza(
    ctx: ReturnType<typeof configureazaActiunea>,
    randuri: readonly (readonly string[])[],
  ) {
    ctx.server.raspundeStocare(BUCKET, "download", { data: await excel(randuri) });
    ctx.admin.raspundeStocare(BUCKET, "remove", { data: [] });
  }

  it("employees:create sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: SUB_PRAG });
    const r = await analizeazaImportAngajati({ batchId: BATCH, cale });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("calea e din alt lot sau altă firmă: VALIDARE pe `cale`, fără descărcare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await analizeazaImportAngajati({
      batchId: BATCH,
      cale: `${ORG_ID}/employees/${ID_2}/x.xlsx`,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("cale");
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("succes: șterge sursa cu CNP-uri în clar, salvează lotul CRIPTAT și întoarce sumarul", async () => {
    const ctx = configureazaActiunea({ permisiuni: PERMIS });
    await programeaza(ctx, [
      ["Nume", "Prenume", "Data angajării", "CNP", "Culoare preferată"],
      ["Popescu", "Ion", "2026-01-15", CNP, "verde"],
      ["Ionescu", "", "2026-01-15", "", ""],
    ]);
    ctx.server.raspundeStocare(BUCKET, "upload", { data: { path: CALE_LOT } });

    const r = await analizeazaImportAngajati({ batchId: BATCH, cale });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({
      batchId: BATCH,
      totalRanduri: 2,
      numarValide: 1,
      coloaneIgnorate: ["Culoare preferată"],
    });
    expect(r.data.invalide.length).toBeGreaterThan(0);

    // Sursa pleacă prin clientul de serviciu, exact calea verificată.
    expect(ctx.admin.apeluriStocare).toEqual([
      { bucket: BUCKET, metoda: "remove", argumente: [[cale]] },
    ]);

    const upload = ctx.server.apeluriStocare.find((a) => a.metoda === "upload");
    expect(upload?.argumente[0]).toBe(CALE_LOT);
    expect(upload?.argumente[2]).toMatchObject({ upsert: true, contentType: "application/json" });
    const continut = await (upload?.argumente[1] as Blob).text();
    expect(continut).not.toContain(CNP);
    const [salvat] = JSON.parse(continut) as Record<string, unknown>[];
    expect(salvat).not.toHaveProperty("cnp");
    expect(salvat?.["cnpProtejat"]).toMatchObject({ last4: "0109" });
  });

  it("ștergerea sursei eșuează: importul continuă (problemă de curățenie, nu de date)", async () => {
    const ctx = configureazaActiunea({ permisiuni: PERMIS });
    ctx.server.raspundeStocare(BUCKET, "download", {
      data: await excel([
        ["Nume", "Prenume", "Data angajării"],
        ["Popescu", "Ion", "2026-01-15"],
      ]),
    });
    ctx.admin.raspundeStocare(BUCKET, "remove", { error: { message: "fără drept" } });
    ctx.server.raspundeStocare(BUCKET, "upload", { data: { path: CALE_LOT } });

    const r = await analizeazaImportAngajati({ batchId: BATCH, cale });

    expect(r).toMatchObject({ ok: true, data: { numarValide: 1 } });
  });

  it("lipsește coloana obligatorie: VALIDARE care o numește, iar lotul nu se salvează", async () => {
    const ctx = configureazaActiunea({ permisiuni: PERMIS });
    await programeaza(ctx, [
      ["Nume", "Prenume"],
      ["Popescu", "Ion"],
    ]);

    const r = await analizeazaImportAngajati({ batchId: BATCH, cale });

    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(r.error.message).toContain("Data angajării");
    expect(ctx.server.apeluriStocare.filter((a) => a.metoda === "upload")).toHaveLength(0);
  });

  it("fișierul încărcat a dispărut: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeStocare(BUCKET, "download", { error: { message: "lipsă" } });
    const r = await analizeazaImportAngajati({ batchId: BATCH, cale });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("salvarea lotului eșuează: CONFLICT", async () => {
    const ctx = configureazaActiunea({ permisiuni: PERMIS });
    await programeaza(ctx, [
      ["Nume", "Prenume", "Data angajării"],
      ["Popescu", "Ion", "2026-01-15"],
    ]);
    ctx.server.raspundeStocare(BUCKET, "upload", { error: { message: "x" } });
    const r = await analizeazaImportAngajati({ batchId: BATCH, cale });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

// ── aplicaImportAngajati ─────────────────────────────────────────────────────

describe("aplicaImportAngajati", () => {
  const simplu = { rand: 2, last_name: "Popescu", first_name: "Ion", hired_on: "2026-01-15" };

  function programeazaLot(server: Fals, randuri: readonly Record<string, unknown>[]) {
    server.raspundeStocare(BUCKET, "download", { data: lot(randuri) });
  }

  it("employees:create sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: SUB_PRAG });
    const r = await aplicaImportAngajati({ batchId: BATCH, offset: 0 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("succes: citește lotul de pe calea organizației și creează fișa ca `candidat`, cu marca din contor", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaLot(server, [simplu]);
    server.raspundeRpc("urmatoarea_marca", { data: "0007" });
    server.raspunde("employees", "insert", { data: { id: ID_2 } });

    const r = await aplicaImportAngajati({ batchId: BATCH, offset: 0 });

    expect(r).toEqual({
      ok: true,
      data: { procesate: 1, reusite: 1, esuate: [], urmator: 1, total: 1, gata: true },
    });
    expect(server.apeluriStocare[0]?.argumente[0]).toBe(CALE_LOT);
    expect(server.apeluriRpc.find((a) => a.nume === "urmatoarea_marca")?.argumente).toEqual({
      p_organization_id: ORG_ID,
    });
    expect(server.apeluriPe("employees", "insert")[0]?.payload).toEqual({
      organization_id: ORG_ID,
      marca: "0007",
      last_name: "Popescu",
      first_name: "Ion",
      hired_on: "2026-01-15",
      status: "candidat",
    });
  });

  it("marca din fișier se păstrează: contorul nu se atinge", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaLot(server, [{ ...simplu, marca: "M-12" }]);
    server.raspunde("employees", "insert", { data: { id: ID_2 } });
    await aplicaImportAngajati({ batchId: BATCH, offset: 0 });
    expect(server.apeluriRpc.filter((a) => a.nume === "urmatoarea_marca")).toHaveLength(0);
    expect(server.apeluriPe("employees", "insert")[0]?.payload).toMatchObject({ marca: "M-12" });
  });

  it("aplică doar felia lotului de la offset, cel mult 25 de rânduri", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const randuri = Array.from({ length: 30 }, (_, i) => ({
      ...simplu,
      rand: i + 2,
      marca: `M${i}`,
    }));
    programeazaLot(server, randuri);
    for (let i = 0; i < 5; i += 1) server.raspunde("employees", "insert", { data: { id: `${i}` } });

    const r = await aplicaImportAngajati({ batchId: BATCH, offset: 25 });

    expect(r).toMatchObject({
      ok: true,
      data: { procesate: 5, reusite: 5, urmator: 30, total: 30, gata: true },
    });
    expect(server.apeluriPe("employees", "insert")[0]?.payload).toMatchObject({ marca: "M25" });
  });

  it("primul lot dintr-un fișier mai mare: exact 25 de rânduri, iar clientul e trimis la offsetul următor", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const randuri = Array.from({ length: 30 }, (_, i) => ({
      ...simplu,
      rand: i + 2,
      marca: `M${i}`,
    }));
    programeazaLot(server, randuri);
    for (let i = 0; i < 30; i += 1)
      server.raspunde("employees", "insert", { data: { id: `${i}` } });

    const r = await aplicaImportAngajati({ batchId: BATCH, offset: 0 });

    expect(r).toMatchObject({
      ok: true,
      data: { procesate: 25, reusite: 25, urmator: 25, total: 30, gata: false },
    });
    const inserari = server.apeluriPe("employees", "insert");
    expect(inserari).toHaveLength(25);
    expect(inserari[24]?.payload).toMatchObject({ marca: "M24" });
  });

  it("contorul de mărci eșuează: eroare pe rând care cere marca în fișier, nicio fișă creată", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaLot(server, [simplu]);
    server.raspundeRpc("urmatoarea_marca", { error: eroarePostgrest("42501") });

    const r = await aplicaImportAngajati({ batchId: BATCH, offset: 0 });

    expect(r).toMatchObject({ ok: true, data: { procesate: 1, reusite: 0 } });
    if (!r.ok) return;
    expect(r.data.esuate).toHaveLength(1);
    expect(r.data.esuate[0]?.marca).toBe("(atribuită automat)");
    expect(r.data.esuate[0]?.mesaj).toContain("Marcă");
    expect(server.apeluriPe("employees")).toHaveLength(0);
  });

  it("datele sensibile respinse: fișa abia creată se anulează LOGIC, cu `.select()` după", async () => {
    const c = encrypt(CNP);
    const cnpProtejat = {
      ciphertext: catreBytea(c.ciphertext),
      iv: catreBytea(c.iv),
      tag: catreBytea(c.tag),
      keyVersion: versiuneCaNumar(c.keyVersion),
      last4: "0109",
      hash: "amprenta",
    };
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaLot(server, [{ ...simplu, marca: "M1", cnpProtejat }]);
    server.raspunde("employees", "insert", { data: { id: ID_2 } });
    // Ambele drumuri de scriere refuză: testul rămâne valabil și după ce
    // scrierea trece pe `hr_write_sensitive` (defectul de mai sus).
    server.raspunde("employee_sensitive_data", "insert", { error: eroarePostgrest("42501") });
    server.raspundeRpc("hr_write_sensitive", { error: eroarePostgrest("42501") });
    server.raspunde("employees", "update", { data: { id: ID_2 } });

    const r = await aplicaImportAngajati({ batchId: BATCH, offset: 0 });

    expect(r).toMatchObject({ ok: true, data: { procesate: 1, reusite: 0 } });
    if (!r.ok) return;
    expect(r.data.esuate).toHaveLength(1);
    expect(r.data.esuate[0]?.marca).toBe("M1");
    const [anulare] = server.apeluriPe("employees", "update");
    expect(Object.keys(anulare?.payload as object)).toEqual(["deleted_at"]);
    expect(areFiltru(anulare, "eq", "id", ID_2)).toBe(true);
    expect(anulare?.selectDupaScriere).toBeDefined();
    expect(server.apeluriPe("employment_contracts")).toHaveLength(0);
  });

  it("departamentul se caută cu metacaracterele scăpate și pe organizație; inexistent ⇒ eroare pe rând, nicio fișă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaLot(server, [{ ...simplu, marca: "M1", departament: "Resurse, 100%" }]);
    server.raspunde("departments", "select", { data: null });

    const r = await aplicaImportAngajati({ batchId: BATCH, offset: 0 });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.reusite).toBe(0);
    expect(r.data.esuate[0]?.mesaj).toContain("Resurse, 100%");
    const [cautare] = server.apeluriPe("departments");
    expect(areFiltru(cautare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(cautare, "is", "deleted_at", null)).toBe(true);
    const or = cautare?.filtre.find((f) => f.metoda === "or")?.argumente[0] as string;
    // Virgula stă între ghilimele (nu rupe `or=`), iar `%` e scăpat, nu joker.
    expect(or).toBe('cod.ilike."%Resurse, 100\\\\%%",denumire.ilike."%Resurse, 100\\\\%%"');
    expect(server.apeluriPe("employees")).toHaveLength(0);
  });

  it("contractul din fișier se creează ca `proiect`, niciodată activ", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaLot(server, [{ ...simplu, marca: "M1", numar_contract: "5", salariu: 4500 }]);
    server.raspunde("employees", "insert", { data: { id: ID_2 } });
    server.raspunde("employment_contracts", "insert", { data: null });

    const r = await aplicaImportAngajati({ batchId: BATCH, offset: 0 });

    expect(r).toMatchObject({ ok: true, data: { reusite: 1 } });
    expect(server.apeluriPe("employment_contracts")[0]?.payload).toMatchObject({
      organization_id: ORG_ID,
      employee_id: ID_2,
      numar: "5",
      salariu_baza: 4500,
      status: "proiect",
      data_contract: "2026-01-15",
    });
  });

  it("contract cu număr deja folosit: fișa se anulează LOGIC (compensare), cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaLot(server, [{ ...simplu, marca: "M1", numar_contract: "5", salariu: 4500 }]);
    server.raspunde("employees", "insert", { data: { id: ID_2 } });
    server.raspunde("employment_contracts", "insert", { error: eroarePostgrest("23505") });
    server.raspunde("employees", "update", { data: { id: ID_2 } });

    const r = await aplicaImportAngajati({ batchId: BATCH, offset: 0 });

    expect(r).toMatchObject({ ok: true, data: { reusite: 0 } });
    if (!r.ok) return;
    expect(r.data.esuate).toEqual([
      { rand: 2, marca: "M1", mesaj: 'Numărul de contract „5" este deja folosit.' },
    ]);
    const [anulare] = server.apeluriPe("employees", "update");
    expect(Object.keys(anulare?.payload as object)).toEqual(["deleted_at"]);
    expect(areFiltru(anulare, "eq", "id", ID_2)).toBe(true);
    expect(anulare?.selectDupaScriere).toBeDefined();
  });

  it("compensarea respinsă tăcut: mesajul rândului spune că fișa a rămas cu marca ocupată", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaLot(server, [{ ...simplu, marca: "M1", numar_contract: "5", salariu: 4500 }]);
    server.raspunde("employees", "insert", { data: { id: ID_2 } });
    server.raspunde("employment_contracts", "insert", { error: eroarePostgrest("23514") });
    server.raspunde("employees", "update", { data: null });

    const r = await aplicaImportAngajati({ batchId: BATCH, offset: 0 });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.esuate[0]?.mesaj).toContain("NU a putut fi anulată");
    expect(r.data.esuate[0]?.mesaj).toContain("M1");
  });

  it("marcă din fișier deja folosită: eroare pe rând, cu marca, restul lotului continuă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaLot(server, [
      { ...simplu, marca: "M1" },
      { ...simplu, rand: 3, marca: "M2" },
    ]);
    server.raspunde("employees", "insert", { error: eroarePostgrest("23505") });
    server.raspunde("employees", "insert", { data: { id: ID_2 } });

    const r = await aplicaImportAngajati({ batchId: BATCH, offset: 0 });

    expect(r).toMatchObject({ ok: true, data: { procesate: 2, reusite: 1 } });
    if (!r.ok) return;
    expect(r.data.esuate).toEqual([
      { rand: 2, marca: "M1", mesaj: 'Există deja un angajat cu marca „M1".' },
    ]);
  });

  it("la marcă atribuită de contor, conflictul 23505 numește marca alocată, nu „undefined”", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaLot(server, [simplu]);
    server.raspundeRpc("urmatoarea_marca", { data: "0007" });
    server.raspunde("employees", "insert", { error: eroarePostgrest("23505") });

    const r = await aplicaImportAngajati({ batchId: BATCH, offset: 0 });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.esuate[0]?.mesaj).toContain("0007");
  });

  it("CNP/IBAN se scriu prin `hr_write_sensitive`, nu prin INSERT direct în `employee_sensitive_data` (grant revocat în 0005/0010/0016)", async () => {
    const c = encrypt(CNP);
    const cnpProtejat = {
      ciphertext: catreBytea(c.ciphertext),
      iv: catreBytea(c.iv),
      tag: catreBytea(c.tag),
      keyVersion: versiuneCaNumar(c.keyVersion),
      last4: "0109",
      hash: "amprenta",
    };
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaLot(server, [{ ...simplu, marca: "M1", cnpProtejat }]);
    server.raspunde("employees", "insert", { data: { id: ID_2 } });
    server.raspundeRpc("hr_write_sensitive", { data: null });

    const r = await aplicaImportAngajati({ batchId: BATCH, offset: 0 });

    expect(server.apeluriPe("employee_sensitive_data")).toHaveLength(0);
    expect(server.apeluriRpc.find((a) => a.nume === "hr_write_sensitive")?.argumente).toMatchObject(
      {
        p_employee: ID_2,
        p_cnp_ciphertext: cnpProtejat.ciphertext,
        p_cnp_last4: "0109",
      },
    );
    expect(r).toMatchObject({ ok: true, data: { reusite: 1 } });
  });

  it("previzualizarea a expirat (lotul lipsește): CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeStocare(BUCKET, "download", { error: { message: "lipsă" } });
    const r = await aplicaImportAngajati({ batchId: BATCH, offset: 0 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("lotul din Storage nu mai respectă schema (ex. CNP în clar): CONFLICT, nicio fișă", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeazaLot(server, [{ ...simplu, cnpProtejat: { ciphertext: CNP } }]);
    const r = await aplicaImportAngajati({ batchId: BATCH, offset: 0 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

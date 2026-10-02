// src/app/(app)/angajati/[id]/documente/actions.test.ts
//
// Dosarul de personal: documentele încărcate (pregătire, salvare, descărcare,
// retragere) și documentele EMISE de aplicație (anulare, emiterea celor lipsă,
// regenerare). Straturile comune ale lui `createAction` sunt verificate în
// testul canonic (`salarizare/actions.test.ts`).

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

// Contextul și generatorul au propriile interogări și propria criptografie; aici
// contează ce coduri cere acțiunea și ce face cu rezultatul. `coduriEligibile`
// rămâne REAL: e regula care decide ce lipsește.
const doc = vi.hoisted(() => ({ aduna: vi.fn(), genereaza: vi.fn() }));
vi.mock("@/lib/documents/context-angajat", () => ({ adunaContextInrolare: doc.aduna }));
vi.mock("@/lib/documents/inrolare", async (orig) => ({
  ...(await orig<typeof import("@/lib/documents/inrolare")>()),
  genereazaDocumenteInrolare: doc.genereaza,
}));

import {
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  anuleazaDocumentEmis,
  emiteDocumenteLipsa,
  linkDescarcareDocument,
  pregatesteIncarcareDocument,
  regenereazaDocumente,
  salveazaDocument,
  stergeDocument,
} from "./actions";

const BUCKET = "org-documents";
const PREFIX = `${ORG_ID}/employees/${ID_1}/`;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  doc.aduna.mockReset();
  doc.genereaza.mockReset();
});

type Fals = ReturnType<typeof configureazaActiunea>["server"];

// ── Documente încărcate ──────────────────────────────────────────────────────

describe("pregatesteIncarcareDocument", () => {
  const PERMIS = { "employees:update": "team" } as const;
  const intrare = {
    employeeId: ID_1,
    numeFisier: "Contract semnat.pdf",
    dimensiune: 1000,
    mime: "application/pdf",
  };

  it("employees:update sub `team` (own): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:update": "own" } });
    const r = await pregatesteIncarcareDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: verifică fișa în organizație și semnează o cale sub prefixul angajatului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: { id: ID_1 } });
    server.raspundeStocare(BUCKET, "createSignedUploadUrl", { data: { signedUrl: "https://u" } });

    const r = await pregatesteIncarcareDocument(intrare);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.urlSemnat).toBe("https://u");
    expect(r.data.cale.startsWith(PREFIX)).toBe(true);
    const [fisa] = server.apeluriPe("employees");
    expect(areFiltru(fisa, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(fisa, "is", "deleted_at", null)).toBe(true);
  });

  it("tip de fișier nepermis: VALIDARE, înainte de orice interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await pregatesteIncarcareDocument({ ...intrare, mime: "application/x-msdownload" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("fișă inexistentă: NEGASIT, nicio semnare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: null });
    const r = await pregatesteIncarcareDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });
});

describe("salveazaDocument", () => {
  const PERMIS = { "employees:update": "team" } as const;
  const intrare = {
    employeeId: ID_1,
    documentTypeId: ID_2,
    titlu: "Contract",
    cale: `${PREFIX}abc-contract.pdf`,
    numeFisier: "contract.pdf",
    dimensiune: 10,
    mime: "application/pdf",
    confidential: true,
    vizibilAngajatului: false,
  };

  function programeaza(server: Fals, masurat = { size: 4321, contentType: "application/pdf" }) {
    server.raspunde("employees", "select", { data: { id: ID_1 } });
    server.raspundeStocare(BUCKET, "info", { data: masurat });
  }

  it("employees:update sub `team` (own): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:update": "own" } });
    const r = await salveazaDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: scrie mărimea și tipul MĂSURATE în Storage, nu cele declarate de browser", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);
    server.raspunde("employee_documents", "insert", { data: { id: ID_3 } });

    const r = await salveazaDocument(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [insert] = server.apeluriPe("employee_documents", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      employee_id: ID_1,
      document_type_id: ID_2,
      titlu: "Contract",
      fisier_path: intrare.cale,
      fisier_nume: "contract.pdf",
      fisier_marime_bytes: 4321,
      fisier_mime: "application/pdf",
      confidential: true,
      vizibil_angajatului: false,
    });
    // Fișa e verificată în organizație și vie, înaintea măsurării.
    const [fisa] = server.apeluriPe("employees", "select");
    expect(areFiltru(fisa, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(fisa, "is", "deleted_at", null)).toBe(true);
    expect(server.neconsumate()).toEqual([]);
  });

  it("fișă inexistentă sau invizibilă: NEGASIT, nicio măsurare, niciun insert", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: null });
    const r = await salveazaDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriStocare).toHaveLength(0);
    expect(server.apeluriPe("employee_documents")).toHaveLength(0);
  });

  it("câmpurile opționale completate ajung în rând", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);
    server.raspunde("employee_documents", "insert", { data: { id: ID_3 } });
    await salveazaDocument({
      ...intrare,
      numarDocument: "42",
      dataDocument: "2026-09-01",
      valabilPanaLa: "2027-09-01",
    });
    expect(server.apeluriPe("employee_documents")[0]?.payload).toMatchObject({
      numar_document: "42",
      data_document: "2026-09-01",
      valabil_pana: "2027-09-01",
    });
  });

  it("calea e sub alt angajat: VALIDARE pe `cale`, fără măsurare și fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: { id: ID_1 } });
    const r = await salveazaDocument({ ...intrare, cale: `${ORG_ID}/employees/${ID_2}/x.pdf` });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("cale");
    expect(server.apeluriStocare).toHaveLength(0);
    expect(server.apeluriPe("employee_documents")).toHaveLength(0);
  });

  it("calea cu `..` care iese din prefix: VALIDARE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: { id: ID_1 } });
    const r = await salveazaDocument({ ...intrare, cale: `${PREFIX}../${ID_2}/x.pdf` });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
  });

  it("obiectul nu mai există în Storage: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employees", "select", { data: { id: ID_1 } });
    server.raspundeStocare(BUCKET, "info", { error: { message: "nu există" } });
    const r = await salveazaDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("fișierul real are un tip nepermis: VALIDARE, deși browserul a declarat PDF", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, { size: 10, contentType: "application/x-msdownload" });
    const r = await salveazaDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluriPe("employee_documents")).toHaveLength(0);
  });

  it("inserarea eșuează: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server);
    server.raspunde("employee_documents", "insert", { error: eroarePostgrest("42501") });
    const r = await salveazaDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("linkDescarcareDocument", () => {
  const PERMIS = { "employees:read": "team" } as const;
  const rand = {
    id: ID_2,
    employee_id: ID_1,
    fisier_path: `${PREFIX}abc-contract.pdf`,
    fisier_nume: "contract.pdf",
    confidential: false,
  };

  it("employees:read sub `team` (own): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:read": "own" } });
    const r = await linkDescarcareDocument({ documentId: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: link semnat pe 120 s, cu numele original al fișierului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_documents", "select", { data: rand });
    server.raspundeStocare(BUCKET, "createSignedUrl", { data: { signedUrl: "https://d" } });

    const r = await linkDescarcareDocument({ documentId: ID_2 });

    expect(r).toEqual({ ok: true, data: { url: "https://d", expiraSecunde: 120 } });
    const [citire] = server.apeluriPe("employee_documents");
    expect(areFiltru(citire, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriStocare[0]?.argumente).toEqual([
      rand.fisier_path,
      120,
      { download: "contract.pdf" },
    ]);
    // Un document obișnuit nu primește rând explicit de export.
    expect(server.audituri().filter((a) => a["p_entity_id"] === ID_2)).toHaveLength(0);
  });

  it("document confidențial: descărcarea se auditează explicit, pe documentul anume", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_documents", "select", { data: { ...rand, confidential: true } });
    server.raspundeStocare(BUCKET, "createSignedUrl", { data: { signedUrl: "https://d" } });

    await linkDescarcareDocument({ documentId: ID_2 });

    const explicit = server.audituri().find((a) => a["p_entity_id"] === ID_2);
    expect(explicit).toMatchObject({
      p_organization_id: ORG_ID,
      p_action: "export",
      p_status: "success",
      p_after: { employeeId: ID_1, motiv: "descarcare_document_confidential" },
    });
  });

  it("document inexistent: NEGASIT, niciun link", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_documents", "select", { data: null });
    const r = await linkDescarcareDocument({ documentId: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("fișierul lipsește din arhivă: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("employee_documents", "select", { data: rand });
    server.raspundeStocare(BUCKET, "createSignedUrl", { error: { message: "x" } });
    const r = await linkDescarcareDocument({ documentId: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("stergeDocument", () => {
  const PERMIS = { "employees:delete": "all" } as const;
  const intrare = { documentId: ID_2, motiv: "Încărcat din greșeală" };

  it("employees:delete sub `all` (team): INTERZIS", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: { "employees:delete": "team" } });
    const r = await stergeDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("succes: retragere LOGICĂ prin clientul de serviciu, cu filtru explicit pe organizație", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: PERMIS });
    admin.raspunde("employee_documents", "update", { data: { id: ID_2 } });

    const r = await stergeDocument(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [update] = admin.apeluriPe("employee_documents", "update");
    expect(update?.payload).toMatchObject({
      observatii: "Încărcat din greșeală",
      updated_by: USER_ID,
    });
    expect(typeof (update?.payload as { deleted_at: unknown }).deleted_at).toBe("string");
    expect(areFiltru(update, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(update, "is", "deleted_at", null)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(server.apeluriPe("employee_documents")).toHaveLength(0);
  });

  it("zero rânduri (deja retras sau din altă firmă): NEGASIT", async () => {
    const { admin } = configureazaActiunea({ permisiuni: PERMIS });
    admin.raspunde("employee_documents", "update", { data: null });
    const r = await stergeDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it("eroare la scriere: CONFLICT", async () => {
    const { admin } = configureazaActiunea({ permisiuni: PERMIS });
    admin.raspunde("employee_documents", "update", { error: eroarePostgrest("23514") });
    const r = await stergeDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("fără motiv: VALIDARE, nicio scriere", async () => {
    const { admin } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await stergeDocument({ documentId: ID_2, motiv: " " });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(admin.apeluri).toHaveLength(0);
  });
});

// ── Documente emise ──────────────────────────────────────────────────────────

describe("anuleazaDocumentEmis", () => {
  const PERMIS = { "employees:update": "all" } as const;
  const intrare = { documentId: ID_2, motiv: "Emis din greșeală" };

  it("employees:update sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:update": "team" } });
    const r = await anuleazaDocumentEmis(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: marchează anularea doar pe un document încă activ, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_issued_documents", "update", {
      data: { id: ID_2, numar_afisat: "CIM 7/2026" },
    });

    const r = await anuleazaDocumentEmis(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_2, numarAfisat: "CIM 7/2026" } });
    const [update] = server.apeluriPe("hr_issued_documents", "update");
    expect(update?.payload).toMatchObject({ motiv_anulare: "Emis din greșeală" });
    expect(Object.keys(update?.payload as object).sort()).toEqual(["anulat_la", "motiv_anulare"]);
    expect(areFiltru(update, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(update, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(update, "is", "anulat_la", null)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/angajati"]);
  });

  it("zero rânduri (deja anulat): NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_issued_documents", "update", { data: null });
    const r = await anuleazaDocumentEmis(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 (exercițiu închis): CONFLICT cu mesajul bazei, care spune anul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const mesaj = "Exercițiul 2025 este închis; documentul nu mai poate fi anulat.";
    server.raspunde("hr_issued_documents", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await anuleazaDocumentEmis(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("altă eroare: CONFLICT cu mesaj generic, fără textul bazei", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_issued_documents", "update", {
      error: eroarePostgrest("23514", "constraint hr_issued_xyz"),
    });
    const r = await anuleazaDocumentEmis(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).not.toContain("hr_issued_xyz");
  });
});

/** Contextul minim: mod de lucru la sediu, fără fișa postului. */
const CONTEXT = {
  organizationId: ORG_ID,
  employeeId: ID_1,
  contractId: ID_3,
  codModLucru: "sediu",
  fisaPostului: null,
};

function emis(cod: string, id: string) {
  return { cod, denumire: cod, id, numarAfisat: `${cod}-nou` };
}

describe("emiteDocumenteLipsa", () => {
  const PERMIS = { "employees:create": "all" } as const;

  it("employees:create sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:create": "team" } });
    const r = await emiteDocumenteLipsa({ employeeId: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(doc.aduna).not.toHaveBeenCalled();
  });

  it("emite DOAR codurile eligibile care nu au deja un document activ", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    doc.aduna.mockResolvedValue(CONTEXT);
    server.raspunde("hr_issued_documents", "select", {
      data: [{ id: ID_2, numar_afisat: "CIM 1", hr_document_templates: { cod: "contract_munca" } }],
    });
    doc.genereaza.mockResolvedValue({ documente: [emis("nda", ID_3)], avertismente: ["a"] });

    const r = await emiteDocumenteLipsa({ employeeId: ID_1 });

    expect(r).toEqual({
      ok: true,
      data: { documente: [emis("nda", ID_3)], avertismente: ["a"] },
    });
    expect(doc.aduna.mock.calls[0]?.[1]).toMatchObject({
      organizationId: ORG_ID,
      employeeId: ID_1,
    });
    const [active] = server.apeluriPe("hr_issued_documents");
    expect(areFiltru(active, "eq", "employee_id", ID_1)).toBe(true);
    expect(areFiltru(active, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(active, "is", "anulat_la", null)).toBe(true);
    expect(areFiltru(active, "is", "deleted_at", null)).toBe(true);
    // Sediu, fără fișa postului: nici fișa postului, nici actul de telemuncă.
    expect(doc.genereaza.mock.calls[0]?.[1]).toMatchObject({
      emisDe: USER_ID,
      doarCodurile: ["nda", "anexa_proprietate_intelectuala"],
    });
    expect(caiRevalidate()).toEqual(["/angajati"]);
  });

  it("totul e deja emis: CONFLICT și generatorul nu se cheamă (fiecare emitere consumă un număr)", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    doc.aduna.mockResolvedValue(CONTEXT);
    server.raspunde("hr_issued_documents", "select", {
      data: ["contract_munca", "nda", "anexa_proprietate_intelectuala"].map((cod, i) => ({
        id: `${i}`,
        numar_afisat: cod,
        hr_document_templates: { cod },
      })),
    });
    const r = await emiteDocumenteLipsa({ employeeId: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(doc.genereaza).not.toHaveBeenCalled();
  });
});

describe("regenereazaDocumente", () => {
  const PERMIS = { "employees:create": "all" } as const;
  const intrare = { employeeId: ID_1, coduri: ["contract_munca"], motiv: "Salariu corectat" };
  const ACTIV = {
    id: ID_2,
    numar_afisat: "CIM 1",
    hr_document_templates: { cod: "contract_munca" },
  };

  it("employees:create sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:create": "team" } });
    const r = await regenereazaDocumente(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: emite întâi varianta nouă, apoi anulează predecesorul cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    doc.aduna.mockResolvedValue(CONTEXT);
    server.raspunde("hr_issued_documents", "select", { data: [ACTIV] });
    // Câte anulări existau în clipa emiterii: trebuie să fie zero.
    let anulariLaEmitere = -1;
    doc.genereaza.mockImplementation(() => {
      anulariLaEmitere = server.apeluriPe("hr_issued_documents", "update").length;
      return Promise.resolve({ documente: [emis("contract_munca", ID_3)], avertismente: [] });
    });
    server.raspunde("hr_issued_documents", "update", { data: { id: ID_2 } });

    const r = await regenereazaDocumente(intrare);

    expect(r).toEqual({
      ok: true,
      data: { documente: [emis("contract_munca", ID_3)], anulate: ["CIM 1"], avertismente: [] },
    });
    expect(doc.genereaza.mock.calls[0]?.[1]).toMatchObject({ doarCodurile: ["contract_munca"] });
    const [update] = server.apeluriPe("hr_issued_documents", "update");
    expect(update?.payload).toMatchObject({ motiv_anulare: "Salariu corectat" });
    expect(areFiltru(update, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(update, "is", "anulat_la", null)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    // Ordinea: generatorul a rulat înainte de anulare (altfel dosarul rămâne gol la eșec).
    expect(anulariLaEmitere).toBe(0);
  });

  it("anularea respinsă tăcut (zero rânduri): avertisment cu numărul documentului, nu „anulat”", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    doc.aduna.mockResolvedValue(CONTEXT);
    server.raspunde("hr_issued_documents", "select", { data: [ACTIV] });
    doc.genereaza.mockResolvedValue({
      documente: [emis("contract_munca", ID_3)],
      avertismente: [],
    });
    server.raspunde("hr_issued_documents", "update", { data: null });

    const r = await regenereazaDocumente(intrare);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.anulate).toEqual([]);
    expect(r.data.avertismente).toHaveLength(1);
    expect(r.data.avertismente[0]).toContain("CIM 1");
  });

  it("emiterea a eșuat pentru un cod: predecesorul lui NU se anulează", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    doc.aduna.mockResolvedValue(CONTEXT);
    server.raspunde("hr_issued_documents", "select", { data: [ACTIV] });
    doc.genereaza.mockResolvedValue({ documente: [], avertismente: ["contractul a eșuat"] });

    const r = await regenereazaDocumente(intrare);

    expect(r).toEqual({
      ok: true,
      data: { documente: [], anulate: [], avertismente: ["contractul a eșuat"] },
    });
    expect(server.apeluriPe("hr_issued_documents", "update")).toHaveLength(0);
  });

  it("document emis fără predecesor activ: nimic de anulat", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    doc.aduna.mockResolvedValue(CONTEXT);
    server.raspunde("hr_issued_documents", "select", { data: [] });
    doc.genereaza.mockResolvedValue({
      documente: [emis("contract_munca", ID_3)],
      avertismente: [],
    });
    const r = await regenereazaDocumente(intrare);
    expect(r).toMatchObject({ ok: true, data: { anulate: [] } });
    expect(server.apeluriPe("hr_issued_documents", "update")).toHaveLength(0);
  });

  it("doar coduri neeligibile (fișa postului fără fișă): CONFLICT, nimic emis, nimic citit", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    doc.aduna.mockResolvedValue(CONTEXT);
    const r = await regenereazaDocumente({ ...intrare, coduri: ["fisa_postului"] });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(doc.genereaza).not.toHaveBeenCalled();
    expect(server.apeluri).toHaveLength(0);
  });

  it("cod necunoscut sau listă goală: VALIDARE", async () => {
    configureazaActiunea({ permisiuni: PERMIS });
    const necunoscut = await regenereazaDocumente({ ...intrare, coduri: ["inventat"] });
    const gol = await regenereazaDocumente({ ...intrare, coduri: [] });
    expect(necunoscut).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(gol).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
  });
});

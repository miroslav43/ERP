// src/app/(app)/angajati/sabloane-documente/actions.test.ts
//
// Șabloanele documentelor de personal (clonare din platformă, restabilire) și
// antetul firmei (poziție, siglă). Straturile comune ale lui `createAction`
// sunt verificate în testul canonic (`salarizare/actions.test.ts`).

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

import {
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  creeazaSablonPersonalizat,
  pregatesteSigla,
  restabilesteSablonPlatforma,
  salveazaAntetDocumente,
  salveazaSablonDocument,
  salveazaSigla,
  stergeSigla,
} from "./actions";

const CAI = ["/angajati/sabloane-documente", "/angajati"];
const BUCKET = "org-branding";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

type Fals = ReturnType<typeof configureazaActiunea>["server"];

// ── Șabloanele ───────────────────────────────────────────────────────────────

describe("salveazaSablonDocument", () => {
  const PERMIS = { "employees:update": "all" } as const;
  const intrare = {
    cod: "nda",
    denumire: "Acord de confidențialitate",
    continut_html: "<p>Subsemnatul {{angajat_nume}}, funcția {{functie}}.</p>",
  };

  it("employees:update sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:update": "team" } });
    const r = await salveazaSablonDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("varianta firmei există: o actualizează pe id + organizație, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_document_templates", "select", { data: { id: ID_1 } });
    server.raspunde("hr_document_templates", "update", { data: { id: ID_1 } });

    const r = await salveazaSablonDocument(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [cautare] = server.apeluriPe("hr_document_templates", "select");
    expect(areFiltru(cautare, "eq", "cod", "nda")).toBe(true);
    expect(areFiltru(cautare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(cautare, "is", "deleted_at", null)).toBe(true);
    const [update] = server.apeluriPe("hr_document_templates", "update");
    expect(update?.payload).toMatchObject({
      denumire: "Acord de confidențialitate",
      continut_html: intrare.continut_html,
      updated_by: USER_ID,
    });
    expect(areFiltru(update, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    // Un rând retras între citire și scriere nu se rescrie.
    expect(areFiltru(update, "is", "deleted_at", null)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(server.apeluriPe("hr_document_templates", "upsert")).toHaveLength(0);
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("prima editare: clonează seed-ul platformei, cu seria și descrierea lui", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_document_templates", "select", { data: null });
    server.raspunde("hr_document_templates", "select", {
      data: { descriere: "Seed", serie: "NDA", variabile: ["angajat_nume"] },
    });
    server.raspunde("hr_document_templates", "insert", { data: { id: ID_2 } });

    const r = await salveazaSablonDocument(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const platforma = server.apeluriPe("hr_document_templates", "select")[1];
    expect(areFiltru(platforma, "eq", "cod", "nda")).toBe(true);
    expect(areFiltru(platforma, "is", "organization_id", null)).toBe(true);
    expect(areFiltru(platforma, "is", "deleted_at", null)).toBe(true);
    const [insert] = server.apeluriPe("hr_document_templates", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      cod: "nda",
      denumire: "Acord de confidențialitate",
      descriere: "Seed",
      continut_html: intrare.continut_html,
      serie: "NDA",
      variabile: ["angajat_nume"],
      activ: true,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    // Seed-ul de platformă nu se atinge niciodată.
    expect(server.apeluriPe("hr_document_templates", "update")).toHaveLength(0);
  });

  it("HTML-ul se salvează CURĂȚAT: fără script și fără atribute", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_document_templates", "select", { data: { id: ID_1 } });
    server.raspunde("hr_document_templates", "update", { data: { id: ID_1 } });

    await salveazaSablonDocument({
      ...intrare,
      continut_html: `<script>alert(1)</script><p onclick="x()" style="color:red">Salut {{angajat_nume}}</p>`,
    });

    const html = (
      server.apeluriPe("hr_document_templates", "update")[0]?.payload as {
        continut_html: string;
      }
    ).continut_html;
    expect(html).not.toMatch(/<script|onclick|style=/iu);
    expect(html).toContain("Salut {{angajat_nume}}");
  });

  it("variabilă inexistentă: CONFLICT care o numește, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await salveazaSablonDocument({
      ...intrare,
      continut_html: "<p>{{angajat_nume}} {{salariu_secret}}</p>",
    });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("{{salariu_secret}}");
    expect(r.error.message).not.toContain("Disponibile pentru acest document: {{salariu_secret}}");
    expect(server.apeluri).toHaveLength(0);
  });

  it("o variabilă valabilă pentru ALT document nu trece pe acesta", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    // `durata_confidentialitate` e a NDA-ului, nu a fișei postului.
    const r = await salveazaSablonDocument({
      ...intrare,
      cod: "fisa_postului",
      continut_html: "<p>{{durata_confidentialitate}}</p>",
    });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("după curățare nu rămâne niciun text: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await salveazaSablonDocument({ ...intrare, continut_html: "<div><br></div>" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("varianta firmei a dispărut între citire și scriere (zero rânduri): NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_document_templates", "select", { data: { id: ID_1 } });
    server.raspunde("hr_document_templates", "update", { data: null });
    const r = await salveazaSablonDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("codul nu există nici în platformă: NEGASIT, nicio inserare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_document_templates", "select", { data: null });
    server.raspunde("hr_document_templates", "select", { data: null });
    const r = await salveazaSablonDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("hr_document_templates", "insert")).toHaveLength(0);
  });

  it("inserarea eșuează: CONFLICT cu mesaj fix", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_document_templates", "select", { data: null });
    server.raspunde("hr_document_templates", "select", {
      data: { descriere: null, serie: "NDA", variabile: [] },
    });
    server.raspunde("hr_document_templates", "insert", { error: eroarePostgrest("23505") });
    const r = await salveazaSablonDocument(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("creeazaSablonPersonalizat", () => {
  const PERMIS = { "employees:create": "all" } as const;
  const intrare = {
    denumire: "Cerere de concediu fără plată",
    serie: "cer",
    continut_html:
      "<p>Subsemnatul {{angajat_nume}}, CNP {{cnp_complet}}, cu salariul {{salariu_brut}}.</p>",
  };

  it("employees:create sub `all`: INTERZIS — inserarea cere exact ce cere `hr_templates_insert`", async () => {
    const { server } = configureazaActiunea({
      permisiuni: { "employees:create": "team", "employees:update": "all" },
    });
    const r = await creeazaSablonPersonalizat(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("inserează rândul FIRMEI, cu codul dedus din denumire și seria cu majuscule", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_document_templates", "select", { data: [] });
    server.raspunde("hr_document_templates", "insert", {
      data: { id: ID_1, cod: "doc_cerere_de_concediu_fara_plata" },
    });

    const r = await creeazaSablonPersonalizat(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_1, cod: "doc_cerere_de_concediu_fara_plata" } });
    const [cautare] = server.apeluriPe("hr_document_templates", "select");
    expect(areFiltru(cautare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(cautare, "is", "deleted_at", null)).toBe(true);
    const [insert] = server.apeluriPe("hr_document_templates", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      cod: "doc_cerere_de_concediu_fara_plata",
      denumire: "Cerere de concediu fără plată",
      descriere: null,
      continut_html: intrare.continut_html,
      serie: "CER",
      variabile: ["angajat_nume", "cnp_complet", "salariu_brut"],
      activ: true,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("variabile din documente DIFERITE trec împreună: documentul firmei le are pe toate", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_document_templates", "select", { data: [] });
    server.raspunde("hr_document_templates", "insert", { data: { id: ID_1, cod: "doc_x" } });
    const r = await creeazaSablonPersonalizat({
      ...intrare,
      continut_html: "<p>{{durata_confidentialitate}} {{atributii}} {{loc_telemunca}}</p>",
    });
    expect(r.ok).toBe(true);
  });

  it("cod ocupat: ia primul sufix liber", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_document_templates", "select", {
      data: [
        { cod: "doc_cerere_de_concediu_fara_plata" },
        { cod: "doc_cerere_de_concediu_fara_plata_2" },
      ],
    });
    server.raspunde("hr_document_templates", "insert", {
      data: { id: ID_2, cod: "doc_cerere_de_concediu_fara_plata_3" },
    });

    const r = await creeazaSablonPersonalizat(intrare);

    expect(r.ok).toBe(true);
    const [insert] = server.apeluriPe("hr_document_templates", "insert");
    expect(insert?.payload).toMatchObject({ cod: "doc_cerere_de_concediu_fara_plata_3" });
  });

  it("coliziune la inserare (23505, altă sesiune): reîncearcă pe sufixul următor", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_document_templates", "select", { data: [] });
    server.raspunde("hr_document_templates", "insert", { error: eroarePostgrest("23505") });
    server.raspunde("hr_document_templates", "insert", {
      data: { id: ID_2, cod: "doc_cerere_de_concediu_fara_plata_2" },
    });

    const r = await creeazaSablonPersonalizat(intrare);

    expect(r.ok).toBe(true);
    const inserari = server.apeluriPe("hr_document_templates", "insert");
    expect(inserari.map((a) => (a.payload as { cod: string }).cod)).toEqual([
      "doc_cerere_de_concediu_fara_plata",
      "doc_cerere_de_concediu_fara_plata_2",
    ]);
  });

  it("variabilă inexistentă: CONFLICT care o numește, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await creeazaSablonPersonalizat({
      ...intrare,
      continut_html: "<p>{{salariu_net}}</p>",
    });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (r.ok) return;
    expect(r.error.message).toContain("{{salariu_net}}");
    expect(server.apeluri).toHaveLength(0);
  });

  it.each(["CIM", "nda", "C1", "X", "SERIEPREALUNGA"])(
    "seria %j: VALIDARE, fără nicio interogare",
    async (serie) => {
      const { server } = configureazaActiunea({ permisiuni: PERMIS });
      const r = await creeazaSablonPersonalizat({ ...intrare, serie });
      expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("altă eroare la inserare: CONFLICT, fără reîncercare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_document_templates", "select", { data: [] });
    server.raspunde("hr_document_templates", "insert", { error: eroarePostgrest("42501") });
    const r = await creeazaSablonPersonalizat(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("hr_document_templates", "insert")).toHaveLength(1);
  });
});

describe("salveazaSablonDocument pe un document al firmei", () => {
  const PERMIS = { "employees:update": "all" } as const;

  it("acceptă orice variabilă și actualizează rândul firmei", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_document_templates", "select", { data: { id: ID_1 } });
    server.raspunde("hr_document_templates", "update", { data: { id: ID_1 } });
    const r = await salveazaSablonDocument({
      cod: "doc_cerere",
      denumire: "Cerere",
      continut_html: "<p>{{durata_confidentialitate}} {{salariu_brut}}</p>",
    });
    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
  });

  it("rândul firmei a dispărut: NEGASIT, NU se caută seed și nu se inserează nimic", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_document_templates", "select", { data: null });
    const r = await salveazaSablonDocument({
      cod: "doc_cerere",
      denumire: "Cerere",
      continut_html: "<p>{{angajat_nume}}</p>",
    });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("hr_document_templates", "select")).toHaveLength(1);
    expect(server.apeluriPe("hr_document_templates", "insert")).toHaveLength(0);
  });

  it("un cod care nu e nici de înrolare, nici al firmei: VALIDARE", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await salveazaSablonDocument({
      cod: "adeverinta_venit",
      denumire: "Adeverință",
      continut_html: "<p>x</p>",
    });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("restabilesteSablonPlatforma", () => {
  const PERMIS = { "employees:update": "all" } as const;

  it("employees:update sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:update": "team" } });
    const r = await restabilesteSablonPlatforma({ cod: "nda" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: retrage LOGIC varianta firmei, niciodată seed-ul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_document_templates", "update", { data: { id: ID_1 } });

    const r = await restabilesteSablonPlatforma({ cod: "nda" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [update, ...altele] = server.apeluriPe("hr_document_templates");
    expect(altele).toHaveLength(0);
    expect(update?.operatie).toBe("update");
    expect(update?.payload).toMatchObject({ updated_by: USER_ID });
    expect(typeof (update?.payload as { deleted_at: unknown }).deleted_at).toBe("string");
    expect(areFiltru(update, "eq", "cod", "nda")).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(update, "is", "deleted_at", null)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("firma nu are variantă proprie (zero rânduri): NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_document_templates", "update", { data: null });
    const r = await restabilesteSablonPlatforma({ cod: "nda" });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
  });

  it("eroare la scriere: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("hr_document_templates", "update", { error: eroarePostgrest("42501") });
    const r = await restabilesteSablonPlatforma({ cod: "nda" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

// ── Antetul și sigla ─────────────────────────────────────────────────────────

describe("salveazaAntetDocumente", () => {
  const PERMIS = { "branding:update": "all" } as const;
  const intrare = { pozitie: "subsol", arata_logo: false };

  it("branding:update sub `all` (team): INTERZIS — aceeași poartă ca politica din bază", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "branding:update": "team" } });
    const r = await salveazaAntetDocumente(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("rând existent (chiar șters logic): UPDATE care îl readuce, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("organization_branding", "select", { data: { organization_id: ORG_ID } });
    server.raspunde("organization_branding", "update", { data: { organization_id: ORG_ID } });

    const r = await salveazaAntetDocumente(intrare);

    expect(r).toEqual({ ok: true, data: { organizationId: ORG_ID } });
    const [citire] = server.apeluriPe("organization_branding", "select");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    // Citirea NU filtrează ștergerea: un rând șters logic ar lovi cheia primară la INSERT.
    expect(areFiltru(citire, "is", "deleted_at")).toBe(false);
    const [update] = server.apeluriPe("organization_branding", "update");
    expect(update?.payload).toEqual({
      antet_pozitie: "subsol",
      antet_arata_logo: false,
      deleted_at: null,
      updated_by: USER_ID,
    });
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(server.apeluriPe("organization_branding", "upsert")).toHaveLength(0);
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("niciun rând: INSERT pe organizația din sesiune", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("organization_branding", "select", { data: null });
    server.raspunde("organization_branding", "insert", { data: { organization_id: ORG_ID } });

    const r = await salveazaAntetDocumente(intrare);

    expect(r.ok).toBe(true);
    expect(server.apeluriPe("organization_branding", "insert")[0]?.payload).toEqual({
      organization_id: ORG_ID,
      antet_pozitie: "subsol",
      antet_arata_logo: false,
      created_by: USER_ID,
      updated_by: USER_ID,
    });
  });

  it("UPDATE respins tăcut de USING (zero rânduri): CONFLICT, nu „salvat”", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("organization_branding", "select", { data: { organization_id: ORG_ID } });
    server.raspunde("organization_branding", "update", { data: null });
    const r = await salveazaAntetDocumente(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("poziție necunoscută: VALIDARE", async () => {
    configureazaActiunea({ permisiuni: PERMIS });
    const r = await salveazaAntetDocumente({ pozitie: "lateral", arata_logo: true });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
  });
});

describe("pregatesteSigla", () => {
  const PERMIS = { "branding:update": "all" } as const;

  it("branding:update sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "branding:update": "team" } });
    const r = await pregatesteSigla({ numeFisier: "s.png", dimensiune: 10, mime: "image/png" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it.each([
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
  ])("%s: cale în patru segmente sub organizație, cu extensia %s", async (mime, extensie) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeStocare(BUCKET, "createSignedUploadUrl", { data: { signedUrl: "https://s" } });

    const r = await pregatesteSigla({ numeFisier: "sigla", dimensiune: 10, mime });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.cale).toMatch(
      new RegExp(`^${ORG_ID}/branding/logo/[0-9a-f-]{36}\\.${extensie}$`, "u"),
    );
    expect(server.apeluriStocare[0]?.argumente[0]).toBe(r.data.cale);
  });

  it.each([
    ["GIF", { mime: "image/gif", dimensiune: 10 }],
    ["peste 512 KB", { mime: "image/png", dimensiune: 512 * 1024 + 1 }],
  ])("%s: VALIDARE, nicio semnare", async (_n, modificare) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await pregatesteSigla({ numeFisier: "s", ...modificare });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("semnarea eșuează: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspundeStocare(BUCKET, "createSignedUploadUrl", { error: { message: "x" } });
    const r = await pregatesteSigla({ numeFisier: "s", dimensiune: 10, mime: "image/png" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("salveazaSigla", () => {
  const PERMIS = { "branding:update": "all" } as const;
  const cale = `${ORG_ID}/branding/logo/${ID_1}.png`;

  function programeaza(server: Fals, masurat: Record<string, unknown> | null) {
    server.raspundeStocare(
      BUCKET,
      "info",
      masurat === null ? { error: { message: "lipsă" } } : { data: masurat },
    );
  }

  it("branding:update sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "branding:update": "team" } });
    const r = await salveazaSigla({ cale });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("succes: verifică obiectul real și scrie calea, cu sigla pornită pe documente", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, { size: 2000, contentType: "image/png" });
    server.raspunde("organization_branding", "select", { data: { organization_id: ORG_ID } });
    server.raspunde("organization_branding", "update", { data: { organization_id: ORG_ID } });

    const r = await salveazaSigla({ cale });

    expect(r).toEqual({ ok: true, data: { organizationId: ORG_ID } });
    expect(server.apeluriStocare[0]).toMatchObject({ bucket: BUCKET, metoda: "info" });
    expect(server.apeluriPe("organization_branding", "update")[0]?.payload).toMatchObject({
      logo_light_path: cale,
      antet_arata_logo: true,
    });
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("calea siglei altei firme: CONFLICT, fără măsurare și fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await salveazaSigla({ cale: `${ID_2}/branding/logo/${ID_1}.png` });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriStocare).toHaveLength(0);
    expect(server.apeluri).toHaveLength(0);
  });

  it("obiectul nu a ajuns în depozit: NEGASIT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, null);
    const r = await salveazaSigla({ cale });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it.each([
    ["peste 512 KB", { size: 512 * 1024 + 1, contentType: "image/png" }],
    ["GIF urcat sub nume de PNG", { size: 100, contentType: "image/gif" }],
  ])("fișierul real e %s: CONFLICT, fără scriere", async (_n, masurat) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    programeaza(server, masurat);
    const r = await salveazaSigla({ cale });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluri).toHaveLength(0);
  });
});

describe("stergeSigla", () => {
  const PERMIS = { "branding:update": "all" } as const;

  it("branding:update sub `all` (team): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "branding:update": "team" } });
    const r = await stergeSigla({});
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: golește calea și oprește sigla pe documente; fișierul rămâne în bucket", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("organization_branding", "select", { data: { organization_id: ORG_ID } });
    server.raspunde("organization_branding", "update", { data: { organization_id: ORG_ID } });

    const r = await stergeSigla({});

    expect(r).toEqual({ ok: true, data: { organizationId: ORG_ID } });
    expect(server.apeluriPe("organization_branding", "update")[0]?.payload).toEqual({
      logo_light_path: null,
      antet_arata_logo: false,
      deleted_at: null,
      updated_by: USER_ID,
    });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("zero rânduri: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("organization_branding", "select", { data: { organization_id: ORG_ID } });
    server.raspunde("organization_branding", "update", { data: null });
    const r = await stergeSigla({});
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

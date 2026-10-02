// src/app/(app)/cursuri/actions-versiuni.test.ts
//
// Pasul al doilea al încărcării: salvarea rândului de versiune după ce octeții
// au urcat direct în bucket (fișier), sau din adresa unui film extern (link).
// Verificările de aici sunt cele care contează: calea anti-traversal,
// semnătura reală a fișierului (nu MIME-ul declarat) și curățenia obiectului
// respins.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  ALTA_ORG_ID,
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ID_3,
  ORG_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import { salveazaVersiuneFisier, salveazaVersiuneLink } from "./actions";

const RUTE = ["/cursuri", "/portal/cursurile-mele", "/portal"];
const CREARE = { "courses:create": "team" } as const;
const BUCKET = "org-courses";
const PREFIX = `${ORG_ID}/courses/${ID_1}/`;
const CALE = `${PREFIX}v1-abc-regulament.pdf`;

const OCTETI_PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const OCTETI_MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);
const OCTETI_HTML = new TextEncoder().encode("<html><body>");

const INTRARE_FISIER = {
  material_id: ID_1,
  cale: CALE,
  nume_fisier: "Regulament.pdf",
  mime: "application/pdf",
};

let spionFetch: ReturnType<typeof vi.fn>;

/** `fetch` întoarce primii octeți ai obiectului urcat. */
function octetiUrcati(octeti: Uint8Array, ok = true): void {
  spionFetch = vi.fn(async () =>
    ok ? new Response(new Uint8Array(octeti)) : new Response(null, { status: 404 }),
  );
  vi.stubGlobal("fetch", spionFetch);
}

/** Calea fericită până la insert, pe un material PDF cu bifă. */
function programeazaFisier(
  server: ClientFals,
  material: Record<string, unknown> = { id: ID_1, fel: "pdf", treapta_dovada: "bifa" },
): void {
  server.raspunde("course_materials", "select", { data: material });
  server.raspundeStocare(BUCKET, "createSignedUrl", { data: { signedUrl: "https://semnat/obj" } });
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("salveazaVersiuneFisier", () => {
  it("scrie versiunea următoare și o face curentă pe material, în organizația sesiunii", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: CREARE });
    programeazaFisier(server);
    octetiUrcati(OCTETI_PDF);
    server.raspunde("course_material_versions", "select", { data: { versiune: 4 } });
    server.raspunde("course_material_versions", "insert", { data: { id: ID_2 } });
    server.raspunde("course_materials", "update", { data: [{ id: ID_1 }] });

    const r = await salveazaVersiuneFisier({ ...INTRARE_FISIER, numar_pagini: 12 });

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });

    const [material] = server.apeluriPe("course_materials", "select");
    expect(areFiltru(material, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(material, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(material, "is", "deleted_at", null)).toBe(true);

    // Octeții se citesc din obiectul REAL, cu Range pe primii 4 KiB.
    expect(server.apeluriStocare[0]).toEqual({
      bucket: BUCKET,
      metoda: "createSignedUrl",
      argumente: [CALE, 60],
    });
    expect(spionFetch).toHaveBeenCalledWith("https://semnat/obj", {
      headers: { Range: "bytes=0-4095" },
    });

    const [ultima] = server.apeluriPe("course_material_versions", "select");
    expect(areFiltru(ultima, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(ultima, "eq", "material_id", ID_1)).toBe(true);
    expect(areFiltru(ultima, "is", "deleted_at", null)).toBe(true);

    const [insert] = server.apeluriPe("course_material_versions", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      material_id: ID_1,
      versiune: 5,
      fisier_path: CALE,
      fisier_nume: "Regulament.pdf",
      fisier_mime: "application/pdf",
      subtitrare_path: null,
      durata_secunde: null,
      numar_pagini: 12,
      nota_versiune: null,
      publicata_la: expect.any(String),
    });
    expect(insert?.selectDupaScriere).toBe("id");

    const [curenta] = server.apeluriPe("course_materials", "update");
    expect(curenta?.payload).toEqual({ versiune_curenta_id: ID_2 });
    expect(areFiltru(curenta, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(curenta, "eq", "organization_id", ORG_ID)).toBe(true);

    expect(admin.apeluriStocare).toHaveLength(0);
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("un film cu parcurgere măsurată și durată completată se salvează cu durata, subtitrarea și nota", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    programeazaFisier(server, { id: ID_1, fel: "video", treapta_dovada: "parcurgere" });
    octetiUrcati(OCTETI_MP4);
    server.raspunde("course_material_versions", "select", { data: null });
    server.raspunde("course_material_versions", "insert", { data: { id: ID_2 } });
    server.raspunde("course_materials", "update", { data: [{ id: ID_1 }] });

    const r = await salveazaVersiuneFisier({
      ...INTRARE_FISIER,
      cale: `${PREFIX}v1-a.mp4`,
      nume_fisier: "Instructaj.mp4",
      mime: "video/mp4",
      durata_secunde: 480,
      subtitrare_cale: `${PREFIX}sub.vtt`,
      nota_versiune: "Revizie",
    });

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [insert] = server.apeluriPe("course_material_versions", "insert");
    expect(insert?.payload).toMatchObject({
      fisier_path: `${PREFIX}v1-a.mp4`,
      fisier_mime: "video/mp4",
      durata_secunde: 480,
      subtitrare_path: `${PREFIX}sub.vtt`,
      nota_versiune: "Revizie",
    });
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("eroarea la mutarea materialului pe versiunea nouă (42501) ⇒ CONFLICT tradus, nu succes", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    programeazaFisier(server);
    octetiUrcati(OCTETI_PDF);
    server.raspunde("course_material_versions", "select", { data: null });
    server.raspunde("course_material_versions", "insert", { data: { id: ID_2 } });
    server.raspunde("course_materials", "update", { error: eroarePostgrest("42501") });

    const r = await salveazaVersiuneFisier(INTRARE_FISIER);

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Nu aveți dreptul de a modifica acest câmp." },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it("prima versiune a unui material fără istoric primește numărul 1", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    programeazaFisier(server);
    octetiUrcati(OCTETI_PDF);
    server.raspunde("course_material_versions", "select", { data: null });
    server.raspunde("course_material_versions", "insert", { data: { id: ID_2 } });
    server.raspunde("course_materials", "update", { data: { id: ID_1 } });

    await salveazaVersiuneFisier(INTRARE_FISIER);

    const [insert] = server.apeluriPe("course_material_versions", "insert");
    expect((insert?.payload as { versiune: number }).versiune).toBe(1);
  });

  it.each([
    ["alt tenant", `${ALTA_ORG_ID}/courses/${ID_1}/v1-a.pdf`],
    ["alt material", `${ORG_ID}/courses/${ID_2}/v1-a.pdf`],
    ["traversare", `${PREFIX}../${ID_2}/a.pdf`],
  ])(
    "calea fișierului în afara materialului (%s) ⇒ VALIDARE pe `cale`, nimic citit",
    async (_c, cale) => {
      const { server } = configureazaActiunea({ permisiuni: CREARE });

      const r = await salveazaVersiuneFisier({ ...INTRARE_FISIER, cale });

      expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
      if (r.ok) return;
      expect(r.error.fieldErrors).toHaveProperty("cale");
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("subtitrarea din afara materialului ⇒ VALIDARE pe `subtitrare_cale`", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });

    const r = await salveazaVersiuneFisier({
      ...INTRARE_FISIER,
      subtitrare_cale: `${ORG_ID}/courses/${ID_3}/sub.vtt`,
    });

    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("subtitrare_cale");
    expect(server.apeluri).toHaveLength(0);
  });

  it("material inexistent ⇒ NEGASIT, fără citirea obiectului", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("course_materials", "select", { data: null });

    const r = await salveazaVersiuneFisier(INTRARE_FISIER);

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("parcurgerea măsurată cere durata filmului: fără ea ⇒ VALIDARE pe `durata_secunde`", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("course_materials", "select", {
      data: { id: ID_1, fel: "video", treapta_dovada: "parcurgere" },
    });

    const r = await salveazaVersiuneFisier({
      ...INTRARE_FISIER,
      cale: `${PREFIX}v1-a.mp4`,
      mime: "video/mp4",
    });

    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("durata_secunde");
    expect(server.apeluriPe("course_material_versions")).toHaveLength(0);
  });

  it.each([
    ["HTML declarat PDF", OCTETI_HTML, true],
    ["obiectul nu se poate citi", OCTETI_PDF, false],
  ])(
    "%s ⇒ CONFLICT, obiectul se șterge din bucket prin admin și nu se scrie niciun rând",
    async (_caz, octeti, ok) => {
      const { server, admin } = configureazaActiunea({ permisiuni: CREARE });
      programeazaFisier(server);
      octetiUrcati(octeti, ok);
      admin.raspundeStocare(BUCKET, "remove", { data: [] });

      const r = await salveazaVersiuneFisier(INTRARE_FISIER);

      expect(r).toMatchObject({
        ok: false,
        error: {
          code: "CONFLICT",
          message: expect.stringContaining("conținutul tipului declarat"),
        },
      });
      expect(admin.apeluriStocare).toEqual([
        { bucket: BUCKET, metoda: "remove", argumente: [[CALE]] },
      ]);
      expect(server.apeluriPe("course_material_versions")).toHaveLength(0);
      expect(caiRevalidate()).toEqual([]);
    },
  );

  it("semnarea pentru citire eșuată ⇒ tratată ca fișier nevalid, obiectul se curăță", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("course_materials", "select", {
      data: { id: ID_1, fel: "pdf", treapta_dovada: "bifa" },
    });
    server.raspundeStocare(BUCKET, "createSignedUrl", { error: { message: "x" } });
    admin.raspundeStocare(BUCKET, "remove", { data: [] });
    octetiUrcati(OCTETI_PDF);

    const r = await salveazaVersiuneFisier(INTRARE_FISIER);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(spionFetch).not.toHaveBeenCalled();
    expect(admin.apeluriStocare).toHaveLength(1);
  });

  it("INSERT fără rând întors ⇒ CONFLICT, iar materialul NU e repus pe altă versiune", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    programeazaFisier(server);
    octetiUrcati(OCTETI_PDF);
    server.raspunde("course_material_versions", "select", { data: null });
    server.raspunde("course_material_versions", "insert", { data: null });

    const r = await salveazaVersiuneFisier(INTRARE_FISIER);

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("course_materials", "update")).toHaveLength(0);
  });

  it("un fișier video salvat pe un material de tip PDF e refuzat", async () => {
    // `fel` se citește din material (actions.ts:393) dar nu se compară cu
    // MIME-ul. Pasul de pregătire verifică plafoanele pe `fel` trimis de
    // CLIENT, iar semnătura se verifică pe `mime` trimis tot de client: un
    // MP4 real trece ambele și devine versiunea curentă a unui „Document".
    const { server, admin } = configureazaActiunea({ permisiuni: CREARE });
    programeazaFisier(server, { id: ID_1, fel: "pdf", treapta_dovada: "bifa" });
    octetiUrcati(OCTETI_MP4);
    admin.raspundeStocare(BUCKET, "remove", { data: [] });
    server.raspunde("course_material_versions", "select", { data: null });
    server.raspunde("course_material_versions", "insert", { data: { id: ID_2 } });
    server.raspunde("course_materials", "update", {});

    const r = await salveazaVersiuneFisier({
      ...INTRARE_FISIER,
      cale: `${PREFIX}v1-a.mp4`,
      mime: "video/mp4",
    });

    expect(r.ok).toBe(false);
    expect(server.apeluriPe("course_material_versions", "insert")).toHaveLength(0);
  });

  it("mutarea pe versiunea nouă care atinge zero rânduri e raportată, nu succes", async () => {
    // actions.ts:450 — UPDATE-ul lui `versiune_curenta_id` n-are `.select()`.
    // Inserția cere `courses:create`, actualizarea materialului cere
    // `courses:update` (politica `course_materials_update`): un rol cu
    // primul fără al doilea primește „succes", iar materialul rămâne pe
    // versiunea veche (capcana 17).
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    programeazaFisier(server);
    octetiUrcati(OCTETI_PDF);
    server.raspunde("course_material_versions", "select", { data: null });
    server.raspunde("course_material_versions", "insert", { data: { id: ID_2 } });
    server.raspunde("course_materials", "update", { data: null });

    const r = await salveazaVersiuneFisier(INTRARE_FISIER);

    expect(server.apeluriPe("course_materials", "update")[0]?.selectDupaScriere).toBeDefined();
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("salveazaVersiuneLink", () => {
  it("descompune adresa (furnizor, id, cod privat) și face versiunea curentă", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: CREARE });
    server.raspunde("course_material_versions", "select", { data: { versiune: 2 } });
    server.raspunde("course_material_versions", "insert", { data: { id: ID_2 } });
    server.raspunde("course_materials", "update", { data: { id: ID_1 } });

    const r = await salveazaVersiuneLink({
      material_id: ID_1,
      adresa: "https://vimeo.com/123456789?h=abcd1234",
      durata_secunde: 300,
    });

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [ultima] = server.apeluriPe("course_material_versions", "select");
    expect(areFiltru(ultima, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(ultima, "eq", "material_id", ID_1)).toBe(true);
    expect(areFiltru(ultima, "is", "deleted_at", null)).toBe(true);

    const [insert] = server.apeluriPe("course_material_versions", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      material_id: ID_1,
      versiune: 3,
      link_furnizor: "vimeo",
      link_id: "123456789",
      link_cod_privat: "abcd1234",
      durata_secunde: 300,
      nota_versiune: null,
      publicata_la: expect.any(String),
    });

    const [curenta] = server.apeluriPe("course_materials", "update");
    expect(curenta?.payload).toEqual({ versiune_curenta_id: ID_2 });
    expect(areFiltru(curenta, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(curenta, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it.each([
    ["http simplu", "http://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["gazdă străină", "https://www.dailymotion.com/video/x7tgad0"],
    ["gazdă care doar seamănă", "https://youtube.com.evil.ro/watch?v=dQw4w9WgXcQ"],
    ["id nerecunoscut", "https://www.youtube.com/watch?v=scurt"],
    ["cu utilizator și parolă", "https://u:p@www.youtube.com/watch?v=dQw4w9WgXcQ"],
  ])("adresa respinsă (%s) ⇒ VALIDARE pe `adresa`, nicio citire", async (_caz, adresa) => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });

    const r = await salveazaVersiuneLink({ material_id: ID_1, adresa });

    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("adresa");
    expect(server.apeluri).toHaveLength(0);
  });

  it("nota versiunii completată ajunge în rândul scris", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("course_material_versions", "select", { data: null });
    server.raspunde("course_material_versions", "insert", { data: { id: ID_2 } });
    server.raspunde("course_materials", "update", { data: { id: ID_1 } });

    const r = await salveazaVersiuneLink({
      material_id: ID_1,
      adresa: "https://youtu.be/dQw4w9WgXcQ",
      nota_versiune: "Revizie",
    });

    expect(r).toEqual({ ok: true, data: { id: ID_2 } });
    const [insert] = server.apeluriPe("course_material_versions", "insert");
    expect(insert?.payload).toMatchObject({
      versiune: 1,
      link_furnizor: "youtube",
      link_id: "dQw4w9WgXcQ",
      nota_versiune: "Revizie",
      durata_secunde: null,
    });
  });

  it("eroarea la mutarea materialului pe versiunea-link nouă (42501) ⇒ CONFLICT tradus, nu succes", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("course_material_versions", "select", { data: null });
    server.raspunde("course_material_versions", "insert", { data: { id: ID_2 } });
    server.raspunde("course_materials", "update", { error: eroarePostgrest("42501") });

    const r = await salveazaVersiuneLink({
      material_id: ID_1,
      adresa: "https://youtu.be/dQw4w9WgXcQ",
    });

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Nu aveți dreptul de a modifica acest câmp." },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it("INSERT fără rând întors ⇒ CONFLICT și materialul neatins", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("course_material_versions", "select", { data: null });
    server.raspunde("course_material_versions", "insert", { data: null });

    const r = await salveazaVersiuneLink({
      material_id: ID_1,
      adresa: "https://youtu.be/dQw4w9WgXcQ",
    });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("course_materials")).toHaveLength(0);
  });

  it("mutarea pe versiunea-link nouă care atinge zero rânduri e raportată", async () => {
    // actions.ts:541 — același UPDATE fără `.select()` ca la fișier.
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("course_material_versions", "select", { data: null });
    server.raspunde("course_material_versions", "insert", { data: { id: ID_2 } });
    server.raspunde("course_materials", "update", { data: null });

    const r = await salveazaVersiuneLink({
      material_id: ID_1,
      adresa: "https://youtu.be/dQw4w9WgXcQ",
    });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

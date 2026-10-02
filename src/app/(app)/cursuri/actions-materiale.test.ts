// src/app/(app)/cursuri/actions-materiale.test.ts
//
// Biblioteca de materiale: creare, modificare, ștergere, pregătirea încărcării
// (rate-limit + plafoane + adresă semnată), renunțarea la o încărcare și
// previzualizarea. Salvarea versiunilor e în `actions-versiuni.test.ts`.

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
  ALTA_ORG_ID,
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import {
  actualizeazaMaterial,
  creeazaMaterial,
  linkPreviewMaterial,
  pregatesteIncarcareMaterial,
  renuntaLaIncarcare,
  stergeMaterial,
} from "./actions";

const RUTE = ["/cursuri", "/portal/cursurile-mele", "/portal"];
const CREARE = { "courses:create": "team" } as const;
const MODIFICARE = { "courses:update": "team" } as const;
const CITIRE = { "courses:read": "team" } as const;
const BUCKET = "org-courses";

const MATERIAL_PDF = { cod: "regulament", titlu: "Regulament intern", fel: "pdf", sursa: "fisier" };

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("creeazaMaterial", () => {
  it("INSERT în organizația sesiunii, cu treapta implicită `bifa` și câmpurile goale normalizate", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: CREARE });
    server.raspunde("course_materials", "insert", { data: { id: ID_1 } });

    const r = await creeazaMaterial(MATERIAL_PDF);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("course_materials", "insert");
    expect(apel?.payload).toEqual({
      organization_id: ORG_ID,
      cod: "regulament",
      titlu: "Regulament intern",
      descriere: null,
      fel: "pdf",
      sursa: "fisier",
      treapta_dovada: "bifa",
      procent_minim: null,
      prag_test: null,
      declaratie_text: null,
      transcriere: null,
    });
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it.each([
    ["PDF prin link", { ...MATERIAL_PDF, sursa: "link" }, "sursa"],
    [
      "parcurgere măsurată la PDF",
      { ...MATERIAL_PDF, treapta_dovada: "parcurgere", procent_minim: 80 },
      "treapta_dovada",
    ],
    [
      "parcurgere fără procent",
      { ...MATERIAL_PDF, fel: "video", treapta_dovada: "parcurgere" },
      "procent_minim",
    ],
    ["test grilă fără prag", { ...MATERIAL_PDF, treapta_dovada: "test" }, "prag_test"],
    ["declarație fără text", { ...MATERIAL_PDF, treapta_dovada: "declaratie" }, "declaratie_text"],
    ["procent la bifă", { ...MATERIAL_PDF, procent_minim: 50 }, "procent_minim"],
  ])(
    "combinația refuzată de CHECK-urile bazei (%s) e oprită pe câmp, fără INSERT",
    async (_caz, intrare, camp) => {
      const { server } = configureazaActiunea({ permisiuni: CREARE });
      const r = await creeazaMaterial(intrare);
      expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
      if (r.ok) return;
      expect(r.error.fieldErrors).toHaveProperty(camp);
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("23514 scăpat de validare ⇒ CONFLICT cu mesajul despre treapta de dovadă", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("course_materials", "insert", { error: eroarePostgrest("23514") });
    const r = await creeazaMaterial(MATERIAL_PDF);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("treapta de dovadă") },
    });
  });

  it("rând neîntors ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: CREARE });
    server.raspunde("course_materials", "insert", { data: null });
    const r = await creeazaMaterial(MATERIAL_PDF);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("actualizeazaMaterial", () => {
  it("UPDATE fără `id` în payload, pe id + organizație + nesters, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_materials", "update", { data: { id: ID_1 } });

    const r = await actualizeazaMaterial({ id: ID_1, ...MATERIAL_PDF, titlu: "Regulament 2026" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("course_materials", "update");
    expect(apel?.payload).not.toHaveProperty("id");
    expect(apel?.payload).toMatchObject({ titlu: "Regulament 2026", treapta_dovada: "bifa" });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("zero rânduri ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_materials", "update", { data: null });
    const r = await actualizeazaMaterial({ id: ID_1, ...MATERIAL_PDF });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("cod duplicat (23505) ⇒ VALIDARE pe `cod`", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_materials", "update", { error: eroarePostgrest("23505") });
    const r = await actualizeazaMaterial({ id: ID_1, ...MATERIAL_PDF });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", fieldErrors: { cod: [expect.any(String)] } },
    });
  });
});

describe("stergeMaterial", () => {
  it("ștergerea e logică: `deleted_at` pe id + organizație + nesters, cu `.select()` după", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_materials", "update", { data: { id: ID_1 } });

    const r = await stergeMaterial({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel, ...altele] = server.apeluriPe("course_materials");
    expect(altele).toHaveLength(0);
    expect(apel?.operatie).toBe("update");
    const payload = apel?.payload as Record<string, unknown>;
    expect(Object.keys(payload)).toEqual(["deleted_at"]);
    expect(typeof payload["deleted_at"]).toBe("string");
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(RUTE);
  });

  it("materialul aflat în parcurgere: textul triggerului (P0001) ajunge la om", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    const mesaj = "Materialul «Regulament intern» este în curs de parcurgere de 3 persoane.";
    server.raspunde("course_materials", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await stergeMaterial({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("zero rânduri ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: MODIFICARE });
    server.raspunde("course_materials", "update", { data: null });
    const r = await stergeMaterial({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("pregatesteIncarcareMaterial", () => {
  const INTRARE = {
    material_id: ID_1,
    fel: "pdf",
    nume_fisier: "Regulament Intern.pdf",
    dimensiune: 1024,
    mime: "application/pdf",
  };

  /** Programează contorul de rată (pe organizație, apoi pe utilizator). */
  const programeazaRata = (
    admin: ReturnType<typeof configureazaActiunea>["admin"],
    ...permise: boolean[]
  ) => {
    for (const p of permise) admin.raspundeRpc("consume_rate_limit", { data: p });
  };

  it("întoarce calea sub prefixul org/courses/material și adresa semnată întreagă", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: CREARE });
    programeazaRata(admin, true, true);
    server.raspunde("course_materials", "select", { data: { id: ID_1 } });
    server.raspunde("course_material_versions", "select", { count: 2 });
    server.raspundeStocare(BUCKET, "createSignedUploadUrl", {
      data: { signedUrl: "https://stocare/semnat?token=abc", token: "abc", path: "x" },
    });

    const r = await pregatesteIncarcareMaterial(INTRARE);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.urlSemnat).toBe("https://stocare/semnat?token=abc");
    // A treia versiune: două existente + 1.
    expect(r.data.cale).toMatch(
      new RegExp(`^${ORG_ID}/courses/${ID_1}/v3-[0-9a-f-]{36}-regulament-intern\\.pdf$`),
    );
    const [semnare] = server.apeluriStocare;
    expect(semnare?.metoda).toBe("createSignedUploadUrl");
    expect(semnare?.argumente[0]).toBe(r.data.cale);

    const [material] = server.apeluriPe("course_materials", "select");
    expect(areFiltru(material, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(material, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(material, "is", "deleted_at", null)).toBe(true);
    const [numarare] = server.apeluriPe("course_material_versions", "select");
    expect(areFiltru(numarare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(numarare, "eq", "material_id", ID_1)).toBe(true);
    // Versiunile șterse logic nu intră în numărul `vN` al căii.
    expect(areFiltru(numarare, "is", "deleted_at", null)).toBe(true);
    expect(numarare?.optiuni).toEqual({ count: "exact", head: true });
    // Fără `revalidate`: nimic nu s-a scris încă.
    expect(caiRevalidate()).toEqual([]);
  });

  it("limita se aplică pe organizație (30/oră) ȘI pe utilizator (15/oră)", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: CREARE });
    programeazaRata(admin, true, true);
    server.raspunde("course_materials", "select", { data: { id: ID_1 } });
    server.raspunde("course_material_versions", "select", { count: 0 });
    server.raspundeStocare(BUCKET, "createSignedUploadUrl", { data: { signedUrl: "u" } });

    await pregatesteIncarcareMaterial(INTRARE);

    expect(admin.apeluriRpc.map((a) => a.argumente)).toEqual([
      { p_key: `media:incarcare:org:${ORG_ID}`, p_limit: 30, p_window_seconds: 3600 },
      { p_key: `media:incarcare:user:${USER_ID}`, p_limit: 15, p_window_seconds: 3600 },
    ]);
  });

  it.each([
    ["organizației", [false]],
    ["utilizatorului", [true, false]],
  ])("cota %s epuizată ⇒ CONFLICT, fără nicio citire și fără semnare", async (_c, rata) => {
    const { server, admin } = configureazaActiunea({ permisiuni: CREARE });
    programeazaRata(admin, ...rata);

    const r = await pregatesteIncarcareMaterial(INTRARE);

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("Prea multe încărcări") },
    });
    expect(server.apeluri).toHaveLength(0);
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it.each([
    ["PDF peste 25 MB", { dimensiune: 25 * 1024 * 1024 + 1 }],
    ["MIME care nu e PDF", { mime: "text/html" }],
    ["film .mov", { fel: "video", mime: "video/quicktime" }],
    ["subtitrare care nu e .vtt", { este_subtitrare: true, mime: "application/x-subrip" }],
    [
      "subtitrare peste 2 MB",
      { este_subtitrare: true, mime: "text/vtt", dimensiune: 3 * 1024 * 1024 },
    ],
  ])("%s ⇒ VALIDARE pe `fisier`, înainte de orice citire", async (_caz, schimbare) => {
    const { server, admin } = configureazaActiunea({ permisiuni: CREARE });
    programeazaRata(admin, true, true);

    const r = await pregatesteIncarcareMaterial({ ...INTRARE, ...schimbare });

    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (r.ok) return;
    expect(r.error.fieldErrors).toHaveProperty("fisier");
    expect(server.apeluri).toHaveLength(0);
  });

  it("o subtitrare .vtt mică trece de plafoane chiar dacă `fel` e PDF", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: CREARE });
    programeazaRata(admin, true, true);
    server.raspunde("course_materials", "select", { data: { id: ID_1 } });
    server.raspunde("course_material_versions", "select", { count: 0 });
    server.raspundeStocare(BUCKET, "createSignedUploadUrl", { data: { signedUrl: "u" } });

    const r = await pregatesteIncarcareMaterial({
      ...INTRARE,
      este_subtitrare: true,
      mime: "text/vtt",
      nume_fisier: "sub.vtt",
    });
    expect(r.ok).toBe(true);
  });

  it("material inexistent sau din alt tenant ⇒ NEGASIT, fără semnare", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: CREARE });
    programeazaRata(admin, true, true);
    server.raspunde("course_materials", "select", { data: null });

    const r = await pregatesteIncarcareMaterial(INTRARE);

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("semnarea eșuată ⇒ CONFLICT cu mesaj, nu o adresă goală", async () => {
    const { server, admin } = configureazaActiunea({ permisiuni: CREARE });
    programeazaRata(admin, true, true);
    server.raspunde("course_materials", "select", { data: { id: ID_1 } });
    server.raspunde("course_material_versions", "select", { count: 0 });
    server.raspundeStocare(BUCKET, "createSignedUploadUrl", {
      error: { message: "bucket inexistent" },
    });

    const r = await pregatesteIncarcareMaterial(INTRARE);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("renuntaLaIncarcare", () => {
  const prefix = `${ORG_ID}/courses/${ID_1}/`;

  it("șterge obiectul prin clientul admin, doar când calea e sub prefixul materialului", async () => {
    const { server, admin } = configureazaActiunea({ rol: "manager", permisiuni: CREARE });
    admin.raspundeStocare(BUCKET, "remove", { data: [] });

    const r = await renuntaLaIncarcare({ material_id: ID_1, cale: `${prefix}v1-x-a.pdf` });

    expect(r).toEqual({ ok: true, data: { sters: true } });
    expect(admin.apeluriStocare).toEqual([
      { bucket: BUCKET, metoda: "remove", argumente: [[`${prefix}v1-x-a.pdf`]] },
    ]);
    expect(server.apeluri).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it.each([
    ["alt tenant", `${ALTA_ORG_ID}/courses/${ID_1}/v1-x-a.pdf`],
    ["alt material", `${ORG_ID}/courses/${ID_2}/v1-x-a.pdf`],
    ["traversare cu ..", `${prefix}../${ID_2}/v1-x-a.pdf`],
    ["traversare procent-codificată", `${prefix}%2e%2e/${ID_2}/a.pdf`],
    ["bară inversă", `${prefix}..\\a.pdf`],
    ["segment gol", `${prefix}/a.pdf`],
  ])("calea în afara prefixului (%s) ⇒ VALIDARE și nicio ștergere", async (_caz, cale) => {
    const { admin } = configureazaActiunea({ permisiuni: CREARE });

    const r = await renuntaLaIncarcare({ material_id: ID_1, cale });

    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(admin.apeluriStocare).toHaveLength(0);
  });
});

describe("linkPreviewMaterial", () => {
  it("semnează calea versiunii din organizație cu TTL de 120 s", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: CITIRE });
    const cale = `${ORG_ID}/courses/${ID_1}/v1-x-a.pdf`;
    server.raspunde("course_material_versions", "select", {
      data: { id: ID_2, fisier_path: cale, fisier_nume: "a.pdf" },
    });
    server.raspundeStocare(BUCKET, "createSignedUrl", { data: { signedUrl: "https://semnat" } });

    const r = await linkPreviewMaterial({ version_id: ID_2 });

    expect(r).toEqual({ ok: true, data: { url: "https://semnat", expiraSecunde: 120 } });
    const [apel] = server.apeluriPe("course_material_versions", "select");
    expect(areFiltru(apel, "eq", "id", ID_2)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriStocare).toEqual([
      { bucket: BUCKET, metoda: "createSignedUrl", argumente: [cale, 120] },
    ]);
    expect(caiRevalidate()).toEqual([]);
  });

  it.each([
    ["versiune inexistentă", null],
    ["versiune-link, fără fișier", { id: ID_2, fisier_path: null, fisier_nume: null }],
  ])("%s ⇒ NEGASIT, fără semnare", async (_caz, data) => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE });
    server.raspunde("course_material_versions", "select", { data });

    const r = await linkPreviewMaterial({ version_id: ID_2 });

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("semnarea eșuată ⇒ CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: CITIRE });
    server.raspunde("course_material_versions", "select", {
      data: { id: ID_2, fisier_path: "p", fisier_nume: "a.pdf" },
    });
    server.raspundeStocare(BUCKET, "createSignedUrl", { error: { message: "x" } });
    const r = await linkPreviewMaterial({ version_id: ID_2 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

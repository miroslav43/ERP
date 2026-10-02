// src/app/(app)/concedii/actions-document.test.ts
//
// Documentul justificativ: pregătirea încărcării (o adresă semnată pe calea
// din dosarul fișei) și deschiderea lui (calea se ia din RÂNDUL citit prin RLS,
// niciodată de la client).

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
  asteaptaDupa,
  caiRevalidate,
  configureazaActiunea,
  ID_1,
  ID_2,
  ORG_ID,
  USER_ID,
} from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { linkDocumentConcediu, pregatesteIncarcareDocumentConcediu } from "./actions";

const CERERE = ID_1;
const FISA = ID_2;
const ALT_ANGAJAT = "88888888-8888-4888-8888-888888888888";
const BUCKET = "org-documents";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("pregatesteIncarcareDocumentConcediu", () => {
  const PROPRIU = { "leave:create": "own" } as const;

  it("fără `leave:create`: INTERZIS, fără interogări și fără Storage", async () => {
    const { server, admin } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "leave:read": "own" },
    });
    const r = await pregatesteIncarcareDocumentConcediu({ nume_fisier: "a.pdf" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(server.apeluriStocare).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("pentru sine: calea stă în dosarul `leave` al fișei proprii, iar adresa semnată se întoarce", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    admin.raspunde("employees", "select", { data: { id: FISA } });
    server.raspundeStocare(BUCKET, "createSignedUploadUrl", {
      data: { signedUrl: "https://stocare/semnat?token=x", token: "x", path: "p" },
    });

    const r = await pregatesteIncarcareDocumentConcediu({ nume_fisier: "Certificat Medical.PDF" });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.urlSemnat).toBe("https://stocare/semnat?token=x");
    expect(r.data.cale).toMatch(
      new RegExp(`^${ORG_ID}/leave/${FISA}/[0-9a-f-]{36}-certificat-medical\\.pdf$`, "u"),
    );
    const [semnare] = server.apeluriStocare;
    expect(semnare).toEqual({
      bucket: BUCKET,
      metoda: "createSignedUploadUrl",
      argumente: [r.data.cale],
    });
    const [fisa] = admin.apeluriPe("employees");
    expect(areFiltru(fisa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "user_id", USER_ID)).toBe(true);
    expect(areFiltru(fisa, "eq", "is_primary", true)).toBe(true);
    expect(areFiltru(fisa, "is", "deleted_at", null)).toBe(true);
    expect(caiRevalidate()).toEqual([]);
  });

  it("auditul nu poartă entitate (cererea nu există încă) și nici calea", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    admin.raspunde("employees", "select", { data: { id: FISA } });
    server.raspundeStocare(BUCKET, "createSignedUploadUrl", { data: { signedUrl: "u" } });
    await pregatesteIncarcareDocumentConcediu({ nume_fisier: "a.pdf" });
    await asteaptaDupa();
    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "success",
        p_action: "import",
        p_entity_id: null,
        p_after: { employee_id: null, nume_fisier: "a.pdf" },
      }),
    ]);
  });

  it("scope `own` cu fișa altcuiva: CONFLICT, fără adresă semnată", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    const r = await pregatesteIncarcareDocumentConcediu({
      employee_id: ALT_ANGAJAT,
      nume_fisier: "a.pdf",
    });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("altui angajat") },
    });
    expect(server.apeluriStocare).toHaveLength(0);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("scope `all` cu fișa altcuiva: calea se construiește pe fișa aleasă, fără căutarea fișei proprii", async () => {
    const { server, admin } = configureazaActiunea({
      rol: "hr",
      permisiuni: { "leave:create": "all" },
    });
    server.raspundeStocare(BUCKET, "createSignedUploadUrl", { data: { signedUrl: "u" } });
    const r = await pregatesteIncarcareDocumentConcediu({
      employee_id: ALT_ANGAJAT,
      nume_fisier: "a.pdf",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.cale.startsWith(`${ORG_ID}/leave/${ALT_ANGAJAT}/`)).toBe(true);
    expect(admin.apeluri).toHaveLength(0);
  });

  it("cont fără fișă de angajat: CONFLICT", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    admin.raspunde("employees", "select", { data: null });
    const r = await pregatesteIncarcareDocumentConcediu({ nume_fisier: "a.pdf" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("eroare la citirea fișei proprii: EROARE_INTERNA, nu „cont fără fișă”", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    admin.raspunde("employees", "select", { error: eroarePostgrest("57014") });
    const r = await pregatesteIncarcareDocumentConcediu({ nume_fisier: "a.pdf" });
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("Storage refuză semnarea: CONFLICT cu mesaj pentru om", async () => {
    const { server, admin } = configureazaActiunea({ rol: "employee", permisiuni: PROPRIU });
    admin.raspunde("employees", "select", { data: { id: FISA } });
    server.raspundeStocare(BUCKET, "createSignedUploadUrl", {
      error: { message: "new row violates row-level security policy" },
    });
    const r = await pregatesteIncarcareDocumentConcediu({ nume_fisier: "a.pdf" });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Nu am putut pregăti încărcarea documentului." },
    });
  });
});

describe("linkDocumentConcediu", () => {
  const CITIRE = { "leave:read": "own" } as const;
  const CALE = `${ORG_ID}/leave/${FISA}/abc-certificat.pdf`;

  it("fără `leave:read`: INTERZIS, fără interogări", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: {} });
    const r = await linkDocumentConcediu({ id: CERERE });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("semnează calea din rândul citit prin RLS, pe 60 de secunde", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: CITIRE });
    server.raspunde("leave_requests", "select", { data: { atasament_path: CALE } });
    server.raspundeStocare(BUCKET, "createSignedUrl", {
      data: { signedUrl: "https://stocare/citire?token=y" },
    });

    const r = await linkDocumentConcediu({ id: CERERE });

    expect(r).toEqual({ ok: true, data: { url: "https://stocare/citire?token=y" } });
    const [citire] = server.apeluriPe("leave_requests");
    expect(citire?.coloane).toBe("atasament_path");
    expect(areFiltru(citire, "eq", "id", CERERE)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriStocare).toEqual([
      { bucket: BUCKET, metoda: "createSignedUrl", argumente: [CALE, 60] },
    ]);
    expect(caiRevalidate()).toEqual([]);
  });

  it.each([
    ["cerere invizibilă sau inexistentă", null],
    ["cerere fără document", { atasament_path: null }],
  ])("%s: NEGASIT, fără semnare", async (_caz, rand) => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: CITIRE });
    server.raspunde("leave_requests", "select", { data: rand });
    const r = await linkDocumentConcediu({ id: CERERE });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "NEGASIT", message: "Cererea nu are un document atașat." },
    });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("Storage nu poate semna: CONFLICT", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: CITIRE });
    server.raspunde("leave_requests", "select", { data: { atasament_path: CALE } });
    server.raspundeStocare(BUCKET, "createSignedUrl", { error: { message: "Object not found" } });
    const r = await linkDocumentConcediu({ id: CERERE });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Documentul nu a putut fi deschis." },
    });
  });

  // `traduEroare` ÎNTOARCE eroarea, nu o aruncă. La `actions.ts:1285` rezultatul
  // ei e ignorat (`if (error !== null) traduEroare(error);`, fără `throw`), deci
  // o eroare de bază e raportată ca „Cererea nu are un document atașat.” —
  // un expirat de interogare devine, pe ecran, un document lipsă.
  it("o eroare de citire a cererii e propagată, nu raportată drept „document lipsă” (NEGASIT)", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: CITIRE });
    server.raspunde("leave_requests", "select", { error: eroarePostgrest("57014") });
    const r = await linkDocumentConcediu({ id: CERERE });
    expect(r).toMatchObject({ ok: false, error: { code: "EROARE_INTERNA" } });
  });
});

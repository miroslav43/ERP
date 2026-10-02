// src/app/(app)/onboarding/actions-dovezi.test.ts
//
// Dovada de pas, în trei timpi (semnarea căii, urcarea din browser,
// înregistrarea rândului), linkul de descărcare și confirmarea citirii unui
// material. Ce nu se crede de la client: calea, tipul și mărimea fișierului.

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
  ID_3,
  ORG_ID,
} from "@/lib/teste/actiune";
import { BUCKET_CHECKLISTS, LIMITA_DOVADA_BYTES } from "@/lib/onboarding/cale";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { confirmaCitire, linkDovada, pregatesteIncarcareDovada, salveazaDovada } from "./actions";

const PERMIS = { "checklists:update": "own" } as const;
/** Angajatul din spatele pasului — subiectul parcursului. */
const ANGAJAT = ID_2;
const PREFIX = `${ORG_ID}/checklists/${ANGAJAT}/${ID_1}/`;

const pasVizibil = {
  data: { id: ID_1, employee_id: ANGAJAT, instance_id: ID_3, titlu: "Contract semnat" },
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

// ── poarta de modul ────────────────────────────────────────────────────────

describe("poarta de modul `onboarding`", () => {
  it.each([
    [
      "pregatesteIncarcareDovada",
      () => pregatesteIncarcareDovada({ id: ID_1, nume_fisier: "a.pdf" }),
      { "checklists:update": "all" },
    ],
    [
      "salveazaDovada",
      () =>
        salveazaDovada({
          id: ID_1,
          cale: `${PREFIX}0f0f-contract.pdf`,
          nume: "contract.pdf",
          mime: "application/pdf",
          marime_bytes: 10,
        }),
      { "checklists:update": "all" },
    ],
    ["linkDovada", () => linkDovada({ id: ID_1 }), { "checklists:read": "all" }],
    ["confirmaCitire", () => confirmaCitire({ id: ID_1 }), { "checklists:update": "all" }],
  ] as const)(
    "%s: cu modulul oprit, MODUL_DEZACTIVAT chiar și cu permisiunea la `all`",
    async (_nume, apel, permisiuni) => {
      const { server } = configureazaActiunea({ functii: [], permisiuni });
      const r = await apel();
      expect(r).toMatchObject({ ok: false, error: { code: "MODUL_DEZACTIVAT" } });
      expect(server.apeluri).toHaveLength(0);
      expect(server.apeluriStocare).toHaveLength(0);
    },
  );
});

// ── pregatesteIncarcareDovada ──────────────────────────────────────────────

describe("pregatesteIncarcareDovada", () => {
  it("fără `checklists:update`: INTERZIS, nici citire, nici semnare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "checklists:read": "all" } });
    const r = await pregatesteIncarcareDovada({ id: ID_1, nume_fisier: "a.pdf" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("semnează o cale sub prefixul PASULUI (organizație/checklists/angajat/pas)", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasVizibil);
    server.raspundeStocare(BUCKET_CHECKLISTS, "createSignedUploadUrl", {
      data: { signedUrl: "https://stocare/semnat?token=t" },
    });

    const r = await pregatesteIncarcareDovada({ id: ID_1, nume_fisier: "Contract Semnat.pdf" });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.urlSemnat).toBe("https://stocare/semnat?token=t");
    expect(r.data.cale.startsWith(PREFIX)).toBe(true);
    expect(r.data.cale.endsWith("-contract-semnat.pdf")).toBe(true);

    const [citire] = server.apeluriPe("checklist_instance_items", "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);

    expect(server.apeluriStocare).toEqual([
      { bucket: BUCKET_CHECKLISTS, metoda: "createSignedUploadUrl", argumente: [r.data.cale] },
    ]);
    // Semnarea nu schimbă nimic afișat: nicio cale de revalidat.
    expect(caiRevalidate()).toEqual([]);
  });

  it("pasul nevăzut prin RLS: NEGASIT, fără nicio semnare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", { data: null });
    const r = await pregatesteIncarcareDovada({ id: ID_1, nume_fisier: "a.pdf" });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("Storage refuză semnarea: CONFLICT cu mesaj de reluare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasVizibil);
    server.raspundeStocare(BUCKET_CHECKLISTS, "createSignedUploadUrl", {
      error: { message: "bucket policy" },
    });
    const r = await pregatesteIncarcareDovada({ id: ID_1, nume_fisier: "a.pdf" });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Nu am putut pregăti încărcarea dovezii." },
    });
  });
});

// ── salveazaDovada ─────────────────────────────────────────────────────────

describe("salveazaDovada", () => {
  const CALE = `${PREFIX}0f0f-contract.pdf`;
  const intrare = {
    id: ID_1,
    cale: CALE,
    nume: "contract.pdf",
    // Ce DECLARĂ browserul. Nu trebuie să ajungă în rând.
    mime: "application/pdf",
    marime_bytes: 10,
  };

  it("fără `checklists:update`: INTERZIS, fără citire", async () => {
    const { server } = configureazaActiunea({ permisiuni: {} });
    const r = await salveazaDovada(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("scrie mărimea și tipul MĂSURATE de Storage, nu cele declarate de client", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasVizibil);
    server.raspundeStocare(BUCKET_CHECKLISTS, "info", {
      data: { size: 123_456, contentType: "image/png" },
    });
    server.raspunde("checklist_instance_items", "update", { data: { id: ID_1 } });

    const r = await salveazaDovada(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    expect(server.apeluriStocare).toEqual([
      { bucket: BUCKET_CHECKLISTS, metoda: "info", argumente: [CALE] },
    ]);
    const [scriere] = server.apeluriPe("checklist_instance_items", "update");
    expect(scriere?.payload).toEqual({
      dovada_fisier_path: CALE,
      dovada_fisier_nume: "contract.pdf",
      dovada_fisier_mime: "image/png",
      dovada_fisier_marime_bytes: 123_456,
    });
    expect(areFiltru(scriere, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(scriere, "is", "deleted_at", null)).toBe(true);
    expect(scriere?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/onboarding", "/portal/integrarea-mea"]);
  });

  it.each([
    ["sub folderul altui angajat", `${ORG_ID}/checklists/${ID_3}/${ID_1}/x.pdf`],
    ["sub alt pas al aceluiași angajat", `${ORG_ID}/checklists/${ANGAJAT}/${ID_3}/x.pdf`],
    ["cu `..` după prefix", `${PREFIX}../${ID_3}/x.pdf`],
    ["cu `..` procent-codificat", `${PREFIX}%2e%2e/x.pdf`],
    ["cu segment gol", `${PREFIX}/x.pdf`],
  ])("calea %s: VALIDARE pe `cale`, fără Storage și fără scriere", async (_caz, cale) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasVizibil);
    const r = await salveazaDovada({ ...intrare, cale });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("cale");
    expect(server.apeluriStocare).toHaveLength(0);
    expect(server.apeluriPe("checklist_instance_items", "update")).toHaveLength(0);
  });

  it("obiectul nu mai e în bucket: CONFLICT „Reia încărcarea”, fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasVizibil);
    server.raspundeStocare(BUCKET_CHECKLISTS, "info", { error: { message: "Object not found" } });
    const r = await salveazaDovada(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toContain("Reia încărcarea");
    expect(server.apeluriPe("checklist_instance_items", "update")).toHaveLength(0);
  });

  it.each([
    ["peste 20 MB", { size: LIMITA_DOVADA_BYTES + 1, contentType: "application/pdf" }, "20 MB"],
    ["gol", { size: 0, contentType: "application/pdf" }, "gol"],
    ["executabil", { size: 100, contentType: "application/x-msdownload" }, "nu e acceptat"],
  ])(
    "fișierul MĂSURAT %s e respins pe server, chiar dacă browserul l-a declarat valid",
    async (_caz, masurat, fragment) => {
      const { server } = configureazaActiunea({ permisiuni: PERMIS });
      server.raspunde("checklist_instance_items", "select", pasVizibil);
      server.raspundeStocare(BUCKET_CHECKLISTS, "info", { data: masurat });
      const r = await salveazaDovada(intrare);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.code).toBe("VALIDARE");
      expect(r.error.message).toContain(fragment);
      expect(server.apeluriPe("checklist_instance_items", "update")).toHaveLength(0);
    },
  );

  it("fișier exact la limita de 20 MB: acceptat", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasVizibil);
    server.raspundeStocare(BUCKET_CHECKLISTS, "info", {
      data: { size: LIMITA_DOVADA_BYTES, contentType: "application/pdf" },
    });
    server.raspunde("checklist_instance_items", "update", { data: { id: ID_1 } });
    const r = await salveazaDovada(intrare);
    expect(r.ok).toBe(true);
  });

  it("UPDATE cu zero rânduri: CONFLICT „nu a putut fi atașată”", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasVizibil);
    server.raspundeStocare(BUCKET_CHECKLISTS, "info", {
      data: { size: 100, contentType: "application/pdf" },
    });
    server.raspunde("checklist_instance_items", "update", { data: null });
    const r = await salveazaDovada(intrare);
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Dovada nu a putut fi atașată pasului." },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it("auditul păstrează ce a DECLARAT clientul (mime, mărime), pentru comparație", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasVizibil);
    server.raspundeStocare(BUCKET_CHECKLISTS, "info", {
      data: { size: 100, contentType: "application/pdf" },
    });
    server.raspunde("checklist_instance_items", "update", { data: { id: ID_1 } });
    await salveazaDovada(intrare);
    await asteaptaDupa();
    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "success",
        p_after: { id: ID_1, nume: "contract.pdf", mime: "application/pdf", marime_bytes: 10 },
      }),
    ]);
  });
});

// ── linkDovada ─────────────────────────────────────────────────────────────

describe("linkDovada", () => {
  const PERMIS_CITIRE = { "checklists:read": "own" } as const;

  it("cere `checklists:read`: fără ea, INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "checklists:update": "all" } });
    const r = await linkDovada({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("semnează un URL de 120 s, cu numele original la descărcare", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS_CITIRE });
    server.raspunde("checklist_instance_items", "select", {
      data: { dovada_fisier_path: `${PREFIX}a.pdf`, dovada_fisier_nume: "Contract.pdf" },
    });
    server.raspundeStocare(BUCKET_CHECKLISTS, "createSignedUrl", {
      data: { signedUrl: "https://stocare/descarca?token=t" },
    });

    const r = await linkDovada({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { url: "https://stocare/descarca?token=t" } });
    const [citire] = server.apeluriPe("checklist_instance_items", "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriStocare).toEqual([
      {
        bucket: BUCKET_CHECKLISTS,
        metoda: "createSignedUrl",
        argumente: [`${PREFIX}a.pdf`, 120, { download: "Contract.pdf" }],
      },
    ]);
  });

  it("fără nume salvat, nu trimite cheia `download` deloc", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_CITIRE });
    server.raspunde("checklist_instance_items", "select", {
      data: { dovada_fisier_path: `${PREFIX}a.pdf`, dovada_fisier_nume: null },
    });
    server.raspundeStocare(BUCKET_CHECKLISTS, "createSignedUrl", {
      data: { signedUrl: "https://x" },
    });
    await linkDovada({ id: ID_1 });
    expect(server.apeluriStocare[0]?.argumente[2]).toEqual({});
  });

  it.each([
    ["pasul nu e vizibil", null],
    ["pasul n-are fișier", { dovada_fisier_path: null, dovada_fisier_nume: null }],
  ])("%s: NEGASIT, fără semnare", async (_caz, data) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_CITIRE });
    server.raspunde("checklist_instance_items", "select", { data });
    const r = await linkDovada({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriStocare).toHaveLength(0);
  });

  it("Storage refuză semnarea: CONFLICT", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS_CITIRE });
    server.raspunde("checklist_instance_items", "select", {
      data: { dovada_fisier_path: `${PREFIX}a.pdf`, dovada_fisier_nume: null },
    });
    server.raspundeStocare(BUCKET_CHECKLISTS, "createSignedUrl", {
      error: { message: "not found" },
    });
    const r = await linkDovada({ id: ID_1 });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Nu am putut genera linkul de descărcare." },
    });
  });
});

// ── confirmaCitire ─────────────────────────────────────────────────────────

describe("confirmaCitire", () => {
  const MATERIAL = "88888888-8888-4888-8888-888888888888";

  it("fără `checklists:update`: INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "checklists:read": "all" } });
    const r = await confirmaCitire({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("inserează rândul imutabil de citire, NU bifează pasul direct", async () => {
    const { server } = configureazaActiunea({ rol: "employee", permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasVizibil);
    server.raspunde("checklist_instance_items", "select", { data: { material_id: MATERIAL } });
    server.raspunde("checklist_material_reads", "insert", { data: { id: ID_3 } });

    const r = await confirmaCitire({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [, citireMaterial] = server.apeluriPe("checklist_instance_items", "select");
    expect(areFiltru(citireMaterial, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citireMaterial, "eq", "organization_id", ORG_ID)).toBe(true);

    const [insert] = server.apeluriPe("checklist_material_reads");
    expect(insert?.operatie).toBe("insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      instance_item_id: ID_1,
      employee_id: ANGAJAT,
      material_id: MATERIAL,
    });
    // Pasul îl bifează triggerul `security definer`, nu acțiunea.
    expect(server.apeluriPe("checklist_instance_items", "update")).toHaveLength(0);
    expect(caiRevalidate()).toEqual(["/onboarding", "/portal/integrarea-mea", "/portal"]);
  });

  it("pasul nu cere niciun material: CONFLICT, fără inserare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasVizibil);
    server.raspunde("checklist_instance_items", "select", { data: { material_id: null } });
    const r = await confirmaCitire({ id: ID_1 });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: "Pasul nu cere citirea niciunui material." },
    });
    expect(server.apeluriPe("checklist_material_reads")).toHaveLength(0);
  });

  it("pasul invizibil: NEGASIT înainte de orice altă citire", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", { data: null });
    const r = await confirmaCitire({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluri).toHaveLength(1);
  });

  it("23505 (a confirmat deja): succes idempotent, cu id-ul pasului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasVizibil);
    server.raspunde("checklist_instance_items", "select", { data: { material_id: MATERIAL } });
    server.raspunde("checklist_material_reads", "insert", { error: eroarePostgrest("23505") });
    const r = await confirmaCitire({ id: ID_1 });
    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
  });

  it("42501 (confirmare în numele altcuiva, refuzată de WITH CHECK): INTERZIS", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasVizibil);
    server.raspunde("checklist_instance_items", "select", { data: { material_id: MATERIAL } });
    server.raspunde("checklist_material_reads", "insert", { error: eroarePostgrest("42501") });
    const r = await confirmaCitire({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(caiRevalidate()).toEqual([]);
  });
});

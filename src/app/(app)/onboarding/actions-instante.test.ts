// src/app/(app)/onboarding/actions-instante.test.ts
//
// Acțiunile pe PARCURS (instanță) și pe pașii lui: pornirea, bifarea,
// finalizarea și anularea. Straturile comune ale lui `createAction` sunt
// verificate o singură dată, în `salarizare/actions.test.ts`; aici rămân
// pragul de permisiune, handlerul și revalidarea.

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
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { anuleazaInstanta, bifeazaPas, finalizeazaInstanta, pornesteInstanta } from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

// ── poarta de modul ──────────────────────────────────────────────────────────

describe("poarta de modul `onboarding`", () => {
  it.each([
    [
      "pornesteInstanta",
      () =>
        pornesteInstanta({ template_id: ID_1, employee_id: ID_2, data_referinta: "2026-10-05" }),
      { "checklists:create": "all" },
    ],
    ["bifeazaPas", () => bifeazaPas({ id: ID_1, status: "bifat" }), { "checklists:update": "all" }],
    [
      "finalizeazaInstanta",
      () => finalizeazaInstanta({ id: ID_1 }),
      { "checklists:approve": "all" },
    ],
    [
      "anuleazaInstanta",
      () => anuleazaInstanta({ id: ID_1, motiv_anulare: "Angajatul nu s-a mai prezentat." }),
      { "checklists:approve": "all" },
    ],
  ] as const)(
    "%s: cu modulul oprit, MODUL_DEZACTIVAT chiar și cu permisiunea la `all`",
    async (_nume, apel, permisiuni) => {
      const { server } = configureazaActiunea({ functii: [], permisiuni });
      const r = await apel();
      expect(r).toMatchObject({ ok: false, error: { code: "MODUL_DEZACTIVAT" } });
      expect(server.apeluri).toHaveLength(0);
      expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
    },
  );
});

// ── pornesteInstanta ─────────────────────────────────────────────────────────

describe("pornesteInstanta", () => {
  const PERMIS = { "checklists:create": "all" } as const;
  const intrare = {
    template_id: ID_1,
    employee_id: ID_2,
    data_referinta: "2026-10-05",
    observatii: "  Începe luni  ",
  };

  it("cere `checklists:create` la `all`: `team` nu ajunge și nu se atinge baza", async () => {
    const { server } = configureazaActiunea({
      rol: "manager",
      permisiuni: { "checklists:create": "team" },
    });
    const r = await pornesteInstanta(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("inserează instanța în organizația din sesiune și întoarce id-ul din RETURNING", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instances", "insert", { data: { id: ID_3 } });

    const r = await pornesteInstanta(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_3 } });
    const [apel, ...altele] = server.apeluriPe("checklist_instances");
    expect(altele).toHaveLength(0);
    expect(apel?.operatie).toBe("insert");
    expect(apel?.payload).toMatchObject({
      organization_id: ORG_ID,
      template_id: ID_1,
      employee_id: ID_2,
      data_referinta: "2026-10-05",
      observatii: "Începe luni",
    });
    expect(apel?.selectDupaScriere).toBe("id");
  });

  it("nu trimite câmpurile pe care le pune triggerul (status, ciclu, finalizare)", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instances", "insert", { data: { id: ID_3 } });

    await pornesteInstanta(intrare);

    const payload = server.apeluriPe("checklist_instances")[0]?.payload as Record<string, unknown>;
    for (const cheie of ["status", "ciclu", "finalizata_la", "finalizata_de", "anulata_la"]) {
      expect(payload).not.toHaveProperty(cheie);
    }
  });

  it("revalidează lista, portalul și pagina de integrare a angajatului", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instances", "insert", { data: { id: ID_3 } });
    await pornesteInstanta(intrare);
    expect(caiRevalidate()).toEqual(["/onboarding", "/portal", "/portal/integrarea-mea"]);
  });

  it("auditul de succes poartă id-ul instanței create", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instances", "insert", { data: { id: ID_3 } });
    await pornesteInstanta(intrare);
    await asteaptaDupa();
    expect(server.audituri()).toEqual([
      expect.objectContaining({
        p_status: "success",
        p_entity_type: "checklist_instance",
        p_entity_id: ID_3,
      }),
    ]);
  });

  it("23505 pe ciclul instanței: mesajul spune că parcursul e deja pornit, nu că denumirea e luată", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instances", "insert", {
      error: eroarePostgrest(
        "23505",
        "duplicate key value",
        'Key violates "checklist_instances_ciclu_uk"',
      ),
    });
    const r = await pornesteInstanta(intrare);
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Angajatul are deja un parcurs pornit pe acest șablon, în același ciclu.",
      },
    });
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 din triggerul de pregătire (șablon inactiv): textul triggerului ajunge la om", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const mesaj = "Șablonul „Integrare IT” nu este activ.";
    server.raspunde("checklist_instances", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await pornesteInstanta(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

// ── bifeazaPas ──────────────────────────────────────────────────────────────

describe("bifeazaPas", () => {
  const PERMIS = { "checklists:update": "own" } as const;

  function pasCurent(
    camp: Partial<{
      verificare_automata: string | null;
      tip_dovada: string;
      dovada_fisier_path: string | null;
    }> = {},
  ) {
    return {
      data: {
        id: ID_1,
        verificare_automata: null,
        tip_dovada: "bifa",
        dovada_fisier_path: null,
        ...camp,
      },
    };
  }

  it("fără `checklists:update` (nici măcar `own`): INTERZIS, fără nicio citire", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "checklists:update": "none" },
    });
    const r = await bifeazaPas({ id: ID_1, status: "bifat" });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes la `own`: citește pasul, apoi UPDATE pe id + organizație cu `.select()` după scriere", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasCurent());
    server.raspunde("checklist_instance_items", "update", {
      data: { id: ID_1, instance_id: ID_2 },
    });

    const r = await bifeazaPas({ id: ID_1, status: "bifat", observatii: "gata" });

    expect(r).toEqual({ ok: true, data: { id: ID_1, instance_id: ID_2 } });
    const [citire] = server.apeluriPe("checklist_instance_items", "select");
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);

    const [scriere] = server.apeluriPe("checklist_instance_items", "update");
    expect(scriere?.payload).toEqual({
      status: "bifat",
      dovada: null,
      dovada_document_id: null,
      observatii: "gata",
    });
    expect(areFiltru(scriere, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(scriere, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(scriere?.selectDupaScriere).toBeDefined();
    expect(scriere?.terminal).toBe("maybeSingle");
  });

  it("nu scrie coloanele pe care le pune triggerul (bifat_la, bifat_de, titlu, obligatoriu)", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasCurent());
    server.raspunde("checklist_instance_items", "update", {
      data: { id: ID_1, instance_id: ID_2 },
    });
    await bifeazaPas({ id: ID_1, status: "in_lucru" });
    const payload = server.apeluriPe("checklist_instance_items", "update")[0]?.payload;
    for (const cheie of ["bifat_la", "bifat_de", "bifat_automat", "titlu", "obligatoriu"]) {
      expect(payload).not.toHaveProperty(cheie);
    }
  });

  it("revalidează pagina instanței și portalul, cu id-ul instanței din RETURNING", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasCurent());
    server.raspunde("checklist_instance_items", "update", {
      data: { id: ID_1, instance_id: ID_2 },
    });
    await bifeazaPas({ id: ID_1, status: "bifat" });
    expect(caiRevalidate()).toEqual([
      `/onboarding/${ID_2}`,
      "/onboarding",
      `/portal/integrarea-mea/${ID_2}`,
      "/portal/integrarea-mea",
      "/portal",
    ]);
  });

  it("pasul invizibil sau inexistent: NEGASIT, fără nicio scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", { data: null });
    const r = await bifeazaPas({ id: ID_1, status: "bifat" });
    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(server.apeluriPe("checklist_instance_items", "update")).toHaveLength(0);
  });

  it("pasul cu verificare automată nu se bifează manual: CONFLICT, fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde(
      "checklist_instance_items",
      "select",
      pasCurent({ verificare_automata: "inventar_returnat" }),
    );
    const r = await bifeazaPas({ id: ID_1, status: "neaplicabil" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toContain("se bifează automat");
    expect(server.apeluriPe("checklist_instance_items", "update")).toHaveLength(0);
  });

  it("pas cu dovadă „document” bifat fără document: VALIDARE pe `dovada_document_id`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasCurent({ tip_dovada: "document" }));
    const r = await bifeazaPas({ id: ID_1, status: "bifat" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("dovada_document_id");
    expect(server.apeluriPe("checklist_instance_items", "update")).toHaveLength(0);
  });

  it("pas cu dovadă „document” trecut pe „în lucru” nu cere documentul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasCurent({ tip_dovada: "document" }));
    server.raspunde("checklist_instance_items", "update", {
      data: { id: ID_1, instance_id: ID_2 },
    });
    const r = await bifeazaPas({ id: ID_1, status: "in_lucru" });
    expect(r.ok).toBe(true);
  });

  it("pas cu dovadă „document” și documentul dat: se bifează, cu id-ul documentului în payload", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasCurent({ tip_dovada: "document" }));
    server.raspunde("checklist_instance_items", "update", {
      data: { id: ID_1, instance_id: ID_2 },
    });
    const r = await bifeazaPas({ id: ID_1, status: "bifat", dovada_document_id: ID_3 });
    expect(r.ok).toBe(true);
    expect(server.apeluriPe("checklist_instance_items", "update")[0]?.payload).toMatchObject({
      dovada_document_id: ID_3,
    });
  });

  it("un fișier încărcat în pas (0092) satisface dovada „document”, ca în trigger și pe ecran", async () => {
    // Triggerul din 0092 (`dovada_document_id is null and dovada_fisier_path
    // is null`) și `dovadaLipseste` din `pas-checklist.tsx` acceptă fișierul
    // urcat în pas. Pre-verificarea din handler citește doar `tip_dovada` și
    // refuză cu VALIDARE — deci după încărcare caseta nu se mai poate bifa.
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde(
      "checklist_instance_items",
      "select",
      pasCurent({
        tip_dovada: "document",
        dovada_fisier_path: `${ORG_ID}/checklists/${ID_2}/${ID_1}/x-contract.pdf`,
      }),
    );
    server.raspunde("checklist_instance_items", "update", {
      data: { id: ID_1, instance_id: ID_2 },
    });
    const r = await bifeazaPas({ id: ID_1, status: "bifat" });
    expect(r).toEqual({ ok: true, data: { id: ID_1, instance_id: ID_2 } });
  });

  it.each([
    ["absentă", undefined],
    ["doar spații", "   "],
    ["doar tab-uri și rânduri noi", "\t\n \r\n"],
  ])("pas cu semnătură, semnătura %s: VALIDARE pe `dovada`", async (_caz, dovada) => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasCurent({ tip_dovada: "semnatura" }));
    const r = await bifeazaPas({ id: ID_1, status: "bifat", dovada });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("dovada");
    expect(server.apeluriPe("checklist_instance_items", "update")).toHaveLength(0);
  });

  it("pas cu semnătură completată: se bifează și semnătura ajunge în payload", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasCurent({ tip_dovada: "semnatura" }));
    server.raspunde("checklist_instance_items", "update", {
      data: { id: ID_1, instance_id: ID_2 },
    });
    const r = await bifeazaPas({ id: ID_1, status: "bifat", dovada: "Popescu Ion" });
    expect(r.ok).toBe(true);
    expect(server.apeluriPe("checklist_instance_items", "update")[0]?.payload).toMatchObject({
      dovada: "Popescu Ion",
    });
  });

  // `.trim()` din pre-verificarea handlerului e redundant cât timp schema
  // (`textOptional` din src/schemas/comun.ts) taie spațiile și face din ""
  // un null — mutantul care-l scoate e ECHIVALENT. Testul ăsta fixează
  // premisa echivalenței: dacă schema încetează să taie, semnătura ajunge
  // în bază cu spațiile pe margini și testul pică, semnalând că `.trim()`
  // din handler a devenit singura barieră pentru „doar spații”.
  it("pas cu semnătură cu spații pe margini: semnătura ajunge în payload TĂIATĂ", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasCurent({ tip_dovada: "semnatura" }));
    server.raspunde("checklist_instance_items", "update", {
      data: { id: ID_1, instance_id: ID_2 },
    });
    const r = await bifeazaPas({ id: ID_1, status: "bifat", dovada: "  Popescu Ion \n" });
    expect(r.ok).toBe(true);
    const [apel] = server.apeluriPe("checklist_instance_items", "update");
    expect(apel?.payload).toMatchObject({ dovada: "Popescu Ion" });
  });

  it("pas fără semnătură cerută („bifa”): dovada goală nu blochează, ajunge null", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasCurent({ tip_dovada: "bifa" }));
    server.raspunde("checklist_instance_items", "update", {
      data: { id: ID_1, instance_id: ID_2 },
    });
    const r = await bifeazaPas({ id: ID_1, status: "bifat", dovada: "   " });
    expect(r.ok).toBe(true);
    const [apel] = server.apeluriPe("checklist_instance_items", "update");
    expect(apel?.payload).toMatchObject({ dovada: null });
  });

  it("UPDATE respins tăcut de RLS (zero rânduri): CONFLICT și nicio revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instance_items", "select", pasCurent());
    server.raspunde("checklist_instance_items", "update", { data: null });
    const r = await bifeazaPas({ id: ID_1, status: "bifat" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toContain("nu a putut fi actualizat");
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 „Checklistul este închis” din trigger: textul ajunge neschimbat", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const mesaj = "Checklistul este închis; pașii nu mai pot fi modificați.";
    server.raspunde("checklist_instance_items", "select", pasCurent());
    server.raspunde("checklist_instance_items", "update", {
      error: eroarePostgrest("P0001", mesaj),
    });
    const r = await bifeazaPas({ id: ID_1, status: "bifat" });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

// ── finalizeazaInstanta / anuleazaInstanta ─────────────────────────────────

describe("finalizeazaInstanta", () => {
  const PERMIS = { "checklists:approve": "team" } as const;

  it("închiderea cere `approve` la `team`: `own` nu ajunge", async () => {
    const { server } = configureazaActiunea({
      rol: "employee",
      permisiuni: { "checklists:approve": "own" },
    });
    const r = await finalizeazaInstanta({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("nici `checklists:update = all` nu deschide închiderea: cheia e `approve`", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "checklists:update": "all" } });
    const r = await finalizeazaInstanta({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: trimite DOAR statusul, pe id + organizație, cu `.select()` după scriere", async () => {
    const { server } = configureazaActiunea({ rol: "manager", permisiuni: PERMIS });
    server.raspunde("checklist_instances", "update", { data: { id: ID_1 } });

    const r = await finalizeazaInstanta({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel, ...altele] = server.apeluriPe("checklist_instances");
    expect(altele).toHaveLength(0);
    expect(apel?.operatie).toBe("update");
    expect(apel?.payload).toEqual({ status: "finalizata" });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    // Dovada o scrie triggerul AFTER, nu codul.
    expect(server.apeluriPe("checklist_completion_records")).toHaveLength(0);
  });

  it("revalidează instanța, lista și portalul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instances", "update", { data: { id: ID_1 } });
    await finalizeazaInstanta({ id: ID_1 });
    expect(caiRevalidate()).toEqual([
      `/onboarding/${ID_1}`,
      "/onboarding",
      `/portal/integrarea-mea/${ID_1}`,
      "/portal/integrarea-mea",
      "/portal",
    ]);
  });

  it("zero rânduri (instanța nu e vizibilă subordonării): CONFLICT, nu succes", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instances", "update", { data: null });
    const r = await finalizeazaInstanta({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toContain("nu a putut fi finalizat");
    expect(caiRevalidate()).toEqual([]);
  });

  it("P0001 cu bunurile nereturnate: omul află CE bun lipsește", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const mesaj =
      "Nu se poate finaliza: Popescu Ion are încă un bun nereturnat — Laptop Dell (INV-0007).";
    server.raspunde("checklist_instances", "update", { error: eroarePostgrest("P0001", mesaj) });
    const r = await finalizeazaInstanta({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });
});

describe("anuleazaInstanta", () => {
  const PERMIS = { "checklists:approve": "team" } as const;
  const intrare = { id: ID_1, motiv_anulare: "  Angajatul nu s-a mai prezentat.  " };

  it("anularea cere `approve` la `team`: `own` nu ajunge", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "checklists:approve": "own" } });
    const r = await anuleazaInstanta(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("succes: status `anulata` + motivul curățat, fără `anulata_la` (îl pune triggerul)", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instances", "update", { data: { id: ID_1 } });

    const r = await anuleazaInstanta(intrare);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("checklist_instances", "update");
    expect(apel?.payload).toEqual({
      status: "anulata",
      motiv_anulare: "Angajatul nu s-a mai prezentat.",
    });
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual([
      `/onboarding/${ID_1}`,
      "/onboarding",
      `/portal/integrarea-mea/${ID_1}`,
      "/portal/integrarea-mea",
      "/portal",
    ]);
  });

  it("motivul sub 5 caractere: VALIDARE pe `motiv_anulare`, fără scriere", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await anuleazaInstanta({ id: ID_1, motiv_anulare: " abc  " });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("motiv_anulare");
    expect(server.apeluri).toHaveLength(0);
  });

  it("zero rânduri: CONFLICT „nu a putut fi anulat”", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("checklist_instances", "update", { data: null });
    const r = await anuleazaInstanta(intrare);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(r.ok ? "" : r.error.message).toContain("nu a putut fi anulat");
  });
});

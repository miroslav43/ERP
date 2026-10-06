// src/app/(app)/pontaj/setari/actions.test.ts
//
// Setările pontajului: versiunea juridică (rând nou la fiecare salvare) și
// pontarea rapidă (un rând per firmă, citire-apoi-INSERT-sau-UPDATE).

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

import { caiRevalidate, configureazaActiunea, ID_1, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { salveazaPontareaRapida, salveazaSetariPontaj } from "./actions";

const PERMIS = { "attendance:update": "all" } as const;

const SETARI_VALIDE = {
  valabil_de_la: "2026-08-01",
  ore_pe_zi: 8,
  ore_pe_saptamana: 40,
  ore_maxime_saptamanale: 48,
  perioada_referinta_luni: 4,
  repaus_zilnic_minim_ore: 12,
  repaus_saptamanal_minim_ore: 48,
  lucreaza_noaptea: false,
  lucreaza_weekend: false,
  lucreaza_sarbatori: false,
  admite_ore_suplimentare: true,
  noapte_start: "22:00",
  noapte_sfarsit: "06:00",
  prag_ore_noapte: 3,
  termen_compensare_suplimentare_zile: 60,
  termen_compensare_sarbatoare_zile: 30,
  pauza_masa_minute: 30,
  pauza_masa_inclusa_in_program: false,
  pauza_obligatorie_peste_ore: 6,
  observatii_juridice: null,
};

const RAPIDA = {
  mod_pontare_rapida: "ceas",
  verificare_pontare: "optional",
  program_start: "",
  necesita_aprobare: true,
} as const;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("salveazaSetariPontaj", () => {
  it("scope `team` (sub `all`) ⇒ INTERZIS, nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "attendance:update": "team" } });
    const r = await salveazaSetariPontaj(SETARI_VALIDE);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("inserează o versiune NOUĂ (niciun UPDATE), cu organizația din sesiune", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("attendance_settings", "insert", { data: { id: ID_1 } });

    const r = await salveazaSetariPontaj(SETARI_VALIDE);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    expect(server.apeluriPe("attendance_settings", "update")).toHaveLength(0);
    const [apel] = server.apeluriPe("attendance_settings", "insert");
    expect(apel?.payload).toEqual({ organization_id: ORG_ID, ...SETARI_VALIDE });
    expect(apel?.selectDupaScriere).toBe("id");
    expect(caiRevalidate()).toEqual(["/pontaj", "/pontaj/setari"]);
  });

  it("caseta goală la un câmp cu minim 0 e refuzată, nu salvată ca zero", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const r = await salveazaSetariPontaj({ ...SETARI_VALIDE, repaus_zilnic_minim_ore: "" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("repaus_zilnic_minim_ore");
    expect(server.apeluri).toHaveLength(0);
  });

  it("P0001 de la bază: mesajul triggerului ajunge la om", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    const mesaj = "Versiunea nu poate începe într-o lună deja blocată.";
    server.raspunde("attendance_settings", "insert", { error: eroarePostgrest("P0001", mesaj) });
    const r = await salveazaSetariPontaj(SETARI_VALIDE);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  // `attendance_settings_valabilitate_uq` (0013:54) respinge a doua versiune
  // cu aceeași `valabil_de_la`. `traduEroare` al pontajului traduce ORICE 23505
  // în mesajul zilei de pontaj, deci omul de pe ecranul de setări citește
  // despre „o zi de pontaj pentru acest angajat”.
  it("versiunea duplicată (23505) ⇒ CONFLICT cu mesajul setărilor, nu al zilei de pontaj", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("attendance_settings", "insert", { error: eroarePostgrest("23505") });
    const r = await salveazaSetariPontaj(SETARI_VALIDE);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    if (!r.ok) expect(r.error.message).not.toMatch(/zi de pontaj|angajat/u);
  });
});

describe("salveazaPontareaRapida", () => {
  it("scope `team` (sub `all`) ⇒ INTERZIS, nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "attendance:update": "team" } });
    const r = await salveazaPontareaRapida(RAPIDA);
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
  });

  it("fără rând existent: INSERT cu organizația, după citirea pe organizație + rând neșters", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("setari_pontare_rapida", "select", { data: null });
    server.raspunde("setari_pontare_rapida", "insert", { data: { id: ID_1 } });

    const r = await salveazaPontareaRapida(RAPIDA);

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [citire] = server.apeluriPe("setari_pontare_rapida", "select");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    const [insert] = server.apeluriPe("setari_pontare_rapida", "insert");
    expect(insert?.payload).toEqual({
      organization_id: ORG_ID,
      mod_pontare_rapida: "ceas",
      verificare_pontare: "optional",
      program_start: null,
      necesita_aprobare: true,
      // 0165: un apelant care nu trimite varianta NU mută firma pe săptămână.
      varianta_pontaj: "zilnic",
    });
    expect(server.apeluriPe("setari_pontare_rapida", "update")).toHaveLength(0);
    // `optional` nu cere niciun afiș: punctele de lucru nu se numără.
    expect(server.apeluriPe("puncte_lucru")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([
      "/pontaj",
      "/pontaj/setari",
      "/pontaj/saptamana",
      "/portal",
      "/portal/ceas",
      "/portal/pontajul-meu",
      "/portal/pontajul-meu/saptamana",
    ]);
  });

  it("cu rând existent: UPDATE pe id + organizație, cu `.select()` după scriere, nu `.upsert()`", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("setari_pontare_rapida", "select", { data: { id: ID_1 } });
    server.raspunde("setari_pontare_rapida", "update", { data: { id: ID_1 } });

    const r = await salveazaPontareaRapida({ ...RAPIDA, mod_pontare_rapida: "oprit" });

    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
    const [apel] = server.apeluriPe("setari_pontare_rapida", "update");
    expect(apel?.payload).toMatchObject({ mod_pontare_rapida: "oprit" });
    expect(apel?.payload).not.toHaveProperty("organization_id");
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(apel?.selectDupaScriere).toBeDefined();
    expect(server.apeluriPe("setari_pontare_rapida", "upsert")).toHaveLength(0);
  });

  it("UPDATE cu zero rânduri ⇒ CONFLICT, fără revalidare", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("setari_pontare_rapida", "select", { data: { id: ID_1 } });
    server.raspunde("setari_pontare_rapida", "update", { data: null });
    const r = await salveazaPontareaRapida(RAPIDA);
    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("`cod_qr` fără niciun afiș activ ⇒ CONFLICT: nu oprește tăcut pontarea întregii firme", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("puncte_lucru", "select", { count: 0 });

    const r = await salveazaPontareaRapida({ ...RAPIDA, verificare_pontare: "cod_qr" });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const [numarare] = server.apeluriPe("puncte_lucru", "select");
    expect(numarare?.optiuni).toEqual({ count: "exact", head: true });
    expect(areFiltru(numarare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(numarare, "eq", "activ", true)).toBe(true);
    expect(areFiltru(numarare, "not", "cod_pontaj")).toBe(true);
    expect(areFiltru(numarare, "is", "deleted_at", null)).toBe(true);
    expect(server.apeluriPe("setari_pontare_rapida")).toHaveLength(0);
  });

  it("`cod_qr` cu cel puțin un afiș activ: se salvează", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("puncte_lucru", "select", { count: 2 });
    server.raspunde("setari_pontare_rapida", "select", { data: null });
    server.raspunde("setari_pontare_rapida", "insert", { data: { id: ID_1 } });
    const r = await salveazaPontareaRapida({ ...RAPIDA, verificare_pontare: "cod_qr" });
    expect(r).toEqual({ ok: true, data: { id: ID_1 } });
  });

  it.each(["confirmare", "ambele"] as const)(
    "modul `%s` fără ora de început a programului e refuzat la validare",
    async (mod) => {
      const { server } = configureazaActiunea({ permisiuni: PERMIS });
      const r = await salveazaPontareaRapida({ ...RAPIDA, mod_pontare_rapida: mod });
      expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
      if (!r.ok) expect(r.error.fieldErrors).toHaveProperty("program_start");
      expect(server.apeluri).toHaveLength(0);
    },
  );
});

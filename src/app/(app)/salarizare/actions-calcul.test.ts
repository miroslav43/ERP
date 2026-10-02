// src/app/(app)/salarizare/actions-calcul.test.ts
//
// `calculeazaPerioada`: adună intrările lunii, rulează motorul de calcul (REAL,
// din `src/domain/payroll/`) și scrie rezultatele atomic prin RPC.
//
// Citirile din `@/lib/queries/payroll` și `setariPontaj` sunt înlocuite cu
// spioni: fiecare are testele ei proprii (`src/lib/queries/payroll.test.ts`),
// iar aici contează ce face ACȚIUNEA cu rezultatul lor — ce blochează, ce
// trimite bazei, ce numără.

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

// Citirile de intrare ale calculului. `marginileLunii` și `PONTAJ_GOL` rămân reale.
vi.mock("@/lib/queries/payroll", async (orig) => ({
  ...(await orig<typeof import("@/lib/queries/payroll")>()),
  citesteSetariPeId: vi.fn(),
  zileLucratoareLuna: vi.fn(),
  angajatiActiviCuContract: vi.fn(),
  pontajAgregatPerioada: vi.fn(),
  scutiriActivePerioada: vi.fn(),
  componenteSalarialeActivePerioada: vi.fn(),
  istoricVenitPerAngajat: vi.fn(),
  certificateMedicaleLuna: vi.fn(),
  compensariLuna: vi.fn(),
  diurnaLunaPerAngajat: vi.fn(),
  plafoaneDiurnaLuna: vi.fn(),
  popririActive: vi.fn(),
}));
vi.mock("@/lib/queries/attendance", async (orig) => ({
  ...(await orig<typeof import("@/lib/queries/attendance")>()),
  setariPontaj: vi.fn(),
}));

import { setariPontaj, type SetariPontaj } from "@/lib/queries/attendance";
import {
  angajatiActiviCuContract,
  certificateMedicaleLuna,
  citesteSetariPeId,
  compensariLuna,
  componenteSalarialeActivePerioada,
  diurnaLunaPerAngajat,
  istoricVenitPerAngajat,
  plafoaneDiurnaLuna,
  PONTAJ_GOL,
  pontajAgregatPerioada,
  popririActive,
  scutiriActivePerioada,
  zileLucratoareLuna,
  type AngajatDeCalculat,
  type SetariSalarizare,
} from "@/lib/queries/payroll";
import { caiRevalidate, configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import { calculeazaPerioada } from "./actions";

const PERMIS = { "payroll:create": "all" } as const;
const ANGAJAT_A = "88888888-8888-4888-8888-888888888888";
const ANGAJAT_B = "99999999-9999-4999-8999-999999999999";

const SETARI: SetariSalarizare = {
  id: ID_3,
  valabil_de_la: "2026-01-01",
  cota_cas: 0.25,
  cota_cass: 0.1,
  cota_impozit: 0.1,
  cota_cam_angajator: 0.0225,
  norma_zilnica_ore: 8,
  procent_spor_noapte: 0.25,
  procent_spor_weekend: 0,
  procent_spor_sarbatoare: 1,
  casa_sanatate_angajator: "CJ",
  functie_declarant: "Administrator",
  procent_ore_suplimentare: 0.75,
  valoare_tichet_masa: 0,
  tichete_impozabile: false,
  tichete_supuse_cass: false,
  rotunjire_lei: false,
  salariu_minim_brut: 4050,
  aplica_minim_contributii: false,
  mod_calcul_indemnizatie_co: "cea_mai_avantajoasa",
  luni_medie_indemnizatie_co: 3,
  zile_avertizare_termen_compensare: 30,
  plafon_poprire_unica: 1 / 3,
  plafon_popriri_concurente: 0.5,
  verificat_de_contabil: false,
  verificat_la: null,
  note: null,
  praguri: [],
};

function angajat(
  id: string,
  salariu: number,
  extra: Partial<AngajatDeCalculat> = {},
): AngajatDeCalculat {
  return {
    employee_id: id,
    contract_id: `contract-${id.slice(0, 4)}`,
    contract_de_baza_id: `baza-${id.slice(0, 4)}`,
    full_name: `Angajat ${id.slice(0, 1)}`,
    marca: id.slice(0, 1),
    salariu_baza: salariu,
    norma_ore_zi: 8,
    norma_ore_saptamana: 40,
    nr_persoane_intretinere: 0,
    contract_schimbat_in_luna: false,
    ...extra,
  };
}

const LUNA_PLINA = { ...PONTAJ_GOL, zile_lucrate: 21, ore_lucrate: 168, ore_normale_zi: 168 };

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.mocked(citesteSetariPeId).mockReset().mockResolvedValue(SETARI);
  vi.mocked(setariPontaj).mockReset().mockResolvedValue(null);
  vi.mocked(zileLucratoareLuna).mockReset().mockResolvedValue(21);
  vi.mocked(angajatiActiviCuContract)
    .mockReset()
    .mockResolvedValue({
      angajati: [angajat(ANGAJAT_A, 5000), angajat(ANGAJAT_B, 4500)],
      faraContract: [],
      trunchiat: false,
    });
  vi.mocked(pontajAgregatPerioada)
    .mockReset()
    .mockResolvedValue({
      pePersoana: new Map([
        [ANGAJAT_A, LUNA_PLINA],
        [ANGAJAT_B, LUNA_PLINA],
      ]),
      trunchiat: false,
    });
  vi.mocked(scutiriActivePerioada).mockReset().mockResolvedValue(new Map());
  vi.mocked(componenteSalarialeActivePerioada).mockReset().mockResolvedValue(new Map());
  vi.mocked(istoricVenitPerAngajat).mockReset().mockResolvedValue(new Map());
  vi.mocked(certificateMedicaleLuna).mockReset().mockResolvedValue(new Map());
  vi.mocked(compensariLuna).mockReset().mockResolvedValue(new Map());
  vi.mocked(diurnaLunaPerAngajat).mockReset().mockResolvedValue(new Map());
  vi.mocked(plafoaneDiurnaLuna).mockReset().mockResolvedValue(null);
  vi.mocked(popririActive).mockReset().mockResolvedValue(new Map());
});

/**
 * `ctx.supabase.rpc(...).select(...).maybeSingle()` — falsul comun întoarce
 * direct o promisiune din `rpc()`. Aici i se lipesc cele două metode de lanț,
 * care întorc aceeași promisiune; răspunsul rămâne cel programat cu
 * `raspundeRpc`, iar apelul rămâne înregistrat în `apeluriRpc`.
 */
function rpcCuLant(server: ClientFals): void {
  const client = server.client as unknown as {
    rpc: (nume: string, argumente?: unknown) => Promise<unknown>;
  };
  const original = client.rpc.bind(client);
  client.rpc = (nume, argumente) => {
    const promisiune = original(nume, argumente);
    return Object.assign(promisiune, {
      select: () => promisiune,
      maybeSingle: () => promisiune,
    });
  };
}

/** Pregătește o perioadă în ciornă cu tot ce citește handlerul direct din bază. */
function pregateste(
  status = "draft",
  prime: readonly unknown[] = [],
  retineri: readonly unknown[] = [],
): ClientFals {
  const { server } = configureazaActiunea({ permisiuni: PERMIS });
  rpcCuLant(server);
  server.raspunde("payroll_periods", "select", {
    data: { id: ID_1, an: 2026, luna: 8, attendance_period_id: ID_2, settings_id: ID_3, status },
  });
  server.raspunde("payroll_bonuses", "select", { data: prime });
  server.raspunde("payroll_deductions", "select", { data: retineri });
  return server;
}

/** Mesajul pe care `mapPostgrestError` îl dă lui 57014 — distinge eroarea bazei de o cădere a falsului. */
const MESAJ_TIMEOUT = "Operațiunea a durat prea mult și a fost oprită.";

function programeazaScrierea(server: ClientFals, scrise = { inserate: 2, actualizate: 0 }): void {
  server.raspundeRpc("payroll_scrie_rezultate", { data: scrise });
  server.raspundeRpc("payroll_scrie_popriri", {});
  server.raspunde("payroll_periods", "update", { data: { id: ID_1 } });
}

type RandScris = Record<string, unknown> & {
  employee_id: string;
  brut: number;
  net: number;
  cost_total_angajator: number;
  prime_total: number;
  calc_warnings: { cod: string }[];
  settings_snapshot: Record<string, unknown>;
};

function randuriScrise(server: ClientFals): RandScris[] {
  const apel = server.apeluriRpc.find((a) => a.nume === "payroll_scrie_rezultate");
  return (apel?.argumente as { p_randuri: RandScris[] }).p_randuri;
}

describe("calculeazaPerioada — autorizare și precondiții", () => {
  it("scope `team` sub pragul `all`: INTERZIS, fără nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "payroll:create": "team" } });
    const r = await calculeazaPerioada({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(server.apeluri).toHaveLength(0);
    expect(citesteSetariPeId).not.toHaveBeenCalled();
  });

  it("perioadă inexistentă: NEGASIT, fără nicio citire de calcul", async () => {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    server.raspunde("payroll_periods", "select", { data: null });

    const r = await calculeazaPerioada({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    const [citire] = server.apeluriPe("payroll_periods");
    expect(areFiltru(citire, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(citire, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    expect(citesteSetariPeId).not.toHaveBeenCalled();
  });

  it.each(["calculat", "aprobat", "inchis"])(
    "perioadă în starea %s: CONFLICT, nimic recalculat",
    async (status) => {
      const server = pregateste(status);
      const r = await calculeazaPerioada({ id: ID_1 });
      expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
      expect(citesteSetariPeId).not.toHaveBeenCalled();
      expect(server.apeluriRpc.filter((a) => a.nume !== "log_audit_event")).toHaveLength(0);
    },
  );

  it("setările perioadei au dispărut: NEGASIT, fără citirea angajaților", async () => {
    pregateste();
    vi.mocked(citesteSetariPeId).mockResolvedValue(null);

    const r = await calculeazaPerioada({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "NEGASIT" } });
    expect(citesteSetariPeId).toHaveBeenCalledWith(ORG_ID, ID_3);
    expect(angajatiActiviCuContract).not.toHaveBeenCalled();
  });

  it.each(["angajați", "pontaj"])(
    "citire trunchiată (%s): CONFLICT, nimic scris — un stat incomplet nu trebuie să pară complet",
    async (sursa) => {
      const server = pregateste();
      if (sursa === "angajați") {
        vi.mocked(angajatiActiviCuContract).mockResolvedValue({
          angajati: [angajat(ANGAJAT_A, 5000)],
          faraContract: [],
          trunchiat: true,
        });
      } else {
        vi.mocked(pontajAgregatPerioada).mockResolvedValue({
          pePersoana: new Map(),
          trunchiat: true,
        });
      }

      const r = await calculeazaPerioada({ id: ID_1 });

      expect(r).toMatchObject({
        ok: false,
        error: { code: "CONFLICT", message: expect.stringContaining("trunchiate") },
      });
      expect(server.apeluriRpc.map((a) => a.nume)).not.toContain("payroll_scrie_rezultate");
    },
  );

  it("angajați activi fără contract: CONFLICT care îi numește pe fiecare", async () => {
    const server = pregateste();
    vi.mocked(angajatiActiviCuContract).mockResolvedValue({
      angajati: [angajat(ANGAJAT_A, 5000)],
      faraContract: [
        { employee_id: ANGAJAT_B, full_name: "Ion Pop", marca: "7" },
        { employee_id: ID_2, full_name: "", marca: "9" },
      ],
      trunchiat: false,
    });

    const r = await calculeazaPerioada({ id: ID_1 });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("CONFLICT");
    expect(r.error.message).toContain("2: Ion Pop (marca 7), (fără nume) (marca 9).");
    expect(server.apeluriRpc.map((a) => a.nume)).not.toContain("payroll_scrie_rezultate");
  });

  it("niciun angajat activ cu contract: CONFLICT", async () => {
    pregateste();
    vi.mocked(angajatiActiviCuContract).mockResolvedValue({
      angajati: [],
      faraContract: [],
      trunchiat: false,
    });

    const r = await calculeazaPerioada({ id: ID_1 });

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("Nu există niciun angajat") },
    });
  });
});

describe("calculeazaPerioada — calculul și scrierea", () => {
  it("citește intrările lunii perioadei, din organizația curentă", async () => {
    const server = pregateste();
    programeazaScrierea(server);

    await calculeazaPerioada({ id: ID_1 });

    expect(angajatiActiviCuContract).toHaveBeenCalledWith(ORG_ID, 2026, 8);
    expect(zileLucratoareLuna).toHaveBeenCalledWith(ORG_ID, 2026, 8);
    expect(pontajAgregatPerioada).toHaveBeenCalledWith(ID_2);
    expect(popririActive).toHaveBeenCalledWith(ORG_ID, 2026, 8);
    // Concediul medical cere șase luni de istoric, cel de odihnă trei: maximul.
    expect(istoricVenitPerAngajat).toHaveBeenCalledWith(ORG_ID, 2026, 8, 6);
    expect(setariPontaj).toHaveBeenCalledWith(ORG_ID, "2026-08-01");
    // Toate intrările vin din luna PERIOADEI (august), nu din alta.
    for (const citire of [
      scutiriActivePerioada,
      componenteSalarialeActivePerioada,
      certificateMedicaleLuna,
      compensariLuna,
      diurnaLunaPerAngajat,
      plafoaneDiurnaLuna,
    ]) {
      expect(citire).toHaveBeenCalledWith(ORG_ID, 2026, 8);
    }
    for (const tabela of ["payroll_bonuses", "payroll_deductions"]) {
      const [apel] = server.apeluriPe(tabela);
      expect(areFiltru(apel, "eq", "period_id", ID_1)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    }
  });

  it("istoricul cerut urmează setarea de medie CO când depășește șase luni", async () => {
    const server = pregateste();
    programeazaScrierea(server);
    vi.mocked(citesteSetariPeId).mockResolvedValue({ ...SETARI, luni_medie_indemnizatie_co: 12 });

    await calculeazaPerioada({ id: ID_1 });

    expect(istoricVenitPerAngajat).toHaveBeenCalledWith(ORG_ID, 2026, 8, 12);
  });

  it("scrie TOATE rândurile într-un singur RPC, fără organizație și perioadă în sarcina utilă", async () => {
    const server = pregateste();
    programeazaScrierea(server);

    const r = await calculeazaPerioada({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1, angajati: 2 } });
    const apeluri = server.apeluriRpc.filter((a) => a.nume === "payroll_scrie_rezultate");
    expect(apeluri).toHaveLength(1);
    expect(apeluri[0]?.argumente).toMatchObject({ p_period_id: ID_1 });
    const randuri = randuriScrise(server);
    expect(randuri.map((x) => x.employee_id)).toEqual([ANGAJAT_A, ANGAJAT_B]);
    for (const rand of randuri) {
      expect(rand).not.toHaveProperty("organization_id");
      expect(rand).not.toHaveProperty("period_id");
      // Cheie obligatorie în `payroll_scrie_rezultate` de la 0126.
      expect(rand).toHaveProperty("zile_fara_plata", 0);
      expect(rand).toMatchObject({ status: "calculat", zile_lucratoare_luna: 21 });
      expect(rand.brut).toBeGreaterThan(0);
    }
    expect(randuri[0]).toMatchObject({ contract_id: `contract-${ANGAJAT_A.slice(0, 4)}` });
  });

  it("perioada trece în `calculat` cu totalurile EXACT din rândurile scrise, cu `.select()`", async () => {
    const server = pregateste();
    programeazaScrierea(server);

    await calculeazaPerioada({ id: ID_1 });

    const randuri = randuriScrise(server);
    const suma = (cheie: "brut" | "net" | "cost_total_angajator") =>
      randuri.reduce((s, x) => s + x[cheie], 0);
    const [update] = server.apeluriPe("payroll_periods", "update");
    expect(update?.payload).toEqual({
      status: "calculat",
      total_brut: suma("brut"),
      total_net: suma("net"),
      total_cost_angajator: suma("cost_total_angajator"),
    });
    expect(areFiltru(update, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(update, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(update?.selectDupaScriere).toBeDefined();
    expect(caiRevalidate()).toEqual(["/salarizare", "/panou"]);
  });

  it("primele perioadei și sporurile de pe fișă ajung la angajatul lor", async () => {
    const server = pregateste("draft", [
      { employee_id: ANGAJAT_A, suma: 1000, impozabil: true, supus_contributii: true },
    ]);
    programeazaScrierea(server);
    vi.mocked(componenteSalarialeActivePerioada).mockResolvedValue(
      new Map([
        [
          ANGAJAT_B,
          [
            {
              kind: "spor_procent",
              procent: 10,
              suma: null,
              impozabil: true,
              supusContributii: true,
              intraInBazaCas: true,
              intraInBazaCass: true,
            },
          ],
        ],
      ]),
    );

    await calculeazaPerioada({ id: ID_1 });

    const [a, b] = randuriScrise(server);
    expect(a?.prime_total).toBe(1000);
    // 10% din salariul de bază de 4500 — sporul nu se reintroduce manual.
    expect(b?.prime_total).toBe(450);
  });

  it("instantaneul setărilor: pragul de noapte implicit 3 fără setări de pontaj", async () => {
    const server = pregateste();
    programeazaScrierea(server);

    await calculeazaPerioada({ id: ID_1 });

    const [a] = randuriScrise(server);
    expect(a?.settings_snapshot).toMatchObject({ pragOreNoapte: 3, cotaCas: 0.25 });
    expect(a?.settings_snapshot).not.toHaveProperty("feluriDeMunca");
  });

  it("instantaneul setărilor preia pragul și felurile de muncă din setările de pontaj", async () => {
    const server = pregateste();
    programeazaScrierea(server);
    vi.mocked(setariPontaj).mockResolvedValue({
      prag_ore_noapte: 5,
      lucreaza_noaptea: true,
      lucreaza_weekend: false,
      lucreaza_sarbatori: false,
      admite_ore_suplimentare: true,
    } as SetariPontaj);

    await calculeazaPerioada({ id: ID_1 });

    const [a] = randuriScrise(server);
    expect(a?.settings_snapshot).toMatchObject({
      pragOreNoapte: 5,
      feluriDeMunca: { noaptea: true, weekend: false, sarbatori: false, oreSuplimentare: true },
    });
  });

  it("contract schimbat în lună: avertisment pe fluturașul acelui angajat, nu și pe al celorlalți", async () => {
    const server = pregateste();
    programeazaScrierea(server);
    vi.mocked(angajatiActiviCuContract).mockResolvedValue({
      angajati: [
        angajat(ANGAJAT_A, 5000, { contract_schimbat_in_luna: true }),
        angajat(ANGAJAT_B, 4500),
      ],
      faraContract: [],
      trunchiat: false,
    });

    await calculeazaPerioada({ id: ID_1 });

    const [a, b] = randuriScrise(server);
    const coduri = (x: RandScris | undefined) => (x?.calc_warnings ?? []).map((w) => w.cod);
    expect(coduri(a)).toContain("SAL_CONTRACT_SCHIMBAT_IN_LUNA");
    expect(coduri(b)).not.toContain("SAL_CONTRACT_SCHIMBAT_IN_LUNA");
  });

  it("poprirea reținută se înregistrează pe dosar, cu numărul dosarului în motiv", async () => {
    const server = pregateste();
    programeazaScrierea(server);
    vi.mocked(popririActive).mockResolvedValue(
      new Map([
        [
          ANGAJAT_A,
          [
            {
              id: ID_3,
              sumaLunara: 500,
              soldRamas: 3000,
              esteIntretinere: false,
              prioritate: 1,
              dosar: "55/2026",
            },
          ],
        ],
      ]),
    );

    await calculeazaPerioada({ id: ID_1 });

    const apel = server.apeluriRpc.find((a) => a.nume === "payroll_scrie_popriri");
    expect(apel?.argumente).toEqual({
      p_period_id: ID_1,
      p_randuri: [
        {
          employee_id: ANGAJAT_A,
          garnishment_id: ID_3,
          suma: 500,
          motiv: "Poprire — dosar 55/2026",
        },
      ],
    });
  });

  it("eșecul înregistrării popririlor nu anulează un stat de plată deja scris", async () => {
    const server = pregateste();
    server.raspundeRpc("payroll_scrie_rezultate", { data: { inserate: 0, actualizate: 2 } });
    server.raspundeRpc("payroll_scrie_popriri", { error: eroarePostgrest("P0001", "ciornă") });
    server.raspunde("payroll_periods", "update", { data: { id: ID_1 } });

    const r = await calculeazaPerioada({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: { id: ID_1, angajati: 2 } });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("reținerile de poprire"),
      expect.objectContaining({ periodId: ID_1 }),
    );
  });

  it("RPC fără rând întors: CONFLICT, iar perioada NU trece în `calculat`", async () => {
    const server = pregateste();
    server.raspundeRpc("payroll_scrie_rezultate", { data: null });

    const r = await calculeazaPerioada({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(server.apeluriPe("payroll_periods", "update")).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("baza a acceptat mai puține rânduri decât s-au calculat: CONFLICT cu ambele cifre", async () => {
    const server = pregateste();
    server.raspundeRpc("payroll_scrie_rezultate", { data: { inserate: 1, actualizate: 0 } });

    const r = await calculeazaPerioada({ id: ID_1 });

    expect(r).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        message: expect.stringContaining("S-au calculat 2 rânduri, dar baza a acceptat doar 1"),
      },
    });
    expect(server.apeluriPe("payroll_periods", "update")).toHaveLength(0);
  });

  it("P0001 din RPC (ex. pontaj neblocat): mesajul bazei ajunge la utilizator", async () => {
    const server = pregateste();
    const mesaj = "Pontajul lunii 8/2026 nu este blocat.";
    server.raspundeRpc("payroll_scrie_rezultate", { error: eroarePostgrest("P0001", mesaj) });

    const r = await calculeazaPerioada({ id: ID_1 });

    expect(r).toMatchObject({ ok: false, error: { code: "CONFLICT", message: mesaj } });
  });

  it("rândurile scrise, dar perioada nu trece în `calculat` (zero rânduri): CONFLICT", async () => {
    const server = pregateste();
    server.raspundeRpc("payroll_scrie_rezultate", { data: { inserate: 2, actualizate: 0 } });
    server.raspundeRpc("payroll_scrie_popriri", {});
    server.raspunde("payroll_periods", "update", { data: null });

    const r = await calculeazaPerioada({ id: ID_1 });

    expect(r).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", message: expect.stringContaining("starea calculat") },
    });
    expect(caiRevalidate()).toEqual([]);
  });
});

/** Valoarea numerică a unei coloane scrise, pentru angajatul dat. */
function camp(server: ClientFals, angajatId: string, coloana: string): number {
  const rand = randuriScrise(server).find((x) => x.employee_id === angajatId);
  return rand?.[coloana] as number;
}

describe("calculeazaPerioada — intrările lunii ajung în statul de plată", () => {
  it("scutirea fiscală activă anulează impozitul angajatului ei, nu și al celorlalți", async () => {
    const server = pregateste();
    programeazaScrierea(server);
    vi.mocked(scutiriActivePerioada).mockResolvedValue(
      new Map([[ANGAJAT_A, [{ procentScutire: 1, plafonLunar: null }]]]),
    );

    await calculeazaPerioada({ id: ID_1 });

    expect(camp(server, ANGAJAT_A, "scutire_fiscala")).toBeGreaterThan(0);
    expect(camp(server, ANGAJAT_A, "impozit")).toBe(0);
    expect(camp(server, ANGAJAT_B, "scutire_fiscala")).toBe(0);
    expect(camp(server, ANGAJAT_B, "impozit")).toBeGreaterThan(0);
  });

  it("reținerile perioadei (fără dosar de poprire) scad din netul angajatului lor", async () => {
    const server = pregateste(
      "draft",
      [],
      [
        {
          employee_id: ANGAJAT_A,
          tip: "avans",
          suma: 300,
          procent_maxim_din_net: null,
          motiv: "Avans chenzină",
        },
      ],
    );
    programeazaScrierea(server);

    await calculeazaPerioada({ id: ID_1 });

    expect(camp(server, ANGAJAT_A, "retineri_total")).toBe(300);
    expect(camp(server, ANGAJAT_A, "net_de_plata")).toBeCloseTo(
      camp(server, ANGAJAT_A, "net") - 300,
      2,
    );
    expect(camp(server, ANGAJAT_B, "retineri_total")).toBe(0);
  });

  it("cu dosar de poprire, reținerile perioadei intră în calcul alături de poprire", async () => {
    const server = pregateste(
      "draft",
      [],
      [
        {
          employee_id: ANGAJAT_A,
          tip: "avans",
          suma: 300,
          procent_maxim_din_net: null,
          motiv: "Avans chenzină",
        },
      ],
    );
    programeazaScrierea(server);
    vi.mocked(popririActive).mockResolvedValue(
      new Map([
        [
          ANGAJAT_A,
          [
            {
              id: ID_3,
              sumaLunara: 500,
              soldRamas: 3000,
              esteIntretinere: false,
              prioritate: 1,
              dosar: "55/2026",
            },
          ],
        ],
      ]),
    );

    await calculeazaPerioada({ id: ID_1 });

    // 500 poprire + 300 avans; netul de 2925 lei le acoperă pe amândouă.
    expect(camp(server, ANGAJAT_A, "retineri_total")).toBe(800);
  });

  it("diurna peste plafonul zilnic se împarte în neimpozabilă și impozabilă, doar la angajatul ei", async () => {
    const server = pregateste();
    programeazaScrierea(server);
    vi.mocked(plafoaneDiurnaLuna).mockResolvedValue({
      multiplicatorPlafonZilnic: 2.5,
      fractiePlafonLunar: 3,
    });
    vi.mocked(diurnaLunaPerAngajat).mockResolvedValue(
      new Map([
        [
          ANGAJAT_A,
          {
            // Citirea dă plafonul DEPLASĂRII (deja × 2,5) — vezi `diurnaLunaPerAngajat`.
            zile: [{ data: "2026-08-10", sumaAcordata: 400, baremLegalZi: 250, deplasareId: "t1" }],
            neimpozabilaCalculata: 250,
            impozabilaCalculata: 150,
            cursIncomplet: false,
          },
        ],
      ]),
    );

    await calculeazaPerioada({ id: ID_1 });

    // Plafonul deplasării, 250 lei, rămâne neimpozabil exact (250 / 2,5 × 2,5);
    // restul de 150, impozabil. Până la 2 oct 2026 multiplicatorul se aplica de
    // DOUĂ ori: un test cu „baremul” 250 dădea 400 neimpozabili.
    expect(camp(server, ANGAJAT_A, "diurna_neimpozabila")).toBe(250);
    expect(camp(server, ANGAJAT_A, "diurna_impozabila")).toBe(150);
    expect(camp(server, ANGAJAT_B, "diurna_neimpozabila")).toBe(0);
    expect(camp(server, ANGAJAT_B, "diurna_impozabila")).toBe(0);
  });

  it("fără politică de diurnă (plafoane null) diurna nu intră în calcul — nici ca neimpozabilă", async () => {
    const server = pregateste();
    programeazaScrierea(server);
    vi.mocked(diurnaLunaPerAngajat).mockResolvedValue(
      new Map([
        [
          ANGAJAT_A,
          {
            zile: [{ data: "2026-08-10", sumaAcordata: 400, baremLegalZi: 100, deplasareId: "t1" }],
            neimpozabilaCalculata: 250,
            impozabilaCalculata: 150,
            cursIncomplet: false,
          },
        ],
      ]),
    );

    await calculeazaPerioada({ id: ID_1 });

    expect(camp(server, ANGAJAT_A, "diurna_neimpozabila")).toBe(0);
    expect(camp(server, ANGAJAT_A, "diurna_impozabila")).toBe(0);
  });

  it("certificatul medical se plătește din istoricul de venit al angajatului; fără istoric, zero", async () => {
    const server = pregateste();
    programeazaScrierea(server);
    const cuCm = { ...LUNA_PLINA, zile_lucrate: 16, zile_concediu_medical: 5 };
    vi.mocked(pontajAgregatPerioada).mockResolvedValue({
      pePersoana: new Map([
        [ANGAJAT_A, cuCm],
        [ANGAJAT_B, cuCm],
      ]),
      trunchiat: false,
    });
    const certificat = {
      serie: "CCMAM",
      numar: "1",
      dataInceput: "2026-08-03",
      dataSfarsit: "2026-08-07",
      zileCalendaristice: 5,
      zileLucratoare: 5,
      esteContinuare: false,
      cod: {
        cod: "01",
        procent: 0.75,
        zileAngajator: 5,
        platitor: "mixt" as const,
        luniBazaCalcul: 6,
        plafonSalariiMinime: 12,
        retineCas: true,
        retineImpozit: true,
        retineCass: false,
      },
    };
    vi.mocked(certificateMedicaleLuna).mockResolvedValue(
      new Map([
        [ANGAJAT_A, { certificate: [certificat], zileAngajatorDejaConsumate: 0 }],
        [ANGAJAT_B, { certificate: [certificat], zileAngajatorDejaConsumate: 0 }],
      ]),
    );
    vi.mocked(istoricVenitPerAngajat).mockResolvedValue(
      new Map([
        [
          ANGAJAT_A,
          Array.from({ length: 6 }, (_, i) => ({
            an: 2026,
            luna: 7 - i,
            venitBrut: 5250,
            drepturiSalariale: 5250,
            zileLucrate: 21,
          })),
        ],
      ]),
    );

    await calculeazaPerioada({ id: ID_1 });

    // Media zilnică: 5250 / 21 = 250 lei; firma plătește primele 5 zile la 75%.
    expect(camp(server, ANGAJAT_A, "baza_zilnica_cm")).toBe(250);
    expect(camp(server, ANGAJAT_A, "indemnizatie_cm_angajator")).toBeGreaterThan(0);
    // Același certificat, fără nicio lună de istoric: nu există bază de calcul.
    expect(camp(server, ANGAJAT_B, "indemnizatie_cm_angajator")).toBe(0);
  });

  it("indemnizația de CO „cea mai avantajoasă” folosește media din istoricul angajatului", async () => {
    const server = pregateste();
    programeazaScrierea(server);
    vi.mocked(angajatiActiviCuContract).mockResolvedValue({
      angajati: [angajat(ANGAJAT_A, 5000), angajat(ANGAJAT_B, 5000)],
      faraContract: [],
      trunchiat: false,
    });
    const cuCo = { ...LUNA_PLINA, zile_lucrate: 16, zile_concediu_odihna: 5 };
    vi.mocked(pontajAgregatPerioada).mockResolvedValue({
      pePersoana: new Map([
        [ANGAJAT_A, cuCo],
        [ANGAJAT_B, cuCo],
      ]),
      trunchiat: false,
    });
    vi.mocked(istoricVenitPerAngajat).mockResolvedValue(
      new Map([
        [
          ANGAJAT_A,
          Array.from({ length: 3 }, (_, i) => ({
            an: 2026,
            luna: 7 - i,
            venitBrut: 8400,
            drepturiSalariale: 8400,
            zileLucrate: 21,
          })),
        ],
      ]),
    );

    await calculeazaPerioada({ id: ID_1 });

    // A: media 8400 / 21 = 400 lei pe zi, peste rata bazei (5000 / 21).
    expect(camp(server, ANGAJAT_A, "indemnizatie_co")).toBe(2000);
    // B, același salariu, fără istoric: rata salariului de bază.
    expect(camp(server, ANGAJAT_B, "indemnizatie_co")).toBeCloseTo((5000 / 21) * 5, 2);
  });
});

describe("calculeazaPerioada — eroare la citirea primelor sau reținerilor", () => {
  function pregatestePerioada(): ClientFals {
    const { server } = configureazaActiunea({ permisiuni: PERMIS });
    rpcCuLant(server);
    server.raspunde("payroll_periods", "select", {
      data: {
        id: ID_1,
        an: 2026,
        luna: 8,
        attendance_period_id: ID_2,
        settings_id: ID_3,
        status: "draft",
      },
    });
    return server;
  }

  it("eroare pe primele perioadei: oprire, nimic scris — un stat fără prime nu trebuie să plece", async () => {
    const server = pregatestePerioada();
    server.raspunde("payroll_bonuses", "select", { error: eroarePostgrest("57014") });

    const r = await calculeazaPerioada({ id: ID_1 });

    expect(r).toMatchObject({
      ok: false,
      error: { code: "EROARE_INTERNA", message: MESAJ_TIMEOUT },
    });
    expect(server.apeluriRpc.map((a) => a.nume)).not.toContain("payroll_scrie_rezultate");
    expect(server.apeluriPe("payroll_periods", "update")).toHaveLength(0);
  });

  it("eroare pe reținerile perioadei: oprire, nimic scris", async () => {
    const server = pregatestePerioada();
    server.raspunde("payroll_bonuses", "select", { data: [] });
    server.raspunde("payroll_deductions", "select", { error: eroarePostgrest("57014") });

    const r = await calculeazaPerioada({ id: ID_1 });

    expect(r).toMatchObject({
      ok: false,
      error: { code: "EROARE_INTERNA", message: MESAJ_TIMEOUT },
    });
    expect(server.apeluriRpc.map((a) => a.nume)).not.toContain("payroll_scrie_rezultate");
    expect(server.apeluriPe("payroll_periods", "update")).toHaveLength(0);
  });
});

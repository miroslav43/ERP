// src/app/(app)/concedii/suspendare-contract.test.ts
//
// `PROGRESS.md` numește lipsa testelor pe `src/app/**/actions.ts` blocajul #3:
// „fiecare defect real a scăpat exact de aici". Modulul ăsta e o bucată de
// acțiune, deci intră sub aceeași lipsă — cu diferența că are o formă
// testabilă: primește clientul ca argument, în loc să și-l construiască singur.
//
// Se verifică exact ce nu se vede la citire: că funcția NU aruncă niciodată
// (aprobarea e deja dată când ajunge aici), că ziua reluării e ziua de DUPĂ
// ultima zi de concediu, și că fiecare eșec iese cu un motiv pe care omul de
// la ecran îl poate urma.
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminSupabase } from "@/lib/supabase/admin";

import { declaraSuspendareaContractului } from "./suspendare-contract";

const genereazaEvenimenteReges = vi.hoisted(() => vi.fn());
vi.mock("@/lib/reges/genereaza-evenimente", () => ({ genereazaEvenimenteReges }));

const ORG = "11111111-1111-4111-8111-111111111111";
const CERERE = "22222222-2222-4222-8222-222222222222";
const ANGAJAT = "33333333-3333-4333-8333-333333333333";
const CONTRACT = "44444444-4444-4444-8444-444444444444";
const UTILIZATOR = "55555555-5555-4555-8555-555555555555";

interface EroarePostgrest {
  readonly code: string;
  readonly message: string;
}

interface ConfigClientFals {
  /** Rândul cererii; `null` ⇒ tipul lipsește (șters logic între timp). */
  readonly tip?: {
    denumire: string;
    suspenda_contract: boolean;
    temei_legal: string | null;
  } | null;
  readonly dataInceput?: string;
  readonly dataSfarsit?: string;
  /** `null` ⇒ angajatul n-are niciun contract activ. */
  readonly contract?: { id: string; data_contract: string } | null;
  /** Eroarea cu care răspunde INSERT-ul în `contract_suspendari`. */
  readonly eroareInserare?: EroarePostgrest | null;
  /** Eroarea cu care răspunde citirea cererii. */
  readonly eroareCerere?: EroarePostgrest | null;
}

interface ClientFals {
  readonly db: AdminSupabase;
  readonly inserari: Record<string, unknown>[];
}

/**
 * Client fals: expune doar lanțurile pe care le folosește funcția testată.
 * Fiecare verigă se întoarce pe sine, iar terminalul (`single`, `maybeSingle`)
 * dă rândul configurat — exact forma cu care răspunde supabase-js.
 */
function clientFals(config: ConfigClientFals = {}): ClientFals {
  const inserari: Record<string, unknown>[] = [];

  const rezultatCerere = {
    data: {
      employee_id: ANGAJAT,
      data_inceput: config.dataInceput ?? "2026-03-02",
      data_sfarsit: config.dataSfarsit ?? "2026-03-10",
      tip:
        config.tip === undefined
          ? { denumire: "Concediu fără plată", suspenda_contract: true, temei_legal: null }
          : config.tip,
    },
    error: config.eroareCerere ?? null,
  };
  const rezultatContract = {
    data:
      config.contract === undefined
        ? { id: CONTRACT, data_contract: "2020-01-15" }
        : config.contract,
    error: null,
  };

  function lant(rezultat: unknown): Record<string, unknown> {
    const veriga: Record<string, unknown> = {};
    for (const nume of ["select", "eq", "is", "order", "limit"]) {
      veriga[nume] = () => veriga;
    }
    veriga.single = () => Promise.resolve(rezultat);
    veriga.maybeSingle = () => Promise.resolve(rezultat);
    return veriga;
  }

  const db = {
    from(tabela: string) {
      if (tabela === "contract_suspendari") {
        return {
          insert: (rand: Record<string, unknown>) => {
            inserari.push(rand);
            return Promise.resolve({ error: config.eroareInserare ?? null });
          },
        };
      }
      return lant(tabela === "leave_requests" ? rezultatCerere : rezultatContract);
    },
  };

  return { db: db as unknown as AdminSupabase, inserari };
}

describe("declaraSuspendareaContractului", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    genereazaEvenimenteReges.mockResolvedValue({ create: 2, sarite: 0, respinse: [] });
  });

  it("nu face nimic pentru un tip care nu suspendă contractul", async () => {
    const { db, inserari } = clientFals({
      tip: { denumire: "Concediu de odihnă", suspenda_contract: false, temei_legal: null },
    });

    const rezultat = await declaraSuspendareaContractului(db, ORG, CERERE, UTILIZATOR, "req");

    expect(rezultat.ceruta).toBe(false);
    expect(inserari).toHaveLength(0);
    expect(genereazaEvenimenteReges).not.toHaveBeenCalled();
  });

  it("nu inventează o obligație când tipul a fost șters logic între timp", async () => {
    const { db, inserari } = clientFals({ tip: null });

    const rezultat = await declaraSuspendareaContractului(db, ORG, CERERE, UTILIZATOR, "req");

    expect(rezultat.ceruta).toBe(false);
    expect(inserari).toHaveLength(0);
  });

  it("scrie suspendarea și pregătește ambele evenimente", async () => {
    const { db, inserari } = clientFals({
      dataInceput: "2026-03-02",
      dataSfarsit: "2026-03-10",
    });

    const rezultat = await declaraSuspendareaContractului(db, ORG, CERERE, UTILIZATOR, "req");

    expect(rezultat).toMatchObject({ ceruta: true, declarata: true, motiv: null });
    expect(inserari).toHaveLength(1);
    expect(inserari[0]).toMatchObject({
      organization_id: ORG,
      contract_id: CONTRACT,
      employee_id: ANGAJAT,
      data_inceput: "2026-03-02",
      data_sfarsit: "2026-03-10",
      stare: "activa",
    });

    const evenimente = genereazaEvenimenteReges.mock.calls[0]?.[0].evenimente as readonly {
      tip: string;
      dataEvenimentului: string;
    }[];
    expect(evenimente.map((e) => [e.tip, e.dataEvenimentului])).toStrictEqual([
      ["suspendare", "2026-03-02"],
      // Ziua de DUPĂ ultima zi de concediu: pe 10 omul încă lipsește.
      ["reluare_activitate", "2026-03-11"],
    ]);
  });

  it("dă termenul ca ziua anterioară începerii, inclusiv peste hotar de lună", async () => {
    const { db } = clientFals({ dataInceput: "2026-04-01", dataSfarsit: "2026-04-30" });

    const rezultat = await declaraSuspendareaContractului(db, ORG, CERERE, UTILIZATOR, "req");

    expect(rezultat.termen).toBe("2026-03-31");
  });

  it("cere completarea contractului când angajatul n-are unul activ", async () => {
    const { db, inserari } = clientFals({ contract: null });

    const rezultat = await declaraSuspendareaContractului(db, ORG, CERERE, UTILIZATOR, "req");

    expect(rezultat).toMatchObject({ ceruta: true, declarata: false });
    expect(rezultat.motiv).toContain("contract activ");
    expect(inserari).toHaveLength(0);
    expect(genereazaEvenimenteReges).not.toHaveBeenCalled();
  });

  it("trimite spre REGES când există deja o suspendare care se suprapune", async () => {
    const { db } = clientFals({
      eroareInserare: { code: "23P01", message: "exclusion violation" },
    });

    const rezultat = await declaraSuspendareaContractului(db, ORG, CERERE, UTILIZATOR, "req");

    expect(rezultat).toMatchObject({ ceruta: true, declarata: false });
    expect(rezultat.motiv).toContain("suspendare activă");
    expect(genereazaEvenimenteReges).not.toHaveBeenCalled();
  });

  it("nu aruncă niciodată: o citire căzută iese ca motiv, nu ca excepție", async () => {
    const { db } = clientFals({
      eroareCerere: { code: "08006", message: "connection failure" },
    });

    const rezultat = await declaraSuspendareaContractului(db, ORG, CERERE, UTILIZATOR, "req");

    expect(rezultat).toMatchObject({ ceruta: true, declarata: false });
    expect(rezultat.motiv).toContain("modulul REGES");
  });

  it("spune că declarația a rămas nepregătită când termenul REGES lipsește", async () => {
    genereazaEvenimenteReges.mockResolvedValue({
      create: 0,
      sarite: 0,
      respinse: [{ employeeId: ANGAJAT, tip: "suspendare", motiv: "Nu există un termen." }],
    });
    const { db, inserari } = clientFals();

    const rezultat = await declaraSuspendareaContractului(db, ORG, CERERE, UTILIZATOR, "req");

    expect(rezultat).toMatchObject({ ceruta: true, declarata: false });
    expect(rezultat.motiv).toContain("Nu există un termen.");
    // Rândul rămâne: el e adevărul intern, indiferent ce s-a putut declara.
    expect(inserari).toHaveLength(1);
  });
});

// src/lib/queries/maintenance-rapoarte.test.ts
//
// Citirile raportului de mentenanță (M8): paginate keyset pe `id`, cu plafon
// și `trunchiat` (cazul 45 — `max_rows = 1000` taie tăcut), filtrate pe
// organizație și pe `deleted_at`, cu perioada în ziua României.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import {
  PLAFON_RAPORT,
  echipamentePentruRaport,
  executiiPlanuriPanaLa,
  interventiiInPerioada,
  momentInceputZi,
  opririInPerioada,
  planuriPentruRaport,
  sesizariInPerioada,
} from "./maintenance-rapoarte";

const P = { deLa: "2026-09-01", panaLa: "2026-09-30" } as const;

const pagina = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${String(i).padStart(4, "0")}` }));

describe("momentInceputZi", () => {
  it("miezul nopții României, fără milisecunde (vara UTC+3, iarna UTC+2)", () => {
    expect(momentInceputZi("2026-09-01")).toBe("2026-08-31T21:00:00Z");
    expect(momentInceputZi("2026-12-01")).toBe("2026-11-30T22:00:00Z");
  });
});

describe("interventiiInPerioada", () => {
  it("o pagină incompletă: filtrele pe organizație, ștergere și dată, ordonat pe id", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("maintenance_interventions", "select", { data: pagina("a", 3) });

    const r = await interventiiInPerioada(ORG_ID, P);

    expect(r.randuri).toHaveLength(3);
    expect(r.trunchiat).toBe(false);
    const [apel] = server.apeluriPe("maintenance_interventions");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "gte", "data", "2026-09-01")).toBe(true);
    expect(areFiltru(apel, "lte", "data", "2026-09-30")).toBe(true);
    expect(areFiltru(apel, "order", "id", { ascending: true })).toBe(true);
    expect(apel?.filtre.some((f) => f.metoda === "limit" && f.argumente[0] === 1000)).toBe(true);
  });

  it("a doua pagină continuă după ultimul id al primei", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("maintenance_interventions", "select", { data: pagina("a", 1000) });
    server.raspunde("maintenance_interventions", "select", { data: pagina("b", 2) });

    const r = await interventiiInPerioada(ORG_ID, P);

    expect(r.randuri).toHaveLength(1002);
    expect(r.trunchiat).toBe(false);
    const [prima, aDoua] = server.apeluriPe("maintenance_interventions");
    expect(prima?.filtre.some((f) => f.metoda === "gt")).toBe(false);
    expect(areFiltru(aDoua, "gt", "id", "a-0999")).toBe(true);
  });

  it("peste plafon: se oprește la plafon și spune `trunchiat`; ultima pagină cere un singur rând", async () => {
    const { server } = configureazaActiunea();
    const pagini = PLAFON_RAPORT / 1000;
    for (let p = 0; p < pagini; p += 1) {
      server.raspunde("maintenance_interventions", "select", {
        data: pagina(`p${String(p)}`, 1000),
      });
    }
    server.raspunde("maintenance_interventions", "select", { data: pagina("z", 1) });

    const r = await interventiiInPerioada(ORG_ID, P);

    expect(r.trunchiat).toBe(true);
    expect(r.randuri).toHaveLength(PLAFON_RAPORT);
    const apeluri = server.apeluriPe("maintenance_interventions");
    expect(apeluri).toHaveLength(pagini + 1);
    expect(apeluri.at(-1)?.filtre.some((f) => f.metoda === "limit" && f.argumente[0] === 1)).toBe(
      true,
    );
  });

  it("exact la plafon, fără rândul în plus: nu e trunchiat", async () => {
    const { server } = configureazaActiunea();
    for (let p = 0; p < PLAFON_RAPORT / 1000; p += 1) {
      server.raspunde("maintenance_interventions", "select", {
        data: pagina(`p${String(p)}`, 1000),
      });
    }
    server.raspunde("maintenance_interventions", "select", { data: [] });

    const r = await interventiiInPerioada(ORG_ID, P);

    expect(r.trunchiat).toBe(false);
    expect(r.randuri).toHaveLength(PLAFON_RAPORT);
  });

  it("eroarea bazei se propagă, nu devine un raport gol", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("maintenance_interventions", "select", {
      error: eroarePostgrest("42501", "permission denied"),
    });
    await expect(interventiiInPerioada(ORG_ID, P)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("executiiPlanuriPanaLa", () => {
  it("doar execuțiile reușite ale planurilor, până la capătul perioadei", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("maintenance_interventions", "select", { data: [] });

    await executiiPlanuriPanaLa(ORG_ID, "2026-09-30");

    const [apel] = server.apeluriPe("maintenance_interventions");
    expect(
      apel?.filtre.some(
        (f) => f.metoda === "not" && JSON.stringify(f.argumente) === '["plan_id","is",null]',
      ),
    ).toBe(true);
    expect(areFiltru(apel, "eq", "rezultat", "reusita")).toBe(true);
    expect(areFiltru(apel, "lte", "data", "2026-09-30")).toBe(true);
    expect(apel?.filtre.some((f) => f.metoda === "gte")).toBe(false);
  });
});

describe("sesizariInPerioada și opririInPerioada", () => {
  it("sesizările: raportate de la miezul nopții României până la miezul nopții de după capăt", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("fault_reports", "select", { data: [] });

    await sesizariInPerioada(ORG_ID, P);

    const [apel] = server.apeluriPe("fault_reports");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "gte", "raportat_la", "2026-08-31T21:00:00Z")).toBe(true);
    expect(areFiltru(apel, "lt", "raportat_la", "2026-09-30T21:00:00Z")).toBe(true);
  });

  it("opririle: suprapunere — încep înainte de capăt, deschise sau terminate după început", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("equipment_opriri", "select", { data: [] });

    await opririInPerioada(ORG_ID, P);

    const [apel] = server.apeluriPe("equipment_opriri");
    expect(areFiltru(apel, "lt", "inceput", "2026-09-30T21:00:00Z")).toBe(true);
    expect(areFiltru(apel, "or", "sfarsit.is.null,sfarsit.gte.2026-08-31T21:00:00Z")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });
});

describe("parcul și planurile", () => {
  it("echipamentele și planurile neșterse ale organizației", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("equipment", "select", { data: pagina("e", 2) });
    server.raspunde("maintenance_plans", "select", { data: pagina("p", 1) });

    const [e, p] = await Promise.all([
      echipamentePentruRaport(ORG_ID),
      planuriPentruRaport(ORG_ID),
    ]);

    expect(e.randuri).toHaveLength(2);
    expect(p.randuri).toHaveLength(1);
    for (const tabela of ["equipment", "maintenance_plans"]) {
      const [apel] = server.apeluriPe(tabela);
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    }
    // Planurile inactive intră: execuțiile lor se judecă și ele.
    const [apelPlanuri] = server.apeluriPe("maintenance_plans");
    expect(apelPlanuri?.filtre.some((f) => f.metoda === "eq" && f.argumente[0] === "activ")).toBe(
      false,
    );
    // Revizia M8: grila planului `fix` și amânarea în curs intră în calcul.
    for (const coloana of ["mod_calcul", "data_ancora", "amanat_pana"]) {
      expect(apelPlanuri?.coloane).toContain(coloana);
    }
  });

  // Y1 (0232): valoarea de achiziție stă în `equipment_costuri`, încorporată sub
  // RLS-ul ei. Cine n-o vede primește embed-ul `null`, deci „Cost / valoare” = „—”.
  it("valoarea de achiziție vine din `equipment_costuri`, nu din coloana goală a echipamentului", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("equipment", "select", {
      data: [
        {
          id: "e-1",
          cod: "A",
          denumire: "Presă",
          casat_la: null,
          data_punerii_in_functiune: null,
          costuri: { valoare_achizitie: 5000 },
        },
        {
          id: "e-2",
          cod: "B",
          denumire: "Strung",
          casat_la: null,
          data_punerii_in_functiune: null,
          costuri: null,
        },
      ],
    });

    const r = await echipamentePentruRaport(ORG_ID);

    expect(r.randuri.map((e) => [e.id, e.valoare_achizitie])).toEqual([
      ["e-1", 5000],
      ["e-2", null],
    ]);
    expect(r.randuri[0]).not.toHaveProperty("costuri");
    const [apel] = server.apeluriPe("equipment");
    expect(apel?.coloane).toContain("costuri:equipment_costuri(valoare_achizitie)");
    expect(apel?.coloane).not.toMatch(/(^|,\s*)valoare_achizitie\s*(,|$)/u);
  });
});

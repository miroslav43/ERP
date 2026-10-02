// src/lib/queries/nomenclator.test.ts
//
// Nomenclatorul dosarelor se citește ÎNTREG (anexa nr. 1), cu plafon explicit,
// iar tipurile de document se grupează pe dosar. Avizul e un singur rând.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { citesteAvizNomenclator, citesteNomenclator, MAX_DOSARE } from "./nomenclator";

const dosar = (id: string, cifra: string, nr: number) => ({
  id,
  compartiment_cifra: cifra,
  compartiment_denumire: "Resurse umane",
  subdiviziune_litera: null,
  subdiviziune_denumire: null,
  dosar_cifra: nr,
  continut: "Dosare de personal",
  termen_pastrare: "75 ani",
  indicativ: `${cifra}-${String(nr)}`,
});

describe("citesteNomenclator", () => {
  it("dosarele firmei, vii, în ordinea anexei, cu plafon explicit", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("nomenclator_dosare", "select", { data: [] });
    server.raspunde("nomenclator_tipuri", "select", { data: [] });

    await citesteNomenclator(ORG_ID);

    const [dosare] = server.apeluriPe("nomenclator_dosare");
    expect(areFiltru(dosare, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(dosare, "is", "deleted_at", null)).toBe(true);
    expect(dosare?.filtre).toEqual(
      expect.arrayContaining([
        { metoda: "order", argumente: ["compartiment_cifra", { ascending: true }] },
        {
          metoda: "order",
          argumente: ["subdiviziune_litera", { ascending: true, nullsFirst: true }],
        },
        { metoda: "order", argumente: ["dosar_cifra", { ascending: true }] },
        { metoda: "limit", argumente: [MAX_DOSARE] },
      ]),
    );
    const [tipuri] = server.apeluriPe("nomenclator_tipuri");
    expect(areFiltru(tipuri, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(tipuri, "is", "deleted_at", null)).toBe(true);
  });

  it("tipurile se grupează pe dosarul lor și se sortează; un dosar fără tipuri are listă goală", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("nomenclator_dosare", "select", {
      data: [dosar(ID_1, "I", 1), dosar(ID_2, "II", 1)],
    });
    server.raspunde("nomenclator_tipuri", "select", {
      data: [
        { tip_document: "nda", dosar_id: ID_1 },
        { tip_document: "contract_munca", dosar_id: ID_1 },
        { tip_document: "orfan", dosar_id: "99999999-9999-4999-8999-999999999999" },
      ],
    });

    const r = await citesteNomenclator(ORG_ID);

    expect(r).toEqual([
      {
        id: ID_1,
        compartimentCifra: "I",
        compartimentDenumire: "Resurse umane",
        subdiviziuneLitera: null,
        subdiviziuneDenumire: null,
        dosarCifra: 1,
        continut: "Dosare de personal",
        termenPastrare: "75 ani",
        indicativ: "I-1",
        tipuri: ["contract_munca", "nda"],
      },
      expect.objectContaining({ id: ID_2, tipuri: [] }),
    ]);
  });

  it("nomenclator gol ⇒ listă goală", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("nomenclator_dosare", "select", { data: null });
    server.raspunde("nomenclator_tipuri", "select", { data: null });
    expect(await citesteNomenclator(ORG_ID)).toEqual([]);
  });

  it.each([
    ["dosarelor", "nomenclator_dosare"],
    ["tipurilor", "nomenclator_tipuri"],
  ])("eroarea citirii %s se propagă", async (_e, tabela) => {
    const { server } = configureazaActiunea();
    server.raspunde("nomenclator_dosare", "select", {
      ...(tabela === "nomenclator_dosare" ? { error: eroarePostgrest("57014") } : { data: [] }),
    });
    server.raspunde("nomenclator_tipuri", "select", {
      ...(tabela === "nomenclator_tipuri" ? { error: eroarePostgrest("57014") } : { data: [] }),
    });
    await expect(citesteNomenclator(ORG_ID)).rejects.toMatchObject({ code: "57014" });
  });
});

describe("citesteAvizNomenclator", () => {
  it("rândul firmei, viu, mapat pe forma de ecran", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("nomenclator_config", "select", {
      data: {
        avizat_la: "2026-05-04",
        numar_aviz: "1234",
        directia_judeteana: "Cluj",
        observatii: null,
      },
    });

    const r = await citesteAvizNomenclator(ORG_ID);

    expect(r).toEqual({
      avizatLa: "2026-05-04",
      numarAviz: "1234",
      directiaJudeteana: "Cluj",
      observatii: null,
    });
    const [apel] = server.apeluriPe("nomenclator_config");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.terminal).toBe("maybeSingle");
  });

  it("fără rând ⇒ null (nomenclator neavizat)", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("nomenclator_config", "select", { data: null });
    expect(await citesteAvizNomenclator(ORG_ID)).toBeNull();
  });

  it("eroarea se propagă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("nomenclator_config", "select", { error: eroarePostgrest("42501") });
    await expect(citesteAvizNomenclator(ORG_ID)).rejects.toMatchObject({ code: "42501" });
  });
});

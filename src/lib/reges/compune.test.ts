// src/lib/reges/compune.test.ts
//
// Compunerea mesajelor REGES din starea bazei: țara după nomenclator (cu
// rezervă pe tabela scurtă), COR-ul ca referință din oglinda locală, sporurile
// ACTIVE ale contractului, iar contractul cu alegerea explicită a operatorului
// peste deducție. Ce lipsește din oglindă OPREȘTE mesajul.

import { describe, expect, it } from "vitest";

import { areFiltru, clientFals, eroarePostgrest } from "@/lib/teste/supabase-fals";

import {
  compuneContract,
  compuneSalariat,
  idCor,
  numeTara,
  sporurileContractului,
  type RandAngajat,
  type RandContract,
} from "./compune";

const ORG = "11111111-1111-4111-8111-111111111111";
const CONTRACT = "77777777-7777-4777-8777-777777777777";
const CTX = { messageId: "msg-1", autorId: "autor", sesiuneId: "ses", utilizator: "op" };

describe("numeTara", () => {
  it("caută întâi în nomenclatorul `Cetatenie` sincronizat, activ", async () => {
    const fals = clientFals();
    fals.raspunde("reges_nomenclatoare", "select", { data: { nume: "ROMÂNIA" } });

    expect(await numeTara(fals.client, " ro ")).toBe("ROMÂNIA");
    const [apel] = fals.apeluri;
    expect(areFiltru(apel, "eq", "tip", "Cetatenie")).toBe(true);
    expect(areFiltru(apel, "eq", "cod", "RO")).toBe(true);
    expect(areFiltru(apel, "eq", "activ", true)).toBe(true);
  });

  it.each([
    ["MD", "Republica Moldova"],
    ["DE", "Germania"],
    [null, "România"],
    ["ZZ", "ZZ"],
  ])("nesincronizat: %j cade pe tabela scurtă sau pe codul brut (%j)", async (cod, asteptat) => {
    const fals = clientFals();
    fals.raspunde("reges_nomenclatoare", "select", { data: null });
    expect(await numeTara(fals.client, cod)).toBe(asteptat);
  });
});

describe("idCor", () => {
  it("codul COR se rezolvă la UUID-ul din oglinda `Cor`", async () => {
    const fals = clientFals();
    fals.raspunde("reges_nomenclatoare", "select", { data: { reges_id: "cor-uuid" } });
    expect(await idCor(fals.client, " 241103 ")).toBe("cor-uuid");
    const [apel] = fals.apeluri;
    expect(areFiltru(apel, "eq", "tip", "Cor")).toBe(true);
    expect(areFiltru(apel, "eq", "cod", "241103")).toBe(true);
    expect(areFiltru(apel, "eq", "activ", true)).toBe(true);
  });

  it.each([null, "", "   "])("codul gol (%j) ⇒ null, fără interogare", async (cod) => {
    const fals = clientFals();
    expect(await idCor(fals.client, cod)).toBeNull();
    expect(fals.apeluri).toHaveLength(0);
  });

  it("codul absent din oglindă ⇒ null (verificarea oprește apoi mesajul)", async () => {
    const fals = clientFals();
    fals.raspunde("reges_nomenclatoare", "select", { data: null });
    expect(await idCor(fals.client, "999999")).toBeNull();
  });
});

describe("sporurileContractului", () => {
  it("doar sporurile contractului firmei, vii, începute la dată", async () => {
    const fals = clientFals();
    fals.raspunde("salary_components", "select", { data: [] });

    await sporurileContractului(fals.client, ORG, CONTRACT, "2026-10-01");

    const [apel] = fals.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(apel, "eq", "contract_id", CONTRACT)).toBe(true);
    expect(areFiltru(apel, "in", "kind", ["spor_procent", "spor_suma"])).toBe(true);
    expect(areFiltru(apel, "lte", "valabil_de_la", "2026-10-01")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("procentul și suma se mapează; tipul nemapat iese cu referință GOALĂ, nu se sare", async () => {
    const fals = clientFals();
    fals.raspunde("salary_components", "select", {
      data: [
        { kind: "spor_procent", procent: 10.5, suma: null, tip: { reges_tip_spor_id: "t-1" } },
        { kind: "spor_suma", procent: null, suma: 300, tip: { reges_tip_spor_id: null } },
        { kind: "spor_suma", procent: null, suma: 0, tip: { reges_tip_spor_id: "t-3" } },
        { kind: "spor_procent", procent: null, suma: null, tip: null },
      ],
    });

    const r = await sporurileContractului(fals.client, ORG, CONTRACT, "2026-10-01");

    expect(r).toEqual([
      { referintaTipSpor: "t-1", valoare: 10.5, esteProcent: true },
      { referintaTipSpor: "", valoare: 300, esteProcent: false },
      // Valoare zero, dar referință lipsă: rămâne, ca verificarea să-l oprească.
      { referintaTipSpor: "", valoare: 0, esteProcent: true },
    ]);
  });

  // Comentariul funcției: „ACTIVE LA O DATĂ, nu «toate cele scrise vreodată»:
  // un spor expirat rămâne în tabelă ca istoric". Interogarea filtrează doar
  // `valabil_de_la <= laData`; `valabil_pana` nu e consultat, deci un spor
  // încheiat pleacă la ITM ca pachet salarial actual.
  it.fails("DEFECT: sporul expirat (`valabil_pana` trecut) nu e exclus din mesaj", async () => {
    const fals = clientFals();
    fals.raspunde("salary_components", "select", { data: [] });

    await sporurileContractului(fals.client, ORG, CONTRACT, "2026-10-01");

    const [apel] = fals.apeluri;
    const atingeSfarsitul = apel?.filtre.some((f) =>
      JSON.stringify(f.argumente).includes("valabil_pana"),
    );
    expect(atingeSfarsitul).toBe(true);
  });

  it("eroarea se propagă", async () => {
    const fals = clientFals();
    const eroare = eroarePostgrest("42501");
    fals.raspunde("salary_components", "select", { error: eroare });
    await expect(sporurileContractului(fals.client, ORG, CONTRACT, "2026-10-01")).rejects.toBe(
      eroare,
    );
  });
});

describe("compuneSalariat", () => {
  const angajat: RandAngajat = {
    first_name: "Ion",
    last_name: "Pop",
    adresa_strada: "Str. Lungă 1",
    adresa_oras: "Cluj-Napoca",
    adresa_judet: "Cluj",
    adresa_cod_postal: null,
    cetatenie: "RO",
    data_nasterii: "1999-01-01",
    reges_tip_act: null,
    reges_salariat_id: null,
  };

  it("salariat nou: InregistrareSalariat, cu țara din nomenclator și CNP-ul primit din afară", async () => {
    const fals = clientFals();
    fals.raspunde("reges_nomenclatoare", "select", { data: { nume: "România" } });

    const r = await compuneSalariat(fals.client, angajat, "1990101123456", CTX);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mesaj.header.operation).toBe("InregistrareSalariat");
    expect(r.mesaj).not.toHaveProperty("referintaSalariat");
    expect(r.mesaj.info).toMatchObject({
      cnp: "1990101123456",
      nume: "Pop",
      prenume: "Ion",
      adresa: "Str. Lungă 1, Cluj-Napoca, Cluj",
      taraDomiciliu: { nume: "România" },
      tipActIdentitate: "CarteIdentitate",
      localitate: { nume: "Cluj-Napoca" },
    });
    // Singura citire e nomenclatorul; CNP-ul nu se caută în bază.
    expect(fals.apeluri.map((a) => a.tabela)).toEqual(["reges_nomenclatoare"]);
  });

  it("salariat deja la ITM: ModificareSalariat prin referință", async () => {
    const fals = clientFals();
    fals.raspunde("reges_nomenclatoare", "select", { data: null });
    const r = await compuneSalariat(
      fals.client,
      { ...angajat, reges_salariat_id: "sal-1", reges_tip_act: "Pasaport" },
      "1990101123456",
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mesaj.header.operation).toBe("ModificareSalariat");
    expect(r.mesaj).toHaveProperty("referintaSalariat");
    expect(r.mesaj.info.tipActIdentitate).toBe("Pasaport");
  });

  it("fișa fără adresă și cu CNP greșit: problemele, nu un mesaj", async () => {
    const fals = clientFals();
    fals.raspunde("reges_nomenclatoare", "select", { data: null });
    const r = await compuneSalariat(
      fals.client,
      { ...angajat, adresa_strada: null, adresa_oras: null, adresa_judet: null },
      "0123",
      CTX,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.probleme.map((p) => p.camp).sort()).toEqual(["adresa", "cnp"]);
  });
});

describe("compuneContract", () => {
  const rand: RandContract = {
    numar: "12",
    data_contract: "2026-09-01",
    valabil_de_la: "2026-09-10",
    valabil_pana: null,
    contract_duration: "nedeterminat",
    norma_ore_saptamana: 40,
    norma_ore_zi: 8,
    salariu_baza: 5000,
    moneda: "ron",
    work_mode: "telemunca",
    special_regime: null,
    reges_contract_id: null,
    reges_tip_contract: null,
    reges_tip_norma: null,
    reges_norma_timp: null,
    reges_repartizare: null,
    cod_cor: "241103",
  };

  it("fără alegeri explicite, deduce tipul, norma și repartizarea", () => {
    const r = compuneContract(rand, "sal-1", "cor-uuid", [], CTX);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mesaj.header.operation).toBe("AdaugareContract");
    expect(r.mesaj.continut).toMatchObject({
      tipContract: "ContractIndividualMuncaClauzaTelemunca",
      tipDurata: "Nedeterminata",
      tipNorma: "NormaIntreaga",
      timpMunca: { norma: "NormaIntreaga840", repartizare: "OreDeZi" },
      moneda: "RON",
      cor: { id: "cor-uuid" },
    });
    // Fără sporuri, câmpul lipsește cu totul (nu `[]`).
    expect(r.mesaj.continut?.salariu).not.toHaveProperty("sporuri");
  });

  it("alegerea explicită a operatorului bate deducția", () => {
    const r = compuneContract(
      {
        ...rand,
        reges_tip_contract: "RaportDeServiciu",
        reges_tip_norma: "NormaOUG132",
        reges_norma_timp: "TimpOUG132",
        reges_repartizare: "OreDeNoapte",
      },
      "sal-1",
      "cor-uuid",
      [{ referintaTipSpor: "t-1", valoare: 10, esteProcent: true }],
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mesaj.continut).toMatchObject({
      tipContract: "RaportDeServiciu",
      tipNorma: "NormaOUG132",
      timpMunca: { norma: "TimpOUG132", repartizare: "OreDeNoapte" },
      salariu: { sporuri: [{ referintaTipSpor: "t-1", valoare: 10, esteProcent: true }] },
    });
  });

  it("contractul deja la ITM pleacă ca modificare, prin referință", () => {
    const r = compuneContract(
      { ...rand, reges_contract_id: "ctr-1" },
      "sal-1",
      "cor-uuid",
      [],
      CTX,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mesaj.header.operation).toBe("ModificareContract");
    expect(r.mesaj).toHaveProperty("referintaContract");
  });

  it.each([
    ["COR absent din oglindă", { regesCorId: null }, "codCor"],
    [
      "spor fără referință",
      { sporuri: [{ referintaTipSpor: "", valoare: 5, esteProcent: false }] },
      "sporuri[0].referintaTipSpor",
    ],
    [
      "spor procentual peste 100",
      { sporuri: [{ referintaTipSpor: "t", valoare: 150, esteProcent: true }] },
      "sporuri[0].valoare",
    ],
  ])("%s OPREȘTE mesajul", (_e, peste, camp) => {
    const p = { regesCorId: "cor-uuid" as string | null, sporuri: [] as never[], ...peste };
    const r = compuneContract(rand, "sal-1", p.regesCorId, p.sporuri, CTX);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.probleme.map((x) => x.camp)).toContain(camp);
  });

  it("determinat fără dată de sfârșit e respins înainte de ITM", () => {
    const r = compuneContract(
      { ...rand, contract_duration: "determinat" },
      "sal-1",
      "cor-uuid",
      [],
      CTX,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.probleme.map((x) => x.camp)).toContain("valabilPana");
  });
});

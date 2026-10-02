// src/lib/reges/coada.test.ts
//
// Punerea în coadă NU trimite nimic: scrie rânduri `de_transmis`, cu lanțul de
// dependențe din `planificaMesaje`, și e idempotentă pe eveniment. Iar
// `esteTransmisibil` e regula „dependența a primit identificator", nu doar
// „dependența a reușit".

import { describe, expect, it } from "vitest";

import { areFiltru, clientFals, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { esteTransmisibil, pregatesteMesaje, type CerereCoada } from "./coada";

const ORG = "11111111-1111-4111-8111-111111111111";
const EVENIMENT = "55555555-5555-4555-8555-555555555555";
const ANGAJAT = "66666666-6666-4666-8666-666666666666";
const CONTRACT = "77777777-7777-4777-8777-777777777777";

const cerere = (peste: Partial<CerereCoada> = {}): CerereCoada => ({
  organizationId: ORG,
  evenimentId: EVENIMENT,
  employeeId: ANGAJAT,
  contractId: CONTRACT,
  tipEveniment: "angajare",
  regesSalariatId: null,
  regesContractId: null,
  ...peste,
});

describe("pregatesteMesaje", () => {
  it("evenimentul are deja mesaje neanulate: nu mai adaugă nimic (idempotență)", async () => {
    const fals = clientFals();
    fals.raspunde("reges_mesaje", "select", { data: [{ id: "m-vechi" }] });

    const r = await pregatesteMesaje(fals.client, cerere());

    expect(r).toEqual({ ok: true, mesajeCreate: 0, deja: true });
    const [citire, ...altele] = fals.apeluri;
    expect(altele).toHaveLength(0);
    expect(areFiltru(citire, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(citire, "eq", "eveniment_id", EVENIMENT)).toBe(true);
    expect(areFiltru(citire, "neq", "stare", "anulat")).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
  });

  it("angajare pentru un salariat nou: întâi persoana, apoi contractul legat de ea", async () => {
    const fals = clientFals();
    fals.raspunde("reges_mesaje", "select", { data: [] });
    fals.raspunde("reges_mesaje", "insert", { data: { id: "m-salariat" } });
    fals.raspunde("reges_mesaje", "insert", { data: { id: "m-contract" } });

    const r = await pregatesteMesaje(fals.client, cerere());

    expect(r).toEqual({ ok: true, mesajeCreate: 2, deja: false });
    const [salariat, contract] = fals.apeluriPe("reges_mesaje", "insert");
    expect(salariat?.payload).toMatchObject({
      organization_id: ORG,
      eveniment_id: EVENIMENT,
      employee_id: ANGAJAT,
      // Mesajul de salariat nu ține de contract.
      contract_id: null,
      tip: "salariat",
      operatie: "InregistrareSalariat",
      ordine: 0,
      depinde_de: null,
    });
    expect(contract?.payload).toMatchObject({
      contract_id: CONTRACT,
      tip: "contract",
      operatie: "AdaugareContract",
      ordine: 1,
      depinde_de: "m-salariat",
    });
    // Payload-ul NU se persistă: doar explicația.
    expect(Object.keys((contract?.payload as { cerere_rezumat: object }).cerere_rezumat)).toEqual([
      "explicatie",
    ]);
    expect(salariat?.selectDupaScriere).toBeDefined();
  });

  it("salariat deja la ITM: un singur mesaj de contract, fără dependență", async () => {
    const fals = clientFals();
    fals.raspunde("reges_mesaje", "select", { data: null });
    fals.raspunde("reges_mesaje", "insert", { data: { id: "m-contract" } });

    const r = await pregatesteMesaje(fals.client, cerere({ regesSalariatId: "sal-1" }));

    expect(r).toEqual({ ok: true, mesajeCreate: 1, deja: false });
    expect(fals.apeluriPe("reges_mesaje", "insert")[0]?.payload).toMatchObject({
      tip: "contract",
      ordine: 0,
      depinde_de: null,
    });
  });

  it("detașarea devine propunere, nu mesaj de contract", async () => {
    const fals = clientFals();
    fals.raspunde("reges_mesaje", "select", { data: [] });
    fals.raspunde("reges_mesaje", "insert", { data: { id: "m-p" } });
    await pregatesteMesaje(
      fals.client,
      cerere({ tipEveniment: "detasare", regesSalariatId: "s", regesContractId: "c" }),
    );
    expect(fals.apeluriPe("reges_mesaje", "insert")[0]?.payload).toMatchObject({
      tip: "propunere_detasare",
      operatie: "PropunereDetasareContract",
    });
  });

  it("planul refuză (modificare pe contract netransmis): `ok: false`, nimic scris", async () => {
    const fals = clientFals();
    fals.raspunde("reges_mesaje", "select", { data: [] });

    const r = await pregatesteMesaje(
      fals.client,
      cerere({ tipEveniment: "modificare_salariu", regesSalariatId: "s", regesContractId: null }),
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motiv).toContain("ModificareContract");
    expect(fals.apeluriPe("reges_mesaje", "insert")).toHaveLength(0);
  });

  it("eroarea citirii de idempotență se propagă", async () => {
    const fals = clientFals();
    const eroare = eroarePostgrest("42501");
    fals.raspunde("reges_mesaje", "select", { error: eroare });
    await expect(pregatesteMesaje(fals.client, cerere())).rejects.toBe(eroare);
  });

  it("eroarea unui INSERT se propagă și oprește lanțul (al doilea pas nu se scrie)", async () => {
    const fals = clientFals();
    fals.raspunde("reges_mesaje", "select", { data: [] });
    fals.raspunde("reges_mesaje", "insert", { error: eroarePostgrest("23505") });
    await expect(pregatesteMesaje(fals.client, cerere())).rejects.toMatchObject({ code: "23505" });
    expect(fals.apeluriPe("reges_mesaje", "insert")).toHaveLength(1);
  });
});

describe("esteTransmisibil", () => {
  it.each([
    ["fără dependență", { depinde_de: null }, true],
    [
      "fără dependență, chiar cu o dependență încărcată",
      { depinde_de: null, dependenta: null },
      true,
    ],
    [
      "dependența reușită cu identificator",
      { depinde_de: "d", dependenta: { stare: "reusit", referinta_id: "r" } },
      true,
    ],
    [
      "dependența reușită FĂRĂ identificator",
      { depinde_de: "d", dependenta: { stare: "reusit", referinta_id: null } },
      false,
    ],
    [
      "dependența în așteptare",
      { depinde_de: "d", dependenta: { stare: "asteapta_raspuns", referinta_id: null } },
      false,
    ],
    [
      "dependența eșuată, dar cu referință",
      { depinde_de: "d", dependenta: { stare: "esuat", referinta_id: "r" } },
      false,
    ],
    ["dependența neîncărcată (null)", { depinde_de: "d", dependenta: null }, false],
    ["dependența neîncărcată (lipsă)", { depinde_de: "d" }, false],
  ])("%s ⇒ %s", (_e, mesaj, asteptat) => {
    expect(esteTransmisibil(mesaj)).toBe(asteptat);
  });
});

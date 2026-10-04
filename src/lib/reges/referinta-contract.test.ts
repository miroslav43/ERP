// src/lib/reges/referinta-contract.test.ts
//
// Un act adițional se transmite la REGES ca `ModificareContract` pe
// identificatorul contractului de BAZĂ. Rândul actului n-are identificator
// propriu; fără împrumut, modificarea de salariu n-ar avea la ce contract să se
// refere și ar rămâne netransmisă.

import { describe, expect, it } from "vitest";

import { areFiltru, clientFals } from "@/lib/teste/supabase-fals";

import { referintaContractReges } from "./compune";

const ORG = "11111111-1111-4111-8111-111111111111";

describe("referintaContractReges", () => {
  it("contractul de bază: identificatorul lui, o singură citire", async () => {
    const db = clientFals();
    db.raspunde("employment_contracts", "select", {
      data: { reges_contract_id: "R-1", este_act_aditional: false, parent_contract_id: null },
    });
    expect(await referintaContractReges(db.client, ORG, "c1")).toBe("R-1");
    const [citire] = db.apeluriPe("employment_contracts");
    expect(areFiltru(citire, "eq", "organization_id", ORG)).toBe(true);
    expect(db.apeluriPe("employment_contracts")).toHaveLength(1);
  });

  it("actul adițional: împrumută identificatorul contractului de bază, din aceeași firmă", async () => {
    const db = clientFals();
    db.raspunde("employment_contracts", "select", {
      data: { reges_contract_id: null, este_act_aditional: true, parent_contract_id: "baza" },
    });
    db.raspunde("employment_contracts", "select", { data: { reges_contract_id: "R-BAZA" } });

    expect(await referintaContractReges(db.client, ORG, "act")).toBe("R-BAZA");
    const [, baza] = db.apeluriPe("employment_contracts");
    expect(areFiltru(baza, "eq", "id", "baza")).toBe(true);
    expect(areFiltru(baza, "eq", "organization_id", ORG)).toBe(true);
  });

  it("baza n-a fost încă transmisă: null (mesajul așteaptă dependența)", async () => {
    const db = clientFals();
    db.raspunde("employment_contracts", "select", {
      data: { reges_contract_id: null, este_act_aditional: true, parent_contract_id: "baza" },
    });
    db.raspunde("employment_contracts", "select", { data: { reges_contract_id: null } });
    expect(await referintaContractReges(db.client, ORG, "act")).toBeNull();
  });

  it("contract inexistent: null", async () => {
    const db = clientFals();
    db.raspunde("employment_contracts", "select", { data: null });
    expect(await referintaContractReges(db.client, ORG, "x")).toBeNull();
  });
});

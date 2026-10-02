// src/lib/membri/schimba-rol.test.ts
//
// Ce NU acoperă testul acțiunii `schimbaRolulMembrului`: apelul fără autor
// (regula automată de la desemnarea unui șef de departament) și mesajul care
// spune ce s-a scris deja când rolul e a doua scriere dintr-o acțiune.

import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";
import { areFiltru, clientFals, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { numaraAdminiActivi, schimbaRolul } from "./schimba-rol";

const ORG = "11111111-1111-4111-8111-111111111111";
const MEMBRU = "55555555-5555-4555-8555-555555555555";

describe("numaraAdminiActivi", () => {
  it("numără administratorii activi ai firmei, fără membrul exceptat", async () => {
    const fals = clientFals();
    fals.raspunde("organization_members", "select", { count: 2 });

    expect(await numaraAdminiActivi(fals.client, ORG, MEMBRU)).toBe(2);
    const [apel] = fals.apeluri;
    expect(apel?.optiuni).toEqual({ count: "exact", head: true });
    expect(areFiltru(apel, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(apel, "eq", "role", "org_admin")).toBe(true);
    expect(areFiltru(apel, "eq", "status", "active")).toBe(true);
    expect(areFiltru(apel, "neq", "id", MEMBRU)).toBe(true);
  });

  it("numărătoarea necunoscută (null) e zero — piedica rămâne pusă", async () => {
    const fals = clientFals();
    fals.raspunde("organization_members", "select", {
      count: null,
      error: eroarePostgrest("57014"),
    });
    expect(await numaraAdminiActivi(fals.client, ORG, MEMBRU)).toBe(0);
  });
});

describe("schimbaRolul", () => {
  it("fără autor (regulă automată), piedica de „propriul rol” nu se aplică", async () => {
    const fals = clientFals();
    fals.raspunde("organization_members", "update", { data: { id: MEMBRU, role: "org_admin" } });

    const r = await schimbaRolul({
      db: fals.client,
      organizationId: ORG,
      memberId: MEMBRU,
      rol: "org_admin",
      memberIdAutor: null,
    });

    expect(r).toEqual({ id: MEMBRU, role: "org_admin" });
  });

  it("zero rânduri ca a doua scriere: mesajul spune ce s-a salvat deja și unde se repară", async () => {
    const fals = clientFals();
    fals.raspunde("organization_members", "select", { count: 1 });
    fals.raspunde("organization_members", "update", { data: null });

    const promisiune = schimbaRolul({
      db: fals.client,
      organizationId: ORG,
      memberId: MEMBRU,
      rol: "manager",
      memberIdAutor: null,
      ceEsteDejaScris: "Departamentul a fost salvat",
    });

    await expect(promisiune).rejects.toBeInstanceOf(ActionDenied);
    await expect(promisiune).rejects.toMatchObject({
      code: "NEGASIT",
      message: expect.stringMatching(
        /^Departamentul a fost salvat, dar rolul nu a putut fi schimbat: .*Setări → Membri\.$/,
      ),
    });
  });

  it("eroarea bazei la UPDATE se propagă neatinsă", async () => {
    const fals = clientFals();
    const eroare = eroarePostgrest("42501");
    fals.raspunde("organization_members", "update", { error: eroare });
    await expect(
      schimbaRolul({
        db: fals.client,
        organizationId: ORG,
        memberId: MEMBRU,
        rol: "org_admin",
        memberIdAutor: null,
      }),
    ).rejects.toBe(eroare);
  });
});

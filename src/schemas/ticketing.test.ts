// src/schemas/ticketing.test.ts
import { describe, expect, it } from "vitest";
import { creeazaTichetSchema, decideTichetSchema } from "./ticketing";

// UUID valid RFC 4122: nibble de versiune 4, nibble de variantă 8.
// `z.uuid()` din Zod 4 le verifică pe amândouă, nu doar forma.
const UUID = "11111111-1111-4111-8111-111111111111";
const BAZA = { titlu: "Ceva", descriere: "Explicație suficient de lungă" };

describe("formularul se schimbă cu tipul", () => {
  it("software cere aplicația și numărul de licențe", () => {
    expect(
      creeazaTichetSchema.safeParse({
        ...BAZA,
        tip: "software",
        aplicatie: "Figma",
        numar_licente: 2,
      }).success,
    ).toBe(true);
    expect(
      creeazaTichetSchema.safeParse({ ...BAZA, tip: "software", numar_licente: 2 }).success,
    ).toBe(false);
  });

  it("respinge un număr de licențe absurd sau zero", () => {
    for (const numar_licente of [0, -3, 99999]) {
      expect(
        creeazaTichetSchema.safeParse({
          ...BAZA,
          tip: "software",
          aplicatie: "Figma",
          numar_licente,
        }).success,
        String(numar_licente),
      ).toBe(false);
    }
  });

  it("hardware la birou nu cere adresă", () => {
    expect(
      creeazaTichetSchema.safeParse({
        ...BAZA,
        tip: "hardware",
        denumire_hardware: 'Monitor 27"',
        loc_livrare: "birou",
      }).success,
    ).toBe(true);
  });

  it("hardware la domiciliu cere adresă, pe câmpul corect", () => {
    const rezultat = creeazaTichetSchema.safeParse({
      ...BAZA,
      tip: "hardware",
      denumire_hardware: "Monitor",
      loc_livrare: "domiciliu",
    });
    expect(rezultat.success).toBe(false);
    if (!rezultat.success) {
      expect(rezultat.error.issues[0]?.path).toEqual(["adresa_livrare"]);
    }
  });

  it("defecțiunea cere obiect din inventar, fără portiță de text liber", () => {
    expect(
      creeazaTichetSchema.safeParse({
        ...BAZA,
        tip: "defectiune",
        inventory_item_id: UUID,
        blocheaza_activitatea: true,
      }).success,
    ).toBe(true);

    // Fără obiect selectat nu se poate deschide o defecțiune.
    expect(
      creeazaTichetSchema.safeParse({ ...BAZA, tip: "defectiune", blocheaza_activitatea: true })
        .success,
    ).toBe(false);
  });

  it("bug-ul cere cele trei câmpuri separate", () => {
    const complet = {
      ...BAZA,
      tip: "bug_erp",
      modul: "pontaj",
      pasi_efectuati: "Am apăsat Salvează",
      rezultat_asteptat: "Se salvează",
      rezultat_obtinut: "Eroare 500",
    };
    expect(creeazaTichetSchema.safeParse(complet).success).toBe(true);

    for (const lipsa of ["pasi_efectuati", "rezultat_asteptat", "rezultat_obtinut"]) {
      const partial: Record<string, unknown> = { ...complet };
      delete partial[lipsa];
      expect(creeazaTichetSchema.safeParse(partial).success, lipsa).toBe(false);
    }
  });

  it("câmpurile unui tip nu sunt acceptate pe alt tip", () => {
    // Uniunea discriminată taie câmpurile străine; `numar_licente` pe o
    // defecțiune nu are ce căuta.
    const rezultat = creeazaTichetSchema.safeParse({
      ...BAZA,
      tip: "defectiune",
      inventory_item_id: UUID,
      blocheaza_activitatea: false,
      numar_licente: 5,
    });
    expect(rezultat.success).toBe(true);
    if (rezultat.success) {
      expect("numar_licente" in rezultat.data).toBe(false);
    }
  });

  it("respinge un tip necunoscut", () => {
    expect(creeazaTichetSchema.safeParse({ ...BAZA, tip: "acces_cont" }).success).toBe(false);
  });
});

describe("decizia pe o cerere", () => {
  it("aprobarea nu cere motiv", () => {
    expect(decideTichetSchema.safeParse({ ticket_id: UUID, aprobat: true }).success).toBe(true);
  });

  it("respingerea cere motiv", () => {
    const rezultat = decideTichetSchema.safeParse({ ticket_id: UUID, aprobat: false });
    expect(rezultat.success).toBe(false);
    if (!rezultat.success) {
      expect(rezultat.error.issues[0]?.path).toEqual(["motiv"]);
    }
  });

  it("un motiv gol nu trece drept motiv", () => {
    expect(
      decideTichetSchema.safeParse({ ticket_id: UUID, aprobat: false, motiv: "   " }).success,
    ).toBe(false);
  });

  it("respingerea cu motiv trece", () => {
    expect(
      decideTichetSchema.safeParse({
        ticket_id: UUID,
        aprobat: false,
        motiv: "Bugetul e epuizat pe trimestrul acesta.",
      }).success,
    ).toBe(true);
  });
});

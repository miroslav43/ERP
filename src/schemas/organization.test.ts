// src/schemas/organization.test.ts
import { describe, expect, it } from "vitest";
import {
  actualizeazaOrganizatieSchema,
  completeazaFirmaSchema,
  onboardeazaOrganizatieSchema,
} from "./organization";

const BAZA = {
  name: "Firma Mea",
  forma_juridica: "SRL" as const,
  cui: "14399840",
  platitor_tva: false,
  slug: "firma-mea",
  email_contact: "contact@firma.ro",
  telefon_contact: "0721234567",
  judet: "București" as const,
  oras: "București",
  plan: "trial" as const,
  seats_limit: 10,
  legal_name: "SC Firma Mea SRL",
  zile_concediu_anual_implicit: 20,
  owner_nume: "Popescu",
  owner_prenume: "Ion",
  owner_email: "ion@firma.ro",
  owner_telefon: "0731234567",
};

describe("completeazaFirmaSchema — fără datele proprietarului", () => {
  // Asistentul `/bun-venit` are pașii 1–5 și confirmarea: proprietarul e chiar
  // apelantul, deci pasul 6 nu există, iar acțiunea nu scrie niciun `owner_*`.
  // Cât timp schema le cerea, `owner_telefon` (opțional la înregistrare) lipsea
  // din formular și „Finalizează" nu trimitea nimic (QA 8 oct 2026, ONB-010).
  const COMPLET = { ...BAZA, cod_caen: "6210", cod_caen_secundare: [] };

  it("acceptă un formular complet fără niciun câmp owner_*", () => {
    const { owner_nume, owner_prenume, owner_email, owner_telefon, ...faraProprietar } = COMPLET;
    void owner_nume;
    void owner_prenume;
    void owner_email;
    void owner_telefon;
    const rezultat = completeazaFirmaSchema.safeParse(faraProprietar);
    expect(rezultat.success).toBe(true);
  });

  it("ignoră câmpurile owner_* dacă totuși vin", () => {
    const rezultat = completeazaFirmaSchema.safeParse(COMPLET);
    expect(rezultat.success).toBe(true);
    if (rezultat.success) {
      expect("owner_telefon" in rezultat.data).toBe(false);
    }
  });
});

describe("onboardeazaOrganizatieSchema — cod_caen", () => {
  it("respinge lipsa codului principal, cu mesaj în română", () => {
    const rezultat = onboardeazaOrganizatieSchema.safeParse({ ...BAZA, cod_caen_secundare: [] });
    expect(rezultat.success).toBe(false);
    if (!rezultat.success) {
      const mesaj = rezultat.error.issues.find((i) => i.path.includes("cod_caen"))?.message;
      expect(mesaj).toBe("Selectați un cod CAEN.");
    }
  });

  it("respinge un cod care nu există în nomenclator", () => {
    const rezultat = onboardeazaOrganizatieSchema.safeParse({
      ...BAZA,
      cod_caen: "0000",
      cod_caen_secundare: [],
    });
    expect(rezultat.success).toBe(false);
  });

  it("acceptă un cod principal valid, fără secundare", () => {
    const rezultat = onboardeazaOrganizatieSchema.safeParse({
      ...BAZA,
      cod_caen: "6210",
      cod_caen_secundare: [],
    });
    expect(rezultat.success).toBe(true);
  });

  it("respinge PFA cu 5 coduri secundare (peste limita de 4)", () => {
    const rezultat = onboardeazaOrganizatieSchema.safeParse({
      ...BAZA,
      forma_juridica: "PFA",
      cod_caen: "0111",
      cod_caen_secundare: ["0112", "0113", "0114", "0115", "0116"],
    });
    expect(rezultat.success).toBe(false);
  });

  it("cod_caen_secundare implicit e listă goală când lipsește din input", () => {
    const rezultat = onboardeazaOrganizatieSchema.safeParse({ ...BAZA, cod_caen: "6210" });
    expect(rezultat.success).toBe(true);
    if (rezultat.success) expect(rezultat.data.cod_caen_secundare).toEqual([]);
  });
});

const BAZA_ACTUALIZARE = {
  orgId: "00000000-0000-0000-0000-000000000000",
  name: "Firma Mea",
  email_contact: "contact@firma.ro",
  telefon_contact: "0721234567",
  judet: "București" as const,
  oras: "București",
  plan: "trial" as const,
  seats_limit: 10,
};

describe("actualizeazaOrganizatieSchema — cod_caen", () => {
  it("acceptă lipsa completă a codului CAEN (organizație veche, neatinsă)", () => {
    const rezultat = actualizeazaOrganizatieSchema.safeParse(BAZA_ACTUALIZARE);
    expect(rezultat.success).toBe(true);
  });

  it("dacă principalul e completat, validează regula pe formă juridică", () => {
    const rezultat = actualizeazaOrganizatieSchema.safeParse({
      ...BAZA_ACTUALIZARE,
      forma_juridica: "PFA",
      cod_caen: "0111",
      cod_caen_secundare: ["0112", "0113", "0114", "0115", "0116"],
    });
    expect(rezultat.success).toBe(false);
  });

  it("acceptă un principal valid cu secundare în limită", () => {
    const rezultat = actualizeazaOrganizatieSchema.safeParse({
      ...BAZA_ACTUALIZARE,
      forma_juridica: "SRL",
      cod_caen: "6210",
      cod_caen_secundare: ["6220"],
    });
    expect(rezultat.success).toBe(true);
  });
});

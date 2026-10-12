import { describe, expect, it } from "vitest";

import { actualizeazaPermisSchema, legaDeplasareaSchema, permisNouSchema } from "./soferi";

const ANGAJAT = "11111111-1111-4111-8111-111111111111";

const valid = {
  employee_id: ANGAJAT,
  numar: "AB123456",
  categorii: ["B"],
  eliberat_la: "2020-01-10",
  expira_la: "2030-01-10",
  observatii: "",
};

describe("permisNouSchema", () => {
  it("acceptă un permis complet și golește observațiile", () => {
    const r = permisNouSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.observatii).toBeNull();
  });

  it("aduce categoriile la forma din lege, fără majuscule greșite", () => {
    const r = permisNouSchema.safeParse({ ...valid, categorii: ["b", "tr", "ce"] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.categorii).toEqual(["B", "Tr", "CE"]);
  });

  it("refuză o categorie care nu există, cu mesajul pe câmp", () => {
    const r = permisNouSchema.safeParse({ ...valid, categorii: ["B", "Z"] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["categorii"]);
  });

  it("refuză o listă mai lungă decât cea din lege, cu mesaj în română", () => {
    const r = permisNouSchema.safeParse({
      ...valid,
      categorii: Array.from({ length: 19 }, () => "B"),
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(["categorii"]);
      expect(r.error.issues[0]?.message).toBe(
        "Lista de categorii este mai lungă decât cea de pe permisul de conducere.",
      );
    }
  });

  it("cere cel puțin o categorie", () => {
    const r = permisNouSchema.safeParse({ ...valid, categorii: [] });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error.issues[0]?.message).toBe("Alegeți cel puțin o categorie de permis.");
  });

  it("cere data expirării; eliberarea e opțională", () => {
    expect(permisNouSchema.safeParse({ ...valid, expira_la: "" }).success).toBe(false);
    const r = permisNouSchema.safeParse({ ...valid, eliberat_la: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.eliberat_la).toBeNull();
  });

  it("refuză expirarea înaintea eliberării, pe `expira_la`", () => {
    const r = permisNouSchema.safeParse({
      ...valid,
      eliberat_la: "2030-02-01",
      expira_la: "2030-01-01",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["expira_la"]);
  });

  it("numărul are între 3 și 30 de caractere", () => {
    expect(permisNouSchema.safeParse({ ...valid, numar: "AB" }).success).toBe(false);
    expect(permisNouSchema.safeParse({ ...valid, numar: "X".repeat(31) }).success).toBe(false);
  });
});

describe("actualizeazaPermisSchema", () => {
  it("cere id-ul și angajatul (pentru calea fișei)", () => {
    expect(actualizeazaPermisSchema.safeParse(valid).success).toBe(false);
    expect(
      actualizeazaPermisSchema.safeParse({ ...valid, id: "22222222-2222-4222-8222-222222222222" })
        .success,
    ).toBe(true);
  });
});

describe("legaDeplasareaSchema", () => {
  it("șirul gol desface legătura", () => {
    const r = legaDeplasareaSchema.safeParse({ id: ANGAJAT, business_trip_id: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.business_trip_id).toBeNull();
  });

  it("refuză un identificator nevalid", () => {
    expect(
      legaDeplasareaSchema.safeParse({ id: ANGAJAT, business_trip_id: "nu-e-uuid" }).success,
    ).toBe(false);
  });
});

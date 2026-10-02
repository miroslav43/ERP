// src/app/(app)/flota/foi/date-foaie-noua.test.ts
//
// Datele casetei „Foaie nouă”: doar vehiculele din parc (nu cele vândute sau
// casate, pe care triggerul le-ar refuza oricum) și angajații activi.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";

import { dateFoaieNoua } from "./date-foaie-noua";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea().server;
});

const vehicul = (id: string, nr: string, km: number) => ({
  id,
  nr_inmatriculare: nr,
  marca: "Dacia",
  model: "Logan",
  categorie: "autoturism",
  tip_combustibil: "motorina",
  an_fabricatie: 2020,
  km_curent: km,
  employee_id: null,
  department_id: null,
  status: "activ",
  prag_salt_km: null,
  data_iesire: null,
  consum_mediu_declarat: 6.5,
});

describe("dateFoaieNoua", () => {
  it("cere doar vehiculele active și angajații activi ai organizației, și le reduce la opțiuni", async () => {
    db.raspunde("vehicles", "select", {
      data: [vehicul(ID_1, "B123ABC", 10500), vehicul(ID_2, "CJ01XYZ", 2300)],
    });
    db.raspunde("vehicles", "select", { count: 2 });
    db.raspunde("employees", "select", {
      data: [{ id: ID_3, full_name: "Ion Popescu", marca: "M-7", status: "activ" }],
    });

    const r = await dateFoaieNoua(ORG_ID);

    expect(r).toEqual({
      vehicule: [
        { id: ID_1, nr_inmatriculare: "B123ABC", km_curent: 10500 },
        { id: ID_2, nr_inmatriculare: "CJ01XYZ", km_curent: 2300 },
      ],
      angajati: [{ id: ID_3, full_name: "Ion Popescu", marca: "M-7" }],
    });

    const [listaVehicule] = db.apeluriPe("vehicles");
    expect(areFiltru(listaVehicule, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(listaVehicule, "eq", "status", "activ")).toBe(true);
    // limita 100 + 1, pentru a ști dacă mai urmează o pagină.
    expect(listaVehicule?.filtre.some((f) => f.metoda === "limit" && f.argumente[0] === 101)).toBe(
      true,
    );

    const [angajati] = db.apeluriPe("employees");
    expect(areFiltru(angajati, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(angajati, "eq", "status", "activ")).toBe(true);
    expect(areFiltru(angajati, "is", "deleted_at", null)).toBe(true);
    expect(angajati?.filtre.some((f) => f.metoda === "limit" && f.argumente[0] === 500)).toBe(true);
  });

  it("o eroare la citirea angajaților se propagă, nu devine o listă goală", async () => {
    db.raspunde("vehicles", "select", { data: [] });
    db.raspunde("vehicles", "select", { count: 0 });
    const eroare = eroarePostgrest("42501");
    db.raspunde("employees", "select", { error: eroare });

    await expect(dateFoaieNoua(ORG_ID)).rejects.toBe(eroare);
  });

  it("fără vehicule active: lista de vehicule e goală, angajații rămân", async () => {
    db.raspunde("vehicles", "select", { data: [] });
    db.raspunde("vehicles", "select", { count: 0 });
    db.raspunde("employees", "select", {
      data: [{ id: ID_3, full_name: null, marca: "M-1" }],
    });

    const r = await dateFoaieNoua(ORG_ID);

    expect(r.vehicule).toEqual([]);
    expect(r.angajati).toEqual([{ id: ID_3, full_name: null, marca: "M-1" }]);
  });
});

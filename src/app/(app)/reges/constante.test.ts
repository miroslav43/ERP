// src/app/(app)/reges/constante.test.ts
//
// Etichetele REGES acoperă EXACT vocabularele de protocol și enum-urile bazei:
// o valoare fără etichetă ar apărea pe ecran ca cod brut, una în plus e o
// etichetă moartă. Plus regulile de business din scheme.

import { describe, expect, it } from "vitest";

import { STATUSURI_REGES, TIPURI_EVENIMENT } from "@/domain/reges/evenimente";
import {
  NORME_TIMP_MUNCA,
  OPERATII,
  REPARTIZARI,
  TIPURI_CONTRACT,
  TIPURI_NORMA,
} from "@/domain/reges/operatii";
import type { Enums } from "@/types/database";

import {
  ETICHETE_NORMA_TIMP,
  ETICHETE_OPERATIE,
  ETICHETE_REPARTIZARE,
  ETICHETE_STARE_MESAJ,
  ETICHETE_STATUS,
  ETICHETE_TIP,
  ETICHETE_TIP_CONTRACT,
  ETICHETE_TIP_NORMA,
  MEDII,
  OPTIUNI_STARE,
  credentialeSchema,
  exportaSchema,
  marcheazaTransmisSchema,
  propunePlecareSchema,
} from "./constante";

const STARI_MESAJ = [
  "de_transmis",
  "in_curs",
  "asteapta_raspuns",
  "reusit",
  "esuat",
  "anulat",
] as const satisfies readonly Enums<"reges_stare_mesaj">[];

const sortate = (x: readonly string[]) => [...x].sort();

describe("etichetele acoperă exact vocabularele", () => {
  it.each([
    ["tipurile de eveniment", ETICHETE_TIP, TIPURI_EVENIMENT],
    ["statusurile evenimentului", ETICHETE_STATUS, STATUSURI_REGES],
    ["stările mesajului (enum-ul bazei)", ETICHETE_STARE_MESAJ, STARI_MESAJ],
    ["operațiile de protocol", ETICHETE_OPERATIE, OPERATII],
    ["tipurile de contract", ETICHETE_TIP_CONTRACT, TIPURI_CONTRACT],
    ["tipurile de normă", ETICHETE_TIP_NORMA, TIPURI_NORMA],
    ["normele de timp", ETICHETE_NORMA_TIMP, NORME_TIMP_MUNCA],
    ["repartizările", ETICHETE_REPARTIZARE, REPARTIZARI],
  ] as const)("%s", (_e, etichete, valori) => {
    expect(sortate(Object.keys(etichete))).toEqual(sortate(valori));
    for (const e of Object.values(etichete)) expect(e.trim()).not.toBe("");
  });

  it("filtrul de stare are „toate” întâi și valorile citirii", () => {
    expect(OPTIUNI_STARE.map((o) => o.valoare)).toEqual([
      "toate",
      "intarziate",
      "de_transmis",
      "transmise",
    ]);
  });

  it("mediile sunt exact cele două baze ale clientului", () => {
    expect(MEDII.map((m) => m.valoare)).toEqual(["test", "productie"]);
  });
});

describe("schemele", () => {
  it("exportul implicit e doar pe netransmise", () => {
    expect(exportaSchema.parse({})).toEqual({ doarNetransmise: true });
  });

  it.each([
    ["dată în format românesc", { transmisLa: "14.09.2026" }, "transmisLa"],
    ["număr de înregistrare gol", { numarInregistrare: "  " }, "numarInregistrare"],
    ["număr de înregistrare prea lung", { numarInregistrare: "x".repeat(61) }, "numarInregistrare"],
    ["observații prea lungi", { observatii: "x".repeat(501) }, "observatii"],
  ])("marcarea: %s e respinsă", (_e, peste, camp) => {
    const r = marcheazaTransmisSchema.safeParse({
      evenimentId: "55555555-5555-4555-8555-555555555555",
      transmisLa: "2026-09-14",
      numarInregistrare: "ITM-1",
      ...peste,
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toContain(camp);
  });

  it("credențialele: secretele sunt opționale la editare, CUI-ul și utilizatorul nu", () => {
    expect(
      credentialeSchema.safeParse({
        mediu: "test",
        cuiAngajator: "123",
        clientId: "c",
        utilizator: "u",
      }).success,
    ).toBe(true);
    const r = credentialeSchema.safeParse({
      mediu: "test",
      cuiAngajator: "1",
      clientId: "c",
      utilizator: " ",
    });
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual(["cuiAngajator", "utilizator"]);
  });

  it("propunerea cere CUI-ul destinației și temeiul; sfârșitul e opțional", () => {
    const baza = {
      contractId: "55555555-5555-4555-8555-555555555555",
      fel: "mutare",
      cuiDestinatie: "RO9",
      dataInceput: "2026-10-01",
      temeiLegal: "Art47",
    };
    expect(propunePlecareSchema.safeParse(baza).success).toBe(true);
    expect(propunePlecareSchema.safeParse({ ...baza, fel: "transfer" }).success).toBe(false);
    expect(propunePlecareSchema.safeParse({ ...baza, temeiLegal: "" }).success).toBe(false);
  });
});

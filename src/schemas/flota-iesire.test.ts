// src/schemas/flota-iesire.test.ts
//
// Schema asistentului „Scoate din parc” (0218, F12h): `superRefine` oglindește
// CHECK-urile din `vehicle_exits`, pe fiecare combinație tip × destinație × motiv.
import { describe, expect, it } from "vitest";

import {
  DESTINATII_EPAVA,
  MOTIVE_RADIERE,
  TIPURI_IESIRE,
  eInstrainare,
  finalizeazaObligatiaSchema,
  iesireDinParcSchema,
  permitePastrareaNumarului,
  type DestinatieEpava,
  type MotivRadiere,
  type TipIesire,
} from "./flota-iesire";

const VEHICUL = "66666666-6666-4666-8666-666666666666";

const baza = {
  vehicle_id: VEHICUL,
  tip: "vanzare",
  data_iesire: "2026-10-19",
  motiv: "Vândută unui client",
};

function campuriCuEroare(rezultat: ReturnType<typeof iesireDinParcSchema.safeParse>): string[] {
  return rezultat.success ? [] : rezultat.error.issues.map((i) => i.path.join("."));
}

describe("iesireDinParcSchema", () => {
  // Combinațiile valide: destinația doar la daună totală, motivul doar la radiere.
  const valide: readonly (readonly [TipIesire, DestinatieEpava | null, MotivRadiere | null])[] = [
    ["vanzare", null, null],
    ["casare", null, null],
    ["restituire_leasing", null, null],
    ...DESTINATII_EPAVA.map((d) => ["dauna_totala", d, null] as const),
    ...MOTIVE_RADIERE.map((m) => ["radiere", null, m] as const),
  ];

  it.each(valide)("%s + %s + %s: trece", (tip, destinatie, motiv) => {
    const r = iesireDinParcSchema.safeParse({
      ...baza,
      tip,
      destinatie_epava: destinatie ?? "",
      motiv_radiere: motiv ?? "",
    });
    expect(r.success).toBe(true);
  });

  it.each(TIPURI_IESIRE.filter((t) => t !== "dauna_totala"))(
    "%s cu destinația epavei: eroare pe `destinatie_epava`",
    (tip) => {
      const r = iesireDinParcSchema.safeParse({
        ...baza,
        tip,
        destinatie_epava: "casata",
        motiv_radiere: tip === "radiere" ? "export" : "",
      });
      expect(campuriCuEroare(r)).toEqual(["destinatie_epava"]);
    },
  );

  it.each(TIPURI_IESIRE.filter((t) => t !== "radiere"))(
    "%s cu motivul radierii: eroare pe `motiv_radiere`",
    (tip) => {
      const r = iesireDinParcSchema.safeParse({
        ...baza,
        tip,
        destinatie_epava: tip === "dauna_totala" ? "casata" : "",
        motiv_radiere: "furt",
      });
      expect(campuriCuEroare(r)).toEqual(["motiv_radiere"]);
    },
  );

  it("daună totală fără destinație și radiere fără motiv: eroare pe câmpul lipsă", () => {
    expect(
      campuriCuEroare(iesireDinParcSchema.safeParse({ ...baza, tip: "dauna_totala" })),
    ).toEqual(["destinatie_epava"]);
    expect(campuriCuEroare(iesireDinParcSchema.safeParse({ ...baza, tip: "radiere" }))).toEqual([
      "motiv_radiere",
    ]);
  });

  it("`km_iesire` gol rămâne `null`, nu `0`", () => {
    const r = iesireDinParcSchema.parse({ ...baza, km_iesire: "" });
    expect(r.km_iesire).toBeNull();
    expect(iesireDinParcSchema.parse({ ...baza, km_iesire: "123456" }).km_iesire).toBe(123456);
  });

  it("km cu zecimale sau negativ: eroare pe `km_iesire`", () => {
    expect(
      campuriCuEroare(iesireDinParcSchema.safeParse({ ...baza, km_iesire: "1500,5" })),
    ).toEqual(["km_iesire"]);
    expect(campuriCuEroare(iesireDinParcSchema.safeParse({ ...baza, km_iesire: -1 }))).toEqual([
      "km_iesire",
    ]);
  });

  it("motivul sub 5 caractere: eroare pe `motiv`", () => {
    const r = iesireDinParcSchema.safeParse({ ...baza, motiv: "  abc  " });
    expect(campuriCuEroare(r)).toEqual(["motiv"]);
  });

  it("prețul și cumpărătorul la casare: eroare pe fiecare", () => {
    const r = iesireDinParcSchema.safeParse({
      ...baza,
      tip: "casare",
      pret: "1500",
      cumparator: "Fier Vechi SRL",
    });
    expect(campuriCuEroare(r).sort()).toEqual(["cumparator", "pret"]);
  });

  it("prețul și cumpărătorul la epava vândută: trec", () => {
    const r = iesireDinParcSchema.parse({
      ...baza,
      tip: "dauna_totala",
      destinatie_epava: "instrainata",
      pret: "1500",
      cumparator: "Dezmembrări SRL",
    });
    expect(r).toMatchObject({ pret: 1500, cumparator: "Dezmembrări SRL" });
  });

  it("păstrarea numărului la furt: eroare pe `pastreaza_numarul`; la export trece", () => {
    const furt = iesireDinParcSchema.safeParse({
      ...baza,
      tip: "radiere",
      motiv_radiere: "furt",
      pastreaza_numarul: true,
    });
    expect(campuriCuEroare(furt)).toEqual(["pastreaza_numarul"]);
    const exportul = iesireDinParcSchema.safeParse({
      ...baza,
      tip: "radiere",
      motiv_radiere: "export",
      pastreaza_numarul: true,
    });
    expect(exportul.success).toBe(true);
  });

  it('câmpurile ascunse trimise `null` (nu `""`) trec ca absente', () => {
    const r = iesireDinParcSchema.parse({
      ...baza,
      destinatie_epava: null,
      motiv_radiere: null,
      cumparator: null,
      pret: null,
    });
    expect(r).toMatchObject({
      destinatie_epava: null,
      motiv_radiere: null,
      cumparator: null,
      pret: null,
      pastreaza_numarul: false,
    });
  });
});

describe("predicatele", () => {
  it("înstrăinarea: vânzarea și epava vândută", () => {
    expect(eInstrainare("vanzare", null)).toBe(true);
    expect(eInstrainare("dauna_totala", "instrainata")).toBe(true);
    expect(eInstrainare("dauna_totala", "casata")).toBe(false);
    expect(eInstrainare("restituire_leasing", null)).toBe(false);
  });

  it("păstrarea numărului: nu la furt, depozitare și leasing", () => {
    expect(permitePastrareaNumarului("radiere", "furt")).toBe(false);
    expect(permitePastrareaNumarului("radiere", "retragere_depozitare")).toBe(false);
    expect(permitePastrareaNumarului("restituire_leasing", null)).toBe(false);
    expect(permitePastrareaNumarului("casare", null)).toBe(true);
  });
});

describe("finalizeazaObligatiaSchema", () => {
  const comun = { id: VEHICUL, vehicle_id: VEHICUL };

  it("„Făcut” fără dată: eroare pe `finalizat_la`", () => {
    const r = finalizeazaObligatiaSchema.safeParse({ ...comun, stare: "facut", finalizat_la: "" });
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join("."))).toEqual(["finalizat_la"]);
  });

  it("„Nu se aplică” fără dată: trece", () => {
    const r = finalizeazaObligatiaSchema.parse({
      ...comun,
      stare: "nu_se_aplica",
      finalizat_la: "",
    });
    expect(r).toMatchObject({ stare: "nu_se_aplica", finalizat_la: null, nota: null });
  });
});

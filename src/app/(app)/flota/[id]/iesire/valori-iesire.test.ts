// src/app/(app)/flota/[id]/iesire/valori-iesire.test.ts
import { describe, expect, it } from "vitest";

import { iesireDinParcSchema } from "@/schemas/flota-iesire";

import { valoriIesire } from "./valori-iesire";

const VEHICUL = "66666666-6666-4666-8666-666666666666";

function formular(campuri: Readonly<Record<string, string>>): FormData {
  const date = new FormData();
  for (const [cheie, valoare] of Object.entries(campuri)) date.set(cheie, valoare);
  return date;
}

const vanzare = {
  tip: "vanzare",
  data_iesire: "2026-10-19",
  km_iesire: "123456",
  motiv: "Vândută unui client",
  cumparator: "Ion Popescu",
  pret: "15000,50",
  nr_document: "C-17",
};

describe("valoriIesire", () => {
  it("bifa nebifată lipsește din FormData: `false`; bifată vine „on”: `true`", () => {
    expect(valoriIesire(formular(vanzare), VEHICUL).pastreaza_numarul).toBe(false);
    expect(
      valoriIesire(formular({ ...vanzare, pastreaza_numarul: "on" }), VEHICUL).pastreaza_numarul,
    ).toBe(true);
  });

  it("vânzarea: încărcătura trece de schemă, cu prețul tastat cu virgulă", () => {
    const r = iesireDinParcSchema.parse(valoriIesire(formular(vanzare), VEHICUL));
    expect(r).toMatchObject({
      vehicle_id: VEHICUL,
      tip: "vanzare",
      destinatie_epava: null,
      motiv_radiere: null,
      km_iesire: 123456,
      cumparator: "Ion Popescu",
      pret: 15000.5,
      nr_document: "C-17",
      observatii: null,
    });
  });

  it('câmpurile pe care felul ieșirii nu le cere pleacă `null`, nu `""` și nici rămase', () => {
    // Omul a ales întâi „Vânzare”, a completat cumpărătorul, apoi a trecut pe „Casare”.
    const v = valoriIesire(
      formular({
        ...vanzare,
        tip: "casare",
        destinatie_epava: "instrainata",
        motiv_radiere: "furt",
        pastreaza_numarul: "on",
      }),
      VEHICUL,
    );
    expect(v).toMatchObject({
      destinatie_epava: null,
      motiv_radiere: null,
      cumparator: null,
      pret: null,
      pastreaza_numarul: true,
    });
    expect(iesireDinParcSchema.safeParse(v).success).toBe(true);
  });

  it("radierea pentru furt: păstrarea numărului nu pleacă, chiar dacă bifa a rămas", () => {
    const v = valoriIesire(
      formular({ ...vanzare, tip: "radiere", motiv_radiere: "furt", pastreaza_numarul: "on" }),
      VEHICUL,
    );
    expect(v).toMatchObject({ motiv_radiere: "furt", pastreaza_numarul: false, cumparator: null });
  });

  it("epava vândută păstrează cumpărătorul și prețul", () => {
    const v = valoriIesire(
      formular({ ...vanzare, tip: "dauna_totala", destinatie_epava: "instrainata" }),
      VEHICUL,
    );
    expect(v).toMatchObject({
      destinatie_epava: "instrainata",
      cumparator: "Ion Popescu",
      pret: "15000.50",
    });
  });

  it("km gol rămâne `null`, nu `0`", () => {
    const v = valoriIesire(formular({ ...vanzare, km_iesire: "  " }), VEHICUL);
    expect(v.km_iesire).toBeNull();
    expect(iesireDinParcSchema.parse(v).km_iesire).toBeNull();
  });
});

// src/app/(app)/flota/rezervari/valori-rezervare.test.ts
import { describe, expect, it } from "vitest";

import { rezervareNouaSchema } from "@/schemas/fleet-rezervari";

import { motivDin, valoriRezervare } from "./valori-rezervare";

const ID_VEHICUL = "55555555-5555-4555-8555-555555555555";
const ID_ANGAJAT = "66666666-6666-4666-8666-666666666666";

function formular(campuri: Record<string, string>): FormData {
  const d = new FormData();
  for (const [k, v] of Object.entries(campuri)) d.set(k, v);
  return d;
}

describe("valoriRezervare", () => {
  it("datele și scopul trec neschimbate (fără spațiile de la capete)", () => {
    const v = valoriRezervare(
      formular({
        vehicle_id: ID_VEHICUL,
        de_la: "2026-10-15",
        pana_la: "2026-10-16",
        scop: "  Vizită la client  ",
        destinatie: "Cluj-Napoca",
        observatii: "Plin la întoarcere",
      }),
    );
    expect(v).toEqual({
      vehicle_id: ID_VEHICUL,
      employee_id: null,
      de_la: "2026-10-15",
      pana_la: "2026-10-16",
      scop: "Vizită la client",
      destinatie: "Cluj-Napoca",
      observatii: "Plin la întoarcere",
    });
  });

  it("câmpurile goale devin `null`, nu șirul gol", () => {
    const v = valoriRezervare(
      formular({
        vehicle_id: ID_VEHICUL,
        de_la: "2026-10-15",
        pana_la: "2026-10-15",
        scop: "Drum la bancă",
        destinatie: "   ",
        observatii: "",
      }),
    );
    expect(v.destinatie).toBeNull();
    expect(v.observatii).toBeNull();
  });

  it("selectul de angajat absent devine `null` (= „eu”); ales, trece ca id", () => {
    expect(valoriRezervare(formular({})).employee_id).toBeNull();
    expect(valoriRezervare(formular({ employee_id: "" })).employee_id).toBeNull();
    expect(valoriRezervare(formular({ employee_id: ID_ANGAJAT })).employee_id).toBe(ID_ANGAJAT);
  });

  it("ce produce trece de schema acțiunii", () => {
    const r = rezervareNouaSchema.safeParse(
      valoriRezervare(
        formular({
          vehicle_id: ID_VEHICUL,
          de_la: "2026-10-15",
          pana_la: "2026-10-16",
          scop: "Vizită la client",
        }),
      ),
    );
    expect(r.success).toBe(true);
  });

  it("motivul gol e `null`", () => {
    expect(motivDin(formular({ motiv: "  " }))).toBeNull();
    expect(motivDin(formular({ motiv: "Mașina e la service." }))).toBe("Mașina e la service.");
  });
});

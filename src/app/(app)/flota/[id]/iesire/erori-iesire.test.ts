// src/app/(app)/flota/[id]/iesire/erori-iesire.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";
import { eroarePostgrest } from "@/lib/teste/supabase-fals";

import { MESAJ_IESIRE_DUBLATA, MESAJ_NUMAR_OCUPAT, traduEroareIesire } from "./erori-iesire";

function prinde(error: unknown): ActionDenied {
  try {
    traduEroareIesire(error);
  } catch (e) {
    if (e instanceof ActionDenied) return e;
    throw e;
  }
  throw new Error("traduEroareIesire n-a aruncat");
}

const MIGRARE = readFileSync(
  join(process.cwd(), "supabase/migrations/0218_flota_iesire_din_parc.sql"),
  "utf8",
);

/** Mesajele P0001 scrise literal în migrare (`message = '…'`). */
const MESAJE_P0001 = [...MIGRARE.matchAll(/message = '((?:[^']|'')+)'/gu)].map((m) =>
  (m[1] ?? "").replaceAll("''", "'"),
);

/** Câmpul pe care trebuie să ajungă fiecare mesaj; restul sunt mesaje generale. */
const CAMP_ASTEPTAT: readonly (readonly [RegExp, string])[] = [
  [/^Data ieșirii/u, "data_iesire"],
  [/^Kilometrajul la ieșire/u, "km_iesire"],
  [/^Data la care s-a făcut pasul/u, "finalizat_la"],
  // F12h: incidentul se alege acum în casetă, deci refuzul lui stă pe câmp.
  [/^Incidentul ales/u, "incident_id"],
];

describe("traduEroareIesire", () => {
  it("migrarea are mesajele pe care le traduce fișierul", () => {
    expect(MESAJE_P0001.length).toBeGreaterThanOrEqual(15);
  });

  it.each(MESAJE_P0001)("P0001 „%s” ajunge pe câmpul lui sau ca mesaj general", (mesaj) => {
    const e = prinde(eroarePostgrest("P0001", mesaj));
    const camp = CAMP_ASTEPTAT.find(([re]) => re.test(mesaj))?.[1];
    if (camp === undefined) {
      expect(e).toMatchObject({ code: "CONFLICT", message: mesaj, fieldErrors: null });
    } else {
      expect(e).toMatchObject({ code: "VALIDARE", fieldErrors: { [camp]: [mesaj] } });
    }
  });

  it("„Vehiculul ales…” NU merge pe `vehicle_id`: în casetă e un câmp ascuns", () => {
    const e = prinde(
      eroarePostgrest("P0001", "Vehiculul ales nu aparține organizației dumneavoastră."),
    );
    expect(e.code).toBe("CONFLICT");
    expect(e.fieldErrors).toBeNull();
  });

  // INSERT-ul ieșirii scrie și în `vehicles` și `vehicle_assignments`: triggerele
  // lor vechi (0012–0173, `vehicles_normalizeaza`) au ş/ţ cu SEDILĂ în mesaje.
  // Traducerea flotei le corectează la afișare (`cuVirgula`); aceasta la fel.
  it("P0001 venit din triggerele vechi ale vehiculului: sedila devine virgulă", () => {
    const e = prinde(
      eroarePostgrest(
        "P0001",
        "Angajatul ales pentru vehicul nu aparţine organizaţiei dumneavoastră.",
      ),
    );
    expect(e).toMatchObject({
      code: "CONFLICT",
      message: "Angajatul ales pentru vehicul nu aparține organizației dumneavoastră.",
    });
  });

  it("kilometrajul cu cifre din bază (format) ajunge pe `km_iesire`, cu cifrele", () => {
    const mesaj =
      "Kilometrajul la ieșire (9000 km) este mai mic decât ultimul cunoscut al vehiculului (10000 km).";
    expect(prinde(eroarePostgrest("P0001", mesaj))).toMatchObject({
      code: "VALIDARE",
      fieldErrors: { km_iesire: [mesaj] },
    });
  });

  it("23505 pe `vexit_vie_uq`: a doua ieșire vie a vehiculului", () => {
    const e = prinde(
      eroarePostgrest("23505", 'duplicate key value violates unique constraint "vexit_vie_uq"'),
    );
    expect(e).toMatchObject({ code: "CONFLICT", message: MESAJ_IESIRE_DUBLATA });
  });

  it.each(["vehicles_org_nr_uq", "vehicles_org_vin_uq"])(
    "23505 pe `%s` la anulare: numărul s-a pus pe alt vehicul",
    (index) => {
      const e = prinde(
        eroarePostgrest("23505", `duplicate key value violates unique constraint "${index}"`),
      );
      expect(e).toMatchObject({ code: "CONFLICT", message: MESAJ_NUMAR_OCUPAT });
    },
  );

  it("23514 pe `va_km_ck` (garda ocolită de o cursă) ajunge pe `km_iesire`", () => {
    const e = prinde(
      eroarePostgrest(
        "23514",
        'new row for relation "vehicle_assignments" violates check constraint "va_km_ck"',
      ),
    );
    expect(e.code).toBe("VALIDARE");
    expect(Object.keys(e.fieldErrors ?? {})).toEqual(["km_iesire"]);
  });

  it.each([
    ["vexit_cumparator_ck", "cumparator"],
    ["vexit_pret_ck", "pret"],
    ["vexit_pastreaza_ck", "pastreaza_numarul"],
    ["vexit_anulare_ck", "motiv_anulare"],
    ["vexob_inchis_ck", "stare"],
  ])("23514 pe `%s` ajunge pe `%s`", (check, camp) => {
    const e = prinde(eroarePostgrest("23514", `violates check constraint "${check}"`));
    expect(e.code).toBe("VALIDARE");
    expect(Object.keys(e.fieldErrors ?? {})).toEqual([camp]);
  });

  it("fiecare CHECK din hartă există în migrare (altfel tiparul n-ar prinde nimic)", () => {
    for (const check of [
      "vexit_epava_ck",
      "vexit_radiere_ck",
      "vexit_km_ck",
      "vexit_motiv_ck",
      "vexit_cumparator_ck",
      "vexit_pret_ck",
      "vexit_nr_document_ck",
      "vexit_observatii_ck",
      "vexit_pastreaza_ck",
      "vexit_anulare_ck",
      "vexob_inchis_ck",
      "vexob_nota_ck",
    ]) {
      expect(MIGRARE).toContain(`constraint ${check} check`);
    }
  });

  it("ce nu recunoaște cade pe traducerea generică a flotei", () => {
    expect(() => {
      traduEroareIesire(new Error("altceva"));
    }).toThrow("altceva");
  });
});

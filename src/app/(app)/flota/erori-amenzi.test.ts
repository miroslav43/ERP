// src/app/(app)/flota/erori-amenzi.test.ts
//
// Traducerea refuzurilor bazei pentru amenzi și incidente (0206, F11). Fișier
// separat de `erori.test.ts`, pe care îl scriu și fazele paralele.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";

import { traduEroareAmenzi } from "./erori";

function pgEroare(code: string, message: string) {
  return { code, message, details: "", hint: "", name: "PostgrestError" };
}

function prinde(error: unknown): ActionDenied {
  try {
    traduEroareAmenzi(error);
  } catch (e) {
    if (e instanceof ActionDenied) return e;
    throw e;
  }
  throw new Error("traduEroareAmenzi n-a aruncat");
}

describe("traduEroareAmenzi — restricțiile ajung pe câmp", () => {
  it.each([
    ["23505", 'duplicate key value violates unique constraint "vf_numar_uq"', "numar_pv"],
    ["23503", 'violates foreign key constraint "vf_sofer_fk"', "employee_id"],
    ["23503", 'violates foreign key constraint "vi_sofer_fk"', "sofer_id"],
    ["23514", 'violates check constraint "vf_suma_ck"', "suma"],
    ["23514", 'violates check constraint "vf_anulata_ck"', "motiv"],
    ["23514", 'violates check constraint "vi_asigurator_stadiu_ck"', "asigurator"],
  ])("%s %s → %s", (cod, mesaj, camp) => {
    const eroare = prinde(pgEroare(cod, mesaj));
    expect(eroare.code).toBe("VALIDARE");
    expect(Object.keys(eroare.fieldErrors ?? {})).toEqual([camp]);
  });

  it("o restricție necunoscută cade pe traducerea generală a flotei", () => {
    const eroare = prinde(pgEroare("23505", 'violates unique constraint "altceva_uq"'));
    expect(eroare.code).toBe("CONFLICT");
    expect(eroare.fieldErrors).toBeNull();
  });
});

describe("traduEroareAmenzi — mesajele triggerelor din 0206", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/0206_flota_amenzi_daune.sql"),
    "utf8",
  );

  /** Primul literal de după `message =`, cu `''` desfăcut în `'`. */
  function mesajeleTriggerelor(): readonly string[] {
    const gasite: string[] = [];
    const re = /message = (?:format\()?'((?:[^']|'')*)'/gu;
    for (const potrivire of sql.matchAll(re)) {
      gasite.push((potrivire[1] ?? "").replace(/''/gu, "'"));
    }
    return gasite;
  }

  /** Refuzurile de stadiu: nu țin de un câmp, rămân mesaj general. */
  const GENERALE: readonly RegExp[] = [
    /^Amenda a fost ștearsă/u,
    /^Amenda nu se mută/u,
    /^Amenda este %s/u,
    /^Amenda nu poate trece/u,
    /^O amendă aflată în lucru/u,
    /^După trimiterea răspunsului/u,
    /^Incidentul a fost șters/u,
    /^Incidentul nu se mută/u,
    /^Incidentul este închis/u,
    /^Un incident aflat în lucru/u,
    // 0206 §F, declarația șoferului: nu țin de un câmp al formularului.
    /^Declarantul unui incident/u,
    /^Contul dumneavoastră nu e legat de o fișă de angajat/u,
  ];

  const mesaje = mesajeleTriggerelor();

  it("migrarea are mesajele de verificat (plasă împotriva unui regex care nu mai prinde nimic)", () => {
    expect(mesaje.length).toBeGreaterThanOrEqual(25);
    expect(mesaje.every((m) => m.length > 0)).toBe(true);
  });

  it("fiecare mesaj din trigger e fie mapat pe un câmp, fie declarat general", () => {
    for (const mesaj of mesaje) {
      // Mesajele cu `%s` au șablon: se judecă după începutul lor.
      const probe = mesaj.replace(/%s/gu, "x");
      const eroare = prinde(pgEroare("P0001", probe));
      const general = GENERALE.some((re) => re.test(mesaj));
      if (general) {
        expect(eroare.fieldErrors, mesaj).toBeNull();
        expect(eroare.code, mesaj).toBe("CONFLICT");
      } else {
        expect(Object.keys(eroare.fieldErrors ?? {}).length, `fără câmp: ${mesaj}`).toBeGreaterThan(
          0,
        );
        expect(eroare.code, mesaj).toBe("VALIDARE");
      }
    }
  });

  it("mesajele noi folosesc ș și ț cu virgulă, nu cu sedilă", () => {
    expect(mesaje.join("\n")).not.toMatch(/[şţŞŢ]/u);
  });

  it("mesajele se termină cu punct", () => {
    for (const mesaj of mesaje) {
      expect(mesaj.endsWith("."), mesaj).toBe(true);
    }
  });

  it("câmpul ales e cel potrivit pentru cele mai frecvente refuzuri", () => {
    const cazuri: readonly (readonly [string, string])[] = [
      [
        "Vehiculul ales nu vă era alocat în ziua incidentului și nu este o mașină comună (pool). Declarați incidentul pe mașina primită în folosință.",
        "vehicle_id",
      ],
      ["Alegeți șoferul pe care îl comunicați autorității.", "employee_id"],
      ["Scrieți data la care a plecat răspunsul către autoritate.", "raspuns_trimis_la"],
      ["Data trimiterii răspunsului nu poate fi în viitor.", "raspuns_trimis_la"],
      ["Scrieți motivul anulării.", "motiv"],
      ["Termenul de răspuns nu poate fi înaintea datei primirii.", "termen_raspuns"],
      ["Scrieți numele asigurătorului la care ați înregistrat dauna.", "asigurator"],
      [
        "Scrieți costul final al daunei (0 dacă n-a fost nimic de plătit) înainte de închidere.",
        "cost_final",
      ],
      ["Cercetarea SSM aleasă nu aparține organizației dumneavoastră.", "work_accident_id"],
    ];
    for (const [mesaj, camp] of cazuri) {
      expect(Object.keys(prinde(pgEroare("P0001", mesaj)).fieldErrors ?? {}), mesaj).toEqual([
        camp,
      ]);
    }
  });

  it("mesajul de stadiu păstrează textul din bază, cu cifrele lui", () => {
    const mesaj = "Amenda nu poate trece din stadiul „primită” în „răspuns trimis”.";
    const eroare = prinde(pgEroare("P0001", mesaj));
    expect(eroare.code).toBe("CONFLICT");
    expect(eroare.message).toBe(mesaj);
  });
});

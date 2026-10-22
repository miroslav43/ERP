// src/app/(app)/flota/rezervari/erori.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";
import { eroarePostgrest } from "@/lib/teste/supabase-fals";

import { MESAJ_SUPRAPUNERE, traduEroareRezervare } from "./erori";

function prinde(error: unknown): ActionDenied {
  try {
    traduEroareRezervare(error);
  } catch (e) {
    if (e instanceof ActionDenied) return e;
    throw e;
  }
  throw new Error("traduEroareRezervare n-a aruncat");
}

const MIGRARE = readFileSync(
  join(process.cwd(), "supabase/migrations/0216_flota_rezervari.sql"),
  "utf8",
);

/** Literalele mesajelor P0001 ale migrării (cu `%s` din `format(...)`, nerezolvat). */
function mesajeleMigrarii(): readonly string[] {
  return [...MIGRARE.matchAll(/message = (?:format\()?'([^']+)'/gu)].map((m) => m[1] ?? "");
}

describe("traduEroareRezervare", () => {
  it("suprapunerea (23P01) ajunge pe ambele zile, fără detaliile cu uuid-uri", () => {
    const e = prinde(
      eroarePostgrest(
        "23P01",
        'conflicting key value violates exclusion constraint "vr_fara_suprapunere"',
      ),
    );
    expect(e).toMatchObject({
      code: "VALIDARE",
      message: MESAJ_SUPRAPUNERE,
      fieldErrors: { de_la: [MESAJ_SUPRAPUNERE], pana_la: [MESAJ_SUPRAPUNERE] },
    });
    expect(e.message).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/u);
  });

  it.each([
    ["Rezervarea începe cel mai devreme astăzi.", "de_la"],
    ["Rezervarea depășește durata maximă de 14 zile stabilită de firmă.", "pana_la"],
    [
      "Rezervarea nu se poate prelungi. Faceți o rezervare nouă pentru zilele următoare.",
      "pana_la",
    ],
    ["Rezervarea se poate scurta cel mult până astăzi și nu înaintea primei ei zile.", "pana_la"],
    [
      "Rezervarea are foaie de parcurs pe 15.10.2026; nu se poate scurta înaintea acestei zile.",
      "pana_la",
    ],
    ["Scrieți motivul respingerii; angajatul îl primește în notificare.", "motiv"],
    [
      "Scrieți motivul anulării: rezervarea nu este a dumneavoastră, iar angajatul îl primește în notificare.",
      "motiv",
    ],
    [
      "Vehiculul nu este o mașină de pool. Se rezervă doar mașinile comune; celelalte au șofer prin alocare.",
      "vehicle_id",
    ],
    ["Vehiculul are deja foaia de parcurs a altui șofer pe 15.10.2026.", "vehicle_id"],
    ["Angajatul ales nu aparține organizației dumneavoastră.", "employee_id"],
  ])("P0001 „%s” → %s", (mesaj, camp) => {
    const e = prinde(eroarePostgrest("P0001", mesaj));
    expect(e.code).toBe("VALIDARE");
    expect(e.message).toBe(mesaj);
    expect(Object.keys(e.fieldErrors ?? {})).toEqual([camp]);
  });

  it("auto-aprobarea și mesajele fără câmp devin regulă de business, propagate ca atare", () => {
    const mesaj =
      "Nu vă puteți aproba sau respinge propria rezervare. Decizia o ia managerul sau responsabilul de flotă.";
    expect(prinde(eroarePostgrest("P0001", mesaj))).toMatchObject({
      code: "CONFLICT",
      message: mesaj,
      fieldErrors: null,
    });
  });

  it("un mesaj necunoscut devine businessRule, tăiat la 300 de caractere", () => {
    const e = prinde(eroarePostgrest("P0001", `Altceva. ${"x".repeat(400)}`));
    expect(e.code).toBe("CONFLICT");
    expect(e.message.length).toBe(300);
  });

  it("CHECK-urile tabelei ajung pe câmp", () => {
    expect(
      prinde(eroarePostgrest("23514", 'violates check constraint "vr_scop_len"')).fieldErrors,
    ).toEqual({ scop: ["Scopul are între 3 și 300 de caractere."] });
    expect(
      prinde(eroarePostgrest("23514", 'violates check constraint "vr_interval_ck"')).fieldErrors,
    ).toEqual({ pana_la: ["Ultima zi nu poate fi înaintea primei zile."] });
  });

  it("ce nu recunoaște aruncă mai departe, neschimbat (îl preia mapPostgrestError)", () => {
    const brut = eroarePostgrest("42501", "new row violates row-level security policy");
    expect(() => traduEroareRezervare(brut)).toThrow(brut as unknown as Error);
  });

  it("fiecare CHECK numit în traducere există în migrare", () => {
    for (const nume of [
      "vr_interval_ck",
      "vr_scop_len",
      "vr_destinatie_len",
      "vr_observatii_len",
      "vr_motiv_respingere_len",
      "vr_motiv_anulare_len",
      "vr_respinsa_cu_motiv",
    ]) {
      expect(MIGRARE, nume).toContain(`constraint ${nume} check`);
    }
  });

  it("mesajele bazei citate de tipare există în migrare, cu ș/ț cu virgulă și punct final", () => {
    const mesaje = mesajeleMigrarii();
    expect(mesaje.length).toBeGreaterThan(20);
    for (const inceput of [
      "Rezervarea începe",
      "Rezervarea depășește",
      "Rezervarea nu se poate prelungi",
      "Rezervarea se poate scurta",
      "Rezervarea are foaie",
      "Scrieți motivul respingerii",
      "Scrieți motivul anulării",
      "Vehiculul nu este o mașină de pool",
      "Angajatul ales",
    ]) {
      expect(
        mesaje.some((m) => m.startsWith(inceput)),
        inceput,
      ).toBe(true);
    }
    for (const m of mesaje) {
      expect(m, m).not.toMatch(/[şţŞŢ]/u);
      expect(m.endsWith("."), m).toBe(true);
    }
  });
});

// src/config/migrari.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Invarianți de FIȘIER peste migrări, nu de conținut SQL.
 *
 * ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
 * `banc-migrare.sh` raportează ✓ pentru o migrare care deschide `begin;` și nu
 * o închide niciodată: `psql` iese fără eroare, iar tranziția e ROLLBACK tăcut.
 * Migrarea „trece", nu schimbă nimic, iar defectul se vede abia la prima
 * folosire a obiectului care ar fi trebuit creat — de obicei în producție.
 *
 * S-a întâmplat: patru migrări scrise în aceeași sesiune aveau secțiunea „Note
 * de proiectare" DUPĂ locul unde ar fi trebuit să fie `commit;`, iar bancul le-a
 * raportat pe toate ca aplicate. Funcția `public.aloca_numar_contract` lipsea
 * din bază, cu bancul verde.
 *
 * Poarta e ieftină și nu poate da fals pozitiv: numără instrucțiuni la începutul
 * rândului, forma pe care o folosesc toate migrările proiectului.
 */
const DIRECTOR = join(process.cwd(), "supabase/migrations");

const migrari = readdirSync(DIRECTOR)
  .filter((nume) => nume.endsWith(".sql"))
  .sort()
  .map((nume) => ({ nume, sursa: readFileSync(join(DIRECTOR, nume), "utf8") }));

/** Instrucțiuni la începutul rândului — forma folosită de toate migrările. */
function numara(sursa: string, cuvant: "begin" | "commit"): number {
  const tipar = new RegExp(`^${cuvant};\\s*$`, "gmu");
  return (sursa.match(tipar) ?? []).length;
}

describe("migrări — invarianți de fișier", () => {
  it("găsește migrările", () => {
    // Fără asta, o redenumire de director ar face testul verde pe zero fișiere.
    expect(migrari.length).toBeGreaterThan(50);
  });

  it("fiecare `begin;` are `commit;`", () => {
    const vinovate = migrari
      .map((m) => ({
        nume: m.nume,
        begin: numara(m.sursa, "begin"),
        commit: numara(m.sursa, "commit"),
      }))
      .filter((m) => m.begin !== m.commit)
      .map((m) => `${m.nume} (begin=${String(m.begin)}, commit=${String(m.commit)})`);

    expect(
      vinovate,
      `Tranzacție nedeschisă sau neînchisă. O migrare cu \`begin;\` fără \`commit;\` ` +
        `iese din psql fără eroare, dar face ROLLBACK: bancul o raportează ✓ și baza ` +
        `rămâne neschimbată.\n${vinovate.join("\n")}`,
    ).toEqual([]);
  });

  /*
   * NU se verifică `\set ON_ERROR_STOP on` în fișier.
   *
   * Peste 60 de migrări din depozit nu îl au, iar asta e în regulă: atât
   * `banc-migrare.sh` cât și jobul din CI îl dau pe linia de comandă
   * (`psql -v ON_ERROR_STOP=1`), unde acoperă TOATE fișierele, inclusiv pe cele
   * scrise înainte de convenție. O poartă care marchează 60 de fișiere corecte
   * drept greșite nu e o poartă, e zgomot pe care oamenii învață să-l ignore.
   */

  it("numerele de migrare sunt unice", () => {
    // Repo-ul e lucrat de mai multe sesiuni în paralel; două migrări cu același
    // număr se aplică în ordine alfabetică, adică la noroc.
    //
    // Sufixul de literă face parte din număr, nu e o coliziune: `0010b` și
    // `0012b` sunt reparații scrise DUPĂ migrarea pe care o completează și
    // înaintea următoarei, o convenție deja folosită în depozit.
    const dupaNumar = new Map<string, string[]>();
    for (const m of migrari) {
      const numar = /^(\d{4}[a-z]?)_/u.exec(m.nume)?.[1] ?? m.nume;
      dupaNumar.set(numar, [...(dupaNumar.get(numar) ?? []), m.nume]);
    }
    const duplicate = [...dupaNumar.entries()]
      .filter(([, fisiere]) => fisiere.length > 1)
      .map(([numar, fisiere]) => `${numar}: ${fisiere.join(", ")}`);

    expect(
      duplicate,
      `Coliziune de numerotare. Regula proiectului: îți redenumești PROPRIA migrare.\n${duplicate.join("\n")}`,
    ).toEqual([]);
  });
});

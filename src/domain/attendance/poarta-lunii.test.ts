// src/domain/attendance/poarta-lunii.test.ts
//
// POARTA: niciun ecran nu-și mai scrie singur regula „se poate ponta în luna
// asta?".
//
// ── DEFECTUL PE CARE ÎL PRINDE ──────────────────────────────────────────────
// Baza refuză scrierea EXCLUSIV pentru `blocata` (`0013_attendance.sql:293`),
// iar din `0132` luna fără rând e neîncepută, nu interzisă. Trei pagini din
// portal cereau însă `status === "deschisa"`, adică refuzau și `in_aprobare`,
// și luna fără rând.
//
// Nu era o eroare care se vede: baza n-a fost niciodată atinsă, deci nu exista
// nici mesaj, nici log — doar un ecran care spunea politicos „luna nu este
// deschisă pentru pontaj" pentru o lună în care baza îl lăsa pe om să scrie.
//
// Consecința reală, reclamată pe 11 sept 2026: aprobarea unui lot mută luna în
// `in_aprobare` (`aprobaPontajBloc`), iar din clipa aia portalul refuza
// TUTUROR angajaților orice corecție pe luna curentă — inclusiv exact corecția
// pe care o zi respinsă tocmai le-o cerea. Ți se cerea să repari ceva ce
// ecranul nu te lăsa să atingi.
//
// ── DE CE UN SCANNER, ȘI NU DOAR TESTELE LUI `stareaLunii` ──────────────────
// `luna.test.ts` verifică de la 0132 că `in_aprobare` rămâne deschisă, și
// trecea verde tot timpul cât portalul era stricat: regula era corectă, doar
// că trei ecrane n-o foloseau. Ce se apără aici nu e regula, ci faptul că e
// SINGURA.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const RADACINA = join(import.meta.dirname, "..", "..");

/** Aceeași plimbare ca în `src/config/filtru-gol.test.ts`, fără dependență nouă. */
function plimba(dir: string): string[] {
  const gasite: string[] = [];
  for (const intrare of readdirSync(dir, { withFileTypes: true })) {
    const cale = join(dir, intrare.name);
    if (intrare.isDirectory()) gasite.push(...plimba(cale));
    else if (/\.tsx?$/u.test(intrare.name) && !/\.test\.tsx?$/u.test(intrare.name))
      gasite.push(cale);
  }
  return gasite;
}

/**
 * O comparație cu `"deschisa"` folosită ca poartă.
 *
 * Se caută doar în COD, nu în comentarii: cele trei reparații își explică
 * fiecare defectul citând condiția veche, iar un scanner care nu face
 * diferența ar interzice tocmai explicația.
 */
const POARTA = /(?<![/*])\bstatus\s*!==\s*"deschisa"/;

/** Rândurile de comentariu, scoase înainte de căutare. */
function faraComentarii(sursa: string): string {
  return sursa
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .split("\n")
    .filter((rand) => !rand.trimStart().startsWith("//"))
    .join("\n");
}

describe("poarta lunii de pontaj", () => {
  const fisiere = plimba(join(RADACINA, "app")).concat(plimba(join(RADACINA, "components")));

  it("găsește fișiere de analizat", () => {
    expect(fisiere.length).toBeGreaterThan(100);
  });

  it("niciun ecran nu refuză o lună doar fiindcă nu e `deschisa`", () => {
    const vinovate = fisiere.filter((cale) =>
      POARTA.test(faraComentarii(readFileSync(cale, "utf8"))),
    );

    expect(
      vinovate.map((cale) => relative(RADACINA, cale)),
      "Baza refuză doar `blocata`, iar luna fără rând e neîncepută, nu interzisă. " +
        "Folosiți `stareaLunii(...).deschisa` din `src/domain/attendance/luna.ts` — " +
        "un ecran mai strict decât baza refuză tăcut ceva ce baza acceptă.",
    ).toEqual([]);
  });
});

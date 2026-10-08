// src/domain/calendar/sarbatori.paritate-sql.test.ts
//
// Aceeași listă de sărbători trăiește în două limbaje: `sarbatoriAnului` (unelte
// publice, cererea de concediu, foaia de pontaj) și seed-ul `public_holidays`
// din 0009 (modulul de concedii, `app.este_zi_lucratoare`). Auditul din 8 oct
// 2026 a găsit că nimic nu le ține lipite. Testul citește seed-ul ca text și îl
// recalculează cu Paștele din TypeScript; `paste-ortodox.ts` declară că
// reproduce exact `internal.paste_ortodox`.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { pasteOrtodox } from "./paste-ortodox";
import { sarbatoriAnului } from "./sarbatori";

const MIGRARI = join(__dirname, "..", "..", "..", "supabase", "migrations");
const SEED = readFileSync(join(MIGRARI, "0009_leave.sql"), "utf8");

const iso = (d: Date) => d.toISOString().slice(0, 10);

function aniiSeedului(): readonly number[] {
  const m = /from generate_series\((\d{4}),\s*(\d{4})\)\s+as\s+s\(an\)/u.exec(SEED);
  expect(m, "generate_series(…) as s(an) a dispărut din seed").not.toBeNull();
  const [de, pana] = [Number(m?.[1]), Number(m?.[2])];
  return Array.from({ length: pana - de + 1 }, (_, i) => de + i);
}

function seedulPentru(an: number): readonly string[] {
  const zile: string[] = [];
  for (const [, luna, zi] of SEED.matchAll(
    /\(make_date\(s\.an,\s*(\d{1,2}),\s*(\d{1,2})\),\s*'/gu,
  )) {
    zile.push(iso(new Date(Date.UTC(an, Number(luna) - 1, Number(zi)))));
  }
  const paste = pasteOrtodox(an);
  for (const [, semn, n] of SEED.matchAll(
    /\(internal\.paste_ortodox\(s\.an\)(?:\s*([+-])\s*(\d+))?,\s*'/gu,
  )) {
    const decalaj = n === undefined ? 0 : (semn === "-" ? -1 : 1) * Number(n);
    zile.push(iso(new Date(paste.getTime() + decalaj * 86_400_000)));
  }
  return [...new Set(zile)].sort();
}

describe("sarbatoriAnului ↔ seed-ul public_holidays (0009_leave.sql)", () => {
  it("seed-ul are 12 sărbători fixe și 5 mobile (dacă se schimbă, se schimbă testul cu el)", () => {
    expect([...SEED.matchAll(/\(make_date\(s\.an,/gu)].length).toBe(12);
    expect([...SEED.matchAll(/\(internal\.paste_ortodox\(s\.an\)/gu)].length).toBe(5);
  });

  it.each(aniiSeedului())("anul %i: aceleași zile", (an) => {
    const ts = [...new Set(sarbatoriAnului(an).map((s) => iso(s.data)))].sort();
    expect(ts).toEqual(seedulPentru(an));
  });

  it("nicio altă migrare nu inserează sau șterge sărbători legale", () => {
    // O migrare nouă care adaugă un an sau o sărbătoare trebuie să extindă
    // testul de față, nu să ocolească paritatea.
    const altele = readdirSync(MIGRARI)
      .filter((f) => f.endsWith(".sql") && f !== "0009_leave.sql")
      .filter((f) =>
        /(insert\s+into|delete\s+from|update)\s+public\.public_holidays\b/iu.test(
          readFileSync(join(MIGRARI, f), "utf8"),
        ),
      );
    expect(altele).toEqual([]);
  });
});

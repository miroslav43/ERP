// src/app/(marketing)/unelte/calculator-zile-lucratoare/calcul.ts
import {
  AN_MAX_INTERVAL,
  AN_MIN_INTERVAL,
  aNaZiLucratoareDupa,
  dataLunga,
  MAX_ZILE_DE_ADAUGAT,
  numaraInterval,
  sarbatoriSarite,
  ziValida,
  type IntervalLucrator,
  type SarbatoareInInterval,
  type ZiIso,
} from "@/domain/calendar/interval-lucrator";

import { zileLucratoareText } from "../cerere-concediu-de-odihna/text-zile";

/**
 * Calculatorul de zile lucrătoare: două întrebări, un singur calendar.
 *
 * „Între două date” numără ambele capete, ca o cerere de concediu. „Peste N
 * zile lucrătoare” nu numără ziua de pornire, ca un termen de preaviz
 * (`aNaZiLucratoareDupa`). Formular GET, ca restul uneltelor: rezultatul stă
 * în adresă și se poate trimite.
 *
 * O dată greșită NU e înlocuită tăcut: se spune pe nume, iar pagina nu arată
 * un rezultat pentru alte date decât cele cerute.
 */

export type Mod = "interval" | "adauga";

export type CitireCalcul = Readonly<{
  mod: Mod;
  deLa: ZiIso;
  panaLa: ZiIso;
  zile: number;
  probleme: readonly string[];
}>;

export type RezultatCalcul =
  | Readonly<{ mod: "interval"; interval: IntervalLucrator }>
  | Readonly<{
      mod: "adauga";
      deLa: ZiIso;
      zile: number;
      rezultat: ZiIso;
      sarite: readonly SarbatoareInInterval[];
    }>;

const ZILE_IMPLICITE = 20;

function ultimaZiALunii(azi: ZiIso): ZiIso {
  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));
  const zi = new Date(Date.UTC(an, luna, 0)).getUTCDate();
  return `${azi.slice(0, 8)}${String(zi).padStart(2, "0")}`;
}

export function citesteCalculul(q: URLSearchParams, azi: ZiIso): CitireCalcul {
  const mod: Mod = q.get("mod") === "adauga" ? "adauga" : "interval";
  const probleme: string[] = [];

  const data = (cheie: string, eticheta: string, implicit: ZiIso): ZiIso => {
    const brut = (q.get(cheie) ?? "").trim();
    if (brut === "") return implicit;
    const valida = ziValida(brut);
    if (valida === null) {
      probleme.push(
        `${eticheta}: „${brut.slice(0, 20)}” nu e o zi reală între ${String(AN_MIN_INTERVAL)} și ${String(AN_MAX_INTERVAL)}.`,
      );
      return implicit;
    }
    return valida;
  };

  const deLa = data("de_la", "De la", `${azi.slice(0, 8)}01`);
  const panaLa =
    mod === "interval" ? data("pana_la", "Până la", ultimaZiALunii(azi)) : ultimaZiALunii(azi);

  let zile = ZILE_IMPLICITE;
  const brutZile = (q.get("zile") ?? "").trim();
  if (mod === "adauga" && brutZile !== "") {
    const n = Number(brutZile);
    if (!Number.isInteger(n) || n < 0 || n > MAX_ZILE_DE_ADAUGAT) {
      probleme.push(
        `Zile lucrătoare: „${brutZile.slice(0, 10)}” nu e un număr întreg între 0 și ${String(MAX_ZILE_DE_ADAUGAT)}.`,
      );
    } else {
      zile = n;
    }
  }

  if (mod === "interval" && probleme.length === 0 && panaLa < deLa) {
    probleme.push("Data de sfârșit e înaintea celei de început.");
  }
  return { mod, deLa, panaLa, zile, probleme };
}

/** Aruncă `RangeError` (cu mesaj gata de afișat) pentru un termen dincolo de calendar. */
export function calculeaza(c: CitireCalcul): RezultatCalcul {
  if (c.mod === "interval") return { mod: "interval", interval: numaraInterval(c.deLa, c.panaLa) };
  const rezultat = aNaZiLucratoareDupa(c.deLa, c.zile);
  return {
    mod: "adauga",
    deLa: c.deLa,
    zile: c.zile,
    rezultat,
    sarite: sarbatoriSarite(c.deLa, rezultat),
  };
}

/** Titlul benzii de rezultat: numărul, respectiv data. */
export function titluRezultat(r: RezultatCalcul): string {
  return r.mod === "interval"
    ? zileLucratoareText(r.interval.zileLucratoare)
    : dataLunga(r.rezultat);
}

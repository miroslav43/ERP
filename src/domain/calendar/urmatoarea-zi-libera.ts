// src/domain/calendar/urmatoarea-zi-libera.ts
/**
 * Următoarea zi liberă a angajatului: concediul lui aprobat sau sărbătoarea
 * legală, care vine prima.
 *
 * E întrebarea pe care omul o pune cel mai des unui portal de HR, iar azi
 * portalul nu răspunde la ea nicăieri: soldul spune câte zile mai are, nu când
 * urmează prima. Sărbătorile nu apar deloc.
 *
 * Funcție PURĂ. Sărbătorile vin din `sarbatoriAnului`, care e tot pură și
 * oglindește seed-ul `public_holidays` din `0009_leave.sql` — deci răspunsul nu
 * costă nicio interogare. Concediile sunt cele deja citite de pagină
 * (`cererileMele`).
 */

import { sarbatoriAnului } from "./sarbatori";

const ZI_ISO = /^\d{4}-\d{2}-\d{2}$/u;

/** Statusul unei cereri care chiar produce zile libere. */
const APROBATA = "aprobata";

export type SursaZiLibera = "concediu" | "sarbatoare";

export type ZiLibera = Readonly<{
  /** `YYYY-MM-DD`. */
  data: string;
  denumire: string;
  sursa: SursaZiLibera;
}>;

/** Partea care contează dintr-o cerere deja citită. */
export interface CerereCitita {
  readonly data_inceput: string;
  readonly status: string;
}

function iso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/**
 * Prima zi liberă STRICT după `azi`, sau `null` dacă nu se vede niciuna în
 * următoarele douăsprezece luni.
 *
 * Strict după, nu de azi încolo: dacă omul e în concediu chiar acum, cardul
 * „Astăzi" scrie deja „Concediu de odihnă". Repetat aici ca „următoarea", ar fi
 * o minciună mică despre ziua în care se află.
 */
export function urmatoareaZiLibera(azi: string, cereri: readonly CerereCitita[]): ZiLibera | null {
  if (!ZI_ISO.test(azi)) return null;

  const an = Number(azi.slice(0, 4));
  if (Number.isNaN(an)) return null;

  // Anul curent ȘI următorul: pe 20 decembrie, următoarea sărbătoare e tot în
  // decembrie, dar pe 27 e Anul Nou — adică în anul celălalt. Cu un singur an
  // căutat, cardul ar tăcea exact în săptămâna în care e cel mai interesant.
  const sarbatoare = [...sarbatoriAnului(an), ...sarbatoriAnului(an + 1)]
    .map((s): ZiLibera => ({ data: iso(s.data), denumire: s.denumire, sursa: "sarbatoare" }))
    .filter((s) => s.data > azi)
    .sort((a, b) => a.data.localeCompare(b.data))[0];

  const concediu = cereri
    .filter((c) => c.status === APROBATA && ZI_ISO.test(c.data_inceput) && c.data_inceput > azi)
    .map((c): ZiLibera => ({
      data: c.data_inceput,
      denumire: "Concediu aprobat",
      sursa: "concediu",
    }))
    .sort((a, b) => a.data.localeCompare(b.data))[0];

  if (concediu === undefined) return sarbatoare ?? null;
  if (sarbatoare === undefined) return concediu;

  // La egalitate câștigă concediul: o sărbătoare care cade în mijlocul
  // concediului tău nu e „următoarea ta zi liberă", e aceeași zi.
  return concediu.data <= sarbatoare.data ? concediu : sarbatoare;
}

/** Câte zile mai sunt până la `tinta`, numărate calendaristic. */
export function zilePanaLa(azi: string, tinta: string): number | null {
  if (!ZI_ISO.test(azi) || !ZI_ISO.test(tinta)) return null;
  const a = Date.parse(`${azi}T00:00:00Z`);
  const b = Date.parse(`${tinta}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

// src/app/(app)/pontaj/avertismente.ts
/**
 * Ce citește produsul ca să poată spune „atenție" după o scriere de pontaj.
 *
 * Aritmetica NU e aici — e în `src/domain/attendance/limite-legale.ts`, pură și
 * testată. Aici e doar drumul până la ea: ce interval de zile trebuie adus,
 * cum se aduce dintr-un singur drum la bază, și cum se traduce un rând din
 * `attendance_entries` în ce înțelege domeniul.
 *
 * ── DE CE UN MODUL, NU CÂTE O BUCATĂ ÎN FIECARE ACȚIUNE ───────────────────
 * Cele două căi de scriere — ziua individuală și planul săptămânii — au nevoie
 * de aceleași verificări. Două copii ale intervalului de citire ar diverge la
 * prima schimbare a perioadei de referință, iar divergența s-ar vedea ca „la
 * mine apare avertismentul, la colegul meu nu".
 *
 * Fișier `.ts` simplu, FĂRĂ „use server": nu e o acțiune, e o funcție de
 * server pe care o cheamă acțiunile. Un `"use server"` aici ar face din fiecare
 * export un punct de intrare public.
 */

import {
  avertismenteSaptamana,
  avertismenteZi,
  limiteleFirmei,
  type AvertismentPontaj,
  type MediaReferinta,
  type ZiLucrata,
} from "@/domain/attendance/limite-legale";
import { adaugaZile, lunieaSaptamanii } from "@/domain/attendance/saptamana";
import {
  zilePontateAngajat,
  type SetariPontaj,
  type ZiPontataAngajat,
} from "@/lib/queries/attendance";
import { zileNelucratoare } from "@/lib/queries/leave";

import { tipZiAutomat } from "./etichete";

/**
 * Ce întorc acțiunile de pontaj după o scriere reușită.
 *
 * Trăiește AICI, nu în `actions.ts`: un fișier `"use server"` are voie să
 * exporte numai funcții asincrone, iar tipurile lui ar fi trebuit oricum
 * importate de client. Forma veche — `{ id }` — se păstrează întreagă;
 * `avertismente` se adaugă lângă ea, deci niciun apelant existent nu se rupe.
 */
import type { ConflictSuspendare } from "./suspendare-absente";

export interface RezultatCuAvertismente {
  /**
   * `null` înseamnă că NIMIC nu s-a salvat — singurul caz e conflictul de mai
   * jos. Tipul e `string | null` tocmai ca fiecare apelant să fie obligat de
   * `tsc` să decidă ce face atunci, în loc să primească un identificator gol.
   */
  readonly id: string | null;
  readonly avertismente: readonly AvertismentPontaj[];
  /**
   * Ziua nu s-a salvat fiindcă angajatul are contractul suspendat pentru
   * absențe nemotivate, iar cererea aducea ore lucrate. Ecranul întreabă dacă
   * se emite decizia de reluare, apoi retrimite cu `confirma_reluare`.
   */
  readonly conflictSuspendare: ConflictSuspendare | null;
  /** Reluarea s-a înregistrat, dar ceva de pe drum a rămas de făcut manual. */
  readonly avertismentReluare: string | null;
}

/** Ultima zi a lunii din care face parte `zi`, ca șir ISO. */
function sfarsitDeLuna(zi: string): string {
  const an = Number(zi.slice(0, 4));
  const luna = Number(zi.slice(5, 7));
  const ultima = new Date(Date.UTC(an, luna, 0)).getUTCDate();
  return `${zi.slice(0, 7)}-${String(ultima).padStart(2, "0")}`;
}

/** Întâi ale lunii, cu `n` luni în urmă. Ziua e mereu 1, deci nu poate depăși. */
function primaZiCuLuniInUrma(zi: string, n: number): string {
  const data = new Date(`${zi.slice(0, 7)}-01T00:00:00Z`);
  data.setUTCMonth(data.getUTCMonth() - n);
  return data.toISOString().slice(0, 10);
}

/** Un rând de pontaj → ce înțelege domeniul. Singurul loc unde se face maparea. */
function ziLucrata(rand: ZiPontataAngajat): ZiLucrata {
  return {
    data: rand.data,
    oraInceput: rand.ora_inceput,
    oraSfarsit: rand.ora_sfarsit,
    oreLucrate: rand.ore_lucrate,
    oreSuplimentare: rand.ore_suplimentare,
    oreNoapte: rand.ore_noapte,
    // `tip_zi` e deja derivat din calendarul NAȚIONAL plus zilele proprii ale
    // firmei, la scriere. O a doua derivare aici ar putea contrazice rândul.
    esteSarbatoare: rand.tip_zi === "sarbatoare",
  };
}

/**
 * Media pe perioada de referință, calculată ca în `app.verifica_pontaj`:
 * total ore ÷ numărul de săptămâni DISTINCTE cu pontaj.
 */
function mediaReferintei(zile: readonly ZiLucrata[]): MediaReferinta {
  const saptamani = new Set(zile.map((z) => lunieaSaptamanii(z.data)));
  const ore = zile.reduce((suma, z) => suma + z.oreLucrate, 0);
  return { ore: Math.round(ore * 100) / 100, saptamani: saptamani.size };
}

/**
 * Avertismentele de după salvarea unei zile — se cheamă DUPĂ scriere, ca
 * totalurile să conțină ce tocmai s-a scris.
 *
 * ── UN SINGUR DRUM LA BAZĂ ────────────────────────────────────────────────
 * Săptămâna, ziua dinainte și perioada de referință sunt trei ferestre care se
 * suprapun; se cere reuniunea lor o singură dată și se taie în TypeScript. Trei
 * interogări ar fi fost trei drumuri pentru date care se conțin una pe alta.
 *
 * O eroare de citire NU se propagă: pontajul e deja scris, iar un avertisment
 * care nu s-a putut calcula n-are voie să transforme o salvare reușită în
 * eroare pe ecranul omului. Se întoarce lista goală.
 */
export async function avertismenteDupaZi(params: {
  readonly organizationId: string;
  readonly employeeId: string;
  readonly data: string;
  readonly setari: SetariPontaj | null;
}): Promise<readonly AvertismentPontaj[]> {
  const limite = limiteleFirmei(params.setari);
  if (limite === null) return [];

  const saptamanaStart = lunieaSaptamanii(params.data);
  const saptamanaSfarsit = adaugaZile(saptamanaStart, 6);
  const referintaStart = primaZiCuLuniInUrma(params.data, limite.perioadaReferintaLuni - 1);
  const referintaSfarsit = sfarsitDeLuna(params.data);

  // Ziua dinainte poate cădea în afara săptămânii (când ziua salvată e luni).
  const deLa = [referintaStart, adaugaZile(saptamanaStart, -1)].sort()[0] ?? referintaStart;
  const panaLa = [referintaSfarsit, saptamanaSfarsit].sort().at(-1) ?? referintaSfarsit;

  let randuri: readonly ZiPontataAngajat[];
  try {
    randuri = await zilePontateAngajat(params.organizationId, params.employeeId, deLa, panaLa);
  } catch {
    return [];
  }

  const zile = randuri.map(ziLucrata);
  const zi = zile.find((z) => z.data === params.data);
  if (zi === undefined) return [];

  return avertismenteZi({
    zi,
    ziuaDinainte: zile.find((z) => z.data === adaugaZile(params.data, -1)) ?? null,
    saptamana: zile.filter((z) => z.data >= saptamanaStart && z.data <= saptamanaSfarsit),
    referinta: mediaReferintei(
      zile.filter((z) => z.data >= referintaStart && z.data <= referintaSfarsit),
    ),
    limite,
  });
}

/** O zi de plan, așa cum a rămas după ce serverul i-a rederivat orele. */
export interface ZiPlanDerivata {
  readonly data: string;
  readonly oraInceput: string | null;
  readonly oraSfarsit: string | null;
  readonly oreLucrate: number;
  readonly oreSuplimentare: number;
  readonly oreNoapte: number;
}

/**
 * Avertismentele planului săptămânal, calculate pe ZILELE TRIMISE.
 *
 * ── DE CE NU CITEȘTE PONTAJUL ─────────────────────────────────────────────
 * Planul se declară în AVANS, pentru săptămâna care vine
 * (`lunieaUrmatoare`). În `attendance_entries` nu există încă nimic acolo, deci
 * o citire ar întoarce zero rânduri și ar stinge tăcut toate verificările.
 * Sursa e ce s-a trimis, cu orele deja rescrise de server din interval.
 *
 * Din același motiv lipsesc două verificări, și e mai cinstit spus decât
 * simulat: media pe perioada de referință se măsoară pe ore LUCRATE, nu pe un
 * plan, iar repausul dintre duminica trecută și lunea asta ar cere pontajul
 * unei săptămâni care încă nu s-a întâmplat.
 *
 * Sărbătorile se citesc totuși: o zi de plan n-are `tip_zi`, iar o firmă care a
 * declarat că nu se lucrează de sărbători trebuie să afle că cineva și-a
 * planificat 1 Decembrie.
 */
export async function avertismenteDupaSaptamana(params: {
  readonly organizationId: string;
  readonly saptamanaStart: string;
  readonly zile: readonly ZiPlanDerivata[];
  readonly setari: SetariPontaj | null;
}): Promise<readonly AvertismentPontaj[]> {
  const limite = limiteleFirmei(params.setari);
  if (limite === null) return [];

  let sarbatori: ReadonlySet<string> = new Set();
  if (!limite.lucreazaSarbatori) {
    try {
      const an = Number(params.saptamanaStart.slice(0, 4));
      // Săptămâna poate trece în anul următor; ambii ani, dintr-o citire.
      const { nationale, organizatie } = await zileNelucratoare(params.organizationId, an, an + 1);
      const nationaleSet = new Set(nationale.map((z) => z.data));
      const recuperare = new Set(
        organizatie.filter((z) => z.tip === "zi_recuperare").map((z) => z.data),
      );
      const liber = new Set(
        organizatie.filter((z) => z.tip === "liber_suplimentar").map((z) => z.data),
      );
      sarbatori = new Set(
        params.zile
          .filter((z) => tipZiAutomat(z.data, nationaleSet, recuperare, liber) === "sarbatoare")
          .map((z) => z.data),
      );
    } catch {
      sarbatori = new Set();
    }
  }

  return avertismenteSaptamana({
    saptamanaStart: params.saptamanaStart,
    zile: params.zile.map((z) => ({
      data: z.data,
      oraInceput: z.oraInceput,
      oraSfarsit: z.oraSfarsit,
      oreLucrate: z.oreLucrate,
      oreSuplimentare: z.oreSuplimentare,
      oreNoapte: z.oreNoapte,
      esteSarbatoare: sarbatori.has(z.data),
    })),
    ziuaDinainte: null,
    referinta: null,
    limite,
  });
}

// src/domain/cursuri/scadente.ts
/**
 * Regulile pure ale modulului de cursuri: termene, valabilitate, progres și
 * condiția de finalizare.
 *
 * ── DE CE OGLINDEȘTE TRIGGERUL ────────────────────────────────────────────
 * `esteFinalizabila` reproduce, în TypeScript, exact ce decide
 * `internal.cursuri_progres` (migrarea 0075). Duplicarea e deliberată și are un
 * singur scop: interfața să nu ofere un buton pe care serverul îl va refuza.
 * Un buton activ care produce o eroare e un defect de ecran, nu de bază — iar
 * regula inversă (a arăta butonul dezactivat FĂRĂ motiv) e la fel de rea, de
 * aceea funcția întoarce şi motivul, nu doar un boolean.
 *
 * Sursa de adevăr rămâne baza: dacă cele două diverg, baza câștigă și omul
 * vede eroarea ei. Testele din `scadente.test.ts` fixează ambele capete.
 */

import type { TreaptaScadenta } from "@/domain/scadente";
import { treaptaDinScadenta } from "@/domain/scadente";

/** Preavizul pentru termenul de parcurgere. Zile, nu procente: termenul e o zi. */
export const PRAG_CURS_AVERTIZARE_ZILE = 7;
export const PRAG_CURS_CRITIC_ZILE = 1;

/**
 * Sub câți angajați se afișează numere absolute în loc de procente.
 *
 * „62,5 % conformitate" pe opt oameni e o minciună cu trei zecimale: numărătorul
 * e 5, iar un singur om mută cifra cu 12,5 puncte. Regula există deja la
 * evaluări; aici e aceeași valoare, cu numele domeniului în ea.
 */
export const PRAG_CURSURI_PROCENTE = 25;

export type StatusCurs = "neinceput" | "in_curs" | "finalizat" | "expirat" | "anulat";
export type StatusLectie = "neinceput" | "in_curs" | "finalizat";
export type TreaptaDovada = "bifa" | "parcurgere" | "test" | "declaratie";

/**
 * Treapta termenului de parcurgere.
 *
 * O înrolare deja finalizată sau anulată nu are termen activ — `neaplicabil`,
 * nu `in_regula`: „în regulă" ar sugera că mai e ceva de urmărit.
 */
export function treaptaTermen(
  termen: string | null,
  azi: string,
  status: StatusCurs,
): TreaptaScadenta {
  if (status === "finalizat" || status === "anulat") return "neaplicabil";
  return treaptaDinScadenta(termen, azi, {
    avertizareZile: PRAG_CURS_AVERTIZARE_ZILE,
    criticZile: PRAG_CURS_CRITIC_ZILE,
    // Fără termen nu există nimic de numărat. `neaplicabil`, nu `lipsa`: spre
    // deosebire de un vehicul fără documente, un curs fără termen e o alegere
    // legitimă a administratorului, nu o lipsă de date.
    laNull: "neaplicabil" as const,
  });
}

/**
 * Treapta valabilității unei parcurgeri încheiate — cât mai ține recertificarea.
 * `pragAvertizareZile` vine din curs (`prag_avertizare_zile`), nu e o constantă:
 * un instructaj semestrial și unul la trei ani nu au același preaviz util.
 */
export function treaptaValabilitate(
  expiraLa: string | null,
  azi: string,
  pragAvertizareZile: number,
): TreaptaScadenta {
  return treaptaDinScadenta(expiraLa, azi, {
    avertizareZile: pragAvertizareZile,
    // Fără valabilitate cursul se face o dată și nu expiră niciodată.
    laNull: "neaplicabil" as const,
  });
}

/** Câte secunde trebuie parcurse ca treapta `parcurgere` să fie îndeplinită. */
export function secundeNecesare(durataSecunde: number, procentMinim: number): number {
  return Math.ceil((durataSecunde * procentMinim) / 100);
}

export type Lectie = Readonly<{
  titlu: string;
  status: StatusLectie;
  treaptaDovada: TreaptaDovada;
  procentMinim: number | null;
  durataSecunde: number | null;
  secundeVizionate: number;
  semnaturaNume: string | null;
}>;

export type Finalizabila = Readonly<{ poate: true }> | Readonly<{ poate: false; motiv: string }>;

/**
 * Poate angajatul închide lecția acum? Oglinda lui `internal.cursuri_progres`.
 *
 * Motivul se scrie ca text de interfață gata de afișat SUB buton — un buton
 * dezactivat mut e la fel de rău ca unul care eșuează.
 */
export function esteFinalizabila(lectie: Lectie): Finalizabila {
  if (lectie.status === "finalizat")
    return { poate: false, motiv: "Ați parcurs deja această lecție." };

  switch (lectie.treaptaDovada) {
    case "bifa":
      return { poate: true };

    case "parcurgere": {
      if (lectie.durataSecunde === null || lectie.procentMinim === null) {
        return {
          poate: false,
          motiv: "Lecția nu are durata configurată. Anunțați administratorul.",
        };
      }
      const necesar = secundeNecesare(lectie.durataSecunde, lectie.procentMinim);
      if (lectie.secundeVizionate >= necesar) return { poate: true };
      const ramase = necesar - lectie.secundeVizionate;
      return { poate: false, motiv: `Mai aveți de urmărit ${durataCitibila(ramase)}.` };
    }

    case "declaratie":
      if ((lectie.semnaturaNume ?? "").trim().length >= 3) return { poate: true };
      return { poate: false, motiv: "Semnați declarația pentru a încheia lecția." };

    case "test":
      return { poate: false, motiv: "Testul pentru această lecție nu este încă disponibil." };
  }
}

/**
 * Acordul numeric românesc, care nu e „singular sau plural", ci trei cazuri:
 * 1 ia singularul, 2–19 iau pluralul simplu („3 minute"), iar de la 20 în sus
 * pluralul cere prepoziția „de" („20 de minute", „45 de secunde").
 *
 * Regula se uită la ULTIMELE DOUĂ CIFRE, nu la număr: 101 face „101 minute",
 * dar 120 face „120 de minute". Zero intră tot pe ramura cu „de".
 * Fără asta, interfața ar scrie „3 de minute" — greșeala tipică a formatării
 * automate, care într-un produs românesc se vede imediat.
 */
export function acordNumeric(n: number, singular: string, plural: string): string {
  if (n === 1) return `1 ${singular}`;
  const ultimeleDoua = Math.abs(n) % 100;
  const cereDe = ultimeleDoua === 0 || ultimeleDoua >= 20;
  return `${n} ${cereDe ? "de " : ""}${plural}`;
}

/** „3 minute", „1 minut și 20 de secunde", „45 de secunde". */
export function durataCitibila(secunde: number): string {
  const s = Math.max(0, Math.round(secunde));
  const minute = Math.floor(s / 60);
  const rest = s % 60;
  if (minute === 0) return acordNumeric(rest, "secundă", "secunde");
  const textMinute = acordNumeric(minute, "minut", "minute");
  if (rest === 0) return textMinute;
  return `${textMinute} și ${acordNumeric(rest, "secundă", "secunde")}`;
}

/** „12:34" — poziția de reluare, în forma în care o citește un om pe un player. */
export function pozitieCitibila(secunde: number): string {
  const s = Math.max(0, Math.round(secunde));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Textul care ajunge în `aria-valuetext` pe `<Nivel>`. Întotdeauna absolut sub
 * pragul de 25 de persoane; peste el, procentul devine onest.
 */
export function textProgres(gata: number, total: number, substantiv: string): string {
  if (total === 0) return "Nimic de parcurs.";
  if (total < PRAG_CURSURI_PROCENTE) {
    return `${gata} din ${total} ${substantiv}`;
  }
  return `${Math.round((gata / total) * 100)} % din ${total} ${substantiv}`;
}

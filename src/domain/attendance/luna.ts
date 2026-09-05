// src/domain/attendance/luna.ts
//
// „O lună de pontaj e deschisă până când cineva o închide."
//
// ── DE CE EXISTĂ FIȘIERUL ĂSTA ──────────────────────────────────────────────
// Până la 0132, regula era inversă: luna nu exista până n-o deschidea manual
// cineva cu `attendance:create = all`, iar absența rândului din
// `attendance_periods` însemna „nu se poate ponta". Patru ecrane citeau rândul
// și își scriau fiecare propria concluzie din `perioada === null`: foaia lunii,
// ecranul de aprobare, secțiunea de săptămână și portalul. Când regula s-a
// schimbat în bază, patru locuri ar fi trebuit să afle — iar cel uitat n-ar fi
// dat nicio eroare, doar un ecran care refuză politicos ceva ce baza acceptă.
//
// Perechea din bază e `internal.pontaj_perioada_lunii` (0132): rândul se naște
// deschis la prima scriere din lună. Aici e aceeași regulă, citită: rândul care
// LIPSEȘTE se citește ca lună deschisă, nu ca lună interzisă.
//
// ── SINGURA STARE CARE REFUZĂ E `blocata` ───────────────────────────────────
// `in_aprobare` nu blochează scrierea în bază (0013:293 verifică doar
// `blocata`), deci nu o blochează nici aici. Ecranul care o trata ca pe un
// refuz — portalul — spunea angajatului „luna nu e deschisă" pentru o lună în
// care baza îl lăsa să scrie.

import type { StatusPerioada } from "@/schemas/attendance";

/** Ce ține un ecran despre luna afișată, indiferent dacă rândul există sau nu. */
export interface StareaLunii {
  readonly dataInceput: string;
  readonly dataSfarsit: string;
  readonly status: StatusPerioada;
  readonly blocataLa: string | null;
  /** Se poate scrie în lună. Fals DOAR pentru o lună închisă explicit. */
  readonly deschisa: boolean;
  /** Rândul chiar există în bază — adică s-a scris deja ceva în luna asta. */
  readonly inceputa: boolean;
}

/** Prima și ultima zi calendaristică a unei luni, ca șiruri ISO. */
export function intervalulLunii(
  an: number,
  luna: number,
): { readonly inceput: string; readonly sfarsit: string } {
  // `Date.UTC(an, luna, 0)` e ziua 0 a lunii URMĂTOARE, adică ultima zi a
  // lunii cerute — inclusiv 29 februarie, fără tabel de zile pe lună.
  const ultimaZi = new Date(Date.UTC(an, luna, 0)).getUTCDate();
  const doiCifre = (n: number) => String(n).padStart(2, "0");
  return {
    inceput: `${String(an)}-${doiCifre(luna)}-01`,
    sfarsit: `${String(an)}-${doiCifre(luna)}-${doiCifre(ultimaZi)}`,
  };
}

/**
 * Starea lunii, dintr-un rând de perioadă care poate lipsi.
 *
 * Intrarea e structurală, nu `PerioadaPontaj`: modulul de domeniu nu are voie
 * să depindă de stratul de citiri, iar din rând îl interesează exact trei
 * coloane.
 */
export function stareaLunii(
  perioada: Readonly<{
    data_inceput: string;
    data_sfarsit: string;
    status: StatusPerioada;
    blocata_la: string | null;
  }> | null,
  an: number,
  luna: number,
): StareaLunii {
  if (perioada !== null) {
    return {
      dataInceput: perioada.data_inceput,
      dataSfarsit: perioada.data_sfarsit,
      status: perioada.status,
      blocataLa: perioada.blocata_la,
      deschisa: perioada.status !== "blocata",
      inceputa: true,
    };
  }

  const { inceput, sfarsit } = intervalulLunii(an, luna);
  return {
    dataInceput: inceput,
    dataSfarsit: sfarsit,
    status: "deschisa",
    blocataLa: null,
    deschisa: true,
    inceputa: false,
  };
}

// src/domain/portal/sarcini.ts
/**
 * Ce are angajatul de făcut, într-o singură listă.
 *
 * ┌ De ce există fișierul ────────────────────────────────────────────────────
 * │ Ecranul de acasă al portalului era construit ca raport de excepții: fiecare
 * │ card apărea doar când avea ceva de reclamat și dispărea altfel. Fiecare
 * │ decizie în parte era apărată în comentarii, și fiecare era corectă luată
 * │ singură — „un contor pe zero e zgomot care învață omul să nu se mai uite".
 * │
 * │ Împreună dădeau un ecran alb. Măsurat pe contul real al firmei care îl
 * │ folosește: zero cursuri, zero fluturași, zero cereri în așteptare, anunțuri
 * │ citite. Rămâneau salutul, soldul și cardul „Astăzi".
 * │
 * │ Un card care dispare nu poate spune „nu ai nimic de făcut". Poate doar
 * │ lipsi, iar lipsa se citește la fel ca o pagină care încă se încarcă.
 * └───────────────────────────────────────────────────────────────────────────
 *
 * Funcție PURĂ: primește cifrele deja calculate de pagină și decide ce rânduri
 * se scriu, în ce ordine. Nu atinge baza și nu formatează nimic vizual.
 */

export type SarcinaPortal = Readonly<{
  /** Cheie stabilă pentru `key` în listă, nu pentru afișare. */
  id: string;
  eticheta: string;
  /** Al doilea rând, când are ce spune. */
  detaliu: string | null;
  href: string;
  /**
   * Cere atenție ACUM — un termen depășit, nu doar o sarcină deschisă.
   * Ecranul o folosește pentru ton, niciodată ca singur purtător de sens.
   */
  urgenta: boolean;
}>;

export type IntrareSarcini = Readonly<{
  /** Cursuri neîncepute sau în curs, din `restanteDinCursuri`. */
  cursuriDeFacut: number;
  /** Cel mai apropiat termen al lor, `YYYY-MM-DD` sau `null`. */
  termenCursuri: string | null;
  /** Zilele lucrătoare nescrise din luna curentă, din `zileNepontate`. */
  zileNepontate: number;
  /**
   * Firma se pontează pe săptămână (0165)? Atunci zilele nepontate se
   * completează din fișa săptămânii, nu din calendar — care nu mai deschide
   * nicio zi.
   */
  peSaptamana: boolean;
  /** Anunțuri publicate pe care omul nu le-a deschis. */
  anunturiNecitite: number;
  /** Când e unul singur: id-ul lui, ca sarcina să ducă direct la el. */
  anuntNecititUnicId?: string | null;
  /** Obiecte predate omului pe care nu le-a confirmat încă (`confirmat_de_angajat_la` gol). */
  prediriNeconfirmate?: number;
  azi: string;
}>;

/**
 * Rândurile, în ordinea în care merită atinse.
 *
 * Ordinea NU e cea a modulelor, ci a costului de a le lăsa baltă: un curs cu
 * termen depășit e o obligație legală ratată, o zi nepontată se plătește în
 * statul de plată, un anunț necitit nu costă nimic până nu e citit.
 *
 * Lista goală e un răspuns valid și așteptat — apelantul scrie starea liniștită,
 * nu ascunde cardul.
 */
export function sarciniPortal(intrare: IntrareSarcini): readonly SarcinaPortal[] {
  const sarcini: SarcinaPortal[] = [];

  if (intrare.cursuriDeFacut > 0) {
    const depasit = intrare.termenCursuri !== null && intrare.termenCursuri < intrare.azi;
    sarcini.push({
      id: "cursuri",
      eticheta:
        intrare.cursuriDeFacut === 1
          ? "Un curs de parcurs"
          : `${intrare.cursuriDeFacut.toLocaleString("ro-RO")} cursuri de parcurs`,
      detaliu: depasit ? "Termenul a trecut" : null,
      href: "/portal/cursurile-mele",
      urgenta: depasit,
    });
  }

  if (intrare.zileNepontate > 0) {
    sarcini.push({
      id: "pontaj",
      eticheta:
        intrare.zileNepontate === 1
          ? "O zi nepontată luna aceasta"
          : `${intrare.zileNepontate.toLocaleString("ro-RO")} zile nepontate luna aceasta`,
      detaliu: intrare.peSaptamana
        ? "Se completează din pontajul săptămânii"
        : "Se completează din calendarul lunii",
      href: intrare.peSaptamana ? "/portal/pontajul-meu/saptamana" : "/portal/pontajul-meu",
      // Nepontatul nu e urgent în sine: devine urgent la închiderea lunii, iar
      // luna și-o închide firma, nu ecranul ăsta. A-l colora roșu din prima zi
      // ar face din culoare zgomot, exact ca un contor pe zero.
      urgenta: false,
    });
  }

  if (intrare.anunturiNecitite > 0) {
    sarcini.push({
      id: "anunturi",
      eticheta:
        intrare.anunturiNecitite === 1
          ? "Un anunț necitit"
          : `${intrare.anunturiNecitite.toLocaleString("ro-RO")} anunțuri necitite`,
      detaliu: null,
      // Un singur necitit: direct la obiect, nu la listă (încă un clic).
      href:
        intrare.anunturiNecitite === 1 &&
        intrare.anuntNecititUnicId !== null &&
        intrare.anuntNecititUnicId !== undefined
          ? `/portal/anunturi/${intrare.anuntNecititUnicId}`
          : "/portal/anunturi",
      urgenta: false,
    });
  }

  // Predarea nu notifică și meniul n-are insignă: fără rândul ăsta, omul afla
  // că are de confirmat un obiect numai deschizând singur pagina.
  if ((intrare.prediriNeconfirmate ?? 0) > 0) {
    const n = intrare.prediriNeconfirmate ?? 0;
    sarcini.push({
      id: "predari",
      eticheta:
        n === 1
          ? "Un obiect de confirmat în primire"
          : `${String(n)} obiecte de confirmat în primire`,
      detaliu: "Confirmarea spune că ați primit obiectul în starea scrisă în proces-verbal.",
      href: "/portal/in-primirea-mea",
      urgenta: false,
    });
  }

  return sarcini;
}

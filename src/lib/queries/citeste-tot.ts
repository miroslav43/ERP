// src/lib/queries/citeste-tot.ts
import "server-only";

/**
 * Citirea completă a unei liste, în pagini, când răspunsul e destinat unui
 * CALCUL — nu unui ecran.
 *
 * ── PROBLEMA ──────────────────────────────────────────────────────────────
 * PostgREST are `max_rows = 1000` și, la depășire, **trunchiază tăcut**: nicio
 * eroare, niciun antet de avertizare pe care codul nostru să-l citească, doar
 * mai puține rânduri. Într-o listă paginată asta se vede (utilizatorul dă
 * „mai departe"). Într-o AGREGARE nu se vede niciodată: raportul anual arată o
 * cifră mai mică și pare corect.
 *
 * Cazul e real, nu ipotetic: `statisticiAnuale()` citea `payroll_entries`
 * pentru toate perioadele unui an. La douăsprezece perioade, plafonul de 1000
 * se atinge pe la **84 de angajați** — iar de acolo încolo totalul brut anual
 * al firmei era pur și simplu greșit, fără nicio eroare nicăieri.
 *
 * ── DE CE KEYSET ȘI NU `.range()` ─────────────────────────────────────────
 * `.range()` traduce în OFFSET. Între două pagini, un rând inserat sau șters
 * deplasează fereastra, deci rânduri se pot repeta sau pierde — exact ce nu-și
 * permite o sumă. Cu un keyset pe o coloană unică și crescătoare, fiecare
 * pagină continuă de unde s-a oprit precedenta, indiferent ce s-a mai scris.
 *
 * ── DE CE ARUNCĂ LA PLAFON, ÎN LOC SĂ TRUNCHIEZE ─────────────────────────
 * Fiindcă asta e toată ideea. O eroare se vede și se repară; o cifră mai mică
 * cu 15 % nu se vede niciodată. Plafonul e o plasă contra unei bucle infinite
 * dintr-un `cheie()` greșit, nu o limită de produs.
 */
type Pagina<T> = Readonly<{ data: T[] | null; error: { message: string } | null }>;

export type OptiuniCitesteTot = Readonly<{
  /** Câte rânduri pe pagină. Peste `max_rows` nu are efect — serverul taie oricum. */
  pas?: number;
  /** Plasă de siguranță contra buclei infinite. */
  maxim?: number;
  /** Ce se numește în mesajul de eroare, ca să se știe CE s-a oprit. */
  nume?: string;
}>;

export async function citesteTot<T>(
  /**
   * Cere o pagină. Interogarea TREBUIE să fie ordonată crescător după aceeași
   * coloană din care se ia `cheie`, și filtrată cu `> dupa` când `dupa` nu e
   * `null`. Așa arată contractul; funcția nu-l poate impune din afară.
   */
  cerePagina: (dupa: string | null, pas: number) => PromiseLike<Pagina<T>>,
  /** Cheia keyset a unui rând — unică și crescătoare, de obicei `id`. */
  cheie: (rand: T) => string,
  optiuni: OptiuniCitesteTot = {},
): Promise<readonly T[]> {
  const pas = optiuni.pas ?? 1000;
  const maxim = optiuni.maxim ?? 50_000;
  const nume = optiuni.nume ?? "lista";

  const adunate: T[] = [];
  let dupa: string | null = null;

  for (;;) {
    const { data, error }: Pagina<T> = await cerePagina(dupa, pas);
    if (error !== null) throw error;

    const pagina = data ?? [];
    adunate.push(...pagina);

    // Ultima pagină e cea incompletă. O pagină exact plină poate fi ultima,
    // caz în care următoarea vine goală și bucla se oprește acolo.
    if (pagina.length < pas) return adunate;

    const ultim = pagina.at(-1);
    if (ultim === undefined) return adunate;

    const urmatoareCheie = cheie(ultim);
    if (urmatoareCheie === dupa) {
      // Cheia nu a avansat: `cheie()` nu se potrivește cu ordonarea din
      // interogare. Fără oprirea asta, bucla ar cere la infinit aceeași pagină.
      throw new Error(
        `Citirea completă a listei „${nume}" nu avansează: cheia keyset a rămas la aceeași valoare.`,
      );
    }
    dupa = urmatoareCheie;

    if (adunate.length > maxim) {
      throw new Error(
        `Citirea completă a listei „${nume}" a depășit ${maxim} de rânduri. Restrângeți intervalul.`,
      );
    }
  }
}

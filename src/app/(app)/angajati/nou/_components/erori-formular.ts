// src/app/(app)/angajati/nou/_components/erori-formular.ts
import type { EroareRezumat } from "@/components/ui/rezumat-erori";

import { eticheteazaCamp } from "./etichete-campuri";

/**
 * Desfacerea arborelui de erori al react-hook-form într-o listă afișabilă.
 *
 * ── DE CE ÎNTR-UN FIȘIER SEPARAT ──────────────────────────────────────────
 * Proiectul `ui` din `vitest.config.mts` randează DOAR `src/components/`;
 * pentru pagini, unealta e Playwright. Logica asta e însă pură — arbore în
 * listă, filtrare, sortare — deci trăiește aici, ca `.ts`, unde proiectul
 * `unit` (`src/**\/*.test.ts`) o poate acoperi fără DOM.
 */

/** Cheile interne ale unui nod de eroare RHF, care nu sunt nume de câmpuri. */
const CHEI_INTERNE = new Set(["message", "type", "types", "ref"]);

function aduna(nod: unknown, cale: string, iesire: { camp: string; mesaj: string }[]): void {
  if (typeof nod !== "object" || nod === null) return;
  const obiect = nod as Record<string, unknown>;

  const mesaj = obiect["message"];
  if (typeof mesaj === "string" && mesaj !== "" && cale !== "") {
    iesire.push({ camp: cale, mesaj });
  }

  for (const [cheie, valoare] of Object.entries(obiect)) {
    // `ref` e un nod DOM: coborârea în el ar produce căi absurde și, pe un
    // element cu referințe circulare, o buclă.
    if (CHEI_INTERNE.has(cheie)) continue;
    aduna(valoare, cale === "" ? cheie : `${cale}.${cheie}`, iesire);
  }
}

/** Rădăcina unei căi: `autorizatii.2.numar` → `autorizatii`. */
export function radacinaCampului(cale: string): string {
  return cale.split(".")[0] ?? cale;
}

/**
 * Erorile gata de afișat: etichetate, filtrate pe pas și puse în ordinea
 * ecranului.
 *
 * Ordinea nu e cosmetică. Primul element al listei e și câmpul pe care sare
 * focusul; dacă ar veni în ordinea arbitrară a obiectului de erori, omul ar fi
 * trimis la „Salariu de bază” înaintea lui „Nume”, adică peste pași înapoi.
 *
 * Un câmp-listă (`autorizatii`) poate avea ȘI mesaj propriu, ȘI erori pe
 * indici: se emit amândouă, fiindcă serverul raportează pe rădăcină
 * (`z.flattenError` colapsează căile), iar clientul pe indice.
 */
export function rezumatulErorilor(
  erori: unknown,
  ordine: readonly string[],
  doarCampurile: readonly string[] | null,
): readonly EroareRezumat[] {
  const plate: { camp: string; mesaj: string }[] = [];
  aduna(erori, "", plate);

  const indice = (camp: string): number => {
    const pozitie = ordine.indexOf(radacinaCampului(camp));
    return pozitie === -1 ? ordine.length : pozitie;
  };

  return plate
    .filter((e) => doarCampurile === null || doarCampurile.includes(radacinaCampului(e.camp)))
    .sort((a, b) => indice(a.camp) - indice(b.camp))
    .map((e) => ({ camp: e.camp, eticheta: eticheteazaCamp(e.camp), mesaj: e.mesaj }));
}

/**
 * Mesajul unui câmp, în forma pe care o cere `<Camp>`.
 *
 * `Camp` primește o LISTĂ, fiindcă serverul poate trimite mai multe mesaje pe
 * același câmp; react-hook-form ține doar unul. Se întoarce lista goală, nu
 * `undefined`: `exactOptionalPropertyTypes` interzice trimiterea explicită a
 * lui `undefined` către o proprietate opțională, iar `?? []` la fiecare apel ar
 * fi zgomot repetat de 72 de ori.
 */
export function mesajCamp(eroare: { readonly message?: unknown } | undefined): readonly string[] {
  const mesaj = eroare?.message;
  return typeof mesaj === "string" && mesaj !== "" ? [mesaj] : [];
}

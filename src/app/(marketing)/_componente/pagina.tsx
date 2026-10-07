import type { ContinutLanding } from "@/content/landing/tipuri";

import {
  BandaIncepe,
  BandaIntrebariScurte,
  BandaPentruCine,
  BandaProdus,
  BandaPromisiuni,
  BandaSiguranta,
  BandaUnelte,
} from "./benzi/acasa";
import {
  BandaContact,
  BandaDovada,
  BandaHero,
  BandaPreturi,
  BandaRealitatea,
} from "./benzi/comercial";

/**
 * Pagina de start: douăsprezece benzi, refăcută pe 6 oct 2026.
 *
 * ── CE S-A SCHIMBAT ȘI DE CE ──────────────────────────────────────────────
 * Versiunea de dinainte avea opt benzi și NICIUN ecran al aplicației. Spunea
 * ce e produsul, dar nu-l arăta; vorbea despre straturi de securitate unui
 * patron care voia să afle dacă scapă de Excel; avea două benzi de pornire care
 * se contraziceau („îți faci contul” / „nu-ți creăm cont”); iar uneltele
 * gratuite — singurul lucru pe care lumea îl caută cu zecile de mii pe lună —
 * stăteau doar în subsol. Analiza completă, cu cifrele și concurența:
 * `docs/comercial/refacere-site-2026-10-06.md`.
 *
 * Lecția versiunii de nouăsprezece benzi rămâne în picioare: nicio bandă de aici
 * nu e un cluster de căutare îngropat. Fiecare are pagina ei, iar banda e drumul
 * spre ea — modulele, uneltele, ghidurile, încrederea, întrebările.
 *
 * ── ORDINEA, ȘI DE CE ASTA ────────────────────────────────────────────────
 *   1. eroul + foaia     ce rezolvă, pentru cine, ce NU riscă cine apasă
 *   2. dovada            prima lună, prețul, costul de pornire, modulele
 *   3. realitatea        situația recunoscută, în limbajul patronului
 *   4. produsul          ecranele reale, câte un rând pe treaba rezolvată
 *   5. pentru cine       patronul, HR, contabilul, angajatul — fiecare cu drumul lui
 *   6. uneltele          valoare înainte de cont; și cele mai căutate pagini
 *   7. promisiunile      ce ne asumăm, în locul recomandărilor pe care nu le avem
 *   8. prețul            auto-calificarea pe buget
 *   9. siguranța         obiecția „datele oamenilor mei”, în cuvinte simple
 *  10. cum începi        patru pași, plus calea cu un om alături
 *  11. întrebările       cele șase care opresc o decizie
 *  12. contactul         formularul, telefonul și cine stă în spate
 *
 * Componenta nu conține niciun text: tot ce se citește vine din `text`, adică
 * din `ro.ts` sau `en.ts`. De aceea aceeași funcție randează ambele limbi.
 */
export function PaginaLanding({ text }: { text: ContinutLanding }) {
  return (
    <>
      <BandaHero text={text} />
      <BandaDovada text={text} />
      <BandaRealitatea text={text} />
      <BandaProdus text={text} />
      <BandaPentruCine text={text} />
      <BandaUnelte text={text} />
      <BandaPromisiuni text={text} />
      <BandaPreturi text={text} />
      <BandaSiguranta text={text} />
      <BandaIncepe text={text} />
      <BandaIntrebariScurte text={text} />
      <BandaContact text={text} />
    </>
  );
}

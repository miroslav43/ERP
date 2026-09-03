import type { ContinutLanding } from "@/content/landing/tipuri";

import {
  BandaContact,
  BandaDovada,
  BandaHero,
  BandaImplementare,
  BandaIncredereScurt,
  BandaPornire,
  BandaPreturi,
  BandaRealitatea,
} from "./benzi/comercial";

/**
 * Pagina de start: opt benzi.
 *
 * ── CE S-A SCHIMBAT ȘI DE CE ──────────────────────────────────────────────
 * Erau nouăsprezece benzi și 4.291 de cuvinte vizibile pe un singur URL. Nu
 * lungimea era boala, ci faptul că fiecare secțiune era un cluster de căutare
 * propriu — module, roluri, conformitate, onestitate, comparație — îngropat ca
 * fragment într-o pagină de 415 KB, unde nu putea ieși pe nimic. Ca pagină
 * proprie, fiecare poate.
 *
 * Nimic nu s-a șters. Totul s-a mutat, iar banda `pornire` e drumul spre ce a
 * plecat.
 *
 * ── ORDINEA, ȘI DE CE ASTA ────────────────────────────────────────────────
 *   1. eroul + foaia   ce e și pentru cine, plus singura dovadă care nu se poate
 *                      copia: produsul care rulează în pagină
 *   2. dovada          ce riscăm noi — prima lună, prețul, costul de pornire
 *   3. realitatea      situația recunoscută, în limbajul patronului
 *   4. pornirea        trei drumuri, fiecare cu pagina lui
 *   5. prețul          auto-calificarea pe buget, înainte de orice conversație
 *   6. încrederea      obiecția de securitate, blocată înainte să apară
 *   7. implementarea   cinci pași, singurul loc numerotat din pagină
 *   8. contactul       formularul, pe hârtie fiindcă acolo stau controalele native
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
      <BandaPornire text={text} />
      <BandaPreturi text={text} />
      <BandaIncredereScurt text={text} />
      <BandaImplementare text={text} />
      <BandaContact text={text} />
    </>
  );
}

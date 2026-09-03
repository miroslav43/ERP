import type { AntetPagina } from "@/content/landing/tipuri";

/**
 * Antetul unei pagini publice secundare: supratitlu mono, `<h1>`, lead.
 *
 * ── DE CE ARE NEVOIE DE EL FIECARE PAGINĂ NOUĂ ────────────────────────────
 * Paginile secundare sunt compuse din `Banda`, iar `Banda` randează `<h2>`.
 * O pagină făcută numai din benzi ar avea o ierarhie care începe la nivelul doi:
 * nevalidă pentru cititoarele de ecran, și fără niciun titlu pe care un motor
 * să-l potrivească cu interogarea.
 *
 * ── DE CE NU FOLOSEȘTE `Banda` ────────────────────────────────────────────
 * `Banda` desenează o riglă deasupra, ca despărțire de secțiunea dinainte.
 * Antetul n-are ce despărți: e primul lucru de pe pagină. Aceeași formă o are
 * eroul landing-ului și cel al paginii de prețuri — scara e puțin mai mică
 * (`4.8vw` față de `5.8vw`), fiindcă un titlu de pagină secundară nu are voie
 * să concureze vizual cu H1-ul paginii de start.
 */
export function AntetSecundar({ text }: { text: AntetPagina }) {
  return (
    <section className="bg-mk-hartie text-mk-text">
      <div className="max-w-mk mx-auto w-full px-[clamp(1rem,4vw,2.5rem)] pt-16 pb-12 sm:pt-24">
        <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
          {text.supratitlu}
        </p>
        <h1 className="font-mk-display mt-6 max-w-[20ch] text-[clamp(2.25rem,4.8vw,3.75rem)] leading-[1] font-semibold tracking-[-0.02em] text-balance">
          {text.titlu}
        </h1>
        <p className="text-mk-text-slab mt-6 max-w-[62ch] text-[1.0625rem] leading-[1.6] text-pretty">
          {text.lead}
        </p>
      </div>
    </section>
  );
}

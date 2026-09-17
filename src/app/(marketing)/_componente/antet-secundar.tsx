import Link from "next/link";

import { RO } from "@/content/landing/ro";
import type { AntetPagina } from "@/content/landing/tipuri";

/**
 * Antetul unei pagini publice secundare: supratitlu mono, `<h1>`, lead, buton.
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
 *
 * ── DE CE BUTONUL VINE IMPLICIT ───────────────────────────────────────────
 * Butonul din antetul site-ului e `hidden md:inline-flex`: pe telefon rămâne
 * doar „Meniu”. Auditul din 17 sept 2026 a măsurat primul buton de cont la
 * 864 px pe /preturi, 2852 px pe /module/attendance și 5767 px pe
 * /domenii/constructii, la un ecran de 844 px. Pus implicit aici, ajunge pe
 * fiecare pagină secundară fără ca vreuna să-l poată uita; o pagină care nu-l
 * vrea trimite `cta={null}`. Toate apelurile sunt pagini românești, de aceea
 * implicitul e butonul eroului din `RO`.
 */
export function AntetSecundar({
  text,
  cta = RO.hero.ctaPrimar,
}: {
  text: AntetPagina;
  cta?: Readonly<{ eticheta: string; href: string }> | null;
}) {
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
        {cta !== null && (
          <Link
            href={cta.href}
            data-umami-event="cta-antet-secundar"
            className="bg-mk-cerneala text-mk-text-inv mt-8 inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
          >
            {cta.eticheta}
          </Link>
        )}
      </div>
    </section>
  );
}

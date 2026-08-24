import Link from "next/link";

import { FormularDemo } from "../cere-demo/formular-demo";
import { CONTACT } from "@/content/landing/contact";
import type { ContinutLanding } from "@/content/landing/tipuri";

import { Banda } from "./banda";
import { DiagramaPlatforma } from "./diagrama-platforma";
import { Foaia } from "./foaia";
import { MatriceRoluri } from "./matrice";
import { ModuriPontaj, ViitorPontaj } from "./moduri-pontaj";
import { RandRegistru, Registru } from "./registru";
import { VinietaFluturas, VinietaPontaj, VinietaScadente } from "./viniete";

/**
 * Orchestrarea landing-ului. Nouăsprezece benzi, în ordinea din plan.
 *
 * Componenta nu conține niciun text: tot ce se citește vine din `text`, adică
 * din `ro.ts` sau `en.ts`. De aceea aceeași funcție randează ambele limbi.
 */
export function PaginaLanding({ text }: { text: ContinutLanding }) {
  const toateModulele = text.module.grupuri.flatMap((grup) => grup.module);
  const numeModul = new Map(toateModulele.map((modul) => [modul.cheie, modul.titlu]));

  return (
    <>
      {/* ── 1. HERO + FOAIA ─────────────────────────────────────────────── */}
      <section id="sus" className="bg-mk-hartie text-mk-text">
        <div className="max-w-mk mx-auto w-full px-[clamp(1rem,4vw,2.5rem)] pt-16 pb-20 sm:pt-24 sm:pb-32">
          <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
            {text.hero.supratitlu}
          </p>
          <h1 className="font-mk-display mt-6 max-w-[16ch] text-[clamp(2.5rem,5.8vw,4.5rem)] leading-[0.98] font-semibold tracking-[-0.022em] text-balance">
            {text.hero.titlu}
          </h1>
          <p className="text-mk-text-slab mt-7 max-w-[58ch] text-[1.1875rem] leading-[1.6] text-pretty">
            {text.hero.lead}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href={text.hero.ctaPrimar.href}
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              {text.hero.ctaPrimar.eticheta}
            </Link>
            <a
              href={text.hero.ctaSecundar.href}
              className="border-mk-rigla hover:border-mk-text inline-flex h-12 items-center rounded border px-6 text-[0.9375rem] font-medium transition-colors"
            >
              {text.hero.ctaSecundar.eticheta}
            </a>
          </div>

          <Foaia text={text.foaie} />
        </div>
      </section>

      {/* ── 2. DOVADA ───────────────────────────────────────────────────── */}
      <Banda id="dovada" inaltime="scurta">
        <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {text.dovada.randuri.map((rand) => (
            <div key={rand.eticheta}>
              <dt className="font-mk-date text-[1.75rem] leading-none tracking-[-0.02em] tabular-nums">
                {rand.valoare}
              </dt>
              <dd className="mt-2">
                <span className="font-mk-date text-mk-text-slab block text-[0.6875rem] tracking-[0.14em] uppercase">
                  {rand.eticheta}
                </span>
                <span className="text-mk-text-slab mt-1.5 block max-w-[34ch] text-[0.8125rem] leading-[1.5]">
                  {rand.nota}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </Banda>

      {/* ── 3. REALITATEA ───────────────────────────────────────────────── */}
      <Banda
        id="realitatea"
        supratitlu={text.realitatea.supratitlu}
        titlu={text.realitatea.titlu}
        lead={text.realitatea.lead}
        aliniereTitlu="larg"
      >
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {text.realitatea.scene.map((scena) => (
            <div key={scena.titlu} className="border-mk-rigla/40 border-t pt-5">
              <h3 className="font-mk-display max-w-[24ch] text-[clamp(1.125rem,1.4vw,1.375rem)] leading-[1.18] font-semibold">
                {scena.titlu}
              </h3>
              <p className="text-mk-text-slab mt-3 text-[0.9375rem] leading-[1.6]">{scena.text}</p>
            </div>
          ))}
        </div>
      </Banda>

      {/* ── 4. PLATFORMA ────────────────────────────────────────────────── */}
      <Banda
        id="platforma"
        supratitlu={text.platforma.supratitlu}
        titlu={text.platforma.titlu}
        lead={text.platforma.lead}
      >
        <DiagramaPlatforma notaAudit={text.platforma.legaturi[5]?.text ?? text.platforma.nota} />
        <Registru>
          {text.platforma.legaturi.map((legatura) => (
            <RandRegistru
              key={legatura.eticheta}
              cod={legatura.eticheta}
              titlu={`${nume(text, legatura.de)} → ${nume(text, legatura.la)}`}
              text={legatura.text}
            />
          ))}
        </Registru>
        <p className="text-mk-text-slab mt-6 max-w-[62ch] text-[0.8125rem] leading-[1.55]">
          {text.platforma.nota}
        </p>
      </Banda>

      {/* ── 5. MODULE ───────────────────────────────────────────────────── */}
      <Banda
        id="module"
        inaltime="inalta"
        supratitlu={text.module.supratitlu}
        titlu={text.module.titlu}
        lead={text.module.lead}
      >
        {text.module.grupuri.map((grup) => (
          <section key={grup.cheie} className="mt-12 first:mt-10">
            <h3 className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
              {grup.titlu}
            </h3>
            <Registru>
              {grup.module.map((modul) => (
                <RandRegistru
                  key={modul.cheie}
                  cod={modul.cheie}
                  titlu={modul.titlu}
                  text={modul.text}
                  puncte={modul.puncte}
                />
              ))}
            </Registru>
          </section>
        ))}
      </Banda>

      {/* ── 6. ECRANE ───────────────────────────────────────────────────── */}
      <Banda
        id="ecrane"
        inaltime="scurta"
        supratitlu={text.ecrane.supratitlu}
        titlu={text.ecrane.titlu}
        lead={text.ecrane.lead}
      >
        <Registru>
          {text.ecrane.randuri.map((rand) => (
            <RandRegistru key={rand.cod} cod={rand.cod} titlu={rand.titlu} text={rand.text} />
          ))}
        </Registru>
      </Banda>

      {/* ── 7. PONTAJ: livrat pe hârtie, viitor pe cerneală ─────────────── */}
      <Banda
        id="pontaj"
        inaltime="inalta"
        supratitlu={text.pontaj.supratitlu}
        titlu={text.pontaj.titlu}
        lead={text.pontaj.lead}
      >
        <ModuriPontaj text={text.pontaj} />
        <p className="border-mk-text mt-16 max-w-[52ch] border-t-2 pt-5 text-[1.0625rem] leading-[1.6]">
          {text.pontaj.granita}
        </p>
      </Banda>
      <Banda fundal="cerneala" inaltime="inalta">
        <ViitorPontaj text={text.pontaj} />
        <Link
          href={text.pontaj.buton.href}
          className="bg-mk-hartie text-mk-cerneala mt-8 inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
        >
          {text.pontaj.buton.eticheta}
        </Link>
      </Banda>

      {/* ── 8. FLUXURI ──────────────────────────────────────────────────── */}
      <Banda
        id="fluxuri"
        supratitlu={text.fluxuri.supratitlu}
        titlu={text.fluxuri.titlu}
        lead={text.fluxuri.lead}
      >
        <div className="mt-12 grid gap-10 lg:grid-cols-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
            {text.fluxuri.fluxuri.map((flux) => (
              <div key={flux.titlu} className="border-mk-rigla/40 border-t pt-5">
                <h3 className="font-mk-display max-w-[22ch] text-[1.125rem] leading-[1.2] font-semibold">
                  {flux.titlu}
                </h3>
                <ol className="mt-4 space-y-3">
                  {flux.pasi.map((pas) => (
                    <li key={pas.text} className="text-[0.875rem] leading-[1.5]">
                      <span className="font-mk-date text-mk-text-slab block text-[0.6875rem] tracking-[0.06em]">
                        {pas.actor}
                      </span>
                      {pas.text}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <div className="lg:col-span-4">
            <VinietaFluturas
              titlu={text.limba === "ro" ? "Fluturaș de salariu" : "Payslip"}
              unitate={text.limba === "ro" ? "Lei" : "RON"}
              antetCategorie={text.limba === "ro" ? "Categorie" : "Category"}
              etichete={
                text.limba === "ro"
                  ? { net: "Net de plată", impozit: "Impozit" }
                  : { net: "Net pay", impozit: "Income tax" }
              }
              avertisment={
                text.limba === "ro"
                  ? "Calcul intern, neverificat de un contabil. Cotele sunt cele configurate pentru firma din exemplu."
                  : "Internal calculation, not verified by an accountant. The rates are those configured for the sample company."
              }
            />
          </div>
        </div>
      </Banda>

      {/* ── 9. ROLURI (hârtie obligatoriu: cărămida e text-safe doar aici) ─ */}
      <Banda
        id="roluri"
        inaltime="inalta"
        supratitlu={text.roluri.supratitlu}
        titlu={text.roluri.titlu}
        lead={text.roluri.lead}
      >
        <MatriceRoluri text={text.roluri} />
      </Banda>

      {/* ── 10. IZOLARE ─────────────────────────────────────────────────── */}
      <Banda
        id="izolare"
        fundal="cerneala"
        inaltime="inalta"
        supratitlu={text.izolare.supratitlu}
        titlu={text.izolare.titlu}
        lead={text.izolare.lead}
      >
        <div className="mt-12 grid gap-12 lg:grid-cols-12">
          <ol className="lg:col-span-7">
            {text.izolare.straturi.map((strat, index) => (
              <li
                key={strat.nume}
                className={`border-mk-rigla-inv flex gap-5 border-t py-5 ${
                  strat.bariera ? "border-mk-text-inv border-t-2" : ""
                }`}
              >
                <span className="font-mk-date text-mk-text-inv-slab w-6 shrink-0 pt-1 text-[0.6875rem] tabular-nums">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-mk-display flex flex-wrap items-baseline gap-x-3 text-[1.125rem] font-semibold">
                    {strat.nume}
                    <span
                      className={`font-mk-date text-[0.6875rem] tracking-[0.14em] uppercase ${
                        strat.bariera ? "text-mk-co-inv" : "text-mk-text-inv-slab"
                      }`}
                    >
                      {strat.rol}
                    </span>
                  </h3>
                  <p className="text-mk-text-inv-slab mt-2 max-w-[56ch] text-[0.875rem] leading-[1.6]">
                    {strat.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="lg:col-span-5">
            <VinietaPontaj
              titlu={text.izolare.vinieta.titlu}
              politica={text.izolare.vinieta.politica}
              contor={text.izolare.vinieta.contor}
              nota={text.izolare.vinieta.nota}
              randuri={text.izolare.vinieta.randuri}
              ascunse={text.izolare.vinieta.ascunse}
            />
          </div>
        </div>
      </Banda>

      {/* ── 11. CONFORMITATE ────────────────────────────────────────────── */}
      <Banda
        id="conformitate"
        supratitlu={text.conformitate.supratitlu}
        titlu={text.conformitate.titlu}
        lead={text.conformitate.lead}
      >
        <div className="mt-12 grid gap-10 lg:grid-cols-12">
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:col-span-8">
            {text.conformitate.carduri.map((card) => (
              <div key={card.titlu} className="border-mk-rigla/40 border-t pt-5">
                <h3 className="font-mk-display max-w-[26ch] text-[1.125rem] leading-[1.2] font-semibold">
                  {card.titlu}
                </h3>
                <p className="text-mk-text-slab mt-2.5 text-[0.875rem] leading-[1.55]">
                  {card.text}
                </p>
                {card.temei !== "" && (
                  <p className="font-mk-date text-mk-text-slab mt-3 text-[0.6875rem] tracking-[0.06em]">
                    {card.temei}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="lg:col-span-4">
            <VinietaScadente
              titlu={text.limba === "ro" ? "Scadențe" : "Due dates"}
              nota={
                text.limba === "ro"
                  ? "Trei module diferite, o singură listă. Fiecare termen are un act normativ notat lângă el."
                  : "Three different modules, one list. Every deadline carries the statute it comes from."
              }
            />
            <div className="mt-8">
              <h3 className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
                {text.conformitate.retentieTitlu}
              </h3>
              <dl className="border-mk-rigla/40 mt-3 border-t">
                {text.conformitate.retentie.map((rand) => (
                  <div
                    key={rand.ce}
                    className="border-mk-rigla/40 flex flex-wrap justify-between gap-x-6 gap-y-1 border-b py-2.5 text-[0.8125rem]"
                  >
                    <dt>{rand.ce}</dt>
                    <dd className="text-mk-text-slab max-w-[30ch] text-right">{rand.regula}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-mk-text-slab mt-3 text-[0.8125rem] leading-[1.5]">
                {text.conformitate.retentieNota}
              </p>
            </div>
          </div>
        </div>
      </Banda>

      {/* ── 12. ONESTITATE ──────────────────────────────────────────────── */}
      <Banda
        id="onestitate"
        fundal="cerneala"
        inaltime="inalta"
        supratitlu={text.onestitate.supratitlu}
        titlu={text.onestitate.titlu}
        lead={text.onestitate.lead}
        aliniereTitlu="larg"
      >
        <ul className="mt-12">
          {text.onestitate.randuri.map((rand) => (
            <li key={rand.titlu} className="border-mk-rigla-inv border-t py-6">
              <h3 className="font-mk-display text-[clamp(1.125rem,1.4vw,1.375rem)] leading-[1.18] font-semibold">
                {rand.titlu}
              </h3>
              <p className="text-mk-text-inv-slab mt-2 max-w-[72ch] text-[0.9375rem] leading-[1.6]">
                {rand.text}
              </p>
            </li>
          ))}
        </ul>
        <p className="border-mk-text-inv mt-8 max-w-[52ch] border-t-2 pt-5 text-[1.0625rem] leading-[1.6]">
          {text.onestitate.incheiere}
        </p>
      </Banda>

      {/* ── 13. VERTICALE ───────────────────────────────────────────────── */}
      <Banda
        id="verticale"
        supratitlu={text.verticale.supratitlu}
        titlu={text.verticale.titlu}
        lead={text.verticale.lead}
      >
        <Registru>
          {text.verticale.domenii.map((domeniu) => (
            <RandRegistru
              key={domeniu.titlu}
              titlu={domeniu.titlu}
              text={domeniu.text}
              dreapta={
                <p className="font-mk-date text-mk-text-slab mt-3 text-[0.6875rem] tracking-[0.06em] uppercase">
                  {domeniu.module.join(" · ")}
                </p>
              }
            />
          ))}
        </Registru>
        <p className="text-mk-text-slab mt-6 max-w-[62ch] text-[0.8125rem] leading-[1.55]">
          {text.verticale.nota}
        </p>
      </Banda>

      {/* ── 14. COMPARAȚIE ──────────────────────────────────────────────── */}
      <Banda
        id="comparatie"
        supratitlu={text.comparatie.supratitlu}
        titlu={text.comparatie.titlu}
        lead={text.comparatie.lead}
      >
        <div className="border-mk-rigla/40 mt-10 border-t">
          <div className="border-mk-rigla/40 hidden border-b py-3 sm:grid sm:grid-cols-2 sm:gap-10">
            <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
              {text.comparatie.capAzi}
            </p>
            <p className="font-mk-date border-mk-rigla/40 text-[0.6875rem] font-medium tracking-[0.14em] uppercase sm:border-l sm:pl-10">
              {text.comparatie.capNoi}
            </p>
          </div>
          {text.comparatie.perechi.map((pereche) => (
            <div
              key={pereche.azi}
              className="border-mk-rigla/40 grid gap-2 border-b py-4 sm:grid-cols-2 sm:gap-10"
            >
              <p className="text-mk-text-slab text-[0.9375rem] leading-[1.55]">{pereche.azi}</p>
              <p className="border-mk-rigla/40 text-[0.9375rem] leading-[1.55] sm:border-l sm:pl-10">
                {pereche.noi}
              </p>
            </div>
          ))}
        </div>
      </Banda>

      {/* ── 15. PREȚURI ─────────────────────────────────────────────────── */}
      <Banda
        id="preturi"
        inaltime="inalta"
        supratitlu={text.preturi.supratitlu}
        titlu={text.preturi.titlu}
        lead={text.preturi.lead}
      >
        <div className="mt-12 grid gap-px sm:grid-cols-2 lg:grid-cols-4">
          {text.preturi.planuri.map((plan) => (
            <div
              key={plan.cheie}
              className={`border-mk-rigla flex flex-col border p-6 ${
                plan.recomandat === true ? "border-mk-text border-2" : ""
              }`}
            >
              <h3 className="font-mk-display text-[1.375rem] leading-[1.15] font-semibold">
                {plan.nume}
              </h3>
              <p className="text-mk-text-slab mt-2 min-h-[3rem] text-[0.875rem] leading-[1.5]">
                {plan.pentru}
              </p>
              <p className="font-mk-date text-mk-text-slab mt-4 text-[0.6875rem] tracking-[0.14em] uppercase">
                {plan.pret}
              </p>
              <ul className="border-mk-rigla/40 mt-4 flex-1 space-y-1.5 border-t pt-4">
                {plan.module.map((cheie) => (
                  <li key={cheie} className="text-[0.8125rem] leading-[1.4]">
                    {numeModul.get(cheie) ?? cheie}
                  </li>
                ))}
              </ul>
              <Link
                href={text.hero.ctaPrimar.href}
                className={`mt-6 inline-flex h-11 items-center justify-center rounded px-4 text-[0.9375rem] font-medium transition-opacity hover:opacity-90 ${
                  plan.recomandat === true
                    ? "bg-mk-cerneala text-mk-text-inv"
                    : "border-mk-rigla hover:border-mk-text border"
                }`}
              >
                {text.preturi.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="text-mk-text-slab mt-6 max-w-[62ch] text-[0.8125rem] leading-[1.55]">
          {text.preturi.nota}
        </p>
        <Link
          href={text.preturi.legaturaPagina.href}
          className="mt-4 inline-block text-[0.9375rem] underline underline-offset-4"
        >
          {text.preturi.legaturaPagina.eticheta}
        </Link>
      </Banda>

      {/* ── 16. IMPLEMENTARE — singurul loc cu numerotare ───────────────── */}
      <Banda
        id="implementare"
        supratitlu={text.implementare.supratitlu}
        titlu={text.implementare.titlu}
        lead={text.implementare.lead}
      >
        <ol className="mt-12 grid gap-8 md:grid-cols-5">
          {text.implementare.pasi.map((pas, index) => (
            <li key={pas.titlu} className="border-mk-rigla/40 border-t pt-5">
              <p className="font-mk-date flex items-baseline gap-3 text-[0.6875rem] tracking-[0.14em] uppercase">
                <span className="text-mk-text text-[1.25rem] tabular-nums">{index + 1}</span>
                <span className="text-mk-text-slab">{pas.actor}</span>
              </p>
              <h3 className="font-mk-display mt-3 text-[1.0625rem] leading-[1.2] font-semibold">
                {pas.titlu}
              </h3>
              <p className="text-mk-text-slab mt-2 text-[0.875rem] leading-[1.55]">{pas.text}</p>
            </li>
          ))}
        </ol>
      </Banda>

      {/* ── 17. ÎNTREBĂRI ───────────────────────────────────────────────── */}
      <Banda
        id="intrebari"
        supratitlu={text.intrebari.supratitlu}
        titlu={text.intrebari.titlu}
        lead={text.intrebari.lead}
      >
        <div className="border-mk-rigla/40 mt-10 border-t">
          {text.intrebari.intrebari.map((intrebare) => (
            <details key={intrebare.q} className="border-mk-rigla/40 group border-b">
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 py-4 text-[1.0625rem] leading-[1.4] font-medium [&::-webkit-details-marker]:hidden">
                {intrebare.q}
                <span
                  aria-hidden="true"
                  className="font-mk-date text-mk-text-slab shrink-0 text-[0.875rem] group-open:hidden"
                >
                  +
                </span>
                <span
                  aria-hidden="true"
                  className="font-mk-date text-mk-text-slab hidden shrink-0 text-[0.875rem] group-open:inline"
                >
                  −
                </span>
              </summary>
              <p className="text-mk-text-slab max-w-[72ch] pb-5 text-[0.9375rem] leading-[1.6]">
                {intrebare.a}
              </p>
            </details>
          ))}
        </div>
      </Banda>

      {/* ── 18. CLIENȚI ─────────────────────────────────────────────────── */}
      <Banda
        id="clienti"
        inaltime="scurta"
        supratitlu={text.clienti.supratitlu}
        titlu={text.clienti.titlu}
      >
        <p className="text-mk-text-slab mt-5 max-w-[62ch] text-[0.9375rem] leading-[1.6]">
          {text.clienti.text}
        </p>
      </Banda>

      {/* ── 19. CONTACT (hârtie obligatoriu: aici stau controalele native) ─ */}
      <Banda
        id="contact"
        inaltime="inalta"
        supratitlu={text.contact.supratitlu}
        titlu={text.contact.titlu}
        lead={text.contact.lead}
      >
        <div className="mt-12 grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <dl className="border-mk-rigla/40 border-t">
              <div className="border-mk-rigla/40 border-b py-4">
                <dt className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.14em] uppercase">
                  {text.contact.telefonEticheta}
                </dt>
                <dd className="mt-1">
                  <a
                    href={CONTACT.telefonLegatura}
                    className="font-mk-date text-[1.25rem] tracking-[0.02em] tabular-nums"
                  >
                    {CONTACT.telefon}
                  </a>
                </dd>
              </div>
              <div className="border-mk-rigla/40 border-b py-4">
                <dt className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.14em] uppercase">
                  {text.contact.emailEticheta}
                </dt>
                <dd className="mt-1">
                  <a href={`mailto:${CONTACT.email}`} className="text-[0.9375rem] break-all">
                    {CONTACT.email}
                  </a>
                </dd>
              </div>
              <div className="border-mk-rigla/40 border-b py-4">
                <dt className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.14em] uppercase">
                  {text.contact.programEticheta}
                </dt>
                <dd className="mt-1 text-[0.9375rem]">{text.contact.program}</dd>
              </div>
            </dl>
            <p className="text-mk-text-slab mt-5 max-w-[42ch] text-[0.8125rem] leading-[1.55]">
              {text.contact.notaReferinte}
            </p>
          </div>

          <div className="lg:col-span-7">
            <h3 className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
              {text.contact.formularTitlu}
            </h3>
            <div className="mt-5 max-w-xl">
              <FormularDemo limba={text.limba} />
            </div>
          </div>
        </div>
      </Banda>
    </>
  );
}

function nume(text: ContinutLanding, cheie: string): string {
  return text.platforma.noduri.find((nod) => nod.cheie === cheie)?.eticheta ?? cheie;
}

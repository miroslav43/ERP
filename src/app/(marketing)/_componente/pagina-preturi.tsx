import Link from "next/link";

import { CONTACT } from "@/content/landing/contact";
import type { ContinutLanding } from "@/content/landing/tipuri";

import { Banda } from "./banda";

/**
 * Pagina de prețuri.
 *
 * Blocul de recapitulație al paginii: treisprezece module × patru planuri,
 * bifă sau liniuță. Zero sume — nu pentru că ne ferim, ci pentru că o grilă
 * publică ar fi neadevărată la firma care o citește. Motivul e scris pe pagină,
 * nu ascuns.
 *
 * Ruta `/preturi` era deja pe lista albă din `src/proxy.ts` și dădea 404.
 */
export function PaginaPreturi({ text }: { text: ContinutLanding }) {
  const modulele = text.module.grupuri.flatMap((grup) =>
    grup.module.map((modul) => ({ ...modul, grup: grup.titlu })),
  );

  return (
    <>
      <section className="bg-mk-hartie text-mk-text">
        <div className="max-w-mk mx-auto w-full px-[clamp(1rem,4vw,2.5rem)] pt-16 pb-12 sm:pt-24">
          <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
            {text.preturi.supratitlu}
          </p>
          <h1 className="font-mk-display mt-6 max-w-[18ch] text-[clamp(2.25rem,4.8vw,3.75rem)] leading-[1] font-semibold tracking-[-0.02em] text-balance">
            {text.preturi.titlu}
          </h1>
          <p className="text-mk-text-slab mt-6 max-w-[62ch] text-[1.0625rem] leading-[1.6] text-pretty">
            {text.preturi.lead}
          </p>
        </div>
      </section>

      <Banda inaltime="medie">
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
          {text.preturi.planuri.map((plan) => (
            <div
              key={plan.cheie}
              className={`border-mk-rigla flex flex-col border p-6 ${
                plan.recomandat === true ? "border-mk-text border-2" : ""
              }`}
            >
              <h2 className="font-mk-display text-[1.375rem] leading-[1.15] font-semibold">
                {plan.nume}
              </h2>
              <p className="text-mk-text-slab mt-2 min-h-[3rem] text-[0.875rem] leading-[1.5]">
                {plan.pentru}
              </p>
              <p className="font-mk-date text-mk-text-slab mt-4 flex-1 text-[0.6875rem] tracking-[0.14em] uppercase">
                {plan.pret}
              </p>
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

        <div className="border-mk-rigla mt-12 overflow-x-auto border">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{text.preturi.titlu}</caption>
            <thead>
              <tr className="border-mk-rigla border-b">
                <th
                  scope="col"
                  className="font-mk-date text-mk-text-slab px-3 py-2.5 text-[0.6875rem] font-medium tracking-[0.14em] uppercase"
                >
                  {text.preturi.capModul}
                </th>
                {text.preturi.planuri.map((plan) => (
                  <th
                    key={plan.cheie}
                    scope="col"
                    className="border-mk-liniatura border-l px-3 py-2.5 text-center text-[0.9375rem] font-semibold"
                  >
                    {plan.nume}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modulele.map((modul) => (
                <tr key={modul.cheie} className="border-mk-liniatura border-b last:border-b-0">
                  <th scope="row" className="px-3 py-2.5 text-[0.9375rem] font-normal">
                    {modul.titlu}
                    <span className="font-mk-date text-mk-text-slab ml-2 text-[0.6875rem]">
                      {modul.cheie}
                    </span>
                  </th>
                  {text.preturi.planuri.map((plan) => {
                    const inclus = plan.module.includes(modul.cheie);
                    return (
                      <td
                        key={plan.cheie}
                        className="border-mk-liniatura border-l px-3 py-2.5 text-center"
                      >
                        <span aria-hidden="true" className={inclus ? "" : "text-mk-text-slab"}>
                          {inclus ? "✓" : "—"}
                        </span>
                        <span className="sr-only">
                          {inclus
                            ? text.limba === "ro"
                              ? "inclus"
                              : "included"
                            : text.limba === "ro"
                              ? "neinclus"
                              : "not included"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-mk-text-slab mt-6 max-w-[62ch] text-[0.875rem] leading-[1.6]">
          {text.preturi.nota}
        </p>
      </Banda>

      <Banda fundal="cerneala" inaltime="medie" titlu={text.contact.titlu} lead={text.contact.lead}>
        <div className="mt-8 flex flex-wrap items-center gap-x-10 gap-y-4">
          <a
            href={CONTACT.telefonLegatura}
            className="font-mk-date text-[1.5rem] tracking-[0.02em] tabular-nums"
          >
            {CONTACT.telefon}
          </a>
          <a
            href={`mailto:${CONTACT.email}`}
            className="text-[0.9375rem] break-all underline underline-offset-4"
          >
            {CONTACT.email}
          </a>
          <Link
            href={text.hero.ctaPrimar.href}
            className="bg-mk-hartie text-mk-cerneala inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
          >
            {text.antet.demo}
          </Link>
        </div>
      </Banda>
    </>
  );
}

import Link from "next/link";

import { CONTACT } from "@/content/landing/contact";
import { MODULE_NUCLEU, moduleleDin, PACHETE, PRETURI_MODULE } from "@/content/landing/preturi";
import type { ContinutLanding } from "@/content/landing/tipuri";

import { Banda } from "./banda";
import { GrilaPachete } from "./benzi/comercial";

/**
 * Pagina de prețuri.
 *
 * ── CE S-A SCHIMBAT ───────────────────────────────────────────────────────
 * Pagina afișa „Preț la cerere” pe toate planurile, cu motivul scris pe pagină:
 * o grilă publică ar fi fost neadevărată la firma care o citește. Motivul era
 * onest, dar consecința nu se vedea: un motor generativ nu poate cita o cifră pe
 * care n-o are, iar la întrebarea „cât costă un program de pontaj pentru
 * cincisprezece angajați” răspunsul se construiește din cine a publicat un
 * număr.
 *
 * Acum e aici tabelul întreg — prețul FIECĂRUI modul, nu doar al pachetelor.
 * Asta e ce nu încape pe pagina de start și ce nu are alt loc unde să stea.
 *
 * Sumele vin din `content/landing/preturi.ts`, într-un singur exemplar. Grila de
 * pachete e aceeași componentă ca pe pagina de start: două grile care trebuie să
 * spună același lucru sunt două grile care vor ajunge să nu-l spună.
 */
export function PaginaPreturi({ text }: { text: ContinutLanding }) {
  const modulele = text.module.grupuri.flatMap((grup) =>
    grup.module.map((modul) => ({ ...modul, grup: grup.titlu })),
  );
  const inclusInNucleu = new Set<string>(MODULE_NUCLEU);
  const roman = text.limba === "ro";

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
        <GrilaPachete text={text} />

        <div className="mt-8 grid gap-x-10 gap-y-3 sm:grid-cols-2">
          <p className="text-[0.9375rem] leading-[1.6]">{text.preturi.primaLuna}</p>
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6]">
            {text.preturi.mentiuneTva}
          </p>
          <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6]">
            {text.preturi.pestePrag}
          </p>
        </div>

        {/* `relative` e obligatoriu: vezi nota din `matrice.tsx`. Fără el,
            spanurile `sr-only` din celule scapă din containerul derulabil și
            lărgesc pagina cu vreo trei sute de pixeli pe telefon. */}
        <div className="border-mk-rigla relative mt-12 overflow-x-auto border">
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
                {/* Coloana care lipsea: cât costă modulul luat singur. E singurul
                    motiv pentru care cineva deschide pagina asta în loc să
                    citească grila de pachete de mai sus. */}
                <th
                  scope="col"
                  className="font-mk-date text-mk-text-slab border-mk-liniatura border-l px-3 py-2.5 text-right text-[0.6875rem] font-medium tracking-[0.14em] uppercase"
                >
                  {roman ? "Separat" : "On its own"}
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
              {modulele.map((modul) => {
                const pret = PRETURI_MODULE[modul.cheie];
                return (
                  <tr key={modul.cheie} className="border-mk-liniatura border-b last:border-b-0">
                    <th scope="row" className="px-3 py-2.5 text-[0.9375rem] font-normal">
                      {modul.titlu}
                      <span className="font-mk-date text-mk-text-slab ml-2 text-[0.6875rem]">
                        {modul.cheie}
                      </span>
                    </th>
                    <td className="font-mk-date border-mk-liniatura border-l px-3 py-2.5 text-right text-[0.875rem] tabular-nums">
                      {pret === undefined ? (
                        <span className="text-mk-text-slab text-[0.8125rem]">
                          {roman ? "în nucleu" : "in the core"}
                        </span>
                      ) : (
                        pret
                      )}
                    </td>
                    {text.preturi.planuri.map((plan) => {
                      const pachet = PACHETE.find((p) => p.cheie === plan.cheie);
                      const inclus =
                        pachet !== undefined &&
                        (inclusInNucleu.has(modul.cheie) ||
                          moduleleDin(pachet).includes(modul.cheie));
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
                              ? roman
                                ? "inclus"
                                : "included"
                              : roman
                                ? "neinclus"
                                : "not included"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
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
            {text.hero.ctaPrimar.eticheta}
          </Link>
        </div>
      </Banda>
    </>
  );
}

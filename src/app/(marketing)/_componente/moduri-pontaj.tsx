import type { ContinutLanding } from "@/content/landing/tipuri";

/**
 * Cele două piste: ce merge azi și ce nu există încă.
 *
 * Notația pentru viitor NU e o etichetă „coming soon" pe un card altfel normal.
 * E hașura de condică: într-un registru, o celulă barată înseamnă „nu s-a
 * întâmplat și nu se mai poate scrie aici". Celulele hașurate n-au hover, nu se
 * animă și nu sunt apăsabile — o celulă barată e definitiv barată.
 *
 * Linia de mijloc e literalmente granița dintre hârtie și cerneală.
 */
export function ModuriPontaj({ text }: { text: ContinutLanding["pontaj"] }) {
  return (
    <>
      <p className="font-mk-date text-mk-text-slab mt-10 text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
        {text.livrateTitlu}
      </p>
      <ul className="mt-4 grid gap-px sm:grid-cols-2 lg:grid-cols-4">
        {text.livrate.map((mod) => (
          <li key={mod.titlu} className="border-mk-rigla flex flex-col border p-5">
            <h3 className="font-mk-display text-[1.125rem] leading-[1.2] font-semibold">
              {mod.titlu}
            </h3>
            <p className="text-mk-text-slab mt-2.5 flex-1 text-[0.875rem] leading-[1.55]">
              {mod.text}
            </p>
            <p className="border-mk-liniatura font-mk-date text-mk-text-slab mt-4 border-t pt-3 text-[0.6875rem] leading-[1.4] tracking-[0.04em]">
              {mod.detaliu}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Jumătatea de jos a benzii, pe cerneală: ce nu există. */
export function ViitorPontaj({ text }: { text: ContinutLanding["pontaj"] }) {
  return (
    <>
      <p className="font-mk-date text-mk-text-inv-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
        {text.viitoareTitlu}
      </p>
      <ul className="mt-4 grid gap-px sm:grid-cols-2 lg:grid-cols-4">
        {text.viitoare.map((mod) => (
          <li
            key={mod.titlu}
            className="border-mk-rigla-inv mk-hasura relative border p-5"
            aria-describedby="nota-viitor-pontaj"
          >
            {/* Hașura stă sub text, nu peste el: altfel ar scădea contrastul
                exact acolo unde omul chiar citește. */}
            <div className="bg-mk-cerneala/85 absolute inset-0" aria-hidden="true" />
            <div className="relative">
              <h3 className="font-mk-display text-[1.125rem] leading-[1.2] font-semibold">
                {mod.titlu}
              </h3>
              <p className="text-mk-text-inv-slab mt-2.5 text-[0.875rem] leading-[1.55]">
                {mod.text}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p
        id="nota-viitor-pontaj"
        className="text-mk-text-inv-slab mt-6 max-w-[62ch] text-[0.875rem] leading-[1.6]"
      >
        {text.notaViitoare}
      </p>
    </>
  );
}

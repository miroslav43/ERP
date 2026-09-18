import Link from "next/link";

/**
 * Lista de pagini a unui hub: titlu legat și lead, pe un rând.
 *
 * Aceeași formă ca lista de domenii de pe `/domenii`, scoasă aici fiindcă o
 * folosesc acum trei hub-uri — `/ghid`, `/unelte`, `/comparatie`. Titlurile și
 * lead-urile vin din antetele paginilor-copil, nu sunt rescrise în hub.
 */
export function ListaHub({
  pagini,
}: {
  pagini: readonly Readonly<{ href: string; titlu: string; lead: string; nota?: string }>[];
}) {
  return (
    <div className="border-mk-rigla/40 mt-8 border-t">
      {pagini.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          className="border-mk-rigla/40 hover:bg-mk-text/[0.02] grid gap-2 border-b py-5 transition-colors md:grid-cols-12 md:gap-8"
        >
          {/* `h3`, nu `span`: hub-ul e o listă de pagini, iar titlurile lor sunt
              structura pe care o citesc și cititorul de ecran, și motorul. */}
          <h3 className="font-mk-display text-[1.0625rem] leading-[1.25] font-semibold md:col-span-4">
            {p.titlu}
          </h3>
          <span className="text-mk-text-slab text-[0.9375rem] leading-[1.6] md:col-span-8">
            {p.lead}
            {p.nota !== undefined && (
              <span className="font-mk-date text-mk-text-slab mt-2 block text-[0.6875rem] tracking-[0.14em] uppercase">
                {p.nota}
              </span>
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}

// src/app/(app)/angajati/[id]/sectiune-salarizare.tsx
import Link from "next/link";

import { formatLei } from "@/lib/format/money";
import { rezumatSalarizareAngajat } from "@/lib/queries/payroll";
import { numeLuna } from "@/app/(app)/salarizare/etichete";

/**
 * Salarizarea omului, de pe fișa lui: ultimul fluturaș, popririle, istoricul.
 *
 * Fișa arăta din salarizare doar scutirile și componentele (analiza
 * 2026-10-08, salarizare-L20): ca să ajungi la fluturașul lui trebuia să știi
 * luna, să deschizi perioada și să-l cauți în tabel. Apelantul montează
 * secțiunea doar prin poarta lui `/salarizare` (modul pornit + `payroll:read =
 * all`); linkurile secundare primesc fiecare poarta ei, calculată tot acolo.
 */
export async function SectiuneSalarizare({
  organizationId,
  employeeId,
  hrefIstoricVenituri,
  hrefPopriri,
  hrefComponente,
  className,
}: Readonly<{
  organizationId: string;
  employeeId: string;
  /** `/salarizare/istoric-venituri?angajat=` cere `payroll:create = all`; `null` = fără drept. */
  hrefIstoricVenituri: string | null;
  hrefPopriri: string | null;
  hrefComponente: string | null;
  className?: string;
}>) {
  const rezumat = await rezumatSalarizareAngajat(organizationId, employeeId);
  const { ultimulFluturas } = rezumat;

  return (
    <section aria-labelledby="titlu-salarizare" className={className}>
      <h2 id="titlu-salarizare" className="text-sectiune mb-1 font-medium">
        Salarizare
      </h2>
      <p className="text-muted-foreground text-corp mb-3">
        {ultimulFluturas === null ? (
          "Angajatul n-a fost încă pe niciun stat de plată calculat."
        ) : (
          <>
            Ultimul fluturaș:{" "}
            <Link
              href={`/salarizare/${ultimulFluturas.period_id}/${ultimulFluturas.id}`}
              className="underline underline-offset-2"
            >
              {numeLuna(ultimulFluturas.luna)} {String(ultimulFluturas.an)}
            </Link>
            , net de plată {formatLei(ultimulFluturas.net_de_plata)}
            {rezumat.fluturasi > 1 ? ` · ${String(rezumat.fluturasi)} fluturași în total` : ""}.
          </>
        )}
      </p>
      <ul className="text-corp flex flex-wrap gap-x-4 gap-y-1">
        {hrefPopriri === null ? null : (
          <li>
            <Link href={hrefPopriri} className="underline-offset-2 hover:underline">
              {rezumat.popririActive === 0
                ? "Popriri"
                : rezumat.popririActive === 1
                  ? "Un dosar de poprire activ"
                  : `${String(rezumat.popririActive)} dosare de poprire active`}
            </Link>
          </li>
        )}
        {hrefIstoricVenituri === null ? null : (
          <li>
            <Link href={hrefIstoricVenituri} className="underline-offset-2 hover:underline">
              Istoricul de venituri
            </Link>
          </li>
        )}
        {hrefComponente === null ? null : (
          <li>
            <Link href={hrefComponente} className="underline-offset-2 hover:underline">
              Șabloanele de sporuri și prime
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}

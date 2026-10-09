import Link from "next/link";

import { amendaEvidenta } from "@/content/landing/intrebari-pontaj";
import { EVIDENTA_ORELOR } from "@/content/legal/evidenta-orelor";

import { Banda } from "./banda";

/**
 * „Ce cere inspectorul de muncă” pe paginile foii de pontaj și ale condicii.
 *
 * Cerința și amenzile vin din pagina evidenței orelor, nu sunt rescrise:
 * aceeași frază, aceeași sumă, același temei — iar `acoperire` spune cinstit
 * cât din cerință acoperă documentul de pe pagina asta (auditul din 8 oct 2026:
 * foaia colectivă singură NU acoperă art. 119).
 */
export function CeCereItm({ acoperire }: Readonly<{ acoperire: string }>) {
  const [cerinta] = EVIDENTA_ORELOR.raspunsScurt;
  const amenzi = [amendaEvidenta("m"), amendaEvidenta("e3")];
  return (
    <Banda inaltime="medie" supratitlu="Control ITM" titlu="Ce cere inspectorul de muncă">
      <div className="mt-6 max-w-[68ch] space-y-4 text-[0.9375rem] leading-[1.7]">
        {cerinta !== undefined && <p>{cerinta}</p>}
        <p className="font-medium">{acoperire}</p>
      </div>
      <dl className="border-mk-rigla/40 mt-8 max-w-[68ch] border-t">
        {amenzi.map((a) => (
          <div
            key={a.temei}
            className="border-mk-rigla/40 grid gap-1 border-b py-4 sm:grid-cols-[1fr_auto] sm:gap-x-6"
          >
            <dt className="text-[0.9375rem] leading-[1.5]">{a.fapta}</dt>
            <dd className="font-mk-date text-[0.9375rem] tabular-nums sm:text-right">{a.suma}</dd>
            <dd className="text-mk-text-slab text-[0.8125rem] sm:col-span-2">
              {a.aplicare === undefined ? a.temei : `${a.aplicare} · ${a.temei}`}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-[0.9375rem]">
        <Link href="/evidenta-orelor-de-munca" className="underline underline-offset-4">
          Tot ce cere art. 119, cu toate amenzile
        </Link>
        .
      </p>
    </Banda>
  );
}

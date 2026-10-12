// src/app/(app)/flota/rapoarte/navigare-luna.tsx
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactElement } from "react";

import { etichetaLuna, lunaDinZi, lunaMutata } from "@/domain/fleet/rapoarte";
import { Buton } from "@/components/ui/buton";
import { cn } from "@/lib/ui/cn";
import type { OptiuneVehicul } from "@/lib/queries/fleet-rapoarte";

import { adresaRaport } from "./adrese";

const LEGATURA =
  "border-border text-corp hover:bg-surface inline-flex h-9 items-center gap-1 rounded-md border px-3 pointer-coarse:h-11";

/**
 * Luna aleasă și filtrul pe vehicul. Fără JavaScript: luna se schimbă prin
 * legături, vehiculul printr-un `<form method="get">` — starea stă în adresă, ca
 * la arhiva pontajului.
 *
 * „Luna următoare” dispare după luna curentă: o lună viitoare n-are foi aprobate,
 * iar un raport gol ar arăta ca o flotă care nu a mers.
 */
export function NavigareLuna({
  luna,
  vehicul,
  azi,
  vehicule,
}: Readonly<{
  luna: string;
  vehicul: string | null;
  azi: string;
  vehicule: readonly OptiuneVehicul[];
}>): ReactElement {
  const anterioara = lunaMutata(luna, -1);
  const urmatoare = lunaMutata(luna, 1);
  const areUrmatoare = urmatoare <= lunaDinZi(azi);

  return (
    <div className="border-border bg-surface flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <nav aria-label="Luna raportului" className="flex items-center gap-2">
        <Link
          href={adresaRaport(anterioara, vehicul)}
          className={LEGATURA}
          rel="prev"
          aria-label={`Luna anterioară, ${etichetaLuna(anterioara)}`}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          <span aria-hidden="true" className="hidden sm:inline">
            {etichetaLuna(anterioara)}
          </span>
        </Link>
        <h2 className="text-sectiune min-w-40 text-center font-semibold capitalize">
          {etichetaLuna(luna)}
        </h2>
        {areUrmatoare ? (
          <Link
            href={adresaRaport(urmatoare, vehicul)}
            className={LEGATURA}
            rel="next"
            aria-label={`Luna următoare, ${etichetaLuna(urmatoare)}`}
          >
            <span aria-hidden="true" className="hidden sm:inline">
              {etichetaLuna(urmatoare)}
            </span>
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        ) : (
          // Păstrează lățimea, ca titlul lunii să nu sară când dispare legătura.
          <span aria-hidden="true" className={cn(LEGATURA, "invisible hidden sm:inline-flex")}>
            {etichetaLuna(urmatoare)}
          </span>
        )}
      </nav>

      <form
        action="/flota/rapoarte"
        method="get"
        className="ml-auto flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="luna" value={luna} />
        <div className="flex flex-col gap-1">
          <label htmlFor="raport-vehicul" className="text-nota text-muted-foreground">
            Vehicul
          </label>
          <select
            id="raport-vehicul"
            name="vehicul"
            defaultValue={vehicul ?? ""}
            className="border-border bg-background text-corp focus-visible:ring-ring h-9 min-w-44 rounded-md border px-2 focus-visible:ring-2 focus-visible:outline-none pointer-coarse:h-11"
          >
            <option value="">Toată flota</option>
            {vehicule.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nr_inmatriculare}
              </option>
            ))}
          </select>
        </div>
        <Buton type="submit" varianta="secundar">
          Arată
        </Buton>
      </form>
    </div>
  );
}

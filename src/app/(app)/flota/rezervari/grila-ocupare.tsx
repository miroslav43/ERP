// src/app/(app)/flota/rezervari/grila-ocupare.tsx
//
// Grila de ocupare a mașinilor de pool: zi × vehicul. Componentă de SERVER,
// din `grilaOcupare()` (domeniu pur). Fără identitatea colegilor: o celulă e
// liberă, a mea, ocupată sau în așteptare — atât întoarce
// `public.ocuparea_vehiculelor_pool`.
//
// Derulabilă orizontal la lățimea telefonului: `relative` pe container, fiindcă
// un `sr-only` dintr-un container derulabil fără poziționare târa pagina
// întreagă lateral (memoria „`sr-only` în container derulabil”). Prima coloană e
// lipită; tabelul NU are `border-collapse`, care ar lăsa celula lipită să nu
// acopere.
import Link from "next/link";
import type { ReactElement } from "react";

import type { GrilaOcupare, StareCelula, VehiculGrila } from "@/domain/fleet/rezervari";

import { ziLuna, ziuaScurt } from "./etichete";

const CLASE_CELULA: Readonly<Record<StareCelula, string>> = {
  liber: "bg-surface text-muted-foreground",
  al_meu: "bg-success/15 text-success font-medium",
  ocupat: "bg-border/50 text-foreground",
  in_asteptare: "bg-warning/15 text-warning",
};

function textCelula(stare: StareCelula, sursa: string | null): string {
  switch (stare) {
    case "liber":
      return "Liber";
    case "al_meu":
      return "Al meu";
    case "in_asteptare":
      return "Cerut";
    case "ocupat":
      return sursa === "alocare" ? "Alocat" : sursa === "foaie" ? "Foaie" : "Ocupat";
  }
}

export type PropsGrilaOcupare<V extends VehiculGrila> = Readonly<{
  grila: GrilaOcupare<V>;
  /**
   * Ruta casetei de rezervare nouă (`/flota/rezervari` sau
   * `/portal/masina-mea/rezervari`). `null` = fără drept de rezervare: celulele
   * libere nu mai sunt linkuri.
   */
  bazaRezervare: string | null;
  azi: string;
}>;

export function GrilaOcuparii<V extends VehiculGrila>({
  grila,
  bazaRezervare,
  azi,
}: PropsGrilaOcupare<V>): ReactElement {
  return (
    <div className="border-border rounded-panou relative overflow-x-auto border">
      <table className="text-nota w-max min-w-full border-separate border-spacing-0">
        <caption className="sr-only">
          Ocuparea mașinilor comune pe următoarele {grila.zile.length} zile. Celulele libere deschid
          rezervarea.
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="bg-surface border-border sticky left-0 z-10 border-r border-b px-3 py-2 text-left font-medium"
            >
              Mașina
            </th>
            {grila.zile.map((zi) => (
              <th
                key={zi}
                scope="col"
                aria-current={zi === azi ? "date" : undefined}
                className="border-border aria-[current=date]:text-foreground text-muted-foreground border-b px-2 py-2 text-center font-normal"
              >
                <span className="block">{ziuaScurt(zi)}</span>
                <span className="block tabular-nums">{ziLuna(zi)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grila.randuri.map(({ vehicul, celule }) => (
            <tr key={vehicul.id}>
              <th
                scope="row"
                className="bg-surface border-border sticky left-0 z-10 border-r border-b px-3 py-2 text-left font-medium whitespace-nowrap"
              >
                {vehicul.nr_inmatriculare}
              </th>
              {celule.map((c) => {
                const text = textCelula(c.stare, c.sursa);
                const clase = `${CLASE_CELULA[c.stare]} border-border block min-w-16 border-b px-2 py-2 text-center`;
                return (
                  <td key={c.zi} className="p-0">
                    {c.stare === "liber" && bazaRezervare !== null ? (
                      <Link
                        href={`${bazaRezervare}?rezervare=noua&vehicul=${vehicul.id}&de_la=${c.zi}`}
                        className={`${clase} hover:bg-accent/8 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none`}
                        aria-label={`Rezervă ${vehicul.nr_inmatriculare} pe ${ziLuna(c.zi)}`}
                      >
                        {text}
                      </Link>
                    ) : (
                      <span className={clase}>{text}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

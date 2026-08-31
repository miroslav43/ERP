"use client";

import { usePathname } from "next/navigation";
import { BandaFile, Fila } from "@/components/ui/file";

interface IntrareFila {
  readonly href: string;
  readonly eticheta: string;
}

/**
 * File în pagină, nu intrări noi de meniu. Primește BOOLEENI, nu harta de
 * permisiuni — o componentă client nu poate importa `can` sau orice atinge
 * `@/lib/auth`, `@/lib/supabase`, `@/lib/tenant` (trag după ele `server-only`
 * și `next/headers`); boolenii se calculează pe server și se pasează ca
 * proprietăți.
 *
 * `src/config/navigation.ts` cere doar ruta rădăcină `/pontaj`. Ascunderea
 * unei file pentru cine nu are dreptul NU e barieră de securitate: fiecare
 * pagină verifică din nou permisiunea, iar RLS respinge rândurile chiar dacă
 * cineva tastează URL-ul direct.
 */
interface Proprietati {
  readonly poateAproba: boolean;
  readonly poateConfigura: boolean;
}

export function NavPontaj({ poateAproba, poateConfigura }: Proprietati) {
  const cale = usePathname();

  const file: readonly IntrareFila[] = [
    // „Prezența", nu „Foaie": ruta are acum trei vizualizări — săptămâna pe ore,
    // luna ca un calendar și foaia colectivă — iar numele uneia singure dintre
    // ele n-are ce căuta pe filă. Contrastul util e cu fila următoare: aici e ce
    // s-a lucrat, dincolo e ce se planifică.
    { href: "/pontaj", eticheta: "Prezența" },
    { href: "/pontaj/saptamana", eticheta: "Planul săptămânii" },
    { href: "/pontaj/perioade", eticheta: "Perioade" },
    ...(poateAproba ? [{ href: "/pontaj/aprobare", eticheta: "Aprobare" }] : []),
    // Setările n-au avut niciodată filă: se ajungea la ele doar printr-un buton
    // din antetul foii colective, iar cine nu-l observa n-avea de unde ști că
    // pontarea de pe telefon se configurează undeva.
    ...(poateConfigura ? [{ href: "/pontaj/setari", eticheta: "Setări" }] : []),
  ];

  return (
    <BandaFile eticheta="Navigare pontaj">
      {file.map((fila) => {
        const activ = fila.href === "/pontaj" ? cale === fila.href : cale.startsWith(fila.href);
        return (
          <Fila key={fila.href} href={fila.href} activ={activ}>
            {fila.eticheta}
          </Fila>
        );
      })}
    </BandaFile>
  );
}

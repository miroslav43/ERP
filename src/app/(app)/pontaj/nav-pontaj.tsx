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
/**
 * Fără `poateConfigura`: setările au buton de antet, nu filă. Paginile pasează
 * mai departe `{...fileNav}`, care ARE câmpul — o proprietate în plus într-un
 * spread JSX nu e eroare, la fel ca `necesitaAprobare`, care nici el n-a fost
 * vreodată al benzii.
 */
interface Proprietati {
  readonly poateAproba: boolean;
  readonly poateVedeaArhiva: boolean;
}

export function NavPontaj({ poateAproba, poateVedeaArhiva }: Proprietati) {
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
    ...(poateVedeaArhiva ? [{ href: "/pontaj/arhiva", eticheta: "Arhiva" }] : []),
    // Setările NU sunt filă. Au fost, cât timp butonul de dinainte exista pe un
    // singur ecran și dispărea la orice pas în lateral — dar leacul muta lucrul
    // greșit: banda de aici e a vizualizărilor aceluiași pontaj, iar un ecran de
    // administrare pus în același rând se citește ca a șasea vizualizare.
    // Acum drumul spre ele e `ButonSetariPontaj`, în antetul FIECĂREI pagini a
    // modulului, ca la concedii. `poateConfigura` rămâne în `FilePontaj` și se
    // duce acolo, nu aici.
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

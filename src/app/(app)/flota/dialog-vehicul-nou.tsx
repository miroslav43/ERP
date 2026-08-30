"use client";

import { CarFront } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";

import { FormularDialog } from "@/components/ui/formular-dialog";

import { creeazaVehicul } from "./actions";
import { CampuriVehicul } from "./campuri-vehicul";
import { valoriVehicul } from "./valori-vehicul";

/**
 * Vehiculul nou, în casetă. Ruta `/flota/nou` a dispărut.
 *
 * Tiparul e cel din `concedii` (commit 4ad7daa): ruta veche se șterge fără
 * redirect, iar fiecare intrare spre ea devine `?vehicul=nou` pe listă. Motivul
 * e același — un formular de treisprezece câmpuri care înlocuiește tot ecranul
 * te face să pierzi din ochi parcul, exact lista pe care vrei s-o consulți cât
 * completezi („mai am deja mașina asta?").
 *
 * ── DE CE AICI SE NAVIGHEAZĂ DUPĂ REUȘITĂ, IAR LA FOI NU ─────────────────────
 * Foaia de parcurs se termină cu salvarea: apare în listă ca ciornă și gata.
 * Mașina nouă nu — primul lucru care urmează e ITP-ul și RCA-ul ei, iar acelea
 * se completează pe fișă. `laReusita` duce direct acolo, altfel omul ar căuta-o
 * singur în listă ca să facă pasul evident următor.
 */
interface Proprietati {
  readonly deschisInitial?: boolean;
}

export function DialogVehiculNou({ deschisInitial = false }: Proprietati): ReactElement {
  const router = useRouter();

  async function trimite(date: FormData) {
    return creeazaVehicul(valoriVehicul(date));
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Vehicul nou",
        pictograma: <CarFront aria-hidden="true" className="size-4" />,
      }}
      titlu="Vehicul nou"
      descriere="Numărul de înmatriculare se normalizează singur — se scriu doar literele și cifrele. Documentele (ITP, RCA, rovinietă) se adaugă pe fișa vehiculului, imediat după salvare."
      marime="lucru"
      deschisInitial={deschisInitial}
      actiune={trimite}
      mesajReusita="Vehiculul a fost adăugat în parc."
      etichetaTrimite="Adaugă vehiculul"
      textInCurs="Se salvează…"
      faraReimprospatare
      laReusita={(vehicul: Readonly<{ id: string }>) => {
        router.push(`/flota/${vehicul.id}`);
      }}
    >
      {(stare, idc) => <CampuriVehicul stare={stare} idc={idc} />}
    </FormularDialog>
  );
}

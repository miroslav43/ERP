"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";

import { FormularDialog } from "@/components/ui/formular-dialog";
import type { VariantaButon } from "@/components/ui/buton";

import { creeazaSesizare, type EchipamentCautat } from "../actions";
import { CampuriSesizare } from "./campuri-sesizare";
import { valoriSesizare } from "./valori-sesizare";

/**
 * Sesizarea nouă, în casetă — pe lista de sesizări din aplicație și pe cea din
 * portal. Rutele `/mentenanta/sesizari/noua` și `/portal/sesizari/noua` au
 * rămas doar ca REDIRECTURI spre `?sesizare=noua`: autocolantele QR lipite pe
 * utilaje le codifică deja, cu `?echipament=<id>`, iar un autocolant tipărit nu
 * se actualizează cu un deploy.
 *
 * ── DUPLICATUL SE ANUNȚĂ, NU SE BLOCHEAZĂ ────────────────────────────────────
 * Echipamentul vine cu `sesizare_deschisa`: dacă există deja una, câmpurile
 * arată o bandă cu numărul și linkul ei. A doua sesizare rămâne posibilă — pot
 * fi două defecte diferite —, iar la triaj se poate respinge ca duplicat.
 *
 * ── UNDE AJUNGE DUPĂ TRIMITERE ───────────────────────────────────────────────
 * Pe fișa sesizării abia create: în aplicație urmează triajul, în portal omul
 * își vede sesizarea cu starea, cronologia și locul pentru fotografii.
 */
interface Proprietati {
  readonly deschisInitial?: boolean;
  readonly echipamentPrefill: EchipamentCautat | null;
  readonly prefillEsuat: boolean;
  readonly zona: "app" | "portal";
  readonly varianta?: VariantaButon;
}

export function DialogSesizareNoua({
  deschisInitial = false,
  echipamentPrefill,
  prefillEsuat,
  zona,
  varianta = "primar",
}: Proprietati): ReactElement {
  const router = useRouter();

  async function trimite(date: FormData) {
    return creeazaSesizare(valoriSesizare(date));
  }

  const radacina = zona === "app" ? "/mentenanta/sesizari" : "/portal/sesizari";

  return (
    <FormularDialog
      declansator={{
        eticheta: "Sesizare nouă",
        varianta,
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu="Sesizare de defecțiune"
      descriere="Căutați utilajul după cod sau denumire — sau scanați codul QR de pe el — și spuneți ce ați observat. Durează un minut; responsabilii de mentenanță o văd imediat."
      marime="mare"
      deschisInitial={deschisInitial}
      actiune={trimite}
      mesajReusita="Sesizarea a fost trimisă."
      etichetaTrimite="Trimite sesizarea"
      textInCurs="Se trimite…"
      faraReimprospatare
      laReusita={(sesizare: Readonly<{ id: string }>) => {
        router.push(`${radacina}/${sesizare.id}`);
      }}
    >
      {(stare, idc) => (
        <CampuriSesizare
          stare={stare}
          idc={idc}
          echipamentPrefill={echipamentPrefill}
          prefillEsuat={prefillEsuat}
          radacinaSesizari={radacina}
        />
      )}
    </FormularDialog>
  );
}

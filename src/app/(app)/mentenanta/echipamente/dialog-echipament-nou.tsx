"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";

import { FormularDialog } from "@/components/ui/formular-dialog";

import { creeazaEchipament } from "../actions";
import {
  CampuriEchipament,
  type OptiuneEchipament,
  type ValoriInitialeEchipament,
} from "./campuri-echipament";
import { valoriEchipament } from "./valori-echipament";

/**
 * Echipamentul nou, în casetă. Ruta `/mentenanta/echipamente/nou` a dispărut.
 *
 * Tiparul e cel din Flotă (`dialog-vehicul-nou.tsx`) și Inventar: ruta veche se
 * șterge, iar fiecare intrare spre ea devine `?echipament=nou` pe listă. Motivul
 * e același — un formular de șaisprezece câmpuri care înlocuiește tot ecranul
 * te face să pierzi din ochi parcul, exact lista pe care vrei s-o consulți cât
 * completezi („ce cod urmează?", „mai am deja presa asta?").
 *
 * ── „ADAUGĂ UNUL LA FEL" ─────────────────────────────────────────────────────
 * `model` precompletează câmpurile cu fișa altui echipament, FĂRĂ cod și fără
 * serie — amândouă sunt unice pe utilaj. Cinci stivuitoare identice se introduc
 * așa din cinci clicuri, nu din cinci formulare completate de la zero.
 *
 * ── DE CE SE NAVIGHEAZĂ DUPĂ REUȘITĂ ─────────────────────────────────────────
 * Primul lucru care urmează unui echipament nou e pe fișa lui: prima citire de
 * contor, planul de mentenanță, autorizația ISCIR. `laReusita` duce direct
 * acolo; `faraReimprospatare` fiindcă lista pe care eram se părăsește oricum.
 */
interface Proprietati {
  readonly deschisInitial?: boolean;
  readonly angajati: readonly OptiuneEchipament[];
  readonly departamente: readonly OptiuneEchipament[];
  readonly ssmActiv: boolean;
  readonly poateDerogare: boolean;
  /** Fișa după care se copiază câmpurile („Adaugă unul la fel”). */
  readonly model?: ValoriInitialeEchipament | undefined;
}

export function DialogEchipamentNou({
  deschisInitial = false,
  angajati,
  departamente,
  ssmActiv,
  poateDerogare,
  model,
}: Proprietati): ReactElement {
  const router = useRouter();

  async function trimite(date: FormData) {
    return creeazaEchipament(valoriEchipament(date));
  }

  const valoriInitiale: ValoriInitialeEchipament | undefined =
    model === undefined ? undefined : { ...model, cod: "", serie: null };

  return (
    <FormularDialog
      declansator={{
        eticheta: "Echipament nou",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu={model === undefined ? "Echipament nou" : `Echipament nou, după „${model.denumire}”`}
      descriere="Codul e unic în organizație și ajunge pe eticheta QR a utilajului. Contoarele, planurile de mentenanță și autorizațiile ISCIR se adaugă pe fișa echipamentului, imediat după salvare."
      marime="lucru"
      deschisInitial={deschisInitial}
      actiune={trimite}
      mesajReusita="Echipamentul a fost adăugat."
      etichetaTrimite="Adaugă echipamentul"
      textInCurs="Se salvează…"
      faraReimprospatare
      laReusita={(echipament: Readonly<{ id: string }>) => {
        router.push(`/mentenanta/echipamente/${echipament.id}`);
      }}
    >
      {(stare, idc) => (
        <CampuriEchipament
          stare={stare}
          idc={idc}
          angajati={angajati}
          departamente={departamente}
          ssmActiv={ssmActiv}
          poateDerogare={poateDerogare}
          echipament={valoriInitiale}
        />
      )}
    </FormularDialog>
  );
}

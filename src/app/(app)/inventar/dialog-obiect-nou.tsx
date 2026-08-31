"use client";

import { PackagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";

import { FormularDialog } from "@/components/ui/formular-dialog";

import { creeazaObiect } from "./actions";
import { CampuriObiect, type OptiuneCategorie } from "./campuri-obiect";
import { valoriObiect } from "./valori-obiect";

/**
 * Obiectul nou, în casetă. Ruta `/inventar/nou` a dispărut.
 *
 * Tiparul e cel din `concedii` (4ad7daa) și din `flota`: ruta veche se șterge,
 * iar intrările spre ea devin `?obiect=nou` pe listă. Motivul e literal cel din
 * docblock-ul lui `FormularDialog` — un formular de douăsprezece câmpuri care
 * înlocuia tot ecranul te făcea să pierzi din ochi tocmai registrul pe care vrei
 * să-l consulți cât completezi: „numărul ăsta e deja luat?”, întrebarea de
 * dinaintea câmpului „Număr de inventar”, se punea cu formularul închis.
 *
 * ── DE CE SE NAVIGHEAZĂ SPRE FIȘĂ DUPĂ REUȘITĂ ───────────────────────────
 * Înregistrarea unui obiect nu e capătul gestului: pasul următor e predarea lui
 * cuiva, iar aceea se face pe fișă. `laReusita` duce direct acolo, cu
 * `faraReimprospatare` — lista pe care o părăsim n-are de ce să se
 * reîmprospăteze.
 */
interface Proprietati {
  readonly categorii: readonly OptiuneCategorie[];
  readonly deschisInitial?: boolean;
}

export function DialogObiectNou({ categorii, deschisInitial = false }: Proprietati): ReactElement {
  const router = useRouter();

  async function trimite(date: FormData) {
    return creeazaObiect(valoriObiect(date));
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Obiect nou",
        pictograma: <PackagePlus aria-hidden="true" className="size-4" />,
      }}
      titlu="Obiect de inventar nou"
      descriere="Obiectul intră în evidență cu starea de circuit „În stoc”. Predarea către un angajat se face separat, din fișa obiectului."
      marime="lucru"
      deschisInitial={deschisInitial}
      actiune={trimite}
      mesajReusita="Obiectul a fost adăugat în evidență."
      etichetaTrimite="Adaugă obiectul"
      textInCurs="Se salvează…"
      faraReimprospatare
      laReusita={(obiect: Readonly<{ id: string }>) => {
        router.push(`/inventar/${obiect.id}`);
      }}
    >
      {(stare, idc) => <CampuriObiect stare={stare} idc={idc} categorii={categorii} />}
    </FormularDialog>
  );
}

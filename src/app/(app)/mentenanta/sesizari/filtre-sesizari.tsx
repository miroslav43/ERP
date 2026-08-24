// src/app/(app)/mentenanta/sesizari/filtre-sesizari.tsx
import type { ReactElement } from "react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { STATUSURI_SESIZARE, URGENTE_SESIZARE, type FiltreSesizari } from "@/schemas/maintenance";

import { ETICHETE_STATUS_SESIZARE, ETICHETE_URGENTA_SESIZARE } from "../etichete";

/**
 * Cheile administrate de bară — exact cele pe care le scria vechiul `aplica()`.
 *
 * Acela pornea din `new URLSearchParams()` gol și repopula doar `status` și
 * `urgenta`, deci fiecare apăsare pe „Filtrează” arunca `sort`, `limita` ȘI
 * `echipament`. Ultimul e cel mai costisitor: e cheia pe care o pune QR-ul de
 * pe utilaj, iar lista deschisă de pe telefon se lărgea, la prima filtrare, de
 * la sesizările unui echipament la toate ale organizației.
 */
const CHEI_EXTERNE = ["echipament"] as const;

const CHEI_PROPRII = ["status", "urgenta"] as const;

export type PropsFiltreSesizari = Readonly<{
  /** Filtrele DEJA validate de pagină, ca pastilele să nu arate valori inventate. */
  /** Codul echipamentului filtrat, când filtrul e pus din afara barei. */
  etichetaEchipament?: string;
  filtre: Pick<FiltreSesizari, "status" | "urgenta">;
}>;

/**
 * Server Component: fără `aplica()`, fără `useRouter`/`usePathname`/
 * `useSearchParams` și fără `useTransition` nu mai rămâne nici stare, nici
 * handler, deci nici motiv de `"use client"`.
 */
export function FiltreSesizariForm({
  filtre,
  etichetaEchipament,
}: PropsFiltreSesizari): ReactElement {
  const active: FiltruActiv[] = [];
  if (filtre.status !== null) {
    active.push({ cheie: "status", eticheta: `Stare: ${ETICHETE_STATUS_SESIZARE[filtre.status]}` });
  }
  if (filtre.urgenta !== null) {
    active.push({
      cheie: "urgenta",
      eticheta: `Urgență: ${ETICHETE_URGENTA_SESIZARE[filtre.urgenta]}`,
    });
  }

  /*
   * `echipament` NU e în `CHEI_PROPRII`: n-are câmp în bară, deci prima
   * trimitere l-ar fi șters singură (`FormData.get()` întoarce `null`). Intră
   * în `cheiExterne` — se șterge la „Șterge toate filtrele" și are pastilă
   * proprie, dar nu se citește din formular.
   */
  if (etichetaEchipament !== undefined) {
    active.push({ cheie: "echipament", eticheta: `Echipament: ${etichetaEchipament}` });
  }

  return (
    <BaraFiltre active={active} cheiProprii={CHEI_PROPRII} cheiExterne={CHEI_EXTERNE}>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-sesizari-status" className="text-corp font-medium">
          Stare
        </label>
        <select
          // `key` legat de valoarea din adresă: ștergerea unei pastile schimbă
          // adresa fără să atingă formularul, iar un control NECONTROLAT și-ar
          // păstra în DOM valoarea veche, deja scoasă din listă.
          key={filtre.status ?? ""}
          id="filtru-sesizari-status"
          name="status"
          defaultValue={filtre.status ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">Toate</option>
          {STATUSURI_SESIZARE.map((s) => (
            <option key={s} value={s}>
              {ETICHETE_STATUS_SESIZARE[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-sesizari-urgenta" className="text-corp font-medium">
          Urgență
        </label>
        <select
          key={filtre.urgenta ?? ""}
          id="filtru-sesizari-urgenta"
          name="urgenta"
          defaultValue={filtre.urgenta ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">Toate</option>
          {URGENTE_SESIZARE.map((u) => (
            <option key={u} value={u}>
              {ETICHETE_URGENTA_SESIZARE[u]}
            </option>
          ))}
        </select>
      </div>
    </BaraFiltre>
  );
}

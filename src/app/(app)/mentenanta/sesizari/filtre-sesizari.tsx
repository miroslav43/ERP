// src/app/(app)/mentenanta/sesizari/filtre-sesizari.tsx
import type { ReactElement } from "react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { clasaBifa } from "@/components/ui/camp";
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

const CHEI_PROPRII = ["status", "urgenta", "atribuit", "deschise"] as const;

export interface OptiuneTehnician {
  readonly id: string;
  readonly nume: string;
}

export type PropsFiltreSesizari = Readonly<{
  /** Filtrele DEJA validate de pagină, ca pastilele să nu arate valori inventate. */
  filtre: Pick<FiltreSesizari, "status" | "urgenta" | "atribuit" | "deschise">;
  /** Codul echipamentului filtrat, când filtrul e pus din afara barei. */
  etichetaEchipament?: string;
  /** Tehnicienii din selector; gol pentru cine nu poate gestiona (rămân „mie”/„nimeni”). */
  tehnicieni: readonly OptiuneTehnician[];
  /** Apelantul are fișă: altfel „Atribuite mie” n-are pe cine să caute. */
  areFisa: boolean;
}>;

/**
 * Server Component: fără `aplica()`, fără `useRouter`/`usePathname`/
 * `useSearchParams` și fără `useTransition` nu mai rămâne nici stare, nici
 * handler, deci nici motiv de `"use client"`.
 */
export function FiltreSesizariForm({
  filtre,
  etichetaEchipament,
  tehnicieni,
  areFisa,
}: PropsFiltreSesizari): ReactElement {
  const active: FiltruActiv[] = [];
  if (filtre.status !== null) {
    active.push({ cheie: "status", eticheta: `Stare: ${ETICHETE_STATUS_SESIZARE[filtre.status]}` });
  }
  if (filtre.deschise === "da" && filtre.status === null) {
    active.push({ cheie: "deschise", eticheta: "Doar deschise" });
  }
  if (filtre.urgenta !== null) {
    active.push({
      cheie: "urgenta",
      eticheta: `Urgență: ${ETICHETE_URGENTA_SESIZARE[filtre.urgenta]}`,
    });
  }
  if (filtre.atribuit !== null) {
    const eticheta =
      filtre.atribuit === "mie"
        ? "Atribuite mie"
        : filtre.atribuit === "nimeni"
          ? "Neatribuite"
          : `Tehnician: ${tehnicieni.find((t) => t.id === filtre.atribuit)?.nume ?? "ales"}`;
    active.push({ cheie: "atribuit", eticheta });
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

  const clasaSelect = "border-foreground/60 rounded-control text-corp border px-3 py-2";

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
          className={clasaSelect}
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
          className={clasaSelect}
        >
          <option value="">Toate</option>
          {URGENTE_SESIZARE.map((u) => (
            <option key={u} value={u}>
              {ETICHETE_URGENTA_SESIZARE[u]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-sesizari-atribuit" className="text-corp font-medium">
          Tehnician
        </label>
        <select
          key={filtre.atribuit ?? ""}
          id="filtru-sesizari-atribuit"
          name="atribuit"
          defaultValue={filtre.atribuit ?? ""}
          className={clasaSelect}
        >
          <option value="">Oricare</option>
          {areFisa ? <option value="mie">Atribuite mie</option> : null}
          <option value="nimeni">Neatribuite</option>
          {tehnicieni.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nume}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 self-end pb-2">
        <input
          key={filtre.deschise ?? ""}
          id="filtru-sesizari-deschise"
          name="deschise"
          type="checkbox"
          value="da"
          defaultChecked={filtre.deschise === "da"}
          className={clasaBifa}
        />
        <label htmlFor="filtru-sesizari-deschise" className="text-corp">
          Doar deschise
        </label>
      </div>
    </BaraFiltre>
  );
}

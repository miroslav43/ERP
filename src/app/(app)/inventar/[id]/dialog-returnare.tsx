"use client";

import { Undo2 } from "lucide-react";
import { useCallback, useState } from "react";
import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { STARI_OBIECT } from "@/schemas/inventory";
import type { StareObiect } from "@/schemas/inventory";

import { returneazaObiect } from "../actions";
import { ETICHETE_STARE } from "../etichete";

/**
 * Înregistrarea returnării.
 *
 * ── DE CE SELECTORUL E CONTROLAT ─────────────────────────────────────────
 * O returnare cu starea „Defect” NU duce obiectul în stoc, ci în „În reparație”
 * — regula e a triggerului rescris în `0019_fix_inventar.sql` (V1b), nu a
 * ecranului. Confirmarea trebuie deci să spună lucruri diferite după ce s-a
 * ales, iar `mesajReusita` e un text, nu o funcție de rezultat: acțiunea
 * întoarce `{ id, item_id }`, nu starea. Singura cale de a ști ce s-a ales în
 * momentul confirmării e să ținem valoarea, deci selectorul e controlat.
 * Tiparul e cel din `flota/[id]/dialog-vehicul.tsx`, unde starea deschide un
 * câmp în plus.
 *
 * ── DE CE NU ARE IMPLICIT ÎN SCHEMĂ ──────────────────────────────────────
 * `returneazaObiectSchema` cere `stare_la_returnare` fără `default`, singurul
 * enum din modul care n-are unul: e constatarea pentru care se semnează
 * procesul-verbal de returnare. Un implicit ar fi scris „Bun” în locul cuiva
 * care n-a apucat să se uite. Formularul PROPUNE „Bun”, schema nu-l presupune.
 */
interface Proprietati {
  readonly alocareId: string;
}

export function DialogReturnare({ alocareId }: Proprietati): ReactElement {
  const [stareLaReturnare, setStareLaReturnare] = useState<StareObiect>("bun");

  /*
   * Starea asta e SINGURA din casetă care nu se golește singură.
   *
   * `FormularDialog` remontează tot ce e înăuntru la fiecare deschidere, dar
   * `stareLaReturnare` trebuie citită din AFARĂ, pentru `mesajReusita`. Deci
   * trăiește în componenta care nu se demontează, iar o alegere abandonată —
   * „Defect", ales din greșeală și închis cu Escape — rămânea selectată data
   * următoare. Cine nu observa trimitea un obiect bun în „În reparație".
   */
  const laResetare = useCallback((): void => {
    setStareLaReturnare("bun");
  }, []);

  async function trimite(date: FormData) {
    return returneazaObiect({
      id: alocareId,
      stare_la_returnare: String(date.get("stare_la_returnare") ?? ""),
      observatii: String(date.get("observatii") ?? "").trim() || null,
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Înregistrează returnarea",
        varianta: "secundar",
        pictograma: <Undo2 aria-hidden="true" className="size-4" />,
      }}
      titlu="Înregistrează returnarea"
      descriere="Starea constatată acum închide predarea și decide unde merge obiectul mai departe."
      marime="mare"
      actiune={trimite}
      mesajReusita={
        stareLaReturnare === "defect"
          ? "Returnarea a fost înregistrată. Obiectul a trecut în „În reparație”."
          : "Returnarea a fost înregistrată. Obiectul revine în stoc."
      }
      etichetaTrimite="Înregistrează returnarea"
      textInCurs="Se înregistrează…"
      laResetare={laResetare}
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="stare_la_returnare"
            id={idc("stare_la_returnare")}
            eticheta="Stare la returnare"
            fel="select"
            obligatoriu
            ajutor={
              stareLaReturnare === "defect"
                ? "Obiectul va trece în „În reparație”, nu în stoc, și nu va putea fi predat până nu confirmă cineva că a revenit din service."
                : "Obiectul revine în stoc și poate fi predat mai departe."
            }
            erori={stare.erori["stare_la_returnare"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                value={stareLaReturnare}
                onChange={(e) => {
                  setStareLaReturnare(e.target.value as StareObiect);
                }}
              >
                {STARI_OBIECT.map((valoare) => (
                  <option key={valoare} value={valoare}>
                    {ETICHETE_STARE[valoare]}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          <Camp
            nume="observatii"
            id={idc("observatii")}
            eticheta="Observații"
            fel="textarea"
            ajutor="Lipsuri, defecțiuni constatate, accesorii nereturnate."
            className="sm:col-span-2"
            erori={stare.erori["observatii"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                rows={3}
                maxLength={2000}
                defaultValue={stare.valoriTrimise["observatii"] ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}

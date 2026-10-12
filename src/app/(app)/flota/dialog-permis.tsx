"use client";

import { IdCard, Pencil } from "lucide-react";
import type { ReactElement } from "react";

import { Camp, clasaBifa } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { CATEGORII_PERMIS } from "@/domain/fleet/soferi";
import type { RandPermis } from "@/lib/queries/soferi";

import { actualizeazaPermis, adaugaPermis } from "./actions-soferi";

/**
 * Permisul de conducere de pe fișa angajatului (0204, F9): înregistrare,
 * reînnoire sau corectură. Un singur permis activ pe om, deci reînnoirea e
 * chiar caseta asta, pe permisul existent; istoricul îl ține auditul.
 *
 * Numele din `FormData` sunt cheile lui `permisNouSchema`
 * (`src/schemas/soferi.ts`): `numar`, `categorii` (bife multiple, deci
 * `getAll`), `eliberat_la`, `expira_la`, `observatii`. Altfel `fieldErrors`
 * n-ar mai găsi câmpul, iar mesajul s-ar pierde.
 */
interface Proprietati {
  readonly employeeId: string;
  readonly numeAngajat: string;
  /** `null` = înregistrare; altfel reînnoirea sau corectura acestui permis. */
  readonly permis: RandPermis | null;
}

function valori(date: FormData) {
  const text = (cheie: string): string => String(date.get(cheie) ?? "").trim();
  return {
    numar: text("numar"),
    categorii: date.getAll("categorii").map((c) => String(c)),
    eliberat_la: text("eliberat_la"),
    expira_la: text("expira_la"),
    observatii: text("observatii"),
  };
}

export function DialogPermis({ employeeId, numeAngajat, permis }: Proprietati): ReactElement {
  async function trimite(date: FormData) {
    return permis === null
      ? adaugaPermis({ employee_id: employeeId, ...valori(date) })
      : actualizeazaPermis({ id: permis.id, employee_id: employeeId, ...valori(date) });
  }
  const categoriiInitiale = new Set(permis?.categorii ?? []);

  return (
    <FormularDialog
      declansator={
        permis === null
          ? {
              eticheta: "Înregistrează permisul",
              varianta: "secundar",
              pictograma: <IdCard aria-hidden="true" className="size-4" />,
            }
          : {
              eticheta: <Pencil aria-hidden="true" className="size-4" />,
              varianta: "tertiar",
              marime: "iconita",
              "aria-label": `Reînnoiește sau corectează permisul lui ${numeAngajat}`,
            }
      }
      titlu={permis === null ? "Permisul de conducere" : "Reînnoirea permisului"}
      descriere={
        permis === null
          ? `Permisul lui ${numeAngajat}. Scadența intră în lista de conformitate, iar foile și predările de vehicul avertizează când a expirat.`
          : "Reînnoirea se scrie pe același permis: numărul și data noi înlocuiesc valorile vechi, care rămân în istoricul modificărilor."
      }
      actiune={trimite}
      mesajReusita={
        permis === null ? "Permisul a fost înregistrat." : "Permisul a fost actualizat."
      }
      etichetaTrimite="Salvează"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="numar"
            id={idc("numar")}
            eticheta="Numărul permisului"
            obligatoriu
            erori={stare.erori["numar"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                maxLength={30}
                autoComplete="off"
                defaultValue={stare.valoriTrimise["numar"] ?? permis?.numar ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="eliberat_la"
            id={idc("eliberat_la")}
            eticheta="Eliberat la"
            erori={stare.erori["eliberat_la"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="date"
                defaultValue={stare.valoriTrimise["eliberat_la"] ?? permis?.eliberat_la ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="expira_la"
            id={idc("expira_la")}
            eticheta="Valabil până la"
            obligatoriu
            erori={stare.erori["expira_la"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="date"
                defaultValue={stare.valoriTrimise["expira_la"] ?? permis?.expira_la ?? ""}
              />
            )}
          </Camp>

          <fieldset
            className="sm:col-span-2"
            aria-describedby={
              (stare.erori["categorii"] ?? []).length > 0 ? idc("categorii-eroare") : undefined
            }
          >
            <legend className="text-foreground text-corp mb-1 font-medium">
              Categorii{" "}
              <span className="text-danger" aria-hidden="true">
                *
              </span>
              <span className="sr-only">(obligatoriu)</span>
            </legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {CATEGORII_PERMIS.map((k) => (
                <label key={k} className="text-corp flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="categorii"
                    value={k}
                    defaultChecked={categoriiInitiale.has(k)}
                    className={clasaBifa}
                  />
                  {k}
                </label>
              ))}
            </div>
            {(stare.erori["categorii"] ?? []).length > 0 ? (
              <p id={idc("categorii-eroare")} className="text-danger text-nota mt-1">
                {(stare.erori["categorii"] ?? []).join(" ")}
              </p>
            ) : null}
          </fieldset>

          <Camp
            nume="observatii"
            id={idc("observatii")}
            eticheta="Observații"
            fel="textarea"
            ajutor="Restricții trecute pe permis (de exemplu cod 01, ochelari), emitentul."
            className="sm:col-span-2"
            erori={stare.erori["observatii"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                maxLength={1000}
                rows={2}
                defaultValue={stare.valoriTrimise["observatii"] ?? permis?.observatii ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}

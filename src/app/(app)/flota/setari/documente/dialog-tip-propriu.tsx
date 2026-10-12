"use client";

// src/app/(app)/flota/setari/documente/dialog-tip-propriu.tsx

import { Pencil, Plus } from "lucide-react";
import type { ReactElement } from "react";

import { Camp, clasaBifa } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import type { TipDocument } from "@/lib/queries/fleet";
import { CATEGORII_VEHICUL } from "@/schemas/fleet";

import { ETICHETE_CATEGORIE } from "../../etichete";
import { actualizeazaTipDocument, creeazaTipDocument } from "../../actions-tipuri";
import { valoriTip } from "./valori-tip";

interface Proprietati {
  /** Tipul propriu care se modifică. Absent = tip nou. */
  readonly tip?: TipDocument | undefined;
}

/**
 * Tipul de document PROPRIU firmei (0202): o autorizație locală, un permis de
 * acces în port, orice document pe care nomenclatorul comun nu-l are. Codul nu
 * se scrie: îl calculează acțiunea din denumire și nu se mai schimbă (e cheia
 * scadențelor deja scrise). Un tip nu se șterge, se retrage — documentele lui
 * rămân pe fișele vehiculelor.
 */
export function DialogTipPropriu({ tip }: Proprietati): ReactElement {
  const nou = tip === undefined;

  async function trimite(date: FormData) {
    const valori = valoriTip(date);
    return tip === undefined
      ? creeazaTipDocument(valori)
      : actualizeazaTipDocument({ ...valori, id: tip.id, activ: date.get("activ") === "on" });
  }

  return (
    <FormularDialog
      declansator={
        nou
          ? {
              eticheta: "Tip nou",
              varianta: "secundar",
              pictograma: <Plus aria-hidden="true" className="size-4" />,
            }
          : {
              eticheta: <Pencil aria-hidden="true" className="size-4" />,
              varianta: "tertiar",
              marime: "iconita",
              "aria-label": `Modifică tipul „${tip.denumire}”`,
            }
      }
      titlu={nou ? "Tip de document nou" : `Modifică „${tip.denumire}”`}
      descriere="Tipul apare pe fișa fiecărui vehicul căruia i se aplică. Obligatoriu înseamnă că lipsa lui aprinde semaforul în roșu."
      marime="mare"
      actiune={trimite}
      mesajReusita={nou ? "Tipul de document a fost creat." : "Tipul de document a fost salvat."}
      etichetaTrimite={nou ? "Creează tipul" : "Salvează tipul"}
      textInCurs="Se salvează…"
    >
      {(stare, idc) => {
        const trimis = stare.valoriTrimise;
        const dupaTrimitere = Object.keys(trimis).length > 0;
        const categorii = new Set(tip?.categorii_aplicabile ?? []);
        return (
          <div className="space-y-4">
            <Camp
              nume="denumire"
              id={idc("denumire")}
              eticheta="Denumire"
              obligatoriu
              erori={stare.erori["denumire"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={120}
                  defaultValue={trimis["denumire"] ?? tip?.denumire ?? ""}
                />
              )}
            </Camp>
            <Camp
              nume="descriere"
              id={idc("descriere")}
              eticheta="Descriere"
              ajutor="Opțional: cine îl eliberează, la ce folosește."
              erori={stare.erori["descriere"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={500}
                  defaultValue={trimis["descriere"] ?? tip?.descriere ?? ""}
                />
              )}
            </Camp>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(
                [
                  ["cere_expirare", "Are dată de expirare", tip?.cere_expirare ?? true],
                  ["obligatoriu", "Obligatoriu", tip?.obligatoriu ?? false],
                  ...(nou ? [] : [["activ", "Folosit de firmă", tip.activ] as const]),
                ] as const
              ).map(([nume, eticheta, implicit]) => (
                <span key={nume} className="inline-flex items-center gap-2">
                  <input
                    id={idc(nume)}
                    name={nume}
                    type="checkbox"
                    className={clasaBifa}
                    defaultChecked={dupaTrimitere ? trimis[nume] === "on" : implicit}
                  />
                  <label htmlFor={idc(nume)} className="text-corp">
                    {eticheta}
                  </label>
                </span>
              ))}
            </div>

            <fieldset className="border-border rounded-panou space-y-2 border p-3">
              <legend className="text-corp px-1 font-medium">Se cere pentru</legend>
              <p className="text-muted-foreground text-nota">
                Fără nicio bifă, tipul se cere oricărui vehicul.
              </p>
              <ul className="grid gap-2 sm:grid-cols-3">
                {CATEGORII_VEHICUL.map((c) => (
                  <li key={c} className="flex items-center gap-2">
                    <input
                      id={idc(`categorie-${c}`)}
                      name="categorii_aplicabile"
                      type="checkbox"
                      value={c}
                      className={clasaBifa}
                      defaultChecked={categorii.has(c)}
                    />
                    <label htmlFor={idc(`categorie-${c}`)} className="text-corp">
                      {ETICHETE_CATEGORIE[c]}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>

            <Camp
              nume="masa_max_kg"
              id={idc("masa_max_kg")}
              eticheta="Doar până la masa maximă (kg)"
              ajutor="Opțional. De exemplu 3500: peste masa asta tipul nu se mai cere. Un vehicul fără masă completată îl primește."
              erori={stare.erori["masa_max_kg"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  inputMode="numeric"
                  defaultValue={
                    trimis["masa_max_kg"] ??
                    (tip?.masa_max_kg === null || tip?.masa_max_kg === undefined
                      ? ""
                      : String(tip.masa_max_kg))
                  }
                />
              )}
            </Camp>
          </div>
        );
      }}
    </FormularDialog>
  );
}

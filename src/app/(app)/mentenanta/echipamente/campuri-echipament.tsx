"use client";

import { useState, type ReactElement } from "react";

import { Camp, clasaBifa } from "@/components/ui/camp";
import type { StareFormular } from "@/components/ui/formular";
import { STATUS_ECHIPAMENT } from "@/schemas/maintenance";

import { ETICHETE_STATUS_ECHIPAMENT } from "../etichete";

export interface OptiuneEchipament {
  readonly id: string;
  readonly nume: string;
}

/** Valorile cu care pornește formularul — fișa existentă la editare, un model la „Adaugă unul la fel”. */
export interface ValoriInitialeEchipament {
  readonly cod: string;
  readonly denumire: string;
  readonly serie: string | null;
  readonly producator: string | null;
  readonly model: string | null;
  readonly an_fabricatie: number | null;
  readonly locatie: string | null;
  readonly department_id: string | null;
  readonly responsabil_employee_id: string | null;
  readonly status: string;
  readonly este_iscir: boolean;
  readonly tip_autorizare_necesara: string | null;
  readonly valoare_achizitie: number | null;
  readonly data_punerii_in_functiune: string | null;
  readonly derogare_motiv: string | null;
}

export interface ProprietatiCampuriEchipament<TData> {
  readonly stare: StareFormular<TData>;
  readonly idc: (sufix: string) => string;
  readonly angajati: readonly OptiuneEchipament[];
  readonly departamente: readonly OptiuneEchipament[];
  /** Modulul SSM e activ: autorizațiile nominale se pot verifica, nu doar deroga. */
  readonly ssmActiv: boolean;
  /** `can(permisiuni, "maintenance:update", "all")` — deschide câmpul de derogare. */
  readonly poateDerogare: boolean;
  readonly echipament?: ValoriInitialeEchipament | undefined;
}

/** `?? ""` singur ar transforma un `0` legitim în câmp gol. */
function cifra(valoare: number | null | undefined): string {
  return valoare === null || valoare === undefined ? "" : String(valoare);
}

/**
 * Câmpurile unui echipament, scrise o singură dată pentru creare și editare.
 *
 * ── CE ÎNLOCUIEȘTE ───────────────────────────────────────────────────────────
 * `formular-echipament.tsx`, unul dintre cele patru formulare pe react-hook-form
 * din depozit, cu propriul `<form onSubmit>` și propriul buton — motivul pentru
 * care fișa îl deschidea într-un `Dialog` gol, nu în `FormularDialog`, și pentru
 * care „Echipament nou" era încă o pagină întreagă. Pe `Camp` + `FormData`,
 * aceleași câmpuri intră în ambele casete, iar erorile serverului ajung pe
 * câmpul lor prin `stare.erori`, fără cod de împăcare între două biblioteci.
 *
 * ── BIFA ISCIR E CONTROLATĂ ──────────────────────────────────────────────────
 * Singura stare proprie: bifa decide ce câmpuri se randează dedesubt. Pornește
 * din ce s-a trimis ultima dată (după un refuz) sau din fișă, și e singurul
 * control controlat al formularului — restul rămân `defaultValue`, ca
 * `valoriTrimise` să le poată repune după un refuz.
 *
 * O bifă nebifată LIPSEȘTE din `FormData`; de aceea „s-a trimis ceva" se
 * deduce din restul cheilor, nu din `trimise["este_iscir"]`.
 */
export function CampuriEchipament<TData>({
  stare,
  idc,
  angajati,
  departamente,
  ssmActiv,
  poateDerogare,
  echipament,
}: ProprietatiCampuriEchipament<TData>): ReactElement {
  // Formularul rămâne montat după un refuz, deci repornește de la ce s-a
  // trimis; după reușită caseta se demontează, iar `trimise` nu mai contează.
  const trimise: Readonly<Record<string, string>> = stare.data === null ? stare.valoriTrimise : {};
  const sATrimis = Object.keys(trimise).length > 0;
  const [esteIscir, setEsteIscir] = useState<boolean>(
    sATrimis ? trimise["este_iscir"] === "on" : (echipament?.este_iscir ?? false),
  );

  const text = (cheie: keyof ValoriInitialeEchipament): string => {
    const dinTrimise = trimise[cheie];
    if (dinTrimise !== undefined) return dinTrimise;
    const valoare = echipament?.[cheie];
    if (valoare === undefined || valoare === null) return "";
    return typeof valoare === "boolean" ? (valoare ? "on" : "") : String(valoare);
  };

  const selectorResponsabil = (sufixId: string): ReactElement => (
    <Camp
      nume="responsabil_employee_id"
      id={idc(sufixId)}
      eticheta="Responsabil"
      fel="select"
      erori={stare.erori["responsabil_employee_id"] ?? []}
    >
      {(a) => (
        <select {...a} defaultValue={text("responsabil_employee_id")}>
          <option value="">Fără responsabil</option>
          {angajati.map((ang) => (
            <option key={ang.id} value={ang.id}>
              {ang.nume}
            </option>
          ))}
        </select>
      )}
    </Camp>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Camp
          nume="cod"
          id={idc("cod")}
          eticheta="Cod"
          obligatoriu
          ajutor="Unic în organizație; se tipărește pe eticheta QR."
          erori={stare.erori["cod"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="text"
              autoComplete="off"
              maxLength={60}
              defaultValue={text("cod")}
            />
          )}
        </Camp>

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
              autoComplete="off"
              maxLength={200}
              defaultValue={text("denumire")}
            />
          )}
        </Camp>

        <Camp nume="serie" id={idc("serie")} eticheta="Serie" erori={stare.erori["serie"] ?? []}>
          {(a) => <input {...a} type="text" maxLength={120} defaultValue={text("serie")} />}
        </Camp>

        <Camp
          nume="producator"
          id={idc("producator")}
          eticheta="Producător"
          erori={stare.erori["producator"] ?? []}
        >
          {(a) => <input {...a} type="text" maxLength={120} defaultValue={text("producator")} />}
        </Camp>

        <Camp nume="model" id={idc("model")} eticheta="Model" erori={stare.erori["model"] ?? []}>
          {(a) => <input {...a} type="text" maxLength={120} defaultValue={text("model")} />}
        </Camp>

        <Camp
          nume="an_fabricatie"
          id={idc("an-fabricatie")}
          eticheta="An fabricație"
          erori={stare.erori["an_fabricatie"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="number"
              min="1900"
              max="2200"
              defaultValue={trimise["an_fabricatie"] ?? cifra(echipament?.an_fabricatie)}
            />
          )}
        </Camp>

        <Camp
          nume="locatie"
          id={idc("locatie")}
          eticheta="Locație"
          erori={stare.erori["locatie"] ?? []}
        >
          {(a) => <input {...a} type="text" maxLength={200} defaultValue={text("locatie")} />}
        </Camp>

        <Camp
          nume="department_id"
          id={idc("departament")}
          eticheta="Departament"
          fel="select"
          erori={stare.erori["department_id"] ?? []}
        >
          {(a) => (
            <select {...a} defaultValue={text("department_id")}>
              <option value="">Fără departament</option>
              {departamente.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nume}
                </option>
              ))}
            </select>
          )}
        </Camp>

        <Camp
          nume="status"
          id={idc("status")}
          eticheta="Stare"
          fel="select"
          erori={stare.erori["status"] ?? []}
        >
          {(a) => (
            <select {...a} defaultValue={trimise["status"] ?? echipament?.status ?? "in_functiune"}>
              {STATUS_ECHIPAMENT.map((s) => (
                <option key={s} value={s}>
                  {ETICHETE_STATUS_ECHIPAMENT[s]}
                </option>
              ))}
            </select>
          )}
        </Camp>

        <Camp
          nume="data_punerii_in_functiune"
          id={idc("data-punerii")}
          eticheta="Data punerii în funcțiune"
          erori={stare.erori["data_punerii_in_functiune"] ?? []}
        >
          {(a) => <input {...a} type="date" defaultValue={text("data_punerii_in_functiune")} />}
        </Camp>

        <Camp
          nume="valoare_achizitie"
          id={idc("valoare")}
          eticheta="Valoare achiziție (lei)"
          erori={stare.erori["valoare_achizitie"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="number"
              step="0.01"
              min="0"
              defaultValue={trimise["valoare_achizitie"] ?? cifra(echipament?.valoare_achizitie)}
            />
          )}
        </Camp>
      </div>

      <div className="border-border rounded-panou border p-4">
        {/* Bifa rămâne scrisă de mână: `Camp` pune eticheta ÎNAINTEA controlului,
            iar la o casetă de bifat eticheta stă după — altfel ținta de atingere
            se rupe în două și rândul se citește invers. */}
        <div className="flex items-center gap-2">
          <input
            id={idc("este-iscir")}
            name="este_iscir"
            type="checkbox"
            className={clasaBifa}
            checked={esteIscir}
            onChange={(e) => {
              setEsteIscir(e.target.checked);
            }}
          />
          <label htmlFor={idc("este-iscir")} className="text-corp font-medium">
            Echipament sub incidența ISCIR
          </label>
        </div>

        {esteIscir ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Camp
              nume="tip_autorizare_necesara"
              id={idc("tip-autorizare")}
              eticheta="Tipul de autorizație nominală necesară"
              erori={stare.erori["tip_autorizare_necesara"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={80}
                  placeholder="Ex. stivuitorist, macaragiu"
                  defaultValue={text("tip_autorizare_necesara")}
                />
              )}
            </Camp>

            {selectorResponsabil("responsabil-iscir")}

            <p className="text-foreground text-nota sm:col-span-2">
              {ssmActiv
                ? "Responsabilul trebuie să aibă o autorizație nominală valabilă pe acest tip, altfel baza respinge salvarea — verificați-o în modulul SSM."
                : "Autorizațiile nominale se administrează în modulul SSM; fără el, un responsabil pe echipament ISCIR se poate desemna doar prin derogare motivată."}
            </p>

            {poateDerogare ? (
              <Camp
                nume="derogare_motiv"
                id={idc("derogare")}
                eticheta="Motivul derogării"
                fel="textarea"
                ajutor="Minimum 20 de caractere. Se completează doar dacă responsabilul nu are (încă) o autorizație nominală valabilă."
                className="sm:col-span-2"
                erori={stare.erori["derogare_motiv"] ?? []}
              >
                {(a) => (
                  <textarea {...a} rows={2} maxLength={500} defaultValue={text("derogare_motiv")} />
                )}
              </Camp>
            ) : null}
          </div>
        ) : (
          <div className="mt-4">{selectorResponsabil("responsabil")}</div>
        )}
      </div>
    </div>
  );
}

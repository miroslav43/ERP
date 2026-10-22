// src/app/(app)/flota/rapoarte/export-contabil.tsx
"use client";

import { FileSpreadsheet } from "lucide-react";
import { useId, useState, type ReactElement, type ReactNode } from "react";

import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Dialog } from "@/components/ui/dialog";
import {
  CONFIGURARE_IMPLICITA,
  CONTURI_DECONTARE_PROPUSE,
} from "@/domain/fleet/contabil/configurare";
import type { FormatExport } from "@/domain/fleet/contabil/formate";
import { CATEGORII_CONTABILE, ETICHETE_CATEGORIE_CONTABILA } from "@/domain/fleet/contabil/linii";
import { etichetaLuna, lunaMutata } from "@/domain/fleet/rapoarte";
import { CAMPURI_EXPORT_CONTABIL, schemaExportLa } from "@/schemas/fleet-contabil";

/**
 * Exportul costurilor lunii pentru programul de contabilitate (F12g).
 *
 * Descărcarea e o NAVIGARE (`<form method="get">` spre ruta de export), nu o
 * Server Action: nu e nevoie de `useTransition`. Erorile rutei (400, 403, 404,
 * 409) apar ca text simplu, ca la nota de salarii.
 *
 * Bifele da/nu sunt perechi de radio, una mereu aleasă: un checkbox nebifat
 * LIPSEȘTE din cerere, iar ruta ar fi citit absența ca „da”.
 *
 * Conturile se țin minte în browser, per firmă (decizia D1, implicita I-g1):
 * doar o comoditate. Citirea și scrierea sunt în `try/catch` (fereastră privată,
 * stocare blocată), iar o valoare care nu trece schema se ignoră.
 */
const CHEIE_MEMORIE = "administrativo:flota:export-contabil:";

type Valori = Readonly<Record<string, string>>;

const IMPLICITE: Valori = {
  doar_aprobate: CONFIGURARE_IMPLICITA.doarAprobate ? "da" : "nu",
  include_service: CONFIGURARE_IMPLICITA.includeService ? "da" : "nu",
  ...Object.fromEntries(
    CATEGORII_CONTABILE.map((c) => [`cont_${c}`, CONFIGURARE_IMPLICITA.conturi[c]]),
  ),
  cont_decontare: CONFIGURARE_IMPLICITA.contDecontare,
  cont_tva_deductibil: CONFIGURARE_IMPLICITA.contTvaDeductibil,
  tva_nedeductibila: CONFIGURARE_IMPLICITA.tvaNedeductibila,
  cont_tva_nedeductibila: CONFIGURARE_IMPLICITA.contTvaNedeductibila,
  regim_implicit: CONFIGURARE_IMPLICITA.regimImplicit,
  wm_partener_dupa_cui: "da",
  csv_separator: "punct_si_virgula",
  csv_zecimale: "virgula",
  format: "saga",
};

const FORMATE: readonly Readonly<{ cod: FormatExport; titlu: string; descriere: string }>[] = [
  {
    cod: "saga",
    titlu: "Saga C",
    descriere: "Versiunea desktop: intrări XML, plăți și articole DBF.",
  },
  { cod: "winmentor", titlu: "WinMentor", descriere: "Notă contabilă, cu partenerii noi." },
  {
    cod: "articole_csv",
    titlu: "Orice program — articole",
    descriere: "CSV cu articole contabile simple.",
  },
  {
    cod: "jurnal_csv",
    titlu: "Jurnal de verificat",
    descriere: "Fiecare cost, cu ce intră în notă și de ce.",
  },
];

/** Valorile ținute minte, validate cu schema rutei; orice altceva se ignoră. */
export function citesteMemoria(organizationId: string, azi: string, luna: string): Valori | null {
  try {
    const brut = window.localStorage.getItem(CHEIE_MEMORIE + organizationId);
    if (brut === null) return null;
    const salvat: unknown = JSON.parse(brut);
    if (typeof salvat !== "object" || salvat === null) return null;
    const parsat = schemaExportLa(azi).safeParse({ ...salvat, luna });
    if (!parsat.success) return null;
    return Object.fromEntries(
      CAMPURI_EXPORT_CONTABIL.filter((c) => c !== "luna").map((c) => [c, String(parsat.data[c])]),
    );
  } catch {
    return null;
  }
}

function scrieMemoria(organizationId: string, formular: HTMLFormElement): void {
  try {
    const date = new FormData(formular);
    const valori: Record<string, string> = {};
    for (const camp of CAMPURI_EXPORT_CONTABIL) {
      const v = date.get(camp);
      if (camp !== "luna" && typeof v === "string") valori[camp] = v;
    }
    window.localStorage.setItem(CHEIE_MEMORIE + organizationId, JSON.stringify(valori));
  } catch {
    // Memoria e o comoditate: fără ea, formularul pornește de la implicite.
  }
}

function DaNu({
  nume,
  eticheta,
  valoare,
  ajutor,
}: Readonly<{
  nume: string;
  eticheta: string;
  valoare: string;
  ajutor?: ReactNode;
}>): ReactElement {
  const id = useId();
  return (
    <fieldset className="space-y-1">
      <legend className="text-foreground text-corp font-medium">{eticheta}</legend>
      <div className="flex gap-4">
        {(["da", "nu"] as const).map((v) => (
          <label key={v} htmlFor={`${id}-${v}`} className="text-corp flex items-center gap-2">
            <input
              id={`${id}-${v}`}
              type="radio"
              name={nume}
              value={v}
              defaultChecked={valoare === v}
              className={clasaBifa}
            />
            {v === "da" ? "Da" : "Nu"}
          </label>
        ))}
      </div>
      {ajutor === undefined ? null : <p className="text-muted-foreground text-nota">{ajutor}</p>}
    </fieldset>
  );
}

export function ExportContabil({
  organizationId,
  azi,
  lunaImplicita,
}: Readonly<{
  organizationId: string;
  /** Ziua de azi din România, `AAAA-LL-ZZ`: limita lunilor din listă. */
  azi: string;
  lunaImplicita: string;
}>): ReactElement {
  const id = useId();
  const idFormular = `${id}-formular`;
  const idc = (sufix: string) => `${id}-${sufix}`;
  const [deschis, setDeschis] = useState(false);
  const [valori, setValori] = useState<Valori>(IMPLICITE);
  const [format, setFormat] = useState<string>(IMPLICITE["format"] ?? "saga");
  // Remontează câmpurile necontrolate după ce memoria a schimbat valorile implicite.
  const [cheie, setCheie] = useState(0);

  const lunaCurenta = azi.slice(0, 7);
  const luni = Array.from({ length: 24 }, (_, i) => lunaMutata(lunaCurenta, -i));
  // O lună mai veche, aleasă pe pagină, rămâne alegerea implicită.
  if (lunaImplicita < lunaCurenta && !luni.includes(lunaImplicita)) luni.push(lunaImplicita);
  const v = (camp: string) => valori[camp] ?? "";

  const deschide = () => {
    const memorie = citesteMemoria(organizationId, azi, lunaImplicita);
    if (memorie !== null) {
      setValori({ ...IMPLICITE, ...memorie });
      setFormat(memorie["format"] ?? format);
      setCheie((k) => k + 1);
    }
    setDeschis(true);
  };

  const arhiva = format === "saga" || format === "winmentor";

  return (
    <>
      <Buton varianta="secundar" onClick={deschide}>
        <FileSpreadsheet aria-hidden="true" className="size-4" />
        Export pentru contabilitate
      </Buton>

      <Dialog
        deschis={deschis}
        laInchidere={() => setDeschis(false)}
        titlu="Export pentru contabilitate"
        descriere="Costurile flotei din luna aleasă, într-un fișier pe care contabilul îl importă în programul lui."
        marime="mare"
        subsol={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-nota">
              Fișierul e o propunere. Verificați conturile la primul import.
              {arhiva ? " Dezarhivați fișierul înainte de import." : null}
            </p>
            <div className="flex gap-2">
              <Buton varianta="tertiar" onClick={() => setDeschis(false)}>
                Închide
              </Buton>
              <Buton varianta="primar" type="submit" form={idFormular}>
                Descarcă
              </Buton>
            </div>
          </div>
        }
      >
        <form
          key={cheie}
          id={idFormular}
          method="get"
          action="/api/export/flota/contabil"
          className="space-y-5"
          onSubmit={(e) => scrieMemoria(organizationId, e.currentTarget)}
        >
          <Camp nume="luna" id={idc("luna")} eticheta="Luna" fel="select" obligatoriu>
            {(a) => (
              <select {...a} defaultValue={lunaImplicita}>
                {luni.map((l) => (
                  <option key={l} value={l}>
                    {etichetaLuna(l)}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          <fieldset className="space-y-2">
            <legend className="text-foreground text-corp mb-1 font-medium">Formatul</legend>
            {FORMATE.map((f) => (
              <label
                key={f.cod}
                htmlFor={idc(`format-${f.cod}`)}
                className="border-border flex items-start gap-3 rounded-md border p-3"
              >
                <input
                  id={idc(`format-${f.cod}`)}
                  type="radio"
                  name="format"
                  value={f.cod}
                  checked={format === f.cod}
                  onChange={() => setFormat(f.cod)}
                  className={`${clasaBifa} mt-0.5`}
                />
                <span>
                  <span className="text-foreground text-corp block font-medium">{f.titlu}</span>
                  <span className="text-muted-foreground text-nota block">{f.descriere}</span>
                </span>
              </label>
            ))}
            {arhiva ? (
              <p className="text-muted-foreground text-nota">
                Structura e verificată pe documentația producătorului, dar nu a fost încercată încă
                într-un import real. Faceți primul import într-o bază de test.
              </p>
            ) : null}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <DaNu
              nume="doar_aprobate"
              eticheta="Doar foile de parcurs aprobate"
              valoare={v("doar_aprobate")}
              ajutor="Alimentările de pe foile neaprobate rămân în jurnal, cu motivul."
            />
            <DaNu
              nume="include_service"
              eticheta="Facturile de service în note"
              valoare={v("include_service")}
              ajutor="Facturile de service vin prin SPV, iar programul de contabilitate le poate importa singur: puse și aici, cheltuiala apare de două ori."
            />
            {format === "winmentor" ? (
              <DaNu
                nume="wm_partener_dupa_cui"
                eticheta="Identific partenerii după codul fiscal"
                valoare={v("wm_partener_dupa_cui")}
                ajutor="Setați la fel în WinMentor, la Constante generale → Import date din alte aplicații."
              />
            ) : null}
          </div>

          {format === "jurnal_csv" || format === "articole_csv" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Camp
                nume="csv_separator"
                id={idc("sep")}
                eticheta="Separatorul de coloane"
                fel="select"
              >
                {(a) => (
                  <select {...a} defaultValue={v("csv_separator")}>
                    <option value="punct_si_virgula">Punct și virgulă (;)</option>
                    <option value="virgula">Virgulă (,)</option>
                  </select>
                )}
              </Camp>
              <Camp nume="csv_zecimale" id={idc("zec")} eticheta="Zecimalele" fel="select">
                {(a) => (
                  <select {...a} defaultValue={v("csv_zecimale")}>
                    <option value="virgula">Cu virgulă (12,50)</option>
                    <option value="punct">Cu punct (12.50)</option>
                  </select>
                )}
              </Camp>
            </div>
          ) : null}

          <details className="border-border rounded-md border p-3">
            <summary className="text-foreground text-corp cursor-pointer font-medium">
              Conturi (de confirmat cu contabilul)
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {CATEGORII_CONTABILE.map((c) => (
                <Camp
                  key={c}
                  nume={`cont_${c}`}
                  id={idc(`cont-${c}`)}
                  eticheta={ETICHETE_CATEGORIE_CONTABILA[c]}
                  obligatoriu
                >
                  {(a) => (
                    <input {...a} defaultValue={v(`cont_${c}`)} inputMode="text" maxLength={20} />
                  )}
                </Camp>
              ))}
              <Camp
                nume="cont_decontare"
                id={idc("decontare")}
                eticheta="Contul de decontare (credit)"
                ajutor={CONTURI_DECONTARE_PROPUSE.map((p) => p.eticheta).join(" · ")}
                obligatoriu
              >
                {(a) => (
                  <>
                    <input
                      {...a}
                      defaultValue={v("cont_decontare")}
                      list={idc("decontare-lista")}
                      maxLength={20}
                    />
                    <datalist id={idc("decontare-lista")}>
                      {CONTURI_DECONTARE_PROPUSE.map((p) => (
                        <option key={p.cont} value={p.cont}>
                          {p.eticheta}
                        </option>
                      ))}
                    </datalist>
                  </>
                )}
              </Camp>
              <Camp
                nume="cont_tva_deductibil"
                id={idc("tva")}
                eticheta="TVA deductibil"
                obligatoriu
              >
                {(a) => <input {...a} defaultValue={v("cont_tva_deductibil")} maxLength={20} />}
              </Camp>
              <Camp
                nume="tva_nedeductibila"
                id={idc("neded")}
                eticheta="TVA-ul nedeductibil"
                fel="select"
              >
                {(a) => (
                  <select {...a} defaultValue={v("tva_nedeductibila")}>
                    <option value="pe_cheltuiala">Pe contul cheltuielii</option>
                    <option value="cont_separat">Pe un cont separat</option>
                  </select>
                )}
              </Camp>
              <Camp
                nume="cont_tva_nedeductibila"
                id={idc("cont-neded")}
                eticheta="Contul separat pentru TVA-ul nedeductibil"
                obligatoriu
              >
                {(a) => <input {...a} defaultValue={v("cont_tva_nedeductibila")} maxLength={20} />}
              </Camp>
              <Camp
                nume="regim_implicit"
                id={idc("regim")}
                eticheta="Vehiculul fără regim fiscal declarat"
                fel="select"
                ajutor="Peste 3.500 kg, deducerea e integrală oricum (Codul fiscal, art. 298 alin. 2)."
              >
                {(a) => (
                  <select {...a} defaultValue={v("regim_implicit")}>
                    <option value="limitat_50">Deducere limitată la 50%</option>
                    <option value="integral">Deducere integrală</option>
                  </select>
                )}
              </Camp>
            </div>
          </details>
        </form>
      </Dialog>
    </>
  );
}

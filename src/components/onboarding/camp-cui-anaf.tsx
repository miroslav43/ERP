// src/components/onboarding/camp-cui-anaf.tsx
"use client";

import { useState, useTransition } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import type { PrecompletareAnaf } from "@/domain/organization/anaf";
import { validateazaCui } from "@/domain/organization/cui";
import type { OnboardeazaOrganizatieInput } from "@/schemas/organization";

import { Camp } from "@/components/ui/camp";
import { cn } from "@/lib/ui/cn";

import { mesajeEroare } from "./campuri-comune";

/**
 * Câmpul CUI, cu precompletarea restului Pasului 1 din registrul public ANAF.
 *
 * Stă într-o componentă proprie, nu în `pas-1-identitate.tsx`: acolo ar fi
 * adăugat stare, `useTransition` și un `fetch` într-un fișier care are deja
 * peste 300 de linii și e randat de AMBELE asistente de înrolare.
 */

/** Ce câmpuri poate atinge precompletarea, în ordinea în care le scrie. */
type CampAnaf = keyof PrecompletareAnaf & keyof OnboardeazaOrganizatieInput;

/**
 * `judet` se scrie ÎNAINTEA lui `sector`: pasul afișează selectorul de sector
 * doar când județul e „București", iar `setValue` pe un câmp încă nerandat ar
 * fi pierdut la următoarea randare.
 */
const ORDINEA_SCRIERII: readonly CampAnaf[] = [
  "name",
  "legal_name",
  "forma_juridica",
  "platitor_tva",
  "reg_com",
  "telefon_contact",
  "judet",
  "sector",
  "oras",
  "adresa",
  "cod_postal",
  "cod_caen",
];

/**
 * Selectoarele care pornesc cu o valoare implicită („SRL", „București"), nu
 * goale. Un implicit pe care utilizatorul nu l-a atins NU e o alegere a lui,
 * deci registrul are voie peste el — altfel forma juridică și județul n-ar fi
 * precompletate NICIODATĂ, fiind mereu „nevide".
 *
 * Distincția se face pe `dirtyFields`, nu pe valoare: doar el separă „implicit
 * livrat de formular" de „exact aceeași valoare, aleasă de om".
 */
const IMPLICITE_DE_FORMULAR: ReadonlySet<string> = new Set(["forma_juridica", "judet"]);

const ETICHETE: Readonly<Record<CampAnaf, string>> = {
  name: "denumirea",
  legal_name: "denumirea din statut",
  forma_juridica: "forma juridică",
  platitor_tva: "starea de plătitor de TVA",
  reg_com: "nr. Registrul Comerțului",
  telefon_contact: "telefonul",
  judet: "județul",
  sector: "sectorul",
  oras: "localitatea",
  adresa: "adresa sediului social",
  cod_postal: "codul poștal",
  cod_caen: "codul CAEN",
};

type Stare =
  | Readonly<{ fel: "repaus" }>
  | Readonly<{ fel: "succes"; denumire: string; completate: readonly CampAnaf[] }>
  | Readonly<{ fel: "eroare"; mesaj: string }>;

type RaspunsRuta = Readonly<{
  ok?: boolean;
  mesaj?: string;
  denumire?: string;
  valori?: PrecompletareAnaf;
  avertismente?: readonly string[];
}>;

interface Proprietati {
  readonly formular: UseFormReturn<OnboardeazaOrganizatieInput>;
  readonly idFormular: string;
}

export function CampCuiAnaf({ formular, idFormular }: Proprietati) {
  const {
    register,
    control,
    getValues,
    setValue,
    formState: { errors, dirtyFields },
  } = formular;

  // `useWatch`, nu `formular.watch`: cu React Compiler activ pașii sunt
  // memoizați, iar `watch` abonează doar componenta care a chemat `useForm`.
  const cuiCurent = useWatch({ control, name: "cui" }) ?? "";
  const [stare, setStare] = useState<Stare>({ fel: "repaus" });
  const [avertismente, setAvertismente] = useState<readonly string[]>([]);
  const [inCurs, porneste] = useTransition();

  const cuiValid = validateazaCui(cuiCurent).valid;

  /**
   * Regula de suprascriere: se completează doar ce e gol. Contează în
   * `/bun-venit`, unde super-adminul a pus deja denumirea și e-mailul, iar
   * administratorul nu vrea să i se schimbe sub mână.
   */
  const poateScrie = (camp: CampAnaf): boolean => {
    const curenta: unknown = getValues(camp);
    if (curenta === undefined || curenta === null || curenta === "" || curenta === false) {
      return true;
    }
    return IMPLICITE_DE_FORMULAR.has(camp) && dirtyFields[camp] !== true;
  };

  const aplica = (valori: PrecompletareAnaf): readonly CampAnaf[] => {
    const completate: CampAnaf[] = [];
    for (const camp of ORDINEA_SCRIERII) {
      const valoare = valori[camp];
      if (valoare === undefined || !poateScrie(camp)) continue;
      // Îngustarea la tipul câmpului nu se poate exprima generic peste o
      // uniune de chei; `PrecompletareAnaf` e construit tocmai ca fiecare
      // cheie să aibă exact tipul câmpului omonim din formular.
      setValue(camp, valoare as never, { shouldValidate: true, shouldDirty: true });
      completate.push(camp);
    }
    return completate;
  };

  const preia = () => {
    setStare({ fel: "repaus" });
    setAvertismente([]);
    porneste(async () => {
      try {
        const raspuns = await fetch(`/api/anaf/firma?cui=${encodeURIComponent(cuiCurent)}`, {
          headers: { Accept: "application/json" },
        });
        const corp = (await raspuns.json().catch(() => null)) as RaspunsRuta | null;

        if (!raspuns.ok || corp?.ok !== true || corp.valori === undefined) {
          setStare({
            fel: "eroare",
            mesaj: corp?.mesaj ?? "Registrul ANAF nu a putut fi interogat.",
          });
          return;
        }

        const completate = aplica(corp.valori);
        setAvertismente(corp.avertismente ?? []);
        setStare({ fel: "succes", denumire: corp.denumire ?? "", completate });
      } catch {
        // Rețeaua căzută nu are voie să lase butonul în „Se interoghează…”.
        setStare({
          fel: "eroare",
          mesaj: "Conexiunea a eșuat. Completați datele manual.",
        });
      }
    });
  };

  return (
    <div>
      <Camp
        nume="cui"
        id={`${idFormular}-cui`}
        eticheta="CUI / CIF"
        obligatoriu
        erori={mesajeEroare(errors.cui?.message)}
      >
        {(a) => (
          <div className="flex items-start gap-2">
            <input
              {...a}
              // Regiunea vie a ANAF-ului se ADAUGĂ la ce a compus `Camp`
              // (eroarea), nu o înlocuiește. Înainte, `aria-describedby` arăta
              // NUMAI spre ea, deci mesajul de validare al CUI-ului nu se
              // anunța niciodată — iar CUI-ul e singurul câmp din pas care are
              // și validare de formă, și verificare la un registru extern.
              aria-describedby={[a["aria-describedby"], `${idFormular}-anaf-stare`]
                .filter((x) => x !== undefined)
                .join(" ")}
              className={cn(a.className, "flex-1")}
              {...register("cui")}
              placeholder="RO 14399840"
            />
            <button
              type="button"
              onClick={preia}
              disabled={!cuiValid || inCurs}
              title={
                cuiValid
                  ? "Preia denumirea, sediul și codul CAEN din registrul public ANAF"
                  : "Introduceți un CUI valid pentru a putea interoga registrul"
              }
              className="border-border text-foreground hover:bg-surface disabled:text-muted-foreground rounded-control text-corp shrink-0 border px-3 py-2 font-medium whitespace-nowrap disabled:cursor-not-allowed"
            >
              {inCurs ? "Se interoghează…" : "Preia de la ANAF"}
            </button>
          </div>
        )}
      </Camp>

      <div id={`${idFormular}-anaf-stare`} aria-live="polite" className="mt-1">
        {stare.fel === "succes" && (
          <p className="text-muted-foreground text-nota">
            {stare.completate.length === 0
              ? `„${stare.denumire}” a fost găsită, dar câmpurile erau deja completate — nu am schimbat nimic.`
              : `„${stare.denumire}” — s-au completat din registrul ANAF: ${stare.completate
                  .map((camp) => ETICHETE[camp])
                  .join(", ")}. Verificați-le înainte de a continua.`}
          </p>
        )}
        {stare.fel === "eroare" && <p className="text-danger text-nota">{stare.mesaj}</p>}
      </div>

      {avertismente.length > 0 && (
        <div
          role="alert"
          className="border-danger text-danger rounded-control text-nota mt-2 border p-2"
        >
          {avertismente.map((avertisment) => (
            <p key={avertisment}>{avertisment}</p>
          ))}
        </div>
      )}
    </div>
  );
}

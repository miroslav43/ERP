"use client";

// src/app/(app)/evaluari/kpi/seturi/constructor-set.tsx

/**
 * Constructorul unui set de indicatori.
 *
 * ── DE CE LISTA CĂLĂTOREȘTE CA JSON ───────────────────────────────────────
 * `FormData` e plat: n-are cum să poarte un tablou de obiecte fără o convenție
 * de nume gen `indicatori[0][denumire]`, care s-ar reparsa manual în acțiune.
 * Un singur câmp ascuns cu JSON păstrează tiparul aplicației și mută parsarea
 * în Zod, unde erorile ies pe câmp. Vezi `jsonDinFormData` în `schemas/comun.ts`.
 *
 * ── DE CE CODUL SE PĂSTREAZĂ LA EDITARE ───────────────────────────────────
 * Fiecare indicator existent își cară `cod`-ul într-un câmp ascuns al stării.
 * Codul e cheia sub care stau valorile lunilor deja evaluate; regenerat la
 * fiecare salvare, ar fi rupt legătura cu istoricul fără nicio eroare.
 */

import { Plus, Trash2 } from "lucide-react";
import { useId, useState, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp, clasaControl } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import {
  ETICHETE_SENS_KPI,
  ETICHETE_TIP_INDICATOR_KPI,
  SENSURI_KPI,
  TIPURI_INDICATOR_KPI,
} from "@/domain/evaluations/kpi-vocabular";
import type { SetKpi } from "@/lib/queries/kpi";
import { MAXIM_INDICATORI_KPI, SCALE_KPI } from "@/schemas/kpi";

import { actualizeazaSetKpi, creeazaSetKpi } from "../actions";

type TipIndicator = (typeof TIPURI_INDICATOR_KPI)[number];
type Sens = (typeof SENSURI_KPI)[number];

interface LinieFormular {
  readonly cheie: string;
  readonly cod: string | null;
  readonly denumire: string;
  readonly descriere: string;
  readonly tip: TipIndicator;
  readonly unitate: string;
  readonly sens: Sens;
  readonly tinta_implicita: string;
  readonly scala_max: number;
  readonly pondere: string;
}

let contorCheie = 0;
const cheieNoua = (): string => {
  contorCheie += 1;
  return `nou-${String(contorCheie)}`;
};

const LINIE_GOALA = (): LinieFormular => ({
  cheie: cheieNoua(),
  cod: null,
  denumire: "",
  descriere: "",
  tip: "masurat",
  unitate: "",
  sens: "crestere",
  tinta_implicita: "",
  scala_max: 5,
  pondere: "",
});

function dinSet(set: SetKpi): readonly LinieFormular[] {
  return set.indicatori.map((i) => ({
    cheie: i.id,
    cod: i.cod,
    denumire: i.denumire,
    descriere: i.descriere ?? "",
    tip: i.tip,
    unitate: i.unitate ?? "",
    sens: i.sens ?? "crestere",
    tinta_implicita: i.tinta_implicita === null ? "" : String(i.tinta_implicita),
    scala_max: i.scala_max ?? 5,
    pondere: String(i.pondere),
  }));
}

/** Ce se trimite: câmpurile tipului, restul lăsate pe seama schemei. */
function pentruTrimitere(linii: readonly LinieFormular[]) {
  return linii.map((l) =>
    l.tip === "masurat"
      ? {
          cod: l.cod,
          denumire: l.denumire,
          descriere: l.descriere,
          tip: l.tip,
          unitate: l.unitate,
          sens: l.sens,
          tinta_implicita: l.tinta_implicita,
          pondere: l.pondere,
        }
      : {
          cod: l.cod,
          denumire: l.denumire,
          descriere: l.descriere,
          tip: l.tip,
          scala_max: l.scala_max,
          pondere: l.pondere,
        },
  );
}

export function ConstructorSet({
  set,
  functiiSugerate,
  declansator,
}: Readonly<{
  set?: SetKpi;
  functiiSugerate: readonly string[];
  declansator?: Readonly<{ eticheta: string; varianta?: "secundar" | "primar" }>;
}>): ReactElement {
  const esteEditare = set !== undefined;
  const [linii, setLinii] = useState<readonly LinieFormular[]>(() =>
    esteEditare ? dinSet(set) : [LINIE_GOALA()],
  );
  const idFunctii = useId();

  const ponderi = linii.reduce((s, l) => s + (Number.parseFloat(l.pondere) || 0), 0);

  const schimba = (cheie: string, camp: keyof LinieFormular, valoare: string | number) => {
    setLinii((prev) => prev.map((l) => (l.cheie === cheie ? { ...l, [camp]: valoare } : l)));
  };

  return (
    <FormularDialog
      declansator={{
        eticheta: declansator?.eticheta ?? "Set nou",
        varianta: declansator?.varianta ?? "primar",
        ...(declansator === undefined ? { pictograma: <Plus className="size-4" /> } : {}),
      }}
      titlu={esteEditare ? `Editează „${set.denumire}”` : "Set de indicatori nou"}
      descriere={
        esteEditare
          ? "Modificările se aplică lunilor DESCHISE DE ACUM ÎNAINTE. Lunile deja deschise își păstrează liniile."
          : "Ce se măsoară la o funcție. Se aplică tuturor angajaților care au funcția scrisă în fișă."
      }
      etichetaTrimite={esteEditare ? "Salvează setul" : "Creează setul"}
      mesajReusita={esteEditare ? "Setul a fost salvat." : "Setul a fost creat."}
      actiune={esteEditare ? actualizeazaSetKpi : creeazaSetKpi}
      marime="lucru"
    >
      {(stare) => (
        <>
          {esteEditare ? <input type="hidden" name="id" value={set.id} /> : null}
          <input type="hidden" name="indicatori" value={JSON.stringify(pentruTrimitere(linii))} />

          {esteEditare ? null : (
            <>
              <Camp
                nume="functie"
                eticheta="Funcția"
                obligatoriu
                ajutor="Scrisă exact ca în fișele angajaților. Majusculele nu contează la potrivire."
                erori={stare.erori["functie"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="text"
                    list={idFunctii}
                    maxLength={160}
                    defaultValue={stare.valoriTrimise["functie"] ?? ""}
                  />
                )}
              </Camp>
              <datalist id={idFunctii}>
                {functiiSugerate.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </>
          )}

          <Camp
            nume="denumire"
            eticheta="Denumirea setului"
            obligatoriu
            erori={stare.erori["denumire"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={160}
                defaultValue={stare.valoriTrimise["denumire"] ?? set?.denumire ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="descriere"
            eticheta="Descriere"
            fel="textarea"
            ajutor="Când se folosește setul. Se vede în lista de seturi."
            erori={stare.erori["descriere"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                rows={2}
                maxLength={2000}
                defaultValue={stare.valoriTrimise["descriere"] ?? set?.descriere ?? ""}
              />
            )}
          </Camp>

          {(stare.erori["indicatori"] ?? []).length > 0 ? (
            <Callout fel="eroare" titlu="Indicatorii nu sunt valizi">
              {(stare.erori["indicatori"] ?? []).join(" ")}
            </Callout>
          ) : null}

          <fieldset className="space-y-3">
            <legend className="text-eticheta font-semibold tracking-wide uppercase">
              Indicatori
            </legend>

            {linii.map((l, i) => (
              <div
                key={l.cheie}
                className="border-foreground/15 grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
              >
                <div className="flex items-center gap-2 sm:col-span-2">
                  <span className="text-muted-foreground text-nota tabular-nums">{i + 1}.</span>
                  <input
                    type="text"
                    aria-label={`Denumirea indicatorului ${String(i + 1)}`}
                    className={clasaControl({})}
                    placeholder="Vizite clienți"
                    maxLength={160}
                    value={l.denumire}
                    onChange={(e) => {
                      schimba(l.cheie, "denumire", e.target.value);
                    }}
                  />
                  <Buton
                    marime="iconita"
                    aria-label={`Scoate indicatorul ${String(i + 1)}`}
                    disabled={linii.length === 1}
                    onClick={() => {
                      setLinii((prev) => prev.filter((x) => x.cheie !== l.cheie));
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Buton>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-eticheta text-muted-foreground font-medium">Tipul</span>
                  <select
                    className={clasaControl({ fel: "select" })}
                    value={l.tip}
                    onChange={(e) => {
                      schimba(l.cheie, "tip", e.target.value as TipIndicator);
                    }}
                  >
                    {TIPURI_INDICATOR_KPI.map((t) => (
                      <option key={t} value={t}>
                        {ETICHETE_TIP_INDICATOR_KPI[t]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-eticheta text-muted-foreground font-medium">
                    Pondere (%)
                  </span>
                  <input
                    type="number"
                    className={clasaControl({})}
                    min={0}
                    max={100}
                    step="0.01"
                    value={l.pondere}
                    onChange={(e) => {
                      schimba(l.cheie, "pondere", e.target.value);
                    }}
                  />
                </label>

                {l.tip === "masurat" ? (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-eticheta text-muted-foreground font-medium">
                        Ținta implicită
                      </span>
                      <input
                        type="number"
                        className={clasaControl({})}
                        step="0.01"
                        value={l.tinta_implicita}
                        onChange={(e) => {
                          schimba(l.cheie, "tinta_implicita", e.target.value);
                        }}
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-eticheta text-muted-foreground font-medium">
                        Unitatea
                      </span>
                      <input
                        type="text"
                        className={clasaControl({})}
                        maxLength={24}
                        placeholder="buc, %, lei"
                        value={l.unitate}
                        onChange={(e) => {
                          schimba(l.cheie, "unitate", e.target.value);
                        }}
                      />
                    </label>

                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-eticheta text-muted-foreground font-medium">
                        Sensul
                      </span>
                      <select
                        className={clasaControl({ fel: "select" })}
                        value={l.sens}
                        onChange={(e) => {
                          schimba(l.cheie, "sens", e.target.value as Sens);
                        }}
                      >
                        {SENSURI_KPI.map((s) => (
                          <option key={s} value={s}>
                            {ETICHETE_SENS_KPI[s]}
                          </option>
                        ))}
                      </select>
                      <span className="text-muted-foreground text-nota">
                        {l.sens === "crestere"
                          ? "Realizat peste țintă = peste 100 %."
                          : "Realizat SUB țintă = peste 100 %. Pentru rebut, reclamații, întârzieri."}
                      </span>
                    </label>
                  </>
                ) : (
                  <label className="flex flex-col gap-1">
                    <span className="text-eticheta text-muted-foreground font-medium">Scala</span>
                    <select
                      className={clasaControl({ fel: "select" })}
                      value={String(l.scala_max)}
                      onChange={(e) => {
                        schimba(l.cheie, "scala_max", Number.parseInt(e.target.value, 10));
                      }}
                    >
                      {SCALE_KPI.map((s) => (
                        <option key={s} value={String(s)}>
                          1–{s}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-3">
              <Buton
                disabled={linii.length >= MAXIM_INDICATORI_KPI}
                onClick={() => {
                  setLinii((prev) => [...prev, LINIE_GOALA()]);
                }}
              >
                <Plus className="size-4" /> Adaugă indicator
              </Buton>
              <p className="text-muted-foreground text-nota tabular-nums">
                {linii.length} din {MAXIM_INDICATORI_KPI} · ponderi{" "}
                {Math.round(ponderi * 100) / 100} %
              </p>
            </div>

            {/*
              Ponderile nu trebuie să dea 100 — scorul le renormalizează. Dar o
              sumă departe de 100 e aproape sigur o scăpare, deci se spune.
            */}
            {linii.length > 0 && Math.abs(ponderi - 100) > 0.01 ? (
              <Callout fel="informativ" titlu="Ponderile nu însumează 100 %">
                Nu e o eroare: scorul lunii se calculează proporțional cu ponderile puse, oricare ar
                fi suma lor. Dar dacă ați vrut procente, mai lipsesc{" "}
                {Math.round((100 - ponderi) * 100) / 100} %.
              </Callout>
            ) : null}
          </fieldset>
        </>
      )}
    </FormularDialog>
  );
}

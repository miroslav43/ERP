"use client";

// src/app/(app)/evaluari/_components/planificare-evaluari.tsx

/**
 * „Evaluare nouă” din lista modulului: PROGRAMEAZĂ evaluări, nu le notează.
 *
 * Se aleg șablonul, data și angajații — unul, câțiva sau toți —, iar fiecare
 * primește o ciornă fără note (`planificaEvaluari`). Ciornele apar în listă,
 * iar „Evaluează” pe fiecare rând deschide notarea. Evaluarea anuală a firmei
 * se pornește astfel dintr-o singură apăsare.
 *
 * Prima variantă (tot 6 oct 2026) deschidea aici formularul complet de notare
 * pentru UN angajat. Nu e ce se cere de la ecranul ăsta: programarea și
 * notarea sunt doi pași, făcuți adesea de oameni diferiți (HR programează,
 * managerul notează).
 *
 * Bifele sunt `<input type="checkbox" name="employee_ids">` necontrolate de
 * formular, dar oglindite în stare pentru „Selectează toți” și pentru numărul
 * de pe buton. Căutarea doar ASCUNDE rândurile (`hidden`), nu le scoate din
 * DOM: o bifă ascunsă de filtru rămâne bifată și pleacă la trimitere.
 */

import { CalendarPlus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type ReactElement } from "react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { PanouLateral } from "@/components/ui/dialog";
import { Formular } from "@/components/ui/formular";
import { IntrareData } from "@/components/ui/intrare-data";
import { arataToast } from "@/components/ui/toast";

import { planificaEvaluari } from "../actions";

export interface AngajatProgramabil {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string | null;
}

export interface SablonProgramabil {
  readonly id: string;
  readonly denumire: string;
  readonly nrCriterii: number;
}

/** Ziua de azi în fusul local, ca ISO. `toISOString()` ar da ziua în UTC. */
function aziIso(): string {
  const d = new Date();
  const luna = String(d.getMonth() + 1).padStart(2, "0");
  const zi = String(d.getDate()).padStart(2, "0");
  return `${String(d.getFullYear())}-${luna}-${zi}`;
}

/** „ș” și „s” se găsesc unul pe altul: oamenii caută fără diacritice. */
function normalizeaza(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function PlanificareEvaluari({
  angajati,
  sabloane,
}: Readonly<{
  angajati: readonly AngajatProgramabil[];
  sabloane: readonly SablonProgramabil[];
}>): ReactElement {
  const router = useRouter();
  const idFormular = useId();
  const idCautare = useId();
  const [deschis, setDeschis] = useState(false);
  const [alesi, setAlesi] = useState<ReadonlySet<string>>(new Set());
  const [cautare, setCautare] = useState("");

  const vizibili = useMemo(() => {
    const c = normalizeaza(cautare.trim());
    if (c === "") return new Set(angajati.map((a) => a.id));
    return new Set(
      angajati
        .filter((a) => normalizeaza(`${a.full_name} ${a.marca ?? ""}`).includes(c))
        .map((a) => a.id),
    );
  }, [angajati, cautare]);

  const totiVizibiliAlesi = vizibili.size > 0 && [...vizibili].every((id) => alesi.has(id));

  const comutaToti = (): void => {
    setAlesi((v) => {
      const nou = new Set(v);
      for (const id of vizibili) {
        if (totiVizibiliAlesi) nou.delete(id);
        else nou.add(id);
      }
      return nou;
    });
  };

  const comuta = (id: string): void => {
    setAlesi((v) => {
      const nou = new Set(v);
      if (nou.has(id)) nou.delete(id);
      else nou.add(id);
      return nou;
    });
  };

  const deschide = (): void => {
    // Fiecare deschidere pornește curat: bifele abandonate printr-un „Renunță”
    // n-au voie să plece la următoarea programare.
    setAlesi(new Set());
    setCautare("");
    setDeschis(true);
  };

  if (sabloane.length === 0) {
    return (
      <Buton varianta="primar" disabled title="Creați întâi un șablon de evaluare.">
        <CalendarPlus aria-hidden="true" className="size-4" />
        Evaluare nouă
      </Buton>
    );
  }

  return (
    <>
      <Buton varianta="primar" onClick={deschide}>
        <CalendarPlus aria-hidden="true" className="size-4" />
        Evaluare nouă
      </Buton>

      <PanouLateral
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu="Evaluare nouă"
        descriere="Alegeți șablonul, data și angajații. Fiecare primește o evaluare de completat, care apare în listă; notele se dau ulterior, din „Evaluează”."
        subsol={
          <>
            <p className="text-muted-foreground text-nota me-auto self-center tabular-nums">
              {alesi.size === 0
                ? "niciun angajat ales"
                : alesi.size === 1
                  ? "1 angajat ales"
                  : `${String(alesi.size)} angajați aleși`}
            </p>
            <BaraActiuni eticheta="Programarea evaluărilor">
              <Buton
                varianta="secundar"
                onClick={() => {
                  setDeschis(false);
                }}
              >
                Renunță
              </Buton>
              <Buton
                type="submit"
                form={idFormular}
                varianta="primar"
                disabled={alesi.size === 0}
                textInCurs="Se creează…"
              >
                {alesi.size <= 1 ? "Creează evaluarea" : `Creează ${String(alesi.size)} evaluări`}
              </Buton>
            </BaraActiuni>
          </>
        }
      >
        <Formular
          id={idFormular}
          actiune={planificaEvaluari}
          laReusita={(rezultat) => {
            setDeschis(false);
            arataToast({
              fel: "reusita",
              text:
                rezultat.sarite === 0
                  ? rezultat.create === 1
                    ? "Evaluarea a fost creată. O găsiți în listă."
                    : `Au fost create ${String(rezultat.create)} evaluări. Le găsiți în listă.`
                  : `Au fost create ${String(rezultat.create)} evaluări; ${String(rezultat.sarite)} angajați aveau deja una de completat pe acest șablon și au fost săriți.`,
              // Lista rămânea nefiltrată, cu ciornele noi amestecate; filtrul
              // pe stare le arată pe toate cele de completat. Toastul cu
              // acțiune nu se stinge singur.
              ...(rezultat.create === 0
                ? {}
                : {
                    actiune: {
                      eticheta: "Vezi ciornele",
                      onClick: () => {
                        router.push("/evaluari?status=draft");
                      },
                    },
                  }),
            });
            router.refresh();
          }}
        >
          {(stare) => (
            <>
              <Camp
                nume="template_id"
                eticheta="Șablon"
                obligatoriu
                fel="select"
                erori={stare.erori["template_id"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    defaultValue={stare.valoriTrimise.template_id ?? sabloane[0]?.id ?? ""}
                  >
                    {sabloane.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.denumire} · {s.nrCriterii} {s.nrCriterii === 1 ? "criteriu" : "criterii"}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>

              <Camp
                nume="data_evaluarii"
                eticheta="Data evaluării"
                obligatoriu
                erori={stare.erori["data_evaluarii"] ?? []}
              >
                {(a) => (
                  <IntrareData {...a} implicit={stare.valoriTrimise.data_evaluarii ?? aziIso()} />
                )}
              </Camp>

              <fieldset className="flex min-h-0 flex-col gap-2">
                <legend className="text-eticheta text-foreground mb-1 font-semibold tracking-wide uppercase">
                  Angajați
                </legend>
                {(stare.erori["employee_ids"] ?? []).length === 0 ? null : (
                  <p role="alert" className="text-danger text-nota">
                    {(stare.erori["employee_ids"] ?? []).join(" ")}
                  </p>
                )}

                <label htmlFor={idCautare} className="sr-only">
                  Caută angajat
                </label>
                <span className="relative">
                  <Search
                    aria-hidden="true"
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  />
                  <input
                    id={idCautare}
                    type="search"
                    value={cautare}
                    onChange={(e) => {
                      setCautare(e.target.value);
                    }}
                    placeholder="Caută după nume sau marcă"
                    className="rounded-control border-foreground/60 bg-background text-corp h-9 w-full border ps-9 pe-3"
                  />
                </span>

                <label className="border-border flex items-center gap-2 border-b pb-2 font-medium">
                  <input type="checkbox" checked={totiVizibiliAlesi} onChange={comutaToti} />
                  {cautare.trim() === ""
                    ? `Toți angajații (${String(angajati.length)})`
                    : `Toți cei găsiți (${String(vizibili.size)})`}
                </label>

                <ul className="flex flex-col gap-1">
                  {angajati.map((a) => (
                    <li key={a.id} hidden={!vizibili.has(a.id)}>
                      <label className="hover:bg-surface rounded-control flex items-center gap-2 px-1 py-1">
                        <input
                          type="checkbox"
                          name="employee_ids"
                          value={a.id}
                          checked={alesi.has(a.id)}
                          onChange={() => {
                            comuta(a.id);
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate">{a.full_name}</span>
                        {a.marca === null || a.marca === "" ? null : (
                          <span className="text-muted-foreground text-nota tabular-nums">
                            {a.marca}
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
                {vizibili.size === 0 ? (
                  <p className="text-muted-foreground text-nota">
                    Niciun angajat nu se potrivește căutării.
                  </p>
                ) : null}
              </fieldset>
            </>
          )}
        </Formular>
      </PanouLateral>
    </>
  );
}

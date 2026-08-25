"use client";

// src/app/(app)/angajati/[id]/formular-evaluare-noua.tsx

/**
 * Evaluarea unui angajat, într-un panou lateral.
 *
 * ── DE CE PANOU ȘI NU FORMULAR ÎN PAGINĂ ──────────────────────────────────
 * Formularul stătea deschis în fluxul fișei, sub lista de evaluări. Docblock-ul
 * lui `PanouLateral` descrie exact cazul: „~15 formulare stau permanent
 * deschise în flux; fișa echipamentului are PATRU simultan, unul cu 15 câmpuri".
 * Un șablon cu zece criterii însemna un perete de câmpuri care împingea restul
 * fișei afară din prima privire.
 *
 * Panou, nu dialog: formularul e lung și are nevoie de derulare proprie, fără
 * să acopere contextul din stânga.
 *
 * ── DEFECTELE REPARATE ────────────────────────────────────────────────────
 * 1. `scor: scoruri[cod] ?? 0` trimitea zero pentru fiecare criteriu neatins.
 *    Pe o scală 1-5, unde zero nici măcar nu e o notă validă, o evaluare pe
 *    jumătate completată arăta catastrofal. Necompletat e `null` acum, iar
 *    controlul are „șterge nota" ca să se poată reveni la el.
 * 2. Nu exista UPDATE. O ciornă salvată rămânea îngheațată pentru totdeauna:
 *    politica exista în bază, dar n-o folosea nicio acțiune.
 * 3. `<input type="number">` pentru o notă de la 1 la 5. Grupul de radio
 *    nativ e o singură țintă de `Tab`, se parcurge cu săgețile și se anunță
 *    „2 din 5" la cititorul de ecran.
 */

import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactElement } from "react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { PanouLateral } from "@/components/ui/dialog";
import { Formular } from "@/components/ui/formular";
import type { CriteriuSablon } from "@/domain/evaluations/criterii";
import { calculeazaScor, type RaspunsCriteriu } from "@/domain/evaluations/scor";
import { cn } from "@/lib/ui/cn";

import { CampCriteriu, RASPUNS_GOL } from "@/components/evaluari/campuri-evaluare";
import { actualizeazaEvaluare, creeazaEvaluare, finalizeazaEvaluare } from "../../evaluari/actions";

export interface SablonEvaluare {
  readonly id: string;
  readonly denumire: string;
  readonly criterii: readonly CriteriuSablon[];
}

export interface CiornaEvaluare {
  readonly id: string;
  readonly data_evaluarii: string;
  readonly concluzie: string | null;
  readonly criterii: readonly CriteriuSablon[];
  readonly raspunsuri: readonly RaspunsCriteriu[];
  readonly sablon: string | null;
}

export type PropsFormularEvaluare = Readonly<{
  employeeId: string;
  sabloane: readonly SablonEvaluare[];
  /** Prezentă = se corectează o ciornă. Absentă = evaluare nouă. */
  ciorna?: CiornaEvaluare;
  declansator?: (deschide: () => void) => ReactElement;
}>;

/** Ziua de azi în fusul local, ca ISO. `toISOString()` ar da ziua în UTC. */
function aziIso(): string {
  const d = new Date();
  const luna = String(d.getMonth() + 1).padStart(2, "0");
  const zi = String(d.getDate()).padStart(2, "0");
  return `${String(d.getFullYear())}-${luna}-${zi}`;
}

export function FormularEvaluareNoua({
  employeeId,
  sabloane,
  ciorna,
  declansator,
}: PropsFormularEvaluare): ReactElement {
  const router = useRouter();
  const idFormular = useId();
  const [deschis, setDeschis] = useState(false);
  const [sablonId, setSablonId] = useState(sabloane[0]?.id ?? "");
  const [raspunsuri, setRaspunsuri] = useState<readonly RaspunsCriteriu[]>([]);

  const esteEditare = ciorna !== undefined;
  const criterii = esteEditare
    ? ciorna.criterii
    : (sabloane.find((s) => s.id === sablonId)?.criterii ?? []);
  const punctaj = calculeazaScor(criterii, raspunsuri);

  const raspunsPentru = (cod: string): RaspunsCriteriu =>
    raspunsuri.find((r) => r.criteriu_cod === cod) ?? RASPUNS_GOL(cod);

  const schimba = (r: RaspunsCriteriu): void => {
    setRaspunsuri((v) => {
      const fara = v.filter((x) => x.criteriu_cod !== r.criteriu_cod);
      return [...fara, r];
    });
  };

  const deschide = (): void => {
    // Starea se reface la fiecare deschidere: notele abandonate printr-un
    // „Renunță" n-au voie să reapară data viitoare.
    setSablonId(sabloane[0]?.id ?? "");
    setRaspunsuri(esteEditare ? ciorna.raspunsuri : []);
    setDeschis(true);
  };

  if (!esteEditare && sabloane.length === 0) {
    return (
      <p className="text-muted-foreground text-corp">
        Niciun șablon de evaluare activ.{" "}
        <Link
          href="/evaluari/sabloane"
          className="text-primary underline decoration-1 underline-offset-4"
        >
          Creați unul
        </Link>{" "}
        înainte de a evalua un angajat.
      </p>
    );
  }

  return (
    <>
      {declansator === undefined ? (
        <Buton varianta="secundar" className="mt-3" onClick={deschide}>
          Evaluare nouă
        </Buton>
      ) : (
        declansator(deschide)
      )}

      <PanouLateral
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu={esteEditare ? "Corectează ciorna" : "Evaluare nouă"}
        descriere={
          esteEditare
            ? `Șablonul „${ciorna.sablon ?? "șters"}”, cu criteriile de la momentul completării.`
            : "Notele necompletate rămân necompletate: nu se salvează ca zero."
        }
        subsol={
          <>
            <p className="text-muted-foreground text-nota me-auto self-center tabular-nums">
              {punctaj.procent === null
                ? "nicio notă încă"
                : `${String(punctaj.procent)} % · ${String(punctaj.completate)} din ${String(punctaj.completate + punctaj.necompletate)} criterii`}
            </p>
            <BaraActiuni eticheta="Salvarea evaluării">
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
                varianta="secundar"
                name={esteEditare ? "salveaza" : "status"}
                value={esteEditare ? "da" : "draft"}
                textInCurs="Se salvează…"
              >
                Salvează ciorna
              </Buton>
              <Buton
                type="submit"
                form={idFormular}
                varianta="primar"
                name={esteEditare ? "finalizeaza" : "status"}
                value={esteEditare ? "da" : "finalizat"}
                disabled={punctaj.completate === 0}
                textInCurs="Se salvează…"
              >
                Finalizează
              </Buton>
            </BaraActiuni>
          </>
        }
      >
        <Formular
          id={idFormular}
          actiune={async (date) => {
            if (!esteEditare) return creeazaEvaluare(date);
            const salvat = await actualizeazaEvaluare(date);
            // Finalizarea e o a doua acțiune, nu un câmp al primei: are alt
            // nume în jurnalul de audit și altă poartă de permisiune. Dacă a
            // doua eșuează, prima a reușit deja — starea rămâne o ciornă
            // salvată, care e sigură, iar mesajul spune exact ce s-a întâmplat.
            if (!salvat.ok || date.get("finalizeaza") !== "da") return salvat;
            return finalizeazaEvaluare({ id: ciorna.id });
          }}
          mesajReusita={esteEditare ? "Evaluarea a fost salvată." : "Evaluarea a fost creată."}
          laReusita={() => {
            setDeschis(false);
            router.refresh();
          }}
        >
          {(stare) => (
            <>
              {esteEditare ? (
                <input type="hidden" name="id" value={ciorna.id} />
              ) : (
                <>
                  <input type="hidden" name="employee_id" value={employeeId} />
                  <input type="hidden" name="template_id" value={sablonId} />
                </>
              )}
              <input
                type="hidden"
                name="raspunsuri"
                value={JSON.stringify(criterii.map((c) => raspunsPentru(c.cod)))}
              />

              {esteEditare ? null : (
                <Camp
                  nume="sablon"
                  eticheta="Șablon"
                  obligatoriu
                  erori={stare.erori["template_id"] ?? []}
                  fel="select"
                >
                  {(a) => (
                    <select
                      {...a}
                      name="sablon"
                      value={sablonId}
                      onChange={(e) => {
                        setSablonId(e.target.value);
                        // Notele aparțin criteriilor șablonului ales. Păstrate
                        // peste o schimbare de șablon, ar fi rămas legate de
                        // coduri care nu mai există.
                        setRaspunsuri([]);
                      }}
                    >
                      {sabloane.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.denumire}
                        </option>
                      ))}
                    </select>
                  )}
                </Camp>
              )}

              <Camp
                nume="data_evaluarii"
                eticheta="Data evaluării"
                obligatoriu
                erori={stare.erori["data_evaluarii"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="date"
                    defaultValue={
                      stare.valoriTrimise.data_evaluarii ?? ciorna?.data_evaluarii ?? aziIso()
                    }
                  />
                )}
              </Camp>

              <fieldset className="flex flex-col gap-2">
                <legend className="text-eticheta text-foreground mb-1 font-semibold tracking-wide uppercase">
                  Criterii
                </legend>
                {(stare.erori["raspunsuri"] ?? []).length === 0 ? null : (
                  <p role="alert" className="text-danger text-nota">
                    {(stare.erori["raspunsuri"] ?? []).join(" ")}
                  </p>
                )}
                {criterii.map((c) => (
                  <CampCriteriu
                    key={c.cod}
                    criteriu={c}
                    raspuns={raspunsPentru(c.cod)}
                    prefix="evaluare"
                    laSchimbare={schimba}
                  />
                ))}
              </fieldset>

              <Camp
                nume="concluzie"
                eticheta="Concluzie"
                fel="textarea"
                ajutor="Ce reține evaluatorul, dincolo de note."
                erori={stare.erori["concluzie"] ?? []}
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={4}
                    maxLength={4000}
                    defaultValue={stare.valoriTrimise.concluzie ?? ciorna?.concluzie ?? ""}
                  />
                )}
              </Camp>

              {punctaj.necompletate === 0 ? null : (
                <p
                  className={cn(
                    "text-muted-foreground text-nota",
                    punctaj.completate === 0 ? "text-danger" : "",
                  )}
                >
                  {punctaj.necompletate === 1
                    ? "Un criteriu e încă nenotat."
                    : `${String(punctaj.necompletate)} criterii sunt încă nenotate.`}{" "}
                  Nenotat nu înseamnă zero: criteriile rămase goale ies din punctaj.
                </p>
              )}
            </>
          )}
        </Formular>
      </PanouLateral>
    </>
  );
}

/**
 * Cele două declanșatoare ale panoului, gata legate.
 *
 * ── DE CE NU MAI PRIMESC `declansator` DIN PAGINĂ ─────────────────────────
 * `declansator` e o FUNCȚIE, iar fișa angajatului e Componentă de Server. RSC
 * serializează props-urile trecute spre client și o funcție n-are reprezentare:
 * Next aruncă „Functions cannot be passed directly to Client Components”, iar
 * fișa cade ÎNTREAGĂ în `error.tsx`. Aceeași cauză a scos și `/evaluari/sabloane`
 * din funcțiune pe producție.
 *
 * Prop-ul rămâne pe componentă — apelanții de pe client îl folosesc curat —
 * dar paginile de server cheamă butoanele astea, ale căror props sunt toate
 * serializabile. Poarta e `src/config/granita-rsc.test.ts`.
 */
export function ButonEvaluareNoua({
  employeeId,
  sabloane,
}: Readonly<{ employeeId: string; sabloane: readonly SablonEvaluare[] }>): ReactElement {
  return (
    <FormularEvaluareNoua
      employeeId={employeeId}
      sabloane={sabloane}
      declansator={(deschide) => (
        <Buton varianta="secundar" onClick={deschide}>
          <Plus aria-hidden="true" className="size-3.5" />
          Evaluare nouă
        </Buton>
      )}
    />
  );
}

export function ButonContinuaCiorna({
  employeeId,
  sabloane,
  ciorna,
}: Readonly<{
  employeeId: string;
  sabloane: readonly SablonEvaluare[];
  ciorna: CiornaEvaluare;
}>): ReactElement {
  return (
    <FormularEvaluareNoua
      employeeId={employeeId}
      sabloane={sabloane}
      ciorna={ciorna}
      declansator={(deschide) => (
        <Buton varianta="tertiar" onClick={deschide}>
          <Pencil aria-hidden="true" className="size-3.5" />
          Continuă ciorna
        </Buton>
      )}
    />
  );
}

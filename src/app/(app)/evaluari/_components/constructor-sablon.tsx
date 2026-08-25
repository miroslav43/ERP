"use client";

// src/app/(app)/evaluari/_components/constructor-sablon.tsx

/**
 * Constructorul de șabloane de evaluare.
 *
 * ── CE ÎNLOCUIEȘTE ────────────────────────────────────────────────────────
 * Un `<textarea>` cu instrucțiunea „un criteriu pe linie". Scala era fixă 1-5,
 * ponderi nu existau, ghid de notare nu exista, iar codurile se generau prin
 * slug FĂRĂ deduplicare: două linii care se reduceau la același cod produceau
 * `key` duplicat în React și răspunsuri care se suprascriau tăcut.
 *
 * ── DE CE PREVIZUALIZAREA E ÎN AL DOILEA PANOU, NU O IMAGINE ──────────────
 * Coloana din dreapta randează criteriile cu `CampCriteriu`, adică EXACT
 * componenta cu care se completează evaluarea reală, doar dezactivată. O
 * previzualizare desenată separat ar fi o promisiune pe care nimic n-o
 * verifică; asta nu poate diverge, fiindcă e același cod.
 *
 * ── DE CE REORDONAREA ARE BUTOANE, NU DOAR TRAGERE ────────────────────────
 * Tragerea nativă nu există la tastatură și e nesigură pe atingere. Butoanele
 * „mută sus" / „mută jos" sunt calea garantată; tragerea se adaugă peste ele
 * pentru cine folosește mausul. Proiectul nu are `@dnd-kit` și nu se instalează
 * unul pentru atât.
 *
 * ── DE CE CRITERIILE CĂLĂTORESC CA JSON ───────────────────────────────────
 * `FormData` e plat. Tiparul aplicației e `Formular` + `FormData` + Server
 * Action, iar un câmp ascuns cu JSON păstrează tiparul și mută parsarea în
 * Zod, unde erorile ies pe câmp. Vezi `jsonDinFormData` în `schemas/evaluation.ts`.
 */

import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp, clasaControl } from "@/components/ui/camp";
import { Dialog } from "@/components/ui/dialog";
import { Formular } from "@/components/ui/formular";
import {
  MAXIM_CRITERII,
  SCALE_PERMISE,
  valideazaPonderi,
  type CriteriuSablon,
  type TipCriteriu,
} from "@/domain/evaluations/criterii";
import { cn } from "@/lib/ui/cn";

import { actualizeazaSablonEvaluare, creeazaSablonEvaluare } from "../actions";
import { CampCriteriu, RASPUNS_GOL } from "@/components/evaluari/campuri-evaluare";

const ETICHETE_TIP: Readonly<Record<TipCriteriu, string>> = {
  scala: "Scală",
  da_nu: "Da / Nu",
  text: "Răspuns liber",
};

/** Un criteriu în curs de editare. `cheie` e stabilă doar pentru React. */
interface CriteriuEditor {
  readonly cheie: string;
  readonly cod: string | null;
  readonly denumire: string;
  readonly descriere: string;
  readonly tip: TipCriteriu;
  readonly scala_max: number;
  readonly pondere: string;
}

let contorChei = 0;
const cheieNoua = (): string => {
  contorChei += 1;
  return `c${String(contorChei)}`;
};

const criteriuNou = (): CriteriuEditor => ({
  cheie: cheieNoua(),
  cod: null,
  denumire: "",
  descriere: "",
  tip: "scala",
  scala_max: 5,
  pondere: "",
});

const dinSablon = (criterii: readonly CriteriuSablon[]): CriteriuEditor[] =>
  criterii.map((c) => ({
    cheie: cheieNoua(),
    cod: c.cod,
    denumire: c.denumire,
    descriere: c.descriere ?? "",
    tip: c.tip,
    scala_max: c.tip === "scala" ? c.scala_max : 5,
    pondere: c.pondere === null ? "" : String(c.pondere),
  }));

/** Forma trimisă serverului. Fără `cheie`: e o unealtă de randare, nu date. */
const pentruTrimitere = (criterii: readonly CriteriuEditor[]) =>
  criterii.map((c) => ({
    cod: c.cod,
    denumire: c.denumire.trim(),
    descriere: c.descriere.trim() === "" ? null : c.descriere.trim(),
    tip: c.tip,
    scala_max: c.tip === "da_nu" ? 1 : c.tip === "text" ? 0 : c.scala_max,
    pondere: c.pondere.trim() === "" ? null : Number(c.pondere),
  }));

/** Forma pe care o înțelege previzualizarea. Aceleași reguli ca la trimitere. */
const pentruPrevizualizare = (criterii: readonly CriteriuEditor[]): readonly CriteriuSablon[] =>
  criterii.map((c, i) => ({
    cod: c.cod ?? `nou-${String(i)}`,
    denumire: c.denumire.trim() === "" ? "Criteriu fără denumire" : c.denumire.trim(),
    descriere: c.descriere.trim() === "" ? null : c.descriere.trim(),
    tip: c.tip,
    scala_max: c.tip === "da_nu" ? 1 : c.tip === "text" ? 0 : c.scala_max,
    pondere: c.pondere.trim() === "" ? null : Number(c.pondere),
  }));

export type PropsConstructor = Readonly<{
  /** Absent = șablon nou. Prezent = editarea unuia existent. */
  sablon?: Readonly<{
    id: string;
    denumire: string;
    descriere: string | null;
    criterii: readonly CriteriuSablon[];
    versiune: number;
    nrEvaluari: number;
  }>;
  /**
   * Butonul care deschide dialogul, randat de apelant.
   *
   * Funcție, nu element: un `<span onClick>` care înfășoară un buton primit de
   * afară ar pune un handler pe un element neinteractiv (ESLint-ul de
   * accesibilitate îl respinge, pe bună dreptate) și ar depinde de bulele de
   * evenimente. Așa, apelantul primește `deschide` și îl pune pe propriul lui
   * buton, care rămâne un `<button>` adevărat.
   */
  declansator: (deschide: () => void) => ReactElement;
}>;

export function ConstructorSablon({ sablon, declansator }: PropsConstructor): ReactElement {
  const router = useRouter();
  const idFormular = useId();
  const [deschis, setDeschis] = useState(false);
  const [fila, setFila] = useState<"criterii" | "previzualizare">("criterii");
  const [criterii, setCriterii] = useState<CriteriuEditor[]>(() =>
    sablon === undefined ? [criteriuNou()] : dinSablon(sablon.criterii),
  );
  const [tras, setTras] = useState<number | null>(null);

  const esteEditare = sablon !== undefined;
  const ponderi = valideazaPonderi(pentruPrevizualizare(criterii));

  const deschide = (): void => {
    // Starea se reface la fiecare deschidere: altfel modificările abandonate
    // printr-un „Renunță" ar reapărea data viitoare, iar omul ar salva din
    // greșeală o ciornă pe care credea că a aruncat-o.
    setCriterii(sablon === undefined ? [criteriuNou()] : dinSablon(sablon.criterii));
    setFila("criterii");
    setDeschis(true);
  };

  const schimba = (i: number, patch: Partial<CriteriuEditor>): void => {
    setCriterii((v) => v.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  };

  const muta = (de: number, la: number): void => {
    if (la < 0 || la >= criterii.length) return;
    setCriterii((v) => {
      const copie = [...v];
      const [scos] = copie.splice(de, 1);
      if (scos !== undefined) copie.splice(la, 0, scos);
      return copie;
    });
  };

  return (
    <>
      {declansator(deschide)}

      <Dialog
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        marime="lucru"
        titlu={esteEditare ? `Editează „${sablon.denumire}”` : "Șablon de evaluare nou"}
        descriere={
          esteEditare
            ? `Versiunea ${String(sablon.versiune)}. Criteriile se aplică evaluărilor viitoare.`
            : "Un set de criterii reutilizabil, aplicat apoi angajaților de pe fișa fiecăruia."
        }
        subsol={
          <>
            <p className="text-muted-foreground text-nota me-auto self-center tabular-nums">
              {criterii.length} {criterii.length === 1 ? "criteriu" : "criterii"}
              {ponderi.arePonderi ? ` · ponderi ${String(ponderi.total)} %` : ""}
            </p>
            <Buton
              varianta="secundar"
              onClick={() => {
                setDeschis(false);
              }}
            >
              Renunță
            </Buton>
            <Buton type="submit" form={idFormular} varianta="primar" textInCurs="Se salvează…">
              {esteEditare ? "Salvează modificările" : "Creează șablonul"}
            </Buton>
          </>
        }
      >
        <Formular
          id={idFormular}
          actiune={async (date) =>
            esteEditare ? actualizeazaSablonEvaluare(date) : creeazaSablonEvaluare(date)
          }
          mesajReusita={esteEditare ? "Șablonul a fost actualizat." : "Șablonul a fost creat."}
          laReusita={() => {
            setDeschis(false);
            router.refresh();
          }}
        >
          {(stare) => (
            <>
              {esteEditare ? <input type="hidden" name="id" value={sablon.id} /> : null}
              <input
                type="hidden"
                name="criterii"
                value={JSON.stringify(pentruTrimitere(criterii))}
              />

              {esteEditare && sablon.nrEvaluari > 0 ? (
                <Callout fel="atentie" titlu="Șablonul e deja folosit">
                  {sablon.nrEvaluari === 1
                    ? "O evaluare folosește șablonul acesta."
                    : `${String(sablon.nrEvaluari)} evaluări folosesc șablonul acesta.`}{" "}
                  Ele își păstrează criteriile de la momentul completării, deci notele deja date
                  rămân neatinse. Modificările se aplică evaluărilor viitoare.
                </Callout>
              ) : null}

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                {/* ── Coloana de lucru ─────────────────────────────────── */}
                <div
                  className={cn("flex flex-col gap-4", fila === "criterii" ? "" : "max-lg:hidden")}
                >
                  <Camp
                    nume="denumire"
                    eticheta="Denumirea șablonului"
                    obligatoriu
                    erori={stare.erori["denumire"] ?? []}
                  >
                    {(a) => (
                      <input
                        {...a}
                        type="text"
                        maxLength={160}
                        defaultValue={stare.valoriTrimise.denumire ?? sablon?.denumire ?? ""}
                      />
                    )}
                  </Camp>

                  <Camp
                    nume="descriere"
                    eticheta="Descriere"
                    fel="textarea"
                    ajutor="Când se folosește șablonul. Se vede în lista de șabloane."
                    erori={stare.erori["descriere"] ?? []}
                  >
                    {(a) => (
                      <textarea
                        {...a}
                        rows={2}
                        maxLength={500}
                        defaultValue={stare.valoriTrimise.descriere ?? sablon?.descriere ?? ""}
                      />
                    )}
                  </Camp>

                  <fieldset className="flex flex-col gap-2">
                    <legend className="text-eticheta text-foreground mb-1 font-semibold tracking-wide uppercase">
                      Criterii
                    </legend>

                    {(stare.erori["criterii"] ?? []).length === 0 ? null : (
                      <Callout fel="eroare">
                        <ul className="space-y-1">
                          {(stare.erori["criterii"] ?? []).map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </Callout>
                    )}

                    <ol className="flex flex-col gap-2">
                      {criterii.map((c, i) => (
                        <li
                          key={c.cheie}
                          draggable={tras === i}
                          onDragOver={(e) => {
                            if (tras === null || tras === i) return;
                            e.preventDefault();
                          }}
                          onDrop={(e) => {
                            if (tras === null) return;
                            e.preventDefault();
                            muta(tras, i);
                            setTras(null);
                          }}
                          onDragEnd={() => {
                            setTras(null);
                          }}
                          className={cn(
                            "border-border rounded-panou bg-surface border p-3 transition-colors",
                            tras === i ? "border-foreground/60" : "",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              // Tragerea se armează de pe mâner, ca selecția de
                              // text din câmpuri să rămână posibilă.
                              onPointerDown={() => {
                                setTras(i);
                              }}
                              aria-hidden="true"
                              className="text-muted-foreground mt-2 hidden shrink-0 cursor-grab active:cursor-grabbing md:block"
                            >
                              <GripVertical className="size-4" />
                            </span>

                            <div className="min-w-0 flex-1">
                              <label className="sr-only" htmlFor={`crit-${c.cheie}-denumire`}>
                                Denumirea criteriului {String(i + 1)}
                              </label>
                              <input
                                id={`crit-${c.cheie}-denumire`}
                                type="text"
                                className={clasaControl()}
                                maxLength={160}
                                placeholder="Ce se evaluează"
                                value={c.denumire}
                                onChange={(e) => {
                                  schimba(i, { denumire: e.target.value });
                                }}
                              />

                              <div className="mt-2 flex flex-wrap items-end gap-2">
                                <span className="flex flex-col gap-1">
                                  <label
                                    htmlFor={`crit-${c.cheie}-tip`}
                                    className="text-muted-foreground text-nota"
                                  >
                                    Tip
                                  </label>
                                  <span className="relative">
                                    <select
                                      id={`crit-${c.cheie}-tip`}
                                      className={cn(clasaControl({ fel: "select" }), "w-36")}
                                      value={c.tip}
                                      onChange={(e) => {
                                        schimba(i, { tip: e.target.value as TipCriteriu });
                                      }}
                                    >
                                      {(Object.keys(ETICHETE_TIP) as TipCriteriu[]).map((t) => (
                                        <option key={t} value={t}>
                                          {ETICHETE_TIP[t]}
                                        </option>
                                      ))}
                                    </select>
                                    <ChevronDown
                                      aria-hidden="true"
                                      className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
                                    />
                                  </span>
                                </span>

                                {c.tip === "scala" ? (
                                  <span className="flex flex-col gap-1">
                                    <label
                                      htmlFor={`crit-${c.cheie}-scala`}
                                      className="text-muted-foreground text-nota"
                                    >
                                      Scală
                                    </label>
                                    <span className="relative">
                                      <select
                                        id={`crit-${c.cheie}-scala`}
                                        className={cn(clasaControl({ fel: "select" }), "w-28")}
                                        value={c.scala_max}
                                        onChange={(e) => {
                                          schimba(i, { scala_max: Number(e.target.value) });
                                        }}
                                      >
                                        {SCALE_PERMISE.map((s) => (
                                          <option key={s} value={s}>
                                            1 - {s}
                                          </option>
                                        ))}
                                      </select>
                                      <ChevronDown
                                        aria-hidden="true"
                                        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
                                      />
                                    </span>
                                  </span>
                                ) : null}

                                {c.tip === "text" ? null : (
                                  <span className="flex flex-col gap-1">
                                    <label
                                      htmlFor={`crit-${c.cheie}-pondere`}
                                      className="text-muted-foreground text-nota"
                                    >
                                      Pondere %
                                    </label>
                                    <input
                                      id={`crit-${c.cheie}-pondere`}
                                      type="number"
                                      inputMode="numeric"
                                      min={0}
                                      max={100}
                                      className={cn(clasaControl(), "w-24 tabular-nums")}
                                      placeholder="—"
                                      value={c.pondere}
                                      onChange={(e) => {
                                        schimba(i, { pondere: e.target.value });
                                      }}
                                    />
                                  </span>
                                )}
                              </div>

                              <details className="mt-2" open={c.descriere !== ""}>
                                <summary className="text-muted-foreground hover:text-foreground text-nota rounded-control inline-flex min-h-9 cursor-pointer items-center underline decoration-1 underline-offset-4">
                                  Ghid de notare
                                </summary>
                                <label className="sr-only" htmlFor={`crit-${c.cheie}-ghid`}>
                                  Ghid de notare pentru criteriul {String(i + 1)}
                                </label>
                                <textarea
                                  id={`crit-${c.cheie}-ghid`}
                                  rows={2}
                                  maxLength={500}
                                  className={cn(clasaControl({ fel: "textarea" }), "mt-1.5")}
                                  placeholder="Ce înseamnă o notă mare și ce înseamnă una mică."
                                  value={c.descriere}
                                  onChange={(e) => {
                                    schimba(i, { descriere: e.target.value });
                                  }}
                                />
                              </details>
                            </div>

                            <span className="flex shrink-0 flex-col gap-1">
                              <Buton
                                varianta="tertiar"
                                marime="iconita"
                                aria-label={`Mută criteriul ${String(i + 1)} mai sus`}
                                disabled={i === 0}
                                onClick={() => {
                                  muta(i, i - 1);
                                }}
                              >
                                <ChevronUp aria-hidden="true" className="size-4" />
                              </Buton>
                              <Buton
                                varianta="tertiar"
                                marime="iconita"
                                aria-label={`Mută criteriul ${String(i + 1)} mai jos`}
                                disabled={i === criterii.length - 1}
                                onClick={() => {
                                  muta(i, i + 1);
                                }}
                              >
                                <ChevronDown aria-hidden="true" className="size-4" />
                              </Buton>
                              <Buton
                                varianta="tertiar"
                                marime="iconita"
                                aria-label={`Șterge criteriul ${String(i + 1)}`}
                                disabled={criterii.length === 1}
                                onClick={() => {
                                  setCriterii((v) => v.filter((_, k) => k !== i));
                                }}
                              >
                                <Trash2 aria-hidden="true" className="size-4" />
                              </Buton>
                            </span>
                          </div>
                        </li>
                      ))}
                    </ol>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Buton
                        varianta="secundar"
                        disabled={criterii.length >= MAXIM_CRITERII}
                        onClick={() => {
                          setCriterii((v) => [...v, criteriuNou()]);
                        }}
                      >
                        <Plus aria-hidden="true" className="size-4" />
                        Adaugă criteriu
                      </Buton>

                      {ponderi.arePonderi ? (
                        <p
                          className={cn(
                            "text-nota tabular-nums",
                            ponderi.valida ? "text-muted-foreground" : "text-danger",
                          )}
                        >
                          Total ponderi: {ponderi.total} %
                          {ponderi.valida ? "" : ` (mai sunt ${String(100 - ponderi.total)} %)`}
                        </p>
                      ) : (
                        <p className="text-muted-foreground text-nota">
                          Fără ponderi: criteriile cântăresc egal.
                        </p>
                      )}
                    </div>
                  </fieldset>
                </div>

                {/* ── Previzualizarea ──────────────────────────────────── */}
                <div
                  className={cn(
                    "flex flex-col gap-2",
                    fila === "previzualizare" ? "" : "max-lg:hidden",
                  )}
                >
                  <p className="text-eticheta text-foreground font-semibold tracking-wide uppercase">
                    Așa se va completa
                  </p>
                  <div className="border-border rounded-panou bg-surface flex flex-col gap-2 border p-3">
                    {criterii.map((_, i) => {
                      const c = pentruPrevizualizare(criterii)[i];
                      if (c === undefined) return null;
                      return (
                        <CampCriteriu
                          key={criterii[i]?.cheie ?? String(i)}
                          criteriu={c}
                          raspuns={RASPUNS_GOL(c.cod)}
                          prefix="previzualizare"
                          dezactivat
                          laSchimbare={() => {
                            /* previzualizarea nu primește date */
                          }}
                        />
                      );
                    })}
                    <div className="border-border rounded-panou bg-background border p-3">
                      <p className="text-corp text-foreground font-medium">Concluzie</p>
                      <p className="text-muted-foreground text-nota mt-1">
                        Text liber, la finalul evaluării.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub `lg` cele două coloane nu încap una lângă alta. */}
              <div className="flex gap-1 lg:hidden">
                {(["criterii", "previzualizare"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={fila === f}
                    onClick={() => {
                      setFila(f);
                    }}
                    className={cn(
                      "text-corp rounded-control min-h-11 flex-1 px-3 font-medium transition-colors",
                      fila === f
                        ? "bg-primary text-primary-foreground"
                        : "border-foreground/60 text-foreground hover:bg-surface active:bg-border border",
                    )}
                  >
                    {f === "criterii" ? "Criterii" : "Previzualizare"}
                  </button>
                ))}
              </div>
            </>
          )}
        </Formular>
      </Dialog>
    </>
  );
}

/**
 * Butonul „Șablon nou”, gata legat de constructor.
 *
 * ── DE CE TRĂIEȘTE AICI, NU ÎN PAGINĂ ─────────────────────────────────────
 * `declansator` e o FUNCȚIE, iar `/evaluari/sabloane/page.tsx` e Componentă de
 * Server. RSC serializează props-urile trecute spre client, iar o funcție n-are
 * reprezentare: Next aruncă „Functions cannot be passed directly to Client
 * Components” și pagina cade ÎNTREAGĂ în `error.tsx` — nu doar butonul, ci și
 * lista de șabloane de sub el. Așa a ajuns pe producție, cu digest `1277356878`.
 *
 * Niciuna dintre porți n-o vede: tipul e corect pentru `tsc`, ESLint n-are
 * noțiunea de graniță RSC, iar `build` nu prerandează o pagină care citește
 * cookie-uri. Poarta e `src/config/granita-rsc.test.ts`.
 *
 * Aici, funcția nu mai traversează nimic: ambele capete sunt pe client.
 */
export function ButonSablonNou(): ReactElement {
  return (
    <ConstructorSablon
      declansator={(deschide) => (
        <Buton varianta="primar" onClick={deschide}>
          <Plus aria-hidden="true" className="size-4" />
          Șablon nou
        </Buton>
      )}
    />
  );
}

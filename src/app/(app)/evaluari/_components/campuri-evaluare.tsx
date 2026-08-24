"use client";

// src/app/(app)/evaluari/_components/campuri-evaluare.tsx

/**
 * Controalele cu care se completează o evaluare.
 *
 * ── DE CE SUNT ÎNTR-UN FIȘIER PROPRIU ─────────────────────────────────────
 * Aceleași componente randează DOUĂ lucruri: formularul real de evaluare și
 * previzualizarea din constructorul de șabloane. Dacă previzualizarea și-ar
 * desena propriile controale, ar deveni o promisiune pe care nimic n-o
 * verifică — exact felul de ecran care arată bine la livrare și minte peste
 * trei modificări. Aici, ce se vede în constructor E formularul.
 *
 * ── DE CE `<input type="radio">` ȘI NU BUTOANE ────────────────────────────
 * Notarea pe o scală e o alegere dintr-un set, adică fix un grup de radio.
 * Nativ, asta aduce gratuit: navigare cu săgețile în interiorul grupului, un
 * singur `Tab` pentru tot grupul, anunțarea „2 din 5" de către cititoarele de
 * ecran și asocierea la formular. Un grup de `<button>` cu `role="radiogroup"`
 * ar fi cerut `tabindex` mobil scris de mână, iar varianta scrisă de mână e
 * cea care se strică prima.
 *
 * Intrarea propriu-zisă e ascunsă vizual (`sr-only`), iar `<label>` poartă
 * desenul. Focusul se ia de la intrare prin `has-[:focus-visible]`, ca inelul
 * global din `globals.css` să apară pe eticheta vizibilă, nu pe un element de
 * 0 px.
 *
 * ── DE CE EXISTĂ „ȘTERGE NOTA" ────────────────────────────────────────────
 * Necompletat NU e zero. Formularul vechi trimitea `scor ?? 0` pentru toate
 * criteriile, deci o evaluare pe jumătate completată arăta catastrofal. Dacă
 * starea „fără notă" nu are drum înapoi din interfață, prima atingere greșită
 * o face definitivă.
 */

import { Eraser } from "lucide-react";
import { useId, type ReactElement } from "react";

import type { CriteriuSablon } from "@/domain/evaluations/criterii";
import type { RaspunsCriteriu } from "@/domain/evaluations/scor";
import { clasaControl } from "@/components/ui/camp";
import { cn } from "@/lib/ui/cn";

export const RASPUNS_GOL = (cod: string): RaspunsCriteriu => ({
  criteriu_cod: cod,
  scor: null,
  raspuns_text: null,
  comentariu: null,
});

const clasaOptiune = (selectat: boolean, dezactivat: boolean): string =>
  cn(
    "text-corp rounded-control relative flex min-w-9 flex-1 items-center justify-center border px-2",
    "h-9 font-medium tabular-nums transition-colors pointer-coarse:h-11",
    "has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
    selectat
      ? "border-primary bg-primary text-primary-foreground"
      : "border-foreground/60 bg-background text-foreground",
    dezactivat
      ? "cursor-default"
      : selectat
        ? "hover:bg-primary-hover active:bg-primary-active cursor-pointer"
        : "hover:bg-surface active:bg-border cursor-pointer",
  );

type PropsScala = Readonly<{
  nume: string;
  eticheta: string;
  maxim: number;
  valoare: number | null;
  /** Etichetele capetelor scalei: „slab" / „excelent". */
  capete?: readonly [string, string];
  dezactivat?: boolean;
  laSchimbare: (scor: number | null) => void;
}>;

export function ScalaNotare({
  nume,
  eticheta,
  maxim,
  valoare,
  capete,
  dezactivat = false,
  laSchimbare,
}: PropsScala): ReactElement {
  const trepte = Array.from({ length: maxim }, (_, i) => i + 1);
  return (
    <div className="flex flex-col gap-1.5">
      <div role="group" aria-label={eticheta} className="flex flex-wrap items-center gap-1.5">
        {trepte.map((treapta) => {
          const selectat = valoare === treapta;
          return (
            <label key={treapta} className={clasaOptiune(selectat, dezactivat)}>
              <input
                type="radio"
                name={nume}
                value={treapta}
                checked={selectat}
                disabled={dezactivat}
                onChange={() => {
                  laSchimbare(treapta);
                }}
                className="sr-only"
              />
              {treapta}
            </label>
          );
        })}
        <button
          type="button"
          // Ascuns când nu e nimic de șters: un buton care nu face nimic e o
          // țintă ratată, nu o opțiune.
          hidden={valoare === null || dezactivat}
          onClick={() => {
            laSchimbare(null);
          }}
          aria-label={`Șterge nota pentru ${eticheta}`}
          className="text-muted-foreground hover:bg-surface hover:text-foreground active:bg-border rounded-control inline-flex size-9 shrink-0 items-center justify-center transition-colors pointer-coarse:size-11"
        >
          <Eraser aria-hidden="true" className="size-4" />
        </button>
      </div>
      {capete === undefined ? null : (
        <p className="text-muted-foreground text-nota flex justify-between gap-4">
          <span>1 = {capete[0]}</span>
          <span>
            {maxim} = {capete[1]}
          </span>
        </p>
      )}
    </div>
  );
}

type PropsDaNu = Readonly<{
  nume: string;
  eticheta: string;
  valoare: number | null;
  dezactivat?: boolean;
  laSchimbare: (scor: number | null) => void;
}>;

export function AlegereDaNu({
  nume,
  eticheta,
  valoare,
  dezactivat = false,
  laSchimbare,
}: PropsDaNu): ReactElement {
  const optiuni = [
    { valoare: 1, text: "Da" },
    { valoare: 0, text: "Nu" },
  ] as const;
  return (
    <div role="group" aria-label={eticheta} className="flex flex-wrap items-center gap-1.5">
      {optiuni.map((o) => {
        const selectat = valoare === o.valoare;
        return (
          <label
            key={o.text}
            className={cn(clasaOptiune(selectat, dezactivat), "max-w-28 flex-none px-4")}
          >
            <input
              type="radio"
              name={nume}
              value={o.valoare}
              checked={selectat}
              disabled={dezactivat}
              onChange={() => {
                laSchimbare(o.valoare);
              }}
              className="sr-only"
            />
            {o.text}
          </label>
        );
      })}
      <button
        type="button"
        hidden={valoare === null || dezactivat}
        onClick={() => {
          laSchimbare(null);
        }}
        aria-label={`Șterge răspunsul pentru ${eticheta}`}
        className="text-muted-foreground hover:bg-surface hover:text-foreground active:bg-border rounded-control inline-flex size-9 shrink-0 items-center justify-center transition-colors pointer-coarse:size-11"
      >
        <Eraser aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

export type PropsCampCriteriu = Readonly<{
  criteriu: CriteriuSablon;
  raspuns: RaspunsCriteriu;
  /** Prefix de nume, ca două formulare pe același ecran să nu se amestece. */
  prefix: string;
  /** Previzualizarea din constructor: se vede totul, nu se poate atinge nimic. */
  dezactivat?: boolean;
  laSchimbare: (raspuns: RaspunsCriteriu) => void;
}>;

/**
 * Un criteriu, cu tot ce ține de el: enunț, ghid de notare, control și notă.
 *
 * Nota liberă („Adaugă notă") stă pliată într-un `<details>`, nu într-un câmp
 * mereu deschis: pe un șablon cu 12 criterii, 12 casete de text deschise fac
 * din formular un perete, iar comentariul se completează în practică la două,
 * trei criterii. `<details>` deschis când există deja text — altfel nota scrisă
 * data trecută s-ar ascunde la redeschiderea ciornei.
 */
export function CampCriteriu({
  criteriu,
  raspuns,
  prefix,
  dezactivat = false,
  laSchimbare,
}: PropsCampCriteriu): ReactElement {
  const idComentariu = useId();
  const nume = `${prefix}-${criteriu.cod}`;

  return (
    <div className="border-border rounded-panou bg-background border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-corp text-foreground font-medium">{criteriu.denumire}</p>
        {criteriu.pondere === null ? null : (
          <span className="text-muted-foreground text-nota tabular-nums">
            {criteriu.pondere} % din punctaj
          </span>
        )}
      </div>
      {criteriu.descriere === null ? null : (
        <p className="text-muted-foreground text-nota mt-1 text-pretty">{criteriu.descriere}</p>
      )}

      <div className="mt-2.5">
        {criteriu.tip === "text" ? (
          <textarea
            name={nume}
            aria-label={criteriu.denumire}
            className={clasaControl({ fel: "textarea" })}
            rows={2}
            maxLength={1000}
            disabled={dezactivat}
            value={raspuns.raspuns_text ?? ""}
            onChange={(e) => {
              laSchimbare({
                ...raspuns,
                raspuns_text: e.target.value === "" ? null : e.target.value,
              });
            }}
          />
        ) : criteriu.tip === "da_nu" ? (
          <AlegereDaNu
            nume={nume}
            eticheta={criteriu.denumire}
            valoare={raspuns.scor}
            dezactivat={dezactivat}
            laSchimbare={(scor) => {
              laSchimbare({ ...raspuns, scor });
            }}
          />
        ) : (
          <ScalaNotare
            nume={nume}
            eticheta={criteriu.denumire}
            maxim={criteriu.scala_max}
            valoare={raspuns.scor}
            capete={["deloc", "excelent"]}
            dezactivat={dezactivat}
            laSchimbare={(scor) => {
              laSchimbare({ ...raspuns, scor });
            }}
          />
        )}
      </div>

      {criteriu.tip === "text" ? null : (
        <details className="mt-2" open={raspuns.comentariu !== null && raspuns.comentariu !== ""}>
          <summary className="text-muted-foreground hover:text-foreground text-nota rounded-control inline-flex min-h-9 cursor-pointer items-center underline decoration-1 underline-offset-4 marker:content-['']">
            Adaugă notă
          </summary>
          <label htmlFor={idComentariu} className="sr-only">
            Notă pentru {criteriu.denumire}
          </label>
          <input
            id={idComentariu}
            type="text"
            name={`${nume}-nota`}
            className={cn(clasaControl(), "mt-1.5")}
            maxLength={1000}
            disabled={dezactivat}
            value={raspuns.comentariu ?? ""}
            onChange={(e) => {
              laSchimbare({
                ...raspuns,
                comentariu: e.target.value === "" ? null : e.target.value,
              });
            }}
          />
        </details>
      )}
    </div>
  );
}

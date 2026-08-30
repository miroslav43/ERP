// src/components/ui/intrare-data.tsx
"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useRef, useState, type ReactElement } from "react";

import { Calendar } from "@/components/ui/calendar";
import { clasaControl } from "@/components/ui/camp";
import { formatDate, parseDateRo, type DateString } from "@/lib/format/date";
import { cn } from "@/lib/ui/cn";

/**
 * Câmpul de dată al produsului: `30.08.2026` pe ecran, `2026-08-30` la server.
 *
 * ── DE CE NU `<input type="date">` ────────────────────────────────────────
 * Exact fundătura documentată în `intrare-ora.tsx` pentru `<input type="time">`,
 * cu aceleași consecințe. Selectorul nativ își alege limba după INTERFAȚA
 * browserului, nu după `lang`-ul documentului: pe un Chrome în engleză, într-o
 * aplicație românească, se deschidea un calendar cu „August 2026”, cu capul de
 * săptămână `M T W T F S S` — duminica prima, ceea ce în România e pur și
 * simplu greșit — și cu butoanele „Clear” și „Today”. Nu există atribut, CSS
 * sau opțiune care să schimbe ceva. Singura garanție e să nu mai folosim
 * controlul nativ.
 *
 * Ce se pierde: selectorul browserului și autocompletarea lui. Ce se câștigă:
 * același ecran pentru toți, în română, cu weekendul hașurat și sărbătorile
 * legale vizibile ÎN CLIPA ALEGERII. Într-un ERP de HR asta nu e decor: cine
 * pune data de început a unui concediu vede pe loc că a nimerit peste Crăciun.
 *
 * ── VALOAREA E ISO, ÎNTOTDEAUNA ───────────────────────────────────────────
 * `onSchimba`, `valoare`, `implicit`, `min`, `max` și câmpul ascuns vorbesc
 * toate `"2026-08-30"` — exact ce producea `<input type="date">` și exact ce
 * așteaptă o coloană `date` din Postgres. De aceea înlocuirea unui câmp nativ
 * nu atinge nicio schemă Zod și nicio Server Action: se schimbă doar eticheta
 * elementului. Formatul românesc trăiește NUMAI în caseta vizibilă.
 *
 * ── CASETA VIZIBILĂ NU ARE `name` ─────────────────────────────────────────
 * Aceeași regulă ca la `combobox.tsx`, și din același motiv. Tiparul dominant
 * e `<form action>` + `FormData` — 105 fișiere cu `<form`, față de 4 din 118 cu
 * react-hook-form. Dacă și caseta ar avea `name`, `FormData` ar purta sub
 * aceeași cheie și `30.08.2026`, și `2026-08-30`; `formData.get()` întoarce
 * prima valoare, deci Postgres ar primi data românească și ar cădea cu `22007`.
 *
 * ── DE CE RĂMÂNE TASTABILĂ ────────────────────────────────────────────────
 * `data_nasterii` din fișa angajatului cade cu patruzeci de ani în urmă.
 * Calendarul are săgeți de an tocmai ca să nu ceară 480 de clicuri, dar cel mai
 * scurt drum rămâne tastarea. `parseDateRo` — scrisă demult în
 * `src/lib/format/date.ts` și rămasă până acum fără niciun consumator — citește
 * și `5.3.2026`, și `05.03.2026`, și respinge 31 februarie.
 */

/** Atributele pe care le dă `<Camp>` prin funcția de randare, toate opționale aici. */
type AtributeComune = Readonly<{
  id?: string | undefined;
  name?: string | undefined;
  className?: string | undefined;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  "aria-invalid"?: true | undefined;
  "aria-describedby"?: string | undefined;
}>;

export type PropsIntrareData = AtributeComune &
  Readonly<{
    /** Controlat: zi ISO `"2026-08-30"` sau șir gol. */
    valoare?: DateString | "" | undefined;
    /** Necontrolat: valoarea de pornire, tot ISO. */
    implicit?: DateString | "" | undefined;
    /** Primește ziua ISO, sau șir gol când câmpul a fost golit. */
    onSchimba?: ((zi: string) => void) | undefined;
    /** Prima zi selectabilă, ISO. */
    min?: DateString | undefined;
    /** Ultima zi selectabilă, ISO. */
    max?: DateString | undefined;
    /** Ziua considerată „azi”. Implicit ceasul României. Se injectează în teste. */
    azi?: DateString | undefined;
  }>;

const ISO = /^\d{4}-\d{2}-\d{2}$/u;

/** Zi ISO → ce se scrie în casetă. Șir gol pentru orice nu e o zi întreagă. */
function scrieRo(zi: string): string {
  return ISO.test(zi) ? formatDate(zi) : "";
}

/**
 * Mesajul nativ al browserului, ancorat de caseta VIZIBILĂ.
 *
 * Pus pe câmpul ascuns, browserul ar refuza trimiterea arătând spre un element
 * pe care nimeni nu-l vede — iar în Chrome asta înseamnă un formular care pur
 * și simplu nu se trimite, fără niciun mesaj. Lecția e a comboboxului.
 */
const MESAJ_FORMAT = "Scrieți data ca zz.ll.aaaa.";

export function IntrareData({
  valoare,
  implicit,
  onSchimba,
  min,
  max,
  azi,
  name,
  className,
  disabled,
  ...atribute
}: PropsIntrareData): ReactElement {
  const [ciorna, setCiorna] = useState<string | null>(null);
  const [propriu, setPropriu] = useState(() => (ISO.test(implicit ?? "") ? (implicit ?? "") : ""));
  const [atins, setAtins] = useState(false);
  const [deschis, setDeschis] = useState(false);

  const refRadacina = useRef<HTMLDivElement | null>(null);
  const refCaseta = useRef<HTMLInputElement | null>(null);

  const dinParinte = valoare === undefined ? propriu : valoare;
  const text = ciorna ?? scrieRo(dinParinte);
  /* Ce s-a tastat ACUM, dacă e o dată întreagă. Panoul se deschide pe ea, nu pe
     ultima valoare predată: altfel omul scrie 11.02.2026, deschide calendarul
     ca să vadă în ce zi a săptămânii cade, și primește luna curentă. */
  const dinText = parseDateRo(text);
  const canonic = dinText ?? (ISO.test(dinParinte) ? dinParinte : null);
  const invalid = atins && text.trim().length > 0 && dinText === null;

  useEffect(() => {
    refCaseta.current?.setCustomValidity(invalid ? MESAJ_FORMAT : "");
  }, [invalid]);

  /*
    Închiderea la clic în afară. `pointerdown`, nu `click`: un clic care începe
    în afara panoului și se termină pe el ar închide-o abia la ridicarea
    degetului, adică după ce alegerea a plecat deja.

    Nu prin `onBlur`, cum face comboboxul: acolo focusul nu părăsește niciodată
    caseta, pe când aici săgețile îl mută DELIBERAT în panou. Un `onBlur` care
    închide ar face navigarea de la tastatură imposibilă.
  */
  useEffect(() => {
    if (!deschis) return;
    function laApasare(eveniment: PointerEvent): void {
      const tinta = eveniment.target;
      if (tinta instanceof Node && refRadacina.current?.contains(tinta) === true) return;
      setDeschis(false);
    }
    document.addEventListener("pointerdown", laApasare);
    return () => {
      document.removeEventListener("pointerdown", laApasare);
    };
  }, [deschis]);

  /** Predă valoarea în sus. Primește textul explicit, ca să nu depindă de închidere. */
  function preda(brut: string): void {
    setAtins(true);
    if (brut.trim().length === 0) {
      setCiorna(null);
      setPropriu("");
      onSchimba?.("");
      return;
    }
    const zi = parseDateRo(brut);
    // Textul greșit RĂMÂNE pe ecran. Șters, omul n-ar afla niciodată ce a scris
    // prost — ar vedea doar un câmp gol pe care era convins că l-a completat.
    if (zi === null) return;
    setCiorna(null);
    setPropriu(zi);
    onSchimba?.(zi);
  }

  function alege(zi: DateString): void {
    setCiorna(null);
    setAtins(true);
    setPropriu(zi);
    onSchimba?.(zi);
    setDeschis(false);
    // Focusul se întoarce în casetă: altfel Tab ar reporni din capul paginii,
    // fiindcă butonul care-l ținea tocmai a dispărut din DOM.
    refCaseta.current?.focus();
  }

  function inchide(): void {
    setDeschis(false);
    refCaseta.current?.focus();
  }

  return (
    <div ref={refRadacina} className="relative">
      {/* Singurul câmp cu `name`. `disabled` trebuie pus AICI, nu doar pe caseta
          vizibilă: un câmp dezactivat nu se trimite, iar primitiva se dă drept
          înlocuitor cap-la-cap pentru `<input type="date">`. */}
      {name === undefined ? null : (
        <input type="hidden" name={name} value={canonic ?? ""} disabled={disabled} />
      )}

      <input
        {...atribute}
        ref={refCaseta}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="zz.ll.aaaa"
        disabled={disabled}
        aria-invalid={atribute["aria-invalid"] ?? (invalid ? true : undefined)}
        value={text}
        onChange={(eveniment) => {
          setCiorna(eveniment.target.value);
        }}
        onBlur={() => {
          preda(text);
        }}
        className={cn(clasaControl({ fel: "input" }), "pr-10 tabular-nums", className)}
      />

      <button
        type="button"
        aria-label="Deschide calendarul"
        aria-expanded={deschis}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => {
          setDeschis((inainte) => !inainte);
        }}
        className={cn(
          "text-muted-foreground hover:text-foreground rounded-control absolute top-1/2 right-1",
          "grid size-7 -translate-y-1/2 place-items-center transition-colors",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <CalendarDays aria-hidden="true" className="size-4" />
      </button>

      {deschis ? (
        <div
          className={cn(
            "border-border bg-background rounded-panou shadow-plutitor z-meniu absolute mt-1 border",
            // Ancorat la stânga câmpului, dar tras înăuntru dacă n-are loc:
            // panoul e mai lat decât câmpurile scurte de dată din barele de filtre.
            "top-full left-0 min-w-max",
          )}
        >
          <Calendar
            valoare={canonic}
            min={min}
            max={max}
            azi={azi}
            onAlege={alege}
            onInchide={inchide}
          />
        </div>
      ) : null}
    </div>
  );
}

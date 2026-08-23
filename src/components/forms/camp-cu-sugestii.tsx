// src/components/forms/camp-cu-sugestii.tsx
"use client";

import { cheieCautare } from "@/lib/text/diacritice";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Câmp text liber cu o listă de sugestii.
 *
 * Înlocuiește `<input list>` + `<datalist>`: lista nativă e desenată de browser
 * (fundal întunecat, lățime proprie, fără legătură cu tema aplicației) și nu se
 * poate stiliza. Aici lista e marcaj obișnuit, deci arată la fel peste tot și
 * respectă temele.
 *
 * Spre deosebire de selectorul CAEN, valoarea NU e constrânsă la listă:
 * sugestiile sunt doar scurtături, orice text scris de mână rămâne valid.
 */

const CLASA_CAMP =
  "mt-1 w-full rounded-control border border-border bg-background py-2 pl-3 pr-9 text-corp text-foreground";

interface Proprietati {
  readonly id: string;
  readonly value: string;
  readonly onChange: (valoare: string) => void;
  readonly sugestii: readonly string[];
  readonly placeholder?: string;
  readonly maxLength?: number;
  readonly ariaInvalid?: boolean;
  readonly ariaDescribedBy?: string;
}

export function CampCuSugestii({
  id,
  value,
  onChange,
  sugestii,
  placeholder,
  maxLength,
  ariaInvalid,
  ariaDescribedBy,
}: Proprietati) {
  const [deschis, setDeschis] = useState(false);
  const [indiceActiv, setIndiceActiv] = useState(-1);
  // Cât timp e `true`, în casetă stă valoarea comisă, neatinsă de tastatură —
  // lista se afișează întreagă (răsfoire), nu filtrată după ea însăși.
  const [neatins, setNeatins] = useState(true);
  const idListbox = useId();

  const termen = cheieCautare(value.trim());
  const rezultate =
    neatins || termen === "" ? sugestii : sugestii.filter((s) => cheieCautare(s).includes(termen));

  function comite(sugestie: string): void {
    onChange(sugestie);
    setNeatins(true);
    setIndiceActiv(-1);
    setDeschis(false);
  }

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setDeschis(false);
        setNeatins(true);
        setIndiceActiv(-1);
      }}
    >
      <input
        id={id}
        role="combobox"
        aria-expanded={deschis}
        aria-controls={idListbox}
        aria-autocomplete="list"
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onFocus={() => {
          setDeschis(true);
          setNeatins(true);
          setIndiceActiv(-1);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          setNeatins(false);
          setIndiceActiv(-1);
          setDeschis(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setDeschis(true);
            setIndiceActiv((i) => Math.min(rezultate.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndiceActiv((i) => Math.max(-1, i - 1));
          } else if (e.key === "Enter") {
            const ales = deschis ? rezultate[indiceActiv] : undefined;
            if (ales === undefined) {
              // Nicio sugestie evidențiată: textul scris rămâne cum e, doar
              // închidem lista. Fără `preventDefault`, ca Enter să poată trimite
              // formularul exact ca într-un câmp text obișnuit.
              setDeschis(false);
              return;
            }
            e.preventDefault();
            comite(ales);
          } else if (e.key === "Escape") {
            setDeschis(false);
            setIndiceActiv(-1);
          }
        }}
        className={CLASA_CAMP}
      />

      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onMouseDown={(e) => {
          e.preventDefault(); // păstrează focusul pe input
          setDeschis((d) => !d);
        }}
        className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 mt-1 flex w-9 items-center justify-center"
      >
        <ChevronDown className={"size-4 transition-transform " + (deschis ? "rotate-180" : "")} />
      </button>

      {deschis && rezultate.length > 0 && (
        <ul
          id={idListbox}
          role="listbox"
          className="border-border bg-surface rounded-control shadow-plutitor absolute z-10 mt-1 max-h-64 w-full overflow-auto border"
        >
          {rezultate.map((sugestie, index) => (
            <li key={sugestie}>
              <button
                type="button"
                role="option"
                aria-selected={index === indiceActiv}
                onMouseDown={(e) => {
                  e.preventDefault(); // păstrează focusul pe input, nu-l fură butonul
                  comite(sugestie);
                }}
                className={
                  "text-foreground text-corp block w-full px-3 py-2 text-left " +
                  (index === indiceActiv ? "bg-primary/10" : "hover:bg-primary/5")
                }
              >
                {sugestie}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

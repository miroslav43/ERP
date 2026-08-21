// src/components/forms/selector-tara.tsx
"use client";

import { useId, useState } from "react";

import { TARI_EUROPENE } from "@/domain/organization/tari-europene";
import {
  Avertisment,
  CLASA_CAMP,
  etichetaOptiune,
  FARA_RAND_ACTIV,
  filtreazaOptiuni,
  ListaRezultate,
  rezolvaOptiune,
  type OptiuneCod,
} from "./combobox-cod";

/** Lista are ~50 de intrări; se afișează întreagă, cu derulare. */
const LIMITA_REZULTATE = TARI_EUROPENE.length;

const GOL: ReadonlySet<string> = new Set();

export function filtreazaTari(interogare: string): readonly OptiuneCod[] {
  return filtreazaOptiuni(TARI_EUROPENE, interogare, GOL, LIMITA_REZULTATE);
}

export function rezolvaTara(text: string): OptiuneCod | undefined {
  return rezolvaOptiune(TARI_EUROPENE, text, GOL, LIMITA_REZULTATE);
}

interface Proprietati {
  /** Cod ISO alpha-2. `""` sau `undefined` = neales. */
  readonly value: string | undefined;
  readonly onChange: (cod: string) => void;
  readonly id: string;
  readonly ariaInvalid?: boolean;
  readonly ariaDescribedBy?: string;
}

export function SelectorTara({ value, onChange, id, ariaInvalid, ariaDescribedBy }: Proprietati) {
  const selectat =
    value !== undefined && value !== ""
      ? TARI_EUROPENE.find((t) => t.cod === value.toUpperCase())
      : undefined;
  const etichetaSelectat = selectat !== undefined ? etichetaOptiune(selectat) : "";

  const [deschis, setDeschis] = useState(false);
  const [indiceActiv, setIndiceActiv] = useState(FARA_RAND_ACTIV);
  const [avertisment, setAvertisment] = useState<string | undefined>(undefined);

  // Ca la selectorul CAEN: textul afișat derivă din `value`, iar starea locală
  // ține doar ciorna cât timp se scrie. Fără copie locală a etichetei nu există
  // nimic de resincronizat când valoarea vine din afară.
  const [ciorna, setCiorna] = useState<string | null>(null);
  const seScrie = ciorna !== null;
  const textAfisat = ciorna ?? etichetaSelectat;

  const idListbox = useId();
  const idAvertisment = `${id}-avertisment`;
  const rezultate = filtreazaTari(ciorna ?? "");

  function comite(t: OptiuneCod): void {
    onChange(t.cod);
    setCiorna(null);
    setAvertisment(undefined);
    setDeschis(false);
  }

  function confirmaTextul(): void {
    if (ciorna === null) return;
    const scris = ciorna.trim();
    if (scris === "") {
      onChange("");
      setCiorna(null);
      setAvertisment(undefined);
      return;
    }
    const rezolvat = rezolvaTara(scris);
    if (rezolvat !== undefined) {
      comite(rezolvat);
      return;
    }
    setCiorna(null);
    setAvertisment(
      etichetaSelectat === ""
        ? `„${scris}” nu corespunde niciunei țări din listă.`
        : `„${scris}” nu corespunde niciunei țări din listă — am păstrat ${selectat?.cod}.`,
    );
  }

  return (
    <div className="relative">
      <div
        onBlur={(e) => {
          if (e.currentTarget.contains(e.relatedTarget)) return;
          setDeschis(false);
          confirmaTextul();
        }}
      >
        <input
          id={id}
          role="combobox"
          aria-expanded={deschis}
          aria-controls={idListbox}
          aria-autocomplete="list"
          aria-invalid={ariaInvalid}
          aria-describedby={
            [ariaDescribedBy, avertisment !== undefined ? idAvertisment : undefined]
              .filter((v) => v !== undefined)
              .join(" ") || undefined
          }
          value={textAfisat}
          title={textAfisat}
          placeholder="Scrie codul sau denumirea (ex. RO, Ungaria)"
          onFocus={(e) => {
            setDeschis(true);
            setIndiceActiv(FARA_RAND_ACTIV);
            setCiorna(null);
            e.target.select();
          }}
          onChange={(e) => {
            setCiorna(e.target.value);
            setIndiceActiv(0);
            setDeschis(true);
            setAvertisment(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setDeschis(true);
              setIndiceActiv((i) => Math.min(rezultate.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndiceActiv((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              const ales = deschis && indiceActiv >= 0 ? rezultate[indiceActiv] : undefined;
              if (ales !== undefined) {
                e.preventDefault();
                comite(ales);
              } else if (seScrie) {
                e.preventDefault();
                confirmaTextul();
                setDeschis(false);
              }
            } else if (e.key === "Escape") {
              setDeschis(false);
              setIndiceActiv(FARA_RAND_ACTIV);
              setCiorna(null);
              setAvertisment(undefined);
            }
          }}
          className={CLASA_CAMP}
        />
        {deschis && (
          <ListaRezultate
            rezultate={rezultate}
            indiceActiv={indiceActiv}
            onAlege={comite}
            idListbox={idListbox}
            mesajGol="Nicio țară găsită."
          />
        )}
      </div>
      <Avertisment id={idAvertisment} mesaj={avertisment} />
    </div>
  );
}

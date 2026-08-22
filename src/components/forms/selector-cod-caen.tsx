// src/components/forms/selector-cod-caen.tsx
"use client";

import { useId, useState } from "react";
import { NOMENCLATOR_CAEN, type CodCaen } from "@/domain/organization/caen-nomenclator";
import {
  Avertisment,
  CLASA_CAMP,
  etichetaOptiune,
  FARA_RAND_ACTIV,
  filtreazaOptiuni,
  ListaRezultate,
  rezolvaOptiune,
} from "./combobox-cod";

const LIMITA_REZULTATE = 20;

/** `6210 — Activități de realizare a softului la comandă` */
export function etichetaCaen(c: CodCaen): string {
  return etichetaOptiune(c);
}

/** Filtrare cod SAU denumire, fără diacritice; exclude codurile deja alese. */
export function filtreazaCaen(
  interogare: string,
  exclude: ReadonlySet<string>,
): readonly CodCaen[] {
  return filtreazaOptiuni(NOMENCLATOR_CAEN, interogare, exclude, LIMITA_REZULTATE);
}

/** Vezi `rezolvaOptiune`: cod scris direct, denumire completă, sau rezultat unic. */
export function rezolvaCaen(text: string, exclude: ReadonlySet<string>): CodCaen | undefined {
  return rezolvaOptiune(NOMENCLATOR_CAEN, text, exclude, LIMITA_REZULTATE);
}

interface ProprietatiPrincipal {
  readonly value: string | undefined;
  readonly onChange: (cod: string) => void;
  readonly id: string;
  readonly ariaInvalid?: boolean;
  readonly ariaDescribedBy?: string;
}

export function SelectorCodCaenPrincipal({
  value,
  onChange,
  id,
  ariaInvalid,
  ariaDescribedBy,
}: ProprietatiPrincipal) {
  const selectat =
    value !== undefined && value !== "" ? NOMENCLATOR_CAEN.find((c) => c.cod === value) : undefined;
  const etichetaSelectat = selectat !== undefined ? etichetaCaen(selectat) : "";

  const [deschis, setDeschis] = useState(false);
  const [indiceActiv, setIndiceActiv] = useState(FARA_RAND_ACTIV);
  const [avertisment, setAvertisment] = useState<string | undefined>(undefined);

  /**
   * Textul din casetă cât timp utilizatorul scrie; `null` = nu scrie nimeni,
   * caseta arată eticheta codului comis.
   *
   * Deliberat NU ținem o copie locală a etichetei comise. Varianta cu o stare
   * oglindă resincronizată la randare se rupea cu react-hook-form: `setValue`
   * propagă noul `value` înapoi prin `watch` abia într-o randare ulterioară,
   * deci imediat după selecție componenta vedea încă `value`-ul vechi, credea
   * că valoarea a fost ștearsă din afară și golea caseta. Derivând textul
   * direct din `value` nu mai există nimic de resincronizat și nici cursă.
   */
  const [ciorna, setCiorna] = useState<string | null>(null);
  const seScrie = ciorna !== null;
  const textAfisat = ciorna ?? etichetaSelectat;

  const idListbox = useId();
  const idAvertisment = `${id}-avertisment`;
  const rezultate = filtreazaCaen(ciorna ?? "", new Set());

  /** Fixează codul: caseta afișează de acum „nr — denumire”, din `value`. */
  function comite(c: CodCaen): void {
    onChange(c.cod);
    setCiorna(null);
    setAvertisment(undefined);
    setDeschis(false);
  }

  /** Textul scris de mână devine cod la ieșirea din câmp (sau la Enter). */
  function confirmaTextul(): void {
    if (ciorna === null) return;
    const scris = ciorna.trim();
    if (scris === "") {
      onChange("");
      setCiorna(null);
      setAvertisment(undefined);
      return;
    }
    const rezolvat = rezolvaCaen(scris, new Set());
    if (rezolvat !== undefined) {
      comite(rezolvat);
      return;
    }
    // Nerecunoscut: caseta revine la codul comis, ca să nu rămână afișat un
    // text care nu corespunde valorii trimise mai departe.
    setCiorna(null);
    setAvertisment(
      etichetaSelectat === ""
        ? `„${scris}” nu corespunde niciunui cod din nomenclator.`
        : `„${scris}” nu corespunde niciunui cod din nomenclator — am păstrat ${selectat?.cod}.`,
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
          placeholder="Scrie codul sau denumirea (ex. 6210, agricultură)"
          onFocus={(e) => {
            setDeschis(true);
            setIndiceActiv(FARA_RAND_ACTIV);
            setCiorna(null);
            // Selectat tot: prima tastă rescrie codul, dar dacă utilizatorul
            // doar trece prin câmp, eticheta rămâne intactă.
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
              // Enter alege rândul evidențiat; dacă niciunul nu e evidențiat,
              // încearcă textul scris de mână. Fără nimic de făcut, tasta
              // merge mai departe (trimiterea formularului).
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
            mesajGol="Niciun cod CAEN găsit."
          />
        )}
      </div>
      <Avertisment id={idAvertisment} mesaj={avertisment} />
    </div>
  );
}

interface ProprietatiSecundare {
  readonly value: readonly string[];
  readonly onChange: (coduri: readonly string[]) => void;
  readonly exclude?: string | undefined;
  readonly max: number | null;
  readonly id: string;
  readonly ariaInvalid?: boolean;
}

export function SelectorCodCaenSecundare({
  value,
  onChange,
  exclude,
  max,
  id,
  ariaInvalid,
}: ProprietatiSecundare) {
  const [interogare, setInterogare] = useState("");
  const [deschis, setDeschis] = useState(false);
  const [indiceActiv, setIndiceActiv] = useState(FARA_RAND_ACTIV);
  const [avertisment, setAvertisment] = useState<string | undefined>(undefined);
  const idListbox = useId();
  const idAvertisment = `${id}-avertisment`;

  const excluse = new Set(value);
  if (exclude !== undefined && exclude !== "") excluse.add(exclude);
  const laLimita = max !== null && value.length >= max;
  const rezultate = laLimita ? [] : filtreazaCaen(interogare, excluse);

  function adauga(c: CodCaen): void {
    if (excluse.has(c.cod)) {
      setInterogare("");
      setAvertisment(
        c.cod === exclude
          ? `${c.cod} este deja codul principal.`
          : `${c.cod} este deja în lista de coduri secundare.`,
      );
      return;
    }
    onChange([...value, c.cod]);
    setInterogare("");
    setIndiceActiv(FARA_RAND_ACTIV);
    setAvertisment(undefined);
  }

  function elimina(cod: string): void {
    onChange(value.filter((v) => v !== cod));
    setAvertisment(undefined);
  }

  /** Textul scris de mână devine cod adăugat, fără clic în listă. */
  function confirmaTextul(): void {
    const scris = interogare.trim();
    if (scris === "") return;
    const rezolvat = rezolvaCaen(scris, excluse);
    if (rezolvat !== undefined) {
      adauga(rezolvat);
      return;
    }
    setInterogare("");
    setAvertisment(`„${scris}” nu corespunde niciunui cod din nomenclator.`);
  }

  return (
    <div className="space-y-2">
      <div
        className="relative"
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
          aria-describedby={avertisment !== undefined ? idAvertisment : undefined}
          disabled={laLimita}
          value={interogare}
          placeholder={
            laLimita
              ? "Limită atinsă pentru forma juridică aleasă"
              : "Scrie codul sau denumirea, ori alege din listă…"
          }
          onFocus={() => {
            setDeschis(true);
            setIndiceActiv(FARA_RAND_ACTIV);
          }}
          onChange={(e) => {
            setInterogare(e.target.value);
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
              // Vezi nota de la selectorul principal: Enter „gol” nu adaugă
              // din greșeală primul cod din nomenclator.
              const ales = deschis && indiceActiv >= 0 ? rezultate[indiceActiv] : undefined;
              if (ales !== undefined) {
                e.preventDefault();
                adauga(ales);
              } else if (interogare.trim() !== "") {
                e.preventDefault();
                confirmaTextul();
              }
            } else if (e.key === "Escape") {
              setDeschis(false);
              setIndiceActiv(FARA_RAND_ACTIV);
              setInterogare("");
              setAvertisment(undefined);
            }
          }}
          className={CLASA_CAMP + (laLimita ? " cursor-not-allowed opacity-60" : "")}
        />
        {deschis && !laLimita && (
          <ListaRezultate
            rezultate={rezultate}
            indiceActiv={indiceActiv}
            onAlege={adauga}
            idListbox={idListbox}
            mesajGol="Niciun cod CAEN găsit."
          />
        )}
      </div>
      <Avertisment id={idAvertisment} mesaj={avertisment} />
      <p className="text-muted-foreground text-xs">
        {value.length} {max === null ? "coduri (nelimitat)" : `din ${max} coduri folosite`}
      </p>
      {value.length > 0 && (
        <ul className="border-border divide-border divide-y rounded-md border">
          {value.map((cod) => {
            const info = NOMENCLATOR_CAEN.find((c) => c.cod === cod);
            return (
              <li key={cod} className="flex items-baseline gap-3 px-3 py-2 text-sm">
                <span className="text-foreground shrink-0 font-mono font-medium">{cod}</span>
                <span className="text-muted-foreground flex-1">
                  {info?.denumire ?? "Cod necunoscut în nomenclator"}
                </span>
                <button
                  type="button"
                  onClick={() => elimina(cod)}
                  aria-label={`Elimină codul ${cod}`}
                  title={`Elimină codul ${cod}`}
                  className="text-muted-foreground hover:text-danger shrink-0 text-base leading-none"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

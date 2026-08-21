// src/components/forms/selector-cod-caen.tsx
"use client";

import { useId, useRef, useState } from "react";
import { NOMENCLATOR_CAEN, type CodCaen } from "@/domain/organization/caen-nomenclator";

function normalizeaza(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const LIMITA_REZULTATE = 20;

/** Filtrare cod SAU denumire, fără diacritice; exclude codurile deja alese. */
export function filtreazaCaen(
  interogare: string,
  exclude: ReadonlySet<string>,
): readonly CodCaen[] {
  const termen = normalizeaza(interogare.trim());
  const sursa =
    termen.length === 0
      ? NOMENCLATOR_CAEN
      : NOMENCLATOR_CAEN.filter(
          (c) => c.cod.startsWith(termen) || normalizeaza(c.denumire).includes(termen),
        );
  const rezultat: CodCaen[] = [];
  for (const c of sursa) {
    if (exclude.has(c.cod)) continue;
    rezultat.push(c);
    if (rezultat.length >= LIMITA_REZULTATE) break;
  }
  return rezultat;
}

const CLASA_CAMP =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

function ListaRezultate({
  rezultate,
  indiceActiv,
  onAlege,
  idListbox,
}: Readonly<{
  rezultate: readonly CodCaen[];
  indiceActiv: number;
  onAlege: (cod: CodCaen) => void;
  idListbox: string;
}>) {
  if (rezultate.length === 0) {
    return (
      <div className="border-border bg-surface text-muted-foreground absolute z-10 mt-1 w-full rounded-md border p-2 text-sm shadow-md">
        Niciun cod CAEN găsit.
      </div>
    );
  }
  return (
    <ul
      id={idListbox}
      role="listbox"
      className="border-border bg-surface absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border shadow-md"
    >
      {rezultate.map((c, index) => (
        <li key={c.cod}>
          <button
            type="button"
            role="option"
            aria-selected={index === indiceActiv}
            onMouseDown={(e) => {
              e.preventDefault(); // păstrează focusul pe input, nu-l fură butonul
              onAlege(c);
            }}
            className={
              "flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm " +
              (index === indiceActiv ? "bg-primary/10" : "hover:bg-primary/5")
            }
          >
            <span className="text-foreground font-mono font-medium">{c.cod}</span>
            <span className="text-muted-foreground">{c.denumire}</span>
          </button>
        </li>
      ))}
    </ul>
  );
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
  const selectat = value !== undefined ? NOMENCLATOR_CAEN.find((c) => c.cod === value) : undefined;
  const etichetaSelectat = selectat !== undefined ? `${selectat.cod} — ${selectat.denumire}` : "";

  const [interogare, setInterogare] = useState(etichetaSelectat);
  const [deschis, setDeschis] = useState(false);
  const [indiceActiv, setIndiceActiv] = useState(0);
  // Reține ultima etichetă „văzută” ca să detecteze o schimbare de `value`
  // venită din afara componentei (selecție, încărcare organizație existentă)
  // și să resincronizeze textul afișat — ajustare de stare în timpul
  // randării (tiparul recomandat de React pentru asta), nu într-un efect:
  // sursa bugului era exact că sincronizarea depindea de ordinea în care se
  // propagau `setState`-urile locale față de `onChange` al părintelui.
  const [etichetaAnterioara, setEtichetaAnterioara] = useState(etichetaSelectat);
  if (etichetaSelectat !== etichetaAnterioara) {
    setEtichetaAnterioara(etichetaSelectat);
    if (!deschis) setInterogare(etichetaSelectat);
  }
  const idListbox = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const rezultate = filtreazaCaen(interogare, new Set());

  function alege(c: CodCaen): void {
    onChange(c.cod);
    setDeschis(false);
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDeschis(false);
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
        value={interogare}
        placeholder="Scrie codul sau denumirea (ex. 6210, agricultură)"
        onFocus={() => {
          setDeschis(true);
          setInterogare("");
        }}
        onChange={(e) => {
          setInterogare(e.target.value);
          setIndiceActiv(0);
          setDeschis(true);
        }}
        onKeyDown={(e) => {
          if (!deschis) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndiceActiv((i) => Math.min(rezultate.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndiceActiv((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const ales = rezultate[indiceActiv];
            if (ales !== undefined) alege(ales);
          } else if (e.key === "Escape") {
            setDeschis(false);
          }
        }}
        className={CLASA_CAMP}
      />
      {deschis && (
        <ListaRezultate
          rezultate={rezultate}
          indiceActiv={indiceActiv}
          onAlege={alege}
          idListbox={idListbox}
        />
      )}
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
  const [indiceActiv, setIndiceActiv] = useState(0);
  const idListbox = useId();

  const excluse = new Set(value);
  if (exclude !== undefined) excluse.add(exclude);
  const laLimita = max !== null && value.length >= max;
  const rezultate = laLimita ? [] : filtreazaCaen(interogare, excluse);

  function adauga(c: CodCaen): void {
    onChange([...value, c.cod]);
    setInterogare("");
  }
  function elimina(cod: string): void {
    onChange(value.filter((v) => v !== cod));
  }

  return (
    <div className="space-y-2">
      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setDeschis(false);
        }}
      >
        <input
          id={id}
          role="combobox"
          aria-expanded={deschis}
          aria-controls={idListbox}
          aria-autocomplete="list"
          aria-invalid={ariaInvalid}
          disabled={laLimita}
          value={interogare}
          placeholder={
            laLimita ? "Limită atinsă pentru forma juridică aleasă" : "Adaugă un cod secundar…"
          }
          onFocus={() => setDeschis(true)}
          onChange={(e) => {
            setInterogare(e.target.value);
            setIndiceActiv(0);
            setDeschis(true);
          }}
          onKeyDown={(e) => {
            if (!deschis) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndiceActiv((i) => Math.min(rezultate.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndiceActiv((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const ales = rezultate[indiceActiv];
              if (ales !== undefined) adauga(ales);
            } else if (e.key === "Escape") {
              setDeschis(false);
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
          />
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        {value.length} {max === null ? "coduri (nelimitat)" : `din ${max} coduri folosite`}
      </p>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((cod) => {
            const info = NOMENCLATOR_CAEN.find((c) => c.cod === cod);
            return (
              <li
                key={cod}
                className="bg-primary/10 text-foreground flex items-center gap-2 rounded-full px-3 py-1 text-xs"
              >
                <span className="font-mono font-medium">{cod}</span>
                {info !== undefined && (
                  <span className="text-muted-foreground">{info.denumire}</span>
                )}
                <button
                  type="button"
                  onClick={() => elimina(cod)}
                  aria-label={`Elimină codul ${cod}`}
                  className="text-muted-foreground hover:text-danger"
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

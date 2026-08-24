// src/app/(app)/departamente/vizualizare-organigrama.tsx
import { Users } from "lucide-react";

import { AvatarAngajat } from "@/components/data/avatar-angajat";

import type { NodDepartament } from "./tipuri";

/**
 * Organigrama de DEPARTAMENTE.
 *
 * ── NU E ORGANIGRAMA DE PERSOANE ──────────────────────────────────────────
 * `/organigrama` desenează ierarhia MANAGERIALĂ, din `manager_employee_id` de pe
 * fișa fiecărui angajat. Asta desenează ierarhia STRUCTURALĂ, din `parent_id`
 * de pe departament. Sunt două arborescențe independente, care se pot contrazice
 * legitim: un om poate raporta la cineva din alt departament. De aceea niciuna
 * nu se poate deduce din cealaltă, și de aceea au ecrane separate.
 *
 * ── LINIILE NU SUNT DESENATE AICI ─────────────────────────────────────────
 * Conectorii vin din `.og-radacina` / `.og-ramura`, CSS pur deja existent în
 * `globals.css`, scris pentru organigrama de persoane. Sunt `::before`/`::after`
 * pe fiecare `<li>`, tăiate condiționat prin `:first-child`/`:last-child`/
 * `:only-child`, în `var(--color-border)`. Nu se rescrie nimic: aceeași formă
 * cere aceleași linii.
 *
 * ── PĂTRATUL E BUTON, NU LINK ─────────────────────────────────────────────
 * Un link ar duce undeva; aici clicul deschide panoul de lucru, adică schimbă
 * starea paginii curente. Un `<a>` care nu navighează minte tastatura și
 * cititorul de ecran.
 */

const MAXIM_AVATARE = 3;

function Patrat({
  nod,
  laDeschiderePanou,
}: {
  readonly nod: NodDepartament;
  readonly laDeschiderePanou: (id: string) => void;
}) {
  const d = nod.date;
  const vizibile = d.persoane.slice(0, MAXIM_AVATARE);
  const restul = d.persoane.length - vizibile.length;
  const areSubordonate = nod.efectivCumulat !== nod.efectivDirect;

  return (
    <button
      type="button"
      onClick={() => {
        laDeschiderePanou(d.id);
      }}
      className={`border-border bg-background hover:border-primary/40 hover:bg-surface rounded-panou shadow-ridicat flex w-32 flex-col items-center gap-1.5 border px-2.5 py-3 text-center transition-colors active:translate-y-px sm:w-40 sm:px-3 ${
        d.activ ? "" : "hasura"
      }`}
    >
      <span className="text-muted-foreground text-nota font-mono">{d.cod}</span>

      <span className="text-corp leading-tight font-medium text-balance">{d.denumire}</span>

      <span className="text-cifra text-primary font-mono leading-none tabular-nums">
        {nod.efectivDirect}
      </span>
      <span className="text-muted-foreground text-nota leading-tight">
        {nod.efectivDirect === 1 ? "angajat" : "angajați"}
        {areSubordonate ? ` · ${String(nod.efectivCumulat)} cu subordonatele` : ""}
      </span>

      {d.manager === null ? (
        <span className="text-muted-foreground text-nota italic">manager nedesemnat</span>
      ) : (
        <span className="text-muted-foreground text-nota inline-flex items-center gap-1 leading-tight">
          <AvatarAngajat url={d.manager.avatar_url} nume={d.manager.full_name} marime="sm" />
          <span className="truncate">{d.manager.full_name}</span>
        </span>
      )}

      {vizibile.length === 0 ? null : (
        <span className="mt-0.5 flex items-center">
          <span className="flex -space-x-2">
            {vizibile.map((p) => (
              <span key={p.id} className="ring-background rounded-full ring-2">
                <AvatarAngajat url={p.avatar_url} nume={p.full_name} marime="sm" />
              </span>
            ))}
          </span>
          {restul > 0 ? (
            <span className="text-muted-foreground text-nota ml-1.5 tabular-nums">+{restul}</span>
          ) : null}
        </span>
      )}

      {d.activ ? null : <span className="text-muted-foreground text-nota">Inactiv</span>}

      <span className="sr-only">
        <Users aria-hidden="true" /> Deschide lista persoanelor din {d.denumire}.
      </span>
    </button>
  );
}

function Ramura({
  noduri,
  nivel,
  laDeschiderePanou,
}: {
  readonly noduri: readonly NodDepartament[];
  readonly nivel: number;
  readonly laDeschiderePanou: (id: string) => void;
}) {
  return (
    <ul className={nivel === 1 ? "og-radacina" : "og-ramura"}>
      {noduri.map((nod) => (
        <li key={nod.date.id}>
          <Patrat nod={nod} laDeschiderePanou={laDeschiderePanou} />
          {nod.copii.length > 0 ? (
            <Ramura noduri={nod.copii} nivel={nivel + 1} laDeschiderePanou={laDeschiderePanou} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function VizualizareOrganigrama({
  noduri,
  laDeschiderePanou,
}: {
  readonly noduri: readonly NodDepartament[];
  readonly laDeschiderePanou: (id: string) => void;
}) {
  return (
    // Derularea orizontală e a acestui bloc, niciodată a documentului. Bleed-ul
    // `-mx-4 px-4` îi dă toată lățimea ecranului pe telefon, fără să scoată
    // pagina din marginile ei.
    <div className="-mx-4 overflow-x-auto px-4 pb-4">
      <div className="w-fit min-w-full">
        <Ramura noduri={noduri} nivel={1} laDeschiderePanou={laDeschiderePanou} />
      </div>
    </div>
  );
}

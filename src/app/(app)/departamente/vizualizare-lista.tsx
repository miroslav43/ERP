// src/app/(app)/departamente/vizualizare-lista.tsx
import Link from "next/link";
import { Building2, Users } from "lucide-react";

import { AvatarAngajat } from "@/components/data/avatar-angajat";
import { Badge } from "@/components/ui/badge";

import { ActiuniDepartament } from "./actiuni-departament";
import type { NodDepartament, OptiuneAngajat, OptiuneDepartament } from "./tipuri";
import type { PersoanaPanou } from "./panou-departament";

/**
 * Vizualizarea listă a structurii.
 *
 * ── CE S-A SCHIMBAT FAȚĂ DE VARIANTA VECHE ────────────────────────────────
 * Fiecare card avea un `<details>` cu lista completă de angajați înăuntru. La o
 * organizație cu douăzeci de departamente, desfacerea a două-trei dintre ele
 * împingea restul structurii afară din ecran, iar cardurile aveau înălțimi
 * complet diferite. Acum lista de oameni trăiește în panou, iar cardul arată o
 * STIVĂ DE AVATARE: se vede cine e acolo dintr-o privire, fără să desfaci nimic,
 * și cardul rămâne de înălțime fixă.
 *
 * Nou pe card: efectivul CUMULAT, cu tot cu subordonate. Cifra nu exista
 * nicăieri, deși e singura care răspunde la „cât de mare e divizia asta".
 *
 * ── DE CE NU `role="tree"` ────────────────────────────────────────────────
 * Motivul e neschimbat de la varianta veche și rămâne valabil: pattern-ul ARIA
 * de tip tree interzice descendenți interactivi, iar în fiecare nod stau
 * link-uri și butoane. O listă imbricată obișnuită spune adevărul — ierarhia se
 * citește din structura `ul`, iar interactivele rămân navigabile cu Tab.
 */

const MAXIM_AVATARE = 5;

function StivaAvatare({ persoane }: { readonly persoane: readonly PersoanaPanou[] }) {
  if (persoane.length === 0) return null;
  const vizibile = persoane.slice(0, MAXIM_AVATARE);
  const restul = persoane.length - vizibile.length;
  return (
    <span className="flex items-center">
      <span className="flex -space-x-2">
        {vizibile.map((p) => (
          <span key={p.id} className="ring-surface rounded-full ring-2" title={p.full_name}>
            <AvatarAngajat url={p.avatar_url} nume={p.full_name} marime="sm" />
          </span>
        ))}
      </span>
      {restul > 0 ? (
        <span className="text-muted-foreground text-nota ml-2 font-medium tabular-nums">
          +{restul}
        </span>
      ) : null}
    </span>
  );
}

function Card({
  nod,
  departamente,
  angajati,
  poateEdita,
  poateMutaPersoane,
  laDeschiderePanou,
}: {
  readonly nod: NodDepartament;
  readonly departamente: readonly OptiuneDepartament[];
  readonly angajati: readonly OptiuneAngajat[];
  readonly poateEdita: boolean;
  readonly poateMutaPersoane: boolean;
  readonly laDeschiderePanou: (id: string) => void;
}) {
  const d = nod.date;
  const areSubordonate = nod.efectivCumulat !== nod.efectivDirect;

  return (
    <div
      className={`border-border bg-surface rounded-panou shadow-ridicat overflow-hidden border ${
        d.activ ? "" : "hasura"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="bg-background rounded-control flex size-9 shrink-0 items-center justify-center">
          <Building2 aria-hidden="true" className="text-primary size-4.5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-corp font-medium">{d.denumire}</span>
            <span className="text-muted-foreground text-nota font-mono">{d.cod}</span>
            {d.activ ? null : <Badge ton="neutru">Inactiv</Badge>}
            {d.cost_center === null ? null : (
              <span className="text-muted-foreground text-nota font-mono">{d.cost_center}</span>
            )}
          </span>
          <span className="text-corp mt-1 flex items-center gap-1.5">
            {d.manager === null ? (
              <span className="text-muted-foreground italic">manager nedesemnat</span>
            ) : (
              <Link
                href={`/angajati/${d.manager_employee_id ?? ""}`}
                className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5"
              >
                <AvatarAngajat url={d.manager.avatar_url} nume={d.manager.full_name} marime="sm" />
                {d.manager.full_name}
              </Link>
            )}
            {/*
              Semnul stă lângă NUME, nu într-o coloană separată: întrebarea pe
              care o răspunde — „de ce nu vede omul ăsta pontajul echipei?" —
              apare uitându-te la el, nu scanând un tabel.
            */}
            {d.sefFaraRolDeManager ? (
              <span
                className="text-warning text-nota"
                title="Conduce departamentul, dar în aplicație are rolul Angajat: nu vede pontajul echipei și nu îi poate aproba concediile. Rolul se schimbă de un administrator, din fișa lui → Permisiuni."
              >
                · rol de Angajat
              </span>
            ) : null}
          </span>
        </span>

        <StivaAvatare persoane={d.persoane} />

        <button
          type="button"
          onClick={() => {
            laDeschiderePanou(d.id);
          }}
          className="border-foreground/60 rounded-control text-nota hover:bg-background inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1 font-medium transition-colors active:translate-y-px"
        >
          <Users aria-hidden="true" className="size-3.5" />
          <span className="tabular-nums">{nod.efectivDirect}</span>
          {areSubordonate ? (
            <span className="text-muted-foreground tabular-nums">/ {nod.efectivCumulat}</span>
          ) : null}
          <span className="sr-only">
            {areSubordonate
              ? `angajați direct în departament, din ${String(nod.efectivCumulat)} cu tot cu subordonate. Deschide lista.`
              : "angajați în acest departament. Deschide lista."}
          </span>
        </button>
      </div>

      {poateEdita || poateMutaPersoane ? (
        <div className="border-border bg-background border-t px-4 py-2">
          <ActiuniDepartament
            departament={{
              id: d.id,
              denumire: d.denumire,
              descriere: d.descriere,
              parent_id: d.parent_id,
              manager_employee_id: d.manager_employee_id,
              cost_center: d.cost_center,
              numarAngajati: nod.efectivDirect,
              activ: d.activ,
            }}
            departamente={departamente}
            angajati={angajati}
            poateEdita={poateEdita}
          />
        </div>
      ) : null}
    </div>
  );
}

export function VizualizareLista({
  noduri,
  nivel,
  departamente,
  angajati,
  poateEdita,
  poateMutaPersoane,
  laDeschiderePanou,
}: {
  readonly noduri: readonly NodDepartament[];
  readonly nivel: number;
  readonly departamente: readonly OptiuneDepartament[];
  readonly angajati: readonly OptiuneAngajat[];
  readonly poateEdita: boolean;
  readonly poateMutaPersoane: boolean;
  readonly laDeschiderePanou: (id: string) => void;
}) {
  return (
    <ul
      className={
        nivel === 1
          ? "space-y-3"
          : "border-primary/15 mt-3 ml-3 space-y-3 border-l-2 pl-3 sm:ml-6 sm:pl-5"
      }
    >
      {noduri.map((nod) => (
        <li key={nod.date.id}>
          <Card
            nod={nod}
            departamente={departamente}
            angajati={angajati}
            poateEdita={poateEdita}
            poateMutaPersoane={poateMutaPersoane}
            laDeschiderePanou={laDeschiderePanou}
          />
          {nod.copii.length > 0 ? (
            <VizualizareLista
              noduri={nod.copii}
              nivel={nivel + 1}
              departamente={departamente}
              angajati={angajati}
              poateEdita={poateEdita}
              poateMutaPersoane={poateMutaPersoane}
              laDeschiderePanou={laDeschiderePanou}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

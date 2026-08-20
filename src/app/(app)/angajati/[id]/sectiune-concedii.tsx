// src/app/(app)/angajati/[id]/sectiune-concedii.tsx
// Secțiune read-only: dreptul de concediu al angajatului, așa cum rezultă din
// regula companiei (`/concedii/setari`), nu un formular. Editarea se face de
// acolo, niciodată de pe fișa individuală a angajatului.

import Link from "next/link";

import { formatAmount } from "@/lib/format/money";
import { todayInBucharest } from "@/lib/format/date";
import {
  configurareConcedii,
  grupeazaSoldDupaAngajat,
  imperecheazaSold,
  soldAnual,
  type RegulaConcediuRand,
  type TipConcediu,
} from "@/lib/queries/leave";
import {
  regulileAplicabile,
  type AngajatPentruDrept,
  type RegulaConcediu,
} from "@/domain/leave/drepturi";
import {
  ETICHETE_CRITERIU_GRILA,
  ETICHETE_VALOARE_CONDITII_MUNCA,
  ETICHETE_VALOARE_GRAD_HANDICAP,
} from "@/app/(app)/concedii/etichete";

function laData(valoare: string | null): Date | null {
  if (valoare === null) return null;
  const parti = valoare.split("-");
  return new Date(Date.UTC(Number(parti[0]), Number(parti[1]) - 1, Number(parti[2])));
}

function laDataObligatorie(valoare: string): Date {
  const data = laData(valoare);
  if (data === null) throw new RangeError(`Dată invalidă: ${valoare}`);
  return data;
}

function laRegulaDomeniu(rand: RegulaConcediuRand): RegulaConcediu {
  return {
    tipCriteriu: rand.tip_criteriu,
    vechimeAniMin: rand.vechime_ani_min,
    valoareText: rand.valoare_text,
    departmentId: rand.department_id,
    jobPositionId: rand.job_position_id,
    zileSuplimentare: rand.zile_suplimentare,
    activ: rand.activ,
    valabilDeLa: laDataObligatorie(rand.valabil_de_la),
    valabilPanaLa: laData(rand.valabil_pana_la),
  };
}

function descrieRegula(
  regula: RegulaConcediuRand,
  hartaDepartamente: ReadonlyMap<string, string>,
  hartaFunctii: ReadonlyMap<string, string>,
): string {
  switch (regula.tip_criteriu) {
    case "vechime":
      return `vechime ≥ ${String(regula.vechime_ani_min ?? 0)} ani`;
    case "conditii_munca":
      return (
        ETICHETE_VALOARE_CONDITII_MUNCA[regula.valoare_text ?? ""] ?? "condiții de muncă"
      ).toLowerCase();
    case "grad_handicap":
      return (
        ETICHETE_VALOARE_GRAD_HANDICAP[regula.valoare_text ?? ""] ?? "grad de handicap"
      ).toLowerCase();
    case "varsta_sub_18":
      return "sub 18 ani";
    case "departament":
      return `departament: ${hartaDepartamente.get(regula.department_id ?? "") ?? "—"}`;
    case "functie":
      return `funcție: ${hartaFunctii.get(regula.job_position_id ?? "") ?? "—"}`;
    default:
      return ETICHETE_CRITERIU_GRILA[regula.tip_criteriu];
  }
}

/**
 * Regulile care chiar contribuie la dreptul PE ACEST TIP, pentru descriere.
 * `regulileAplicabile` filtrează pe obiecte-domeniu (Date, câmpuri în engleză);
 * indexul le leagă înapoi de rândul original din bază, ca `descrieRegula` să
 * poată citi `valoare_text`/`department_id` fără o a doua conversie.
 */
function reguliCareContribuie(
  reguliTip: readonly RegulaConcediuRand[],
  angajat: AngajatPentruDrept,
  an: number,
): readonly RegulaConcediuRand[] {
  const domenii = reguliTip.map(laRegulaDomeniu);
  const aplicabile = new Set(regulileAplicabile(domenii, angajat, an));
  return reguliTip.filter((_, index) => aplicabile.has(domenii[index] as RegulaConcediu));
}

interface RandAfisat {
  readonly tip: TipConcediu;
  readonly dreptAfisat: number;
  readonly regulileOriginale: readonly RegulaConcediuRand[];
}

interface Proprietati {
  readonly organizationId: string;
  readonly employeeId: string;
  readonly hiredOn: string | null;
  readonly dataNasterii: string | null;
  readonly conditiiMunca: string;
  readonly gradHandicap: string | null;
  readonly departmentId: string | null;
  readonly jobPositionId: string | null;
  /** `leave:read = all` — fără el se văd cifrele, dar nu și motivul lor. */
  readonly poateVedeaRegulile: boolean;
}

export async function SectiuneConcedii({
  organizationId,
  employeeId,
  hiredOn,
  dataNasterii,
  conditiiMunca,
  gradHandicap,
  departmentId,
  jobPositionId,
  poateVedeaRegulile,
}: Proprietati) {
  const anCurent = Number(todayInBucharest().slice(0, 4));
  const angajat: AngajatPentruDrept = {
    hiredOn: laData(hiredOn),
    dataNasterii: laData(dataNasterii),
    conditiiMunca,
    gradHandicap,
    departmentId,
    jobPositionId,
  };

  const [{ tipuri, solduri }, configurare] = await Promise.all([
    soldAnual(organizationId, anCurent),
    poateVedeaRegulile
      ? configurareConcedii(organizationId)
      : Promise.resolve({
          reguli: [] as readonly RegulaConcediuRand[],
          departamente: [],
          functii: [],
        }),
  ]);

  if (tipuri.length === 0) return null;

  const hartaDepartamente = new Map(configurare.departamente.map((d) => [d.id, d.denumire]));
  const hartaFunctii = new Map(configurare.functii.map((f) => [f.id, f.denumire]));

  const randuri: readonly RandAfisat[] = imperecheazaSold(
    tipuri,
    grupeazaSoldDupaAngajat(solduri).get(employeeId) ?? [],
  ).map(({ tip, sold }) => ({
    tip,
    dreptAfisat: sold?.drept_anual ?? tip.zile_implicite,
    regulileOriginale: poateVedeaRegulile
      ? reguliCareContribuie(
          configurare.reguli.filter((r) => r.leave_type_id === tip.id),
          angajat,
          anCurent,
        )
      : [],
  }));

  return (
    <section
      aria-labelledby="titlu-concedii"
      className="border-border bg-surface rounded-lg border p-5 shadow-sm"
    >
      <h2 id="titlu-concedii" className="mb-1 text-lg font-medium">
        Concedii
      </h2>
      <p className="text-muted-foreground mb-4 text-sm">
        Dreptul anual pentru {String(anCurent)}, rezultat din regula companiei.{" "}
        <Link href="/concedii/setari" className="underline underline-offset-2">
          Editați regulile
        </Link>
        .
      </p>
      <ul className="space-y-2">
        {randuri.map(({ tip, dreptAfisat, regulileOriginale }) => (
          <li
            key={tip.id}
            className="border-border flex flex-wrap items-baseline justify-between gap-2 border-t pt-2 first:border-t-0 first:pt-0"
          >
            <span className="flex items-center gap-2 text-sm">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: tip.culoare }}
                aria-hidden="true"
              />
              {tip.denumire}
            </span>
            <span className="text-right text-sm">
              <span className="font-medium tabular-nums">{formatAmount(dreptAfisat)} zile</span>
              {regulileOriginale.length === 0 ? null : (
                <span className="text-muted-foreground ml-2 text-xs">
                  ({formatAmount(tip.zile_implicite)} bază
                  {regulileOriginale
                    .map(
                      (r) =>
                        ` + ${formatAmount(r.zile_suplimentare)} ${descrieRegula(r, hartaDepartamente, hartaFunctii)}`,
                    )
                    .join("")}
                  )
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

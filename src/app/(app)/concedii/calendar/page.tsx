// src/app/(app)/concedii/calendar/page.tsx
//
// Calendarul de concedii, în două forme ale ACELORAȘI date:
//   • `planificator` (implicit) — un rând per angajat, o coloană per zi;
//   • `grila`                   — luna în săptămâni, absențele adunate în ziua lor.
//
// Ruta e una singură, deliberat. Două rute ar fi însemnat două antete, două
// file de navigare și două seturi de parametri de lună care se despart la
// prima modificare. Vederea trăiește în URL (`?vedere=`), deci se poate pune la
// favorite și supraviețuiește lui „înapoi".
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatMonthYear, todayInBucharest } from "@/lib/format/date";
import { angajatiPlanificator, calendarLunii, zileNelucratoare } from "@/lib/queries/leave";
import {
  cheieCelula,
  stareDinStatus,
  zilelePlanificatorului,
  type AbsentaCelula,
} from "@/domain/leave/planificator";

import { ButonSetariConcedii } from "../buton-setari";
import { NavConcedii } from "../nav-concedii";
import { GrilaCalendar, type EvenimentZiCalendar } from "./grila-calendar";
import { NavigareLuna } from "./navigare-luna";
import { PlanificatorConcedii, type RandAngajatPlanificator } from "./planificator-concedii";
import { VEDERI_CALENDAR, vedereDinParametru } from "./vedere";

export const metadata: Metadata = { title: "Calendarul de concedii" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function primaZiLunii(an: number, luna: number): string {
  return `${String(an)}-${String(luna).padStart(2, "0")}-01`;
}

function ultimaZiLunii(an: number, luna: number): string {
  const ziuaFinala = new Date(Date.UTC(an, luna, 0)).getUTCDate();
  return `${String(an)}-${String(luna).padStart(2, "0")}-${String(ziuaFinala).padStart(2, "0")}`;
}

function parametrulNumeric(valoare: string | string[] | undefined): number | null {
  const brut = Array.isArray(valoare) ? valoare[0] : valoare;
  if (brut === undefined) return null;
  const numar = Number(brut);
  return Number.isInteger(numar) ? numar : null;
}

export default async function PaginaCalendarConcedii({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "leave"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "leave:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta calendarul de echipă. Această secțiune este rezervată managerilor și personalului de resurse umane." />
    );
  }

  const poateAproba = can(permisiuni, "leave:approve", "team");
  const poateConfigura = can(permisiuni, "leave:update", "all");
  const parametri = await searchParams;
  const azi = todayInBucharest();
  const anCurent = parametrulNumeric(parametri["an"]) ?? Number(azi.slice(0, 4));
  const lunaBruta = parametrulNumeric(parametri["luna"]) ?? Number(azi.slice(5, 7));
  const luna = lunaBruta < 1 || lunaBruta > 12 ? Number(azi.slice(5, 7)) : lunaBruta;
  const vedere = vedereDinParametru(parametri["vedere"]);

  const primaZi = primaZiLunii(anCurent, luna);
  const ultimaZi = ultimaZiLunii(anCurent, luna);

  // Rândurile planificatorului și zilele nelucrătoare se citesc DOAR pentru
  // vederea care le folosește: grila lunară nu are rânduri fixe și nu umbrește
  // weekendul, deci cele două cereri ar fi fost muncă aruncată la fiecare
  // afișare a ei.
  const [randuri, angajatiRanduri, nelucratoare] = await Promise.all([
    calendarLunii(tenant.organizationId, primaZi, ultimaZi),
    vedere === "planificator"
      ? angajatiPlanificator(tenant.organizationId, primaZi, ultimaZi)
      : Promise.resolve([]),
    vedere === "planificator"
      ? zileNelucratoare(tenant.organizationId, anCurent, anCurent)
      : Promise.resolve({ nationale: [], organizatie: [] }),
  ]);

  // Angajatul și tipul vin deja traduși din `calendarLunii`, prin embed
  // imbricat PostgREST — nu mai există aici un al doilea val de interogări
  // care să le traducă din id-uri. Un embed to-one filtrat de RLS întoarce
  // NULL, nu elimină rândul, deci ambele rămân opționale.
  const zileHarta = new Map<string, EvenimentZiCalendar[]>();
  const celule = new Map<string, AbsentaCelula[]>();
  for (const rand of randuri) {
    if (rand.cerere === null) continue;
    const angajat = rand.cerere.angajat;
    const tip = rand.cerere.tip;
    const tipDenumire = tip?.denumire ?? "Concediu";
    const tipCuloare = tip?.culoare ?? "#94a3b8";

    const eveniment: EvenimentZiCalendar = {
      employeeLabel:
        angajat === null ? "Angajat" : `${angajat.full_name ?? angajat.marca} (${angajat.marca})`,
      tipDenumire,
      tipCuloare,
      status: rand.status,
    };
    const existent = zileHarta.get(rand.data);
    if (existent === undefined) zileHarta.set(rand.data, [eveniment]);
    else existent.push(eveniment);

    const cheie = cheieCelula(rand.cerere.employee_id, rand.data);
    const absenta: AbsentaCelula = {
      tipId: rand.cerere.leave_type_id,
      tipDenumire,
      tipCuloare,
      stare: stareDinStatus(rand.status),
    };
    const celulaExistenta = celule.get(cheie);
    if (celulaExistenta === undefined) celule.set(cheie, [absenta]);
    else celulaExistenta.push(absenta);
  }

  const zile = zilelePlanificatorului(
    anCurent,
    luna,
    nelucratoare.nationale.map((z) => z.data),
    nelucratoare.organizatie.filter((z) => z.tip === "liber_suplimentar").map((z) => z.data),
    nelucratoare.organizatie.filter((z) => z.tip === "zi_recuperare").map((z) => z.data),
  );
  const randuriAngajati: readonly RandAngajatPlanificator[] = angajatiRanduri.map((a) => ({
    id: a.id,
    nume: a.full_name ?? a.marca,
    marca: a.marca,
  }));

  const lunaAnterioara =
    luna === 1 ? { an: anCurent - 1, luna: 12 } : { an: anCurent, luna: luna - 1 };
  const lunaUrmatoare =
    luna === 12 ? { an: anCurent + 1, luna: 1 } : { an: anCurent, luna: luna + 1 };

  const descriereVedere =
    VEDERI_CALENDAR.find((v) => v.cheie === vedere)?.descriere ?? VEDERI_CALENDAR[0].descriere;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Calendarul de concedii"
        descriere={`${descriereVedere} ${formatMonthYear(anCurent, luna)}.`}
        {...(poateConfigura
          ? { actiuni: <ButonSetariConcedii poateConfigura={poateConfigura} /> }
          : {})}
        file={
          <NavConcedii
            poateVedeaEchipa={true}
            poateAproba={poateAproba}
            poateVedeaCalendar={true}
          />
        }
      />

      <NavigareLuna
        an={anCurent}
        luna={luna}
        vedere={vedere}
        lunaAnterioara={lunaAnterioara}
        lunaUrmatoare={lunaUrmatoare}
      />

      {vedere === "planificator" ? (
        <PlanificatorConcedii
          zile={zile}
          angajati={randuriAngajati}
          celule={Object.fromEntries(celule)}
          azi={azi}
        />
      ) : (
        <GrilaCalendar an={anCurent} luna={luna} zileHarta={Object.fromEntries(zileHarta)} />
      )}
    </div>
  );
}

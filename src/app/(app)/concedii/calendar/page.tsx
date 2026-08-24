// src/app/(app)/concedii/calendar/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatMonthYear, todayInBucharest } from "@/lib/format/date";
import { calendarLunii } from "@/lib/queries/leave";

import { NavConcedii } from "../nav-concedii";
import { GrilaCalendar, type EvenimentZiCalendar } from "./grila-calendar";

export const metadata: Metadata = { title: "Calendarul de concedii" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface AngajatMinim {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
}

interface TipMinim {
  readonly id: string;
  readonly denumire: string;
  readonly culoare: string;
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
  await requireFeature(tenant.organizationId, "leave");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

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

  const primaZi = primaZiLunii(anCurent, luna);
  const ultimaZi = ultimaZiLunii(anCurent, luna);

  const randuri = await calendarLunii(tenant.organizationId, primaZi, ultimaZi);

  const idAngajati = [
    ...new Set(
      randuri.map((r) => r.cerere?.employee_id).filter((id): id is string => id !== undefined),
    ),
  ];
  const idTipuri = [
    ...new Set(
      randuri.map((r) => r.cerere?.leave_type_id).filter((id): id is string => id !== undefined),
    ),
  ];

  const db = await createServerSupabase();
  const [{ data: angajati }, { data: tipuri }] = await Promise.all([
    idAngajati.length === 0
      ? Promise.resolve({ data: [] as AngajatMinim[] })
      : db
          .from("employees")
          .select("id, full_name, marca")
          .eq("organization_id", tenant.organizationId)
          .in("id", idAngajati)
          .returns<AngajatMinim[]>(),
    idTipuri.length === 0
      ? Promise.resolve({ data: [] as TipMinim[] })
      : db
          .from("leave_types")
          .select("id, denumire, culoare")
          .eq("organization_id", tenant.organizationId)
          .in("id", idTipuri)
          .returns<TipMinim[]>(),
  ]);
  const hartaAngajati = new Map((angajati ?? []).map((a) => [a.id, a]));
  const hartaTipuri = new Map((tipuri ?? []).map((t) => [t.id, t]));

  const zileHarta = new Map<string, EvenimentZiCalendar[]>();
  for (const rand of randuri) {
    if (rand.cerere === null) continue;
    const angajat = hartaAngajati.get(rand.cerere.employee_id);
    const tip = hartaTipuri.get(rand.cerere.leave_type_id);
    const eveniment: EvenimentZiCalendar = {
      employeeLabel: angajat === undefined ? "Angajat" : `${angajat.full_name} (${angajat.marca})`,
      tipDenumire: tip?.denumire ?? "Concediu",
      tipCuloare: tip?.culoare ?? "#94a3b8",
      status: rand.status,
    };
    const existent = zileHarta.get(rand.data);
    if (existent === undefined) zileHarta.set(rand.data, [eveniment]);
    else existent.push(eveniment);
  }

  const lunaAnterioara =
    luna === 1 ? { an: anCurent - 1, luna: 12 } : { an: anCurent, luna: luna - 1 };
  const lunaUrmatoare =
    luna === 12 ? { an: anCurent + 1, luna: 1 } : { an: anCurent, luna: luna + 1 };

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Calendarul de concedii</h1>
        <p className="text-muted-foreground text-sm">
          Grila lunară a absențelor de echipă, pentru {formatMonthYear(anCurent, luna)}.
        </p>
      </header>

      <NavConcedii
        poateVedeaEchipa={true}
        poateAproba={poateAproba}
        poateVedeaCalendar={true}
        poateConfigura={poateConfigura}
      />

      <GrilaCalendar
        an={anCurent}
        luna={luna}
        zileHarta={Object.fromEntries(zileHarta)}
        lunaAnterioara={lunaAnterioara}
        lunaUrmatoare={lunaUrmatoare}
      />
    </main>
  );
}

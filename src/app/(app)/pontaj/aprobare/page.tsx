// src/app/(app)/pontaj/aprobare/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarClock, CheckCircle2 } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { formatOre } from "@/lib/format/ore";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { getEnabledFeatures, requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatMonthYear, todayInBucharest } from "@/lib/format/date";
import { anDinUrl, filtreDinUrl } from "@/lib/rute/parametri";
import {
  angajatiPontajDupaId,
  citestePerioada,
  departamente,
  liniiDeAprobat,
  saptamaniDeAprobat,
} from "@/lib/queries/attendance";
import { filtreAprobareSchema } from "@/schemas/attendance";

import { NavPontaj } from "../nav-pontaj";
import { ActiuniPerioada } from "../perioade/actiuni-perioada";
import { AprobareBloc } from "./aprobare-bloc";
import { ListaSaptamaniDeAprobat } from "./lista-saptamani-de-aprobat";

export const metadata: Metadata = { title: "Aprobare pontaj" };

interface RandAprobare {
  readonly id: string;
  readonly nume: string;
  readonly zile: number;
  readonly ore: number;
}

const COLOANE_APROBARE: readonly Coloana<RandAprobare>[] = [
  { cheie: "angajat", antet: "Angajat", peTelefon: "titlu", celula: (r) => r.nume },
  {
    cheie: "zile",
    antet: "Zile neaprobate",
    numeric: true,
    peTelefon: "meta",
    celula: (r) => r.zile,
  },
  {
    cheie: "ore",
    antet: "Ore lucrate",
    numeric: true,
    peTelefon: "meta",
    celula: (r) => formatOre(r.ore),
  },
];

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function ContinutAprobare({
  organizationId,
  an,
  luna,
  periodId,
  status,
  departmentId,
  poateBloca,
  poateSincroniza,
}: {
  readonly organizationId: string;
  readonly an: number;
  readonly luna: number;
  readonly periodId: string;
  readonly status: "deschisa" | "in_aprobare" | "blocata";
  readonly departmentId: string | null;
  readonly poateBloca: boolean;
  readonly poateSincroniza: boolean;
}) {
  const { linii, trunchiat } = await liniiDeAprobat(organizationId, periodId);
  const idAngajati = [...new Set(linii.map((l) => l.employee_id))];
  const angajati = await angajatiPontajDupaId(organizationId, idAngajati);

  const liniiFiltrate =
    departmentId === null
      ? linii
      : linii.filter((l) => angajati.get(l.employee_id)?.department_id === departmentId);

  const perAngajat = new Map<string, { readonly nume: string; zile: number; ore: number }>();
  for (const linie of liniiFiltrate) {
    const angajat = angajati.get(linie.employee_id);
    const nume =
      angajat === undefined ? "Angajat necunoscut" : `${angajat.full_name} (${angajat.marca})`;
    const existent = perAngajat.get(linie.employee_id);
    if (existent === undefined) {
      perAngajat.set(linie.employee_id, { nume, zile: 1, ore: linie.ore_lucrate });
    } else {
      perAngajat.set(linie.employee_id, {
        nume: existent.nume,
        zile: existent.zile + 1,
        ore: existent.ore + linie.ore_lucrate,
      });
    }
  }

  /*
   * Ordinea venea din inserarea în `Map`, adică din ordinea în care PostgREST
   * întorcea liniile — nealfabetică, nestabilă între două încărcări ale
   * aceleiași pagini. Pe un ecran unde cauți un anume om înainte să aprobi
   * luna, un tabel care se rearanjează singur e mai rău decât unul lung.
   * `localeCompare("ro")` fiindcă „Ș” trebuie să stea după „S”, nu la coadă.
   */
  const randuriAprobare: readonly RandAprobare[] = [...perAngajat.entries()]
    .map(([id, rand]) => ({ id, nume: rand.nume, zile: rand.zile, ore: rand.ore }))
    .sort((a, b) => a.nume.localeCompare(b.nume, "ro"));

  return (
    <div className="space-y-4">
      {trunchiat ? (
        <p
          role="alert"
          className="border-warning/40 bg-warning/12 text-foreground rounded-panou text-corp border p-3"
        >
          Luna are peste {linii.length} de linii neaprobate, iar citirea s-a oprit aici. Cifrele de
          mai jos sunt sub cele reale. Aprobați pe departamente, apoi reîncărcați ecranul.
        </p>
      ) : null}

      <AprobareBloc
        periodId={periodId}
        departmentId={departmentId}
        numarLiniiNeaprobate={liniiFiltrate.length}
        an={an}
        luna={luna}
        poateSincroniza={poateSincroniza}
      />

      {poateBloca ? (
        <div className="border-border rounded-panou border p-4">
          <p className="text-muted-foreground text-corp mb-2">
            Blocarea perioadei este aprobarea finală: oprește orice scriere ulterioară asupra lunii,
            inclusiv corecțiile manuale.
          </p>
          <ActiuniPerioada
            an={an}
            luna={luna}
            periodId={periodId}
            status={status}
            poateDeschide={false}
            poateBloca={poateBloca}
          />
        </div>
      ) : null}

      <Tabel
        caption="Angajații cu linii de pontaj neaprobate."
        coloane={COLOANE_APROBARE}
        randuri={randuriAprobare}
        cheieRand={(rand) => rand.id}
        gol={
          <StareGoala
            fel="initiala"
            pictograma={CheckCircle2}
            titlu="Nimic de aprobat"
            descriere="Toate liniile de pontaj ale acestei luni au fost deja aprobate."
          />
        }
      />
    </div>
  );
}

export default async function PaginaAprobarePontaj({ searchParams }: ProprietatiPagina) {
  const { user, tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "attendance:approve", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a aproba pontaj. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const poateBloca = can(permisiuni, "attendance:approve", "all");
  const enabledFeatures = await getEnabledFeatures(tenant.organizationId);
  const poateSincroniza =
    can(permisiuni, "attendance:create", "all") && enabledFeatures.has("leave");

  const parametri = await searchParams;
  const an = anDinUrl(parametri["an"], Number(todayInBucharest().slice(0, 4)));
  const filtre = filtreDinUrl(filtreAprobareSchema, parametri);

  // Trei citiri independente, puse una după alta fără motiv: perioada are nevoie
  // de (an, lună), departamentele doar de tenant, sarcinile doar de utilizator.
  const [perioada, listaDepartamente, sarciniSaptamana] = await Promise.all([
    citestePerioada(tenant.organizationId, an, filtre.luna),
    departamente(tenant.organizationId),
    saptamaniDeAprobat(tenant.organizationId, user.id),
  ]);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Aprobare pontaj"
        descriere={`Aprobarea în bloc pentru ${formatMonthYear(an, filtre.luna)}.`}
        file={
          <NavPontaj
            poateAproba={true}
            poateConfigura={can(permisiuni, "attendance:update", "all")}
          />
        }
      />

      <ListaSaptamaniDeAprobat sarcini={sarciniSaptamana} />

      {listaDepartamente.length === 0 ? null : (
        <form className="border-border rounded-panou flex flex-wrap items-end gap-3 border p-4">
          {/* Formular GET simplu, fără JavaScript: fără câmp explicit, `an` s-ar
              pierde din query string la reîncărcare. */}
          <input type="hidden" name="an" value={an} />
          <div className="flex flex-col gap-1">
            <label htmlFor="luna" className="text-corp font-medium">
              Luna
            </label>
            <input
              id="luna"
              name="luna"
              type="number"
              min={1}
              max={12}
              defaultValue={filtre.luna}
              className="border-foreground/60 rounded-control text-corp w-20 border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="departament" className="text-corp font-medium">
              Departament
            </label>
            <select
              id="departament"
              name="departament"
              defaultValue={filtre.departament ?? ""}
              className="border-foreground/60 rounded-control text-corp border px-3 py-2"
            >
              <option value="">Toate</option>
              {listaDepartamente.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.denumire}
                </option>
              ))}
            </select>
          </div>
          <Buton type="submit" varianta="secundar">
            Filtrează
          </Buton>
        </form>
      )}

      {perioada === null ? (
        <StareGoala
          fel="initiala"
          pictograma={CalendarClock}
          titlu="Luna nu a fost deschisă"
          descriere="Nu există nimic de aprobat cât timp luna nu a fost deschisă din „Perioade”."
        />
      ) : (
        <Suspense
          key={`${String(an)}-${String(filtre.luna)}-${filtre.departament ?? ""}`}
          fallback={<Schelet forma="tabel" coloane={3} />}
        >
          <ContinutAprobare
            organizationId={tenant.organizationId}
            an={an}
            luna={filtre.luna}
            periodId={perioada.id}
            status={perioada.status}
            departmentId={filtre.departament}
            poateBloca={poateBloca}
            poateSincroniza={poateSincroniza}
          />
        </Suspense>
      )}
    </div>
  );
}

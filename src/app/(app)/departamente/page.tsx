// src/app/(app)/departamente/page.tsx
import type { Metadata } from "next";
import { LayoutList, Network, Users } from "lucide-react";
import { z } from "zod";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { ComutatorVizualizare } from "@/components/ui/comutator-vizualizare";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { construiesteArbore } from "@/domain/departments/arbore";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { urlAvatar } from "@/lib/avatar/cale";
import { angajatiPentruStructura, structuraDepartamentelor } from "@/lib/queries/departments";
import { avataturiPeUtilizatori } from "@/lib/queries/profile";
import { idFisaProprie } from "@/lib/queries/employees";

import { FormularDepartamentNou } from "./formular-departament-nou";
import { StructuraInteractiva } from "./structura-interactiva";
import type { DepartamentEcran, OptiuneAngajat, OptiuneDepartament } from "./tipuri";
import type { PersoanaPanou } from "./panou-departament";

export const metadata: Metadata = { title: "Departamente" };

/**
 * Vizualizarea stă în ADRESĂ, nu în stare de client: supraviețuiește
 * reîncărcării, se poate trimite cuiva prin copy-paste și dă un buton „înapoi"
 * care funcționează.
 *
 * `.catch()`, nu `.parse()` strict: o adresă copiată greșit trebuie să cadă pe
 * implicit, nu să strice ecranul cu o eroare de validare.
 */
const VIZUALIZARI = ["lista", "organigrama"] as const;
const vizualizareSchema = z.enum(VIZUALIZARI).catch("lista");

const OPTIUNI_VIZUALIZARE = [
  { cheie: "lista", eticheta: "Listă", pictograma: LayoutList },
  { cheie: "organigrama", eticheta: "Organigramă", pictograma: Network },
] as const;

interface ProprietatiPagina {
  /** În Next 16 e o PROMISIUNE, nu un obiect. */
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaDepartamente({ searchParams }: ProprietatiPagina) {
  const parametri = await searchParams;
  const vizualizare = vizualizareSchema.parse(parametri["vizualizare"]);

  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  // AMBELE ramuri sunt necesare, și lipsa celei dintâi era un defect real:
  // `getPermissionMap` scoate `none` din hartă (`permissions.ts:127`), iar
  // `scopeFor` întoarce `null` pentru o cheie absentă. Comparația doar cu
  // `"none"` nu putea fi adevărată NICIODATĂ, deci poarta nu refuza pe nimeni.
  // `manager` n-are niciun rând `departments:*` în seed: până acum vedea o
  // pagină goală și nu se observa, dar de când există banda nerepartizaților
  // ar fi primit un ecran de structură funcțional. Aceeași verificare completă
  // e scrisă corect în `/organigrama`.
  const scopeDepartamente = scopeFor(permisiuni, "departments:read");
  if (scopeDepartamente === null || scopeDepartamente === "none") {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta structura organizatorică." />;
  }

  const poateCrea = can(permisiuni, "departments:create", "all");
  const poateEdita = can(permisiuni, "departments:update", "all");
  // Mutarea unei persoane e o scriere pe FIȘA ei, nu pe departament: cere
  // `employees:update`, nu `departments:update`. `hr` și `org_admin` le au pe
  // amândouă; un rol care ar căpăta doar structura n-ar trebui să poată muta
  // oameni, iar butoanele nu vor apărea.
  const poateMutaPersoane = can(permisiuni, "employees:update", "all");

  const scopeAngajati = scopeFor(permisiuni, "employees:read");
  const propriaFisaId =
    scopeAngajati === "all" || scopeAngajati === null || scopeAngajati === "none"
      ? null
      : await idFisaProprie(tenant.organizationId, user.id);

  const [structura, angajati] = await Promise.all([
    structuraDepartamentelor(tenant.organizationId),
    angajatiPentruStructura(tenant.organizationId, scopeAngajati ?? "none", propriaFisaId),
  ]);

  // Un singur apel pentru avatarele angajaților ȘI ale managerilor.
  const avataruri = await avataturiPeUtilizatori([
    ...angajati.map((a) => a.user_id),
    ...structura.map((d) => d.manager?.user_id ?? null),
  ]);

  const denumirePeDepartament = new Map(structura.map((d) => [d.id, d.denumire]));

  const persoane: readonly PersoanaPanou[] = [...angajati]
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "ro"))
    .map((a) => ({
      id: a.id,
      full_name: a.full_name,
      marca: a.marca,
      avatar_url: urlAvatar(avataruri.get(a.user_id ?? "") ?? null),
      functie: a.job_position?.denumire ?? null,
      status: a.status,
      esteActiv: a.status === "activ",
      departamentCurent:
        a.department_id === null
          ? null
          : // Un departament pe care apelantul NU-l vede prin RLS nu e „niciun
            // departament": eticheta „nerepartizat" ar fi o minciună despre fișa
            // altcuiva. Se spune ce se știe.
            (denumirePeDepartament.get(a.department_id) ?? "alt departament"),
    }));

  // Gruparea parcurge `persoane`, care e DEJA sortată pe nume, deci ordinea se
  // moștenește în fiecare departament fără o a doua sortare. Departamentul se
  // caută pe id, nu pe poziție: o potrivire pe indice între două liste sortate
  // separat s-ar rupe tăcut la primul nume cu diacritice ordonat altfel.
  const departamentPeAngajat = new Map(angajati.map((a) => [a.id, a.department_id]));
  const persoanePeDepartament = new Map<string, PersoanaPanou[]>();
  const nerepartizati: PersoanaPanou[] = [];
  for (const persoana of persoane) {
    const departmentId = departamentPeAngajat.get(persoana.id) ?? null;
    if (departmentId === null) {
      nerepartizati.push(persoana);
      continue;
    }
    const lista = persoanePeDepartament.get(departmentId);
    if (lista === undefined) persoanePeDepartament.set(departmentId, [persoana]);
    else lista.push(persoana);
  }

  const randuri: readonly DepartamentEcran[] = [...structura]
    .sort((a, b) => a.denumire.localeCompare(b.denumire, "ro"))
    .map((d) => ({
      id: d.id,
      parent_id: d.parent_id,
      cod: d.cod,
      denumire: d.denumire,
      descriere: d.descriere,
      activ: d.activ,
      manager_employee_id: d.manager_employee_id,
      cost_center: d.cost_center,
      manager:
        d.manager === null
          ? null
          : {
              full_name: d.manager.full_name,
              avatar_url: urlAvatar(avataruri.get(d.manager.user_id ?? "") ?? null),
            },
      persoane: persoanePeDepartament.get(d.id) ?? [],
    }));

  // Efectivul numără doar angajații ACTIVI: un `suspendat` sau un `candidat` e
  // în departament, dar nu lucrează în el. Panoul îi arată totuși pe toți, ca
  // să poată fi mutați — vezi comentariul din `queries/departments.ts`.
  const efectivPeDepartament = new Map(
    randuri.map((r) => [r.id, r.persoane.filter((p) => p.esteActiv).length]),
  );
  const arbore = construiesteArbore(randuri, efectivPeDepartament);

  // Se numără din ce se AFIȘEAZĂ, nu din `persoane.length - nerepartizati.length`.
  // Diferența contează când RLS ascunde un departament al cărui angajat e totuși
  // vizibil: omul acela nu apare pe niciun card și nu e nerepartizat, deci
  // scăderea l-ar fi numărat drept „repartizat" fără să existe undeva pe ecran.
  const repartizate = randuri.reduce((total, r) => total + r.persoane.length, 0);

  const listaDepartamente: readonly OptiuneDepartament[] = randuri.map((r) => ({
    id: r.id,
    denumire: r.denumire,
    cod: r.cod,
    activ: r.activ,
  }));
  const optiuniAngajati: readonly OptiuneAngajat[] = persoane.map((p) => ({
    id: p.id,
    full_name: p.full_name,
  }));

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Departamente"
        descriere="Structura organizatorică, cu managerul și efectivul pe fiecare nivel."
        {...(poateCrea
          ? {
              actiuni: (
                <FormularDepartamentNou
                  departamente={listaDepartamente}
                  angajati={optiuniAngajati}
                />
              ),
            }
          : {})}
      />

      {arbore.length === 0 && nerepartizati.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Users}
          titlu="Structura organizatorică este goală"
          descriere="Adăugați primul departament pentru a putea repartiza angajații și a delega drepturile pe echipă."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ComutatorVizualizare
              eticheta="Cum se afișează structura"
              cheieParametru="vizualizare"
              optiuni={OPTIUNI_VIZUALIZARE}
              curenta={vizualizare}
              implicita="lista"
              parametri={parametri}
              cale="/departamente"
            />
            <p className="text-muted-foreground text-nota">
              <span className="tabular-nums">{randuri.length}</span>{" "}
              {randuri.length === 1 ? "departament" : "departamente"} ·{" "}
              <span className="tabular-nums">{repartizate}</span>{" "}
              {repartizate === 1 ? "persoană repartizată" : "persoane repartizate"}
            </p>
          </div>

          <StructuraInteractiva
            vizualizare={vizualizare}
            arbore={arbore}
            nerepartizati={nerepartizati}
            toatePersoanele={persoane}
            departamente={listaDepartamente}
            angajati={optiuniAngajati}
            poateEdita={poateEdita}
            poateMutaPersoane={poateMutaPersoane}
          />
        </>
      )}
    </div>
  );
}

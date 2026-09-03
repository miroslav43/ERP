// src/app/(app)/inventar/in-primire/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { PackageCheck } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { idFisaProprie } from "@/lib/queries/employees";
import { inPrimireaMea } from "@/lib/queries/inventory";

import { ETICHETE_STARE } from "../etichete";
import { ButonConfirmare } from "./buton-confirmare";

export const metadata: Metadata = { title: "În primirea mea" };

export default async function PaginaInPrimire() {
  const utilizator = await requireUser();
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "inventory"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);
  const scope = scopeFor(permisiuni, "inventory:read");

  if (scope === null || scope === "none") {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta obiectele din primire." />;
  }

  // Pentru `own`, RLS restrânge deja singură la propria fișă — nu se caută
  // `propriaFisaId`. Pentru `team`/`all`, RLS NU restrânge, deci fișa proprie
  // trebuie aflată explicit; fără ea, lista ar arăta tot ce e alocat în firmă.
  let propriaFisaId: string | null = null;
  let araNimic = false;
  if (scope !== "own") {
    propriaFisaId = can(permisiuni, "employees:read", "own")
      ? await idFisaProprie(tenant.organizationId, utilizator.id)
      : null;
    araNimic = propriaFisaId === null;
  }

  const randuri = araNimic ? [] : await inPrimireaMea(tenant.organizationId, propriaFisaId);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="În primirea mea"
        descriere="Obiectele pe care le aveți acum în primire. Un obiect returnat dispare din această listă — istoricul complet rămâne pe fișa fiecărui obiect."
      />

      {randuri.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={PackageCheck}
          titlu="Nu aveți obiecte în primire"
          descriere="Momentan nu vă este predat niciun obiect de inventar."
        />
      ) : (
        <ul className="space-y-3">
          {randuri.map((rand) => (
            /*
             * Cardul era FUNDĂTURĂ: numele obiectului era text simplu, deci din
             * „ce am în primire" nu se putea ajunge la fișa obiectului — nici la
             * istoricul lui, nici la tichetele legate de el, nici la starea în
             * care a fost predat altcuiva înainte.
             *
             * Fișa acceptă orice scop de citire nenul (`[id]/page.tsx:63`), iar
             * politica RLS arată obiectul oricui are o alocare pe el — verificat,
             * nu presupus. Deci linkul nu duce într-un refuz.
             *
             * Linkul e întins peste tot cardul (`after:inset-0`), ca la varianta
             * de card din `<Tabel>`: o singură oprire de tabulare, o țintă de
             * dimensiunea rândului. Butonul de confirmare primește `relative`,
             * altfel ar rămâne SUB stratul linkului și n-ar mai putea fi apăsat.
             */
            <li key={rand.id} className="border-border rounded-panou relative border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    <Link
                      href={`/inventar/${rand.obiect.id}`}
                      className="after:absolute after:inset-0 hover:underline"
                    >
                      {rand.obiect.denumire}
                    </Link>
                  </p>
                  <p className="text-muted-foreground text-nota">
                    Nr. inventar <span className="font-mono">{rand.obiect.numar_inventar}</span>
                    {rand.obiect.serie !== null ? ` · Serie ${rand.obiect.serie}` : ""}
                  </p>
                  <p className="text-muted-foreground text-corp mt-1">
                    Predat la {formatDateTime(rand.predat_la)} · Stare la predare:{" "}
                    {ETICHETE_STARE[rand.stare_la_predare]}
                  </p>
                  {rand.observatii !== null ? (
                    <p className="text-muted-foreground text-corp mt-1">
                      Observații: {rand.observatii}
                    </p>
                  ) : null}
                </div>
                {rand.confirmat_de_angajat_la === null ? (
                  <span className="relative">
                    <ButonConfirmare alocareId={rand.id} />
                  </span>
                ) : (
                  <span className="bg-surface text-foreground text-nota relative rounded-full px-3 py-1 font-medium">
                    Confirmat la {formatDateTime(rand.confirmat_de_angajat_la)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

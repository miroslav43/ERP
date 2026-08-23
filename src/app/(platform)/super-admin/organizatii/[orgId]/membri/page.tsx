// src/app/(platform)/super-admin/organizatii/[orgId]/membri/page.tsx
import { notFound } from "next/navigation";
import { MailPlus, RotateCw, Users } from "lucide-react";

import { buton } from "@/components/ui/buton";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format/date";
import {
  ETICHETE_ROL,
  ETICHETE_STATUS_MEMBRU,
  type RolAplicatie,
  type RolAtribuibil,
} from "@/schemas/membership";

import { SELECT_PROFIL, numeAfisat, type RandProfil } from "../../../_lib/platform";
import { ActiuniInvitatie, ActiuniMembru, FormularInvitatie } from "./panou-membri";

type StatusMembru = "active" | "suspended" | "inactive";

type RandMembru = Readonly<{
  id: string;
  user_id: string;
  role: RolAplicatie;
  status: StatusMembru;
  job_title: string | null;
  joined_at: string | null;
}>;

type RandInvitatie = Readonly<{
  id: string;
  email: string;
  role: RolAplicatie;
  expires_at: string;
  created_at: string | null;
}>;

const CLASA_CELULA = "px-4 py-3 text-corp text-foreground align-top";
const CLASA_ANTET =
  "px-4 py-2 text-left text-nota font-semibold uppercase tracking-wide text-muted-foreground";

export default async function PaginaMembri({ params }: { params: Promise<{ orgId: string }> }) {
  const actor = await requirePlatformAdmin();
  const { orgId } = await params;
  const supabase = await createServerSupabase();
  const acum = new Date().toISOString();

  const [rezOrg, rezMembri, rezInvitatii] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, seats_limit")
      .eq("id", orgId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("id, user_id, role, status, job_title, joined_at")
      .eq("organization_id", orgId)
      .order("joined_at", { ascending: true })
      .returns<RandMembru[]>(),
    supabase
      .from("invitations")
      .select("id, email, role, expires_at, created_at")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      // Politica RLS ține `deleted_at is null` doar pe ramura de tenant;
      // administratorul de platformă vede și rândurile șterse logic (0043),
      // deci filtrul trebuie repetat aici, altfel ar apărea în listă.
      .is("deleted_at", null)
      .gt("expires_at", acum)
      .order("expires_at", { ascending: true })
      .returns<RandInvitatie[]>(),
  ]);

  if (rezOrg.error || rezMembri.error || rezInvitatii.error) {
    return (
      <div
        role="alert"
        className="border-border bg-surface flex flex-col items-center gap-3 rounded-xl border p-10 text-center"
      >
        <p className="text-danger text-corp font-medium">Membrii nu au putut fi încărcați</p>
        <p className="text-muted-foreground text-corp max-w-md">
          A apărut o problemă la citirea datelor organizației. Încearcă din nou.
        </p>
        <a
          href={`/super-admin/organizatii/${orgId}/membri`}
          className={buton({ varianta: "primar" })}
        >
          <RotateCw aria-hidden="true" className="h-4 w-4" />
          Reîncearcă
        </a>
      </div>
    );
  }

  const org = rezOrg.data;
  if (!org) notFound();

  const membri = rezMembri.data ?? [];
  const invitatii = rezInvitatii.data ?? [];

  const idUtilizatori = Array.from(new Set(membri.map((membru) => membru.user_id)));
  const profiluri =
    idUtilizatori.length > 0
      ? ((
          await supabase
            .from("profiles")
            .select(SELECT_PROFIL)
            .in("id", idUtilizatori)
            .returns<RandProfil[]>()
        ).data ?? [])
      : [];
  const hartaProfiluri = new Map(profiluri.map((profil) => [profil.id, profil]));

  const activi = membri.filter((membru) => membru.status === "active").length;
  const ocupate = activi + invitatii.length;

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-foreground text-titlu font-semibold">Membri — {org.name}</h1>
        <p className="text-muted-foreground text-corp">
          {org.seats_limit === null
            ? `${activi} membri activi și ${invitatii.length} invitații în așteptare. Planul nu are plafon de locuri.`
            : `${ocupate} din ${org.seats_limit} locuri ocupate (${activi} membri activi, ${invitatii.length} invitații în așteptare).`}
        </p>
      </header>

      <FormularInvitatie organizationId={org.id} />

      <div className="border-border bg-surface rounded-xl border">
        <h2 className="border-border text-foreground text-corp border-b px-4 py-3 font-semibold">
          Membri ({membri.length})
        </h2>

        {membri.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Users aria-hidden="true" className="text-muted-foreground h-8 w-8" />
            <p className="text-foreground text-corp font-medium">Organizația nu are încă membri</p>
            <p className="text-muted-foreground text-corp max-w-md">
              Folosește formularul de mai sus ca să trimiți prima invitație. Primul membru invitat
              ar trebui să aibă rolul „Administrator organizație”.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse">
              <caption className="sr-only">Lista membrilor organizației {org.name}</caption>
              <thead className="border-border border-b">
                <tr>
                  <th scope="col" className={CLASA_ANTET}>
                    Nume
                  </th>
                  <th scope="col" className={CLASA_ANTET}>
                    E-mail
                  </th>
                  <th scope="col" className={CLASA_ANTET}>
                    Rol
                  </th>
                  <th scope="col" className={CLASA_ANTET}>
                    Status
                  </th>
                  <th scope="col" className={CLASA_ANTET}>
                    Membru din
                  </th>
                  <th scope="col" className={CLASA_ANTET}>
                    Acțiuni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {membri.map((membru) => {
                  const profil = hartaProfiluri.get(membru.user_id);
                  const rolAtribuibil: RolAtribuibil =
                    membru.role === "super_admin" ? "org_admin" : membru.role;
                  return (
                    <tr key={membru.id}>
                      <td className={CLASA_CELULA}>
                        <span className="font-medium">{numeAfisat(profil)}</span>
                        {membru.job_title ? (
                          <span className="text-muted-foreground text-nota block">
                            {membru.job_title}
                          </span>
                        ) : null}
                      </td>
                      <td className={`${CLASA_CELULA} text-muted-foreground`}>
                        {profil?.email ?? "—"}
                      </td>
                      <td className={CLASA_CELULA}>{ETICHETE_ROL[membru.role]}</td>
                      <td className={CLASA_CELULA}>
                        <span
                          className={
                            membru.status === "active"
                              ? "text-success"
                              : membru.status === "suspended"
                                ? "text-danger"
                                : "text-muted-foreground"
                          }
                        >
                          {ETICHETE_STATUS_MEMBRU[membru.status]}
                        </span>
                      </td>
                      <td className={`${CLASA_CELULA} text-muted-foreground`}>
                        {membru.joined_at ? formatDateTime(membru.joined_at) : "—"}
                      </td>
                      <td className={CLASA_CELULA}>
                        <ActiuniMembru
                          organizationId={org.id}
                          memberId={membru.id}
                          rol={rolAtribuibil}
                          status={membru.status}
                          esteContPropriu={membru.user_id === actor.id}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="border-border bg-surface rounded-xl border">
        <h2 className="border-border text-foreground text-corp border-b px-4 py-3 font-semibold">
          Invitații în așteptare ({invitatii.length})
        </h2>

        {invitatii.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <MailPlus aria-hidden="true" className="text-muted-foreground h-8 w-8" />
            <p className="text-foreground text-corp font-medium">Nicio invitație în așteptare</p>
            <p className="text-muted-foreground text-corp max-w-md">
              Toate invitațiile au fost acceptate, au expirat sau au fost revocate. Poți trimite una
              nouă din formularul de mai sus.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse">
              <caption className="sr-only">
                Invitații în așteptare pentru organizația {org.name}
              </caption>
              <thead className="border-border border-b">
                <tr>
                  <th scope="col" className={CLASA_ANTET}>
                    E-mail
                  </th>
                  <th scope="col" className={CLASA_ANTET}>
                    Rol
                  </th>
                  <th scope="col" className={CLASA_ANTET}>
                    Trimisă
                  </th>
                  <th scope="col" className={CLASA_ANTET}>
                    Expiră
                  </th>
                  <th scope="col" className={CLASA_ANTET}>
                    Acțiuni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {invitatii.map((invitatie) => (
                  <tr key={invitatie.id}>
                    <td className={CLASA_CELULA}>{invitatie.email}</td>
                    <td className={CLASA_CELULA}>{ETICHETE_ROL[invitatie.role]}</td>
                    <td className={`${CLASA_CELULA} text-muted-foreground`}>
                      {invitatie.created_at ? formatDateTime(invitatie.created_at) : "—"}
                    </td>
                    <td className={`${CLASA_CELULA} text-muted-foreground`}>
                      {formatDateTime(invitatie.expires_at)}
                    </td>
                    <td className={CLASA_CELULA}>
                      <ActiuniInvitatie organizationId={org.id} invitationId={invitatie.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

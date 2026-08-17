// src/app/(auth)/alege-organizatia/page.tsx
import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { switchOrganization } from "@/app/(app)/actions";
import { EmptyState } from "@/components/feedback/empty-state";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { param } from "@/schemas/auth";
import { RUTA_DUPA_AUTENTIFICARE } from "@/config/routes";

export const metadata: Metadata = { title: "Alegeți organizația" };
export const dynamic = "force-dynamic";

const ROLURI: Record<string, string> = {
  org_admin: "Administrator",
  manager: "Manager",
  hr: "Resurse umane",
  employee: "Angajat",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PaginaAlegeOrganizatia({ searchParams }: Props) {
  const parametri = await searchParams;
  const rezolvare = await resolveTenant();

  if (rezolvare.status === "neautentificat")
    redirect("/autentificare?redirect=%2Falege-organizatia");
  if (rezolvare.status === "ok") redirect(RUTA_DUPA_AUTENTIFICARE);

  if (rezolvare.status === "fara_organizatie") {
    return (
      <EmptyState
        icon={Building2}
        title="Contul dvs. nu este asociat niciunei organizații"
        description="Accesul se acordă prin invitație. Cereți administratorului firmei dvs. o invitație pe adresa cu care v-ați autentificat."
      />
    );
  }

  const eroare = param(parametri.eroare) === "acces";

  return (
    <>
      <h1 className="text-primary text-xl font-semibold">Alegeți organizația</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Aveți acces la mai multe organizații. Puteți comuta oricând din bara de sus.
      </p>

      {eroare && (
        <p
          role="alert"
          className="text-danger border-danger/40 bg-danger/5 mt-4 rounded-md border px-3 py-2 text-sm"
        >
          Nu aveți acces la organizația selectată.
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-2">
        {rezolvare.organizations.map((organizatie) => (
          <li key={organizatie.id}>
            <form action={switchOrganization}>
              <input type="hidden" name="organizationId" value={organizatie.id} />
              <button
                type="submit"
                className="border-border hover:bg-background flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors"
              >
                <Building2 className="text-muted-foreground size-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{organizatie.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {ROLURI[organizatie.role] ?? organizatie.role}
                  </span>
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-sm">
        <Link href="/autentificare" className="text-muted-foreground rounded underline">
          Intră cu alt cont
        </Link>
      </p>
    </>
  );
}

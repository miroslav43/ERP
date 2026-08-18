// src/app/(auth)/alege-organizatia/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, LifeBuoy, LogOut } from "lucide-react";

import { comutaOrganizatiaDirect, deconecteaza } from "@/app/(app)/actions";
import { listUserOrganizations } from "@/lib/queries/organizations";
import { createServerSupabase } from "@/lib/supabase/server";
import { RUTA_AUTENTIFICARE } from "@/config/routes";
export const metadata: Metadata = {
  title: "Alegeți organizația",
  description: "Selectați organizația în care doriți să lucrați.",
};

const ETICHETE_ROL: Readonly<Record<string, string>> = {
  super_admin: "Super-administrator",
  org_admin: "Administrator",
  manager: "Manager",
  hr: "Resurse umane",
  employee: "Angajat",
};

type Props = Readonly<{
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}>;

export default async function AlegeOrganizatiaPage({ searchParams }: Props) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) {
    redirect(RUTA_AUTENTIFICARE);
  }

  const parametri = await searchParams;
  const areEroareAcces = parametri["eroare"] === "acces";
  const organizatii = await listUserOrganizations();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-foreground text-2xl font-semibold">
          {organizatii.length > 0 ? "Alegeți organizația" : "Nicio organizație asociată"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {organizatii.length > 0
            ? "Contul dumneavoastră are acces la mai multe organizații. Selectați-o pe cea în care doriți să lucrați; puteți comuta oricând din bara de sus."
            : "Contul dumneavoastră nu este asociat niciunei organizații."}
        </p>
      </header>

      {areEroareAcces ? (
        <p
          role="alert"
          aria-live="assertive"
          className="border-border bg-surface text-danger rounded-md border px-4 py-3 text-sm"
        >
          Nu aveți acces la organizația solicitată. Alegeți una dintre organizațiile de mai jos.
        </p>
      ) : null}

      {organizatii.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {organizatii.map((organizatie) => (
            <li key={organizatie.id}>
              <form action={comutaOrganizatiaDirect}>
                <input type="hidden" name="organizationId" value={organizatie.id} />
                <button
                  type="submit"
                  className="border-border bg-surface hover:bg-background flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors"
                >
                  <Building2 aria-hidden="true" className="text-primary h-5 w-5" />
                  <span className="flex min-w-0 flex-col">
                    {/* Conținut de la utilizator: randat ca text, niciodată ca HTML (S8). */}
                    <span className="text-foreground truncate font-medium">{organizatie.name}</span>
                    <span className="text-muted-foreground text-sm">
                      {ETICHETE_ROL[organizatie.role] ?? organizatie.role} · /{organizatie.slug}
                    </span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <section
          aria-labelledby="titlu-fara-organizatie"
          className="border-border bg-surface flex flex-col gap-3 rounded-lg border px-4 py-6"
        >
          <h2
            id="titlu-fara-organizatie"
            className="text-foreground flex items-center gap-2 font-medium"
          >
            <LifeBuoy aria-hidden="true" className="text-warning h-5 w-5" />
            Ce puteți face mai departe
          </h2>
          <p className="text-muted-foreground text-sm">
            Contul există și autentificarea a reușit, însă nimeni nu v-a adăugat încă într-o
            organizație. Rugați administratorul firmei dumneavoastră să vă trimită o invitație pe
            adresa <span className="text-foreground font-medium">{user.email}</span>. Dacă ați
            primit deja o invitație pe e-mail, deschideți linkul din mesaj — el vă asociază automat.
          </p>
          <p className="text-muted-foreground text-sm">
            Nu aveți încă o organizație în Administrativo?{" "}
            <Link
              href="/#cere-demo"
              className="text-primary font-medium underline underline-offset-4"
            >
              Cereți o prezentare
            </Link>{" "}
            și vă contactăm noi.
          </p>
        </section>
      )}

      <form action={deconecteaza}>
        <button
          type="submit"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm underline underline-offset-4"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          Deconectare
        </button>
      </form>
    </main>
  );
}

// src/app/(auth)/alege-organizatia/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, LifeBuoy, LogOut } from "lucide-react";

import { comutaOrganizatiaDirect, deconecteaza } from "@/app/(app)/actions";
import { Buton } from "@/components/ui/buton";
import { listUserOrganizations } from "@/lib/queries/organizations";
import { createServerSupabase } from "@/lib/supabase/server";
import { RUTA_AUTENTIFICARE, RUTA_SUPER_ADMIN } from "@/config/routes";
import { isPlatformAdmin } from "@/lib/auth/platform";
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

  // Un administrator de platformă poate să nu aibă nicio firmă — e chiar forma
  // corectă a contului. Fără ieșirea de mai jos, ecranul ăsta i-ar fi fundătură:
  // resolveTenant() îl trimite aici, iar de aici n-ar avea unde merge.
  // Verificarea se face doar când lista e goală, ca să nu coste un drum la bază
  // pentru utilizatorii obișnuiți.
  // Un administrator de platformă FĂRĂ nicio firmă n-are ce alege aici. Ecranul
  // ăsta e punctul prin care trec TOATE drumurile spre aplicație: layout-ul din
  // `(app)` și cel din `(portal)` trimit amândouă aici când `resolveTenant()`
  // întoarce `fara_organizatie`. Redirectând de aici, consola devine singurul loc
  // în care poate ajunge — fără să pun câte o gardă în fiecare layout.
  //
  // Redirect, nu link: un link e o sugestie, iar contul ăsta n-are alternativă.
  if (organizatii.length === 0 && (await isPlatformAdmin())) {
    redirect(RUTA_SUPER_ADMIN);
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-foreground text-titlu font-semibold">
          {organizatii.length > 0 ? "Alegeți organizația" : "Nicio organizație asociată"}
        </h1>
        <p className="text-muted-foreground text-corp">
          {organizatii.length > 0
            ? "Contul dumneavoastră are acces la mai multe organizații. Selectați-o pe cea în care doriți să lucrați; puteți comuta oricând din bara de sus."
            : "Contul dumneavoastră nu este asociat niciunei organizații."}
        </p>
      </header>

      {areEroareAcces ? (
        <p
          role="alert"
          aria-live="assertive"
          className="border-border bg-surface text-danger rounded-control text-corp border px-4 py-3"
        >
          Nu aveți acces la organizația solicitată. Alegeți una dintre organizațiile de mai jos.
        </p>
      ) : null}

      {organizatii.length > 0 ? (
        /*
          Ecranul cu cea mai mare consecință a unei citiri greșite din tot
          produsul: de aici pleacă tenantul în care se va lucra. Două lucruri îi
          răspund direct.

          1. DENUMIREA e cel mai proeminent element al rândului — `text-sectiune`
             semi-bold, adică o treaptă peste corpul textului, cu rolul și slugul
             coborâte la `text-nota` sub ea. Înainte toate trei erau la o
             jumătate de treaptă distanță, iar ochiul citea rândul ca un bloc.
          2. ȚINTA e rândul ÎNTREG, nu denumirea: `<button>` pe toată lățimea,
             `min-h-14` (56px, peste minimul de 44). Nimeni nu alege firma greșit
             fiindcă a atins doi pixeli mai jos.
        */
        <ul className="flex flex-col gap-2">
          {organizatii.map((organizatie) => (
            <li key={organizatie.id}>
              <form action={comutaOrganizatiaDirect}>
                <input type="hidden" name="organizationId" value={organizatie.id} />
                <button
                  type="submit"
                  className="border-border bg-surface hover:bg-background rounded-panou flex min-h-14 w-full items-center gap-3 border px-4 py-3 text-left transition-colors"
                >
                  <Building2 aria-hidden="true" className="text-primary h-5 w-5 shrink-0" />
                  <span className="flex min-w-0 flex-col">
                    {/* Conținut de la utilizator: randat ca text, niciodată ca HTML (S8). */}
                    <span className="text-foreground text-sectiune truncate font-semibold">
                      {organizatie.name}
                    </span>
                    <span className="text-muted-foreground text-nota truncate">
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
          className="border-border bg-surface rounded-panou flex flex-col gap-3 border px-4 py-6"
        >
          <h2
            id="titlu-fara-organizatie"
            className="text-foreground text-sectiune flex items-center gap-2 font-medium"
          >
            <LifeBuoy aria-hidden="true" className="text-warning h-5 w-5 shrink-0" />
            Ce puteți face mai departe
          </h2>
          <p className="text-muted-foreground text-corp">
            Contul există și autentificarea a reușit, însă nimeni nu v-a adăugat încă într-o
            organizație. Rugați administratorul firmei dumneavoastră să vă trimită o invitație pe
            adresa <span className="text-foreground font-medium">{user.email}</span>. Dacă ați
            primit deja o invitație pe e-mail, deschideți linkul din mesaj — el vă asociază automat.
          </p>
          <p className="text-muted-foreground text-corp">
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
        <Buton type="submit" varianta="link">
          <LogOut aria-hidden="true" className="h-4 w-4" />
          Deconectare
        </Buton>
      </form>
    </div>
  );
}

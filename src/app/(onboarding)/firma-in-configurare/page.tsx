import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2, LogOut } from "lucide-react";

import { deconecteaza } from "@/app/(app)/actions";
import {
  RUTA_ALEGE_ORGANIZATIA,
  RUTA_AUTENTIFICARE,
  RUTA_DUPA_AUTENTIFICARE,
} from "@/config/routes";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { stareFirmei } from "@/lib/tenant/stare-firma";

export const metadata: Metadata = {
  title: "Firma se configurează",
  description: "Administratorul organizației completează datele firmei.",
};

export const dynamic = "force-dynamic";

/**
 * Ecranul celor care NU pot configura firma.
 *
 * `hr`, `manager` și ceilalți ajung aici când organizația e încă `pending`.
 * Nu le arătăm asistentul: le-ar cere capitalul social, IBAN-ul și
 * reprezentantul legal — date pe care n-au cum să le știe și pe care oricum nu
 * au dreptul să le scrie. Un formular pe care nu-l poți completa e mai
 * descurajant decât o explicație.
 */
export default async function PaginaFirmaInConfigurare() {
  const rezolvare = await resolveTenant();
  // Două cazuri distincte, nu unul. „Nu ești autentificat" duce la login;
  // „ești autentificat, dar fără organizație" duce la ecranul de alegere — care
  // trimite mai departe un administrator de platformă în consolă. Contopite,
  // un super-admin care nimerește adresa asta ar fi trimis la login deși e deja
  // conectat, adică într-o buclă fără explicație.
  if (rezolvare.status === "neautentificat") redirect(RUTA_AUTENTIFICARE);
  if (rezolvare.status !== "ok") redirect(RUTA_ALEGE_ORGANIZATIA);

  // Firma s-a configurat între timp (sau utilizatorul a nimerit adresa direct):
  // nu-l ținem pe un ecran de așteptare care nu mai are obiect.
  const stare = await stareFirmei(rezolvare.tenant.organizationId);
  if (stare !== "pending") redirect(RUTA_DUPA_AUTENTIFICARE);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-16">
      <div className="border-border bg-surface flex flex-col items-center gap-4 rounded-lg border p-8 text-center">
        <span className="bg-background border-border flex size-12 items-center justify-center rounded-full border">
          <Building2 aria-hidden="true" className="text-primary size-6" />
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="text-foreground text-xl font-semibold">
            {rezolvare.tenant.name} se configurează
          </h1>
          <p className="text-muted-foreground text-sm">
            Administratorul organizației trebuie să completeze datele firmei — adresă, reprezentant
            legal, date financiare — înainte ca aplicația să poată fi folosită.
          </p>
          <p className="text-muted-foreground text-sm">
            Vei avea acces imediat ce termină. Dacă durează, întreabă-l direct.
          </p>
        </div>
      </div>

      <form action={deconecteaza}>
        <button
          type="submit"
          className="border-border text-muted-foreground hover:bg-surface hover:text-foreground flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition"
        >
          <LogOut aria-hidden="true" className="size-4" />
          Deconectare
        </button>
      </form>
    </main>
  );
}

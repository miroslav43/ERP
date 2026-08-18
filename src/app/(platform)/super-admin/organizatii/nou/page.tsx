// src/app/(platform)/super-admin/organizatii/nou/page.tsx
import Link from "next/link";

import { FormularOrganizatieNoua } from "../_components/formular-organizatie-noua";

export const metadata = { title: "Organizație nouă · Panou de platformă" };

export default function PaginaOrganizatieNoua() {
  return (
    <div className="max-w-3xl space-y-6">
      <nav aria-label="Firimituri" className="text-sm">
        <Link
          href="/super-admin/organizatii"
          className="text-primary underline-offset-4 hover:underline"
        >
          Organizații
        </Link>
        <span aria-hidden="true" className="text-muted-foreground mx-2">
          /
        </span>
        <span className="text-muted-foreground">Organizație nouă</span>
      </nav>

      <header>
        <h1 className="text-foreground text-2xl font-semibold">Organizație nouă</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Organizația se creează în starea „În așteptare”. Modulele de bază se activează automat,
          iar accesul membrilor începe după activare.
        </p>
      </header>

      <FormularOrganizatieNoua />
    </div>
  );
}

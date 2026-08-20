// src/app/(platform)/super-admin/organizatii/nou/page.tsx
import Link from "next/link";

import { citesteCerereDemo } from "../../cereri-demo/actions";
import { InrolareOrganizatie } from "../_components/inrolare-organizatie";

export const metadata = { title: "Organizație nouă · Panou de platformă" };

/** Sugestie de identificator din denumirea firmei — admin-ul o poate schimba oricând. */
function sugereazaSlug(firma: string): string {
  return firma
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 40);
}

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaOrganizatieNoua({ searchParams }: ProprietatiPagina) {
  const parametri = await searchParams;
  const idCerere = typeof parametri["cerere"] === "string" ? parametri["cerere"] : null;
  const cerere = idCerere === null ? null : await citesteCerereDemo(idCerere);

  const valoriInitiale =
    cerere === null
      ? undefined
      : {
          name: cerere.firma,
          slug: sugereazaSlug(cerere.firma),
          email_contact: cerere.email,
          telefon_contact: cerere.telefon ?? "",
        };

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
          Căutăm CUI-ul la ANAF, apoi confirmi datele și creezi contul proprietarului. Organizația
          devine activă imediat, cu modulele de bază pornite.
        </p>
      </header>

      <InrolareOrganizatie {...(valoriInitiale === undefined ? {} : { valoriInitiale })} />
    </div>
  );
}

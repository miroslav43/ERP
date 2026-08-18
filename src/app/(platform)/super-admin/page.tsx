// src/app/(platform)/super-admin/page.tsx
import Link from "next/link";

import { sumarPlatforma } from "./organizatii/actions";

export const metadata = { title: "Panou de platformă · Administrativo" };

function Cartela({
  eticheta,
  valoare,
  href,
}: {
  eticheta: string;
  valoare: number;
  href?: string;
}) {
  const continut = (
    <>
      <dt className="text-muted-foreground text-sm">{eticheta}</dt>
      <dd className="text-foreground mt-1 text-3xl font-semibold tabular-nums">{valoare}</dd>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="border-border bg-surface hover:border-primary block rounded-lg border p-4 transition"
    >
      <dl>{continut}</dl>
    </Link>
  ) : (
    <dl className="border-border bg-surface rounded-lg border p-4">{continut}</dl>
  );
}

export default async function PaginaSumarPlatforma() {
  const sumar = await sumarPlatforma();
  const totalOrganizatii = Object.values(sumar.organizatii).reduce(
    (total, valoare) => total + valoare,
    0,
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-foreground text-2xl font-semibold">Sumar platformă</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Starea celor {totalOrganizatii} organizații înregistrate.
        </p>
      </header>

      {totalOrganizatii === 0 ? (
        <div className="border-border rounded-lg border border-dashed p-8 text-center">
          <h2 className="text-foreground text-base font-medium">Nicio organizație încă</h2>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Creați prima organizație pentru a începe. Veți putea invita membri imediat după
            activare.
          </p>
          <Link
            href="/super-admin/organizatii/nou"
            className="bg-primary text-primary-foreground hover:bg-primary-hover mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium"
          >
            Creează prima organizație
          </Link>
        </div>
      ) : (
        <section aria-labelledby="titlu-organizatii" className="space-y-3">
          <h2
            id="titlu-organizatii"
            className="text-muted-foreground text-sm font-medium tracking-wide uppercase"
          >
            Organizații după status
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Cartela
              eticheta="În așteptare"
              valoare={sumar.organizatii.pending}
              href="/super-admin/organizatii?status=pending"
            />
            <Cartela
              eticheta="Active"
              valoare={sumar.organizatii.active}
              href="/super-admin/organizatii?status=active"
            />
            <Cartela
              eticheta="Suspendate"
              valoare={sumar.organizatii.suspended}
              href="/super-admin/organizatii?status=suspended"
            />
            <Cartela
              eticheta="Arhivate"
              valoare={sumar.organizatii.archived}
              href="/super-admin/organizatii?status=archived"
            />
          </div>
        </section>
      )}

      <section aria-labelledby="titlu-activitate" className="space-y-3">
        <h2
          id="titlu-activitate"
          className="text-muted-foreground text-sm font-medium tracking-wide uppercase"
        >
          Necesită atenție
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Cartela
            eticheta="Cereri demo noi"
            valoare={sumar.cereriDemoNoi}
            href="/super-admin/cereri-demo?status=new"
          />
          <Cartela eticheta="Invitații în așteptare" valoare={sumar.invitatiiInAsteptare} />
        </div>
      </section>
    </div>
  );
}

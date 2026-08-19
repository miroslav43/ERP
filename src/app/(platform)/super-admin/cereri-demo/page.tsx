// src/app/(platform)/super-admin/cereri-demo/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { AlertCircle, Building2, Inbox, Mail, Phone, Users } from "lucide-react";
import { formatDateTime } from "@/lib/format/date";
import { citesteCereriDemo } from "./actions";
import { ETICHETE_STATUS, STATUSURI_CERERE, type StatusCerere } from "./constante";
import { SchimbaStatus } from "./schimba-status";

export const metadata: Metadata = { title: "Cereri de demo" };

const RUTA = "/super-admin/cereri-demo";

function citesteStatus(valoare: string | string[] | undefined): StatusCerere | null {
  if (typeof valoare !== "string") return null;
  const gasit = STATUSURI_CERERE.find((status) => status === valoare);
  return gasit ?? null;
}

const CULOARE_STATUS: Readonly<Record<StatusCerere, string>> = {
  new: "text-primary",
  contacted: "text-accent",
  qualified: "text-foreground",
  converted: "text-success",
  rejected: "text-muted-foreground",
  spam: "text-danger",
};

export default async function PaginaCereriDemo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametri = await searchParams;
  const statusActiv = citesteStatus(parametri["status"]);
  const rezultat = await citesteCereriDemo(statusActiv);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Cereri de demo</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Cererile trimise din pagina publică, cele mai noi primele. Mesajele sunt afișate ca text
          simplu, exact cum au fost scrise.
        </p>
      </header>

      {!rezultat.ok ? (
        <div role="alert" className="border-border bg-surface mt-8 rounded-lg border p-6 text-sm">
          <p className="text-danger flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{rezultat.error.message}</span>
          </p>
          <Link
            href={statusActiv ? `${RUTA}?status=${statusActiv}` : RUTA}
            className="border-border hover:border-primary mt-4 inline-flex rounded-md border px-4 py-2 text-sm font-medium transition-colors"
          >
            Încearcă din nou
          </Link>
        </div>
      ) : (
        <>
          <nav aria-label="Filtrare după status" className="mt-8">
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link
                  href={RUTA}
                  aria-current={statusActiv === null ? "page" : undefined}
                  className={` inline-flex rounded-full border px-3 py-1.5 text-sm transition-colors   ${
                    statusActiv === null
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Toate
                </Link>
              </li>
              {STATUSURI_CERERE.map((status) => (
                <li key={status}>
                  <Link
                    href={`${RUTA}?status=${status}`}
                    aria-current={statusActiv === status ? "page" : undefined}
                    className={` inline-flex rounded-full border px-3 py-1.5 text-sm transition-colors   ${
                      statusActiv === status
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {ETICHETE_STATUS[status]}{" "}
                    <span className="ml-1 tabular-nums">{rezultat.data.contorizare[status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {rezultat.data.cereri.length === 0 ? (
            <div className="border-border mt-8 rounded-lg border border-dashed p-10 text-center">
              <Inbox className="text-muted-foreground mx-auto h-6 w-6" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold">
                {statusActiv === null
                  ? "Nicio cerere de demo deocamdată"
                  : `Nicio cerere cu statusul „${ETICHETE_STATUS[statusActiv]}”`}
              </h2>
              <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
                {statusActiv === null
                  ? "Cererile apar aici imediat ce cineva completează formularul public. Verifică pagina de prezentare și butonul „Cere demo”."
                  : "Schimbă filtrul pentru a vedea celelalte cereri."}
              </p>
              <Link
                href={statusActiv === null ? "/" : RUTA}
                className="border-border hover:border-primary mt-6 inline-flex rounded-md border px-4 py-2 text-sm font-medium transition-colors"
              >
                {statusActiv === null ? "Deschide pagina publică" : "Vezi toate cererile"}
              </Link>
            </div>
          ) : (
            <ul className="mt-8 space-y-4">
              {rezultat.data.cereri.map((cerere) => (
                <li key={cerere.id} className="border-border bg-surface rounded-lg border p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">{cerere.firma}</h2>
                      <p className="text-muted-foreground mt-1 text-sm">{cerere.nume}</p>
                    </div>
                    <span
                      className={`border-border rounded-full border px-2.5 py-0.5 text-xs font-medium ${CULOARE_STATUS[cerere.status]}`}
                    >
                      {ETICHETE_STATUS[cerere.status]}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Mail className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                      <dt className="sr-only">E-mail</dt>
                      <dd>
                        <a href={`mailto:${cerere.email}`} className="underline underline-offset-2">
                          {cerere.email}
                        </a>
                      </dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                      <dt className="sr-only">Telefon</dt>
                      <dd>{cerere.telefon ?? "Nu a lăsat telefon"}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                      <dt className="sr-only">Număr de angajați</dt>
                      <dd>{cerere.nrAngajati} angajați</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <dt className="text-muted-foreground">Primită</dt>
                      <dd>{formatDateTime(new Date(cerere.createdAt))}</dd>
                    </div>
                  </dl>

                  {cerere.mesaj ? (
                    <p className="border-border bg-background mt-4 rounded-md border p-4 text-sm leading-relaxed break-words whitespace-pre-wrap">
                      {cerere.mesaj}
                    </p>
                  ) : null}

                  <div className="border-border mt-5 flex flex-wrap items-end justify-between gap-4 border-t pt-5">
                    <SchimbaStatus cerereId={cerere.id} statusCurent={cerere.status} />
                    <Link
                      href={`/super-admin/organizatii/nou?cerere=${cerere.id}`}
                      className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
                    >
                      <Building2 className="h-4 w-4" aria-hidden="true" />
                      Creează organizație din această cerere
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// src/app/(platform)/super-admin/organizatii/page.tsx
// Tabel server-rendered simplu, NU TanStack Table. Motivare: paginarea, căutarea și filtrarea
// se fac deja pe server (max. 20 rânduri/pagină), nu avem nevoie de sortare/grupare/virtualizare
// pe client, iar un tabel server-rendered nu trimite JavaScript în plus și rămâne accesibil
// și fără hidratare. TanStack Table devine justificat abia la coloane redimensionabile
// sau selecție multiplă — funcționalități care nu sunt în Faza 1b.
import Link from "next/link";

import { formatDate } from "@/lib/format/date";
import { STATUSURI_ORGANIZATIE } from "@/schemas/organization";
import {
  InsignaPlan,
  InsignaStatus,
  type PlanOrganizatie,
  type StatusOrganizatie,
} from "../_components/insigne";
import { FiltreOrganizatii } from "./_components/filtre-organizatii";
import { listaOrganizatii } from "./actions";

export const metadata = { title: "Organizații · Panou de platformă" };

type ParametriCautare = Readonly<{ cautare?: string; status?: string; pagina?: string }>;

/** Din URL vine mereu `string`; filtrul acceptă doar statusurile din enum-ul organizației. */
function esteStatusOrganizatie(valoare: string): valoare is (typeof STATUSURI_ORGANIZATIE)[number] {
  return (STATUSURI_ORGANIZATIE as readonly string[]).includes(valoare);
}

export default async function PaginaOrganizatii({
  searchParams,
}: {
  searchParams: Promise<ParametriCautare>;
}) {
  const parametri = await searchParams;
  const status =
    parametri.status !== undefined && esteStatusOrganizatie(parametri.status)
      ? parametri.status
      : undefined;
  const rezultat = await listaOrganizatii({
    ...(parametri.cautare ? { cautare: parametri.cautare } : {}),
    ...(status ? { status } : {}),
    ...(parametri.pagina ? { pagina: parametri.pagina } : {}),
  });

  const construiesteLink = (pagina: number): string => {
    const cautare = new URLSearchParams();
    if (parametri.cautare) cautare.set("cautare", parametri.cautare);
    if (parametri.status) cautare.set("status", parametri.status);
    cautare.set("pagina", String(pagina));
    return `/super-admin/organizatii?${cautare.toString()}`;
  };

  const areFiltre = Boolean(parametri.cautare || parametri.status);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Organizații</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {rezultat.total === 1
              ? "O organizație înregistrată"
              : `${rezultat.total} organizații înregistrate`}
          </p>
        </div>
        <Link
          href="/super-admin/organizatii/nou"
          className="bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring rounded-md px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          Organizație nouă
        </Link>
      </header>

      <FiltreOrganizatii
        cautareInitiala={parametri.cautare ?? ""}
        statusInitial={parametri.status ?? ""}
      />

      {rezultat.randuri.length === 0 ? (
        <div className="border-border rounded-lg border border-dashed p-10 text-center">
          <h2 className="text-foreground text-base font-medium">
            {areFiltre
              ? "Nicio organizație pentru aceste filtre"
              : "Nu există încă nicio organizație"}
          </h2>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            {areFiltre
              ? "Încercați o altă denumire sau alt CUI, ori renunțați la filtrul de status."
              : "Creați prima organizație și invitați apoi administratorul ei."}
          </p>
          <Link
            href={areFiltre ? "/super-admin/organizatii" : "/super-admin/organizatii/nou"}
            className="bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
          >
            {areFiltre ? "Șterge filtrele" : "Creează organizație"}
          </Link>
        </div>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <caption className="sr-only">
              Lista organizațiilor, pagina {rezultat.pagina} din {rezultat.pagini}
            </caption>
            <thead className="bg-surface text-muted-foreground text-left text-xs tracking-wide uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Denumire
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  CUI
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Plan
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Membri / locuri
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Creată la
                </th>
              </tr>
            </thead>
            <tbody>
              {rezultat.randuri.map((organizatie) => (
                <tr key={organizatie.id} className="border-border hover:bg-surface border-t">
                  <td className="px-4 py-3">
                    {/* Conținut introdus de om: randat ca text de React, niciodată ca HTML. */}
                    <Link
                      href={`/super-admin/organizatii/${organizatie.id}`}
                      className="text-primary focus-visible:ring-ring font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {organizatie.name}
                    </Link>
                    <span className="text-muted-foreground block text-xs">/{organizatie.slug}</span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {organizatie.cui}
                  </td>
                  <td className="px-4 py-3">
                    <InsignaStatus status={organizatie.status as StatusOrganizatie} />
                  </td>
                  <td className="px-4 py-3">
                    <InsignaPlan plan={organizatie.plan as PlanOrganizatie} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <span
                      className={
                        organizatie.membriActivi > organizatie.seats_limit
                          ? "text-danger"
                          : "text-foreground"
                      }
                    >
                      {organizatie.membriActivi}
                    </span>
                    <span className="text-muted-foreground"> / {organizatie.seats_limit}</span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {formatDate(organizatie.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rezultat.pagini > 1 && (
        <nav
          aria-label="Paginare organizații"
          className="flex items-center justify-between gap-4 text-sm"
        >
          <span className="text-muted-foreground" aria-live="polite">
            Pagina {rezultat.pagina} din {rezultat.pagini}
          </span>
          <div className="flex gap-2">
            {rezultat.pagina > 1 && (
              <Link
                href={construiesteLink(rezultat.pagina - 1)}
                rel="prev"
                className="border-border hover:bg-surface focus-visible:ring-ring rounded-md border px-3 py-1.5 focus-visible:ring-2 focus-visible:outline-none"
              >
                Pagina anterioară
              </Link>
            )}
            {rezultat.pagina < rezultat.pagini && (
              <Link
                href={construiesteLink(rezultat.pagina + 1)}
                rel="next"
                className="border-border hover:bg-surface focus-visible:ring-ring rounded-md border px-3 py-1.5 focus-visible:ring-2 focus-visible:outline-none"
              >
                Pagina următoare
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

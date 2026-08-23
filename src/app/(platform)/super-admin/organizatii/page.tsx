// src/app/(platform)/super-admin/organizatii/page.tsx
// Tabel server-rendered simplu, NU TanStack Table. Motivare: paginarea, căutarea și filtrarea
// se fac deja pe server (20–100 rânduri/pagină), nu avem nevoie de sortare/grupare/virtualizare
// pe client, iar un tabel server-rendered nu trimite JavaScript în plus și rămâne accesibil
// și fără hidratare. TanStack Table devine justificat abia la coloane redimensionabile
// sau selecție multiplă — funcționalități care nu sunt în Faza 1b.
import Link from "next/link";

import { buton } from "@/components/ui/buton";
import { Paginare } from "@/components/ui/paginare";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { cn } from "@/lib/ui/cn";
import { formatDateTime } from "@/lib/format/date";
import { FEATURE_KEYS } from "@/config/features";
import { STATUSURI_ORGANIZATIE } from "@/schemas/organization";
import {
  InsignaPlan,
  InsignaStatus,
  type PlanOrganizatie,
  type StatusOrganizatie,
} from "../_components/insigne";
import { ModuleMini } from "../_components/module-mini";
import { FiltreOrganizatii } from "./_components/filtre-organizatii";
import { listaOrganizatii } from "./actions";

export const metadata = { title: "Organizații · Panou de platformă" };

/**
 * Totalul din catalogul CODULUI, nu din bază: pătrățelele arată câte module
 * cunoaște aplicația. Dacă baza are unul în plus — cum a fost cu `ticketing` —
 * el nu apare în cod, deci nu are ce reprezenta aici.
 */
const TOTAL_MODULE = FEATURE_KEYS.length;

type ParametriCautare = Readonly<{
  cautare?: string;
  status?: string;
  pagina?: string;
  pePagina?: string;
}>;

/** Din URL vine mereu `string`; filtrul acceptă doar statusurile din enum-ul organizației. */
function esteStatusOrganizatie(valoare: string): valoare is (typeof STATUSURI_ORGANIZATIE)[number] {
  return (STATUSURI_ORGANIZATIE as readonly string[]).includes(valoare);
}

/**
 * Mărimile de pagină oferite, ca listă ÎNCHISĂ.
 *
 * `listaOrganizatiiSchema` cere `pePagina` între 10 și 100, iar Zod nu
 * plafonează, ci ARUNCĂ: un `?pePagina=5` scris de mână ar da o pagină de
 * eroare, nu o listă. Aici valoarea din URL se îngustează la cele trei mărimi
 * cunoscute și cade tăcut pe implicitul schemei pentru orice altceva — aceeași
 * regulă ca `sortareCeruta` pentru numele coloanei de sortare.
 */
const MARIMI_PAGINA = [20, 50, 100] as const;

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
  const pePagina = MARIMI_PAGINA.find((marime) => String(marime) === parametri.pePagina);
  const rezultat = await listaOrganizatii({
    ...(parametri.cautare ? { cautare: parametri.cautare } : {}),
    ...(status ? { status } : {}),
    ...(parametri.pagina ? { pagina: parametri.pagina } : {}),
    ...(pePagina === undefined ? {} : { pePagina }),
  });

  /**
   * Adresele se construiesc din parametrii EXISTENȚI, nu dintr-un obiect gol:
   * altfel schimbarea mărimii paginii ar șterge căutarea și filtrul de status.
   */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/super-admin/organizatii" : `/super-admin/organizatii?${p.toString()}`;
  }

  const areFiltre = Boolean(parametri.cautare || parametri.status);

  type RandOrganizatie = (typeof rezultat.randuri)[number];

  /*
   * Antetele nu sortează: citirea din `actions.ts` are ordine fixă
   * (`created_at desc`) și paginare prin `.range()`, nu keyset. Un antet care
   * pare apăsabil și nu face nimic e mai rău decât unul care nu pare.
   */
  const coloane: readonly Coloana<RandOrganizatie>[] = [
    {
      cheie: "denumire",
      antet: "Denumire",
      peTelefon: "titlu",
      // Conținut introdus de om: randat ca text de React, niciodată ca HTML.
      celula: (organizatie) => (
        <>
          <span className="font-medium">{organizatie.name}</span>
          <span className="text-muted-foreground text-nota block">/{organizatie.slug}</span>
        </>
      ),
    },
    {
      cheie: "cui",
      antet: "CUI",
      peTelefon: "meta",
      celula: (organizatie) => (
        <span className="text-muted-foreground tabular-nums">{organizatie.cui}</span>
      ),
    },
    {
      cheie: "status",
      antet: "Status",
      peTelefon: "insigna",
      celula: (organizatie) => <InsignaStatus status={organizatie.status as StatusOrganizatie} />,
    },
    {
      cheie: "plan",
      antet: "Plan",
      peTelefon: "insigna",
      celula: (organizatie) => <InsignaPlan plan={organizatie.plan as PlanOrganizatie} />,
    },
    {
      cheie: "module",
      antet: "Module",
      peTelefon: "meta",
      celula: (organizatie) => (
        <ModuleMini active={organizatie.moduleActive} total={TOTAL_MODULE} />
      ),
    },
    {
      cheie: "membri",
      antet: "Membri / locuri",
      numeric: true,
      peTelefon: "meta",
      celula: (organizatie) => (
        <>
          <span
            className={
              organizatie.membriActivi > organizatie.seats_limit ? "text-danger" : "text-foreground"
            }
          >
            {organizatie.membriActivi}
          </span>
          <span className="text-muted-foreground"> / {organizatie.seats_limit}</span>
        </>
      ),
    },
    {
      cheie: "creata_la",
      antet: "Creată la",
      peTelefon: "meta",
      celula: (organizatie) => (
        <span className="text-muted-foreground">{formatDateTime(organizatie.created_at)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-foreground text-titlu font-semibold">Organizații</h1>
          <p className="text-muted-foreground text-corp mt-1">
            {rezultat.total === 1
              ? "O organizație înregistrată"
              : `${rezultat.total} organizații înregistrate`}
          </p>
        </div>
        <Link href="/super-admin/organizatii/nou" className={buton({ varianta: "primar" })}>
          Organizație nouă
        </Link>
      </header>

      <FiltreOrganizatii
        cautareInitiala={parametri.cautare ?? ""}
        statusInitial={parametri.status ?? ""}
      />

      <div className="flex flex-col gap-4">
        <Tabel
          caption={`Lista organizațiilor, pagina ${String(rezultat.pagina)} din ${String(rezultat.pagini)}`}
          coloane={coloane}
          randuri={rezultat.randuri}
          cheieRand={(organizatie) => organizatie.id}
          href={(organizatie) => `/super-admin/organizatii/${organizatie.id}`}
          gol={
            <div className="border-border rounded-panou border border-dashed p-10 text-center">
              <h2 className="text-foreground text-sectiune font-medium">
                {areFiltre
                  ? "Nicio organizație pentru aceste filtre"
                  : "Nu există încă nicio organizație"}
              </h2>
              <p className="text-muted-foreground text-corp mx-auto mt-1 max-w-md">
                {areFiltre
                  ? "Încercați o altă denumire sau alt CUI, ori renunțați la filtrul de status."
                  : "Creați prima organizație și invitați apoi administratorul ei."}
              </p>
              <Link
                href={areFiltre ? "/super-admin/organizatii" : "/super-admin/organizatii/nou"}
                className={cn(buton({ varianta: "primar" }), "mt-4")}
              >
                {areFiltre ? "Șterge filtrele" : "Creează organizație"}
              </Link>
            </div>
          }
        />

        {rezultat.randuri.length === 0 ? null : (
          /*
           * Paginarea listei e prin `.range()`, nu keyset, deci „cursorul” pe
           * care îl primește componenta e chiar numărul paginii următoare.
           * Mărimile respectă `listaOrganizatiiSchema` (min 10, max 100), iar
           * schimbarea ei ȘTERGE pagina: rândul 41 al paginilor de 20 nu e
           * rândul 41 al paginilor de 50.
           */
          <Paginare
            afisate={rezultat.randuri.length}
            total={rezultat.total}
            cursorUrmator={rezultat.pagina < rezultat.pagini ? String(rezultat.pagina + 1) : null}
            limita={rezultat.pePagina}
            marimiPosibile={MARIMI_PAGINA}
            construiesteHref={({ cursor, limita }) =>
              adresa((p) => {
                p.set("pePagina", String(limita));
                if (cursor === null) p.delete("pagina");
                else p.set("pagina", cursor);
              })
            }
          />
        )}
      </div>
    </div>
  );
}

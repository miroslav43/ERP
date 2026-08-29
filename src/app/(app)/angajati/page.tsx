// src/app/(app)/angajati/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { UserPlus, Users, Upload } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { AvatarAngajat } from "@/components/data/avatar-angajat";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { scrieSortare } from "@/lib/queries/cursor";
import {
  idFisaProprie,
  listeazaAngajati,
  functiiActive,
  rolurileConturilor,
} from "@/lib/queries/employees";
import { filtreAngajatiSchema } from "@/schemas/employee";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { departamente as listaDepartamente } from "@/lib/queries/attendance";

import { ETICHETE_ROL_CONT, TONURI_STATUS, etichetaStare, rolAdministrativ } from "./etichete";
import { FiltreAngajati } from "./filtre-angajati";

export const metadata: Metadata = { title: "Angajați" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface ProprietatiTabel {
  readonly organizationId: string;
  readonly scope: "own" | "team" | "all";
  readonly userId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}

async function TabelAngajati({ organizationId, scope, userId, parametri }: ProprietatiTabel) {
  // `filtreDinUrl`, nu `.parse()`: `/angajati?limita=abc` arunca ZodError
  // necaptat — un ecran de eroare pentru o adresă editată de mână sau pentru
  // un link vechi. Comportamentul așteptat e lista nefiltrată.
  const filtre = filtreDinUrl(filtreAngajatiSchema, parametri);
  const propriaFisaId = scope === "all" ? null : await idFisaProprie(organizationId, userId);
  const { randuri, urmatorulCursor, total, sortare } = await listeazaAngajati({
    organizationId,
    scope,
    propriaFisaId,
    filtre,
  });

  if (randuri.length === 0) {
    // Textul recomandă ștergerea filtrelor, deci butonul trebuie să existe —
    // dar numai când chiar există filtre de șters.
    const areFiltre =
      filtre.q !== null ||
      filtre.department_id !== null ||
      filtre.job_position_id !== null ||
      filtre.status !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Users}
        titlu="Niciun angajat găsit"
        descriere="Nu există fișe care să corespundă filtrelor alese. Ștergeți filtrele sau adăugați primul angajat."
        {...(areFiltre ? { actiune: { eticheta: "Șterge filtrele", href: "/angajati" } } : {})}
      />
    );
  }

  // Rolurile conturilor legate de fișele DE PE PAGINA ASTA, nu de pe toate.
  // O singură interogare pentru tot tabelul, mărginită la id-urile din mână —
  // una pe rând ar fi făcut din coloana „Stare" un N+1.
  const roluri = await rolurileConturilor(
    organizationId,
    randuri.map((r) => r.user_id),
  );

  /**
   * Adresele se construiesc din parametrii EXISTENȚI, nu dintr-un obiect gol:
   * altfel o sortare ar șterge filtrele, iar o schimbare de mărime a paginii
   * ar șterge sortarea — exact defectul pe care îl aveau cele șase componente
   * de filtre ale produsului.
   */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/angajati" : `/angajati?${p.toString()}`;
  }

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "avatar",
      antet: "Fotografie",
      antetAscuns: true,
      peTelefon: "ascuns",
      latime: "ingusta",
      celula: (r) => <AvatarAngajat url={r.avatar_url} nume={r.full_name} marime="sm" />,
    },
    {
      cheie: "marca",
      antet: "Marcă",
      sortabil: true,
      peTelefon: "meta",
      celula: (r) => <span className="text-nota font-mono">{r.marca}</span>,
    },
    {
      cheie: "nume",
      antet: "Nume și prenume",
      sortabil: true,
      peTelefon: "titlu",
      celula: (r) => (
        <>
          <span className="font-medium">{r.full_name}</span>
          {r.is_primary ? null : (
            <span className="text-muted-foreground text-nota ml-2">(cumul de funcții)</span>
          )}
        </>
      ),
    },
    {
      cheie: "departament",
      antet: "Departament",
      peTelefon: "meta",
      celula: (r) => r.department?.denumire ?? "—",
    },
    {
      cheie: "functie",
      antet: "Funcție",
      peTelefon: "meta",
      celula: (r) => r.job_position?.denumire ?? "—",
    },
    {
      cheie: "angajat_din",
      antet: "Angajat din",
      sortabil: true,
      peTelefon: "meta",
      celula: (r) => (r.hired_on === null ? "—" : formatDate(r.hired_on)),
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (r) => {
        // Două insigne, fiindcă sunt două informații: ce poate face omul în
        // aplicație și în ce relație de muncă e cu firma. Vezi `./etichete.ts`.
        const rol = rolAdministrativ(roluri.get(r.user_id ?? "") ?? null);
        return (
          <span className="flex flex-wrap items-center gap-1">
            {rol === null ? null : <Badge ton="neutru">{ETICHETE_ROL_CONT[rol]}</Badge>}
            <Badge ton={TONURI_STATUS[r.status]}>{etichetaStare(r.status, rol)}</Badge>
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Lista angajaților din organizație"
        coloane={coloane}
        randuri={randuri}
        cheieRand={(r) => r.id}
        href={(r) => `/angajati/${r.id}`}
        sortare={sortare}
        hrefSortare={(s) =>
          adresa((p) => {
            p.set("sort", scrieSortare(s));
            // Cursorul nu supraviețuiește unei schimbări de sortare: ar continua
            // de la un rând care, în noua ordine, nu mai e acolo unde era.
            p.delete("cursor");
          })
        }
        gol={null}
      />
      <Paginare
        afisate={randuri.length}
        total={total}
        cursorUrmator={urmatorulCursor}
        limita={filtre.limita}
        construiesteHref={({ cursor, limita }) =>
          adresa((p) => {
            p.set("limita", String(limita));
            if (cursor === null) p.delete("cursor");
            else p.set("cursor", cursor);
          })
        }
      />
    </div>
  );
}

export default async function PaginaAngajati({ searchParams }: ProprietatiPagina) {
  const utilizator = await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  const scope = scopeFor(permisiuni, "employees:read");

  if (scope === null || scope === "none") {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta evidența de personal. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  // Aceleași filtre pe care le folosește lista: bara și tabelul de sub ea
  // arată o singură interpretare a adresei, nu două.
  const filtre = filtreDinUrl(filtreAngajatiSchema, parametri);

  /*
   * Cele două nomenclatoare, pentru filtrele care existau doar pe server.
   * `departamente()` stă în `queries/attendance.ts`, unde a fost scrisă pentru
   * filtrul de pontaj: e aceeași citire, cu aceeași formă, deci se refolosește
   * în loc să se dubleze. Amândouă întorc listă goală când firma n-are încă
   * nimic definit, iar bara ascunde atunci filtrul — două din cele trei firme
   * reale din sistem au zero angajați, deci starea „gol" e cea obișnuită.
   */
  const [departamente, functii] = await Promise.all([
    listaDepartamente(tenant.organizationId),
    functiiActive(tenant.organizationId),
  ]);
  const poateCrea = scopeFor(permisiuni, "employees:create") === "all";

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Angajați"
        descriere={
          scope === "own"
            ? "Vedeți propria fișă de personal."
            : scope === "team"
              ? "Vedeți fișele angajaților din subordinea dumneavoastră."
              : "Evidența completă de personal a organizației."
        }
        {...(poateCrea
          ? {
              actiuni: (
                <>
                  {/*
                   * `/angajati/import` n-avea NICIUN link în tot codul — o
                   * căutare după ruta lui în `src/` întorcea zero potriviri.
                   * Importul în masă din Excel există complet: are mapare de
                   * antete, validare pe rând, raport de erori și un întreg
                   * `src/domain/import/`. Se ajungea la el doar tastând adresa.
                   *
                   * Nu are condiție proprie: pagina cere exact
                   * `employees:create = "all"`, iar `poateCrea`, care guvernează
                   * deja blocul de acțiuni, e chiar asta. O verificare în plus
                   * pe scopul de CITIRE ar fi ascuns butonul cuiva pe care
                   * pagina l-ar fi primit — un buton care lipsește e la fel de
                   * greșit ca unul care duce în refuz, doar că se observă mai
                   * greu.
                   */}
                  <Link href="/angajati/import" className={buton({ varianta: "secundar" })}>
                    <Upload aria-hidden="true" className="size-4" />
                    Import din Excel
                  </Link>
                  <Link href="/angajati/nou" className={buton({ varianta: "primar" })}>
                    <UserPlus aria-hidden="true" className="size-4" />
                    Angajat nou
                  </Link>
                </>
              ),
            }
          : {})}
      />

      {/* Parametrii vin ca prop: bara de filtre e Server Component, iar
          `useSearchParams()` e hook de client. */}
      <FiltreAngajati filtre={filtre} departamente={departamente} functii={functii} />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={7} />}>
        <TabelAngajati
          organizationId={tenant.organizationId}
          scope={scope}
          userId={utilizator.id}
          parametri={parametri}
        />
      </Suspense>
    </div>
  );
}

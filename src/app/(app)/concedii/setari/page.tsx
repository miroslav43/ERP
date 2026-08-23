// src/app/(app)/concedii/setari/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { anDinUrl } from "@/lib/rute/parametri";
import { formatAmount } from "@/lib/format/money";
import { todayInBucharest } from "@/lib/format/date";
import {
  configurareConcedii,
  previzualizeazaDrepturi,
  type RandPrevizualizareDrept,
} from "@/lib/queries/leave";

import { NavConcedii } from "../nav-concedii";
import { FormularZileBaza } from "./formular-zile-baza";
import { TabelTipuriReglementate } from "./tabel-tipuri-reglementate";
import { CardTipAdaptabil } from "./card-tip-adaptabil";
import { TabelReguli } from "./tabel-reguli";
import { FormularRegulaNoua } from "./formular-regula-noua";
import { ButonAplicaDrepturi } from "./buton-aplica-drepturi";

export const metadata: Metadata = { title: "Setări concedii" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface AngajatMinim {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
}

/** Ancorat pe `#aplicare`, ca schimbarea anului să nu sară pagina la vârf. */
function SelectorAnAplicare({ an }: { readonly an: number }) {
  return (
    <nav aria-label="Anul de aplicat" className="text-corp flex items-center gap-3">
      <Link
        href={`/concedii/setari?an=${String(an - 1)}#aplicare`}
        className="underline underline-offset-2"
      >
        {an - 1}
      </Link>
      <span className="font-semibold">{an}</span>
      <Link
        href={`/concedii/setari?an=${String(an + 1)}#aplicare`}
        className="underline underline-offset-2"
      >
        {an + 1}
      </Link>
    </nav>
  );
}

export default async function PaginaSetariConcedii({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "leave");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "leave:update", "all")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a configura concediile. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const poateAproba = can(permisiuni, "leave:approve", "team");
  const poateVedeaCalendar = can(permisiuni, "leave:read", "team");

  const parametri = await searchParams;
  const an = anDinUrl(parametri["an"], Number(todayInBucharest().slice(0, 4)));

  const [{ tipuri, reguli, departamente, functii }, previzualizare] = await Promise.all([
    configurareConcedii(tenant.organizationId),
    previzualizeazaDrepturi(tenant.organizationId, an),
  ]);

  const db = await createServerSupabase();
  const { data: randOrganizatie } = await db
    .from("organizations")
    .select("zile_concediu_anual_implicit")
    .eq("id", tenant.organizationId)
    .maybeSingle<{ zile_concediu_anual_implicit: number }>();
  const zileBaza = randOrganizatie?.zile_concediu_anual_implicit ?? 20;

  const idAngajatiPreview = [...new Set(previzualizare.map((r) => r.employee_id))];
  const { data: dateAngajati } =
    idAngajatiPreview.length === 0
      ? { data: [] as AngajatMinim[] }
      : await db
          .from("employees")
          .select("id, full_name, marca")
          .eq("organization_id", tenant.organizationId)
          .in("id", idAngajatiPreview)
          .returns<AngajatMinim[]>();
  const hartaAngajati = new Map((dateAngajati ?? []).map((a) => [a.id, a]));
  const hartaTipuri = new Map(tipuri.map((t) => [t.id, t.denumire]));

  const tipuriReglementate = tipuri.filter((t) => t.reglementat);
  const tipuriAdaptabile = tipuri.filter((t) => !t.reglementat);

  const coloaneP: readonly Coloana<RandPrevizualizareDrept>[] = [
    {
      cheie: "angajat",
      antet: "Angajat",
      peTelefon: "titlu",
      celula: (rand) => {
        const angajat = hartaAngajati.get(rand.employee_id);
        return angajat === undefined ? "Angajat" : `${angajat.full_name} (${angajat.marca})`;
      },
    },
    {
      cheie: "tip",
      antet: "Tip de concediu",
      peTelefon: "meta",
      celula: (rand) => hartaTipuri.get(rand.leave_type_id) ?? "—",
    },
    {
      cheie: "drept_vechi",
      antet: "Drept vechi",
      numeric: true,
      peTelefon: "meta",
      celula: (rand) => formatAmount(rand.drept_vechi),
    },
    {
      cheie: "drept_nou",
      antet: "Drept nou",
      numeric: true,
      peTelefon: "meta",
      celula: (rand) => <span className="font-medium">{formatAmount(rand.drept_nou)}</span>,
    },
    {
      cheie: "ramase_dupa",
      antet: "Rămase după",
      numeric: true,
      peTelefon: "meta",
      celula: (rand) => (
        <span className={rand.ramase_dupa < 0 ? "text-danger" : ""}>
          {formatAmount(rand.ramase_dupa)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <AntetPagina
        titlu="Setări concedii"
        descriere="Regulile de mai jos se aplică AUTOMAT tuturor angajaților organizației. Tipurile reglementate legal (medical, maternitate, creștere copil, paternal, îngrijitor, donator de sânge) nu pot fi modificate din aplicație — durata lor vine direct din lege."
        file={
          <NavConcedii
            poateAproba={poateAproba}
            poateVedeaCalendar={poateVedeaCalendar}
            poateConfigura={true}
          />
        }
      />

      <section
        aria-labelledby="titlu-zile-baza"
        className="border-border rounded-panou space-y-3 border p-4"
      >
        <h2 id="titlu-zile-baza" className="text-sectiune font-medium">
          Zile de bază — concediu de odihnă
        </h2>
        <p className="text-muted-foreground text-corp">
          Minimul legal e de 20 de zile lucrătoare/an (Codul Muncii, art. 145 — de verificat de
          jurist). Valoarea se propagă automat spre tipul „Concediu de odihnă” de mai jos.
        </p>
        <FormularZileBaza zileCurente={zileBaza} />
      </section>

      <section aria-labelledby="titlu-tipuri" className="space-y-4">
        <h2 id="titlu-tipuri" className="text-sectiune font-medium">
          Tipuri de concediu
        </h2>

        <div className="space-y-2">
          <h3 className="text-muted-foreground text-corp font-semibold">
            Reglementate legal — doar activare/dezactivare
          </h3>
          <TabelTipuriReglementate tipuri={tipuriReglementate} />
        </div>

        <div className="space-y-3">
          <h3 className="text-muted-foreground text-corp font-semibold">
            Stabilite de companie — editabile
          </h3>
          {tipuriAdaptabile.length === 0 ? (
            <p className="text-muted-foreground text-corp">Niciun tip adaptabil configurat.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {tipuriAdaptabile.map((tip) => (
                <CardTipAdaptabil key={tip.id} tip={tip} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="titlu-grile" className="space-y-4">
        <h2 id="titlu-grile" className="text-sectiune font-medium">
          Grile de zile suplimentare
        </h2>
        <p className="text-muted-foreground text-corp">
          Zilele se ADUNĂ la baza tipului de concediu — un angajat poate întruni mai multe grile
          simultan (ex. vechime + condiții deosebite). Nu se pot adăuga grile pe tipurile
          reglementate legal.
        </p>
        <TabelReguli
          reguli={reguli}
          tipuri={tipuri}
          departamente={departamente}
          functii={functii}
        />
        <FormularRegulaNoua
          tipuri={tipuriAdaptabile}
          departamente={departamente}
          functii={functii}
        />
      </section>

      <section
        id="aplicare"
        aria-labelledby="titlu-aplicare"
        className="border-border rounded-panou space-y-4 border p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="titlu-aplicare" className="text-sectiune font-medium">
              Aplicarea drepturilor pe angajați
            </h2>
            <p className="text-muted-foreground text-corp max-w-2xl">
              Salvarea unei reguli de mai sus NU schimbă automat soldurile angajaților existenți.
              Alegeți anul, verificați diferențele, apoi aplicați.
            </p>
          </div>
          <SelectorAnAplicare an={an} />
        </div>

        {previzualizare.length === 0 ? (
          <p className="text-muted-foreground text-corp">
            Nicio diferență pentru anul {String(an)} — soldurile existente sunt deja aliniate cu
            regulile curente.
          </p>
        ) : (
          <>
            <Tabel
              caption={`Diferențele de drept de concediu pentru anul ${String(an)}.`}
              coloane={coloaneP}
              randuri={previzualizare}
              cheieRand={(rand) => `${rand.employee_id}-${rand.leave_type_id}`}
              densitate="compact"
              gol={null}
            />
            <ButonAplicaDrepturi an={an} nrModificari={previzualizare.length} />
          </>
        )}
      </section>
    </div>
  );
}

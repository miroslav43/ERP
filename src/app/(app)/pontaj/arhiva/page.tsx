// src/app/(app)/pontaj/arhiva/page.tsx
//
// Arhiva lunară a pontajului — ecranul de dus la un control ITM.
//
// ── DE CE LUNILE FĂRĂ ARHIVĂ APAR CA RÂNDURI ────────────────────────────────
// Ar fi fost mai simplu să listez doar ce există. Dar întrebarea la care
// răspunde ecranul ăsta nu e „ce am arhivat", ci „ce NU am arhivat" — o lună
// care lipsește dintr-o listă de luni prezente nu se vede, iar o gaură care nu
// se vede o găsește inspectorul. Deci fereastra de cinci ani se desenează
// întreagă, lună cu lună, și fiecare rând spune ce e cu el.
//
// ── DE CE FORMULARUL DOSARULUI N-ARE JAVASCRIPT ─────────────────────────────
// E un `<form method="get">` care trimite direct spre ruta de export. Fără
// `useTransition`, fără stare de client, fără hidratare: alegi două luni, apeși,
// browserul descarcă. Aceeași alegere ca la `ComutatorVizualizare` — starea stă
// în adresă, nu într-un `useState`.
//
// ── POARTA ──────────────────────────────────────────────────────────────────
// `attendance:export` la scope `all`, nu `attendance:read`. Arhiva e a întregii
// firme: un `manager` cu `read = team` ar fi deschis ecranul și ar fi văzut o
// listă goală, fără nicio eroare — exact refuzul tăcut pe care restul modulului
// îl vânează.
import { Suspense } from "react";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge, type TonStare } from "@/components/ui/badge";
import { Buton } from "@/components/ui/buton";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime, todayInBucharest } from "@/lib/format/date";
import { ANI_PASTRARE, listeazaArhivePontaj } from "@/lib/queries/pontaj-arhiva";
import { etichetaLuna, numeLuna } from "@/lib/excel/foaie-colectiva";

import { NavPontaj } from "../nav-pontaj";
import { fileDePontaj } from "../file-pontaj";

export const metadata: Metadata = { title: "Arhiva pontajului" };

/** Câte luni desenează ecranul: fereastra de păstrare, inclusiv luna curentă. */
const LUNI_FEREASTRA = ANI_PASTRARE * 12;

interface Luna {
  readonly an: number;
  readonly luna: number;
}

/** Fereastra, de la luna curentă înapoi. Cea mai recentă prima. */
function fereastraLunilor(azi: string): readonly Luna[] {
  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));
  const indiceAzi = an * 12 + (luna - 1);

  return Array.from({ length: LUNI_FEREASTRA }, (_, i) => {
    const indice = indiceAzi - i;
    return { an: Math.floor(indice / 12), luna: (indice % 12) + 1 };
  });
}

interface RandArhiva extends Luna {
  readonly id: string | null;
  readonly numarAfisat: string | null;
  readonly generatLa: string | null;
  readonly numarAngajati: number | null;
  readonly totalOre: number | null;
  readonly eraBlocata: boolean;
  readonly versiune: number | null;
  readonly esteLunaCurenta: boolean;
}

async function TabelArhiva({ organizationId }: { readonly organizationId: string }) {
  const azi = todayInBucharest();
  const fereastra = fereastraLunilor(azi);
  const ceaMaiVeche = fereastra[fereastra.length - 1];
  const ceaMaiNoua = fereastra[0];
  if (ceaMaiVeche === undefined || ceaMaiNoua === undefined) return null;

  const arhive = await listeazaArhivePontaj(organizationId, ceaMaiVeche.an, ceaMaiNoua.an);
  const dupaLuna = new Map(arhive.map((a) => [a.an * 12 + a.luna, a]));

  const randuri: readonly RandArhiva[] = fereastra.map((l) => {
    const a = dupaLuna.get(l.an * 12 + l.luna);
    return {
      ...l,
      id: a?.id ?? null,
      numarAfisat: a?.numarAfisat ?? null,
      generatLa: a?.generat_la ?? null,
      numarAngajati: a?.numar_angajati ?? null,
      totalOre: a?.total_ore ?? null,
      eraBlocata: a?.status_perioada === "blocata",
      versiune: a?.versiune ?? null,
      esteLunaCurenta: l.an === ceaMaiNoua.an && l.luna === ceaMaiNoua.luna,
    };
  });

  const stare = (rand: RandArhiva): { readonly ton: TonStare; readonly text: string } => {
    if (rand.id === null) {
      // Luna curentă nu e o gaură: încă se pontează în ea, iar arhiva vine la
      // blocare sau la mătura de pe 15 a lunii următoare.
      return rand.esteLunaCurenta
        ? { ton: "neutru", text: "În curs" }
        : { ton: "pericol", text: "Fără arhivă" };
    }
    return rand.eraBlocata
      ? { ton: "succes", text: "Arhivată" }
      : { ton: "atentie", text: "Arhivată, luna neblocată" };
  };

  const coloane: readonly Coloana<RandArhiva>[] = [
    {
      cheie: "luna",
      antet: "Luna",
      peTelefon: "titlu",
      celula: (rand) => (
        <span className="font-medium">
          {numeLuna(rand.luna)} {rand.an}
          {rand.versiune !== null && rand.versiune > 1 ? (
            <span className="text-muted-foreground text-nota"> · versiunea {rand.versiune}</span>
          ) : null}
        </span>
      ),
    },
    {
      cheie: "numar",
      antet: "Nr. înregistrare",
      peTelefon: "meta",
      celula: (rand) => (
        <span className="text-muted-foreground tabular-nums">{rand.numarAfisat ?? "—"}</span>
      ),
    },
    {
      cheie: "arhivat",
      antet: "Arhivat la",
      peTelefon: "meta",
      celula: (rand) => (
        <span className="text-muted-foreground">
          {rand.generatLa === null ? "—" : formatDateTime(rand.generatLa)}
        </span>
      ),
    },
    {
      cheie: "angajati",
      antet: "Angajați",
      numeric: true,
      peTelefon: "meta",
      celula: (rand) => (rand.numarAngajati === null ? "—" : rand.numarAngajati),
    },
    {
      cheie: "ore",
      antet: "Total ore",
      numeric: true,
      peTelefon: "meta",
      celula: (rand) => (rand.totalOre === null ? "—" : rand.totalOre),
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (rand) => {
        const s = stare(rand);
        return <Badge ton={s.ton}>{s.text}</Badge>;
      },
    },
    {
      cheie: "descarcare",
      antet: "Descărcare",
      antetAscuns: true,
      latime: "ingusta",
      peTelefon: "insigna",
      celula: (rand) =>
        rand.id === null ? null : (
          // `<a>`, nu `Link`: ținta e o rută de API care întoarce un fișier, nu
          // o pagină de navigat. `Link` ar fi încercat prefetch peste ea.
          <a
            href={`/api/export/pontaj/arhiva?id=${rand.id}`}
            className="underline underline-offset-2"
          >
            Excel
          </a>
        ),
    },
  ];

  return (
    <Tabel
      caption={`Lunile de pontaj din ultimii ${String(ANI_PASTRARE)} ani, cu starea arhivei fiecăreia.`}
      coloane={coloane}
      randuri={randuri}
      cheieRand={(rand) => etichetaLuna(rand.an, rand.luna)}
      gol={null}
    />
  );
}

function FormularDosar({ fereastra }: { readonly fereastra: readonly Luna[] }) {
  const optiuni = fereastra.map((l) => ({
    valoare: `${String(l.an)}-${String(l.luna).padStart(2, "0")}`,
    eticheta: `${numeLuna(l.luna)} ${String(l.an)}`,
  }));
  const prima = optiuni[optiuni.length - 1]?.valoare ?? "";
  const ultima = optiuni[0]?.valoare ?? "";

  const clase =
    "border-border bg-background text-corp h-9 rounded-md border px-2 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none";

  return (
    <form
      action="/api/export/pontaj/arhiva/dosar"
      method="get"
      className="border-border bg-surface flex flex-wrap items-end gap-3 rounded-lg border p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="dosar-de-la" className="text-nota text-muted-foreground">
          De la
        </label>
        <select id="dosar-de-la" name="de_la" defaultValue={prima} className={clase}>
          {optiuni.map((o) => (
            <option key={o.valoare} value={o.valoare}>
              {o.eticheta}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="dosar-pana-la" className="text-nota text-muted-foreground">
          Până la
        </label>
        <select id="dosar-pana-la" name="pana_la" defaultValue={ultima} className={clase}>
          {optiuni.map((o) => (
            <option key={o.valoare} value={o.valoare}>
              {o.eticheta}
            </option>
          ))}
        </select>
      </div>

      <Buton type="submit" varianta="primar">
        Descarcă dosarul
      </Buton>

      <p className="text-nota text-muted-foreground basis-full">
        Un singur fișier Excel, cu o filă de cuprins și câte o filă pe lună. Cuprinsul poartă
        numerele de înregistrare și amprentele, ca dosarul să se poată verifica fără aplicație.
      </p>
    </form>
  );
}

export default async function PaginaArhivaPontaj() {
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "attendance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "attendance:export", "all")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta arhiva de pontaj. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const fileNav = await fileDePontaj(tenant.organizationId, permisiuni);
  const fereastra = fereastraLunilor(todayInBucharest());

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Arhiva pontajului"
        descriere={`Foile colective de prezență ale ultimilor ${String(ANI_PASTRARE)} ani, înghețate la închiderea fiecărei luni.`}
        file={<NavPontaj {...fileNav} />}
      />

      <FormularDosar fereastra={fereastra} />

      <Suspense fallback={<Schelet forma="tabel" coloane={7} />}>
        <TabelArhiva organizationId={tenant.organizationId} />
      </Suspense>
    </div>
  );
}

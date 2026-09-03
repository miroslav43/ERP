// src/app/(app)/flota/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { Car } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Scadenta } from "@/components/ui/scadenta";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import {
  stareScadentaFlota,
  stareScadentaVehicul,
  type StareScadentaFlota,
} from "@/domain/fleet/scadente";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { scrieSortare } from "@/lib/queries/cursor";
import { listeazaVehicule, scadenteCurente, tipuriDocument } from "@/lib/queries/fleet";
import { filtreVehiculeSchema } from "@/schemas/fleet";

import {
  ETICHETE_CATEGORIE,
  ETICHETE_SCADENTA,
  ETICHETE_STATUS_VEHICUL,
  TONURI_STATUS_VEHICUL,
} from "./etichete";
import { DialogVehiculNou } from "./dialog-vehicul-nou";
import { FiltreVehicule } from "./filtre-vehicule";
import { NavFlota } from "./nav-flota";

export const metadata: Metadata = { title: "Parc auto" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelVehicule({
  organizationId,
  parametri,
  poateAdauga,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
  readonly poateAdauga: boolean;
}) {
  const filtre = filtreDinUrl(filtreVehiculeSchema, parametri);
  const { randuri, urmatorulCursor, total, sortare } = await listeazaVehicule(
    organizationId,
    filtre,
  );

  /**
   * Adresele se construiesc din parametrii EXISTENȚI, nu dintr-un obiect gol:
   * altfel o sortare ar șterge filtrele, iar o schimbare de mărime a paginii ar
   * șterge sortarea.
   */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/flota" : `/flota?${p.toString()}`;
  }

  if (randuri.length === 0) {
    // Mesajul diferă după cauză: „niciun vehicul” cere o acțiune, „niciun
    // rezultat” cere doar ștergerea filtrelor. Un singur text pentru amândouă
    // l-ar trimite pe om să adauge un vehicul care există deja.
    const areFiltre = filtre.status !== null || filtre.categorie !== null || filtre.cauta !== null;
    // „Șterge filtrele” scoate DOAR cheile de filtrare, aceleași pe care le
    // administrează `<FiltreVehicule>`. Un `href="/flota"` sec ar fi luat cu el
    // și sortarea coloanelor, și mărimea paginii.
    const faraFiltre = adresa((p) => {
      p.delete("cauta");
      p.delete("status");
      p.delete("categorie");
      p.delete("cursor");
    });
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Car}
        titlu={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun vehicul înregistrat"}
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți întregul parc auto."
            : "Adăugați primul vehicul ca să puteți urmări ITP-ul, RCA-ul și foile de parcurs."
        }
        {...(areFiltre
          ? { actiune: { eticheta: "Șterge filtrele", href: faraFiltre } }
          : poateAdauga
            ? // `/flota/nou` a dispărut: formularul e o casetă pe pagina asta.
              // Parametrul o deschide, exact ca `?cerere=noua` la concedii.
              { actiune: { eticheta: "Adaugă vehicul", href: "/flota?vehicul=nou" } }
            : {})}
      />
    );
  }

  const [scadente, tipuri] = await Promise.all([
    scadenteCurente(randuri.map((v) => v.id)),
    tipuriDocument(),
  ]);
  const azi = todayInBucharest();
  const denumireTip = new Map(tipuri.map((t) => [t.id, t.denumire]));
  const tipuriObligatorii = tipuri.filter((t) => t.obligatoriu);

  /*
   * ── DE CE NU MAI E „CEA MAI APROPIATĂ SCADENȚĂ” ──────────────────────────
   * Vechiul calcul lua prima dată de expirare dintre documentele EXISTENTE ale
   * vehiculului. Un vehicul fără RCA deloc, dar cu ITP valabil doi ani, ieșea
   * „În regulă”: tipul obligatoriu fără document nu are niciun rând în
   * `vehicle_documents`, deci nu putea intra niciodată în comparație. Semaforul
   * arăta verde exact în cazul cel mai grav — și numai fișa vehiculului, care
   * listează TIPURILE, spunea adevărul.
   *
   * Acum se pornește de la nomenclator: fiecare tip obligatoriu contribuie cu
   * data lui sau cu `null`, iar în flotă `null` înseamnă `lipsa` — treapta cea
   * mai gravă, deasupra lui `expirat`. Documentele neobligatorii pe care
   * vehiculul chiar le are rămân în calcul: o rovinietă expirată se vede.
   */
  const semafor = new Map<
    string,
    Readonly<{ treapta: StareScadentaFlota; tipId: string | null; expiraLa: string | null }>
  >();

  for (const v of randuri) {
    const aleLui = scadente.filter((s) => s.vehicle_id === v.id);
    const dupaTip = new Map(aleLui.map((s) => [s.document_type_id, s]));

    const intrari: readonly Readonly<{ tipId: string; expiraLa: string | null }>[] = [
      ...tipuriObligatorii.map((t) => ({
        tipId: t.id,
        expiraLa: dupaTip.get(t.id)?.expira_la ?? null,
      })),
      ...aleLui
        .filter((s) => !tipuriObligatorii.some((t) => t.id === s.document_type_id))
        .map((s) => ({ tipId: s.document_type_id, expiraLa: s.expira_la })),
    ];

    const treapta = stareScadentaVehicul(
      intrari.map((i) => i.expiraLa),
      azi,
    );

    // Ce document POARTĂ treapta: dintre cele care sunt pe aceeași treaptă, cel
    // cu termenul cel mai apropiat. Fără el, coloana „Document” ar fi numit un
    // act care nu are legătură cu culoarea de alături.
    const purtator =
      intrari
        .filter((i) => stareScadentaFlota(i.expiraLa, azi) === treapta)
        .sort((a, b) => (a.expiraLa ?? "").localeCompare(b.expiraLa ?? ""))[0] ?? null;

    semafor.set(v.id, {
      treapta,
      tipId: purtator?.tipId ?? null,
      expiraLa: purtator?.expiraLa ?? null,
    });
  }

  /**
   * Pastila de scadență, tipul documentului și data lui erau înghesuite într-o
   * singură celulă. Despărțite, se pot compara pe verticală: cine caută
   * „ce expiră” citește o coloană, nu trei valori lipite în fiecare rând.
   */
  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "numar",
      antet: "Număr",
      sortabil: true,
      peTelefon: "titlu",
      celula: (v) => <span className="font-medium">{v.nr_inmatriculare}</span>,
    },
    {
      cheie: "marca",
      antet: "Vehicul",
      sortabil: true,
      peTelefon: "meta",
      celula: (v) => (
        <>
          {v.marca} {v.model}
          {v.an_fabricatie === null ? null : (
            <span className="text-muted-foreground"> · {v.an_fabricatie}</span>
          )}
        </>
      ),
    },
    {
      cheie: "categorie",
      antet: "Categorie",
      peTelefon: "meta",
      celula: (v) => ETICHETE_CATEGORIE[v.categorie],
    },
    {
      cheie: "km",
      antet: "Kilometraj",
      sortabil: true,
      numeric: true,
      peTelefon: "meta",
      celula: (v) => `${v.km_curent.toLocaleString("ro-RO")} km`,
    },
    {
      cheie: "stare",
      antet: "Stare",
      sortabil: true,
      peTelefon: "insigna",
      celula: (v) => (
        <Badge ton={TONURI_STATUS_VEHICUL[v.status]}>{ETICHETE_STATUS_VEHICUL[v.status]}</Badge>
      ),
    },
    {
      cheie: "scadenta",
      antet: "Conformitate",
      peTelefon: "insigna",
      celula: (v) => {
        // Treapta o calculează DOMENIUL flotei, nu pastila: aici `null` (niciun
        // document) înseamnă `lipsa`, mai grav decât `expirat` — la SSM același
        // `null` înseamnă „nu expiră niciodată”. Cele patru stări ale flotei
        // sunt patru dintre cele șase trepte unificate, cu aceleași nume, deci
        // compilatorul e cel care ține traducerea corectă.
        const stare = semafor.get(v.id)?.treapta ?? "lipsa";
        return <Scadenta treapta={stare}>{ETICHETE_SCADENTA[stare]}</Scadenta>;
      },
    },
    {
      cheie: "document",
      antet: "Document",
      peTelefon: "meta",
      celula: (v) => {
        const tipId = semafor.get(v.id)?.tipId ?? null;
        return tipId === null ? "—" : (denumireTip.get(tipId) ?? "document");
      },
    },
    {
      cheie: "expira",
      antet: "Expiră",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (v) => {
        // Singurul loc din modul care mai randa o dată ISO brută („2026-09-01”).
        // `formatDate` dă „01.09.2026”, convenția pe care o folosește fișa.
        const expiraLa = semafor.get(v.id)?.expiraLa ?? null;
        return expiraLa === null ? "—" : formatDate(expiraLa);
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Vehiculele organizației, cu documentul care le ține în cea mai gravă stare de conformitate."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(v) => v.id}
        href={(v) => `/flota/${v.id}`}
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

export default async function PaginaFlota({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  // `can(..., "own")` și nu `scopeFor(...) !== null`: scope-ul „none” e refuz
  // explicit ȘI e truthy, deci a doua formă ar lăsa poarta deschisă.
  if (!can(permisiuni, "vehicles:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta parcul auto. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const scope = scopeFor(permisiuni, "vehicles:read");
  const poateAdauga = can(permisiuni, "vehicles:create", "all");
  // Ținut în afara lui `filtreVehiculeSchema`: nu e un filtru al listei, e
  // adresa fostei rute `/flota/nou`. Starea goală trimite aici, iar `key`-ul de
  // mai jos forțează remontarea casetei — o navigare pe ACEEAȘI rută păstrează
  // altfel starea clientului, iar caseta n-ar mai apărea.
  const deschideCaseta = parametri["vehicul"] === "nou";

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Parc auto"
        descriere={
          scope === "all"
            ? "Toate vehiculele organizației, cu documentul care expiră primul."
            : "Vehiculele la care aveți acces, cu documentul care expiră primul."
        }
        {...(poateAdauga
          ? {
              actiuni: (
                <DialogVehiculNou
                  key={deschideCaseta ? "vehicul-nou" : "listă"}
                  deschisInitial={deschideCaseta}
                />
              ),
            }
          : {})}
        file={
          <NavFlota
            poateVedeaFoi={can(permisiuni, "trip_sheets:read", "own")}
            poateAproba={can(permisiuni, "trip_sheets:approve", "team")}
            poateVedeaAnomalii={can(permisiuni, "vehicles:update", "team")}
          />
        }
      />

      <FiltreVehicule parametri={parametri} />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={8} />}>
        <TabelVehicule
          organizationId={tenant.organizationId}
          parametri={parametri}
          poateAdauga={poateAdauga}
        />
      </Suspense>
    </div>
  );
}

// src/app/(app)/mentenanta/sesizari/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { Wrench } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { scrieSortare } from "@/lib/queries/cursor";
import {
  angajatiDupaId,
  echipamenteDupaId,
  optiuniAngajati,
  sesizari,
} from "@/lib/queries/maintenance";
import { fisaMea } from "@/lib/queries/portal";
import { filtreSesizariSchema } from "@/schemas/maintenance";
import { esteDeschisa } from "@/domain/maintenance/sesizari";

import {
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_URGENTA_SESIZARE,
  TONURI_STATUS_SESIZARE,
  TONURI_URGENTA_SESIZARE,
} from "../etichete";
import { cautaEchipament } from "../actions";
import { ButonPreiau } from "./buton-preiau";
import { DialogSesizareNoua } from "./dialog-sesizare-noua";
import { FiltreSesizariForm } from "./filtre-sesizari";
import { FileModul } from "@/components/ui/file-modul";
import { FILE_MENTENANTA } from "@/config/file-module";

export const metadata: Metadata = { title: "Sesizări de defecțiune" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelSesizari({
  organizationId,
  parametri,
  fisaId,
  poatePrelua,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
  readonly fisaId: string | null;
  /** Gestionar cu fișă: butonul „Preiau eu” pe rândurile neatribuite. */
  readonly poatePrelua: boolean;
}) {
  const filtre = filtreDinUrl(filtreSesizariSchema, parametri);
  const { randuri, urmatorulCursor, total, sortare } = await sesizari(
    organizationId,
    filtre,
    fisaId,
  );

  /** Adresele pornesc din parametrii EXISTENȚI: o sortare nu trebuie să șteargă filtrele. */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/mentenanta/sesizari" : `/mentenanta/sesizari?${p.toString()}`;
  }

  if (randuri.length === 0) {
    const areFiltre =
      filtre.status !== null ||
      filtre.urgenta !== null ||
      filtre.echipament !== null ||
      filtre.atribuit !== null ||
      filtre.deschise !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Wrench}
        titlu={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Nicio sesizare înregistrată"}
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate sesizările."
            : "Sesizările apar aici pe măsură ce echipa raportează defecțiuni."
        }
        {...(areFiltre
          ? {
              actiune: {
                eticheta: "Șterge filtrele",
                // Nu `/mentenanta/sesizari` gol: butonul ăsta șterge FILTRELE, nu
                // ordinea aleasă din antet și nici mărimea de pagină. `echipament`
                // intră și el, fiindcă textul promite „toate sesizările”.
                href: adresa((p) => {
                  for (const cheie of [
                    "status",
                    "urgenta",
                    "echipament",
                    "atribuit",
                    "deschise",
                    "cursor",
                  ]) {
                    p.delete(cheie);
                  }
                }),
              },
            }
          : {})}
      />
    );
  }

  const [echipamente, tehnicieni] = await Promise.all([
    echipamenteDupaId(
      organizationId,
      randuri.map((r) => r.equipment_id),
    ),
    angajatiDupaId(
      organizationId,
      randuri.map((r) => r.atribuit_employee_id).filter((v): v is string => v !== null),
    ),
  ]);

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "numar",
      antet: "Nr.",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (s) => <span className="text-muted-foreground tabular-nums">{s.numar}</span>,
    },
    {
      cheie: "echipament",
      antet: "Echipament",
      peTelefon: "titlu",
      celula: (s) => {
        const echipament = echipamente.get(s.equipment_id);
        return (
          <span className="font-medium">
            {echipament === undefined
              ? "Echipament necunoscut"
              : `${echipament.cod} — ${echipament.denumire}`}
          </span>
        );
      },
    },
    {
      /*
       * `opreste_functionarea` e singurul semnal care spune „utilajul nu produce
       * acum”, adică exact ce decide ce se ia primul dintr-o coadă de triaj.
       */
      cheie: "oprit",
      antet: "Utilaj",
      latime: "ingusta",
      peTelefon: "insigna",
      celula: (s) =>
        s.opreste_functionarea ? (
          <Badge ton="pericol" cuAvertisment>
            Oprit
          </Badge>
        ) : (
          <span className="text-muted-foreground">Funcționează</span>
        ),
    },
    {
      cheie: "descriere",
      antet: "Descriere",
      peTelefon: "meta",
      celula: (s) => s.descriere,
    },
    {
      cheie: "raportat",
      antet: "Raportată la",
      sortabil: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (s) => formatDateTime(s.raportat_la),
    },
    {
      cheie: "urgenta",
      antet: "Urgență",
      sortabil: true,
      peTelefon: "insigna",
      celula: (s) => (
        <Badge ton={TONURI_URGENTA_SESIZARE[s.urgenta]}>
          {ETICHETE_URGENTA_SESIZARE[s.urgenta]}
        </Badge>
      ),
    },
    {
      cheie: "stare",
      antet: "Stare",
      sortabil: true,
      peTelefon: "insigna",
      celula: (s) => (
        <Badge ton={TONURI_STATUS_SESIZARE[s.status]}>{ETICHETE_STATUS_SESIZARE[s.status]}</Badge>
      ),
    },
    {
      cheie: "atribuit",
      antet: "Tehnician",
      peTelefon: "actiuni",
      celula: (s) => {
        if (s.atribuit_employee_id !== null) {
          const nume = tehnicieni.get(s.atribuit_employee_id)?.full_name ?? "Atribuită";
          return (
            <span className={s.atribuit_employee_id === fisaId ? "font-medium" : undefined}>
              {s.atribuit_employee_id === fisaId ? `${nume} (dvs.)` : nume}
            </span>
          );
        }
        if (poatePrelua && esteDeschisa(s.status)) return <ButonPreiau sesizareId={s.id} />;
        return <span className="text-muted-foreground">Neatribuită</span>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Sesizările de defecțiune ale organizației."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(s) => s.id}
        href={(s) => `/mentenanta/sesizari/${s.id}`}
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

export default async function PaginaSesizari({ searchParams }: ProprietatiPagina) {
  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "maintenance:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta sesizările de defecțiune. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  // Aceeași validare ca a tabelului, refăcută aici fiindcă e pură: bara de
  // filtre are nevoie de valorile CURENTE ca să-și scrie pastilele, iar din
  // parametrii bruți ar putea scrie o pastilă cu o valoare inventată din URL.
  const filtre = filtreDinUrl(filtreSesizariSchema, parametri);
  const poateGestiona = can(permisiuni, "maintenance:update", "team");
  const poateRaporta = can(permisiuni, "maintenance:create", "own");
  const deschideCaseta = parametri["sesizare"] === "noua";
  const echipamentBrut =
    typeof parametri["echipament"] === "string" && parametri["echipament"].length > 0
      ? parametri["echipament"]
      : null;

  /*
   * Denumirea echipamentului filtrat, DOAR ca să existe o pastilă cu ieșire.
   * `echipament` e cheia pusă de codul QR de pe utilaj: lista deschisă de pe
   * telefonul cuiva din hală e filtrată la o singură mașină, iar fără pastilă
   * filtrul era invizibil ȘI de neșters.
   *
   * Caseta „Sesizare nouă" (fosta rută `/sesizari/noua`): `?sesizare=noua` o
   * deschide, iar `?echipament=<id>` o precompletează. Echipamentul se rezolvă
   * AICI, pe server, prin aceeași acțiune pe care o folosește căutarea din
   * casetă (un `employee` nu poate citi `equipment` direct, capcana #27).
   */
  const [stareFisa, etichetaEchipament, prefill, tehnicieni] = await Promise.all([
    fisaMea(tenant.organizationId, user.id),
    filtre.echipament === null
      ? Promise.resolve(null)
      : echipamenteDupaId(tenant.organizationId, [filtre.echipament]).then(
          (h) => h.get(filtre.echipament ?? "")?.cod ?? null,
        ),
    poateRaporta && deschideCaseta && filtre.echipament !== null
      ? cautaEchipament({ q: filtre.echipament })
      : Promise.resolve(null),
    // Selectorul de tehnician din bară: pentru gestionar, toți angajații; un
    // angajat obișnuit primește sub RLS doar fișa lui — i-ar dubla opțiunea
    // „Atribuite mie”, deci nu i se dă lista.
    poateGestiona ? optiuniAngajati(tenant.organizationId) : Promise.resolve([]),
  ]);
  const fisaId = stareFisa.stare === "ok" ? stareFisa.fisa.id : null;
  // Avertismentul de duplicat vine cu echipamentul (`sesizare_deschisa`), din
  // aceeași acțiune: omul vede „SZ-… e deja deschisă” și decide dacă trimite oricum.
  const echipamentPrefill = prefill !== null && prefill.ok ? (prefill.data[0] ?? null) : null;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Sesizări de defecțiune"
        descriere="Defecțiunile raportate, cu starea lor de triaj și rezolvare."
        {...(poateRaporta
          ? {
              actiuni: (
                /*
                  `key` legat de parametri: o navigare spre `?sesizare=noua` rămâne
                  pe ACEEAȘI rută, deci fără el React n-ar remonta caseta și
                  `deschisInitial` n-ar mai fi citit.
                */
                <DialogSesizareNoua
                  key={deschideCaseta ? `sesizare-noua:${echipamentBrut ?? ""}` : "lista"}
                  deschisInitial={deschideCaseta}
                  echipamentPrefill={echipamentPrefill}
                  prefillEsuat={
                    deschideCaseta && echipamentBrut !== null && echipamentPrefill === null
                  }
                  zona="app"
                />
              ),
            }
          : {})}
        file={<FileModul eticheta="Navigare mentenanță" file={FILE_MENTENANTA} tenant={tenant} />}
      />

      <FiltreSesizariForm
        filtre={filtre}
        {...(etichetaEchipament === null ? {} : { etichetaEchipament })}
        tehnicieni={tehnicieni}
        areFisa={fisaId !== null}
      />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={6} />}>
        <TabelSesizari
          organizationId={tenant.organizationId}
          parametri={parametri}
          fisaId={fisaId}
          poatePrelua={poateGestiona && fisaId !== null}
        />
      </Suspense>
    </div>
  );
}

// src/app/(app)/mentenanta/iscir/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { FileDown, ShieldCheck } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { FileModul } from "@/components/ui/file-modul";
import { Paginare } from "@/components/ui/paginare";
import { Scadenta } from "@/components/ui/scadenta";
import { Schelet } from "@/components/ui/schelet";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { FILE_MENTENANTA } from "@/config/file-module";
import { poateDeschide } from "@/config/porti-ruta";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { getEnabledFeatures, requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import {
  echipamenteDupaId,
  listeazaAutorizatiiIscir,
  stareRsvti,
  tipuriAutorizatiiIscir,
} from "@/lib/queries/maintenance";
import {
  ETICHETE_REGIM_ISCIR,
  ETICHETE_STARE_AUTORIZATIE,
  TREPTE_STARE_AUTORIZATIE,
  avertismentMaximLegal,
  etichetaTipIscir,
  lipsesteRsvti,
  stareAutorizatie,
} from "@/domain/maintenance/iscir";
import { filtreAutorizatiiSchema } from "@/schemas/maintenance";

import { textNumarat } from "../etichete";
import { FiltreAutorizatiiForm } from "./filtre-autorizatii";

export const metadata: Metadata = { title: "Autorizații ISCIR" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Adresele pornesc din parametrii EXISTENȚI: paginarea nu șterge filtrele. */
function adresa(
  parametri: Record<string, string | string[] | undefined>,
  schimba: (p: URLSearchParams) => void,
): string {
  const p = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
  }
  schimba(p);
  return p.size === 0 ? "/mentenanta/iscir" : `/mentenanta/iscir?${p.toString()}`;
}

async function TabelAutorizatii({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreAutorizatiiSchema, parametri);
  const { randuri, urmatorulCursor, total } = await listeazaAutorizatiiIscir(
    organizationId,
    filtre,
  );

  if (randuri.length === 0) {
    const areFiltre =
      filtre.stare !== null ||
      filtre.regim !== null ||
      filtre.tip !== null ||
      filtre.echipament !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={ShieldCheck}
        titlu={areFiltre ? "Nicio autorizație pentru filtrele alese" : "Nicio autorizație ISCIR"}
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate autorizațiile curente."
            : "Autorizațiile se adaugă din fișa fiecărui echipament sub incidența ISCIR."
        }
        {...(areFiltre
          ? {
              actiune: {
                eticheta: "Șterge filtrele",
                href: adresa(parametri, (p) => {
                  p.delete("stare");
                  p.delete("regim");
                  p.delete("tip");
                  p.delete("echipament");
                  p.delete("cursor");
                }),
              },
            }
          : {})}
      />
    );
  }

  const azi = todayInBucharest();
  const echipamente = await echipamenteDupaId(
    organizationId,
    randuri.map((r) => r.equipment_id),
  );

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "echipament",
      antet: "Echipament",
      peTelefon: "titlu",
      celula: (a) => {
        const e = echipamente.get(a.equipment_id);
        return e === undefined ? "Echipament indisponibil" : `${e.cod} — ${e.denumire}`;
      },
    },
    {
      cheie: "tip",
      antet: "Tip",
      peTelefon: "meta",
      celula: (a) => etichetaTipIscir(a.tip),
    },
    {
      cheie: "numar",
      antet: "Număr",
      peTelefon: "meta",
      celula: (a) => a.numar ?? ETICHETE_REGIM_ISCIR[a.regim],
    },
    {
      cheie: "valabil_pana",
      antet: "Valabilă până la",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (a) => formatDate(a.valabil_pana),
    },
    {
      cheie: "vtp",
      antet: "Următoarea VTP",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (a) => {
        const avertisment = avertismentMaximLegal(a);
        const data =
          a.scadenta_verificare_tehnica === null ? "—" : formatDate(a.scadenta_verificare_tehnica);
        // Documentul are prioritate (cazul 40); peste maximul legal doar semnalăm.
        return avertisment === null ? data : `${data} ⚠ peste maximul legal`;
      },
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (a) => {
        const stare = stareAutorizatie(a, azi);
        return (
          <Scadenta treapta={TREPTE_STARE_AUTORIZATIE[stare]}>
            {ETICHETE_STARE_AUTORIZATIE[stare]}
          </Scadenta>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Autorizațiile ISCIR curente ale organizației, cele care expiră primele sus."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(a) => a.id}
        // Gesturile (corectare, reînnoire, suspendare) stau pe fișa echipamentului.
        href={(a) => `/mentenanta/echipamente/${a.equipment_id}#iscir`}
        gol={null}
      />
      <Paginare
        afisate={randuri.length}
        total={total}
        cursorUrmator={urmatorulCursor}
        limita={filtre.limita}
        construiesteHref={({ cursor, limita }) =>
          adresa(parametri, (p) => {
            p.set("limita", String(limita));
            if (cursor === null) p.delete("cursor");
            else p.set("cursor", cursor);
          })
        }
      />
    </div>
  );
}

export default async function PaginaIscir({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta autorizațiile ISCIR. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const filtre = filtreDinUrl(filtreAutorizatiiSchema, parametri);
  const poateExporta = can(permisiuni, "maintenance:export", "team");

  const [tipuri, rsvti, features, etichetaEchipament] = await Promise.all([
    tipuriAutorizatiiIscir(tenant.organizationId),
    stareRsvti(tenant.organizationId),
    getEnabledFeatures(tenant.organizationId),
    filtre.echipament === null
      ? Promise.resolve(null)
      : echipamenteDupaId(tenant.organizationId, [filtre.echipament]).then(
          (m) => m.get(filtre.echipament ?? "")?.cod ?? null,
        ),
  ]);
  const linkSetari = poateDeschide("/mentenanta/setari", { features, permissions: permisiuni });

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Autorizații ISCIR"
        descriere="Autorizațiile și verificările tehnice periodice ale echipamentelor sub incidența ISCIR. O autorizație expirată sau suspendată se arată roșu; aplicația avertizează, nu oprește utilajul."
        file={<FileModul eticheta="Navigare mentenanță" file={FILE_MENTENANTA} tenant={tenant} />}
        {...(poateExporta
          ? {
              actiuni: (
                // Dosarul de control: autorizațiile curente și verificările
                // legale programate, pentru inspecție (ITM, ISCIR, ISU). PDF-ul
                // se arată inspectorului; CSV-ul se lucrează în Excel.
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/api/export/mentenanta/verificari?format=pdf"
                    className={buton({ varianta: "secundar" })}
                  >
                    <FileDown aria-hidden="true" className="size-4" />
                    Dosar de control (PDF)
                  </a>
                  <a
                    href="/api/export/mentenanta/verificari"
                    aria-label="Dosar de control (CSV)"
                    className={buton({ varianta: "secundar" })}
                  >
                    <FileDown aria-hidden="true" className="size-4" />
                    CSV
                  </a>
                </div>
              ),
            }
          : {})}
      />

      {lipsesteRsvti(rsvti) ? (
        // Cazul 41: fără RSVTI activ, alertele ISCIR din rezumatul zilnic n-au
        // un destinatar de specialitate, iar verificările nu le urmărește nimeni.
        <Callout fel="eroare" titlu="Lipsește responsabilul RSVTI">
          Firma are {textNumarat(rsvti.echipamenteIscir, "echipament", "echipamente")} sub incidența
          ISCIR,
          {rsvti.rsvtiEmployeeId === null
            ? " dar niciun RSVTI desemnat în setări."
            : " dar RSVTI-ul din setări nu mai e activ în firmă."}{" "}
          {linkSetari ? (
            <Link href="/mentenanta/setari" className="underline underline-offset-2">
              Desemnați RSVTI-ul în setările mentenanței.
            </Link>
          ) : (
            "Cereți administratorului să desemneze RSVTI-ul în setările mentenanței."
          )}
        </Callout>
      ) : null}

      <FiltreAutorizatiiForm
        filtre={filtre}
        tipuri={tipuri}
        {...(etichetaEchipament === null ? {} : { etichetaEchipament })}
      />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={6} />}>
        <TabelAutorizatii organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}

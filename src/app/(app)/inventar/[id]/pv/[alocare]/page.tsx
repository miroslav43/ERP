// src/app/(app)/inventar/[id]/pv/[alocare]/page.tsx
//
// ── FUNDĂTURA PE CARE O ÎNCHIDE ───────────────────────────────────────────────
// `inventory_allocations.pv_document_path` există în migrarea 0010 (linia 192),
// e enumerată în lista de câmpuri actualizabile din 0016, e în schema Zod
// (`schemas/inventory.ts:178`), în allow-list-ul de audit al acțiunii de predare
// (`inventar/actions.ts:131`), în interogarea de istoric
// (`queries/inventory.ts:285`) și în tipul `IstoricAlocare`. Șapte locuri o
// CITESC. Niciun ecran nu o SCRIA și niciun ecran nu producea documentul.
//
// Adică: singura piesă cu valoare juridică din tot modulul — procesul-verbal de
// predare-primire, cel pe care îl semnează gestionarul și angajatul — nu se
// genera nicăieri. Predarea se înregistra în bază, iar hârtia rămânea de scris
// de mână, în afara aplicației, din date recopiate cu ochiul.
//
// ── DE CE O PAGINĂ TIPĂRIBILĂ, NU UN FIȘIER ───────────────────────────────────
// Fiindcă asta e forma pe care produsul o are deja pentru documente: decontul de
// deplasare (`/diurna/[id]/decont`) și dovada de parcurgere
// (`/onboarding/[id]/dovada`) sunt tot pagini, cu `window.print()` și cu foaia
// `@media print` din `globals.css`. Un PDF generat pe server ar fi cerut o
// bibliotecă nouă și un loc de stocare — iar `pv_document_path` rămâne pentru
// SCANUL semnat, care are nevoie de un bucket de storage și de o acțiune de
// încărcare. Documentul nesemnat nu are ce căuta într-un bucket.
//
// Documentul se generează din alocare, nu se salvează: o hârtie tipărită azi și
// una tipărită mâine spun același lucru doar dacă amândouă vin din aceleași
// rânduri. Un exemplar salvat ar putea rămâne în urma corecturilor din bază.
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { cn } from "@/lib/ui/cn";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import { citesteObiect, istoricAlocari, numeleAngajatilor } from "@/lib/queries/inventory";

import { ETICHETE_STARE } from "../../../etichete";
import { ButonTiparPv } from "./buton-tipar";

export const metadata: Metadata = { title: "Proces-verbal de predare-primire" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string; readonly alocare: string }>;
}

/** Un rând de date al procesului-verbal. Valorile lipsă se scriu „—”, nu se ascund:
 *  pe o hârtie semnată, un rând absent și un rând gol înseamnă lucruri diferite. */
function Rand({ eticheta, valoare }: Readonly<{ eticheta: string; valoare: string | null }>) {
  return (
    <div className="border-border flex items-baseline justify-between gap-4 border-b py-1.5 last:border-0">
      <dt className="text-corp">{eticheta}</dt>
      <dd className="text-corp text-right font-medium">
        {valoare === null || valoare.length === 0 ? "—" : valoare}
      </dd>
    </div>
  );
}

export default async function PaginaProcesVerbal({ params }: ProprietatiPagina) {
  const { id: idBrut, alocare: alocareBruta } = await params;
  const id = idDinRuta(idBrut);
  const alocareId = idDinRuta(alocareBruta);

  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "inventory"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);
  const scope = scopeFor(permisiuni, "inventory:read");

  if (scope === null || scope === "none") {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta evidența de inventar, deci nici procesele-verbale de predare-primire." />
    );
  }

  const obiect = await citesteObiect(tenant.organizationId, id);
  if (obiect === null) notFound();

  // Alocarea se ia din istoricul obiectului, nu printr-o citire proprie: e
  // aceeași interogare pe care o folosește fișa, deci PV-ul nu poate arăta o
  // predare pe care fișa n-o arată. Un id de alocare care aparține altui obiect
  // pur și simplu nu se găsește aici — 404, nu un document despre alt obiect.
  const istoric = await istoricAlocari(tenant.organizationId, id);
  const alocare = istoric.find((rand) => rand.id === alocareId);
  if (alocare === undefined) notFound();

  const angajati = await numeleAngajatilor(tenant.organizationId, [alocare.employee_id]);
  const angajat = angajati.get(alocare.employee_id) ?? null;
  const numeAngajat = angajat?.full_name ?? "—";

  const returnat = alocare.returnat_la !== null;
  const numeFirma = tenant.legalName ?? tenant.name;

  return (
    <div className={cn(LATIMI.formular, "space-y-6 print:max-w-none")}>
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link
          href={`/inventar/${obiect.id}`}
          className="text-corp underline-offset-2 hover:underline"
        >
          ← Înapoi la fișa obiectului
        </Link>
        <ButonTiparPv />
      </div>

      <AntetPagina
        className="border-foreground/60 gap-1 border-b pb-4 print:break-inside-avoid"
        titlu="Proces-verbal de predare-primire"
        file={
          <div className="text-corp space-y-1">
            <p className="font-medium">{numeFirma}</p>
            <p>
              {returnat
                ? `Predare din ${formatDateTime(alocare.predat_la)}, returnată la ${formatDateTime(alocare.returnat_la ?? alocare.predat_la)}`
                : `Predare din ${formatDateTime(alocare.predat_la)}, în curs`}
            </p>
            <p className="text-muted-foreground text-nota font-mono">
              Identificatorul înregistrării: {alocare.id}
            </p>
          </div>
        }
      />

      <section aria-labelledby="pv-parti" className="print:break-inside-avoid">
        <h2 id="pv-parti" className="text-sectiune mb-2 font-medium">
          Părțile
        </h2>
        <dl>
          <Rand eticheta="Predător (deținătorul evidenței)" valoare={numeFirma} />
          <Rand
            eticheta="Primitor"
            valoare={angajat === null ? "—" : `${numeAngajat} (marca ${angajat.marca})`}
          />
        </dl>
      </section>

      <section aria-labelledby="pv-obiect" className="print:break-inside-avoid">
        <h2 id="pv-obiect" className="text-sectiune mb-2 font-medium">
          Obiectul predat
        </h2>
        <dl>
          <Rand eticheta="Denumire" valoare={obiect.denumire} />
          <Rand eticheta="Număr de inventar" valoare={obiect.numar_inventar} />
          <Rand eticheta="Serie" valoare={obiect.serie} />
          <Rand eticheta="Model" valoare={obiect.model} />
          <Rand eticheta="Producător" valoare={obiect.producator} />
          <Rand
            eticheta="Valoare de inventar"
            valoare={obiect.valoare === null ? null : formatLei(obiect.valoare)}
          />
          <Rand
            eticheta="Garanția expiră"
            valoare={obiect.garantie_expira === null ? null : formatDate(obiect.garantie_expira)}
          />
        </dl>
      </section>

      <section aria-labelledby="pv-predare" className="print:break-inside-avoid">
        <h2 id="pv-predare" className="text-sectiune mb-2 font-medium">
          Predarea
        </h2>
        <dl>
          <Rand eticheta="Data și ora predării" valoare={formatDateTime(alocare.predat_la)} />
          <Rand eticheta="Starea la predare" valoare={ETICHETE_STARE[alocare.stare_la_predare]} />
          <Rand
            eticheta="Confirmarea primirii în aplicație"
            valoare={
              alocare.confirmat_de_angajat_la === null
                ? "Neconfirmată de angajat"
                : formatDateTime(alocare.confirmat_de_angajat_la)
            }
          />
          <Rand eticheta="Observații" valoare={alocare.observatii} />
        </dl>
      </section>

      {/* Secțiunea de returnare apare doar când există: un PV tipărit la
          predare nu are ce scrie despre o returnare care nu s-a întâmplat, iar
          rânduri goale pe o hârtie semnată sunt loc liber pentru completări
          ulterioare. */}
      {returnat ? (
        <section aria-labelledby="pv-returnare" className="print:break-inside-avoid">
          <h2 id="pv-returnare" className="text-sectiune mb-2 font-medium">
            Returnarea
          </h2>
          <dl>
            <Rand
              eticheta="Data și ora returnării"
              valoare={alocare.returnat_la === null ? null : formatDateTime(alocare.returnat_la)}
            />
            <Rand
              eticheta="Starea la returnare"
              valoare={
                alocare.stare_la_returnare === null
                  ? null
                  : ETICHETE_STARE[alocare.stare_la_returnare]
              }
            />
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="pv-semnaturi" className="print:break-inside-avoid">
        <h2 id="pv-semnaturi" className="text-sectiune mb-3 font-medium">
          Semnături
        </h2>
        <p className="text-corp mb-4">
          Prin semnarea prezentului proces-verbal, primitorul confirmă că a preluat obiectul descris
          mai sus, în starea consemnată, și că răspunde de păstrarea lui pe durata deținerii.
          Documentul se întocmește în două exemplare, câte unul pentru fiecare parte.
        </p>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-corp font-medium">Am predat</p>
            <p className="text-muted-foreground text-nota mt-1">{numeFirma}</p>
            <div className="border-foreground/60 mt-10 border-t pt-1">
              <p className="text-muted-foreground text-nota">Nume, prenume și semnătura</p>
            </div>
          </div>
          <div>
            <p className="text-corp font-medium">Am primit</p>
            <p className="text-muted-foreground text-nota mt-1">{numeAngajat}</p>
            <div className="border-foreground/60 mt-10 border-t pt-1">
              <p className="text-muted-foreground text-nota">Nume, prenume și semnătura</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// src/app/(app)/inventar/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { getEnabledFeatures, requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import {
  categorii,
  citesteObiect,
  istoricAlocari,
  numeleAngajatilor,
} from "@/lib/queries/inventory";
import { listeazaTicheteleObiectului } from "@/lib/queries/ticketing";

import { ETICHETE_STARE, ETICHETE_STATUS, TONURI_STARE, TONURI_STATUS } from "../etichete";
import {
  ETICHETE_STATUS as ETICHETE_STATUS_TICHET,
  TONURI_STATUS as TONURI_STATUS_TICHET,
} from "../../ticketing/etichete";
import { ActiuniObiect } from "./actiuni-obiect";
import { FormularPredare } from "./formular-predare";
import { FormularReturnare } from "./formular-returnare";
import { idDinRuta } from "@/lib/rute/parametri";

export const metadata: Metadata = { title: "Fișa obiectului de inventar" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

function Camp({
  eticheta,
  valoare,
}: {
  readonly eticheta: string;
  readonly valoare: string | null;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-nota tracking-wide uppercase">{eticheta}</dt>
      <dd className="text-corp mt-0.5">
        {valoare === null || valoare.length === 0 ? "—" : valoare}
      </dd>
    </div>
  );
}

export default async function PaginaFisaObiect({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "inventory");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  const scope = scopeFor(permisiuni, "inventory:read");

  if (scope === null || scope === "none") {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta fișele de inventar." />;
  }

  const obiect = await citesteObiect(tenant.organizationId, id);
  if (obiect === null) notFound();

  const [istoric, listaCategorii, module] = await Promise.all([
    istoricAlocari(tenant.organizationId, id),
    categorii(),
    getEnabledFeatures(tenant.organizationId),
  ]);
  // Modulul de ticketing e opțional: dacă nu e activ la organizație, secțiunea
  // cu tichete nu se randează deloc, în loc să arate o listă goală derutantă.
  const tichete = module.has("ticketing") ? await listeazaTicheteleObiectului(obiect.id) : null;
  const angajati = await numeleAngajatilor(
    tenant.organizationId,
    istoric.map((rand) => rand.employee_id),
  );

  const categorieNume =
    obiect.category_id === null
      ? null
      : (listaCategorii.find((cat) => cat.id === obiect.category_id)?.denumire ?? null);
  const alocareDeschisa = istoric.find((rand) => rand.returnat_la === null) ?? null;

  const poateScrie = can(permisiuni, "inventory:update", "all");
  const poateCasa = poateScrie && alocareDeschisa === null && obiect.status !== "casat";

  let optiuniAngajati: readonly {
    readonly id: string;
    readonly full_name: string | null;
    readonly marca: string;
  }[] = [];
  if (poateScrie && alocareDeschisa === null && obiect.status !== "casat") {
    const db = await createServerSupabase();
    const { data } = await db
      .from("employees")
      .select("id, full_name, marca")
      .eq("organization_id", tenant.organizationId)
      .eq("status", "activ")
      .is("deleted_at", null)
      .order("full_name");
    optiuniAngajati = data ?? [];
  }

  return (
    <div className="space-y-8">
      {/* Numărul de inventar rămâne monospațiat, deci subtitlul merge prin
          `file`, nu prin `descriere` — `descriere` primește doar text. */}
      <AntetPagina
        className="gap-1"
        titlu={obiect.denumire}
        actiuni={
          <>
            <Badge ton={TONURI_STATUS[obiect.status]}>{ETICHETE_STATUS[obiect.status]}</Badge>
            <Badge ton={TONURI_STARE[obiect.stare]}>{ETICHETE_STARE[obiect.stare]}</Badge>
          </>
        }
        file={
          <p className="text-muted-foreground text-corp">
            Nr. inventar <span className="font-mono">{obiect.numar_inventar}</span>
            {categorieNume !== null ? ` · ${categorieNume}` : ""}
          </p>
        }
      />

      <section
        aria-labelledby="titlu-date-generale"
        className="border-border rounded-panou border p-4"
      >
        <h2 id="titlu-date-generale" className="text-sectiune mb-4 font-medium">
          Date generale
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Camp eticheta="Serie" valoare={obiect.serie} />
          <Camp eticheta="Model" valoare={obiect.model} />
          <Camp eticheta="Producător" valoare={obiect.producator} />
          <Camp eticheta="Locație" valoare={obiect.locatie} />
          <Camp
            eticheta="Valoare"
            valoare={obiect.valoare === null ? null : formatLei(obiect.valoare)}
          />
          <Camp
            eticheta="Data achiziției"
            valoare={obiect.data_achizitie === null ? null : formatDate(obiect.data_achizitie)}
          />
          <Camp
            eticheta="Garanția expiră"
            valoare={obiect.garantie_expira === null ? null : formatDate(obiect.garantie_expira)}
          />
          <Camp eticheta="Observații" valoare={obiect.observatii} />
        </dl>
      </section>

      {alocareDeschisa !== null ? (
        <section
          aria-labelledby="titlu-predare-curenta"
          className="border-border bg-surface rounded-panou border p-4"
        >
          <h2 id="titlu-predare-curenta" className="text-sectiune mb-4 font-medium">
            Predare curentă
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Camp
              eticheta="Deținut de"
              valoare={angajati.get(alocareDeschisa.employee_id)?.full_name ?? "—"}
            />
            <Camp eticheta="Predat la" valoare={formatDateTime(alocareDeschisa.predat_la)} />
            <Camp
              eticheta="Stare la predare"
              valoare={ETICHETE_STARE[alocareDeschisa.stare_la_predare]}
            />
            <Camp
              eticheta="Confirmare de primire"
              valoare={
                alocareDeschisa.confirmat_de_angajat_la === null
                  ? "Neconfirmată încă de angajat"
                  : formatDateTime(alocareDeschisa.confirmat_de_angajat_la)
              }
            />
          </dl>
          {poateScrie ? (
            <div className="border-border mt-4 border-t pt-4">
              <h3 className="text-corp mb-3 font-medium">Înregistrează returnarea</h3>
              <FormularReturnare alocareId={alocareDeschisa.id} />
            </div>
          ) : null}
        </section>
      ) : poateScrie && obiect.status !== "casat" ? (
        <section
          aria-labelledby="titlu-predare-noua"
          className="border-border rounded-panou border p-4"
        >
          <h2 id="titlu-predare-noua" className="text-sectiune mb-4 font-medium">
            Predă obiectul unui angajat
          </h2>
          <FormularPredare itemId={obiect.id} angajati={optiuniAngajati} />
        </section>
      ) : null}

      <section aria-labelledby="titlu-istoric" className="border-border rounded-panou border p-4">
        <h2 id="titlu-istoric" className="text-sectiune mb-4 font-medium">
          Istoric predări-primiri
        </h2>
        {istoric.length === 0 ? (
          <p className="text-muted-foreground text-corp">
            Obiectul nu a fost încă predat niciunui angajat.
          </p>
        ) : (
          <ul className="space-y-3">
            {istoric.map((alocare) => (
              <li key={alocare.id} className="border-border rounded-control border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {angajati.get(alocare.employee_id)?.full_name ?? "Angajat"}
                  </span>
                  {alocare.returnat_la === null ? (
                    <span className="bg-surface text-foreground text-nota rounded px-2 py-0.5 font-medium">
                      În curs
                    </span>
                  ) : null}
                </div>
                <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Camp eticheta="Predat la" valoare={formatDateTime(alocare.predat_la)} />
                  <Camp
                    eticheta="Returnat la"
                    valoare={
                      alocare.returnat_la === null ? null : formatDateTime(alocare.returnat_la)
                    }
                  />
                  <Camp
                    eticheta="Stare la predare"
                    valoare={ETICHETE_STARE[alocare.stare_la_predare]}
                  />
                  {alocare.stare_la_returnare !== null ? (
                    <Camp
                      eticheta="Stare la returnare"
                      valoare={ETICHETE_STARE[alocare.stare_la_returnare]}
                    />
                  ) : null}
                  {alocare.observatii !== null ? (
                    <Camp eticheta="Observații" valoare={alocare.observatii} />
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Integrare bidirecțională cu ticketing-ul: pe fișa obiectului se văd
          defecțiunile raportate pe el. Secțiunea apare doar dacă modulul e
          activ la organizația respectivă. */}
      {tichete !== null && (
        <section aria-labelledby="titlu-tichete" className="border-border rounded-panou border p-4">
          <h2 id="titlu-tichete" className="text-sectiune mb-4 font-medium">
            Tichete pe acest obiect
          </h2>
          {tichete.length === 0 ? (
            <p className="text-muted-foreground text-corp">
              Nu s-a raportat nicio defecțiune pe acest obiect.
            </p>
          ) : (
            <ul className="space-y-2">
              {tichete.map((tichet) => (
                <li
                  key={tichet.id}
                  className="border-border rounded-control flex flex-wrap items-center gap-3 border p-3"
                >
                  <Link
                    href={`/ticketing/${tichet.id}`}
                    className="text-primary text-nota font-mono hover:underline"
                  >
                    {tichet.numar_afisat}
                  </Link>
                  <span className="text-corp flex-1">{tichet.titlu}</span>
                  <Badge ton={TONURI_STATUS_TICHET[tichet.status]} className="shrink-0">
                    {ETICHETE_STATUS_TICHET[tichet.status]}
                  </Badge>
                  <span className="text-muted-foreground text-nota">
                    {formatDate(tichet.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {poateScrie ? (
        <section aria-labelledby="titlu-actiuni" className="border-border rounded-panou border p-4">
          <h2 id="titlu-actiuni" className="text-sectiune mb-4 font-medium">
            Acțiuni
          </h2>
          <ActiuniObiect
            obiect={{
              id: obiect.id,
              denumire: obiect.denumire,
              numar_inventar: obiect.numar_inventar,
              serie: obiect.serie,
              model: obiect.model,
              producator: obiect.producator,
              category_id: obiect.category_id,
              data_achizitie: obiect.data_achizitie,
              valoare: obiect.valoare,
              garantie_expira: obiect.garantie_expira,
              stare: obiect.stare,
              locatie: obiect.locatie,
              observatii: obiect.observatii,
            }}
            categorii={listaCategorii}
            poateCasa={poateCasa}
          />
        </section>
      ) : null}
    </div>
  );
}

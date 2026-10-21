// src/app/(app)/flota/[id]/pv/[pv]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { avertismentePv, modelPv } from "@/domain/fleet/proces-verbal";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { toBucharestDateString, todayInBucharest } from "@/lib/format/date";
import { alocarileVehiculului, citesteVehicul } from "@/lib/queries/fleet";
import { citestePv, documenteleCurenteLaBord } from "@/lib/queries/fleet-pv";
import { idDinRuta } from "@/lib/rute/parametri";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { capeteVehiculului, descriereParti, eAlocareDinIstoric } from "../../capete-pv";
import { DialogPv } from "../../dialog-pv";
import { intrareModelDinRand } from "../model-din-rand";
import { ActiuniPv } from "./actiuni-pv";

export const metadata: Metadata = { title: "Proces-verbal de predare-primire" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string; readonly pv: string }>;
}

/**
 * Procesul-verbal de predare-primire al unui vehicul (0215, F12c).
 *
 * Aceleași rânduri ca PDF-ul (`modelPv`): ecranul și hârtia nu pot diverge.
 * Pe ciornă, datele sunt cele vii (vehiculul și documentele de azi); pe PV-ul
 * finalizat, instantaneul de la finalizare.
 *
 * Poarta e `vehicles:read` cel puțin `own`; ce PV vede omul decide RLS-ul
 * (`pv_vehicul_select`: părțile, managerul lor, administratorul). Omul fără
 * `vehicles:read` care e parte la PV (decizia 3) îl are în „Mașina mea”, din
 * portal, cu PDF-ul lui — nu aici, în parcul auto.
 */
export default async function PaginaPv({ params }: ProprietatiPagina) {
  const parametri = await params;
  const vehiculId = idDinRuta(parametri.id);
  const pvId = idDinRuta(parametri.pv);

  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);
  if (!can(permisiuni, "vehicles:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta parcul auto. Procesele-verbale la care sunteți parte se văd în portal, la „Mașina mea”." />
    );
  }

  const pv = await citestePv(tenant.organizationId, pvId);
  if (pv === null || pv.vehicle_id !== vehiculId) notFound();

  const poateAdministra = can(permisiuni, "vehicles:update", "all");
  const ciorna = pv.stare === "ciorna";
  const [vehicul, documenteVii, alocari] = await Promise.all([
    citesteVehicul(tenant.organizationId, vehiculId),
    ciorna ? documenteleCurenteLaBord(tenant.organizationId, vehiculId) : Promise.resolve([]),
    ciorna ? alocarileVehiculului(tenant.organizationId, vehiculId) : Promise.resolve([]),
  ]);

  const ziPv = pv.data_pv;
  const documente = documenteVii.map((d) => ({
    cod: d.tip?.cod ?? "",
    denumire: d.tip?.denumire ?? "Document",
    numar: d.numar,
    expira_la: d.expira_la,
    valabil: d.expira_la === null || d.expira_la >= ziPv,
  }));
  const intrare = intrareModelDinRand(pv, {
    vehicul:
      vehicul === null
        ? null
        : {
            nr_inmatriculare: vehicul.nr_inmatriculare,
            marca: vehicul.marca,
            model: vehicul.model,
            vin: vehicul.vin,
            categorie: vehicul.categorie,
            tip_combustibil: vehicul.tip_combustibil,
            an_fabricatie: vehicul.an_fabricatie,
          },
    documente,
    firma: tenant.legalName ?? tenant.name,
  });
  const model = modelPv(intrare);

  // Contextul avertismentelor: pe ciornă, alocările vii (transfer ratat, istoric).
  const capete = capeteVehiculului(alocari, []);
  const alocarePrimita = alocari.find((a) => a.id === pv.alocare_primita_id) ?? null;
  const alocarePredata = alocari.find((a) => a.id === pv.alocare_predata_id) ?? null;
  const predecesor =
    ciorna && pv.tip === "predare" && pv.alocare_primita_id !== null
      ? (capete.get(pv.alocare_primita_id)?.predare.transferCu ?? null)
      : null;
  const avertismente = avertismentePv(intrare.pv, {
    categorie: intrare.vehicul.categorie,
    documente: intrare.documente,
    kmCurentVehicul: ciorna ? (vehicul?.km_curent ?? null) : null,
    predecesorLipit: predecesor,
    alocareDinIstoric: eAlocareDinIstoric((alocarePrimita ?? alocarePredata)?.observatii ?? null),
    ziuaIntocmirii:
      pv.finalizat_la === null
        ? todayInBucharest()
        : toBucharestDateString(new Date(pv.finalizat_la)),
  });
  const kmAlocare = alocarePrimita?.km_predare ?? alocarePredata?.km_restituire ?? null;

  return (
    <div className={`${LATIMI.detaliu} space-y-6 p-4`}>
      <AntetPagina
        titlu={
          <>Proces-verbal {ciorna ? "(ciornă)" : <span className="font-mono">{pv.numar}</span>}</>
        }
        descriere={model.subtitlu}
        firimituri={[
          { eticheta: "Parc auto", href: "/flota" },
          { eticheta: intrare.vehicul.nr_inmatriculare, href: `/flota/${vehiculId}` },
          { eticheta: ciorna ? "Ciornă de proces-verbal" : pv.numar },
        ]}
        actiuni={
          <span className="inline-flex flex-wrap items-center gap-2">
            {!ciorna ? (
              <a href={`/api/export/flota/pv/${pv.id}`} className={buton({ varianta: "secundar" })}>
                Descarcă PDF
              </a>
            ) : null}
            {ciorna && poateAdministra ? (
              <DialogPv
                vehiculId={vehiculId}
                categorie={intrare.vehicul.categorie}
                combustibil={intrare.vehicul.tip_combustibil}
                pvId={pv.id}
                alocari={{ predata: pv.alocare_predata_id, primita: pv.alocare_primita_id }}
                kmAlocare={kmAlocare}
                initiale={{
                  km_bord: pv.km_bord,
                  nivel_rezervor: pv.nivel_rezervor,
                  numar_chei: pv.numar_chei,
                  stare_generala: pv.stare_generala,
                  anvelope: pv.anvelope,
                  documente_bord: pv.documente_bord,
                  dotari: pv.dotari,
                  daune_constatate: pv.daune_constatate,
                  daune: intrare.pv.daune,
                  observatii: pv.observatii,
                }}
                parti={descriereParti(
                  intrare.predator.tip === "angajat" ? (intrare.predator.nume ?? "—") : null,
                  intrare.primitor.tip === "angajat" ? (intrare.primitor.nume ?? "—") : null,
                )}
                avertismente={avertismente}
                etichetaDeclansator="Editează"
              />
            ) : null}
            {poateAdministra ? (
              <ActiuniPv
                pvId={pv.id}
                vehiculId={vehiculId}
                stare={pv.stare}
                anulat={pv.anulat_la !== null}
              />
            ) : null}
          </span>
        }
      />

      {model.banda === null ? null : (
        <Callout fel="eroare" titlu="Proces-verbal anulat">
          <p>{model.banda}</p>
        </Callout>
      )}

      {avertismente.length === 0 ? null : (
        <Callout fel="atentie" titlu="De verificat înainte de semnare">
          <ul className="list-disc space-y-1 pl-5">
            {avertismente.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Callout>
      )}

      <p className="text-corp font-semibold">{model.operatiunea}</p>

      {model.sectiuni.map((sectiune) => (
        <section key={sectiune.titlu} className="space-y-2">
          <h2 className="text-sectiune font-semibold">{sectiune.titlu}</h2>
          <dl className="border-border rounded-panou divide-border divide-y border">
            {sectiune.randuri.map((r) => (
              <div key={r.eticheta} className="grid gap-1 p-3 sm:grid-cols-[16rem_1fr]">
                <dt className="text-muted-foreground text-corp">{r.eticheta}</dt>
                <dd className="text-corp">
                  {r.atentie === true ? (
                    <Badge ton="pericol" cuAvertisment>
                      {r.valoare}
                    </Badge>
                  ) : (
                    r.valoare
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="text-sectiune font-semibold">Daune vizibile</h2>
        <ul className="text-corp list-disc space-y-1 pl-5">
          {model.daune.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sectiune font-semibold">Observații</h2>
        <p className="text-corp whitespace-pre-line">{model.observatii}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sectiune font-semibold">Semnături</h2>
        <p className="text-muted-foreground text-corp">{model.formula}</p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {model.semnaturi.map((s) => (
            <li key={s.rol} className="border-border rounded-panou border p-3">
              <p className="text-corp font-medium">{s.rol}</p>
              <p className="text-corp">{s.nume}</p>
              <p className="text-muted-foreground text-nota mt-1">
                {s.confirmare ?? "Neconfirmat în aplicație."}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-nota">
          Confirmarea din aplicație completează semnătura de pe hârtie, nu o înlocuiește.
        </p>
      </section>

      <p>
        <Link href={`/flota/${vehiculId}`} className="text-corp underline-offset-2 hover:underline">
          Înapoi la fișa vehiculului
        </Link>
      </p>
    </div>
  );
}

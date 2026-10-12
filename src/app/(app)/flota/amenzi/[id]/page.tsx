import { FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { FileModul } from "@/components/ui/file-modul";
import { ListaDefinitii } from "@/components/ui/lista-definitii";
import { FILE_FLOTA } from "@/config/file-module";
import {
  ETICHETE_STADIU_AMENDA,
  NOTA_RECUPERARE,
  TEMEI_ART_39,
  amendaInchisa,
  raspunsInAsteptare,
  textSugestie,
  verdictTermen,
} from "@/domain/fleet/amenzi";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { formatDate, formatDateTime, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { angajatiDupaId, vehiculeDupaId } from "@/lib/queries/fleet";
import { citesteAmenda, soferiPentruDesemnare, soferSugerat } from "@/lib/queries/flota-amenzi";
import { idDinRuta } from "@/lib/rute/parametri";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { ButoaneStadiuAmenda, DialogRaspuns } from "../actiuni-amenda";
import { DialogAmenda } from "../dialog-amenda";
import { DialogDesemnare } from "../dialog-desemnare";
import { TON_STADIU_AMENDA } from "../etichete";

export const metadata: Metadata = { title: "Amendă" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * Fișa unei amenzi (0206): faptele, termenul, șoferul desemnat (cu sugestia
 * din foaie sau alocare), scrisoarea de răspuns, închiderea.
 *
 * Poarta e `vehicle_fines:read = all`. Scrisoarea cere în plus `employees:read
 * = all`, fiindcă poartă CNP-ul șoferului (`hr_read_sensitive`): cine n-o are
 * vede explicația, nu un buton care ar da 403.
 */
export default async function PaginaAmenda({ params }: ProprietatiPagina) {
  const { id: idBrut } = await params;
  const id = idDinRuta(idBrut);

  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);
  if (!can(permisiuni, "vehicle_fines:read", "all")) {
    return (
      <AccesRestrictionat mesaj="Amenzile primite pe vehicule le văd cei care le administrează. Cereți administratorului organizației dreptul de a le consulta." />
    );
  }

  const amenda = await citesteAmenda(tenant.organizationId, id);
  if (amenda === null) notFound();

  const poateScrie = can(permisiuni, "vehicle_fines:update", "all");
  const poateScrisoare = can(permisiuni, "employees:read", "all");
  const azi = todayInBucharest();
  const inchisa = amendaInchisa(amenda.stadiu);
  // Răspunsul către autoritate n-a plecat: desemnarea și răspunsul rămân posibile
  // și pe o amendă CONTESTATĂ înainte de răspuns (obligația din art. 39 nu
  // dispare prin contestare). Aceeași noțiune ca a termenului și a scadențelor.
  const deRaspuns = raspunsInAsteptare(amenda.stadiu, amenda.raspuns_trimis_la);
  const poateDesemna = poateScrie && deRaspuns;

  const [vehicule, soferi, sugestie, optiuniSoferi] = await Promise.all([
    vehiculeDupaId(tenant.organizationId, [amenda.vehicle_id]),
    angajatiDupaId(
      tenant.organizationId,
      amenda.sofer_desemnat_id === null ? [] : [amenda.sofer_desemnat_id],
    ),
    poateDesemna
      ? soferSugerat(tenant.organizationId, amenda.vehicle_id, amenda.constatata_la)
      : Promise.resolve(null),
    poateDesemna ? soferiPentruDesemnare(tenant.organizationId) : Promise.resolve([]),
  ]);

  const vehicul = vehicule.get(amenda.vehicle_id);
  const desemnat =
    amenda.sofer_desemnat_id === null ? null : (soferi.get(amenda.sofer_desemnat_id) ?? null);
  const numeSugerat =
    sugestie === null
      ? null
      : (optiuniSoferi.find((s) => s.id === sugestie.employee_id)?.full_name ?? null);
  const verdict = verdictTermen(
    amenda.termen_raspuns,
    amenda.stadiu,
    azi,
    amenda.raspuns_trimis_la,
  );
  const areSofer = amenda.sofer_desemnat_id !== null;
  const poateTrimite = poateScrie && deRaspuns && areSofer;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu={
          <>
            Amendă <span className="font-mono">{amenda.numar_pv}</span>
          </>
        }
        descriere={`${amenda.fapta} — ${vehicul?.nr_inmatriculare ?? "vehicul indisponibil"}, ${formatDateTime(amenda.constatata_la)}.`}
        firimituri={[{ eticheta: "Amenzi", href: "/flota/amenzi" }, { eticheta: amenda.numar_pv }]}
        file={<FileModul eticheta="Navigare parc auto" file={FILE_FLOTA} tenant={tenant} />}
        {...(poateScrie && !inchisa
          ? {
              actiuni: <DialogAmenda fel="corectura" amenda={amenda} azi={azi} />,
            }
          : {})}
      />

      {verdict.stare === "depasit" || verdict.stare === "astazi" || verdict.stare === "aproape" ? (
        <Callout
          fel={verdict.ton === "pericol" ? "eroare" : "atentie"}
          titlu={`Termen de răspuns: ${verdict.eticheta.toLowerCase()}`}
        >
          <p>
            Firma trebuie să comunice autorității datele șoferului în termenul din solicitare (
            {amenda.termen_raspuns === null ? "—" : formatDate(amenda.termen_raspuns)}).
            Necomunicarea e contravenție.
          </p>
        </Callout>
      ) : null}

      <section aria-labelledby="titlu-date" className="space-y-3">
        <h2 id="titlu-date" className="text-sectiune font-semibold">
          Datele amenzii
        </h2>
        <ListaDefinitii
          textNecompletat="Necompletat"
          coloane={3}
          definitii={[
            {
              eticheta: "Stadiu",
              valoare: (
                <Badge ton={TON_STADIU_AMENDA[amenda.stadiu]}>
                  {ETICHETE_STADIU_AMENDA[amenda.stadiu]}
                </Badge>
              ),
            },
            {
              eticheta: "Vehicul",
              valoare:
                vehicul === undefined ? null : (
                  <Link
                    href={`/flota/${vehicul.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {vehicul.nr_inmatriculare}
                  </Link>
                ),
            },
            { eticheta: "Momentul faptei", valoare: formatDateTime(amenda.constatata_la) },
            { eticheta: "Locul", valoare: amenda.locul },
            { eticheta: "Autoritatea", valoare: amenda.autoritate },
            {
              eticheta: "Proces-verbal / solicitare",
              valoare:
                amenda.data_pv === null
                  ? amenda.numar_pv
                  : `${amenda.numar_pv}, din ${formatDate(amenda.data_pv)}`,
              identificator: true,
            },
            { eticheta: "Suma", valoare: amenda.suma === null ? null : formatLei(amenda.suma) },
            { eticheta: "Primită de firmă la", valoare: formatDate(amenda.primita_la) },
            {
              eticheta: "Termen de răspuns",
              valoare:
                amenda.termen_raspuns === null
                  ? null
                  : `${formatDate(amenda.termen_raspuns)} — ${verdict.eticheta}`,
            },
            { eticheta: "Observații", valoare: amenda.observatii, lat: true },
            { eticheta: "Motivul anulării", valoare: amenda.motiv, lat: true },
          ]}
        />
      </section>

      <section aria-labelledby="titlu-sofer" className="space-y-3">
        <h2 id="titlu-sofer" className="text-sectiune font-semibold">
          Cine conducea vehiculul
        </h2>
        <p className="text-muted-foreground text-corp max-w-prose">
          {TEMEI_ART_39} Pașii: desemnați șoferul, descărcați scrisoarea, semnați-o și trimiteți-o
          autorității, apoi marcați răspunsul ca trimis.
        </p>

        <ListaDefinitii
          textNecompletat="Nedesemnat încă"
          coloane={3}
          definitii={[
            {
              eticheta: "Șofer desemnat",
              valoare: areSofer ? (desemnat?.full_name ?? "Fișă indisponibilă") : null,
            },
            {
              eticheta: "Desemnat la",
              valoare: amenda.desemnat_la === null ? null : formatDateTime(amenda.desemnat_la),
            },
            {
              eticheta: "Răspuns trimis la",
              valoare:
                amenda.raspuns_trimis_la === null
                  ? null
                  : amenda.raspuns_numar === null
                    ? formatDate(amenda.raspuns_trimis_la)
                    : `${formatDate(amenda.raspuns_trimis_la)}, nr. ${amenda.raspuns_numar}`,
            },
          ]}
        />

        {poateDesemna && sugestie !== null && !areSofer ? (
          <p className="text-corp max-w-prose">
            {textSugestie(sugestie.sursa, numeSugerat ?? "Un angajat al firmei")}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {poateDesemna ? (
            <DialogDesemnare
              amendaId={amenda.id}
              soferi={optiuniSoferi}
              sugestie={
                sugestie === null
                  ? null
                  : {
                      employeeId: sugestie.employee_id,
                      text: textSugestie(sugestie.sursa, numeSugerat ?? "Un angajat al firmei"),
                    }
              }
              curentId={amenda.sofer_desemnat_id}
            />
          ) : null}

          {areSofer && poateScrisoare ? (
            <a
              href={`/api/export/flota/amenzi/${amenda.id}/scrisoare`}
              className={buton({ varianta: deRaspuns ? "primar" : "secundar" })}
            >
              <FileDown aria-hidden="true" className="size-4" />
              Descarcă scrisoarea (PDF)
            </a>
          ) : null}

          {poateTrimite ? <DialogRaspuns amendaId={amenda.id} azi={azi} /> : null}
        </div>

        {areSofer && !poateScrisoare ? (
          <p className="text-muted-foreground text-nota max-w-prose">
            Scrisoarea cuprinde CNP-ul șoferului, pe care îl citesc doar cei cu acces la toate
            fișele angajaților. Cereți administratorului organizației să o genereze.
          </p>
        ) : null}
        {areSofer && poateScrisoare ? (
          <p className="text-muted-foreground text-nota max-w-prose">
            Scrisoarea citește CNP-ul din fișa angajatului, iar citirea rămâne în jurnalul de audit.
            Ce lipsește din fișă (CNP, domiciliu, act de identitate) rămâne linie de completat,
            spusă pe document.
          </p>
        ) : null}
      </section>

      {poateScrie && !inchisa ? (
        <section aria-labelledby="titlu-inchidere" className="space-y-3">
          <h2 id="titlu-inchidere" className="text-sectiune font-semibold">
            Evoluția amenzii
          </h2>
          <ButoaneStadiuAmenda
            amendaId={amenda.id}
            numarPv={amenda.numar_pv}
            stadiu={amenda.stadiu}
          />
        </section>
      ) : null}

      <Callout fel="informativ" titlu="Recuperarea de la șofer">
        <p>{NOTA_RECUPERARE}</p>
      </Callout>
    </div>
  );
}

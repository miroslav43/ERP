// src/app/(app)/flota/[id]/iesire/sectiune-iesire.tsx
//
// Secțiunea „Ieșirea din parc” de pe fișa vehiculului (0218, F12h): detaliile
// ieșirii vii, termenele ei (bifabile) și istoricul ieșirilor anulate. Server
// component care își citește singur istoricul: fișa primește doar un import și
// un element (regula de o linie din README-ul F12, §2.2).
//
// Pagina o randează doar sub `vehicles:read = all`: politicile ieșirilor cer
// exact asta (implicita I-h6), iar sub `own`/`team` citirile ar întoarce zero
// rânduri, fără eroare.
import Link from "next/link";
import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { ListaDefinitii, type Definitie } from "@/components/ui/lista-definitii";
import { Scadenta } from "@/components/ui/scadenta";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { ETICHETE_TIP_INCIDENT } from "@/domain/fleet/amenzi";
import { stareScadentaFlota } from "@/domain/fleet/scadente";
import { formatDate, formatDateTime, toBucharestDateString } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import type { AlocareVehicul } from "@/lib/queries/fleet";
import { iesirileAnulate, type IesireVehicul, type TermenIesire } from "@/lib/queries/flota-iesire";
import { eInstrainare } from "@/schemas/flota-iesire";

import { hrefPvNou, type CapeteAlocare } from "../capete-pv";
import { ButonRedeschideObligatia } from "./buton-redeschide-obligatia";
import { DialogAnuleazaIesirea } from "./dialog-anuleaza-iesirea";
import { DialogObligatie } from "./dialog-obligatie";
import {
  ETICHETE_NATURA_TERMEN,
  TONURI_NATURA_TERMEN,
  etichetaDatei,
  etichetaIesirii,
} from "./etichete-iesire";

export type PropsSectiuneIesire = Readonly<{
  organizationId: string;
  vehicul: Readonly<{ id: string; data_achizitie: string | null }>;
  /** Ieșirea vie, citită de pagină (îi trebuie și pentru pastila de status). */
  iesire: IesireVehicul | null;
  poateAdministra: boolean;
  alocari: readonly AlocareVehicul[];
  capete: ReadonlyMap<string, CapeteAlocare>;
  azi: string;
}>;

function stareTermen(t: TermenIesire): string {
  if (t.finalizat_la !== null) return `Făcut la ${formatDate(t.finalizat_la)}`;
  if (t.nu_se_aplica) return "Nu se aplică";
  return "Deschis";
}

function CelulaTermen({
  t,
  azi,
}: Readonly<{ t: TermenIesire; azi: string }>): ReactElement | string {
  const inchis = t.finalizat_la !== null || t.nu_se_aplica;
  if (t.termen === null) {
    // Curge de la un pas încă nefăcut: nu e în alerte și nu are dată (Decizia 8).
    return inchis ? (
      "—"
    ) : (
      <Scadenta treapta="neaplicabil">
        {t.depinde_de === "radiere_drpciv" ? "După radiere" : "După pasul anterior"}
      </Scadenta>
    );
  }
  if (inchis) return formatDate(t.termen);
  const stare = stareScadentaFlota(t.termen, azi);
  return (
    <Scadenta treapta={stare}>
      {stare === "expirat"
        ? `Depășit din ${formatDate(t.termen)}`
        : `Până la ${formatDate(t.termen)}`}
    </Scadenta>
  );
}

export async function SectiuneIesire({
  organizationId,
  vehicul,
  iesire,
  poateAdministra,
  alocari,
  capete,
  azi,
}: PropsSectiuneIesire): Promise<ReactElement | null> {
  const anulate = await iesirileAnulate(organizationId, vehicul.id);
  if (iesire === null && anulate.length === 0) return null;

  return (
    <section aria-labelledby="iesire-din-parc" className="space-y-3">
      <h2 id="iesire-din-parc" className="text-sectiune font-semibold">
        Ieșirea din parc
      </h2>
      {iesire === null ? null : (
        <IesireaVie
          iesire={iesire}
          vehicul={vehicul}
          poateAdministra={poateAdministra}
          alocari={alocari}
          capete={capete}
          azi={azi}
        />
      )}
      {anulate.length === 0 ? null : (
        <div className="space-y-1">
          <h3 className="text-corp font-semibold">Ieșiri anulate</h3>
          <ul className="text-muted-foreground text-corp space-y-1">
            {anulate.map((a) => (
              <li key={a.id}>
                {etichetaIesirii(a.tip, a.destinatie_epava, a.motiv_radiere)} din{" "}
                {formatDate(a.data_iesire)}, anulată la {formatDateTime(a.anulat_la)}:{" "}
                {a.motiv_anulare}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function IesireaVie({
  iesire,
  vehicul,
  poateAdministra,
  alocari,
  capete,
  azi,
}: Readonly<{
  iesire: IesireVehicul;
  vehicul: PropsSectiuneIesire["vehicul"];
  poateAdministra: boolean;
  alocari: readonly AlocareVehicul[];
  capete: ReadonlyMap<string, CapeteAlocare>;
  azi: string;
}>): ReactElement {
  const eticheta = etichetaIesirii(iesire.tip, iesire.destinatie_epava, iesire.motiv_radiere);
  const instrainare = eInstrainare(iesire.tip, iesire.destinatie_epava);

  // Implicita I-T5: alocarea încheiată de ieșire fără PV de restituire nu
  // blochează nimic, doar se semnalează. E alocarea încheiată cel mai târziu,
  // în ziua ieșirii sau după ea (ieșirea o închide la sfârșitul zilei).
  const ultimaIncheiata = iesire.preluata_din_istoric
    ? undefined
    : alocari
        .filter((a) => a.pana_la !== null)
        .sort((a, b) => Date.parse(b.pana_la ?? "") - Date.parse(a.pana_la ?? ""))[0];
  const restituireFaraPv =
    ultimaIncheiata !== undefined &&
    ultimaIncheiata.pana_la !== null &&
    toBucharestDateString(new Date(ultimaIncheiata.pana_la)) >= iesire.data_iesire
      ? (capete.get(ultimaIncheiata.id)?.restituire ?? null)
      : null;
  const pvDeIntocmit =
    restituireFaraPv !== null && restituireFaraPv.pv === null ? restituireFaraPv.nou : null;

  const definitii: Definitie[] = [
    { eticheta: "Felul ieșirii", valoare: eticheta },
    {
      eticheta: etichetaDatei(iesire.tip, iesire.motiv_radiere),
      valoare: formatDate(iesire.data_iesire),
    },
    {
      eticheta: "Kilometraj la ieșire",
      valoare: iesire.km_iesire === null ? null : `${iesire.km_iesire.toLocaleString("ro-RO")} km`,
    },
    ...(instrainare
      ? [
          { eticheta: "Cumpărător", valoare: iesire.cumparator },
          { eticheta: "Preț", valoare: iesire.pret === null ? null : formatLei(iesire.pret) },
        ]
      : []),
    { eticheta: "Documentul", valoare: iesire.nr_document },
    // F12h: incidentul legat (`incident_id`). Încorporarea vine NULL fără
    // `vehicle_incidents:read` (capcana #18): legătura există, dar nu se arată.
    ...(iesire.incident_id === null
      ? []
      : [
          {
            eticheta: "Incidentul",
            valoare:
              iesire.incident === null ? (
                "Legat, dar nu aveți acces la incidente"
              ) : (
                <Link
                  href={`/flota/incidente/${iesire.incident.id}`}
                  className="underline-offset-2 hover:underline"
                >
                  {ETICHETE_TIP_INCIDENT[iesire.incident.tip]} din{" "}
                  {formatDateTime(new Date(iesire.incident.produs_la))}
                </Link>
              ),
          },
        ]),
    ...(iesire.pastreaza_numarul
      ? [{ eticheta: "Numărul de înmatriculare", valoare: "Păstrat de firmă" }]
      : []),
    { eticheta: "Motivul", valoare: iesire.motiv, lat: true },
    ...(iesire.observatii === null
      ? []
      : [{ eticheta: "Observații", valoare: iesire.observatii, lat: true }]),
  ];

  const coloane: readonly Coloana<TermenIesire>[] = [
    {
      cheie: "denumire",
      antet: "Ce trebuie făcut",
      peTelefon: "titlu",
      celula: (t) => (
        <>
          {t.denumire}
          {t.temei === null ? null : (
            <span className="text-muted-foreground text-nota block">{t.temei}</span>
          )}
          {t.nota === null ? null : (
            <span className="text-muted-foreground text-nota block">{t.nota}</span>
          )}
        </>
      ),
    },
    {
      cheie: "natura",
      antet: "Natura",
      latime: "ingusta",
      peTelefon: "insigna",
      celula: (t) => (
        <Badge ton={TONURI_NATURA_TERMEN[t.natura]}>{ETICHETE_NATURA_TERMEN[t.natura]}</Badge>
      ),
    },
    {
      cheie: "termen",
      antet: "Termen",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (t) => <CelulaTermen t={t} azi={azi} />,
    },
    {
      cheie: "stare",
      antet: "Stare",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (t) => stareTermen(t),
    },
    ...(poateAdministra
      ? [
          {
            cheie: "actiuni",
            antet: "Acțiuni",
            antetAscuns: true,
            latime: "ingusta",
            peTelefon: "actiuni",
            celula: (t: TermenIesire) =>
              t.finalizat_la === null && !t.nu_se_aplica ? (
                <span className="inline-flex flex-wrap items-center gap-1">
                  {(["facut", "nu_se_aplica"] as const).map((fel) => (
                    <DialogObligatie
                      key={fel}
                      fel={fel}
                      termenId={t.id}
                      vehiculId={vehicul.id}
                      denumire={t.denumire}
                      nota={t.nota}
                      dataMinima={
                        t.cod === "pastrare_numar" ? vehicul.data_achizitie : iesire.data_iesire
                      }
                      azi={azi}
                    />
                  ))}
                </span>
              ) : (
                <ButonRedeschideObligatia
                  termenId={t.id}
                  vehiculId={vehicul.id}
                  denumire={t.denumire}
                  stare={stareTermen(t)}
                />
              ),
          } satisfies Coloana<TermenIesire>,
        ]
      : []),
  ];

  return (
    <div className="border-border rounded-panou space-y-4 border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge ton="neutru">{eticheta}</Badge>
        {poateAdministra ? (
          <DialogAnuleazaIesirea
            iesireId={iesire.id}
            vehiculId={vehicul.id}
            descriere={`${eticheta}, ${formatDate(iesire.data_iesire)}`}
          />
        ) : null}
      </div>
      <ListaDefinitii coloane={3} textNecompletat="Necompletat" definitii={definitii} />
      {iesire.preluata_din_istoric ? (
        <p className="text-muted-foreground text-corp">
          Ieșire preluată din istoric: vehiculul ieșise din parc înainte de asistent, deci n-are
          termene.
        </p>
      ) : null}
      {poateAdministra && pvDeIntocmit !== null ? (
        <p className="text-corp">
          Alocarea încheiată la ieșire n-are proces-verbal de restituire.{" "}
          <Link
            href={hrefPvNou(vehicul.id, pvDeIntocmit)}
            className="underline-offset-2 hover:underline"
          >
            Întocmește PV de restituire
          </Link>
        </p>
      ) : null}
      <Tabel
        caption="Termenele de după ieșirea din parc: ce trebuie făcut, până când și în ce stare e fiecare."
        coloane={coloane}
        randuri={iesire.termene}
        cheieRand={(t) => t.id}
        gol={
          iesire.preluata_din_istoric ? null : (
            <p className="text-muted-foreground text-corp">
              Niciun termen pentru acest fel de ieșire.
            </p>
          )
        }
      />
    </div>
  );
}

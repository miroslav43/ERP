import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import {
  ETICHETE_EXCEPTIE,
  ETICHETE_REGIM_FISCAL,
  ETICHETE_TITLU,
  avertismenteRegim,
  cereFoaie,
  perioadaLa,
  regimSugerat,
  type DateVehiculFiscal,
} from "@/domain/fleet/fiscal";
import { formatDate } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import type { OptiuneAngajat } from "@/lib/queries/fleet";
import {
  normeleVehiculului,
  regimurileVehiculului,
  type RandNormaConsum,
  type RandRegimFiscal,
} from "@/lib/queries/flota-fiscal";

import { ButonStergePerioada } from "./buton-sterge-perioada";
import { DialogNormaConsum } from "./dialog-norma-consum";
import { DialogRegimFiscal } from "./dialog-regim-fiscal";

/**
 * Fiscalul unui vehicul, ca secțiune a fișei lui (0205, F10): regimul de
 * deducere pe perioade și norma proprie de consum.
 *
 * Componentă de SERVER. Apelantul o montează doar pentru cine are
 * `vehicles:read = all`, poarta politicilor `vehicle_fiscal_regimes_select` și
 * `vehicle_consumption_norms_select`: managerul și angajatul văd vehiculul, nu
 * și regimul lui, iar ecranul nu le arată secțiunea (nu un tabel gol care ar
 * spune „n-are regim”). Butoanele de scriere cer `vehicles:update = all`.
 */
interface Proprietati {
  readonly vehicul: DateVehiculFiscal &
    Readonly<{
      id: string;
      nr_inmatriculare: string;
      consum_mediu_declarat: number | null;
    }>;
  readonly organizationId: string;
  readonly poateAdministra: boolean;
  /** Alegerea proprietarului mașinii personale; goală pentru cine nu scrie. */
  readonly angajati: readonly OptiuneAngajat[];
  /** `AAAA-LL-ZZ`, ziua României. */
  readonly azi: string;
}

function descriereRegim(r: RandRegimFiscal): string {
  return r.exceptie === null
    ? ETICHETE_REGIM_FISCAL[r.regim]
    : `${ETICHETE_REGIM_FISCAL[r.regim]}: ${ETICHETE_EXCEPTIE[r.exceptie]}`;
}

export async function SectiuneFiscalaVehicul({
  vehicul,
  organizationId,
  poateAdministra,
  angajati,
  azi,
}: Proprietati): Promise<ReactElement> {
  const [regimuri, norme] = await Promise.all([
    regimurileVehiculului(organizationId, vehicul.id),
    normeleVehiculului(organizationId, vehicul.id),
  ]);

  const acum = perioadaLa(regimuri, azi);
  const normaAcum = perioadaLa(norme, azi);
  const avertismente = acum === null ? [] : avertismenteRegim(acum.regim, vehicul);

  const coloaneRegimuri: readonly Coloana<RandRegimFiscal>[] = [
    {
      cheie: "de_la",
      antet: "Se aplică de la",
      latime: "ingusta",
      peTelefon: "titlu",
      celula: (r) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          {formatDate(r.valabil_de_la)}
          {acum?.id === r.id ? <Badge ton="succes">În vigoare</Badge> : null}
        </span>
      ),
    },
    {
      cheie: "regim",
      antet: "Regim de deducere",
      peTelefon: "meta",
      celula: (r) => (
        <>
          {descriereRegim(r)}
          <span className="text-muted-foreground text-nota block">{r.motiv}</span>
        </>
      ),
    },
    {
      cheie: "titlu",
      antet: "Vehiculul",
      peTelefon: "meta",
      celula: (r) => (
        <>
          {ETICHETE_TITLU[r.titlu_folosinta]}
          {r.proprietar?.full_name == null ? null : (
            <span className="text-muted-foreground text-nota block">{r.proprietar.full_name}</span>
          )}
          {r.chirie_lunara === null ? null : (
            <span className="text-muted-foreground text-nota block">
              Chirie {formatLei(r.chirie_lunara)} pe lună
            </span>
          )}
          {r.contract_numar === null && r.contract_data === null ? null : (
            <span className="text-muted-foreground text-nota block">
              Contract {r.contract_numar ?? ""}
              {r.contract_data === null ? "" : ` din ${formatDate(r.contract_data)}`}
            </span>
          )}
        </>
      ),
    },
    ...(poateAdministra
      ? [
          {
            cheie: "actiuni",
            antet: "Acțiuni",
            antetAscuns: true,
            latime: "ingusta",
            peTelefon: "meta",
            celula: (r: RandRegimFiscal) => (
              <ButonStergePerioada
                fel="regim"
                perioadaId={r.id}
                vehiculId={vehicul.id}
                descriere={ETICHETE_REGIM_FISCAL[r.regim]}
                dela={`de la ${formatDate(r.valabil_de_la)}`}
              />
            ),
          } satisfies Coloana<RandRegimFiscal>,
        ]
      : []),
  ];

  const coloaneNorme: readonly Coloana<RandNormaConsum>[] = [
    {
      cheie: "de_la",
      antet: "Se aplică de la",
      latime: "ingusta",
      peTelefon: "titlu",
      celula: (n) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          {formatDate(n.valabil_de_la)}
          {normaAcum?.id === n.id ? <Badge ton="succes">În vigoare</Badge> : null}
        </span>
      ),
    },
    {
      cheie: "norma",
      antet: "Normă (l/100 km)",
      numeric: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (n) => n.l_100km.toLocaleString("ro-RO"),
    },
    {
      cheie: "decizie",
      antet: "Decizia internă",
      peTelefon: "meta",
      celula: (n) => (
        <>
          {n.decizie_numar === null && n.decizie_data === null
            ? "—"
            : `${n.decizie_numar ?? "fără număr"}${
                n.decizie_data === null ? "" : ` din ${formatDate(n.decizie_data)}`
              }`}
          {n.observatii === null ? null : (
            <span className="text-muted-foreground text-nota block">{n.observatii}</span>
          )}
        </>
      ),
    },
    ...(poateAdministra
      ? [
          {
            cheie: "actiuni",
            antet: "Acțiuni",
            antetAscuns: true,
            latime: "ingusta",
            peTelefon: "meta",
            celula: (n: RandNormaConsum) => (
              <ButonStergePerioada
                fel="norma"
                perioadaId={n.id}
                vehiculId={vehicul.id}
                descriere={`${n.l_100km.toLocaleString("ro-RO")} l/100 km`}
                dela={`de la ${formatDate(n.valabil_de_la)}`}
              />
            ),
          } satisfies Coloana<RandNormaConsum>,
        ]
      : []),
  ];

  return (
    <section id="fiscal" aria-labelledby="titlu-fiscal-vehicul" className="space-y-4">
      <div className="space-y-1">
        <h2 id="titlu-fiscal-vehicul" className="text-sectiune font-semibold">
          Fiscal
        </h2>
        <p className="text-muted-foreground text-corp">
          {acum === null
            ? "Regimul de deducere nu e stabilit: nu se știe dacă foile de parcurs ale vehiculului sunt cerute pentru deducere."
            : cereFoaie(acum.regim)
              ? `${ETICHETE_REGIM_FISCAL[acum.regim]}: deducerea cere foaie de parcurs pentru fiecare zi de folosire (HG 1/2016, titlul II pct. 16 alin. (2)).`
              : `${ETICHETE_REGIM_FISCAL[acum.regim]}: foaia de parcurs nu e cerută pentru deducere (HG 1/2016, titlul VII pct. 68 alin. (4)).`}
        </p>
      </div>

      {avertismente.length === 0 ? null : (
        <Callout fel="atentie" titlu="De verificat la încadrare">
          <ul className="list-disc space-y-0.5 pl-5">
            {avertismente.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Callout>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-corp font-semibold">Regimul de deducere</h3>
          {poateAdministra ? (
            <DialogRegimFiscal
              vehiculId={vehicul.id}
              nrInmatriculare={vehicul.nr_inmatriculare}
              regimSugerat={regimSugerat(vehicul)}
              azi={azi}
              angajati={angajati}
            />
          ) : null}
        </div>
        <Tabel
          caption="Regimul fiscal al vehiculului pe perioade, cel mai nou întâi."
          coloane={coloaneRegimuri}
          randuri={regimuri}
          cheieRand={(r) => r.id}
          gol={
            <p className="text-muted-foreground text-corp">
              Niciun regim fiscal înregistrat pentru acest vehicul.
            </p>
          }
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-corp font-semibold">Norma proprie de consum</h3>
          {poateAdministra ? (
            <DialogNormaConsum
              vehiculId={vehicul.id}
              nrInmatriculare={vehicul.nr_inmatriculare}
              consumDeclarat={vehicul.consum_mediu_declarat}
              azi={azi}
            />
          ) : null}
        </div>
        <p className="text-muted-foreground text-nota">
          {normaAcum === null
            ? vehicul.consum_mediu_declarat === null
              ? "Fără normă proprie și fără consum declarat pe fișă: foile trimise nu vor avea norma de consum cerută de HG 1/2016."
              : `Fără normă proprie, foile trimise folosesc consumul declarat pe fișă (${vehicul.consum_mediu_declarat.toLocaleString("ro-RO")} l/100 km).`
            : `Foile trimise acum folosesc norma de ${normaAcum.l_100km.toLocaleString("ro-RO")} l/100 km.`}
        </p>
        <Tabel
          caption="Normele proprii de consum ale vehiculului pe perioade, cea mai nouă întâi."
          coloane={coloaneNorme}
          randuri={norme}
          cheieRand={(n) => n.id}
          gol={
            <p className="text-muted-foreground text-corp">
              Nicio normă proprie de consum înregistrată pentru acest vehicul.
            </p>
          }
        />
      </div>
    </section>
  );
}

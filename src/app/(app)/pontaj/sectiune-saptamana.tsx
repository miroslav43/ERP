// src/app/(app)/pontaj/sectiune-saptamana.tsx
import Link from "next/link";
import { ChevronLeft, ChevronRight, UserX } from "lucide-react";

import { StareGoala } from "@/components/ui/stare-goala";
import { buton } from "@/components/ui/buton";
import { adresaVizualizare, type ParametriAdresa } from "@/components/ui/comutator-vizualizare";
import { formatDate } from "@/lib/format/date";
import {
  citestePerioada,
  intrariLuna,
  setariPontaj,
  setariPontareRapida,
} from "@/lib/queries/attendance";
import { configPontareRapida } from "@/domain/attendance/pontare-rapida";
import { zileNelucratoare } from "@/lib/queries/leave";
import { fisaMea } from "@/lib/queries/portal";
import { configZiDin, intervalulPropus } from "@/domain/attendance/calcul-ore";
import { adaugaZile, zileleSaptamanii } from "@/domain/attendance/saptamana";
import { intervalulGrilei } from "@/domain/attendance/grila-orara";

import { GrilaSaptamana, type ZiGrila } from "./grila-saptamana";
import { intrarilePeZi } from "./intrare-client";
import { tipZiAutomat } from "./etichete";
import { PARAM_SAPTAMANA } from "./vizualizari";

/**
 * Săptămâna proprie, pe ore — partea care citește.
 *
 * ── DE CE „PROPRIE" ȘI NU „A CUI E ALEASĂ" ────────────────────────────────
 * Grila orară arată pontajul celui conectat, oricare i-ar fi rolul. Vederea cu
 * toată firma e „Lună" și „Listă". Un `hr` care ponteză pe altcineva o face din
 * foaia colectivă, unde are toată luna în față.
 *
 * ── CAPCANA CARE A DICTAT DRUMUL DE DATE ──────────────────────────────────
 * `intrariProprii()` NU filtrează pe `employee_id`: se bazează pe RLS ca să
 * îngusteze rândurile la fișa proprie. Merge pentru un `employee`, dar pentru un
 * `org_admin` sau `hr` — scope `all` — RLS nu îngustează NIMIC, deci funcția ar
 * întoarce pontajul întregii firme într-un ecran care trebuie să arate un singur
 * om. De aceea aici fișa se rezolvă explicit și se filtrează pe ea, pentru toate
 * rolurile, cu `intrariLuna(org, [fisa], …)` — care nu atinge deloc tabela
 * `employees`, deci merge și pentru rolurile care n-o pot citi.
 *
 * `fisaMea`, nu `idFisaProprie`: `app.current_employee_id()` — prin care trec
 * toate ramurile `own` din RLS — CERE `is_primary`, în timp ce `idFisaProprie`
 * doar sortează după el. Diferența e chiar starea `fara_principala` de mai jos:
 * un cont care își vede marca pe ecran, dar căruia baza îi refuză orice scriere.
 */

export async function SectiuneSaptamana({
  organizationId,
  userId,
  saptamanaStart,
  poateEdita,
  poateAproba,
  parametri,
  azi,
}: {
  readonly organizationId: string;
  readonly userId: string;
  /** O zi de luni, ISO. Validată de apelant cu `esteLuni`. */
  readonly saptamanaStart: string;
  readonly poateEdita: boolean;
  readonly poateAproba: boolean;
  readonly parametri: ParametriAdresa;
  readonly azi: string;
}) {
  const saptamanaSfarsit = adaugaZile(saptamanaStart, 6);
  const anInceput = Number(saptamanaStart.slice(0, 4));
  const anSfarsit = Number(saptamanaSfarsit.slice(0, 4));
  const lunaInceput = Number(saptamanaStart.slice(5, 7));
  const lunaSfarsit = Number(saptamanaSfarsit.slice(5, 7));
  const doualuni = anInceput !== anSfarsit || lunaInceput !== lunaSfarsit;

  /*
    Patru citiri independente, un val. `citestePerioada` se cheamă de DOUĂ ori
    doar când săptămâna chiar călărește două luni (28 decembrie – 3 ianuarie, dar
    și orice sfârșit de lună): perioadele sunt lunare, iar una dintre ele poate
    să nu fie deschisă în timp ce cealaltă e.

    `setariPontaj(org, saptamanaStart)` — nu `perioada.data_inceput`: setările au
    istoric (`valabil_de_la`), iar săptămâna poate începe înaintea perioadei.
    `zileNelucratoare(anInceput, anSfarsit)` acoperă săptămâna de peste an.
  */
  const [
    stareFisa,
    perioadaInceput,
    perioadaSfarsit,
    setari,
    randPontare,
    { nationale, organizatie },
  ] = await Promise.all([
    fisaMea(organizationId, userId),
    citestePerioada(organizationId, anInceput, lunaInceput),
    doualuni ? citestePerioada(organizationId, anSfarsit, lunaSfarsit) : null,
    setariPontaj(organizationId, saptamanaStart),
    // Ora de început NU mai vine din rândul versionat: e o setare operațională,
    // fără istoric (0115).
    setariPontareRapida(organizationId),
    zileNelucratoare(organizationId, anInceput, anSfarsit),
  ]);

  const navigare = (
    <NavigareSaptamana
      saptamanaStart={saptamanaStart}
      saptamanaSfarsit={saptamanaSfarsit}
      parametri={parametri}
    />
  );

  if (stareFisa.stare !== "ok") {
    return (
      <div className="space-y-4">
        {navigare}
        <FaraFisaProprie stare={stareFisa.stare} parametri={parametri} />
      </div>
    );
  }

  const intrari = await intrariLuna(
    organizationId,
    [stareFisa.fisa.id],
    saptamanaStart,
    saptamanaSfarsit,
  );
  const peZi = intrarilePeZi(intrari);

  const setNationale = new Set(nationale.map((z) => z.data));
  const denumiriSarbatori = new Map(nationale.map((z) => [z.data, z.denumire]));
  const setRecuperare = new Set(
    organizatie.filter((z) => z.tip === "zi_recuperare").map((z) => z.data),
  );
  const setLiber = new Set(
    organizatie.filter((z) => z.tip === "liber_suplimentar").map((z) => z.data),
  );

  const config = configZiDin(setari);
  const programStart = configPontareRapida(randPontare).programStart;

  const zile: readonly ZiGrila[] = zileleSaptamanii(saptamanaStart).map((data, index) => {
    const intrare = peZi[data] ?? null;
    const perioada =
      data.slice(0, 7) === saptamanaStart.slice(0, 7) ? perioadaInceput : perioadaSfarsit;

    // Aceleași porți ca în foaia colectivă — o zi nu poate fi editabilă într-un
    // ecran și blocată în celălalt.
    //
    // Perioada care LIPSEȘTE nu mai blochează nimic (0132): luna se naște
    // deschisă la prima scriere, deci o săptămână din octombrie e pontabilă
    // înainte să fi deschis cineva octombrie. Singura stare care blochează e
    // `blocata`, pusă explicit de cineva cu drept de aprobare pe firmă.
    const perioadaBlocata = perioada !== null && perioada.status === "blocata";
    const dinConcediu = intrare?.esteDinConcediu === true;
    const aprobataFaraDrept = intrare?.aprobat === true && !poateAproba;
    const editabila = poateEdita && !perioadaBlocata && !dinConcediu && !aprobataFaraDrept;

    const motivBlocare = perioadaBlocata
      ? "perioada este blocată"
      : dinConcediu
        ? "completat din concediul aprobat"
        : aprobataFaraDrept
          ? "ziua a fost deja aprobată"
          : !poateEdita
            ? "nu aveți dreptul de a înregistra pontaj"
            : null;

    const tipCalendar = tipZiAutomat(data, setNationale, setRecuperare, setLiber);
    const sarbatoare = denumiriSarbatori.get(data) ?? null;

    return {
      data,
      zi: NUME_ZILE[index] ?? "",
      numarZi: data.slice(8, 10),
      etichetaLunga: `${NUME_ZILE[index] ?? ""}, ${formatDate(data)}`,
      intrare,
      nelucratoare: sarbatoare ?? (tipCalendar === "weekend" ? "Weekend" : null),
      editabila,
      motivBlocare,
    };
  });

  return (
    <div className="space-y-4">
      {navigare}

      {/*
        Aici stătea avertismentul „luna nu a fost deschisă", cu link către
        „Perioade". A dispărut odată cu 0132: nu mai există o lună nedeschisă în
        care angajatul să nu poată ponta. Luna BLOCATĂ se anunță în continuare,
        dar pe zi, prin `motivBlocare` — acolo unde omul chiar apasă.
      */}
      <GrilaSaptamana
        zile={zile}
        interval={intervalulGrilei(
          zile.map((z) => ({
            oraInceput: z.intrare?.oraInceput ?? null,
            oraSfarsit: z.intrare?.oraSfarsit ?? null,
          })),
        )}
        config={config}
        intervalPropus={programStart === null ? null : intervalulPropus(programStart, config)}
        angajatId={null}
        eticheta={stareFisa.fisa.full_name ?? stareFisa.fisa.marca}
        poateAproba={poateAproba}
        poateSterge={poateEdita}
        azi={azi}
      />
    </div>
  );
}

const NUME_ZILE = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"] as const;

/**
 * Săgețile de săptămână.
 *
 * Adresele se construiesc cu `adresaVizualizare`, nu cu un constructor scris de
 * mână: funcția pornește din parametrii EXISTENȚI (deci filtrele nu se pierd),
 * șterge `cursor` (un cursor keyset rămas din altă vizualizare ar continua de la
 * un rând care nu mai e în rezultat) și e deja testată. `implicita` primește un
 * șir gol, care nu se potrivește niciodată cu o dată ISO — deci cheia se scrie
 * mereu în adresă, cum trebuie.
 */
function NavigareSaptamana({
  saptamanaStart,
  saptamanaSfarsit,
  parametri,
}: {
  readonly saptamanaStart: string;
  readonly saptamanaSfarsit: string;
  readonly parametri: ParametriAdresa;
}) {
  const adresa = (luni: string): string =>
    adresaVizualizare("/pontaj", parametri, PARAM_SAPTAMANA, luni, "");

  return (
    <nav aria-label="Navigare între săptămâni" className="flex items-center justify-between gap-3">
      <Link
        href={adresa(adaugaZile(saptamanaStart, -7))}
        className={buton({ varianta: "secundar" })}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Săptămâna anterioară
      </Link>
      <p className="text-corp text-foreground tabular-nums">
        {formatDate(saptamanaStart)} – {formatDate(saptamanaSfarsit)}
      </p>
      <Link
        href={adresa(adaugaZile(saptamanaStart, 7))}
        className={buton({ varianta: "secundar" })}
      >
        Săptămâna următoare
        <ChevronRight aria-hidden="true" className="size-4" />
      </Link>
    </nav>
  );
}

/**
 * Cont fără fișă de angajat proprie — `super_admin`, sau un administrator
 * invitat care nu e angajat al firmei.
 *
 * `StareGoala`, nu `AccesRestrictionat`: omul are toate drepturile, îi lipsește
 * obiectul. Al doilea mesaj l-ar trimite să-și caute permisiuni pe care le are —
 * exact greșeala pe care `/pontaj/saptamana` a corectat-o deja în scris. Și nu
 * se face redirecționare tăcută spre altă vizualizare: absența lui
 * `?vizualizare=` ÎNSEAMNĂ „săptămână", iar o redirecționare ar face segmentul
 * activ să contrazică adresa și ar strica butonul „înapoi".
 */
function FaraFisaProprie({
  stare,
  parametri,
}: {
  readonly stare: "fara_fisa" | "fara_principala";
  readonly parametri: ParametriAdresa;
}) {
  const descriere =
    stare === "fara_fisa"
      ? "Grila săptămânii arată propriul pontaj, iar contul dumneavoastră nu este legat de o fișă de angajat în această organizație."
      : "Aveți o fișă de angajat, dar niciuna marcată ca principală, deci baza nu o poate lega de contul dumneavoastră. Cereți administratorului să marcheze fișa principală.";

  return (
    <StareGoala
      fel="initiala"
      pictograma={UserX}
      titlu="Nu aveți o săptămână proprie de pontat"
      descriere={descriere}
      actiune={{
        eticheta: "Vezi luna întregii firme",
        href: adresaVizualizare("/pontaj", parametri, "vizualizare", "luna", "saptamana"),
      }}
    />
  );
}

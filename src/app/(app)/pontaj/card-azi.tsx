// src/app/(app)/pontaj/card-azi.tsx
import Link from "next/link";
import { CalendarRange, Clock } from "lucide-react";

import { buton } from "@/components/ui/buton";
import { formatDate, oraInBucharest } from "@/lib/format/date";
import { citestePerioada, setariPontaj, setariPontareRapida } from "@/lib/queries/attendance";
import { fisaMea, pontajulMeu } from "@/lib/queries/portal";
import { configZiDin, intervalulPropus } from "@/domain/attendance/calcul-ore";
import { stareaCeasului } from "@/domain/attendance/ceas";
import { stareaLunii } from "@/domain/attendance/luna";
import { configPontareRapida, sePonteazaPeZi } from "@/domain/attendance/pontare-rapida";
import { meritaPontata } from "@/domain/attendance/zi-de-pontat";
import { PontareRapida } from "@/app/(portal)/portal/pontare-rapida";

import { PARAM_VIZUALIZARE } from "./vizualizari";

/**
 * „Astăzi" — propria pontare, în capul lui `/pontaj`.
 *
 * ── DE CE E AICI ────────────────────────────────────────────────────────────
 * Butoanele „Am intrat"/„Am ieșit" și „Pontează-te acum" trăiau DOAR pe
 * ecranul de start al portalului. Portalul e al rolului `employee`
 * (`POARTA_PORTAL_ACTIVA`): un `org_admin`, un `hr` sau un `manager` cu fișă de
 * angajat e redirecționat din el, deci nu avea niciun loc în care să se ponteze
 * dintr-o atingere — iar `/pontaj` îl ateriza pe foaia colectivă, unde rândul
 * lui e unul dintre douăzeci. Reclamat pe 6 oct 2026 de un manager și un
 * administrator reali.
 *
 * Aceeași componentă ca în portal (`PontareRapida`), deci aceleași acțiuni,
 * același ceas al serverului și aceleași reguli despre luna blocată și ziua
 * venită din altă sursă. Diferă doar drumurile: ziua se completează din grila
 * săptămânii, nu din `/portal/pontajul-meu/zi/…`, unde rolul n-ar ajunge.
 *
 * Poarta e a apelantului: `attendance:create` cel puțin `own`. Fără fișă
 * proprie, cardul tace — pagina explică deja absența ei, în foaie și în grilă.
 */
export async function CardAzi({
  organizationId,
  userId,
  numeFirma,
  azi,
  inSaptamana,
}: {
  readonly organizationId: string;
  readonly userId: string;
  readonly numeFirma: string;
  readonly azi: string;
  /** Grila săptămânii E deja locul în care se scrie ziua; linkul spre ea ar fi un ocol. */
  readonly inSaptamana: boolean;
}) {
  const stareFisa = await fisaMea(organizationId, userId);
  if (stareFisa.stare !== "ok") return null;

  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));

  const [perioada, setari, randPontare, zile] = await Promise.all([
    citestePerioada(organizationId, an, luna),
    setariPontaj(organizationId, azi),
    setariPontareRapida(organizationId),
    pontajulMeu(organizationId, an, luna, stareFisa.fisa.id),
  ]);

  const pontare = configPontareRapida(randPontare);

  /*
    Varianta săptămânală (0165): nimic de apăsat pe zi. Cardul rămâne — e locul
    în care omul caută cum se pontează — dar duce la fișa săptămânii, inclusiv
    din vizualizarea pe ore, unde grila nu mai primește tragere.
  */
  if (!sePonteazaPeZi(pontare)) {
    return (
      <section
        aria-labelledby="pontaj-azi"
        className="bg-surface border-border rounded-panou flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 id="pontaj-azi" className="text-corp text-foreground font-medium">
            Pontajul dumneavoastră
          </h2>
          <p className="text-muted-foreground text-nota">
            Firma se pontează pe săptămână: completați zilele în fișa săptămânii.
          </p>
        </div>
        <Link href="/pontaj/saptamana" className={buton({ varianta: "primar" })}>
          <CalendarRange aria-hidden="true" className="size-4" />
          Completează pontajul săptămânii
        </Link>
      </section>
    );
  }

  const ziDeAzi = zile.find((z) => z.data === azi) ?? null;
  const config = configZiDin(setari);
  const stareCeas = stareaCeasului(ziDeAzi, oraInBucharest(new Date()));
  const intervalPropus =
    pontare.programStart === null ? null : intervalulPropus(pontare.programStart, config);
  const lunaDeschisa = stareaLunii(perioada, an, luna).deschisa;
  // Aceeași poartă ca în portal: fără ea, cardul ar cere pontare în repausul
  // săptămânal al fiecărui birou.
  const seLucreazaAzi = meritaPontata(
    azi,
    setari === null
      ? null
      : {
          lucreazaWeekend: setari.lucreaza_weekend,
          lucreazaSarbatori: setari.lucreaza_sarbatori,
        },
  );

  const adresaSaptamanii = `/pontaj?${PARAM_VIZUALIZARE}=saptamana`;
  const cuCeas = seLucreazaAzi && pontare.mod !== "oprit";

  // În grilă, fără ceas, cardul n-ar avea nimic de oferit în plus față de grila
  // de dedesubt, care spune deja „trageți peste o zonă ca să pontați".
  if (!cuCeas && inSaptamana) return null;

  return (
    <section
      aria-labelledby="pontaj-azi"
      className="bg-surface border-border rounded-panou flex flex-col gap-3 border p-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <h2 id="pontaj-azi" className="text-corp text-foreground font-medium">
          Pontajul dumneavoastră de azi
        </h2>
        <p className="text-muted-foreground text-nota">{formatDate(azi)}</p>
      </div>

      <div className="w-full sm:max-w-xs">
        {cuCeas ? (
          <>
            <PontareRapida
              stare={stareCeas}
              pontare={pontare}
              intervalPropus={intervalPropus}
              numeFirma={numeFirma}
              lunaDeschisa={lunaDeschisa}
              adresaScanare={null}
            />
            {stareCeas.fel === "alta_sursa" ? (
              <p className="text-muted-foreground text-corp">
                Ziua de azi e deja înregistrată — din concediu, din foaia colectivă sau ca absență.
              </p>
            ) : null}
          </>
        ) : !lunaDeschisa ? (
          <p className="text-muted-foreground text-corp">
            Luna a fost blocată, deci pontajul ei nu se mai poate modifica.
          </p>
        ) : (
          /*
            Pontarea rapidă stinsă de firmă, sau zi liberă: rămâne drumul cu
            ore, adică ziua de azi din grila săptămânii — ecranul în care un
            rol din aplicația de administrare își scrie propriul interval.
          */
          <Link
            href={adresaSaptamanii}
            className={buton({ varianta: seLucreazaAzi ? "primar" : "secundar" })}
          >
            <Clock aria-hidden="true" className="size-4" />
            {seLucreazaAzi ? "Pontează-te acum" : "Ați lucrat totuși? Scrieți orele"}
          </Link>
        )}
      </div>
    </section>
  );
}

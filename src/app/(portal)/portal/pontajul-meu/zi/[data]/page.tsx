// src/app/(portal)/portal/pontajul-meu/zi/[data]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { ziDinRuta } from "@/lib/rute/parametri";
import { formatDate } from "@/lib/format/date";
import { citestePerioada, setariPontaj } from "@/lib/queries/attendance";
import { fisaMea, pontajulMeu } from "@/lib/queries/portal";
import { stareaLunii } from "@/domain/attendance/luna";
import type { TipPrezenta } from "@/schemas/attendance";
import type { ConfigZi } from "@/domain/attendance/calcul-ore";
import { rezumatRegulaPontaj } from "@/app/(app)/pontaj/etichete";

import { FaraFisa } from "../../../fara-fisa";
import { ETICHETE_TIP_ZI } from "../../../etichete";
import { FormularZi } from "./formular-zi";

export const metadata: Metadata = { title: "Ziua mea de pontaj" };

export default async function PaginaZiPontaj({
  params,
}: {
  readonly params: Promise<{ readonly data: string }>;
}) {
  const { data } = await params;
  const zi = ziDinRuta(data);

  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "attendance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "attendance:create", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a completa pontajul." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const an = Number(zi.slice(0, 4));
  const luna = Number(zi.slice(5, 7));
  const [perioada, zileLuna] = await Promise.all([
    citestePerioada(tenant.organizationId, an, luna),
    pontajulMeu(tenant.organizationId, an, luna, stare.fisa.id),
  ]);
  const existenta = zileLuna.find((z) => z.data === zi) ?? null;

  const antet = (
    <AntetPagina titlu={formatDate(zi)} descriere="Pontajul dumneavoastră pe ziua aceasta." />
  );

  const inapoi = (
    <p>
      <Link href="/portal/pontajul-meu" className={buton({ varianta: "link" })}>
        Înapoi la pontajul meu
      </Link>
    </p>
  );

  /*
    Luna BLOCATĂ: refuzul se dă ÎNAINTE de a arăta formularul, nu după drumul la
    server. Triggerul `internal.pontaj_intrare_pregateste` ridică oricum P0001,
    dar un buton care duce sigur în eroare e un defect de ecran.

    ── DE CE `stareaLunii`, ȘI NU `status !== "deschisa"` ────────────────────
    Condiția de dinainte refuza și `in_aprobare`, și luna fără rând. Amândouă
    sunt greșite, și amândouă doar pe ecran: baza verifică EXCLUSIV `blocata`
    (0013:293), iar din 0132 rândul se naște la prima scriere, deci absența lui
    înseamnă lună neîncepută, nu lună interzisă.

    Consecința, reclamată pe 11 sept 2026: managerul aprobă un lot, ceea ce mută
    luna în `in_aprobare` (`aprobaPontajBloc`), iar din clipa aia portalul
    refuza TUTUROR angajaților orice corecție pe luna curentă — inclusiv exact
    corecția pe care o zi respinsă tocmai le-o cerea. Fundătură perfectă: ți se
    cere să repari ceva ce ecranul nu te lasă să atingi.

    Regula stă într-un singur loc, `src/domain/attendance/luna.ts`, care o
    descrie de la 0132 — portalul pur și simplu nu fusese mutat pe ea.
  */
  const stareLuna = stareaLunii(perioada, an, luna);
  if (!stareLuna.deschisa) {
    return (
      <div className={`${LATIMI.formular} space-y-4 p-4`}>
        {antet}
        <StareGoala
          fel="restrictionata"
          pictograma={Lock}
          titlu="Luna a fost blocată"
          descriere="Luna e închisă definitiv, iar pontajul ei nu se mai poate modifica. Pentru o corectură, cereți responsabilului de pontaj să o deblocheze."
        />
        {inapoi}
      </div>
    );
  }

  // Ziua venită din concediu se modifică din cererea de concediu, nu de aici:
  // altfel cele două s-ar contrazice, iar sincronizarea ar suprascrie tăcut.
  const dinConcediu =
    existenta !== null && (existenta.tip_zi === "concediu" || existenta.tip_zi === "medical");

  if (dinConcediu) {
    return (
      <div className={`${LATIMI.formular} space-y-4 p-4`}>
        {antet}
        <div className="bg-surface border-border rounded-panou border p-4">
          <p className="text-foreground text-corp font-medium">
            {ETICHETE_TIP_ZI[existenta.tip_zi] ?? existenta.tip_zi}
          </p>
          <p className="text-muted-foreground text-corp mt-1">
            Ziua vine din concediul aprobat și se modifică de acolo, nu din pontaj.
          </p>
        </div>
        {inapoi}
      </div>
    );
  }

  // Parametrii după care se derivă ziua din interval. Aceleași valori de
  // rezervă ca în `/pontaj/page.tsx` și în `salveazaZiPontaj`: absența
  // setărilor e normală (nu există seed pentru `attendance_settings`), iar
  // pauza implicită e zero și „inclusă în program" — o firmă care n-a
  // configurat nimic nu trebuie să piardă tăcut ore din pontajul oamenilor.
  //
  // Angajatul POATE citi tabela: `attendance_settings_select` (0013:732) cere
  // `attendance:read` la scope `own`, exact ce are rolul `employee`.
  const setari = await setariPontaj(tenant.organizationId, zi);
  const config: ConfigZi = {
    orePeZi: setari?.ore_pe_zi ?? 8,
    noapteStart: setari?.noapte_start.slice(0, 5) ?? "22:00",
    noapteSfarsit: setari?.noapte_sfarsit.slice(0, 5) ?? "06:00",
    pauzaMinute: setari?.pauza_masa_minute ?? 0,
    pauzaInclusaInProgram: setari?.pauza_masa_inclusa_in_program ?? true,
    pauzaObligatoriePesteOre: setari?.pauza_obligatorie_peste_ore ?? 0,
  };

  return (
    <div className={`${LATIMI.formular} space-y-4 p-4`}>
      {antet}
      {/*
        Motivul respingerii, la locul corecției.

        Notificarea trimite exact aici, iar respingerea CERE o corecție — deci
        motivul trebuie să stea deasupra formularului pe care omul îl va
        completa, nu într-un tooltip pe alt ecran. Respingerea nu blochează
        editarea: politica de UPDATE oprește ziua APROBATĂ, iar
        `decide_zi_pontaj` tocmai a șters aprobarea, deci ziua e din nou de
        scris — exact ce se cere.
      */}
      {existenta !== null && existenta.respins_la !== null ? (
        <Callout fel="eroare" titlu="Ziua a fost respinsă">
          {existenta.motiv_respingere ?? "Nu a fost înregistrat niciun motiv."} Corectați intervalul
          de mai jos și salvați din nou.
        </Callout>
      ) : null}
      {/* Aceeași regulă ca la planul săptămânal: formularul ține orele în
          `useState`, deci o navigare zi → zi ar reutiliza instanța și ar
          păstra valorile zilei precedente. Azi nu există niciun link direct
          între două zile (se trece mereu prin listă, care demontează
          formularul), deci defectul e latent — dar cheia îl închide înainte
          să apară primul buton „ziua următoare". */}
      <FormularZi
        key={zi}
        data={zi}
        config={config}
        // Regula se calculează pentru ZIUA pontată, nu pentru azi: setările au
        // istoric, iar o versiune pusă în vigoare de luna viitoare nu se aplică
        // zilei ăsteia. Exact diferența pe care ecranul o ascundea.
        regulaFirmei={rezumatRegulaPontaj(config, setari !== null)}
        // `time` din Postgres vine ca `"08:30:00"`; `<input type="time">` cere
        // `"HH:MM"`. Fără tăiere, câmpul rămâne gol fără nicio explicație.
        // Locul de muncă declarat. Trimis explicit ca valoare inițială fiindcă
        // `salveazaZiPontaj` rescrie coloana la fiecare salvare: un formular
        // care nu-l cunoaște ar șterge tăcut ce a declarat planul săptămânal.
        tipPrezentaInitial={(existenta?.tip_prezenta as TipPrezenta | null) ?? ""}
        inceputInitial={existenta?.ora_inceput?.slice(0, 5) ?? ""}
        sfarsitInitial={existenta?.ora_sfarsit?.slice(0, 5) ?? ""}
        oreSalvate={existenta?.ore_lucrate ?? null}
        observatiiInitiale={existenta?.observatii ?? ""}
      />
      {inapoi}
    </div>
  );
}

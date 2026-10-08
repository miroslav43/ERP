// src/app/(portal)/portal/pontajul-meu/saptamana/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import {
  citesteSaptamanaPontaj,
  intrariLuna,
  setariPontaj,
  setariPontareRapida,
} from "@/lib/queries/attendance";
import { configPontareRapida } from "@/domain/attendance/pontare-rapida";
import { fisaMea } from "@/lib/queries/portal";
import type { ConfigZi } from "@/domain/attendance/calcul-ore";
import {
  adaugaZile,
  esteLuni,
  existaSaptamanaUrmatoare,
  lunieaSaptamanii,
  saptamanaImplicita,
  zileleSaptamanii,
} from "@/domain/attendance/saptamana";
import { ziuaInitialaPlan } from "@/domain/attendance/plan-si-fapt";
import { FormularSaptamana } from "@/app/(app)/pontaj/saptamana/formular-saptamana";
import {
  TONURI_STARE_SAPTAMANA,
  etichetaStareSaptamana,
  rezumatRegulaPontaj,
} from "@/app/(app)/pontaj/etichete";

import { FaraFisa } from "../../fara-fisa";

export const metadata: Metadata = { title: "Planul săptămânii" };

export default async function PaginaSaptamanaPortal({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
        <AccesRestrictionat mesaj="Nu aveți dreptul de a completa pontajul săptămânii." />
      </div>
    );
  }

  // Varianta de pontaj (0165) se citește ÎNAINTEA săptămânii: ea decide care e
  // săptămâna implicită — viitoarea pentru plan, cea curentă pentru fișa de pontaj.
  const [stare, randPontare] = await Promise.all([
    fisaMea(tenant.organizationId, user.id),
    setariPontareRapida(tenant.organizationId),
  ]);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;
  const { necesitaAprobare, varianta } = configPontareRapida(randPontare);
  const peSaptamana = varianta === "saptamanal";

  const azi = todayInBucharest();
  const parametri = await searchParams;
  const brut = parametri["saptamana"];
  // Valoarea din bara de adrese se acceptă doar dacă e chiar o zi de luni.
  // Orice altceva cade pe implicit — nu ajunge la Postgres ca text.
  const cerut = typeof brut === "string" ? brut : "";
  const saptamanaStart = esteLuni(cerut) ? cerut : saptamanaImplicita(peSaptamana, azi);

  /*
    Planul și ce s-a pontat efectiv în săptămâna asta (0118) — aceeași
    precompletare ca pe ecranul de admin. Scrisă în AMÂNDOUĂ locurile deodată,
    fiindcă exact aici a rămas portalul în urmă data trecută: reparația
    implicitelor de weekend a stat luni pe pagina de admin înainte să ajungă și
    pe telefonul de pe care se pontează.

    `intrariLuna(org, [fisa], …)`, nu `intrariProprii`: a doua nu filtrează pe
    `employee_id` și se bazează pe RLS.
  */
  const [submisie, pontate] = await Promise.all([
    citesteSaptamanaPontaj(tenant.organizationId, stare.fisa.id, saptamanaStart),
    intrariLuna(
      tenant.organizationId,
      [stare.fisa.id],
      saptamanaStart,
      adaugaZile(saptamanaStart, 6),
    ),
  ]);

  /*
   * DEFECT REPARAT: implicitul era `?? 8` pentru TOATE cele șapte zile, deci
   * sâmbăta și duminica veneau precompletate cu 8 ore. Cine deschidea ecranul
   * și apăsa direct „Trimite spre aprobare” declara 56 de ore pe săptămână,
   * dintre care 16 într-un weekend pe care nu-l alesese nimeni.
   *
   * Pagina de admin (`(app)/pontaj/saptamana/page.tsx`) primise deja reparatția
   * asta; portalul rămăsese în urmă, deși e ecranul deschis de pe telefon,
   * adică exact acela unde nimeni nu verifică șapte câmpuri înainte de a trimite.
   */
  /*
    Setările juridice ȘI regula de aprobare a firmei (0118). A doua decide ce
    scrie pe buton și dacă planul rămâne editabil după trimitere — iar ecranul
    ăsta trebuie s-o afle singur: n-are banda de file, deci nu trece prin
    `fileDePontaj` ca paginile de sub `/pontaj`.
  */
  const setari = await setariPontaj(tenant.organizationId, saptamanaStart);

  const zileInitiale = zileleSaptamanii(saptamanaStart).map((data) =>
    ziuaInitialaPlan(
      data,
      submisie?.zile.find((z) => z.data === data) ?? null,
      pontate.find((z) => z.data === data) ?? null,
    ),
  );

  const config: ConfigZi = {
    orePeZi: setari?.ore_pe_zi ?? 8,
    noapteStart: setari?.noapte_start.slice(0, 5) ?? "22:00",
    noapteSfarsit: setari?.noapte_sfarsit.slice(0, 5) ?? "06:00",
    pauzaMinute: setari?.pauza_masa_minute ?? 0,
    pauzaInclusaInProgram: setari?.pauza_masa_inclusa_in_program ?? true,
    pauzaObligatoriePesteOre: setari?.pauza_obligatorie_peste_ore ?? 0,
  };

  const lucreazaWeekendInitial = submisie?.lucreazaWeekend ?? setari?.lucreaza_weekend ?? false;

  // O săptămână aprobată nu se mai retrage: `attendance_week_submissions_update`
  // (`0041:388`) n-are ramură pentru autor, deci un UPDATE ar afecta zero rânduri,
  // tăcut. Formularul se blochează, nu lasă butonul activ ca să ducă în refuz.
  // Fără pas de aprobare, `aprobata` e pusă de trigger la trimitere (0118 §3):
  // fără ramura a treia, planul s-ar îngheța la prima apăsare.
  // Pe săptămână, o săptămână neîncepută nu se pontează: serverul o refuză, deci
  // formularul nu-i oferă butoanele.
  const inViitor = peSaptamana && saptamanaStart > lunieaSaptamanii(azi);
  const poateEdita =
    !inViitor && (submisie === null || submisie.status !== "aprobata" || !necesitaAprobare);

  return (
    <div className={`${LATIMI.formular} space-y-4 p-4`}>
      <AntetPagina
        titlu={peSaptamana ? "Pontajul săptămânii" : "Planul săptămânii"}
        descriere={
          peSaptamana
            ? `Săptămâna care începe ${formatDate(saptamanaStart)}: ce ați lucrat, zi cu zi.`
            : `Săptămâna care începe ${formatDate(saptamanaStart)}: cum veniți la lucru și în ce interval.`
        }
      />

      <nav aria-label="Alege săptămâna" className="flex flex-wrap items-center gap-2">
        <Link
          href={`/portal/pontajul-meu/saptamana?saptamana=${adaugaZile(saptamanaStart, -7)}`}
          className={buton({ varianta: "secundar" })}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Anterioară
        </Link>
        {existaSaptamanaUrmatoare(peSaptamana, saptamanaStart, azi) ? (
          <Link
            href={`/portal/pontajul-meu/saptamana?saptamana=${adaugaZile(saptamanaStart, 7)}`}
            className={buton({ varianta: "secundar" })}
          >
            Următoarea
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
        {submisie === null ? null : (
          <Badge ton={TONURI_STARE_SAPTAMANA[submisie.status]}>
            {etichetaStareSaptamana(submisie.status, necesitaAprobare)}
          </Badge>
        )}
      </nav>

      {/* Motivul respingerii, înaintea formularului: e informația pentru care
          omul a deschis ecranul, iar notificarea care l-a adus aici n-o conține. */}
      {submisie?.status === "respinsa" && submisie.motivRespingere !== null ? (
        <p className="border-danger/40 bg-danger/10 text-foreground rounded-panou text-corp border p-3">
          <strong className="font-medium">Motivul respingerii:</strong> {submisie.motivRespingere}
        </p>
      ) : null}

      {/*
        `key` pe săptămână, nu decor: formularul ține zilele în `useState`,
        inițializat din props. La navigarea pe client către altă săptămână, React
        găsește același tip de componență în aceeași poziție și REUTILIZEAZĂ
        instanța — argumentul lui `useState` se citește doar la montare, deci
        tabelul rămânea pe zilele săptămânii precedente. Antetul se schimba (e
        randat pe server), tabelul nu, iar butoanele „Anterioară"/„Următoarea"
        păreau moarte. Cheia schimbată forțează remontarea.
      */}
      <FormularSaptamana
        key={saptamanaStart}
        saptamanaStart={saptamanaStart}
        zileInitiale={zileInitiale}
        poateEdita={poateEdita}
        necesitaAprobare={necesitaAprobare}
        peSaptamana={peSaptamana}
        config={config}
        // Aceeași dată ca la citirea setărilor: începutul săptămânii.
        regulaFirmei={rezumatRegulaPontaj(config, setari !== null)}
        lucreazaWeekendInitial={lucreazaWeekendInitial}
      />

      {can(permisiuni, "attendance:read", "own") ? (
        <p>
          <Link href="/portal/pontajul-meu" className={buton({ varianta: "link" })}>
            Înapoi la pontajul meu
          </Link>
        </p>
      ) : null}
    </div>
  );
}

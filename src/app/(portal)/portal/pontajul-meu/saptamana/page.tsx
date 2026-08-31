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
import { citesteSaptamanaPontaj, setariPontaj } from "@/lib/queries/attendance";
import { fisaMea } from "@/lib/queries/portal";
import type { ConfigZi } from "@/domain/attendance/calcul-ore";
import {
  adaugaZile,
  esteLuni,
  lunieaUrmatoare,
  zileleSaptamanii,
} from "@/domain/attendance/saptamana";
import { FormularSaptamana } from "@/app/(app)/pontaj/saptamana/formular-saptamana";
import {
  TONURI_STARE_SAPTAMANA,
  ETICHETE_STARE_SAPTAMANA,
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
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "attendance:create", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a completa un plan de prezență." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const parametri = await searchParams;
  const brut = parametri["saptamana"];
  // Valoarea din bara de adrese se acceptă doar dacă e chiar o zi de luni.
  // Orice altceva cade pe implicit — nu ajunge la Postgres ca text.
  const cerut = typeof brut === "string" ? brut : "";
  const saptamanaStart = esteLuni(cerut) ? cerut : lunieaUrmatoare(todayInBucharest());

  const submisie = await citesteSaptamanaPontaj(
    tenant.organizationId,
    stare.fisa.id,
    saptamanaStart,
  );

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
  const setari = await setariPontaj(tenant.organizationId, saptamanaStart);

  const zileInitiale = zileleSaptamanii(saptamanaStart).map((data) => {
    const existenta = submisie?.zile.find((z) => z.data === data) ?? null;
    return {
      data,
      tip_prezenta: existenta?.tip_prezenta ?? "birou",
      /*
       * Ce e salvat se arată, indiferent ce zi e în calendar. Aici stătea o
       * poartă `esteZiLucratoare(…) ? … : ""` care golea câmpul pe weekend și
       * pe sărbători. Cum `existenta` e `null` exact când n-ai ce arăta, poarta
       * nu putea opri niciun „interval presupus" — doar ascundea ore chiar
       * salvate, pe care următoarea trimitere le ștergea apoi din bază
       * (`trimite_saptamana_pontaj` face `delete` + reinserare, 0084).
       */
      ora_inceput: existenta?.ora_inceput?.slice(0, 5) ?? "",
      ora_sfarsit: existenta?.ora_sfarsit?.slice(0, 5) ?? "",
      observatii: existenta?.observatii ?? "",
    };
  });

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
  const poateEdita = submisie === null || submisie.status !== "aprobata";

  return (
    <div className={`${LATIMI.formular} space-y-4 p-4`}>
      <AntetPagina
        titlu="Planul săptămânii"
        descriere={`Săptămâna care începe ${formatDate(
          saptamanaStart,
        )}: cum veniți la lucru și în ce interval.`}
      />

      <nav aria-label="Alege săptămâna" className="flex flex-wrap items-center gap-2">
        <Link
          href={`/portal/pontajul-meu/saptamana?saptamana=${adaugaZile(saptamanaStart, -7)}`}
          className={buton({ varianta: "secundar" })}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Anterioară
        </Link>
        <Link
          href={`/portal/pontajul-meu/saptamana?saptamana=${adaugaZile(saptamanaStart, 7)}`}
          className={buton({ varianta: "secundar" })}
        >
          Următoarea
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
        {submisie === null ? null : (
          <Badge ton={TONURI_STARE_SAPTAMANA[submisie.status]}>
            {ETICHETE_STARE_SAPTAMANA[submisie.status]}
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
        config={config}
        // Aceeași dată ca la citirea setărilor: începutul săptămânii.
        regulaFirmei={rezumatRegulaPontaj(config, setari !== null)}
        lucreazaWeekendInitial={lucreazaWeekendInitial}
      />

      <p>
        <Link href="/portal/pontajul-meu" className={buton({ varianta: "link" })}>
          Înapoi la pontajul meu
        </Link>
      </p>
    </div>
  );
}

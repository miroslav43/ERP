// src/app/(app)/concedii/[id]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { LinkDocumentConcediu } from "../link-document";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatAmount } from "@/lib/format/money";
import { formatDate, formatDateTime, todayInBucharest } from "@/lib/format/date";
import { citesteCerere, lantulAprobarii, zileleCererii } from "@/lib/queries/leave";
import { fisaMea } from "@/lib/queries/portal";
import { grupeazaPeTrepte } from "@/domain/leave/lant-aprobare";
import { autorulPoateRetrage } from "@/domain/leave/verificari";

import {
  ETICHETE_PORTIUNE,
  ETICHETE_STATUS_CERERE,
  ETICHETE_STATUS_SARCINA,
  TONURI_STATUS_SARCINA,
  TONURI_STATUS_CERERE,
} from "../etichete";
import { ActiuniCerere } from "./actiuni-cerere";
import { DecizieAprobare } from "../aprobari/decizie-aprobare";
import { idDinRuta } from "@/lib/rute/parametri";

export const metadata: Metadata = { title: "Detaliile cererii de concediu" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

interface TipMinim {
  readonly denumire: string;
  readonly culoare: string;
}

interface AngajatMinim {
  readonly full_name: string;
  readonly marca: string;
}

export default async function PaginaDetaliuCerere({ params }: ProprietatiPagina) {
  const { id: idBrut } = await params;
  const id = idDinRuta(idBrut);
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "leave");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "leave:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta cererile de concediu. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const cerere = await citesteCerere(tenant.organizationId, id);
  if (cerere === null) notFound();

  const db = await createServerSupabase();

  // Numele angajatului se citește doar dacă scope-ul depășește „own”:
  // pentru un rol strict „own” (`employees:read = none`), RLS ar întoarce
  // oricum null — mai bine sărim interogarea decât să o lăsăm eșueze tăcut.
  const arataAngajat = can(permisiuni, "leave:read", "team");

  /*
    Cinci citiri, un singur val.
    Erau puse cap la cap: `Promise.all([zile, lant])`, apoi tipul, apoi
    angajatul, apoi fișa proprie. Niciuna nu depinde de rezultatul alteia —
    toate au nevoie doar de `cerere`, care e deja în mână. `fisaMea` nici măcar
    de asta: îi trebuie doar tenantul și utilizatorul, disponibile de la intrare.
  */
  const [zile, lant, tipRes, angajatRes, stareFisa] = await Promise.all([
    zileleCererii(cerere.id),
    lantulAprobarii(tenant.organizationId, cerere.id),
    db
      .from("leave_types")
      .select("denumire, culoare")
      .eq("organization_id", tenant.organizationId)
      .eq("id", cerere.leave_type_id)
      .maybeSingle<TipMinim>(),
    arataAngajat
      ? db
          .from("employees")
          .select("full_name, marca")
          .eq("organization_id", tenant.organizationId)
          .eq("id", cerere.employee_id)
          .maybeSingle<AngajatMinim>()
      : null,
    fisaMea(tenant.organizationId, user.id),
  ]);

  const tip = tipRes.data;
  const angajat: AngajatMinim | null = angajatRes?.data ?? null;

  // Sarcina proprie, dacă există: cine poate decide trebuie s-o poată face DE
  // AICI, nu doar din ecranul de aprobări. Fișa e locul unde te uiți ca să
  // înțelegi cererea; a te trimite înapoi în listă ca să apeși un buton e
  // exact drumul pe care nimeni nu-l găsește.
  //
  // `lantulAprobarii` trece prin RLS: `approval_tasks_select` arată sarcinile
  // proprii, deci dacă apare aici e a mea. Verificarea de drept rămâne oricum
  // în `decideCerere`, la scriere.
  const sarcinaMea =
    lant.find((pas) => pas.approver_user_id === user.id && pas.status === "in_asteptare") ?? null;

  // ── CINE POATE ANULA, ȘI DE CE E NEVOIE DE FIȘA PROPRIE ────────────────────
  // Ecranul ăsta nu e „cererea mea", ca în portal: aici ajung și managerul, și
  // HR-ul, pe cererea altcuiva. `can(..., "leave:update", "own")` e adevărat și
  // pentru `hr`, care are scope `all` — deci singur nu deosebește cererea
  // proprie de a altcuiva.
  //
  // Distincția contează abia de la 0079: retragerea unui concediu APROBAT e
  // dreptul angajatului asupra propriului concediu, nu o unealtă
  // administrativă. Fără `esteAMea`, butonul ar apărea HR-ului pe concediul
  // aprobat al oricui — iar `anuleazaCerere` l-ar refuza oricum, ceea ce e cea
  // mai proastă combinație: un buton care se vede și nu funcționează.
  //
  // Ciorna și cererea trimisă rămân exact ca înainte, pentru oricine are
  // dreptul — nu se restrânge nimic din ce mergea.
  const esteAMea = stareFisa.stare === "ok" && stareFisa.fisa.id === cerere.employee_id;

  const poateAnula =
    can(permisiuni, "leave:update", "own") &&
    (esteAMea
      ? autorulPoateRetrage(cerere.status, cerere.data_inceput, todayInBucharest())
      : cerere.status === "ciorna" || cerere.status === "trimisa");
  const esteCiorna = cerere.status === "ciorna";
  const esteAprobata = cerere.status === "aprobata";

  return (
    <div className="space-y-6">
      <AntetPagina
        // Ecranul cel mai vizitat al modulului era singurul din cele șapte fără
        // NICIO cale de întoarcere: nici bandă de file, nici firimitură, nici
        // link „înapoi”. Se ajunge aici din listă, din coada de aprobări și din
        // portal, iar singura ieșire era butonul de înapoi al browserului.
        // Firimitura, nu banda de file: pe o fișă, „unde sunt” valorează mai
        // mult decât „ce alte ecrane mai există”.
        firimituri={[
          { eticheta: "Concedii", href: "/concedii" },
          {
            eticheta: `${formatDate(cerere.data_inceput)} – ${formatDate(cerere.data_sfarsit)}`,
          },
        ]}
        titlu={tip?.denumire ?? "Cerere de concediu"}
        descriere={`${angajat !== null ? `${angajat.full_name} (${angajat.marca}) · ` : ""}${formatDate(
          cerere.data_inceput,
        )} – ${formatDate(cerere.data_sfarsit)}`}
        actiuni={
          <Badge ton={TONURI_STATUS_CERERE[cerere.status]}>
            {ETICHETE_STATUS_CERERE[cerere.status]}
          </Badge>
        }
      />

      <section aria-labelledby="titlu-rezumat" className="border-border rounded-panou border p-4">
        <h2 id="titlu-rezumat" className="text-sectiune mb-4 font-medium">
          Rezumat
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground text-nota tracking-wide uppercase">
              Zile lucrătoare
            </dt>
            <dd className="text-corp mt-0.5">{formatAmount(cerere.zile_lucratoare)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-nota tracking-wide uppercase">
              Zile calendaristice
            </dt>
            <dd className="text-corp mt-0.5">{cerere.zile_calendaristice}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-nota tracking-wide uppercase">Porțiuni</dt>
            <dd className="text-corp mt-0.5">
              {ETICHETE_PORTIUNE[cerere.portiune_inceput]}
              {cerere.portiune_inceput !== cerere.portiune_sfarsit
                ? ` → ${ETICHETE_PORTIUNE[cerere.portiune_sfarsit]}`
                : ""}
            </dd>
          </div>
          {cerere.trimisa_la !== null ? (
            <div>
              <dt className="text-muted-foreground text-nota tracking-wide uppercase">
                Trimisă la
              </dt>
              <dd className="text-corp mt-0.5">{formatDateTime(cerere.trimisa_la)}</dd>
            </div>
          ) : null}
          {cerere.decis_la !== null ? (
            <div>
              <dt className="text-muted-foreground text-nota tracking-wide uppercase">Decisă la</dt>
              <dd className="text-corp mt-0.5">{formatDateTime(cerere.decis_la)}</dd>
            </div>
          ) : null}
          {cerere.motiv !== null && cerere.motiv.length > 0 ? (
            <div className="sm:col-span-3">
              <dt className="text-muted-foreground text-nota tracking-wide uppercase">Motiv</dt>
              <dd className="text-corp mt-0.5">{cerere.motiv}</dd>
            </div>
          ) : null}
          {cerere.atasament_path !== null ? (
            <div className="sm:col-span-3">
              <dt className="text-muted-foreground text-nota tracking-wide uppercase">
                Document justificativ
              </dt>
              <dd className="text-corp mt-0.5">
                <LinkDocumentConcediu cerereId={cerere.id} />
              </dd>
            </div>
          ) : null}
          {cerere.motiv_respingere !== null ? (
            <div className="sm:col-span-3">
              <dt className="text-danger text-nota tracking-wide uppercase">Motivul respingerii</dt>
              <dd className="text-corp mt-0.5">{cerere.motiv_respingere}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="titlu-zile" className="border-border rounded-panou border p-4">
        <h2 id="titlu-zile" className="text-sectiune mb-4 font-medium">
          Zilele cererii
        </h2>
        {zile.length === 0 ? (
          <p className="text-muted-foreground text-corp">
            Zilele cererii nu au fost încă generate.
          </p>
        ) : (
          <ul className="text-corp grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {zile.map((zi) => (
              <li
                key={zi.data}
                className={`rounded-control border px-2 py-1.5 text-center ${
                  zi.este_lucratoare ? "border-border" : "border-border text-muted-foreground"
                }`}
              >
                <div className="font-medium">{formatDate(zi.data)}</div>
                {zi.portiune !== "zi_intreaga" ? (
                  <div className="text-nota">{ETICHETE_PORTIUNE[zi.portiune]}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titlu-aprobare" className="border-border rounded-panou border p-4">
        <h2 id="titlu-aprobare" className="text-sectiune mb-4 font-medium">
          Lanțul de aprobare
        </h2>
        {esteCiorna ? (
          <p className="text-muted-foreground text-corp">
            Cererea este încă o ciornă: nimeni nu a fost anunțat, iar zilele nu sunt rezervate.
            Lanțul de aprobare se generează în momentul trimiterii.
          </p>
        ) : lant.length === 0 ? (
          // Solicitantul vede lanțul GOL dacă nu e el însuși aprobator:
          // `approval_tasks_select` arată doar sarcinile proprii. Nu se
          // randează un tabel gol — mesajul explică ce urmează.
          <p className="text-muted-foreground text-corp">
            Cererea a fost trimisă spre aprobare; rezultatul apare aici după decizie.
          </p>
        ) : (
          <ol className="text-corp space-y-2">
            {/* Grupat pe trepte: `approval_tasks` are o sarcină per aprobator
                posibil, nu per treaptă. Negrupate, cei patru aprobatori ai unei
                singure trepte apăreau ca „Pasul 1” de patru ori. */}
            {grupeazaPeTrepte(lant).map((pas) => (
              <li key={pas.ordine} className="border-border rounded-control border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    Pasul {pas.ordine}
                    {pas.candidatiVizibili > 1 && pas.status === "in_asteptare" ? (
                      <span className="text-muted-foreground ml-2 font-normal">
                        oricare dintre {pas.candidatiVizibili} aprobatori
                      </span>
                    ) : null}
                  </span>
                  <Badge
                    ton={TONURI_STATUS_SARCINA[pas.status]}
                    cuAvertisment={pas.status === "expirata"}
                  >
                    {ETICHETE_STATUS_SARCINA[pas.status]}
                  </Badge>
                </div>
                {pas.comentariu !== null && pas.comentariu.length > 0 ? (
                  <p className="text-muted-foreground mt-1">{pas.comentariu}</p>
                ) : null}
                {pas.decis_la !== null ? (
                  <p className="text-muted-foreground text-nota mt-1">
                    Decis la {formatDateTime(pas.decis_la)}
                  </p>
                ) : pas.termen_la !== null ? (
                  <p className="text-muted-foreground text-nota mt-1">
                    Termen: {formatDateTime(pas.termen_la)}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {sarcinaMea !== null ? (
        <section
          aria-labelledby="titlu-decizie"
          className="border-border bg-surface rounded-panou border p-4"
        >
          <h2 id="titlu-decizie" className="text-sectiune mb-3 font-medium">
            Cererea așteaptă decizia dumneavoastră
          </h2>
          <DecizieAprobare taskId={sarcinaMea.id} />
        </section>
      ) : null}

      {poateAnula ? (
        <ActiuniCerere cerereId={cerere.id} esteCiorna={esteCiorna} esteAprobata={esteAprobata} />
      ) : null}
    </div>
  );
}

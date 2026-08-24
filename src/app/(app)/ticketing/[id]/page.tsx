// src/app/(app)/ticketing/[id]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/ui/cn";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import {
  citesteTichetul,
  listeazaComentariile,
  listeazaIstoricul,
  managerulDirectAl,
} from "@/lib/queries/ticketing";
import { fisaProprie } from "@/lib/queries/portal";
import { tranzitiiOferite, type StatusTichet } from "@/domain/ticketing/stari";
import type { Prioritate } from "@/domain/ticketing/prioritate";

import {
  ETICHETE_CAMP,
  ETICHETE_PRIORITATE,
  ETICHETE_STATUS,
  ETICHETE_TIP,
  TONURI_PRIORITATE,
  TONURI_STATUS,
} from "../etichete";
import {
  DecizieCerere,
  FormularComentariu,
  Macrouri,
  PrioritateManuala,
  Repartizare,
  SchimbaStatus,
} from "./actiuni-tichet";

export const metadata: Metadata = { title: "Tichet" };

interface ProprietatiPagina {
  readonly params: Promise<{ id: string }>;
}

function Rand({ eticheta, valoare }: Readonly<{ eticheta: string; valoare: string | null }>) {
  if (valoare === null || valoare === "") return null;
  return (
    <div className="border-border flex items-baseline justify-between gap-4 border-b py-2 last:border-0">
      <dt className="text-muted-foreground text-corp">{eticheta}</dt>
      <dd className="text-foreground text-corp text-right">{valoare}</dd>
    </div>
  );
}

/**
 * Traducerea unei valori din `ticket_history`.
 *
 * Istoricul scria valorile BRUTE din bază — „din «in_lucru» în «in_asteptare»",
 * „din «normala» în «critica»" — deși hărțile de traducere sunt importate în
 * chiar acest fișier și folosite la trei rânduri distanță, pe pastilele din
 * antet. Numele CÂMPULUI era deja tradus prin `ETICHETE_CAMP`; valoarea lui, nu.
 * Un câmp necunoscut (adăugat de o migrare mai nouă decât ecranul) își păstrează
 * valoarea brută: mai bine ceva de citit decât un gol.
 */
function traduValoare(camp: string, valoare: string): string {
  if (camp === "status") return ETICHETE_STATUS[valoare as StatusTichet] ?? valoare;
  if (camp === "prioritate") return ETICHETE_PRIORITATE[valoare as Prioritate] ?? valoare;
  return valoare;
}

/**
 * Contextul de diagnostic al unui bug, citit din `tickets.context` (jsonb).
 *
 * ── DE CE ERA NEVĂZUT DE NIMENI ───────────────────────────────────────────────
 * Formularul de tichet nou îl capturează SINGUR pentru `bug_erp`
 * (`nou/formular-tichet.tsx:79-88`): adresa paginii, user agent-ul și versiunea
 * aplicației, cu comentariul „angajatul nu trebuie să știe ce e un user agent".
 * Se validează în `tichetBugSchema`, se scrie în bază — și nu se afișa nicăieri.
 * Cine primea raportul de bug nu vedea nici pe ce ecran s-a întâmplat, nici pe
 * ce versiune, adică exact cele două lucruri pe care angajatul nu le poate
 * spune singur.
 *
 * Citirea e apărată: `context` e `Json | null` în tipuri, deci poate fi orice —
 * un obiect scris de o versiune mai veche a formularului, sau un vector. O
 * formă neașteptată nu are voie să dărâme fișa tichetului.
 */
function contextDiagnostic(
  brut: unknown,
): readonly Readonly<{ eticheta: string; valoare: string }>[] {
  if (brut === null || typeof brut !== "object" || Array.isArray(brut)) return [];
  const inregistrare = brut as Record<string, unknown>;
  const campuri = [
    ["Adresa paginii", "url"],
    ["Browser", "user_agent"],
    ["Versiunea aplicației", "versiune"],
  ] as const;

  return campuri.flatMap(([eticheta, cheie]) => {
    const valoare = inregistrare[cheie];
    return typeof valoare === "string" && valoare !== "" ? [{ eticheta, valoare }] : [];
  });
}

export default async function PaginaTichet({ params }: ProprietatiPagina) {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "ticketing");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "tickets:read", "own")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta tichetele." />;
  }

  const { id } = await params;
  const tichet = await citesteTichetul(id);
  // RLS-ul a filtrat deja: dacă nu se vede, pentru utilizator nu există.
  if (tichet === null) notFound();

  const [comentarii, istoric] = await Promise.all([
    listeazaComentariile(id),
    listeazaIstoricul(id),
  ]);

  // Drepturile se calculează o singură dată, aici, și determină exact ce se
  // oferă în interfață. Baza le verifică din nou la fiecare scriere.
  const [fisa, managerulSolicitantului] = await Promise.all([
    fisaProprie(tenant.organizationId, user.id),
    managerulDirectAl(tichet.solicitant_employee_id),
  ]);

  const esteSolicitant = fisa !== null && fisa.id === tichet.solicitant_employee_id;
  const poateOpera = can(permisiuni, "tickets:update", "all");
  // Aceeași regulă ca în `internal.tickets_valideaza_tranzitia`: managerul
  // direct sau patronul, dar niciodată solicitantul. Aici doar decidem ce
  // butoane arătăm; baza verifică din nou la scriere.
  const poateAproba =
    !esteSolicitant &&
    ((fisa !== null && managerulSolicitantului === fisa.id) ||
      can(permisiuni, "tickets:approve", "all"));

  const drepturi = { esteSolicitant, poateAproba, poateOpera };
  const optiuni = tranzitiiOferite(tichet.status as StatusTichet, drepturi);
  const asteaptaDecizia = tichet.status === "in_aprobare" && poateAproba;
  const diagnostic = contextDiagnostic(tichet.context);

  return (
    <div className={cn(LATIMI.detaliu, "space-y-6")}>
      {/* Numărul și cele două pastile stăteau DEASUPRA titlului; în antetul
          comun locul lor e slotul de acțiuni, la dreapta — la fel ca pe fișa
          obiectului de inventar și pe cea a deplasării. */}
      <AntetPagina
        titlu={tichet.titlu}
        descriere={`${ETICHETE_TIP[tichet.tip]} · deschis de ${tichet.solicitant?.full_name ?? "—"} la ${formatDateTime(tichet.created_at)}`}
        actiuni={
          <>
            <span className="text-muted-foreground text-corp font-mono">{tichet.numar_afisat}</span>
            <Badge ton={TONURI_STATUS[tichet.status as StatusTichet]}>
              {ETICHETE_STATUS[tichet.status as StatusTichet]}
            </Badge>
            <Badge ton={TONURI_PRIORITATE[tichet.prioritate]}>
              {ETICHETE_PRIORITATE[tichet.prioritate]}
            </Badge>
          </>
        }
      />

      {tichet.status === "in_asteptare" && esteSolicitant && (
        <p className="border-warning/40 bg-warning/10 text-foreground rounded-control text-corp border p-3">
          Echipa așteaptă un răspuns de la tine ca să poată continua.
        </p>
      )}

      {tichet.status === "respins" && tichet.motiv_respingere !== null && (
        <div className="border-border bg-surface rounded-control border p-3">
          <p className="text-foreground text-corp font-medium">Motivul respingerii</p>
          <p className="text-muted-foreground text-corp mt-1">{tichet.motiv_respingere}</p>
        </div>
      )}

      {asteaptaDecizia && <DecizieCerere ticketId={tichet.id} />}

      <section className="border-border bg-surface rounded-panou border p-4">
        <h2 className="text-foreground text-corp font-semibold">Detalii</h2>
        <p className="text-foreground text-corp mt-2 whitespace-pre-wrap">{tichet.descriere}</p>

        <dl className="mt-4">
          <Rand eticheta="Aplicație" valoare={tichet.aplicatie} />
          <Rand
            eticheta="Număr de licențe"
            valoare={tichet.numar_licente === null ? null : String(tichet.numar_licente)}
          />
          <Rand eticheta="Motivul necesității" valoare={tichet.motiv_necesitate} />
          <Rand eticheta="Echipament cerut" valoare={tichet.denumire_hardware} />
          <Rand
            eticheta="Livrare"
            valoare={
              tichet.loc_livrare === "domiciliu"
                ? "La domiciliu"
                : tichet.loc_livrare === "birou"
                  ? "La birou"
                  : null
            }
          />
          <Rand eticheta="Adresa de livrare" valoare={tichet.adresa_livrare} />
          <Rand
            eticheta="Obiectul stricat"
            valoare={
              tichet.obiect === null
                ? null
                : `${tichet.obiect.denumire}${tichet.obiect.numar_inventar === null ? "" : ` · ${tichet.obiect.numar_inventar}`}`
            }
          />
          <Rand
            eticheta="Blochează activitatea"
            valoare={
              tichet.blocheaza_activitatea === null
                ? null
                : tichet.blocheaza_activitatea
                  ? "Da"
                  : "Nu"
            }
          />
          <Rand eticheta="Locație" valoare={tichet.locatie} />
          <Rand eticheta="Modul" valoare={tichet.modul} />
          <Rand eticheta="Ce s-a făcut" valoare={tichet.pasi_efectuati} />
          <Rand eticheta="Rezultat așteptat" valoare={tichet.rezultat_asteptat} />
          <Rand eticheta="Rezultat obținut" valoare={tichet.rezultat_obtinut} />
          <Rand
            eticheta="Cost estimat"
            valoare={tichet.cost_estimat === null ? null : `${tichet.cost_estimat} RON`}
          />
          <Rand eticheta="Asignat" valoare={tichet.asignat?.full_name ?? null} />
          <Rand
            eticheta="Decizie"
            valoare={
              tichet.decizie_la === null
                ? null
                : `${tichet.aprobator?.full_name ?? "—"} · ${formatDateTime(tichet.decizie_la)}`
            }
          />
        </dl>

        {/* Contextul de diagnostic e pentru cine repară, nu pentru cine
            raportează: solicitantul l-a produs fără să știe, iar pentru el n-ar
            fi decât zgomot. */}
        {poateOpera && diagnostic.length > 0 ? (
          <div className="border-border mt-4 border-t pt-4">
            <h3 className="text-foreground text-corp font-medium">Context de diagnostic</h3>
            <p className="text-muted-foreground text-nota mt-1">
              Capturat automat de aplicație la trimiterea raportului.
            </p>
            <dl className="mt-2">
              {diagnostic.map((camp) => (
                <Rand key={camp.eticheta} eticheta={camp.eticheta} valoare={camp.valoare} />
              ))}
            </dl>
          </div>
        ) : null}
      </section>

      <SchimbaStatus ticketId={tichet.id} optiuni={optiuni} />

      {/* Repartizarea și prioritatea sunt acțiunile operatorului, nu ale
          solicitantului: amândouă cer `tickets:update = all`, exact ce verifică
          `poateOpera`. Baza le verifică din nou la scriere. */}
      {poateOpera && (
        <section
          aria-labelledby="titlu-operare"
          className="border-border bg-surface rounded-panou space-y-4 border p-4"
        >
          <h2 id="titlu-operare" className="text-foreground text-corp font-semibold">
            Operare
          </h2>
          <Repartizare
            ticketId={tichet.id}
            propriaFisaId={fisa?.id ?? null}
            asignatId={tichet.asignat_employee_id}
            numeAsignat={tichet.asignat?.full_name ?? null}
          />
          <PrioritateManuala
            ticketId={tichet.id}
            prioritateCurenta={tichet.prioritate}
            manuala={tichet.prioritate_manuala === true}
            motivCurent={tichet.prioritate_motiv}
          />
        </section>
      )}

      {/* Macro-urile mută starea, deci se arată doar cui are dreptul s-o mute. */}
      {poateOpera && <Macrouri ticketId={tichet.id} />}

      <section className="space-y-3">
        <h2 className="text-foreground text-corp font-semibold">Conversație</h2>
        {comentarii.length === 0 ? (
          <p className="text-muted-foreground text-corp">Niciun răspuns încă.</p>
        ) : (
          <ul className="space-y-3">
            {comentarii.map((comentariu) => (
              <li
                key={comentariu.id}
                className={`rounded-panou border p-3 ${comentariu.intern ? "border-warning/40 bg-warning/8" : "border-border bg-surface"}`}
              >
                <p className="text-muted-foreground text-nota flex flex-wrap items-center gap-2">
                  <span className="text-foreground font-medium">
                    {comentariu.autor?.full_name ?? "—"}
                  </span>
                  {formatDateTime(comentariu.created_at)}
                  {comentariu.intern && (
                    <span className="border-warning/40 text-muted-foreground rounded border px-1.5 py-0.5">
                      notă internă
                    </span>
                  )}
                </p>
                <p className="text-foreground text-corp mt-2 whitespace-pre-wrap">
                  {comentariu.continut}
                </p>
              </li>
            ))}
          </ul>
        )}

        <FormularComentariu ticketId={tichet.id} poateNotaInterna={poateOpera || poateAproba} />
      </section>

      <section className="space-y-2">
        <h2 className="text-foreground text-corp font-semibold">Istoric</h2>
        {istoric.length === 0 ? (
          <p className="text-muted-foreground text-corp">Nicio schimbare înregistrată.</p>
        ) : (
          <ul className="text-muted-foreground text-nota space-y-1">
            {istoric.map((intrare) => (
              <li key={intrare.id}>
                {formatDateTime(intrare.created_at)} · {ETICHETE_CAMP[intrare.camp] ?? intrare.camp}
                {intrare.valoare_veche === null
                  ? ""
                  : ` — din „${traduValoare(intrare.camp, intrare.valoare_veche)}”`}
                {intrare.valoare_noua === null
                  ? ""
                  : ` în „${traduValoare(intrare.camp, intrare.valoare_noua)}”`}
                {intrare.motiv === null ? "" : ` (${intrare.motiv})`}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

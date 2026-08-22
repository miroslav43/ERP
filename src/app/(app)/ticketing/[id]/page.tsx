// src/app/(app)/ticketing/[id]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
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

import {
  CLASE_PRIORITATE,
  CLASE_STATUS,
  ETICHETE_CAMP,
  ETICHETE_PRIORITATE,
  ETICHETE_STATUS,
  ETICHETE_TIP,
} from "../etichete";
import { DecizieCerere, FormularComentariu, Macrouri, SchimbaStatus } from "./actiuni-tichet";

export const metadata: Metadata = { title: "Tichet" };

interface ProprietatiPagina {
  readonly params: Promise<{ id: string }>;
}

function Rand({ eticheta, valoare }: Readonly<{ eticheta: string; valoare: string | null }>) {
  if (valoare === null || valoare === "") return null;
  return (
    <div className="border-border flex items-baseline justify-between gap-4 border-b py-2 last:border-0">
      <dt className="text-muted-foreground text-sm">{eticheta}</dt>
      <dd className="text-foreground text-right text-sm">{valoare}</dd>
    </div>
  );
}

export default async function PaginaTichet({ params }: ProprietatiPagina) {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "ticketing");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

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

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground font-mono text-sm">{tichet.numar_afisat}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${CLASE_STATUS[tichet.status as StatusTichet]}`}
          >
            {ETICHETE_STATUS[tichet.status as StatusTichet]}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${CLASE_PRIORITATE[tichet.prioritate]}`}
          >
            {ETICHETE_PRIORITATE[tichet.prioritate]}
          </span>
        </div>
        <h1 className="text-2xl font-semibold">{tichet.titlu}</h1>
        <p className="text-muted-foreground text-sm">
          {ETICHETE_TIP[tichet.tip]} · deschis de {tichet.solicitant?.full_name ?? "—"} la{" "}
          {formatDateTime(tichet.created_at)}
        </p>
      </header>

      {tichet.status === "in_asteptare" && esteSolicitant && (
        <p className="rounded-md border border-orange-300 bg-orange-100 p-3 text-sm text-orange-950">
          Echipa așteaptă un răspuns de la tine ca să poată continua.
        </p>
      )}

      {tichet.status === "respins" && tichet.motiv_respingere !== null && (
        <div className="border-border bg-surface rounded-md border p-3">
          <p className="text-foreground text-sm font-medium">Motivul respingerii</p>
          <p className="text-muted-foreground mt-1 text-sm">{tichet.motiv_respingere}</p>
        </div>
      )}

      {asteaptaDecizia && <DecizieCerere ticketId={tichet.id} />}

      <section className="border-border bg-surface rounded-lg border p-4">
        <h2 className="text-foreground text-sm font-semibold">Detalii</h2>
        <p className="text-foreground mt-2 text-sm whitespace-pre-wrap">{tichet.descriere}</p>

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
      </section>

      <SchimbaStatus ticketId={tichet.id} optiuni={optiuni} />

      {/* Macro-urile mută starea, deci se arată doar cui are dreptul s-o mute. */}
      {poateOpera && <Macrouri ticketId={tichet.id} />}

      <section className="space-y-3">
        <h2 className="text-foreground text-sm font-semibold">Conversație</h2>
        {comentarii.length === 0 ? (
          <p className="text-muted-foreground text-sm">Niciun răspuns încă.</p>
        ) : (
          <ul className="space-y-3">
            {comentarii.map((comentariu) => (
              <li
                key={comentariu.id}
                className={`rounded-lg border p-3 ${comentariu.intern ? "border-amber-300 bg-amber-50" : "border-border bg-surface"}`}
              >
                <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-foreground font-medium">
                    {comentariu.autor?.full_name ?? "—"}
                  </span>
                  {formatDateTime(comentariu.created_at)}
                  {comentariu.intern && (
                    <span className="rounded bg-amber-200 px-1.5 py-0.5 text-amber-950">
                      notă internă
                    </span>
                  )}
                </p>
                <p className="text-foreground mt-2 text-sm whitespace-pre-wrap">
                  {comentariu.continut}
                </p>
              </li>
            ))}
          </ul>
        )}

        <FormularComentariu ticketId={tichet.id} poateNotaInterna={poateOpera || poateAproba} />
      </section>

      <section className="space-y-2">
        <h2 className="text-foreground text-sm font-semibold">Istoric</h2>
        {istoric.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nicio schimbare înregistrată.</p>
        ) : (
          <ul className="text-muted-foreground space-y-1 text-xs">
            {istoric.map((intrare) => (
              <li key={intrare.id}>
                {formatDateTime(intrare.created_at)} · {ETICHETE_CAMP[intrare.camp] ?? intrare.camp}
                {intrare.valoare_veche === null ? "" : ` — din „${intrare.valoare_veche}”`}
                {intrare.valoare_noua === null ? "" : ` în „${intrare.valoare_noua}”`}
                {intrare.motiv === null ? "" : ` (${intrare.motiv})`}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

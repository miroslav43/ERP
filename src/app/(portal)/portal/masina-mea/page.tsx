// src/app/(portal)/portal/masina-mea/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Car, ClipboardList, FileSignature } from "lucide-react";

import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Paginare } from "@/components/ui/paginare";
import { Scadenta } from "@/components/ui/scadenta";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatDateTime, todayInBucharest } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import {
  foileMele,
  scadenteCurente,
  tipuriDocument,
  urlSemnateFlota,
  vehiculeDupaId,
  vehicululMeu,
  type RandVehicul,
} from "@/lib/queries/fleet";
import { declaratiileMele } from "@/lib/queries/flota-amenzi";
import { fisaMea } from "@/lib/queries/portal";
import { ETICHETE_STADIU_INCIDENT, ETICHETE_TIP_INCIDENT } from "@/domain/fleet/amenzi";
import {
  semaforVehicul,
  stareScadentaFlota,
  tipuriObligatoriiPentru,
} from "@/domain/fleet/scadente";
import { mascheaza, valabilitateScurta } from "@/domain/fleet/carduri/card";
import { etichetaEmitent } from "@/domain/fleet/carduri/emitenti";
import { carduleMele } from "@/lib/queries/fleet-carduri";
import { ETICHETE_STATUS_CARD, TON_STATUS_CARD } from "@/app/(app)/flota/carduri/etichete";
import { filtreFoiSchema } from "@/schemas/fleet";
import {
  ETICHETE_SCADENTA,
  ETICHETE_STATUS_FOAIE,
  TONURI_STATUS_FOAIE,
} from "@/app/(app)/flota/etichete";
import { TON_STADIU_INCIDENT } from "@/app/(app)/flota/amenzi/etichete";
import { DialogFoaieNoua } from "@/app/(app)/flota/foi/dialog-foaie-noua";
import { cheieCasetaFoaie } from "@/app/(app)/flota/foi/cheie-caseta-foaie";
import { PermisSofer } from "@/app/(app)/flota/permis-sofer";

import { FaraFisa } from "../fara-fisa";
import { DialogDeclaratieIncident } from "./dialog-declaratie-incident";
// ── început bloc: procesele-verbale de predare (0215, F12c) ──
import { pvurileMele } from "@/lib/queries/fleet-pv";
import { ETICHETE_TIP_PV, citesteInstantaneu } from "@/domain/fleet/proces-verbal";
import { ConfirmaPv } from "./confirma-pv";
// ── sfârșit bloc: procesele-verbale de predare ──
// F12d (0216): rezervările de pool următoare.
import { CardRezervariUrmatoare } from "./rezervari/card-urmatoare";

/** Câte declarații de incident se văd pe o pagină a portalului. */
const DECLARATII_PE_PAGINA = 10;
const TIPAR_CURSOR = /^[A-Za-z0-9_-]{1,512}$/u;

export const metadata: Metadata = { title: "Mașina mea" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * „Mașina mea”: vehiculul alocat (sau mașinile comune), semaforul lui, foile
 * șoferului și procesele-verbale de predare-primire la care e parte (0215). Corespondentul din portal al lui `/flota/foi*` (harta din
 * `src/config/routes.ts`), pe precedentul `portal/diurna-mea/`.
 *
 * Toate citirile filtrează EXPLICIT pe fișa proprie (antetul din
 * `src/lib/queries/portal.ts`): un administrator care e și șofer are
 * `vehicles:read = all`, iar fără filtru „mașina mea” ar fi tot parcul.
 */
export default async function PaginaMasinaMea({ searchParams }: ProprietatiPagina) {
  const { tenant, user } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  /*
   * Decizia 3 a lui Miro (F12c, 0215): omul FĂRĂ drept pe foi sau pe vehicule
   * (de regulă `hr`) care conduce o mașină a firmei vede aici vehiculul alocat
   * LUI și PV-urile la care e parte — ramura îngustă din `vehicule_select` și
   * `pv_vehicul_select`. Nimic din restul parcului: fără semafor (documentele
   * vehiculului rămân închise), fără mașini comune, fără foi.
   */
  const poateFoi = can(permisiuni, "trip_sheets:read", "own");

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;
  const fisaId = stare.fisa.id;

  const parametri = await searchParams;
  const pagina = filtreDinUrl(filtreFoiSchema, parametri);
  // `/portal/masina-mea?foaie=noua` deschide caseta, ca `/flota/foi?foaie=noua`.
  const deschideCaseta = parametri["foaie"] === "noua";
  const vehiculPropus = typeof parametri["vehicul"] === "string" ? parametri["vehicul"] : null;
  const poateCrea = poateFoi && can(permisiuni, "trip_sheets:create", "own");
  const poateVedeaMasina = can(permisiuni, "vehicles:read", "own");
  // 0206 §F: șoferul își declară dauna. Fără `vehicle_incidents:read`: își vede
  // doar declarațiile lui, prin `incidente_declarate_de_mine` (fără costuri,
  // asigurător sau observațiile responsabilului), nu incidentele firmei, și
  // nicio amendă.
  const poateDeclara = can(permisiuni, "vehicle_incidents:create", "own");
  const deschideDeclaratia = parametri["incident"] === "nou";
  const cursorBrut = parametri["incidente"];
  const cursorDeclaratii =
    typeof cursorBrut === "string" && TIPAR_CURSOR.test(cursorBrut) ? cursorBrut : null;

  const pvEvidentiat = typeof parametri["pv"] === "string" ? parametri["pv"] : null;

  const [masini, foi, tipuri, pvuri, declaratii] = await Promise.all([
    // Fără `vehicles:read`, RLS lasă doar mașina alocată LUI (decizia 3).
    vehicululMeu(tenant.organizationId, fisaId),
    poateFoi
      ? foileMele(tenant.organizationId, fisaId, { cursor: pagina.cursor, limita: pagina.limita })
      : Promise.resolve(null),
    poateVedeaMasina ? tipuriDocument(tenant.organizationId) : Promise.resolve([]),
    pvurileMele(tenant.organizationId, fisaId),
    poateDeclara
      ? declaratiileMele(tenant.organizationId, {
          cursor: cursorDeclaratii,
          limita: DECLARATII_PE_PAGINA,
        })
      : Promise.resolve(null),
  ]);

  const toateMasinile: readonly RandVehicul[] = [...masini.alocate, ...masini.pool];
  // Numărul vehiculului pe foaie se citește separat: foaia de luna trecută poate
  // fi pe o mașină care nu mai e a lui, iar `vehiculeDupaId` trece prin RLS.
  const [scadente, vehiculeFoi, urlScanPv, carduri] = await Promise.all([
    poateVedeaMasina ? scadenteCurente(masini.alocate.map((v) => v.id)) : Promise.resolve([]),
    vehiculeDupaId(tenant.organizationId, [
      ...(foi?.randuri ?? []).map((f) => f.vehicle_id),
      ...(declaratii?.randuri ?? []).map((d) => d.vehicle_id),
    ]),
    // F12c: scanul semnat al PV-ului, semnat sub sesiunea omului. Bucketul îl
    // dă părții pe calea exactă `scan_path` (`app.flota_poate_fisier`, 0215),
    // și omului fără `vehicles:read`.
    urlSemnateFlota(pvuri.map((p) => p.scan_path)),
    // F12b: cardurile de combustibil ale lui — aici duce notificarea cardului
    // care expiră pe cine n-are `team`/`all` pe vehicule.
    poateVedeaMasina
      ? carduleMele(
          tenant.organizationId,
          fisaId,
          toateMasinile.map((v) => v.id),
        )
      : Promise.resolve([]),
  ]);
  const numarVehicul = new Map<string, string>([
    ...[...vehiculeFoi.values()].map((v) => [v.id, v.nr_inmatriculare] as const),
    ...toateMasinile.map((v) => [v.id, v.nr_inmatriculare] as const),
  ]);
  const azi = todayInBucharest();
  const denumireTip = new Map(tipuri.map((t) => [t.id, t.denumire]));

  function adresa(cursor: string | null, limita: number): string {
    const p = new URLSearchParams();
    p.set("limita", String(limita));
    if (cursor !== null) p.set("cursor", cursor);
    return `/portal/masina-mea?${p.toString()}`;
  }

  return (
    <div className={`${LATIMI.lista} space-y-6 p-4`}>
      <AntetPagina
        titlu="Mașina mea"
        descriere={
          poateFoi
            ? "Vehiculul primit în folosință, termenele lui, foile dumneavoastră de parcurs și procesele-verbale de predare."
            : "Vehiculul primit în folosință și procesele-verbale de predare-primire la care sunteți parte."
        }
        {...(poateCrea
          ? {
              actiuni: (
                <DialogFoaieNoua
                  // Vehiculul intră în cheie: a doua propunere a asistentului,
                  // pe altă mașină, remontează caseta (F12e).
                  key={cheieCasetaFoaie(deschideCaseta, vehiculPropus)}
                  date={{
                    vehicule: toateMasinile.map((v) => ({
                      id: v.id,
                      nr_inmatriculare: v.nr_inmatriculare,
                      km_curent: v.km_curent,
                    })),
                    angajati: null,
                  }}
                  deschisInitial={deschideCaseta}
                  // F12d (0216): „Începe foaia zilei” dintr-o rezervare aduce mașina.
                  vehiculInitial={vehiculPropus}
                  bazaFoaie="/portal/masina-mea/foi"
                />
              ),
            }
          : {})}
      />

      <section aria-labelledby="titlu-masina" className="space-y-3">
        <h2 id="titlu-masina" className="text-sectiune font-semibold">
          Vehiculul meu
        </h2>
        {masini.alocate.length === 0 ? (
          <StareGoala
            fel="initiala"
            pictograma={Car}
            titlu="Niciun vehicul alocat"
            descriere={
              masini.pool.length === 0
                ? "Când responsabilul de flotă vă predă o mașină, ea apare aici, cu termenele ei."
                : "Nu aveți o mașină a dumneavoastră; foile se pot întocmi pe una dintre mașinile comune de mai jos."
            }
          />
        ) : (
          <ul className="space-y-2">
            {masini.alocate.map((v) => {
              const semafor = semaforVehicul(
                scadente.filter((s) => s.vehicle_id === v.id),
                // Obligatoriile mașinii LUI (0202), ca pe /flota: aceeași culoare.
                tipuriObligatoriiPentru(v, tipuri),
                azi,
              );
              return (
                <li key={v.id} className="bg-surface border-border rounded-panou border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-foreground text-corp font-medium">{v.nr_inmatriculare}</p>
                      <p className="text-muted-foreground text-corp mt-0.5">
                        {v.marca} {v.model} · {v.km_curent.toLocaleString("ro-RO")} km
                      </p>
                      {poateVedeaMasina ? (
                        <p className="text-muted-foreground text-nota mt-0.5">
                          {semafor.tipId === null
                            ? "Niciun document înregistrat"
                            : `${denumireTip.get(semafor.tipId) ?? "Document"}${
                                semafor.expiraLa === null
                                  ? ""
                                  : `, expiră la ${formatDate(semafor.expiraLa)}`
                              }`}
                        </p>
                      ) : (
                        <p className="text-muted-foreground text-nota mt-0.5">
                          Termenele documentelor le urmărește responsabilul de flotă.
                        </p>
                      )}
                    </div>
                    {poateVedeaMasina ? (
                      <Scadenta treapta={semafor.treapta}>
                        {ETICHETE_SCADENTA[semafor.treapta]}
                      </Scadenta>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {masini.pool.length === 0 ? null : (
          <div className="space-y-2">
            <h3 className="text-corp font-medium">Mașini comune</h3>
            <ul className="text-corp text-muted-foreground space-y-1">
              {masini.pool.map((v) => (
                <li key={v.id}>
                  <span className="text-foreground font-medium">{v.nr_inmatriculare}</span> ·{" "}
                  {v.marca} {v.model} · {v.km_curent.toLocaleString("ro-RO")} km
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── ÎNCEPUT BLOC: cardurile mele de combustibil (0214, F12b) ──
          Doar ultimele cifre; tranzacțiile rămân la administratorul flotei. */}
      {carduri.length === 0 ? null : (
        <section aria-labelledby="titlu-carduri" id="carduri" className="space-y-3">
          <h2 id="titlu-carduri" className="text-sectiune font-semibold">
            Carduri de combustibil
          </h2>
          <ul className="space-y-2">
            {carduri.map((c) => {
              const valabil = valabilitateScurta(c.valabil_pana);
              const treapta = stareScadentaFlota(c.valabil_pana, azi);
              return (
                <li key={c.id} className="bg-surface border-border rounded-panou border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-foreground text-corp font-medium">
                        {etichetaEmitent(c.emitent)} {mascheaza(c.ultimele_cifre)}
                      </p>
                      <p className="text-muted-foreground text-corp mt-0.5">
                        {c.vehicle_id === null
                          ? "Pe numele dumneavoastră"
                          : `Al mașinii ${numarVehicul.get(c.vehicle_id) ?? "din parc"}`}
                        {valabil === null ? "" : ` · valabil până la ${valabil}`}
                      </p>
                      {c.denumire === null ? null : (
                        <p className="text-muted-foreground text-nota mt-0.5">{c.denumire}</p>
                      )}
                    </div>
                    {c.status !== "activ" ? (
                      <Badge ton={TON_STATUS_CARD[c.status]}>
                        {ETICHETE_STATUS_CARD[c.status]}
                      </Badge>
                    ) : valabil === null ? null : (
                      <Scadenta treapta={treapta}>{ETICHETE_SCADENTA[treapta]}</Scadenta>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground text-nota">
            Când cardul expiră sau se pierde, anunțați responsabilul de flotă: el îl înlocuiește.
          </p>
        </section>
      )}
      {/* ── SFÂRȘIT BLOC: cardurile mele de combustibil ── */}

      <CardRezervariUrmatoare
        organizationId={tenant.organizationId}
        fisaId={fisaId}
        permisiuni={permisiuni}
        azi={azi}
      />

      {/* ── ÎNCEPUT BLOC: permisul meu (flota F9, 0204) ──
          Șoferul își citește permisul și avizul (`driver_licenses:read = own`);
          le scrie HR-ul, pe fișa lui. */}
      {can(permisiuni, "driver_licenses:read", "own") ? (
        <PermisSofer
          organizationId={tenant.organizationId}
          employeeId={fisaId}
          numeAngajat={stare.fisa.full_name ?? stare.fisa.marca}
          azi={azi}
          poateCrea={false}
          poateModifica={false}
          titlu="Permisul meu"
          className="bg-surface border-border rounded-panou border p-4"
        />
      ) : null}
      {/* ── SFÂRȘIT BLOC: permisul meu ── */}

      {/* ── ÎNCEPUT BLOC: incidentele declarate de mine (0206 §F) ──
          Declarația merge la responsabilul de flotă; constatarea, asigurătorul
          și costurile le scrie el, în `/flota/incidente`. */}
      {declaratii === null ? null : (
        <section aria-labelledby="titlu-incidente" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="titlu-incidente" className="text-sectiune font-semibold">
              Incidentele declarate de mine
            </h2>
            {toateMasinile.length > 0 ? (
              <DialogDeclaratieIncident
                key={deschideDeclaratia ? "incident-nou" : "lista"}
                vehicule={toateMasinile.map((v) => ({
                  id: v.id,
                  nr_inmatriculare: v.nr_inmatriculare,
                  pool: v.pool,
                }))}
                deschisInitial={deschideDeclaratia}
              />
            ) : null}
          </div>
          {declaratii.randuri.length === 0 ? (
            <p className="text-muted-foreground text-corp">
              {toateMasinile.length > 0
                ? "Dacă mașina a fost lovită, avariată sau furată, declarați aici: responsabilul de flotă primește declarația."
                : "Când primiți o mașină sau folosiți una comună, aici puteți declara un incident cu ea."}
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {declaratii.randuri.map((d) => (
                  <li key={d.id} className="bg-surface border-border rounded-panou border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-foreground text-corp font-medium">
                          {ETICHETE_TIP_INCIDENT[d.tip]} · {formatDateTime(new Date(d.produs_la))}
                        </p>
                        <p className="text-muted-foreground text-corp mt-0.5">
                          {numarVehicul.get(d.vehicle_id) ?? "Vehicul indisponibil"}
                          {d.locul === null ? "" : ` · ${d.locul}`}
                        </p>
                        <p className="text-muted-foreground text-nota mt-0.5 line-clamp-2">
                          {d.descriere}
                        </p>
                      </div>
                      <Badge className="shrink-0" ton={TON_STADIU_INCIDENT[d.stadiu]}>
                        {ETICHETE_STADIU_INCIDENT[d.stadiu]}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
              {declaratii.urmatorulCursor === null ? null : (
                <Link
                  href={`/portal/masina-mea?incidente=${encodeURIComponent(declaratii.urmatorulCursor)}`}
                  className="text-primary text-corp underline-offset-2 hover:underline"
                >
                  Declarațiile mai vechi
                </Link>
              )}
            </>
          )}
        </section>
      )}
      {/* ── SFÂRȘIT BLOC: incidentele declarate de mine ── */}

      {/* ── ÎNCEPUT BLOC: procesele-verbale de predare (0215, F12c) ──
          Finalizatele la care omul e predător sau primitor. Confirmarea e pe
          coloana PĂRȚII lui; o completează pe cea de pe hârtie. */}
      <section aria-labelledby="titlu-pv" className="space-y-3">
        <h2 id="titlu-pv" className="text-sectiune font-semibold">
          Procese-verbale de predare-primire
        </h2>
        {pvuri.length === 0 ? (
          <StareGoala
            fel="initiala"
            pictograma={FileSignature}
            titlu="Niciun proces-verbal"
            descriere="Când primiți sau predați o mașină a firmei, procesul-verbal apare aici, ca să-l confirmați."
          />
        ) : (
          <ul className="space-y-2">
            {pvuri.map((p) => {
              const nr = citesteInstantaneu(p.snapshot)?.vehicul.nr_inmatriculare ?? "Vehicul";
              const suntPrimitor = p.primitor_employee_id === fisaId;
              const confirmatLa = suntPrimitor ? p.confirmat_primitor_la : p.confirmat_predator_la;
              return (
                <li
                  key={p.id}
                  aria-current={pvEvidentiat === p.id ? "true" : undefined}
                  className="bg-surface border-border aria-[current=true]:border-ring rounded-panou border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-foreground text-corp font-medium">
                        <span className="font-mono">{p.numar}</span> · {nr}
                      </p>
                      <p className="text-muted-foreground text-corp mt-0.5">
                        {ETICHETE_TIP_PV[p.tip]} · {formatDateTime(new Date(p.moment))}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        <a
                          href={`/api/export/flota/pv/${p.id}`}
                          className="text-corp underline underline-offset-2"
                        >
                          Descarcă PDF
                        </a>
                        {p.scan_path === null ? null : urlScanPv.has(p.scan_path) ? (
                          <a
                            href={urlScanPv.get(p.scan_path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-corp underline underline-offset-2"
                          >
                            Scanul semnat (filă nouă)
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-corp">
                            Scanul semnat nu e disponibil acum.
                          </span>
                        )}
                      </p>
                    </div>
                    {p.anulat_la !== null ? (
                      <Badge ton="neutru">Anulat</Badge>
                    ) : confirmatLa !== null ? (
                      <Badge ton="succes">
                        Confirmat la {formatDateTime(new Date(confirmatLa))}
                      </Badge>
                    ) : (
                      <ConfirmaPv
                        pvId={p.id}
                        numar={p.numar}
                        ce={suntPrimitor ? "primirea" : "predarea"}
                        vehicul={nr}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {/* ── SFÂRȘIT BLOC: procesele-verbale de predare ── */}

      {foi === null ? null : (
        <section aria-labelledby="titlu-foi" className="space-y-3">
          <h2 id="titlu-foi" className="text-sectiune font-semibold">
            Foile mele
          </h2>
          {foi.randuri.length === 0 ? (
            <StareGoala
              fel="initiala"
              pictograma={ClipboardList}
              titlu="Nicio foaie de parcurs"
              descriere="Foile pe care le întocmiți apar aici, cu kilometrii și starea aprobării."
              {...(poateCrea && toateMasinile.length > 0
                ? { actiune: { eticheta: "Foaie nouă", href: "/portal/masina-mea?foaie=noua" } }
                : {})}
            />
          ) : (
            <>
              <ul className="space-y-2">
                {foi.randuri.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/portal/masina-mea/foi/${f.id}`}
                      className="bg-surface border-border hover:border-ring rounded-panou block border p-4 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-foreground text-corp font-medium">
                            {formatDateTime(new Date(f.plecare_la))}
                          </p>
                          <p className="text-muted-foreground text-corp mt-0.5">
                            {numarVehicul.get(f.vehicle_id) ?? "Vehicul indisponibil"}
                            {f.km_parcursi === null
                              ? " · în curs"
                              : ` · ${f.km_parcursi.toLocaleString("ro-RO")} km`}
                          </p>
                          {f.traseu === null ? null : (
                            <p className="text-muted-foreground text-nota mt-0.5 truncate">
                              {f.traseu}
                            </p>
                          )}
                        </div>
                        <Badge className="shrink-0" ton={TONURI_STATUS_FOAIE[f.status]}>
                          {ETICHETE_STATUS_FOAIE[f.status]}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Paginare
                afisate={foi.randuri.length}
                total={foi.total}
                cursorUrmator={foi.urmatorulCursor}
                limita={pagina.limita}
                construiesteHref={({ cursor, limita }) => adresa(cursor, limita)}
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}

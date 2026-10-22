import { CreditCard, FileUp, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { FileModul } from "@/components/ui/file-modul";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { FILE_FLOTA } from "@/config/file-module";
import { mascheaza, valabilitateScurta } from "@/domain/fleet/carduri/card";
import { etichetaEmitent } from "@/domain/fleet/carduri/emitenti";
import { stareScadentaFlota } from "@/domain/fleet/scadente";
import { requireFeature } from "@/lib/auth/features";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { todayInBucharest } from "@/lib/format/date";
import {
  listeazaCarduri,
  soferiPentruCard,
  vehiculePentruCard,
  type RandCard,
} from "@/lib/queries/fleet-carduri";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { ButonStergeCard } from "./buton-sterge-card";
import { DialogCard } from "./dialog-card";
import { ETICHETE_STATUS_CARD, TON_STATUS_CARD } from "./etichete";

export const metadata: Metadata = { title: "Carduri de combustibil" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const TIPAR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(valoare: string | string[] | undefined): string | undefined {
  return typeof valoare === "string" ? valoare : undefined;
}

const ETICHETE_VALABILITATE = {
  expirat: { text: "Expirat", ton: "pericol" },
  curand: { text: "Expiră curând", ton: "atentie" },
  in_regula: { text: "Valabil", ton: "succes" },
} as const;

/**
 * Cardurile de combustibil ale firmei (0214, F12b).
 *
 * Poarta e `vehicles:read` cu prag `team`: lista o deschid administratorii și
 * managerii. Ce vede fiecare o decide `carduri_select` (vehiculul cardului sau
 * șoferul titular); șoferul își vede cardul în portal. Scrierea cere
 * `vehicles:create`/`update = all` (`poateCrea`, `poateAdministra`).
 *
 * Semaforul se calculează din `fuel_cards.valabil_pana`, NU din `expirables`:
 * politica de acolo cere și `compliance:read`, deci un manager ar primi zero
 * rânduri, fără eroare (capcanele #19, #26).
 */
export default async function PaginaCarduri({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  const [, permisiuni, parametri] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    searchParams,
  ]);

  if (!can(permisiuni, "vehicles:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Cardurile de combustibil le văd administratorii parcului și managerii, pentru mașinile echipei. Cardul dumneavoastră apare în portal, la „Mașina mea”." />
    );
  }

  const poateCrea = can(permisiuni, "vehicles:create", "all");
  const poateAdministra = can(permisiuni, "vehicles:update", "all");
  const azi = todayInBucharest();
  const cardParam = text(parametri["card"]);
  const cardCerut = cardParam !== undefined && TIPAR_UUID.test(cardParam) ? cardParam : null;

  const [carduri, vehicule, soferi] = await Promise.all([
    listeazaCarduri(tenant.organizationId),
    poateCrea || poateAdministra ? vehiculePentruCard(tenant.organizationId) : Promise.resolve([]),
    poateCrea || poateAdministra ? soferiPentruCard(tenant.organizationId) : Promise.resolve([]),
  ]);
  const evidentiat = cardCerut === null ? null : (carduri.find((c) => c.id === cardCerut) ?? null);

  const coloane: Coloana<RandCard>[] = [
    {
      cheie: "card",
      antet: "Card",
      peTelefon: "titlu",
      celula: (c) => (
        <>
          <span className="font-medium">
            {etichetaEmitent(c.emitent)} {mascheaza(c.ultimele_cifre)}
          </span>
          {c.denumire === null ? null : (
            <span className="text-muted-foreground text-nota block">{c.denumire}</span>
          )}
        </>
      ),
    },
    {
      cheie: "atribuit",
      antet: "Atribuit",
      peTelefon: "meta",
      celula: (c) => {
        if (c.vehicle_id !== null) {
          // Embed NULL = vehicul pe care RLS-ul nu-l arată (capcana #18).
          if (c.vehicul === null) return "Vehicul indisponibil";
          return (
            <>
              <Link href={`/flota/${c.vehicul.id}`} className="underline-offset-2 hover:underline">
                {c.vehicul.nr_inmatriculare}
              </Link>
              {c.vehicul.deleted_at !== null ||
              c.vehicul.status === "vandut" ||
              c.vehicul.status === "casat" ? (
                <span className="text-muted-foreground text-nota block">ieșit din parc</span>
              ) : null}
            </>
          );
        }
        if (c.employee_id !== null) return c.sofer?.full_name ?? "Șofer indisponibil";
        return "Rezervă";
      },
    },
    {
      cheie: "valabil",
      antet: "Valabil până la",
      peTelefon: "meta",
      celula: (c) => {
        const scurt = valabilitateScurta(c.valabil_pana);
        if (scurt === null) return "—";
        const stare = stareScadentaFlota(c.valabil_pana, azi);
        const eticheta = stare === "lipsa" ? null : ETICHETE_VALABILITATE[stare];
        return (
          <>
            {scurt}
            {eticheta === null || c.status !== "activ" ? null : (
              <span className="block">
                <Badge ton={eticheta.ton}>{eticheta.text}</Badge>
              </span>
            )}
          </>
        );
      },
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (c) => (
        <Badge ton={TON_STATUS_CARD[c.status]}>{ETICHETE_STATUS_CARD[c.status]}</Badge>
      ),
    },
  ];
  if (poateAdministra) {
    coloane.push({
      cheie: "actiuni",
      antet: "Acțiuni",
      peTelefon: "meta",
      celula: (c) => (
        <div className="flex gap-2">
          <DialogCard
            key={`${c.id}-${cardCerut === c.id ? "deschis" : "inchis"}`}
            vehicule={vehicule}
            soferi={soferi}
            card={c}
            deschisInitial={cardCerut === c.id}
          />
          <ButonStergeCard
            id={c.id}
            eticheta={`${etichetaEmitent(c.emitent)} ${mascheaza(c.ultimele_cifre)}`}
          />
        </div>
      ),
    });
  }

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Carduri de combustibil"
        descriere="Cardurile de flotă ale firmei: emitentul, ultimele cifre, vehiculul sau șoferul pe care sunt și valabilitatea. Extrasele lunare se compară cu foile de parcurs."
        file={<FileModul eticheta="Navigare parc auto" file={FILE_FLOTA} tenant={tenant} />}
        {...(poateCrea
          ? {
              actiuni: (
                <div className="flex flex-wrap gap-2">
                  <DialogCard
                    key={cardCerut === null && text(parametri["card"]) === "nou" ? "nou" : "inchis"}
                    vehicule={vehicule}
                    soferi={soferi}
                    deschisInitial={text(parametri["card"]) === "nou"}
                  />
                  {poateAdministra ? (
                    <>
                      <Link
                        href="/flota/carduri/import"
                        className={buton({ varianta: "secundar" })}
                      >
                        <FileUp aria-hidden="true" className="size-4" />
                        Import extras
                      </Link>
                      <Link
                        href="/flota/carduri/tranzactii"
                        className={buton({ varianta: "secundar" })}
                      >
                        <ListChecks aria-hidden="true" className="size-4" />
                        Tranzacții
                      </Link>
                    </>
                  ) : null}
                </div>
              ),
            }
          : {})}
      />

      {evidentiat !== null ? (
        <Callout
          fel="informativ"
          titlu={`${etichetaEmitent(evidentiat.emitent)} ${mascheaza(evidentiat.ultimele_cifre)}`}
        >
          <p>
            {valabilitateScurta(evidentiat.valabil_pana) === null
              ? "Cardul nu are valabilitatea completată."
              : `Valabil până la ${valabilitateScurta(evidentiat.valabil_pana) ?? ""}. Când primiți cardul nou, anulați-l pe acesta și înregistrați-l pe cel nou.`}
          </p>
        </Callout>
      ) : null}

      {carduri.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={CreditCard}
          titlu="Niciun card de combustibil"
          descriere={
            poateCrea
              ? "Înregistrați cardurile de flotă ca să le urmăriți valabilitatea și să comparați extrasele cu foile de parcurs."
              : "Nu vedeți niciun card: fie firma nu are încă, fie sunt pe vehicule pe care nu le administrați."
          }
          {...(poateCrea
            ? {
                actiune: {
                  eticheta: "Înregistrează primul card",
                  href: "/flota/carduri?card=nou",
                },
              }
            : {})}
        />
      ) : (
        <Tabel
          caption="Cardurile de combustibil, cu vehiculul sau șoferul, valabilitatea și starea."
          coloane={coloane}
          randuri={carduri}
          cheieRand={(c) => c.id}
          gol={null}
        />
      )}

      <p className="text-muted-foreground text-nota max-w-prose">
        Numărul întreg al cardului nu se păstrează: rămân ultimele cifre și o amprentă, ca extrasul
        să recunoască singur cardul. Tranzacțiile din extras le vede doar administratorul parcului.
      </p>
    </div>
  );
}

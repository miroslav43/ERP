// src/app/(app)/reges/propuneri/page.tsx
import { ArrowLeftRight } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Callout } from "@/components/ui/callout";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { meetsScope } from "@/config/permissions";
import { requireFeature } from "@/lib/auth/features";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format/date";
import {
  contracteEligibilePropunere,
  idOrganizatie,
  interogheazaPropuneriReges,
  optiuniNomenclator,
  type RandPropunere,
} from "@/lib/queries/reges";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { FormularPropunere } from "./formular-propunere";
import { RaspunsPropunere } from "./raspuns-propunere";

export const metadata = { title: "REGES-Online — propuneri de detașare și mutare" };

const ETICHETE_STARE: Record<string, string> = {
  noua: "Nouă",
  acceptata: "Acceptată",
  respinsa: "Respinsă",
  incetata: "Încetată",
  expirata: "Expirată",
};

const ETICHETE_FEL: Record<string, string> = { detasare: "Detașare", mutare: "Mutare" };

export default async function PaginaPropuneriReges() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "reges");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!meetsScope(scopeFor(permisiuni, "reges:read") ?? undefined, "all")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta propunerile de detașare. Solicitați administratorului firmei permisiunea „REGES — citire”." />
    );
  }
  const poateRaspunde = meetsScope(scopeFor(permisiuni, "reges:transmit") ?? undefined, "all");

  const supabase = await createServerSupabase();
  const organizationId = idOrganizatie(tenant);
  const poatePropune = meetsScope(scopeFor(permisiuni, "reges:create") ?? undefined, "all");
  const [propuneri, contracte, temeiuri] = await Promise.all([
    interogheazaPropuneriReges(supabase, organizationId),
    poatePropune
      ? contracteEligibilePropunere(supabase, organizationId)
      : Promise.resolve([] as const),
    poatePropune ? optiuniNomenclator(supabase, "TemeiDetasare") : Promise.resolve([] as const),
  ]);

  const primite = propuneri.filter((p) => p.directie === "primita");
  const trimise = propuneri.filter((p) => p.directie === "trimisa");

  const COLOANE_COMUNE: readonly Coloana<RandPropunere>[] = [
    {
      cheie: "fel",
      antet: "Fel",
      celula: (p) => (
        <span className="text-foreground">
          {ETICHETE_FEL[p.fel] ?? p.fel}
          <span className="text-muted-foreground text-nota block">
            {ETICHETE_STARE[p.stare] ?? p.stare}
          </span>
        </span>
      ),
    },
    {
      cheie: "partener",
      antet: "Angajatorul celălalt",
      celula: (p) => (
        <span className="text-foreground">
          {p.partenerNume ?? "—"}
          {p.partenerCui === null ? null : (
            <span className="text-muted-foreground text-nota block">CUI {p.partenerCui}</span>
          )}
        </span>
      ),
    },
    {
      cheie: "salariat",
      antet: "Salariat",
      // CNP-ul apare doar mascat: o propunere primită descrie un om care nu e
      // (încă) angajatul nostru, iar datele lui n-au ce căuta întregi la noi.
      celula: (p) => (
        <span className="text-foreground">
          {p.salariatNume ?? "—"}
          {p.salariatCnpUltimele4 === null ? null : (
            <span className="text-muted-foreground text-nota block">
              CNP *********{p.salariatCnpUltimele4}
            </span>
          )}
        </span>
      ),
    },
    {
      cheie: "perioada",
      antet: "Perioada",
      celula: (p) =>
        p.dataInceput === null
          ? "—"
          : `${formatDate(p.dataInceput)} – ${p.dataSfarsit === null ? "nedeterminat" : formatDate(p.dataSfarsit)}`,
    },
    { cheie: "temei", antet: "Temei legal", celula: (p) => p.temeiLegal ?? "—" },
  ];

  // Coloana de acțiuni e `insigna` pe telefon: un `<div>` cu formular într-o
  // celulă redată ca `<p>` rupe hidratarea pe ecran mic — capcana pe care o
  // documentează deja tabelul din pagina principală a modulului.
  const COLOANA_RASPUNS: Coloana<RandPropunere> = {
    cheie: "actiuni",
    antet: "Acțiuni",
    peTelefon: "insigna",
    celula: (p) =>
      p.stare === "noua" && poateRaspunde ? (
        <RaspunsPropunere
          propunereId={p.id}
          descriere={`${(ETICHETE_FEL[p.fel] ?? p.fel).toLowerCase()} pentru ${p.salariatNume ?? "salariatul propus"}`}
        />
      ) : (
        <span className="text-muted-foreground text-nota">
          {p.raspunsLa === null ? "—" : formatDate(p.raspunsLa.slice(0, 10))}
        </span>
      ),
  };

  const coloanePrimite: readonly Coloana<RandPropunere>[] = [...COLOANE_COMUNE, COLOANA_RASPUNS];

  return (
    <div className="space-y-8">
      <AntetPagina
        firimituri={[{ eticheta: "REGES-Online", href: "/reges" }, { eticheta: "Propuneri" }]}
        titlu="Propuneri de detașare și mutare"
        descriere="La REGES-Online nu se transmite direct o detașare, ci o propunere, pe care angajatorul destinație o acceptă sau o respinge separat."
      />

      {!poateRaspunde ? (
        <Callout fel="informativ" titlu="Doar citire">
          Acceptarea și respingerea cer permisiunea „REGES — transmitere”.
        </Callout>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-foreground font-medium">Primite</h2>
        <Tabel
          randuri={primite}
          coloane={coloanePrimite}
          cheieRand={(p) => p.id}
          densitate="compact"
          caption="Propuneri primite de la alți angajatori"
          gol={
            <StareGoala
              fel="initiala"
              pictograma={ArrowLeftRight}
              titlu="Nicio propunere primită"
              descriere="Aici apar propunerile trimise de alți angajatori către firma dumneavoastră, culese periodic din coada Inspecției Muncii."
            />
          }
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground font-medium">Trimise</h2>
        {poatePropune ? <FormularPropunere contracte={contracte} temeiuri={temeiuri} /> : null}
        <Tabel
          randuri={trimise}
          coloane={COLOANE_COMUNE}
          cheieRand={(p) => p.id}
          densitate="compact"
          caption="Propuneri trimise altor angajatori"
          gol={
            <StareGoala
              fel="initiala"
              pictograma={ArrowLeftRight}
              titlu="Nicio propunere trimisă"
              descriere="O detașare pusă pe un contract și transmisă la REGES apare aici, până când angajatorul destinație răspunde."
            />
          }
        />
      </section>
    </div>
  );
}

// src/app/(app)/reges/setari/page.tsx
import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Callout } from "@/components/ui/callout";
import { meetsScope } from "@/config/permissions";
import { requireFeature } from "@/lib/auth/features";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format/date";
import { idOrganizatie, interogheazaPropuneriReges, propuneriDeRaspuns } from "@/lib/queries/reges";
import { citesteRezumatCredentiale } from "@/lib/reges/credentiale";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { NavReges } from "../nav-reges";
import { FormularCredentiale } from "./formular-credentiale";

export const metadata = { title: "REGES-Online — chei API" };

export default async function PaginaSetariReges() {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "reges"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  // Ecranul cere `configure`, nu `read`: cheile API dau drept de scriere în
  // registrul oficial al Inspecției Muncii, deci nu sunt „setări" obișnuite.
  const poateConfigura = meetsScope(scopeFor(permisiuni, "reges:configure") ?? undefined, "all");
  if (!poateConfigura) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a configura legătura cu REGES-Online. Solicitați administratorului firmei permisiunea „REGES — configurare”." />
    );
  }

  // `configure` nu implică `read`: seed-ul din 0087 §16 le dă împreună celor
  // trei roluri care le au, dar o firmă își poate strânge drepturile per rol
  // din `role_permissions`, fără deploy. Cine n-are `read` nu vede filele de
  // registru și nici nu declanșează citirea propunerilor.
  const poateCiti = meetsScope(scopeFor(permisiuni, "reges:read") ?? undefined, "all");

  const supabase = await createServerSupabase();
  const [rezumat, propuneri] = await Promise.all([
    citesteRezumatCredentiale(supabase, tenant.organizationId),
    poateCiti
      ? interogheazaPropuneriReges(supabase, idOrganizatie(tenant))
      : Promise.resolve([] as const),
  ]);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Legătura cu REGES-Online"
        descriere="Fiecare firmă are propriul cont de angajator la Inspecția Muncii și propriile chei API. Nu există o cheie comună a aplicației."
        file={
          <NavReges
            activ="setari"
            poateCiti={poateCiti}
            poateConfigura={poateConfigura}
            propuneriDeRaspuns={propuneriDeRaspuns(propuneri)}
          />
        }
      />

      {rezumat === null ? (
        <Callout fel="atentie" titlu="Nu e configurat nimic încă">
          Cheile se obțin din aplicația web REGES a angajatorului: „Setări” → „Acces” → „Chei API”.
          Până când sunt completate, evenimentele se adună în coadă, dar nu pleacă nicăieri.
        </Callout>
      ) : null}

      {rezumat !== null && rezumat.mediu === "test" ? (
        <Callout fel="atentie" titlu="Mediul de test">
          Mesajele merg la <code>api.dev.inspectiamuncii.org</code> și NU au valoare legală. Treceți
          pe producție numai după ce fluxul a fost probat aici cap-coadă.
        </Callout>
      ) : null}

      <FormularCredentiale
        poateConfigura={poateConfigura}
        rezumat={
          rezumat === null
            ? null
            : {
                mediu: rezumat.mediu,
                cuiAngajator: rezumat.cuiAngajator,
                clientId: rezumat.clientId,
                utilizator: rezumat.utilizator,
                areSecret: rezumat.areSecret,
                areParola: rezumat.areParola,
                verificatOk: rezumat.verificatOk,
                verificatMesaj: rezumat.verificatMesaj,
                verificatLa:
                  rezumat.verificatLa === null
                    ? null
                    : formatDate(rezumat.verificatLa.slice(0, 10)),
                activ: rezumat.activ,
              }
        }
      />
    </div>
  );
}

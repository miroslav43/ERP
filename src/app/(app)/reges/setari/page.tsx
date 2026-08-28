// src/app/(app)/reges/setari/page.tsx
import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Callout } from "@/components/ui/callout";
import { meetsScope } from "@/config/permissions";
import { requireFeature } from "@/lib/auth/features";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format/date";
import { citesteRezumatCredentiale } from "@/lib/reges/credentiale";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { FormularCredentiale } from "./formular-credentiale";

export const metadata = { title: "REGES-Online — chei API" };

export default async function PaginaSetariReges() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "reges");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  // Ecranul cere `configure`, nu `read`: cheile API dau drept de scriere în
  // registrul oficial al Inspecției Muncii, deci nu sunt „setări" obișnuite.
  const poateConfigura = meetsScope(scopeFor(permisiuni, "reges:configure") ?? undefined, "all");
  if (!poateConfigura) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a configura legătura cu REGES-Online. Solicitați administratorului firmei permisiunea „REGES — configurare”." />
    );
  }

  const supabase = await createServerSupabase();
  const rezumat = await citesteRezumatCredentiale(supabase, tenant.organizationId);

  return (
    <div className="space-y-6">
      <AntetPagina
        firimituri={[{ eticheta: "REGES-Online", href: "/reges" }, { eticheta: "Chei API" }]}
        titlu="Legătura cu REGES-Online"
        descriere="Fiecare firmă are propriul cont de angajator la Inspecția Muncii și propriile chei API. Nu există o cheie comună a aplicației."
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

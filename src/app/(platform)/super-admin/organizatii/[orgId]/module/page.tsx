// src/app/(platform)/super-admin/organizatii/[orgId]/module/page.tsx
import { notFound } from "next/navigation";
import { Lock, PackageOpen, RotateCw } from "lucide-react";

import { buton } from "@/components/ui/buton";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format/date";
import { SELECT_PROFIL, numeAfisat, type RandProfil } from "../../../_lib/platform";
import { ComutatorModul } from "./comutator-modul";

type GrupModul = "core" | "hr" | "operations" | "finance" | "communication" | "portal";

const ORDINE_GRUPURI: readonly GrupModul[] = [
  "core",
  "hr",
  "operations",
  "finance",
  "communication",
  "portal",
];

const ETICHETE_GRUP: Readonly<Record<GrupModul, string>> = {
  core: "Nucleu",
  hr: "Resurse umane",
  operations: "Operațiuni",
  finance: "Financiar",
  communication: "Comunicare",
  portal: "Portal angajat",
};

type RandModul = Readonly<{
  feature_key: string;
  denumire: string;
  descriere: string | null;
  grup: GrupModul;
  is_core: boolean;
  sort_order: number;
}>;

type RandActivare = Readonly<{
  feature_key: string;
  enabled: boolean;
  activated_at: string | null;
  activated_by: string | null;
}>;

export default async function PaginaModule({ params }: { params: Promise<{ orgId: string }> }) {
  await requirePlatformAdmin();
  const { orgId } = await params;
  const supabase = await createServerSupabase();

  const [rezOrg, rezModule, rezActivari] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, status")
      .eq("id", orgId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("features")
      .select("feature_key, denumire, descriere, grup, is_core, sort_order")
      .order("grup", { ascending: true })
      .order("sort_order", { ascending: true })
      .returns<RandModul[]>(),
    supabase
      .from("organization_features")
      .select("feature_key, enabled, activated_at, activated_by")
      .eq("organization_id", orgId)
      .returns<RandActivare[]>(),
  ]);

  if (rezOrg.error || rezModule.error || rezActivari.error) {
    return <StareEroare orgId={orgId} />;
  }

  const org = rezOrg.data;
  if (!org) notFound();

  const moduleActive = rezModule.data ?? [];
  const activari = rezActivari.data ?? [];
  const hartaActivari = new Map(activari.map((activare) => [activare.feature_key, activare]));

  const idAutori = Array.from(
    new Set(activari.flatMap((activare) => (activare.activated_by ? [activare.activated_by] : []))),
  );
  const profiluri =
    idAutori.length > 0
      ? ((
          await supabase
            .from("profiles")
            .select(SELECT_PROFIL)
            .in("id", idAutori)
            .returns<RandProfil[]>()
        ).data ?? [])
      : [];
  const hartaProfiluri = new Map(profiluri.map((profil) => [profil.id, profil]));

  const grupuri = ORDINE_GRUPURI.map((grup) => ({
    grup,
    module: moduleActive.filter((modul) => modul.grup === grup),
  })).filter((intrare) => intrare.module.length > 0);

  const activeCount = moduleActive.filter(
    (modul) => modul.is_core || (hartaActivari.get(modul.feature_key)?.enabled ?? false),
  ).length;

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-foreground text-titlu font-semibold">Module — {org.name}</h1>
        <p className="text-muted-foreground text-corp">
          {moduleActive.length === 0
            ? "Catalogul de module este gol."
            : `${activeCount} din ${moduleActive.length} module sunt disponibile pentru această organizație.`}
        </p>
      </header>

      {moduleActive.length === 0 ? (
        <div className="border-border bg-surface flex flex-col items-center gap-3 rounded-xl border p-10 text-center">
          <PackageOpen aria-hidden="true" className="text-muted-foreground h-8 w-8" />
          <p className="text-foreground text-corp font-medium">Nu există module în catalog</p>
          <p className="text-muted-foreground text-corp max-w-md">
            Catalogul din tabela <code>features</code> nu conține încă nicio intrare, așa că nu
            poate fi activat nimic pentru organizații. Populează catalogul, apoi revino aici.
          </p>
        </div>
      ) : (
        grupuri.map((intrare) => (
          <div key={intrare.grup} className="border-border bg-surface rounded-xl border">
            <h2 className="border-border text-muted-foreground text-corp border-b px-4 py-3 font-semibold tracking-wide uppercase">
              {ETICHETE_GRUP[intrare.grup]}
            </h2>
            <ul className="divide-border divide-y">
              {intrare.module.map((modul) => {
                const activare = hartaActivari.get(modul.feature_key);
                const activ = modul.is_core || (activare?.enabled ?? false);
                const autor = activare?.activated_by
                  ? hartaProfiluri.get(activare.activated_by)
                  : undefined;

                return (
                  <li key={modul.feature_key} className="flex items-start gap-4 px-4 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground font-medium">{modul.denumire}</p>
                      {modul.descriere ? (
                        <p className="text-muted-foreground text-corp mt-0.5">{modul.descriere}</p>
                      ) : null}
                      {activare?.activated_at ? (
                        <p className="text-muted-foreground text-nota mt-1">
                          Ultima activare: {formatDateTime(new Date(activare.activated_at))} de{" "}
                          {numeAfisat(autor)}
                        </p>
                      ) : null}
                    </div>

                    {modul.is_core ? (
                      <div className="flex max-w-xs flex-col items-end gap-1">
                        <span className="border-border text-muted-foreground text-nota inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                          <Lock aria-hidden="true" className="h-3 w-3" />
                          Inclus în nucleu
                        </span>
                        <p className="text-muted-foreground text-nota text-right">
                          Modulele de nucleu sunt necesare funcționării platformei și nu pot fi
                          dezactivate.
                        </p>
                      </div>
                    ) : (
                      <ComutatorModul
                        organizationId={org.id}
                        featureKey={modul.feature_key}
                        denumire={modul.denumire}
                        activInitial={activ}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function StareEroare({ orgId }: Readonly<{ orgId: string }>) {
  return (
    <div
      role="alert"
      className="border-border bg-surface flex flex-col items-center gap-3 rounded-xl border p-10 text-center"
    >
      <p className="text-danger text-corp font-medium">Modulele nu au putut fi încărcate</p>
      <p className="text-muted-foreground text-corp max-w-md">
        A apărut o problemă la citirea datelor. Poți încerca din nou; dacă se repetă, verifică
        jurnalul de audit.
      </p>
      <a
        href={`/super-admin/organizatii/${orgId}/module`}
        className={buton({ varianta: "primar" })}
      >
        <RotateCw aria-hidden="true" className="h-4 w-4" />
        Reîncearcă
      </a>
    </div>
  );
}

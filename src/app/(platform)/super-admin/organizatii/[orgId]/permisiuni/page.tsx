// src/app/(platform)/super-admin/organizatii/[orgId]/permisiuni/page.tsx
import { notFound } from "next/navigation";
import { RotateCw, ShieldCheck } from "lucide-react";

import { buton } from "@/components/ui/buton";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createServerSupabase } from "@/lib/supabase/server";
import { ETICHETE_ROL, ROLURI_APLICATIE, type RolAplicatie } from "@/schemas/membership";

import { CULORI_SCOPE, ETICHETE_SCOPE } from "../../../_lib/platform";

type Scope = "none" | "own" | "team" | "all";

type RandPermisiune = Readonly<{
  role: RolAplicatie;
  resource: string;
  action: string;
  scope: Scope;
}>;

const CLASA_ANTET =
  "px-3 py-2 text-left text-nota font-semibold uppercase tracking-wide text-muted-foreground";

function cheiePermisiune(rand: RandPermisiune): string {
  return `${rand.resource}:${rand.action}`;
}

function cheieCelula(permisiune: string, rol: RolAplicatie): string {
  return `${permisiune}::${rol}`;
}

export default async function PaginaPermisiuni({ params }: { params: Promise<{ orgId: string }> }) {
  await requirePlatformAdmin();
  const { orgId } = await params;
  const supabase = await createServerSupabase();

  const [rezOrg, rezImplicite, rezSuprascrise] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name")
      .eq("id", orgId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("role_permissions")
      .select("role, resource, action, scope")
      .is("organization_id", null)
      .returns<RandPermisiune[]>(),
    supabase
      .from("role_permissions")
      .select("role, resource, action, scope")
      .eq("organization_id", orgId)
      .returns<RandPermisiune[]>(),
  ]);

  if (rezOrg.error || rezImplicite.error || rezSuprascrise.error) {
    return (
      <div
        role="alert"
        className="border-border bg-surface flex flex-col items-center gap-3 rounded-xl border p-10 text-center"
      >
        <p className="text-danger text-corp font-medium">
          Matricea de permisiuni nu a putut fi încărcată
        </p>
        <a
          href={`/super-admin/organizatii/${orgId}/permisiuni`}
          className={buton({ varianta: "primar" })}
        >
          <RotateCw aria-hidden="true" className="h-4 w-4" />
          Reîncearcă
        </a>
      </div>
    );
  }

  const org = rezOrg.data;
  if (!org) notFound();

  const implicite = rezImplicite.data ?? [];
  const suprascrise = rezSuprascrise.data ?? [];

  const valori = new Map<string, Scope>();
  for (const rand of implicite)
    valori.set(cheieCelula(cheiePermisiune(rand), rand.role), rand.scope);

  const celuleSuprascrise = new Set<string>();
  const permisiuniSuprascrise = new Set<string>();
  for (const rand of suprascrise) {
    const cheiePerm = cheiePermisiune(rand);
    const cheie = cheieCelula(cheiePerm, rand.role);
    valori.set(cheie, rand.scope);
    celuleSuprascrise.add(cheie);
    permisiuniSuprascrise.add(cheiePerm);
  }

  const cheiPermisiuni = Array.from(
    new Set([...implicite, ...suprascrise].map(cheiePermisiune)),
  ).sort((a, b) => a.localeCompare(b, "ro"));

  if (cheiPermisiuni.length === 0) {
    return (
      <section className="space-y-6">
        <h1 className="text-foreground text-titlu font-semibold">Permisiuni — {org.name}</h1>
        <div className="border-border bg-surface flex flex-col items-center gap-3 rounded-xl border p-10 text-center">
          <ShieldCheck aria-hidden="true" className="text-muted-foreground h-8 w-8" />
          <p className="text-foreground text-corp font-medium">Nu există permisiuni definite</p>
          <p className="text-muted-foreground text-corp max-w-md">
            Tabela <code>role_permissions</code> nu conține încă reguli implicite. Rulează seed-ul
            de permisiuni, apoi revino aici.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-foreground text-titlu font-semibold">Permisiuni — {org.name}</h1>
        <p className="text-muted-foreground text-corp">
          Matrice doar pentru consultare: {cheiPermisiuni.length} resurse pe{" "}
          {ROLURI_APLICATIE.length} roluri. Editarea permisiunilor va fi disponibilă într-o etapă
          următoare.
        </p>
      </header>

      <div className="border-border bg-surface rounded-xl border p-4">
        <h2 className="text-foreground text-corp font-semibold">Legendă</h2>
        <ul className="text-nota mt-2 flex flex-wrap gap-3">
          {(["none", "own", "team", "all"] as const).map((scope) => (
            <li
              key={scope}
              className={`border-border inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${CULORI_SCOPE[scope]}`}
            >
              <span className="font-mono">{scope}</span>
              <span className="text-muted-foreground">— {ETICHETE_SCOPE[scope]}</span>
            </li>
          ))}
          <li className="border-border text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
            <span aria-hidden="true">•</span> valoare suprascrisă pentru această organizație
          </li>
        </ul>
      </div>

      {/*
        EXCEPȚIE de la migrarea pe `<Tabel>`, deliberată.
        E o MATRICE, nu o listă: coloanele se nasc din `ROLURI_APLICATIE`, deci
        numărul lor nu e fix, iar prima celulă a fiecărui rând e un
        `<th scope="row">` — antetul rândului, nu o valoare. `Coloana<R>` descrie
        coloane declarate una câte una și randează toate celulele ca `<td>`, iar
        varianta de card („un titlu, o insignă, un rând de metadate”) n-are ce
        reprezenta când rândul e cinci valori de scope egale între ele.
        Matricea rămâne scrisă de mână; ecran îngust = derulare orizontală, ca
        orice tabel încrucișat.
      */}
      <div className="border-border bg-surface overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[52rem] border-collapse">
          <caption className="sr-only">
            Matricea permisiunilor pentru organizația {org.name}. Rândurile marcate au valori
            suprascrise față de implicitul global.
          </caption>
          <thead className="border-border border-b">
            <tr>
              <th scope="col" className={CLASA_ANTET}>
                Resursă
              </th>
              {ROLURI_APLICATIE.map((rol) => (
                <th key={rol} scope="col" className={CLASA_ANTET}>
                  {ETICHETE_ROL[rol]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {cheiPermisiuni.map((cheie) => {
              const suprascrisa = permisiuniSuprascrise.has(cheie);
              return (
                <tr key={cheie}>
                  <th
                    scope="row"
                    className="text-foreground text-corp px-3 py-2 text-left align-top font-medium"
                  >
                    <span className="text-nota font-mono">{cheie}</span>
                    {suprascrisa ? (
                      <span className="border-border text-accent ml-2 rounded-full border px-2 py-0.5 text-[0.65rem]">
                        suprascrisă
                      </span>
                    ) : null}
                  </th>
                  {ROLURI_APLICATIE.map((rol) => {
                    const cheieCel = cheieCelula(cheie, rol);
                    const scope = valori.get(cheieCel) ?? "none";
                    const esteSuprascrisa = celuleSuprascrise.has(cheieCel);
                    return (
                      <td key={rol} className="px-3 py-2 align-top">
                        <span
                          className={`border-border text-nota inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${CULORI_SCOPE[scope]}`}
                        >
                          {ETICHETE_SCOPE[scope]}
                          {esteSuprascrisa ? (
                            <>
                              <span aria-hidden="true">•</span>
                              <span className="sr-only">
                                suprascrisă pentru această organizație
                              </span>
                            </>
                          ) : null}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

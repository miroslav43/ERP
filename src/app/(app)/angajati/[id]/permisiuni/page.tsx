// src/app/(app)/angajati/[id]/permisiuni/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { idDinRuta } from "@/lib/rute/parametri";
import { cn } from "@/lib/ui/cn";
import { PERMISSION_KEYS, type PermissionScope } from "@/config/permissions";
import { citesteAngajat } from "@/lib/queries/employees";

import { etichetaRol } from "@/lib/membri/etichete";

import { MatricePermisiuni, type RandPermisiune } from "./matrice-permisiuni";
import { SelectorRol } from "./selector-rol";

export const metadata: Metadata = { title: "Permisiuni suplimentare" };

/**
 * Ce poate face acest angajat, peste implicitul rolului lui.
 *
 * Rostul ecranului: cineva are nevoie punctual de un modul pe care rolul nu i-l
 * dă — ține evidența mașinilor, primește acces la inventar. Până acum singura
 * cale era schimbarea rolului, care îi dădea mult mai mult decât îi trebuia.
 */
export default async function PaginaPermisiuniMembru({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const employeeId = idDinRuta(id);

  const { tenant } = await requireTenant();
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  // `roles:update` la prag `team` — pragul cel mai mic care deschide ecranul.
  // Cine are doar `team` va fi oprit de RLS pe fiecare membru din afara echipei;
  // butonul se dezactivează mai jos, ca refuzul să nu vină abia la clic.
  if (!can(permisiuni, "roles:update", "team")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a modifica permisiunile. Este nevoie de rolul de administrator al organizației." />
      </div>
    );
  }

  const scopeAcordare = scopeFor(permisiuni, "roles:update");
  const angajat = await citesteAngajat(
    tenant.organizationId,
    employeeId,
    scopeFor(permisiuni, "employees:read") ?? "own",
    null,
  );
  if (angajat === null) notFound();

  const db = await createServerSupabase();

  // Apartenența, prin `user_id`: subordonarea trăiește în `employees`, iar
  // drepturile în `organization_members`. Un angajat fără cont n-are apartenență,
  // deci n-are ce i se suprascrie.
  //
  // Întrebarea nu se PUNE dacă `user_id` e NULL. `.eq("user_id", … ?? "")` trimite
  // șirul vid unei coloane `uuid`, iar Postgres nu-l citește ca „nicio potrivire":
  // ridică 22P02 pe conversie, PostgREST îl întoarce ca eroare, iar ecranul de mai
  // jos — scris anume pentru angajatul fără cont — devenea de neatins tocmai în
  // cazul lui. Omul primea „Angajații nu au putut fi afișați" pentru fiecare fișă
  // fără cont — cazul majoritar, nu limita: 5 din 9 fișe active n-aveau `user_id`
  // pe 29 aug 2026. Poarta: `src/config/filtru-gol.test.ts`.
  const apartenenta =
    angajat.user_id === null
      ? { data: null, error: null }
      : await db
          .from("organization_members")
          .select("id, role")
          .eq("organization_id", tenant.organizationId)
          .eq("user_id", angajat.user_id)
          .is("deleted_at", null)
          .maybeSingle();
  if (apartenenta.error !== null) throw apartenenta.error;
  const membru = apartenenta.data;

  if (membru === null) {
    const numeAngajat = angajat.full_name ?? "Angajatul";
    return (
      <div className={cn(LATIMI.formular, "space-y-4")}>
        <AntetPagina titlu="Permisiuni suplimentare" />
        <p className="border-warning/40 bg-warning/10 text-foreground rounded-panou text-corp border p-4">
          {angajat.user_id === null
            ? `${numeAngajat} nu are încă un cont în aplicație, deci nu are ce permisiuni primi. Contul se creează din fișa lui, de la „Acces în aplicație”.`
            : `${numeAngajat} are cont, dar nu mai e membru activ al firmei. Permisiunile se acordă unei apartenențe, iar a lui a fost retrasă.`}
        </p>
        <Link
          href={`/angajati/${employeeId}`}
          className="text-primary text-corp underline-offset-2 hover:underline"
        >
          Înapoi la fișă
        </Link>
      </div>
    );
  }

  // Implicitul rolului: rândurile FĂRĂ `member_id`, exact cele pe care le-ar
  // vedea membrul dacă n-ar avea nicio suprascriere.
  const [implicite, suprascrieri] = await Promise.all([
    db
      .from("role_permissions")
      .select("organization_id, resource, action, scope")
      .eq("role", membru.role)
      .is("member_id", null)
      .or(`organization_id.eq.${tenant.organizationId},organization_id.is.null`)
      .is("deleted_at", null),
    db
      .from("role_permissions")
      .select("resource, action, scope")
      .eq("organization_id", tenant.organizationId)
      .eq("member_id", membru.id)
      .is("deleted_at", null),
  ]);
  if (implicite.error !== null) throw implicite.error;
  if (suprascrieri.error !== null) throw suprascrieri.error;

  // Aceeași precedență ca în bază: rândul organizației bate implicitul global.
  const globale = new Map<string, PermissionScope>();
  const locale = new Map<string, PermissionScope>();
  for (const rand of implicite.data ?? []) {
    const cheie = `${rand.resource}:${rand.action}`;
    (rand.organization_id === null ? globale : locale).set(cheie, rand.scope);
  }
  const dinRol = new Map<string, PermissionScope>([...globale, ...locale]);
  const alese = new Map<string, PermissionScope>(
    (suprascrieri.data ?? []).map((r) => [`${r.resource}:${r.action}`, r.scope]),
  );

  const randuri: readonly RandPermisiune[] = PERMISSION_KEYS
    // `roles` nu se poate acorda pe calea asta — politica din 0063 o refuză, ca
    // nimeni să nu-și poată crește drepturile prin interpuși. Ascunsă, nu doar
    // refuzată: un rând care pică mereu e un rând care pare stricat.
    .filter((cheie) => !cheie.startsWith("roles:"))
    .map((cheie) => {
      const [resursa, actiune] = cheie.split(":");
      return {
        cheie,
        resursa: resursa ?? cheie,
        actiune: actiune ?? "",
        implicit: dinRol.get(cheie) ?? null,
        suprascris: alese.get(cheie) ?? null,
      };
    });

  const numarSuprascrieri = randuri.filter((r) => r.suprascris !== null).length;

  return (
    <div className={cn(LATIMI.formular, "space-y-6")}>
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-corp">
          <Link href={`/angajati/${employeeId}`} className="underline-offset-2 hover:underline">
            {angajat.full_name ?? "Fișa angajatului"}
          </Link>
        </p>
        <AntetPagina
          titlu="Permisiuni suplimentare"
          descriere={`Peste ce îi dă rolul de ${etichetaRol(membru.role)}. ${
            numarSuprascrieri === 0
              ? "Momentan nimic suprascris — vede exact ce vede rolul lui."
              : `${numarSuprascrieri.toLocaleString("ro-RO")} suprascrieri active.`
          }`}
        />
      </div>

      {/*
        Rolul stă DEASUPRA matricei fiindcă e pârghia mare: schimbat, mută zeci
        de permisiuni deodată. Suprascrierile de sub el sunt ajustări pe cazuri
        punctuale — cine începe cu ele pentru ceva ce rezolvă rolul ajunge cu
        douăzeci de rânduri care trebuie întreținute manual la fiecare schimbare.
      */}
      <SelectorRol
        memberId={membru.id}
        rolCurent={membru.role}
        numePersoana={angajat.full_name ?? "Angajatul"}
        // `users:update` la `all`, nu `roles:update`: politica de pe
        // `organization_members` cere rolul de administrator, iar un buton activ
        // pentru altcineva ar produce un refuz tăcut, nu un mesaj.
        poateSchimba={can(permisiuni, "users:update", "all")}
      />

      <p className="border-border bg-surface text-muted-foreground rounded-panou text-corp border p-3">
        „Ca la rol” înseamnă că permisiunea urmează rolul și se schimbă odată cu el. O valoare
        aleasă aici rămâne fixă, inclusiv dacă rolul se schimbă mai târziu — inclusiv „Refuzat
        explicit”, care ia un drept pe care rolul îl dă.
      </p>

      <MatricePermisiuni
        memberId={membru.id}
        randuri={randuri}
        // `all` = oriunde în firmă. `team` = doar subordonații, iar baza refuză
        // restul; ecranul nu poate ști aici cine e subordonat, deci lasă
        // controlul activ și afișează refuzul dacă vine.
        poateScrie={scopeAcordare === "all" || scopeAcordare === "team"}
      />
    </div>
  );
}

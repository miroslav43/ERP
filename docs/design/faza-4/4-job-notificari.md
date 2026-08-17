<tr style="background:#f9fafb;">
<td style="padding:8px 12px;font:12px Arial,sans-serif;color:#6b7280;text-transform:uppercase;">Ce expiră</td>
<td style="padding:8px 12px;font:12px Arial,sans-serif;color:#6b7280;text-transform:uppercase;">Scadență</td>
<td style="padding:8px 12px;font:12px Arial,sans-serif;color:#6b7280;text-transform:uppercase;">Termen</td>
</tr>
${randuri}
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
<tr><td style="border-radius:6px;background:#111827;">
<a href="${url}" style="display:inline-block;padding:12px 20px;font:bold 14px Arial,sans-serif;color:#ffffff;text-decoration:none;">Vezi în Administrativo</a>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:16px 24px;background:#f9fafb;">
<p style="margin:0;font:12px/1.5 Arial,sans-serif;color:#9ca3af;">
Primiți acest email pentru că sunteți responsabil de conformitate în Administrativo. Pragurile de alertă se configurează din Setări &gt; Conformitate.
</p>
</td></tr>
</table>
</td></tr>
</table>`.trim();

  const text = [
    `Bună, ${numeDestinatar}.`,
    "",
    numar === 1 ? "Următoarea scadență necesită atenție:" : "Următoarele scadențe necesită atenție:",
    "",
    ...alerte.map(
      (a) => `- ${a.eticheta} (${eticheteazaTip(a.tip)}): scadent ${a.dataScadenta} — ${eticheteazaPrag(a.pragZile)}`,
    ),
    "",
    `Detalii: ${url}`,
  ].join("\n");

  return { subject: subiect, html, text };
}
```

```ts
// src/app/(app)/notificari/actions.ts

"use server";

import { z } from "zod";
import { createAction } from "@/lib/actions/create-action";
import { notFound, mapPostgrestError } from "@/lib/actions/errors";

const listeazaSchema = z.object({
  doarNecitite: z.boolean().optional(),
  limita: z.number().int().min(1).max(100).optional(),
});

export interface NotificareRezumat {
  id: string;
  titlu: string;
  mesaj: string;
  link: string | null;
  citita: boolean;
  creataLa: string;
}

// Nu există un resource dedicat "notifications" în grila de permisiuni —
// resursele definite sunt cele din inventar. Toate notificările din Faza 4
// provin din alerte de conformitate, deci folosim compliance:read cu
// scope minim 'own' (un utilizator își vede mereu propria căsuță de
// notificări). Dacă apar categorii de notificări în afara conformității,
// va fi nevoie de o resursă "notifications" separată — semnalat la final.
export const listeazaNotificari = createAction<typeof listeazaSchema, NotificareRezumat[]>({
  name: "notificari.listeaza",
  input: listeazaSchema,
  permission: "compliance:read",
  minScope: "own",
  audit: { action: "view", entityType: "notification", allow: [] },
  handler: async (ctx, input) => {
    let interogare = ctx.supabase
      .from("notifications")
      .select("id, title, message, link, read_at, created_at")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(input.limita ?? 50);

    if (input.doarNecitite) {
      interogare = interogare.is("read_at", null);
    }

    const { data, error } = await interogare;
    if (error) throw mapPostgrestError(error);

    return (data ?? []).map((n) => ({
      id: n.id,
      titlu: n.title,
      mesaj: n.message,
      link: n.link,
      citita: n.read_at !== null,
      creataLa: n.created_at,
    }));
  },
});

const marcheazaSchema = z.object({ id: z.string().uuid() });

export const marcheazaNotificareCitita = createAction<typeof marcheazaSchema, { id: string }>({
  name: "notificari.marcheaza-citita",
  input: marcheazaSchema,
  permission: "compliance:read",
  minScope: "own",
  audit: {
    action: "update",
    entityType: "notification",
    entityId: (input) => input.id,
    allow: [],
  },
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("user_id", ctx.user.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();

    if (error) throw mapPostgrestError(error);
    if (!data) throw notFound("Notificarea nu a fost găsită sau nu vă aparține.");

    return { id: data.id };
  },
});

const marcheazaToateSchema = z.object({});

export const marcheazaToateCitite = createAction<typeof marcheazaToateSchema, { actualizate: number }>({
  name: "notificari.marcheaza-toate-citite",
  input: marcheazaToateSchema,
  permission: "compliance:read",
  minScope: "own",
  audit: { action: "update", entityType: "notification", allow: [] },
  handler: async (ctx) => {
    const { data, error } = await ctx.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", ctx.user.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("read_at", null)
      .select("id");

    if (error) throw mapPostgrestError(error);
    return { actualizate: data?.length ?? 0 };
  },
});
```

```tsx
// src/app/(app)/notificari/marcheaza-citita-buton.tsx

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcheazaNotificareCitita } from "./actions";

interface Props {
  id: string;
}

export function MarcheazaCititaButon({ id }: Props) {
  const router = useRouter();
  const [sePending, startTransition] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        disabled={sePending}
        onClick={() => {
          setEroare(null);
          startTransition(async () => {
            const rezultat = await marcheazaNotificareCitita({ id });
            if (!rezultat.ok) {
              setEroare(rezultat.error.message);
              return;
            }
            router.refresh();
          });
        }}
        className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        aria-label="Marchează notificarea ca citită"
      >
        {sePending ? "Se marchează…" : "Marchează citită"}
      </button>
      {eroare ? <span className="text-xs text-red-600">{eroare}</span> : null}
    </div>
  );
}
```

```tsx
// src/app/(app)/notificari/page.tsx

import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { meetsScope } from "@/config/permissions";
import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime } from "@/lib/format/date";
import { listeazaNotificari } from "./actions";
import { MarcheazaCititaButon } from "./marcheaza-citita-buton";

interface Props {
  searchParams: Promise<{ filtru?: string }>;
}

export default async function PaginaNotificari({ searchParams }: Props) {
  await requireUser();
  const tenant = await requireTenant();
  const { filtru } = await searchParams;
  const doarNecitite = filtru === "necitite";

  const harta = await getPermissionMap(tenant.organizationId, tenant.role);
  const scop = scopeFor(harta, "compliance:read");

  if (!meetsScope(scop ?? undefined, "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a vedea notificările de conformitate ale acestei organizații." />
    );
  }

  const rezultat = await listeazaNotificari({ limita: 100, doarNecitite });

  if (!rezultat.ok) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600" role="alert">
          {rezultat.error.message}
        </p>
      </div>
    );
  }

  const notificari = rezultat.data;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Notificări</h1>
      <p className="mb-4 text-sm text-gray-500">Alertele de conformitate adunate pentru dumneavoastră.</p>

      <div className="mb-4 flex gap-2" role="tablist" aria-label="Filtru notificări">
        <Link
          href="/notificari"
          role="tab"
          aria-selected={!doarNecitite}
          className={`rounded-full px-3 py-1 text-sm ${!doarNecitite ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}
        >
          Toate
        </Link>
        <Link
          href="/notificari?filtru=necitite"
          role="tab"
          aria-selected={doarNecitite}
          className={`rounded-full px-3 py-1 text-sm ${doarNecitite ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}
        >
          Necitite
        </Link>
      </div>

      {notificari.length === 0 ? (
        <EmptyState
          icon="bell"
          title={doarNecitite ? "Nicio notificare necitită" : "Nicio notificare"}
          description="Alertele legate de scadențe (ITP, contracte, verificări) vor apărea aici pe măsură ce se apropie de termen."
        />
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {notificari.map((n) => (
            <li key={n.id} className={`flex items-start justify-between gap-4 p-4 ${n.citita ? "" : "bg-blue-50"}`}>
              <div className="min-w-0">
                {n.link ? (
                  <Link href={n.link} className="font-medium text-gray-900 hover:underline">
                    {n.titlu}
                  </Link>
                ) : (
                  <p className="font-medium text-gray-900">{n.titlu}</p>
                )}
                <p className="mt-0.5 truncate text-sm text-gray-600">{n.mesaj}</p>
                <p className="mt-1 text-xs text-gray-400">{formatDateTime(n.creataLa)}</p>
              </div>
              {!n.citita ? <MarcheazaCititaButon id={n.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

```tsx
// src/components/layout/clopotel-notificari.tsx

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  listeazaNotificari,
  marcheazaNotificareCitita,
  marcheazaToateCitite,
  type NotificareRezumat,
} from "@/app/(app)/notificari/actions";

const INTERVAL_REIMPROSPATARE_MS = 60_000;

export function ClopotelNotificari() {
  const [deschis, setDeschis] = useState(false);
  const [notificari, setNotificari] = useState<NotificareRezumat[]>([]);
  const [seIncarca, setSeIncarca] = useState(true);
  const [eroare, setEroare] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const necitite = notificari.filter((n) => !n.citita).length;

  async function reimprospateaza() {
    const rezultat = await listeazaNotificari({ limita: 8, doarNecitite: false });
    if (rezultat.ok) {
      setNotificari(rezultat.data);
      setEroare(null);
    } else {
      setEroare(rezultat.error.message);
    }
    setSeIncarca(false);
  }

  useEffect(() => {
    reimprospateaza();
    const id = setInterval(reimprospateaza, INTERVAL_REIMPROSPATARE_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function inchideLaClicInAfara(ev: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setDeschis(false);
      }
    }
    document.addEventListener("mousedown", inchideLaClicInAfara);
    return () => document.removeEventListener("mousedown", inchideLaClicInAfara);
  }, []);

  function marcheaza(id: string) {
    setNotificari((curente) => curente.map((n) => (n.id === id ? { ...n, citita: true } : n)));
    startTransition(async () => {
      const rezultat = await marcheazaNotificareCitita({ id });
      if (!rezultat.ok) reimprospateaza(); // revenim la starea reală dacă a eșuat
    });
  }

  function marcheazaToate() {
    setNotificari((curente) => curente.map((n) => ({ ...n, citita: true })));
    startTransition(async () => {
      const rezultat = await marcheazaToateCitite({});
      if (!rezultat.ok) reimprospateaza();
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setDeschis((v) => !v)}
        aria-label={necitite > 0 ? `Notificări, ${necitite} necitite` : "Notificări"}
        aria-expanded={deschis}
        className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100"
      >
        <span aria-hidden="true">🔔</span>
        {necitite > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            {necitite > 9 ? "9+" : necitite}
          </span>
        ) : null}
      </button>

      {deschis ? (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
            <span className="text-sm font-semibold text-gray-900">Notificări</span>
            {necitite > 0 ? (
              <button type="button" onClick={marcheazaToate} className="text-xs font-medium text-blue-600 hover:underline">
                Marchează toate ca citite
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {seIncarca ? (
              <p className="p-4 text-sm text-gray-500">Se încarcă…</p>
            ) : eroare ? (
              <p className="p-4 text-sm text-red-600" role="alert">{eroare}</p>
            ) : notificari.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">Nicio notificare momentan.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notificari.map((n) => (
                  <li key={n.id} className={`p-3 ${n.citita ? "" : "bg-blue-50"}`}>
                    <button type="button" onClick={() => !n.citita && marcheaza(n.id)} className="block w-full text-left">
                      <p className="text-sm font-medium text-gray-900">{n.titlu}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{n.mesaj}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-gray-100 px-4 py-2">
            <Link href="/notificari" className="block text-center text-sm font-medium text-blue-600 hover:underline" onClick={() => setDeschis(false)}>
              Vezi toate notificările
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

SEMNALEZ (nu am putut verifica prin inventar, verifică înainte de aplicare):

1. **Schema tabelei `notifications`** — numele tabelei apare în inventar, dar nu coloanele. Am presupus: `id, organization_id, user_id, category, title, message, link, read_at (timestamptz nullable = necitit), created_at`. Dacă numele reale diferă (ex. `is_read boolean` în loc de `read_at`, sau `body` în loc de `message`), toate cele patru fișiere din `notificari/` și `clopotel-notificari.tsx` trebuie ajustate.
2. **`employees.user_id`** (FK spre `profiles`, angajatul are cont în portal) și **`employees.email`** — presupuse pentru rezolvarea destinatarului dintr-un `responsible_employee_id`; nu apar în inventarul schemei HR din Faza 2.
3. **`profiles`** — am presupus coloanele `id, email, full_name`.
4. **`organization_members`** — am presupus `organization_id, user_id, role, deleted_at`.
5. **`sendEmail`** — am presupus semnătura `sendEmail(mesaj: EmailMessage & { to: string }): Promise<{ id?: string } | void>`, unde `id`-ul întors ar fi cheia din `email_log`. Neverificat.
6. **`EmailMessage`** — am presupus forma `{ subject, html, text }`.
7. Nu am folosit `renderLayout`, `renderParagraph`, `renderButton`, `renderRow` din `@/lib/email/templates/layout` — semnăturile lor exacte nu erau verificabile în inventar, iar o presupunere greșită ar fi spart compilarea. Am construit HTML-ul integral, manual, folosind doar `escapeHtml` și `safeUrl` (funcții pure, contract simplu). Recomand realinierea vizuală cu celelalte șabloane odată ce semnătura reală e cunoscută.
8. Șablonul nou nu este înregistrat în `EMAIL_TEMPLATE_KEYS` / `renderEmail` — fișierul respectiv nu era în inventar și nu pot edita fișiere. `alerte-expirare.ts` e de sine stătător și apelat direct din `trimite.ts`.
9. **`serverEnv.APP_URL`** și **`serverEnv.ALERTE_CRON_SECRET`** — chei presupuse în `@/config/env`; trebuie adăugate acolo (nu le pot edita, fiind read-only).
10. Permisiunea folosită pentru inbox-ul de notificări este `compliance:read` (nu există resursă `notifications` în grila dată). Dacă apar categorii de notificări în afara conformității, e nevoie de o resursă dedicată.
11. Funcția Edge are nevoie de un secret suplimentar **`SUPABASE_DB_URL`** (conexiune directă la Postgres, cu drept de EXECUTE pe funcțiile `internal.*`, care nu sunt expuse prin PostgREST) — nu este injectat automat de platformă, trebuie setat manual ca secret al funcției.
12. Am adăugat trei fișiere neexplicit cerute, dar necesare ca „lipici" funcțional: `src/app/api/cron/alerte-zilnice/route.ts` (leagă funcția Edge de `trimite.ts`), `src/app/(app)/notificari/actions.ts` și `src/app/(app)/notificari/marcheaza-citita-buton.tsx` (server actions + butonul client din spatele celor două fișiere cerute explicit).
13. Secretele Vault `edge_functions_base_url` și `alerte_cron_secret` trebuie create manual, post-deploy (documentat în comentariile din `0007_cron.sql`) — nu sunt și nu trebuie să fie parte din migrare.
14. Tipul returnat de `createAdminSupabase()` nu era specificat exact în inventar (doar existența funcției); am tratat-o ca întorcând `SupabaseClient<Database>`, folosit ca atare în `trimite.ts`.
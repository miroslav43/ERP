```tsx
                  const rezultat = await creeazaTipConcediu({
                    key: valori.key ?? "",
                    denumire: valori.denumire,
                    zileImplicite: valori.zileImplicite,
                    scadeDinSold: valori.scadeDinSold,
                    necesitaDocument: valori.necesitaDocument,
                    seReporteaza: valori.seReporteaza,
                    termenReportare: valori.termenReportare,
                    plafonReportareZile: valori.plafonReportareZile,
                    intrerupeAlteConcedii: valori.intrerupeAlteConcedii,
                    modRotunjireAcumulare: valori.modRotunjireAcumulare,
                    culoare: valori.culoare,
                    temeiLegal: valori.temeiLegal,
                    valabilDeLa: valori.valabilDeLa,
                  });
                  if (!rezultat.ok) {
                    setEroare(rezultat.error.message);
                    return;
                  }
                  setSeCreeaza(false);
                  router.refresh();
                }}
              />
            </div>
          )}
      </div>
    </div>
  );
}
```

```ts
// src/app/(app)/setari/sarbatori/actions.ts
"use server";

import { z } from "zod";
import { createAction } from "@/lib/actions/create-action";
import { notFound, mapPostgrestError, isPostgrestError, businessRule } from "@/lib/actions/errors";
import type { Database } from "@/types/database";

const tipZiLibereEnum = z.enum(["liber_suplimentar", "zi_recuperare"]);
const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data trebuie în formatul AAAA-LL-ZZ.");

const creeazaSchema = z.object({
  data: dataSchema,
  denumire: z.string().trim().min(2).max(160),
  tip: tipZiLibereEnum,
  observatii: z.string().trim().max(500).nullable(),
});
export type IntrareZiLiberaCreare = z.infer<typeof creeazaSchema>;

type ZiLiberaInsert = Database["public"]["Tables"]["organization_holidays"]["Insert"];

export const creeazaZiLibera = createAction<typeof creeazaSchema, { id: string }>({
  name: "setari.sarbatori.creeazaZiLibera",
  input: creeazaSchema,
  feature: "leave",
  permission: "leave:update",
  minScope: "all",
  audit: {
    action: "create",
    entityType: "organization_holidays",
    entityId: (_input, data) => data.id,
    allow: ["data", "denumire", "tip", "observatii"],
  },
  revalidate: ["/setari/sarbatori"],
  handler: async (ctx, input) => {
    const insert: ZiLiberaInsert = {
      organization_id: ctx.tenant.organizationId,
      data: input.data,
      denumire: input.denumire,
      tip: input.tip,
      observatii: input.observatii,
      created_by: ctx.user.id,
    };
    const { data, error } = await ctx.supabase.from("organization_holidays").insert(insert).select("id").single();
    if (error) {
      if (isPostgrestError(error) && error.code === "23505") {
        throw businessRule("Există deja o zi liberă cu această denumire la această dată.");
      }
      throw mapPostgrestError(error);
    }
    return { id: data.id };
  },
});

const actualizeazaSchema = z.object({
  id: z.string().uuid(),
  denumire: z.string().trim().min(2).max(160),
  tip: tipZiLibereEnum,
  observatii: z.string().trim().max(500).nullable(),
});
export type IntrareZiLiberaActualizare = z.infer<typeof actualizeazaSchema>;

export const actualizeazaZiLibera = createAction<typeof actualizeazaSchema, { id: string }>({
  name: "setari.sarbatori.actualizeazaZiLibera",
  input: actualizeazaSchema,
  feature: "leave",
  permission: "leave:update",
  minScope: "all",
  audit: {
    action: "update",
    entityType: "organization_holidays",
    entityId: (input) => input.id,
    allow: ["denumire", "tip", "observatii"],
  },
  revalidate: ["/setari/sarbatori"],
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from("organization_holidays")
      .update({ denumire: input.denumire, tip: input.tip, observatii: input.observatii })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw mapPostgrestError(error);
    if (!data) throw notFound("Ziua liberă nu a fost găsită.");
    return { id: data.id };
  },
});

const stergeSchema = z.object({ id: z.string().uuid() });

export const stergeZiLibera = createAction<typeof stergeSchema, { id: string }>({
  name: "setari.sarbatori.stergeZiLibera",
  input: stergeSchema,
  feature: "leave",
  permission: "leave:update",
  minScope: "all",
  audit: {
    action: "delete",
    entityType: "organization_holidays",
    entityId: (input) => input.id,
    allow: ["deleted_at"],
  },
  revalidate: ["/setari/sarbatori"],
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from("organization_holidays")
      .update({ deleted_at: ctx.now })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw mapPostgrestError(error);
    if (!data) throw notFound("Ziua liberă nu a fost găsită sau a fost deja ștearsă.");
    return { id: data.id };
  },
});
```

```tsx
// src/app/(app)/setari/sarbatori/page.tsx
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { requireFeature } from "@/lib/auth/features";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { meetsScope } from "@/config/permissions";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format/date";
import { EmptyState } from "@/components/feedback/empty-state";
import { EditorZileLibere } from "./editor-zi-libera";

export default async function PaginaSarbatoriSetari({
  searchParams,
}: {
  searchParams: Promise<{ an?: string }>;
}) {
  const tenant = await requireTenant();
  await requireFeature(tenant.organizationId, "leave");

  const { an: anParam } = await searchParams;
  const anCurent = new Date().getFullYear();
  const an = anParam && /^\d{4}$/.test(anParam) ? Number(anParam) : anCurent;

  const mapaPermisiuni = await getPermissionMap(tenant.organizationId, tenant.role);
  const poateModifica = meetsScope(scopeFor(mapaPermisiuni, "leave:update") ?? undefined, "all");

  const supabase = await createServerSupabase();
  const [{ data: sarbatoriLegale, error: eLegale }, { data: zileProprii, error: eProprii }] = await Promise.all([
    supabase
      .from("public_holidays")
      .select("id, data, denumire, tip, temei_legal")
      .eq("tara", "RO")
      .eq("an", an)
      .is("deleted_at", null)
      .order("data", { ascending: true }),
    supabase
      .from("organization_holidays")
      .select("id, data, denumire, tip, observatii")
      .eq("organization_id", tenant.organizationId)
      .is("deleted_at", null)
      .gte("data", `${an}-01-01`)
      .lte("data", `${an}-12-31`)
      .order("data", { ascending: true }),
  ]);

  if (eLegale || eProprii) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
        Nu s-a putut încărca lista de sărbători. Reîncărcați pagina.
      </div>
    );
  }

  const aniDisponibili = Array.from({ length: 5 }, (_, i) => anCurent - 1 + i);

  return (
    <div className="space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Sărbători și zile libere</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sărbătorile legale naționale sunt stabilite prin lege și nu pot fi modificate aici. Zilele
          libere proprii organizației pot fi adăugate mai jos.
        </p>
        <nav aria-label="Selectare an" className="mt-3 flex gap-2">
          {aniDisponibili.map((a) => (
            <a
              key={a}
              href={`/setari/sarbatori?an=${a}`}
              aria-current={a === an ? "page" : undefined}
              className={`rounded-md px-3 py-1 text-sm ${
                a === an ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700"
              }`}
            >
              {a}
            </a>
          ))}
        </nav>
      </header>

      <section aria-labelledby="titlu-legale">
        <h2 id="titlu-legale" className="mb-2 text-lg font-medium text-slate-900">
          Sărbători legale {an}
        </h2>
        {!sarbatoriLegale || sarbatoriLegale.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="Fără date"
            description={`Nu există sărbători legale înregistrate pentru anul ${an}.`}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="p-3">Dată</th>
                  <th scope="col" className="p-3">Denumire</th>
                  <th scope="col" className="p-3">Tip</th>
                </tr>
              </thead>
              <tbody>
                {sarbatoriLegale.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="p-3">{formatDate(s.data)}</td>
                    <td className="p-3">{s.denumire}</td>
                    <td className="p-3">{s.tip === "fix" ? "Fixă" : "Mobilă"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="titlu-proprii">
        <h2 id="titlu-proprii" className="mb-2 text-lg font-medium text-slate-900">
          Zile libere proprii organizației
        </h2>
        <EditorZileLibere zile={zileProprii ?? []} poateModifica={poateModifica} an={an} />
      </section>
    </div>
  );
}
```

```tsx
// src/app/(app)/setari/sarbatori/editor-zi-libera.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creeazaZiLibera, stergeZiLibera } from "./actions";
import { formatDate } from "@/lib/format/date";
import { EmptyState } from "@/components/feedback/empty-state";

type ZiLibera = {
  id: string;
  data: string;
  denumire: string;
  tip: "liber_suplimentar" | "zi_recuperare";
  observatii: string | null;
};

export function EditorZileLibere({
  zile,
  poateModifica,
  an,
}: {
  zile: ZiLibera[];
  poateModifica: boolean;
  an: number;
}) {
  const router = useRouter();
  const [eroare, setEroare] = useState<string | null>(null);
  const [seAdauga, setSeAdauga] = useState(false);
  const [forma, setForma] = useState({
    data: `${an}-01-01`,
    denumire: "",
    tip: "liber_suplimentar" as ZiLibera["tip"],
    observatii: "",
  });
  const [trimite, setTrimite] = useState(false);

  async function adauga(e: React.FormEvent) {
    e.preventDefault();
    setEroare(null);
    setTrimite(true);
    const rezultat = await creeazaZiLibera({
      data: forma.data,
      denumire: forma.denumire,
      tip: forma.tip,
      observatii: forma.observatii.trim() === "" ? null : forma.observatii,
    });
    setTrimite(false);
    if (!rezultat.ok) {
      setEroare(rezultat.error.message);
      return;
    }
    setSeAdauga(false);
    setForma({ data: `${an}-01-01`, denumire: "", tip: "liber_suplimentar", observatii: "" });
    router.refresh();
  }

  async function sterge(id: string) {
    setEroare(null);
    const rezultat = await stergeZiLibera({ id });
    if (!rezultat.ok) {
      setEroare(rezultat.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {eroare && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {eroare}
        </div>
      )}
      {zile.length === 0 ? (
        <EmptyState
          icon="calendar-plus"
          title="Nicio zi liberă proprie"
          description={`Organizația nu are zile libere proprii înregistrate pentru ${an}.`}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="p-3">Dată</th>
                <th scope="col" className="p-3">Denumire</th>
                <th scope="col" className="p-3">Tip</th>
                {poateModifica && (
                  <th scope="col" className="p-3">
                    <span className="sr-only">Acțiuni</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {zile.map((z) => (
                <tr key={z.id} className="border-t border-slate-100">
                  <td className="p-3">{formatDate(z.data)}</td>
                  <td className="p-3">{z.denumire}</td>
                  <td className="p-3">
                    {z.tip === "zi_recuperare" ? "Zi de recuperare (lucrătoare)" : "Liber suplimentar"}
                  </td>
                  {poateModifica && (
                    <td className="p-3">
                      <button type="button" className="text-sm text-red-700 underline" onClick={() => sterge(z.id)}>
                        Șterge
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {poateModifica && (
        <div>
          <button
            type="button"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            onClick={() => setSeAdauga((v) => !v)}
          >
            {seAdauga ? "Anulează" : "Adaugă zi liberă"}
          </button>
          {seAdauga && (
            <form
              onSubmit={adauga}
              className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2"
            >
              <label className="flex flex-col text-sm">
                Dată
                <input
                  required
                  type="date"
                  value={forma.data}
                  onChange={(e) => setForma({ ...forma, data: e.target.value })}
                  className="mt-1 rounded-md border border-slate-300 p-2"
                />
              </label>
              <label className="flex flex-col text-sm">
                Denumire
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={forma.denumire}
                  onChange={(e) => setForma({ ...forma, denumire: e.target.value })}
                  className="mt-1 rounded-md border border-slate-300 p-2"
                />
              </label>
              <label className="flex flex-col text-sm">
                Tip
                <select
                  value={forma.tip}
                  onChange={(e) => setForma({ ...forma, tip: e.target.value as ZiLibera["tip"] })}
                  className="mt-1 rounded-md border border-slate-300 p-2"
                >
                  <option value="liber_suplimentar">Liber suplimentar (zi nelucrătoare)</option>
                  <option value="zi_recuperare">Zi de recuperare (lucrătoare, ex. sâmbătă lucrătoare)</option>
                </select>
              </label>
              <label className="flex flex-col text-sm sm:col-span-2">
                Observații (opțional)
                <input
                  maxLength={500}
                  value={forma.observatii}
                  onChange={(e) => setForma({ ...forma, observatii: e.target.value })}
                  className="mt-1 rounded-md border border-slate-300 p-2"
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={trimite}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {trimite ? "Se salvează…" : "Salvează"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
```

Continui cu edge function-ul, migrarea de cron și testele RLS în răspunsul următor.
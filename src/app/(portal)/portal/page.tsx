// src/app/(portal)/portal/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, Clock, FileText, Wallet } from "lucide-react";

import { getEnabledFeatures } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { idAnunturiCitite, listeazaAnunturi } from "@/lib/queries/announcements";
import { cererileMele, fisaProprie, soldurileMele, tipuriConcediu } from "@/lib/queries/portal";

import { ETICHETE_STATUS_CERERE } from "./etichete";

export const metadata: Metadata = { title: "Portalul meu" };

export default async function PaginaPortal() {
  const { tenant, user } = await requireTenant();
  const moduleActive = await getEnabledFeatures(tenant.organizationId);
  const fisa = await fisaProprie(tenant.organizationId, user.id);

  if (fisa === null) {
    // Un membru al organizației poate să nu aibă fișă de personal — un
    // administrator invitat, de exemplu. Portalul spune asta, nu cade.
    return (
      <div className="p-4">
        <div className="bg-surface border-border rounded-lg border p-6 text-center">
          <h1 className="text-foreground text-lg font-semibold">
            Nu aveți încă o fișă de personal
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Contul dumneavoastră are acces la {tenant.name}, dar nu este legat de un angajat. Cereți
            departamentului de resurse umane să vă completeze fișa.
          </p>
        </div>
      </div>
    );
  }

  const an = Number(todayInBucharest().slice(0, 4));
  const [solduri, cereri, tipuri, anunturi, anunturiCitite] = await Promise.all([
    moduleActive.has("leave")
      ? soldurileMele(tenant.organizationId, an, fisa.id)
      : Promise.resolve([]),
    moduleActive.has("leave")
      ? cererileMele(tenant.organizationId, fisa.id, 5)
      : Promise.resolve([]),
    moduleActive.has("leave")
      ? tipuriConcediu(tenant.organizationId)
      : Promise.resolve(
          new Map<string, { id: string; denumire: string; culoare: string | null }>(),
        ),
    moduleActive.has("announcements")
      ? listeazaAnunturi(tenant.organizationId)
      : Promise.resolve([]),
    moduleActive.has("announcements")
      ? idAnunturiCitite(tenant.organizationId, fisa.id)
      : Promise.resolve(new Set<string>()),
  ]);
  const anunturiRecente = anunturi.filter((a) => a.publicat_la !== null).slice(0, 3);

  // Soldul care contează pentru un om e cel de odihnă. Îl alegem pe cel mai mare
  // drept anual: e concediul de odihnă în orice configurație rezonabilă, iar dacă
  // firma și-a numit tipurile altfel, tot ăla e cel despre care întreabă.
  const soldPrincipal = [...solduri].sort((a, b) => b.drept_anual - a.drept_anual)[0] ?? null;

  return (
    <div className="space-y-4 p-4">
      <section className="bg-surface border-border rounded-lg border p-4">
        <p className="text-muted-foreground text-xs">Bună ziua,</p>
        <p className="text-foreground text-xl font-semibold">{fisa.full_name ?? fisa.marca}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Marca {fisa.marca}
          {fisa.hired_on === null ? null : ` · angajat din ${formatDate(fisa.hired_on)}`}
        </p>
      </section>

      {soldPrincipal === null ? null : (
        <section
          aria-labelledby="sold"
          className="bg-primary text-primary-foreground rounded-lg p-4"
        >
          <h2 id="sold" className="text-sm font-medium opacity-90">
            Zile de concediu rămase în {an}
          </h2>
          <p className="mt-1 text-4xl font-semibold tabular-nums">
            {(soldPrincipal.ramase ?? 0).toLocaleString("ro-RO")}
          </p>
          <p className="mt-2 text-sm opacity-90">
            din {soldPrincipal.drept_anual.toLocaleString("ro-RO")} · folosite{" "}
            {soldPrincipal.folosite.toLocaleString("ro-RO")}
            {soldPrincipal.in_asteptare > 0
              ? ` · în așteptare ${soldPrincipal.in_asteptare.toLocaleString("ro-RO")}`
              : null}
          </p>
        </section>
      )}

      {cereri.length === 0 ? null : (
        <section aria-labelledby="ultimele" className="space-y-2">
          <h2 id="ultimele" className="text-foreground text-sm font-semibold">
            Ultimele cereri
          </h2>
          <ul className="space-y-2">
            {cereri.map((c) => (
              <li key={c.id} className="bg-surface border-border rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      {tipuri.get(c.leave_type_id)?.denumire ?? "Concediu"}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {formatDate(c.data_inceput)} – {formatDate(c.data_sfarsit)}
                      {c.zile_lucratoare === null
                        ? null
                        : ` · ${c.zile_lucratoare.toLocaleString("ro-RO")} zile`}
                    </p>
                  </div>
                  <span className="border-border text-foreground shrink-0 rounded border px-2 py-0.5 text-xs">
                    {ETICHETE_STATUS_CERERE[c.status] ?? c.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {anunturiRecente.length === 0 ? null : (
        <section aria-labelledby="anunturi" className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 id="anunturi" className="text-foreground text-sm font-semibold">
              Anunțuri
            </h2>
            <Link
              href="/anunturi"
              className="text-primary text-xs underline-offset-2 hover:underline"
            >
              Toate
            </Link>
          </div>
          <ul className="space-y-2">
            {anunturiRecente.map((a) => {
              const necitit = !anunturiCitite.has(a.id);
              return (
                <li key={a.id}>
                  <Link
                    href={`/portal/anunturi/${a.id}`}
                    className="bg-surface border-border flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <span className="text-foreground text-sm font-medium">{a.titlu}</span>
                    {necitit ? (
                      <span
                        aria-label="Necitit"
                        className="bg-primary size-2 shrink-0 rounded-full"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <nav aria-label="Scurtături" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {moduleActive.has("leave") ? (
          <Scurtatura
            href="/portal/concediile-mele"
            eticheta="Concediile mele"
            descriere="Soldul și cererile"
            Iconita={CalendarDays}
          />
        ) : null}
        {moduleActive.has("attendance") ? (
          <Scurtatura
            href="/portal/pontajul-meu"
            eticheta="Pontajul meu"
            descriere="Orele lunii curente"
            Iconita={Clock}
          />
        ) : null}
        {moduleActive.has("payroll") ? (
          <Scurtatura
            href="/portal/salariul-meu"
            eticheta="Salariul meu"
            descriere="Ultimul fluturaș aprobat"
            Iconita={Wallet}
          />
        ) : null}
        <Scurtatura
          href="/portal/documentele-mele"
          eticheta="Documentele mele"
          descriere="Adeverințe și fișe"
          Iconita={FileText}
        />
      </nav>
    </div>
  );
}

function Scurtatura({
  href,
  eticheta,
  descriere,
  Iconita,
}: {
  readonly href: string;
  readonly eticheta: string;
  readonly descriere: string;
  readonly Iconita: typeof CalendarDays;
}) {
  return (
    <Link
      href={href}
      className="bg-surface border-border hover:border-ring flex min-h-16 items-center gap-3 rounded-lg border p-4 transition-colors"
    >
      <Iconita aria-hidden="true" className="text-primary size-5 shrink-0" />
      <span>
        <span className="text-foreground block text-sm font-medium">{eticheta}</span>
        <span className="text-muted-foreground block text-xs">{descriere}</span>
      </span>
    </Link>
  );
}

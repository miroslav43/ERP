// src/app/(portal)/portal/notificarile-mele/page.tsx
import type { Metadata } from "next";
import { Bell } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { listeazaNotificarile } from "@/lib/queries/notifications";
import { trimiteMarcheazaToateCitite } from "@/app/(app)/notificari/actions";
import { RandNotificare } from "@/app/(app)/notificari/rand-notificare";

import { caleaDePortal } from "./legaturi";

export const metadata: Metadata = { title: "Notificările mele" };

/**
 * Cutia poștală a angajatului.
 *
 * Fără gard de modul și fără verificare de permisiune, deliberat: notificările nu
 * aparțin niciunui modul, iar dreptul e „sunt ale tale" — impus de
 * `notifications_select (user_id = auth.uid())`. `listeazaNotificarile`
 * filtrează în plus explicit pe `user_id`, deci nici nu depinde de politică.
 *
 * Singura diferență reală față de ecranul din `(app)`: fiecare legătură trece
 * prin `caleaDePortal`. Triggerele din bază scriu rute de aplicație mare, iar un
 * angajat care le urmează brut e scos din portal de poarta de rol.
 */
export default async function PaginaNotificarileMele() {
  const { user, tenant } = await requireTenant();
  const notificari = await listeazaNotificarile(tenant.organizationId, user.id);
  const numarNecitite = notificari.filter((n) => n.read_at === null).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-foreground text-xl font-semibold">Notificările mele</h1>
          <p className="text-muted-foreground text-sm">
            {numarNecitite > 0
              ? `${numarNecitite.toLocaleString("ro-RO")} necitite din ${notificari.length.toLocaleString("ro-RO")}.`
              : "Sunteți la zi."}
          </p>
        </div>
        {numarNecitite > 0 ? (
          <form action={trimiteMarcheazaToateCitite}>
            <button
              type="submit"
              className="border-border hover:border-primary min-h-11 rounded-md border px-3 text-sm font-medium transition-colors"
            >
              Marchează tot ca citit
            </button>
          </form>
        ) : null}
      </header>

      {notificari.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nicio notificare"
          description="Aici apar răspunsurile la cererile dumneavoastră, anunțurile firmei și mementourile."
        />
      ) : (
        <ul className="divide-border border-border bg-surface divide-y rounded-lg border">
          {notificari.map((notificare) => (
            <li key={notificare.id}>
              <RandNotificare notificare={notificare} href={caleaDePortal(notificare.link)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

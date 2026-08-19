// src/app/(app)/notificari/page.tsx
import type { Metadata } from "next";
import { Bell } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { listeazaNotificarile } from "@/lib/queries/notifications";
import { trimiteMarcheazaToateCitite } from "./actions";
import { RandNotificare } from "./rand-notificare";

export const metadata: Metadata = { title: "Notificări" };

export default async function PaginaNotificari() {
  const { user, tenant } = await requireTenant();
  const notificari = await listeazaNotificarile(tenant.organizationId, user.id);
  const numarNecitite = notificari.filter((n) => n.read_at === null).length;

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notificări</h1>
          <p className="text-muted-foreground text-sm">
            {numarNecitite > 0
              ? `${numarNecitite} necitite din ${notificari.length}.`
              : "Toate notificările sunt citite."}
          </p>
        </div>
        {numarNecitite > 0 ? (
          <form action={trimiteMarcheazaToateCitite}>
            <button
              type="submit"
              className="border-border hover:border-primary rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
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
          description="Notificările despre aprobări, sarcini și anunțuri apar aici."
        />
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {notificari.map((notificare) => (
            <li key={notificare.id}>
              <RandNotificare notificare={notificare} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

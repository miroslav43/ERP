// src/app/(portal)/portal/notificarile-mele/page.tsx
import type { Metadata } from "next";
import { Bell } from "lucide-react";

import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
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
    <div className={`${LATIMI.lista} space-y-4 p-4`}>
      <AntetPagina
        titlu="Notificările mele"
        descriere={
          numarNecitite > 0
            ? `${numarNecitite.toLocaleString("ro-RO")} necitite din ${notificari.length.toLocaleString("ro-RO")}.`
            : "Sunteți la zi."
        }
        {...(numarNecitite > 0
          ? {
              actiuni: (
                <form action={trimiteMarcheazaToateCitite}>
                  <Buton type="submit" varianta="secundar">
                    Marchează tot ca citit
                  </Buton>
                </form>
              ),
            }
          : {})}
      />

      {notificari.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Bell}
          titlu="Nicio notificare"
          descriere="Aici apar răspunsurile la cererile dumneavoastră, anunțurile firmei și mementourile."
        />
      ) : (
        <ul className="divide-border border-border bg-surface rounded-panou divide-y border">
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

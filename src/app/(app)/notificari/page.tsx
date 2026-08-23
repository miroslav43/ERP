// src/app/(app)/notificari/page.tsx
import type { Metadata } from "next";
import { Bell } from "lucide-react";

import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
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
    <div className={`${LATIMI.formular} space-y-6`}>
      <AntetPagina
        titlu="Notificări"
        descriere={
          numarNecitite > 0
            ? `${numarNecitite} necitite din ${notificari.length}.`
            : "Toate notificările sunt citite."
        }
        {...(numarNecitite > 0
          ? {
              actiuni: (
                <form action={trimiteMarcheazaToateCitite}>
                  <Buton varianta="secundar" type="submit">
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
          descriere="Notificările despre aprobări, sarcini și anunțuri apar aici."
        />
      ) : (
        <ul className="divide-border border-border rounded-panou divide-y border">
          {notificari.map((notificare) => (
            <li key={notificare.id}>
              <RandNotificare notificare={notificare} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

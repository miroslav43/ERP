// src/app/(app)/notificari/page.tsx
import type { Metadata } from "next";
import { Bell } from "lucide-react";

import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import {
  LIMITA_LISTA_NOTIFICARI,
  listeazaNotificarile,
  numaraNecitite,
} from "@/lib/queries/notifications";
import { trimiteMarcheazaToateCitite } from "./actions";
import { RandNotificare } from "./rand-notificare";
import { ButonTrimite } from "@/components/incarcare/buton-trimite";
import Link from "next/link";

export const metadata: Metadata = { title: "Notificări" };

export default async function PaginaNotificari({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, tenant } = await requireTenant();
  const doarNecitite = (await searchParams)["doar"] === "necitite";
  // Numărul de necitite se NUMĂRĂ în bază, nu se deduce din lista afișată.
  // Lista se oprește la 100 de rânduri, deci la 150 de necitite antetul scria
  // „100 necitite din 100” în timp ce pastila din bara de sus — care folosea
  // dintotdeauna `numaraNecitite` — scria 150. Două cifre pentru același lucru,
  // pe același ecran, iar cea mai mică era cea liniștitoare.
  const [notificari, numarNecitite] = await Promise.all([
    listeazaNotificarile(tenant.organizationId, user.id, doarNecitite),
    numaraNecitite(tenant.organizationId, user.id),
  ]);
  const trunchiat = notificari.length >= LIMITA_LISTA_NOTIFICARI;

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <AntetPagina
        titlu="Notificări"
        descriere={
          numarNecitite > 0
            ? `${numarNecitite} ${numarNecitite === 1 ? "necitită" : "necitite"}.`
            : "Toate notificările sunt citite."
        }
        // Cifra din antet duce la rândurile numărate; „toate" readuce lista întreagă.
        file={
          numarNecitite > 0 || doarNecitite ? (
            <p className="text-nota flex flex-wrap gap-3">
              <Link
                href={doarNecitite ? "/notificari" : "/notificari?doar=necitite"}
                className="underline-offset-2 hover:underline"
              >
                {doarNecitite ? "Arată toate notificările" : "Doar necititele"}
              </Link>
            </p>
          ) : undefined
        }
        {...(numarNecitite > 0
          ? {
              actiuni: (
                <form action={trimiteMarcheazaToateCitite}>
                  <ButonTrimite varianta="secundar" textInCurs="Se marchează…">
                    Marchează tot ca citit
                  </ButonTrimite>
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
        <>
          <ul className="divide-border border-border rounded-panou divide-y border">
            {notificari.map((notificare) => (
              <li key={notificare.id}>
                <RandNotificare notificare={notificare} />
              </li>
            ))}
          </ul>
          {trunchiat ? (
            <p role="status" className="text-muted-foreground text-nota mt-3">
              Lista se oprește la cele mai recente {LIMITA_LISTA_NOTIFICARI} de notificări. Cele mai
              vechi nu apar aici, dar intră în numărătoarea de mai sus.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

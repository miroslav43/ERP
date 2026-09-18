// src/app/(app)/pontaj/setari/coduri-qr/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { Printer } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { StareGoala } from "@/components/ui/stare-goala";
import { clientEnv } from "@/config/env";
import { requireFeature } from "@/lib/auth/features";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { coduriQrDePontare } from "@/lib/queries/attendance";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { cn } from "@/lib/ui/cn";

import { NavSetariPontaj } from "../nav-setari";
import { ButonCodQr } from "./buton-cod";

export const metadata: Metadata = { title: "Coduri QR" };

/**
 * Codurile QR de pontare, la ele acasă.
 *
 * ── DE CE O FILĂ ÎN PONTAJ, DEȘI DATELE STAU ÎN `puncte_lucru` ────────────
 * Reclamația care a produs ecranul, în cuvintele omului: „dacă sunt în pontaj
 * și vreau să văd codul QR, nu am cum; e contraintuitiv să intru în puncte de
 * lucru pentru QR-ul de la pontaj". Avea dreptate, și nu pe jumătate: exista o
 * punte — secțiunea „Afișele de pontare" din fila „Pontarea" — dar ea nu arăta
 * niciun cod, ci doar dacă EXISTĂ unul, iar singurul drum spre codul însuși era
 * un link care te scotea în celălalt modul, la o pagină numită „afiș de
 * tipărit". Cine voia să se uite la cod trebuia să ceară o tipărire.
 *
 * Tabela rămâne a punctelor de lucru — nu se dublează nimic în bază. Se mută
 * doar locul din care te uiți: codul QR e un obiect al pontajului, iar punctul
 * de lucru e doar lucrul de care e legat.
 *
 * ── DE CE `departments:update`, ȘI NU `attendance:update` ────────────────
 * Aceeași poartă ca afișul (`puncte-lucru/[id]/afis`), din același motiv: pagina
 * arată codul, iar cine îl vede poate ponta de oriunde. E un secret operațional,
 * nu o listă. Poarta e a SECRETULUI, nu a modulului din care se întâmplă să fie
 * privit — altfel un rol care configurează pontajul fără drept pe structură ar
 * căpăta, prin fila asta, exact ce i s-a refuzat în cealaltă.
 *
 * Politica `puncte_lucru_select` cere doar `departments:read`, deci baza NU
 * verifică a doua oară. Verificarea de aici e singura; de asta stă înaintea
 * citirii, nu după.
 *
 * ── DE CE SVG PE SERVER ─────────────────────────────────────────────────
 * Codul se desenează aici și pleacă spre client ca poză, nu ca șir. Singurul
 * text care ajunge la client e adresa de sub cod — scrisă intenționat, ca
 * cineva să poată verifica unde duce înainte de a tipări cincizeci de foi.
 * Aceeași corecție de erori `H` ca pe afiș: codul rămâne citibil zgâriat sau
 * parțial acoperit.
 */
export default async function PaginaCoduriQr() {
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "attendance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  const poateVedea = can(permisiuni, "departments:update", "all");

  const antet = (
    <div className="space-y-2">
      <p className="text-muted-foreground text-corp">
        <Link href="/pontaj" className="underline-offset-2 hover:underline">
          Pontaj
        </Link>
      </p>
      <AntetPagina
        titlu="Coduri QR"
        descriere="Codul pe care angajații îl scanează la intrare, câte unul pentru fiecare punct de lucru."
        file={<NavSetariPontaj />}
      />
    </div>
  );

  if (!poateVedea) {
    return (
      <div className={cn(LATIMI.formular, "space-y-6")}>
        {antet}
        <AccesRestrictionat mesaj="Nu aveți dreptul de a vedea codurile de pontare. Ele se administrează împreună cu structura organizatorică." />
      </div>
    );
  }

  const puncte = await coduriQrDePontare(tenant.organizationId);

  // Un singur `await` pentru toate codurile: `QRCode.toString` e pur CPU, iar
  // înlănțuite ar fi însemnat N randări seriale pentru nimic.
  const desenate = await Promise.all(
    puncte.map(async (p) => ({
      ...p,
      url: p.cod === null ? null : `${clientEnv.NEXT_PUBLIC_APP_URL}/portal/ponteaza/${p.cod}`,
      svg:
        p.cod === null
          ? null
          : await QRCode.toString(`${clientEnv.NEXT_PUBLIC_APP_URL}/portal/ponteaza/${p.cod}`, {
              type: "svg",
              errorCorrectionLevel: "H",
              margin: 1,
              color: { dark: "#000000", light: "#ffffff" },
            }),
    })),
  );

  return (
    <div className={cn(LATIMI.formular, "space-y-6")}>
      {antet}

      <Callout fel="informativ">
        Codul e un secret: cine îl vede poate ponta de oriunde. Afișul se lipește la intrare, nu se
        trimite pe chat.
      </Callout>

      {desenate.length === 0 ? (
        <StareGoala
          fel="initiala"
          titlu="Firma n-are niciun punct de lucru"
          descriere="Codul de pontare aparține unui punct de lucru. Adăugați unul ca să puteți genera un cod."
          actiune={{ eticheta: "Puncte de lucru", href: "/puncte-lucru" }}
        />
      ) : (
        <ul className="space-y-4">
          {desenate.map((p) => (
            <li
              key={p.id}
              className="border-border bg-surface rounded-panou flex flex-wrap items-start gap-4 border p-4"
            >
              {/* `dangerouslySetInnerHTML` pe un SVG produs de `qrcode` din date
                  proprii: în el nu intră niciun text de utilizator, doar adresa
                  construită mai sus. Aceeași formă ca pe afiș. */}
              {p.svg === null ? (
                <span className="border-border text-muted-foreground text-nota flex size-28 shrink-0 items-center justify-center rounded border border-dashed text-center">
                  fără cod
                </span>
              ) : (
                <span
                  aria-label={`Cod QR pentru pontare la ${p.denumire}`}
                  className="size-28 shrink-0 [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: p.svg }}
                />
              )}

              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-corp font-medium">{p.denumire}</span>
                  {p.activ ? null : <Badge ton="neutru">Inactiv</Badge>}
                </span>
                {p.url === null ? (
                  <span className="text-muted-foreground text-nota block">
                    Nu se poate ponta prin acest punct de lucru până nu are un cod.
                  </span>
                ) : (
                  <span className="text-muted-foreground text-nota block break-all">{p.url}</span>
                )}
                {p.activ || p.url === null ? null : (
                  <span className="text-warning text-nota block">
                    Punctul e inactiv: codul rămâne valid, dar pontarea prin el va fi refuzată.
                  </span>
                )}
              </span>

              <span className="flex shrink-0 flex-wrap items-start gap-2">
                {p.url === null ? null : (
                  <Link
                    href={`/puncte-lucru/${p.id}/afis`}
                    className={buton({ varianta: "tertiar" })}
                  >
                    <Printer aria-hidden="true" className="size-3.5" />
                    Tipărește afișul
                  </Link>
                )}
                <ButonCodQr punctId={p.id} areCod={p.cod !== null} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// src/app/(app)/puncte-lucru/[id]/afis/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { Callout } from "@/components/ui/callout";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { clientEnv } from "@/config/env";

export const metadata: Metadata = { title: "Afiș de pontare" };

/**
 * Afișul care se tipărește și se lipește la intrarea în punctul de lucru.
 *
 * ── DE CE E O PAGINĂ, NU UN PDF ─────────────────────────────────────────────
 * Se tipărește din browser, cu Ctrl+P. Un generator de PDF ar fi un al doilea
 * lanț de randare pentru un afiș cu patru elemente, iar formatul hârtiei îl
 * alege oricum dialogul de tipărire.
 *
 * ── DE CE URL-UL E ABSOLUT ──────────────────────────────────────────────────
 * Codul QR se scanează cu aplicația de cameră a telefonului, care n-are niciun
 * context de origine — un `/portal/ponteaza/...` relativ n-ar duce nicăieri.
 * `NEXT_PUBLIC_APP_URL` se coace la BUILD, deci un afiș tipărit după o mutare de
 * domeniu fără rebuild ar trimite oamenii la vechea adresă. E scris și pe ecran,
 * sub cod, ca cineva să poată verifica înainte de a tipări cincizeci de foi.
 *
 * ── DE CE SVG, NU PNG ───────────────────────────────────────────────────────
 * Un QR tipărit trebuie să rămână citibil la orice dimensiune; un PNG de 200 px
 * mărit la o jumătate de pagină devine o pată. `qrcode` produce SVG direct, fără
 * fișiere temporare și fără canvas.
 *
 * Corecția de erori `H` (30%) e alegerea potrivită pentru hârtie lipită pe un
 * perete de hală: codul rămâne citibil zgâriat, murdar sau parțial acoperit.
 */
export default async function PaginaAfisPontare({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  // `departments:update`, nu `:read`: afișul poartă codul în clar, iar cine îl
  // vede poate ponta de oriunde. E un secret operațional, nu o listă.
  if (!can(permisiuni, "departments:update", "all")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a tipări afișul de pontare." />;
  }

  const db = await createServerSupabase();
  const { data: punct, error } = await db
    .from("puncte_lucru")
    .select("id, denumire, adresa, oras, judet, activ, cod_pontaj")
    .eq("id", id)
    .eq("organization_id", tenant.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  if (punct === null) notFound();

  if (punct.cod_pontaj === null) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <Callout fel="atentie" titlu="Punctul de lucru nu are încă un cod">
          Generați codul din lista de puncte de lucru, apoi reveniți aici ca să tipăriți afișul.
        </Callout>
      </div>
    );
  }

  const adresa = [punct.adresa, punct.oras, punct.judet].filter((v) => v !== null).join(", ");
  const url = `${clientEnv.NEXT_PUBLIC_APP_URL}/portal/ponteaza/${punct.cod_pontaj}`;
  const qr = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 1,
    // Alb pe negru curat: la tipărire, orice nuanță de gri din paleta aplicației
    // reduce contrastul exact acolo unde scanerul are nevoie de el.
    color: { dark: "#000000", light: "#ffffff" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      {/*
        `print:hidden` peste tot ce nu e afiș. Fără el, hârtia primește antetul
        aplicației, meniul și butonul de tipărire — iar afișul devine ilizibil de
        la trei metri, adică exact distanța de la care e citit.
      */}
      {!punct.activ ? (
        <Callout fel="atentie" titlu="Punct de lucru inactiv" className="print:hidden">
          Codul rămâne valid, dar punctul e marcat inactiv, iar pontarea prin el va fi refuzată.
        </Callout>
      ) : null}

      <div className="border-border rounded-panou space-y-6 border bg-white p-8 text-center text-black print:border-0 print:p-0">
        <div>
          <p className="text-2xl font-semibold">Pontare</p>
          <p className="mt-1 text-lg">{punct.denumire}</p>
          {adresa === "" ? null : <p className="text-sm opacity-70">{adresa}</p>}
        </div>

        {/* `dangerouslySetInnerHTML` pe un SVG generat de `qrcode` din date proprii:
            nu intră niciun text de utilizator în el, doar URL-ul construit aici. */}
        <div
          aria-label={`Cod QR pentru pontare la ${punct.denumire}`}
          className="mx-auto w-full max-w-sm [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qr }}
        />

        <div className="space-y-1">
          <p className="text-lg font-medium">Scanați codul cu telefonul</p>
          <p className="text-sm">
            Deschideți camera, îndreptați-o spre cod și apăsați linkul care apare.
          </p>
        </div>
      </div>

      <div className="text-muted-foreground text-corp space-y-2 print:hidden">
        <p>
          Tipăriți pagina cu <kbd className="border-border rounded border px-1">Ctrl</kbd>+
          <kbd className="border-border rounded border px-1">P</kbd> și lipiți afișul la intrare.
        </p>
        <p>
          Codul duce la: <span className="text-foreground break-all">{url}</span>
        </p>
        <p>
          Rotirea codului din lista de puncte de lucru invalidează afișele deja tipărite. Faceți-o
          dacă bănuiți că fotografia afișului a ieșit din firmă.
        </p>
      </div>
    </div>
  );
}

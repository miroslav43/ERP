// src/app/(portal)/portal/instalare/page.tsx
import type { Metadata } from "next";
import { Apple, Smartphone } from "lucide-react";
import type { ReactNode } from "react";

import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Callout } from "@/components/ui/callout";

export const metadata: Metadata = { title: "Instalați aplicația" };

/**
 * Cum ajunge aplicația pe ecranul de start al telefonului.
 *
 * ── DE CE E NEVOIE DE UN ECRAN, NU DE UN BUTON ──────────────────────────────
 * Pe Android există un eveniment (`beforeinstallprompt`) și se poate pune un
 * buton — dar Chrome îl emite abia după un prag de angajament (cel puțin o
 * atingere și ~30 de secunde pe pagină), deci pentru cine intră și apasă imediat
 * poate să nu apară niciodată. Pe iOS nu există NICIUN eveniment de instalare:
 * singurul drum e meniul de partajare al Safari-ului. Fără instrucțiune scrisă,
 * nimeni nu-l găsește.
 *
 * ── ORDINEA PE IPHONE NU E UN DETALIU ───────────────────────────────────────
 * O aplicație de pe ecranul de start are pe iOS depozit de cookie-uri SEPARAT de
 * Safari. Din Safari 17.2 (dec. 2023), cookie-urile se COPIAZĂ în momentul
 * adăugării — dar numai cele puse de server, nu și `localStorage`. Proiectul
 * îndeplinește exact condiția: portalul nu instanțiază niciodată clientul de
 * browser Supabase, iar singurul `document.cookie` scris de aplicație e lățimea
 * sidebar-ului. Deci: autentificat ÎNAINTE de adăugare → aplicația pornește
 * logată. Adăugată înainte de autentificare → cere parola din nou.
 *
 * ── DE CE NU SCRIE „DECONECTAȚI-VĂ DIN SAFARI DUPĂ" ─────────────────────────
 * Ar fi un sfat prost. Cookie-ul copiat înseamnă ACELAȘI refresh token, deci
 * aceeași sesiune: o deconectare din Safari, chiar și cu `scope: "local"`, o
 * revocă și pentru aplicație. Ce se poate spune onest e mai jos, în avertisment.
 *
 * Pagina nu verifică nimic: învelișul portalului a făcut deja autentificarea și
 * poarta de rol, iar aici nu se citește niciun rând din bază.
 */
export default function PaginaInstalare() {
  return (
    <div className={`${LATIMI.formular} space-y-5 p-4`}>
      <AntetPagina
        titlu="Instalați aplicația"
        descriere="Aceeași aplicație pe care o folosiți acum, salvată cu iconiță pe ecranul telefonului. Nu se descarcă din niciun magazin și nu ocupă spațiu."
      />

      <Pas
        Pictograma={Apple}
        titlu="Pe iPhone și iPad"
        nota="Funcționează doar din Safari. Chrome și Firefox pe iPhone nu pot adăuga aplicații pe ecranul de start."
        pasi={[
          "Rămâneți autentificat aici, în Safari. Nu vă deconectați.",
          "Apăsați butonul de partajare — pătratul cu săgeata în sus, din bara de jos.",
          "Derulați și alegeți „Adaugă pe ecranul principal” („Add to Home Screen”).",
          "Apăsați „Adaugă”. Iconița apare pe ecranul de start.",
        ]}
      >
        <Callout fel="atentie" titlu="Ordinea contează">
          Autentificați-vă <strong>înainte</strong> de a adăuga iconița. iPhone-ul copiază starea de
          autentificare în aplicație doar în momentul adăugării — dacă adăugați întâi și vă
          autentificați după, aplicația vă va cere parola separat.
        </Callout>
      </Pas>

      <Pas
        Pictograma={Smartphone}
        titlu="Pe Android (Samsung, Xiaomi, Motorola)"
        nota="Din Chrome. Pe Samsung Internet, pașii sunt aceiași, dar opțiunea se numește „Adaugă pagina la”."
        pasi={[
          "Apăsați meniul cu trei puncte, din colțul din dreapta sus.",
          "Alegeți „Instalează aplicația” sau „Adaugă la ecranul de pornire”.",
          "Confirmați. Iconița apare pe ecranul de start.",
        ]}
      >
        <p className="text-muted-foreground text-corp">
          Dacă opțiunea nu apare din prima, mai navigați câteva secunde prin aplicație și încercați
          din nou: Chrome o arată abia după ce recunoaște că folosiți efectiv aplicația.
        </p>
      </Pas>

      <section className="border-border bg-surface rounded-panou space-y-2 border p-4">
        <h2 className="text-foreground text-corp font-semibold">După instalare</h2>
        <ul className="text-muted-foreground text-corp list-disc space-y-1 pl-5">
          <li>
            Aplicația se deschide fără bara de adrese și vă duce direct în portal, la pontaj și
            concedii.
          </li>
          <li>Rămâneți autentificat. Nu vi se va cere parola la fiecare deschidere.</li>
          <li>
            <strong>Aveți nevoie de internet.</strong> Aplicația nu funcționează fără semnal — nu e
            o copie a datelor pe telefon, e chiar aplicația.
          </li>
          <li>
            Pe iPhone, folosiți de acum iconița, nu Safari. Dacă intrați alternativ din amândouă, se
            poate întâmpla să vi se ceară parola din nou în ambele — e o particularitate a modului
            în care iPhone-ul separă aplicațiile de browser, nu o defecțiune.
          </li>
        </ul>
      </section>
    </div>
  );
}

/** O secțiune de instrucțiuni: pictogramă, titlu, pași numerotați, o notă. */
function Pas({
  Pictograma,
  titlu,
  nota,
  pasi,
  children,
}: {
  readonly Pictograma: typeof Apple;
  readonly titlu: string;
  readonly nota: string;
  readonly pasi: readonly string[];
  readonly children: ReactNode;
}) {
  return (
    <section className="border-border bg-surface rounded-panou space-y-3 border p-4">
      <div className="flex items-center gap-2">
        <Pictograma aria-hidden="true" className="text-primary size-5 shrink-0" />
        <h2 className="text-foreground text-corp font-semibold">{titlu}</h2>
      </div>
      {/* Lista numerotată e semantică, nu decorativă: cititorul de ecran anunță
          „1 din 4”, iar ordinea chiar contează pe iPhone. */}
      <ol className="text-foreground text-corp list-decimal space-y-2 pl-5">
        {pasi.map((pas) => (
          <li key={pas}>{pas}</li>
        ))}
      </ol>
      <p className="text-muted-foreground text-nota">{nota}</p>
      {children}
    </section>
  );
}

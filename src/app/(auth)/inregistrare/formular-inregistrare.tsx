"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { cn } from "@/lib/ui/cn";

import { inregistreazaFirma } from "./actions";
import { eroriPeCamp, schemaInregistrare } from "./schema";

/**
 * Formularul de înregistrare.
 *
 * ── DE CE `Formular` + `Camp` DIN `components/ui` ─────────────────────────
 * Până pe 12 oct 2026 stătea pe `useTransition` + `<form action>`, cu un `Camp`
 * privat, pe motivul (greșit) că `Formular` ar afișa o notificare într-o zonă
 * fără `ZonaToast`. `Formular` cheamă `arataToast` DOAR când primește
 * `mesajReusita` (`formular.tsx`), iar aici nu primește. Ce dădea tiparul vechi
 * erau exact cele trei defecte din auditul QA: validare doar pe server, deci
 * fiecare greșeală de tastare ardea un slot din 3/oră (ONB-001); resetul
 * React 19 al formularului la orice eroare, inclusiv bifa (ONB-002); baloanele
 * native ale browserului, în limba browserului (ONB-003).
 *
 * `Formular` le rezolvă pe toate trei o singură dată, pentru toate ecranele:
 * `noValidate`, erorile pe câmp prin `Camp` (`aria-invalid` + `aria-describedby`
 * prin construcție), `valoriTrimise` înapoi ca `defaultValue`, focus pe primul
 * câmp invalid.
 *
 * ── DE CE VALIDAREA DE CLIENT RULEAZĂ ACEEAȘI SCHEMĂ ──────────────────────
 * `trimite` rulează `schemaInregistrare.safeParse` ÎNAINTE de Server Action și
 * întoarce un `ActionResult` de validare cu `eroriPeCamp` — aceleași șase linii
 * ca pe server, deci aceleași mesaje, fără un geamăn care să divergă tăcut
 * (`cere-demo/campuri.ts` există doar pentru bundle-ul paginii de start; pagina
 * asta nu e pe calea aceea). Serverul re-parsează oricum: clientul e confort,
 * autoritatea rămâne acolo.
 *
 * ── DE CE ECRANUL DE CONFIRMARE ÎNLOCUIEȘTE FORMULARUL ────────────────────
 * După reușită nu se navighează nicăieri. Pasul următor nu e pe sit, e în
 * căsuța de e-mail, iar un redirect ar sugera contrariul. Formularul dispare ca
 * să nu poată fi trimis a doua oară: a doua încercare ar cădea pe CUI deja
 * înregistrat, adică pe un mesaj de eroare pentru ceva ce tocmai a mers.
 * `laReusita` semnalează voalul până la unmount — o singură randare, sub
 * `PRAG_VOAL`, deci invizibil; același drum îl face `FormularDialog` când
 * închide caseta.
 */
type Rezultat = Awaited<ReturnType<typeof inregistreazaFirma>>;
type DateReusita = Extract<Rezultat, { ok: true }>["data"];

/**
 * Obiectul trimis acțiunii — cheile sunt EXACT cele din `schemaInregistrare`.
 * `FormData` dă „on" pentru o bifă apăsată și NIMIC pentru una liberă; schema
 * cere `true` literal, deci conversia se face aici, altfel mesajul de eroare ar
 * vorbi despre tipuri, nu despre accept.
 */
function citesteValori(date: FormData, sursa: string | null) {
  const text = (nume: string): string => String(date.get(nume) ?? "");
  return {
    firma: text("firma"),
    cui: text("cui"),
    prenume: text("prenume"),
    nume: text("nume"),
    email: text("email"),
    telefon: text("telefon"),
    acceptTermeni: date.get("acceptTermeni") === "on",
    // Unealta din care a venit, citită pe server din UTM; nu e un câmp.
    sursa,
  };
}

/*
 * Deliberat redundant cu regula `[data-zona]` din `globals.css`: sub 16px, iOS
 * Safari mărește pagina la fiecare atingere într-un câmp. Vezi `(auth)/layout.tsx`.
 */
const CLASA_TACTIL = "pointer-coarse:text-sectiune";
const ID_EROARE_BIFA = "camp-acceptTermeni-eroare";

export function FormularInregistrare({ sursa = null }: Readonly<{ sursa?: string | null }>) {
  const [trimisLa, setTrimisLa] = useState<string | null>(null);

  const trimite = useCallback(
    async (date: FormData): Promise<Rezultat> => {
      const valori = citesteValori(date, sursa);
      const parsat = schemaInregistrare.safeParse(valori);
      if (!parsat.success) {
        // Niciun apel la server: nici cerere, nici slot de rată consumat.
        return {
          ok: false,
          error: {
            code: "VALIDARE",
            message: "Datele introduse nu sunt valide.",
            fieldErrors: eroriPeCamp(parsat.error),
            requestId: "validare-client",
          },
        };
      }
      return inregistreazaFirma(valori);
    },
    [sursa],
  );

  // Stabil între randări: `laReusita` intră în dependențele efectului din
  // `Formular`, iar o funcție nouă la fiecare randare l-ar reporni.
  const laReusita = useCallback((date: DateReusita) => {
    setTrimisLa(date.email);
  }, []);

  if (trimisLa !== null) {
    return (
      <div role="status">
        <h1 className="text-primary text-sectiune font-semibold">Contul e creat</h1>
        <p className="text-corp mt-3 leading-relaxed">
          V-am trimis un e-mail la <strong className="font-medium">{trimisLa}</strong>, cu linkul
          prin care intrați prima dată. Linkul e valabil șapte zile.
        </p>
        <p className="text-muted-foreground text-corp mt-3 leading-relaxed">
          Nu ajunge? Verificați și în spam. Dacă tot nu apare în câteva minute, scrieți-ne și îl
          retrimitem — adresa e în subsolul paginii de start.
        </p>
        <p className="text-corp mt-6">
          <Link href="/" className="text-muted-foreground rounded underline">
            Înapoi la pagina de start
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-primary text-sectiune font-semibold">Creează contul firmei</h1>
      <p className="text-muted-foreground text-corp mt-1">
        Șase câmpuri. Restul datelor firmei le completați înăuntru, când aveți timp.
      </p>

      <Formular actiune={trimite} laReusita={laReusita} className="mt-6">
        {({ erori, inCurs, valoriTrimise }) => {
          const eroareBifa = erori["acceptTermeni"]?.[0];
          return (
            <>
              <Camp
                nume="firma"
                eticheta="Denumirea firmei"
                obligatoriu
                erori={erori["firma"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="text"
                    autoComplete="organization"
                    defaultValue={valoriTrimise["firma"] ?? ""}
                    className={cn(a.className, CLASA_TACTIL)}
                  />
                )}
              </Camp>
              <Camp
                nume="cui"
                eticheta="CUI"
                ajutor="Doar cifrele, cu sau fără RO."
                obligatoriu
                erori={erori["cui"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="text"
                    inputMode="numeric"
                    defaultValue={valoriTrimise["cui"] ?? ""}
                    className={cn(a.className, CLASA_TACTIL)}
                  />
                )}
              </Camp>
              <div className="grid gap-4 sm:grid-cols-2">
                <Camp nume="prenume" eticheta="Prenume" obligatoriu erori={erori["prenume"] ?? []}>
                  {(a) => (
                    <input
                      {...a}
                      type="text"
                      autoComplete="given-name"
                      defaultValue={valoriTrimise["prenume"] ?? ""}
                      className={cn(a.className, CLASA_TACTIL)}
                    />
                  )}
                </Camp>
                <Camp nume="nume" eticheta="Nume" obligatoriu erori={erori["nume"] ?? []}>
                  {(a) => (
                    <input
                      {...a}
                      type="text"
                      autoComplete="family-name"
                      defaultValue={valoriTrimise["nume"] ?? ""}
                      className={cn(a.className, CLASA_TACTIL)}
                    />
                  )}
                </Camp>
              </div>
              <Camp
                nume="email"
                eticheta="Adresa dumneavoastră de e-mail"
                ajutor="Aici primiți linkul de acces."
                obligatoriu
                erori={erori["email"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    defaultValue={valoriTrimise["email"] ?? ""}
                    className={cn(a.className, CLASA_TACTIL)}
                  />
                )}
              </Camp>
              <Camp
                nume="telefon"
                eticheta="Telefon"
                ajutor="Opțional."
                erori={erori["telefon"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    defaultValue={valoriTrimise["telefon"] ?? ""}
                    className={cn(a.className, CLASA_TACTIL)}
                  />
                )}
              </Camp>

              {/*
                Bifa nu trece prin `Camp` (eticheta ei e o propoziție cu două
                linkuri, nu un titlu deasupra), dar respectă aceeași legătură:
                `aria-invalid` + `aria-describedby` către mesajul de sub ea.
                `required` rămâne pentru semantică; cu `noValidate` nu blochează
                nimic — apărarea e `z.literal(true)` din schemă.
              */}
              <div className="flex flex-col gap-1.5">
                <label className="text-corp flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    name="acceptTermeni"
                    required
                    defaultChecked={valoriTrimise["acceptTermeni"] === "on"}
                    aria-invalid={eroareBifa === undefined ? undefined : true}
                    aria-describedby={eroareBifa === undefined ? undefined : ID_EROARE_BIFA}
                    className={cn(clasaBifa, "mt-0.5")}
                  />
                  <span>
                    Am citit și accept{" "}
                    <Link href="/legal/termeni" className="underline underline-offset-2">
                      termenii și condițiile
                    </Link>{" "}
                    și{" "}
                    <Link href="/legal/confidentialitate" className="underline underline-offset-2">
                      politica de confidențialitate
                    </Link>
                    .
                  </span>
                </label>
                {eroareBifa !== undefined && (
                  <p id={ID_EROARE_BIFA} role="alert" className="text-danger text-nota">
                    {eroareBifa}
                  </p>
                )}
              </div>

              {/*
                Marchează TRIMITEREA, nu reușita: evenimentul pleacă la clic, iar
                rezultatul se vede din numărul de organizații create. Diferența
                dintre cele două cifre e chiar rata de eșec a formularului — CUI
                duplicat, validare picată — care altfel n-ar fi vizibilă nicăieri.
                Validarea de client oprește acum cererea, nu și evenimentul.
              */}
              <Buton
                type="submit"
                varianta="primar"
                data-umami-event="inregistrare-trimisa"
                inCurs={inCurs}
                textInCurs="Se creează…"
                className="mt-2"
              >
                Creează contul
              </Buton>
            </>
          );
        }}
      </Formular>

      {/* Cele două drumuri care pleacă de aici. `/cere-demo` a ieșit din erou
          odată cu trecerea la înregistrare self-serve; fără linkul ăsta, ar fi
          rămas o pagină fără nicio intrare. */}
      <p className="text-muted-foreground text-corp mt-6">
        Aveți deja cont?{" "}
        <Link href="/autentificare" className="rounded underline">
          Autentifică-te
        </Link>
      </p>
      <p className="text-muted-foreground text-corp mt-2">
        Preferi să vorbești cu cineva întâi?{" "}
        <Link href="/cere-demo" className="rounded underline">
          Cere o demonstrație
        </Link>
      </p>
    </>
  );
}

"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";

import { inregistreazaFirma } from "./actions";

/**
 * Formularul de înregistrare.
 *
 * ── DE CE `useTransition`, ȘI NU COMPONENTA `Formular` ────────────────────
 * `components/ui/formular.tsx` desface `ActionResult` și distribuie erorile
 * singură, dar afișează și o notificare prin `arataToast` — iar zona de
 * notificări NU e montată în `(auth)`. Aici e tiparul implicit al proiectului:
 * `useTransition` + `FormData` + `useId`.
 *
 * ── DE CE ECRANUL DE CONFIRMARE ÎNLOCUIEȘTE FORMULARUL ────────────────────
 * După reușită nu se navighează nicăieri. Pasul următor nu e pe sit, e în
 * căsuța de e-mail, iar un redirect ar sugera contrariul. Formularul dispare ca
 * să nu poată fi trimis a doua oară: a doua încercare ar cădea pe CUI deja
 * înregistrat, adică pe un mesaj de eroare pentru ceva ce tocmai a mers.
 */
const CLASA_CAMP =
  "border-border bg-background focus:border-ring rounded-control text-corp pointer-coarse:text-sectiune w-full border px-3 py-2";

type Erori = Readonly<Record<string, readonly string[]>>;

export function FormularInregistrare() {
  const idForm = useId();
  const [inCurs, porneste] = useTransition();
  const [erori, setErori] = useState<Erori>({});
  const [eroareGenerala, setEroareGenerala] = useState<string | null>(null);
  const [trimisLa, setTrimisLa] = useState<string | null>(null);

  function trimite(date: FormData) {
    porneste(async () => {
      setErori({});
      setEroareGenerala(null);

      const rezultat = await inregistreazaFirma({
        firma: date.get("firma"),
        cui: date.get("cui"),
        prenume: date.get("prenume"),
        nume: date.get("nume"),
        email: date.get("email"),
        telefon: date.get("telefon") ?? "",
        // `FormData` dă „on" pentru o bifă apăsată și NIMIC pentru una liberă.
        // Schema cere `true` literal, deci conversia se face aici — altfel
        // mesajul de eroare ar vorbi despre tipuri, nu despre accept.
        acceptTermeni: date.get("acceptTermeni") === "on",
      });

      if (rezultat.ok) {
        setTrimisLa(rezultat.data.email);
        return;
      }
      setErori(rezultat.error.fieldErrors ?? {});
      setEroareGenerala(rezultat.error.message);
    });
  }

  if (trimisLa !== null) {
    return (
      <div role="status">
        <h1 className="text-primary text-sectiune font-semibold">Contul e creat</h1>
        <p className="text-corp mt-3 leading-relaxed">
          Ți-am trimis un e-mail la <strong className="font-medium">{trimisLa}</strong>, cu linkul
          prin care intri prima dată. Linkul e valabil șapte zile.
        </p>
        <p className="text-muted-foreground text-corp mt-3 leading-relaxed">
          Nu ajunge? Verifică și în spam. Dacă tot nu apare în câteva minute, scrie-ne și îl
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
        Șase câmpuri. Restul datelor firmei le completezi înăuntru, când ai timp.
      </p>

      {eroareGenerala !== null && (
        <p
          role="alert"
          className="text-danger border-danger/40 bg-danger/5 rounded-control text-corp mt-4 border px-3 py-2"
        >
          {eroareGenerala}
        </p>
      )}

      <form id={idForm} action={trimite} className="mt-6 flex flex-col gap-4">
        <Camp
          nume="firma"
          eticheta="Denumirea firmei"
          autoComplete="organization"
          erori={erori.firma}
          idForm={idForm}
        />
        <Camp
          nume="cui"
          eticheta="CUI"
          indiciu="Doar cifrele, cu sau fără RO."
          inputMode="numeric"
          erori={erori.cui}
          idForm={idForm}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="prenume"
            eticheta="Prenume"
            autoComplete="given-name"
            erori={erori.prenume}
            idForm={idForm}
          />
          <Camp
            nume="nume"
            eticheta="Nume"
            autoComplete="family-name"
            erori={erori.nume}
            idForm={idForm}
          />
        </div>
        <Camp
          nume="email"
          eticheta="Adresa ta de e-mail"
          indiciu="Aici primești linkul de acces."
          type="email"
          autoComplete="email"
          erori={erori.email}
          idForm={idForm}
        />
        <Camp
          nume="telefon"
          eticheta="Telefon"
          indiciu="Opțional."
          type="tel"
          autoComplete="tel"
          obligatoriu={false}
          erori={erori.telefon}
          idForm={idForm}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-corp flex items-start gap-2.5">
            <input
              type="checkbox"
              name="acceptTermeni"
              className="border-border rounded-control mt-0.5 size-4 shrink-0 border"
              aria-describedby={
                erori.acceptTermeni === undefined ? undefined : `${idForm}-acceptTermeni-eroare`
              }
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
          {erori.acceptTermeni !== undefined && (
            <p id={`${idForm}-acceptTermeni-eroare`} className="text-danger text-nota">
              {erori.acceptTermeni[0]}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={inCurs}
          className="bg-primary text-primary-foreground rounded-control text-corp mt-2 inline-flex h-11 items-center justify-center px-5 font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {inCurs ? "Se creează…" : "Creează contul"}
        </button>
      </form>

      {/* Cele două drumuri care pleacă de aici. `/cere-demo` a ieșit din erou
          odată cu trecerea la înregistrare self-serve; fără linkul ăsta, ar fi
          rămas o pagină fără nicio intrare. */}
      <p className="text-muted-foreground text-corp mt-6">
        Ai deja cont?{" "}
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

/** Un câmp cu eticheta, indiciul și eroarea lui, legate prin `aria-describedby`. */
function Camp({
  nume,
  eticheta,
  indiciu,
  erori,
  idForm,
  obligatoriu = true,
  type = "text",
  autoComplete,
  inputMode,
}: Readonly<{
  nume: string;
  eticheta: string;
  /*
   * `| undefined` explicit pe fiecare opțional, nu doar `?`.
   *
   * `exactOptionalPropertyTypes: true` face din cele două lucruri DIFERITE: `?`
   * înseamnă „proprietatea poate lipsi", nu „poate fi `undefined`". Iar
   * `erori.firma` chiar poate fi `undefined` — e citirea unei chei dintr-un
   * `Record`. Fără uniune, fiecare apel de mai sus cădea la `tsc`.
   */
  indiciu?: string | undefined;
  erori?: readonly string[] | undefined;
  idForm: string;
  obligatoriu?: boolean | undefined;
  type?: string | undefined;
  autoComplete?: string | undefined;
  inputMode?: "numeric" | "text" | undefined;
}>) {
  const idCamp = `${idForm}-${nume}`;
  const idIndiciu = indiciu === undefined ? null : `${idCamp}-indiciu`;
  const idEroare = erori === undefined ? null : `${idCamp}-eroare`;
  const descrieri = [idIndiciu, idEroare].filter((x): x is string => x !== null).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idCamp} className="text-corp font-medium">
        {eticheta}
      </label>
      {indiciu !== undefined && (
        <p id={idIndiciu ?? undefined} className="text-muted-foreground text-nota">
          {indiciu}
        </p>
      )}
      <input
        id={idCamp}
        name={nume}
        type={type}
        {...(autoComplete === undefined ? {} : { autoComplete })}
        {...(inputMode === undefined ? {} : { inputMode })}
        required={obligatoriu}
        aria-invalid={erori === undefined ? undefined : true}
        aria-describedby={descrieri === "" ? undefined : descrieri}
        className={CLASA_CAMP}
      />
      {erori !== undefined && (
        <p id={idEroare ?? undefined} className="text-danger text-nota">
          {erori[0]}
        </p>
      )}
    </div>
  );
}

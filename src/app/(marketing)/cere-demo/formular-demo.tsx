// src/app/(marketing)/cere-demo/formular-demo.tsx
"use client";

import { useId, useState, useTransition, type FocusEvent, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { trimiteCerereDemo } from "./actions";
// `./campuri`, NU `./schema`: schema aduce Zod, iar formularul stă pe pagina de
// start. Validarea de aici e de confort; autoritatea e schema din acțiune.
import {
  BENZI_ANGAJATI,
  CAMPURI_CERE_DEMO,
  ETICHETE_BANDA,
  ETICHETE_BANDA_EN,
  MESAJE_EN,
  MESAJE_RO,
  valideazaCerereDemo,
  type BandaAngajati,
  type CereDemoInput,
  type EroriCereDemo,
} from "./campuri";

const BANDA_IMPLICITA: BandaAngajati = "10-49";

/** Valorile din formular, curățate de spațiile de la capete. */
function citesteValori(form: HTMLFormElement): CereDemoInput {
  const date = new FormData(form);
  const text = (nume: keyof CereDemoInput) => {
    const valoare = date.get(nume);
    return typeof valoare === "string" ? valoare.trim() : "";
  };
  const banda = text("nrAngajati");
  return {
    nume: text("nume"),
    firma: text("firma"),
    email: text("email"),
    telefon: text("telefon"),
    nrAngajati: (BENZI_ANGAJATI as readonly string[]).includes(banda)
      ? (banda as BandaAngajati)
      : BANDA_IMPLICITA,
    mesaj: text("mesaj"),
  };
}

/**
 * UN SINGUR formular pe acest punct de intrare.
 *
 * Banda de contact a landing-ului și pagina `/cere-demo` folosesc aceeași
 * componentă, aceeași schemă și aceeași Server Action — deci același rate limit
 * de trei cereri pe oră și aceeași restricție de unicitate pe e-mail și zi. Un
 * al doilea formular „doar pentru landing" ar fi însemnat două contracte care
 * divergeau tăcut la prima modificare.
 *
 * Câmpurile trăiesc exclusiv pe hârtie, niciodată pe cerneală: `:root` are
 * `color-scheme: light`, iar un `<select>` nativ pe fundal închis s-ar desena
 * cu culorile sistemului de operare.
 */
const CLASA_CAMP =
  "w-full rounded border border-mk-rigla bg-mk-hartie px-3 text-base text-mk-text transition-colors hover:border-mk-text placeholder:text-mk-text-slab aria-invalid:border-mk-refuz";
const CLASA_INPUT = `h-11 ${CLASA_CAMP}`;
const CLASA_ETICHETA = "mb-1.5 block text-[0.9375rem] font-medium";
const CLASA_EROARE = "text-mk-refuz mt-1.5 text-[0.8125rem]";

const TEXTE = {
  ro: {
    nume: "Nume și prenume",
    firma: "Denumirea firmei",
    email: "E-mail de contact",
    telefon: "Telefon",
    optional: "(opțional)",
    angajati: "Număr de angajați",
    mesaj: "Ce ai vrea să rezolvi",
    trimite: "Trimite cererea",
    seTrimite: "Se trimite…",
    succesTitlu: "Am primit cererea ta",
    succesText:
      "Îți răspundem pe e-mail în cel mult o zi lucrătoare. Dacă între timp vrei să adaugi ceva, poți răspunde direct la mesajul nostru.",
    inapoi: "Înapoi la pagina principală",
    acasa: "/",
    gdprInainte:
      "Prin trimiterea formularului ești de acord ca datele să fie folosite pentru a te contacta în legătură cu această cerere. Detalii în ",
    gdprLegatura: "politica de confidențialitate",
  },
  en: {
    nume: "Full name",
    firma: "Company name",
    email: "Contact e-mail",
    telefon: "Phone",
    optional: "(optional)",
    angajati: "Number of employees",
    mesaj: "What would you like to solve",
    trimite: "Send the request",
    seTrimite: "Sending…",
    succesTitlu: "We have your request",
    succesText:
      "We reply by e-mail within one working day at most. If you want to add something in the meantime, just reply to our message.",
    inapoi: "Back to the home page",
    acasa: "/en",
    gdprInainte:
      "By sending this form you agree that your details will be used to contact you about this request. Details in the ",
    gdprLegatura: "privacy policy",
  },
} as const;

export function FormularDemo({ limba = "ro" }: { limba?: "ro" | "en" }) {
  const idFormular = useId();
  const [inCurs, startTransition] = useTransition();
  const [trimis, setTrimis] = useState(false);
  const [eroareGenerala, setEroareGenerala] = useState<string | null>(null);

  const [erori, setErori] = useState<EroriCereDemo>({});

  const t = TEXTE[limba];
  const benzi = limba === "ro" ? ETICHETE_BANDA : ETICHETE_BANDA_EN;
  const mesaje = limba === "ro" ? MESAJE_RO : MESAJE_EN;

  /**
   * Validarea la ieșirea din câmp, ca înainte (`mode: "onBlur"`): doar câmpul
   * părăsit își schimbă mesajul, ca omul să nu vadă erori la câmpuri pe care
   * încă nu le-a atins.
   */
  const laIesire =
    (camp: keyof CereDemoInput) =>
    (eveniment: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const formular = eveniment.currentTarget.form;
      if (formular === null) return;
      const mesaj = valideazaCerereDemo(citesteValori(formular), mesaje)[camp];
      setErori((vechi) => ({ ...vechi, [camp]: mesaj }));
    };

  const trimite = (eveniment: FormEvent<HTMLFormElement>) => {
    eveniment.preventDefault();
    const formular = eveniment.currentTarget;
    const valori = citesteValori(formular);
    const gasite = valideazaCerereDemo(valori, mesaje);
    setErori(gasite);
    setEroareGenerala(null);

    const primul = CAMPURI_CERE_DEMO.find((camp) => gasite[camp] !== undefined);
    if (primul !== undefined) {
      formular.querySelector<HTMLElement>(`[name="${primul}"]`)?.focus();
      return;
    }

    startTransition(async () => {
      const rezultat = await trimiteCerereDemo(valori);
      if (rezultat.ok) {
        setTrimis(true);
        return;
      }
      // Serverul validează cu schema Zod și răspunde în română. Câmpurile
      // respinse primesc mesajul în limba paginii; textul serverului rămâne
      // rezerva, pentru o regulă pe care clientul n-o cunoaște.
      const respinse = rezultat.error.fieldErrors;
      if (respinse) {
        const locale = valideazaCerereDemo(valori, mesaje);
        const deLaServer: EroriCereDemo = {};
        for (const camp of CAMPURI_CERE_DEMO) {
          const mesajServer = respinse[camp]?.[0];
          if (mesajServer) deLaServer[camp] = locale[camp] ?? mesajServer;
        }
        setErori(deLaServer);
      }
      setEroareGenerala(rezultat.error.message);
    });
  };

  if (trimis) {
    return (
      <div role="status" aria-live="polite" className="border-mk-rigla rounded border p-8">
        <CheckCircle2 className="text-mk-co h-6 w-6" aria-hidden="true" />
        <h2 className="font-mk-display mt-4 text-[1.375rem] font-semibold tracking-[-0.01em]">
          {t.succesTitlu}
        </h2>
        <p className="text-mk-text-slab mt-3 text-[0.9375rem] leading-[1.6]">{t.succesText}</p>
        <Link
          href={t.acasa}
          className="border-mk-rigla hover:border-mk-text mt-6 inline-flex h-11 items-center rounded border px-4 text-[0.9375rem] font-medium transition-colors"
        >
          {t.inapoi}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={trimite} noValidate className="space-y-5">
      <div aria-live="assertive">
        {eroareGenerala !== null && (
          <p className="border-mk-refuz text-mk-refuz flex items-start gap-2 rounded border p-4 text-[0.875rem]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{eroareGenerala}</span>
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${idFormular}-nume`} className={CLASA_ETICHETA}>
          {t.nume} <span aria-hidden="true">*</span>
        </label>
        <input
          id={`${idFormular}-nume`}
          type="text"
          autoComplete="name"
          className={CLASA_INPUT}
          aria-invalid={erori.nume ? true : undefined}
          aria-describedby={erori.nume ? `${idFormular}-nume-eroare` : undefined}
          name="nume"
          onBlur={laIesire("nume")}
        />
        {erori.nume && (
          <p id={`${idFormular}-nume-eroare`} className={CLASA_EROARE}>
            {erori.nume}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${idFormular}-firma`} className={CLASA_ETICHETA}>
          {t.firma} <span aria-hidden="true">*</span>
        </label>
        <input
          id={`${idFormular}-firma`}
          type="text"
          autoComplete="organization"
          className={CLASA_INPUT}
          aria-invalid={erori.firma ? true : undefined}
          aria-describedby={erori.firma ? `${idFormular}-firma-eroare` : undefined}
          name="firma"
          onBlur={laIesire("firma")}
        />
        {erori.firma && (
          <p id={`${idFormular}-firma-eroare`} className={CLASA_EROARE}>
            {erori.firma}
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idFormular}-email`} className={CLASA_ETICHETA}>
            {t.email} <span aria-hidden="true">*</span>
          </label>
          <input
            id={`${idFormular}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            className={CLASA_INPUT}
            aria-invalid={erori.email ? true : undefined}
            aria-describedby={erori.email ? `${idFormular}-email-eroare` : undefined}
            name="email"
            onBlur={laIesire("email")}
          />
          {erori.email && (
            <p id={`${idFormular}-email-eroare`} className={CLASA_EROARE}>
              {erori.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${idFormular}-telefon`} className={CLASA_ETICHETA}>
            {t.telefon} <span className="text-mk-text-slab font-normal">{t.optional}</span>
          </label>
          <input
            id={`${idFormular}-telefon`}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className={CLASA_INPUT}
            aria-invalid={erori.telefon ? true : undefined}
            aria-describedby={erori.telefon ? `${idFormular}-telefon-eroare` : undefined}
            name="telefon"
            onBlur={laIesire("telefon")}
          />
          {erori.telefon && (
            <p id={`${idFormular}-telefon-eroare`} className={CLASA_EROARE}>
              {erori.telefon}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor={`${idFormular}-angajati`} className={CLASA_ETICHETA}>
          {t.angajati} <span aria-hidden="true">*</span>
        </label>
        <select
          id={`${idFormular}-angajati`}
          className={`${CLASA_INPUT} cursor-pointer`}
          aria-invalid={erori.nrAngajati ? true : undefined}
          aria-describedby={erori.nrAngajati ? `${idFormular}-angajati-eroare` : undefined}
          name="nrAngajati"
          defaultValue={BANDA_IMPLICITA}
          onBlur={laIesire("nrAngajati")}
        >
          {BENZI_ANGAJATI.map((banda) => (
            <option key={banda} value={banda}>
              {benzi[banda]}
            </option>
          ))}
        </select>
        {erori.nrAngajati && (
          <p id={`${idFormular}-angajati-eroare`} className={CLASA_EROARE}>
            {erori.nrAngajati}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${idFormular}-mesaj`} className={CLASA_ETICHETA}>
          {t.mesaj} <span className="text-mk-text-slab font-normal">{t.optional}</span>
        </label>
        <textarea
          id={`${idFormular}-mesaj`}
          rows={5}
          className={`${CLASA_CAMP} min-h-28 py-2.5`}
          aria-invalid={erori.mesaj ? true : undefined}
          aria-describedby={erori.mesaj ? `${idFormular}-mesaj-eroare` : undefined}
          name="mesaj"
          onBlur={laIesire("mesaj")}
        />
        {erori.mesaj && (
          <p id={`${idFormular}-mesaj-eroare`} className={CLASA_EROARE}>
            {erori.mesaj}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={inCurs}
        className="bg-mk-cerneala text-mk-text-inv disabled:border-mk-rigla disabled:text-mk-text-slab inline-flex h-12 w-full items-center justify-center gap-2 rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:border disabled:bg-transparent sm:w-auto"
      >
        {inCurs && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {inCurs ? t.seTrimite : t.trimite}
      </button>

      <p className="text-mk-text-slab text-[0.75rem] leading-[1.55]">
        {t.gdprInainte}
        <Link href="/legal/confidentialitate" className="underline underline-offset-2">
          {t.gdprLegatura}
        </Link>
        .
      </p>
    </form>
  );
}

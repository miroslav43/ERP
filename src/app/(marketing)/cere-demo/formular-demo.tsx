// src/app/(marketing)/cere-demo/formular-demo.tsx
"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { trimiteCerereDemo } from "./actions";
import {
  BENZI_ANGAJATI,
  CAMPURI_CERE_DEMO,
  ETICHETE_BANDA,
  schemaCereDemo,
  type CereDemoInput,
} from "./schema";

const VALORI_INITIALE: CereDemoInput = {
  nume: "",
  firma: "",
  email: "",
  telefon: "",
  nrAngajati: "10-49",
  mesaj: "",
};

const CLASA_CAMP =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors   ";

export function FormularDemo() {
  const idFormular = useId();
  const [inCurs, startTransition] = useTransition();
  const [trimis, setTrimis] = useState(false);
  const [eroareGenerala, setEroareGenerala] = useState<string | null>(null);

  const form = useForm<CereDemoInput>({
    resolver: zodResolver(schemaCereDemo),
    defaultValues: VALORI_INITIALE,
    mode: "onBlur",
  });

  const trimite = form.handleSubmit((valori) => {
    setEroareGenerala(null);
    startTransition(async () => {
      const rezultat = await trimiteCerereDemo(valori);
      if (rezultat.ok) {
        setTrimis(true);
        form.reset(VALORI_INITIALE);
        return;
      }
      const campuri = rezultat.error.fieldErrors;
      if (campuri) {
        for (const cheie of CAMPURI_CERE_DEMO) {
          const primulMesaj = campuri[cheie]?.[0];
          if (primulMesaj) {
            form.setError(cheie, { type: "server", message: primulMesaj });
          }
        }
      }
      setEroareGenerala(rezultat.error.message);
    });
  });

  if (trimis) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border-border bg-surface rounded-lg border p-8"
      >
        <CheckCircle2 className="text-success h-6 w-6" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold tracking-tight">Am primit cererea ta</h2>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Îți răspundem pe e-mail în cel mult o zi lucrătoare. Dacă între timp vrei să adaugi ceva,
          poți răspunde direct la mesajul nostru.
        </p>
        <Link
          href="/"
          className="border-border hover:border-primary mt-6 inline-flex rounded-md border px-4 py-2 text-sm font-medium transition-colors"
        >
          Înapoi la pagina principală
        </Link>
      </div>
    );
  }

  const erori = form.formState.errors;

  return (
    <form onSubmit={trimite} noValidate className="space-y-5">
      <div aria-live="assertive">
        {eroareGenerala ? (
          <p className="border-border bg-surface text-danger flex items-start gap-2 rounded-md border p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{eroareGenerala}</span>
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={`${idFormular}-nume`} className="block text-sm font-medium">
          Nume și prenume <span aria-hidden="true">*</span>
        </label>
        <input
          id={`${idFormular}-nume`}
          type="text"
          autoComplete="name"
          className={`mt-1.5 ${CLASA_CAMP}`}
          aria-invalid={erori.nume ? true : undefined}
          aria-describedby={erori.nume ? `${idFormular}-nume-eroare` : undefined}
          {...form.register("nume")}
        />
        {erori.nume ? (
          <p id={`${idFormular}-nume-eroare`} className="text-danger mt-1.5 text-sm">
            {erori.nume.message}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={`${idFormular}-firma`} className="block text-sm font-medium">
          Denumirea firmei <span aria-hidden="true">*</span>
        </label>
        <input
          id={`${idFormular}-firma`}
          type="text"
          autoComplete="organization"
          className={`mt-1.5 ${CLASA_CAMP}`}
          aria-invalid={erori.firma ? true : undefined}
          aria-describedby={erori.firma ? `${idFormular}-firma-eroare` : undefined}
          {...form.register("firma")}
        />
        {erori.firma ? (
          <p id={`${idFormular}-firma-eroare`} className="text-danger mt-1.5 text-sm">
            {erori.firma.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idFormular}-email`} className="block text-sm font-medium">
            E-mail de contact <span aria-hidden="true">*</span>
          </label>
          <input
            id={`${idFormular}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            className={`mt-1.5 ${CLASA_CAMP}`}
            aria-invalid={erori.email ? true : undefined}
            aria-describedby={erori.email ? `${idFormular}-email-eroare` : undefined}
            {...form.register("email")}
          />
          {erori.email ? (
            <p id={`${idFormular}-email-eroare`} className="text-danger mt-1.5 text-sm">
              {erori.email.message}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={`${idFormular}-telefon`} className="block text-sm font-medium">
            Telefon <span className="text-muted-foreground">(opțional)</span>
          </label>
          <input
            id={`${idFormular}-telefon`}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className={`mt-1.5 ${CLASA_CAMP}`}
            aria-invalid={erori.telefon ? true : undefined}
            aria-describedby={erori.telefon ? `${idFormular}-telefon-eroare` : undefined}
            {...form.register("telefon")}
          />
          {erori.telefon ? (
            <p id={`${idFormular}-telefon-eroare`} className="text-danger mt-1.5 text-sm">
              {erori.telefon.message}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor={`${idFormular}-angajati`} className="block text-sm font-medium">
          Număr de angajați <span aria-hidden="true">*</span>
        </label>
        <select
          id={`${idFormular}-angajati`}
          className={`mt-1.5 ${CLASA_CAMP}`}
          aria-invalid={erori.nrAngajati ? true : undefined}
          aria-describedby={erori.nrAngajati ? `${idFormular}-angajati-eroare` : undefined}
          {...form.register("nrAngajati")}
        >
          {BENZI_ANGAJATI.map((banda) => (
            <option key={banda} value={banda}>
              {ETICHETE_BANDA[banda]}
            </option>
          ))}
        </select>
        {erori.nrAngajati ? (
          <p id={`${idFormular}-angajati-eroare`} className="text-danger mt-1.5 text-sm">
            {erori.nrAngajati.message}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={`${idFormular}-mesaj`} className="block text-sm font-medium">
          Ce ai vrea să rezolvi <span className="text-muted-foreground">(opțional)</span>
        </label>
        <textarea
          id={`${idFormular}-mesaj`}
          rows={5}
          className={`mt-1.5 ${CLASA_CAMP}`}
          aria-invalid={erori.mesaj ? true : undefined}
          aria-describedby={erori.mesaj ? `${idFormular}-mesaj-eroare` : undefined}
          {...form.register("mesaj")}
        />
        {erori.mesaj ? (
          <p id={`${idFormular}-mesaj-eroare`} className="text-danger mt-1.5 text-sm">
            {erori.mesaj.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={inCurs}
        className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex w-full items-center justify-center gap-2 rounded-md px-6 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground sm:w-auto"
      >
        {inCurs ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {inCurs ? "Se trimite…" : "Trimite cererea"}
      </button>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Prin trimiterea formularului ești de acord ca datele să fie folosite pentru a te contacta în
        legătură cu această cerere. Detalii în{" "}
        <Link href="/legal/confidentialitate" className="underline underline-offset-2">
          politica de confidențialitate
        </Link>
        .
      </p>
    </form>
  );
}

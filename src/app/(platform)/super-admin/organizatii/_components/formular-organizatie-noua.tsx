// src/app/(platform)/super-admin/organizatii/_components/formular-organizatie-noua.tsx
"use client";

import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  inroleazaOrganizatieSchema,
  FORME_JURIDICE,
  JUDETE,
  PLANURI,
  type InroleazaOrganizatieInput,
} from "@/schemas/organization";
import { inroleazaOrganizatie, type OrganizatieInrolata } from "./../actions";

const ETICHETE_PLAN: Record<(typeof PLANURI)[number], string> = {
  trial: "Perioadă de probă",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

/**
 * Definită la nivel de modul, nu în corpul formularului.
 *
 * O componentă creată în interiorul altei componente primește o identitate nouă
 * la fiecare randare: React o tratează ca pe un tip diferit, demontează
 * subarborele și îl remontează. Efectul vizibil este pierderea focusului din
 * câmp exact în timp ce utilizatorul scrie.
 */
function Eroare({ id, mesaj }: { id: string; mesaj?: string | undefined }) {
  if (mesaj === undefined || mesaj === "") return null;
  return (
    <p id={id} className="text-danger mt-1 text-sm">
      {mesaj}
    </p>
  );
}

export interface ValoriInitialeOrganizatie {
  readonly name?: string;
  readonly slug?: string;
  readonly email_contact?: string;
  readonly telefon_contact?: string;
}

interface ProprietatiFormular {
  readonly valoriInitiale?: ValoriInitialeOrganizatie;
  readonly onInrolata: (rezultat: OrganizatieInrolata) => void;
}

export function FormularOrganizatieNoua({ valoriInitiale, onInrolata }: ProprietatiFormular) {
  const idFormular = useId();
  const [eroareServer, setEroareServer] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InroleazaOrganizatieInput>({
    resolver: zodResolver(inroleazaOrganizatieSchema),
    defaultValues: {
      plan: "trial",
      seats_limit: 10,
      platitor_tva: false,
      forma_juridica: "SRL",
      judet: "București",
      name: valoriInitiale?.name ?? "",
      slug: valoriInitiale?.slug ?? "",
      email_contact: valoriInitiale?.email_contact ?? "",
      telefon_contact: valoriInitiale?.telefon_contact ?? "",
      owner_email: valoriInitiale?.email_contact ?? "",
      owner_telefon: valoriInitiale?.telefon_contact ?? "",
    },
  });

  const trimite = handleSubmit(async (valori) => {
    setEroareServer(null);
    const rezultat = await inroleazaOrganizatie(valori);
    if (!rezultat.ok) {
      for (const [camp, mesaje] of Object.entries(rezultat.error.fieldErrors ?? {})) {
        const primul = mesaje[0];
        if (primul)
          setError(camp as keyof InroleazaOrganizatieInput, { type: "server", message: primul });
      }
      setEroareServer(rezultat.error.message);
      return;
    }
    onInrolata(rezultat.data);
  });

  const claseCamp =
    "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground   ";

  return (
    <form onSubmit={trimite} noValidate className="space-y-6">
      <div aria-live="assertive">
        {eroareServer && (
          <p
            role="alert"
            className="border-border bg-surface text-danger rounded-md border p-3 text-sm"
          >
            {eroareServer}
          </p>
        )}
      </div>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Date de identificare</legend>

        <div>
          <label
            htmlFor={`${idFormular}-name`}
            className="text-foreground block text-sm font-medium"
          >
            Denumire *
          </label>
          <input
            id={`${idFormular}-name`}
            {...register("name")}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${idFormular}-name-eroare` : undefined}
            className={claseCamp}
          />
          <Eroare id={`${idFormular}-name-eroare`} mesaj={errors.name?.message} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${idFormular}-forma`}
              className="text-foreground block text-sm font-medium"
            >
              Formă juridică *
            </label>
            <select
              id={`${idFormular}-forma`}
              {...register("forma_juridica")}
              className={claseCamp}
            >
              {FORME_JURIDICE.map((forma) => (
                <option key={forma} value={forma}>
                  {forma}
                </option>
              ))}
            </select>
            <Eroare id={`${idFormular}-forma-eroare`} mesaj={errors.forma_juridica?.message} />
          </div>
          <div>
            <label
              htmlFor={`${idFormular}-cui`}
              className="text-foreground block text-sm font-medium"
            >
              CUI *
            </label>
            <input
              id={`${idFormular}-cui`}
              {...register("cui")}
              inputMode="text"
              placeholder="RO 14399840"
              aria-invalid={Boolean(errors.cui)}
              aria-describedby={`${idFormular}-cui-ajutor`}
              className={claseCamp}
            />
            <p id={`${idFormular}-cui-ajutor`} className="text-muted-foreground mt-1 text-xs">
              Acceptăm și formatul cu prefix și spații.
            </p>
            <Eroare id={`${idFormular}-cui-eroare`} mesaj={errors.cui?.message} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id={`${idFormular}-tva`}
            type="checkbox"
            {...register("platitor_tva")}
            className="border-border size-4 rounded"
          />
          <label htmlFor={`${idFormular}-tva`} className="text-foreground text-sm">
            Plătitor de TVA
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${idFormular}-slug`}
              className="text-foreground block text-sm font-medium"
            >
              Identificator *
            </label>
            <input
              id={`${idFormular}-slug`}
              {...register("slug")}
              placeholder="firma-mea"
              aria-invalid={Boolean(errors.slug)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-slug-eroare`} mesaj={errors.slug?.message} />
          </div>
          <div>
            <label
              htmlFor={`${idFormular}-regcom`}
              className="text-foreground block text-sm font-medium"
            >
              Nr. registrul comerțului
            </label>
            <input
              id={`${idFormular}-regcom`}
              {...register("reg_com")}
              placeholder="J40/1234/2020"
              className={claseCamp}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-caen`} className="text-foreground block text-sm font-medium">
              Cod CAEN principal
            </label>
            <input
              id={`${idFormular}-caen`}
              {...register("cod_caen")}
              inputMode="numeric"
              placeholder="6201"
              aria-invalid={Boolean(errors.cod_caen)}
              aria-describedby={`${idFormular}-caen-ajutor`}
              className={claseCamp}
            />
            <p id={`${idFormular}-caen-ajutor`} className="text-muted-foreground mt-1 text-xs">
              Poate lipsi pentru PFA/II — lasă gol dacă nu-l ai la îndemână.
            </p>
            <Eroare id={`${idFormular}-caen-eroare`} mesaj={errors.cod_caen?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-capital`} className="text-foreground block text-sm font-medium">
              Capital social (RON) *
            </label>
            <input
              id={`${idFormular}-capital`}
              type="number"
              min={0}
              step="0.01"
              {...register("capital_social")}
              aria-invalid={Boolean(errors.capital_social)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-capital-eroare`} mesaj={errors.capital_social?.message} />
          </div>
        </div>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Contact și sediu</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${idFormular}-email`}
              className="text-foreground block text-sm font-medium"
            >
              Email de contact *
            </label>
            <input
              id={`${idFormular}-email`}
              type="email"
              {...register("email_contact")}
              aria-invalid={Boolean(errors.email_contact)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-email-eroare`} mesaj={errors.email_contact?.message} />
          </div>
          <div>
            <label
              htmlFor={`${idFormular}-telefon`}
              className="text-foreground block text-sm font-medium"
            >
              Telefon *
            </label>
            <input
              id={`${idFormular}-telefon`}
              type="tel"
              {...register("telefon_contact")}
              placeholder="0721 234 567"
              aria-invalid={Boolean(errors.telefon_contact)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-telefon-eroare`} mesaj={errors.telefon_contact?.message} />
          </div>
          <div>
            <label
              htmlFor={`${idFormular}-judet`}
              className="text-foreground block text-sm font-medium"
            >
              Județ *
            </label>
            <select id={`${idFormular}-judet`} {...register("judet")} className={claseCamp}>
              {JUDETE.map((judet) => (
                <option key={judet} value={judet}>
                  {judet}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor={`${idFormular}-oras`}
              className="text-foreground block text-sm font-medium"
            >
              Localitate *
            </label>
            <input
              id={`${idFormular}-oras`}
              {...register("oras")}
              aria-invalid={Boolean(errors.oras)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-oras-eroare`} mesaj={errors.oras?.message} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`${idFormular}-strada`} className="text-foreground block text-sm font-medium">
              Stradă *
            </label>
            <input
              id={`${idFormular}-strada`}
              {...register("strada")}
              aria-invalid={Boolean(errors.strada)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-strada-eroare`} mesaj={errors.strada?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-numar`} className="text-foreground block text-sm font-medium">
              Număr *
            </label>
            <input
              id={`${idFormular}-numar`}
              {...register("numar")}
              aria-invalid={Boolean(errors.numar)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-numar-eroare`} mesaj={errors.numar?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-sector`} className="text-foreground block text-sm font-medium">
              Sector (doar București)
            </label>
            <input
              id={`${idFormular}-sector`}
              {...register("sector")}
              placeholder="Sector 1"
              aria-invalid={Boolean(errors.sector)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-sector-eroare`} mesaj={errors.sector?.message} />
          </div>
        </div>
        <div>
          <label htmlFor={`${idFormular}-adresa`} className="text-foreground block text-sm font-medium">
            Detalii adresă (bloc, etaj, birou)
          </label>
          <input id={`${idFormular}-adresa`} {...register("adresa")} className={claseCamp} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-reprezentant`} className="text-foreground block text-sm font-medium">
              Reprezentant legal
            </label>
            <input
              id={`${idFormular}-reprezentant`}
              {...register("reprezentant_legal")}
              placeholder="Ion Popescu"
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-functie`} className="text-foreground block text-sm font-medium">
              Funcție *
            </label>
            <input
              id={`${idFormular}-functie`}
              {...register("reprezentant_functie")}
              list={`${idFormular}-functii`}
              placeholder="Administrator"
              aria-invalid={Boolean(errors.reprezentant_functie)}
              className={claseCamp}
            />
            <datalist id={`${idFormular}-functii`}>
              <option value="Administrator" />
              <option value="Director General" />
              <option value="Președinte" />
            </datalist>
            <Eroare id={`${idFormular}-functie-eroare`} mesaj={errors.reprezentant_functie?.message} />
          </div>
        </div>
        <div>
          <label htmlFor={`${idFormular}-cnp`} className="text-foreground block text-sm font-medium">
            CNP reprezentant (opțional)
          </label>
          <input
            id={`${idFormular}-cnp`}
            {...register("reprezentant_cnp")}
            inputMode="numeric"
            aria-invalid={Boolean(errors.reprezentant_cnp)}
            aria-describedby={`${idFormular}-cnp-ajutor`}
            className={claseCamp}
          />
          <p id={`${idFormular}-cnp-ajutor`} className="text-muted-foreground mt-1 text-xs">
            Poate fi completat oricând ulterior din fișa organizației. Se stochează criptat.
          </p>
          <Eroare id={`${idFormular}-cnp-eroare`} mesaj={errors.reprezentant_cnp?.message} />
        </div>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Cont proprietar</legend>
        <p className="text-muted-foreground text-xs">
          Persoana de mai jos devine automat administratorul (owner) organizației, cu o parolă
          temporară afișată o singură dată după creare.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-owner-nume`} className="text-foreground block text-sm font-medium">
              Nume complet *
            </label>
            <input
              id={`${idFormular}-owner-nume`}
              {...register("owner_nume")}
              aria-invalid={Boolean(errors.owner_nume)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-owner-nume-eroare`} mesaj={errors.owner_nume?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-owner-email`} className="text-foreground block text-sm font-medium">
              Email de business *
            </label>
            <input
              id={`${idFormular}-owner-email`}
              type="email"
              {...register("owner_email")}
              aria-invalid={Boolean(errors.owner_email)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-owner-email-eroare`} mesaj={errors.owner_email?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-owner-telefon`} className="text-foreground block text-sm font-medium">
              Telefon *
            </label>
            <input
              id={`${idFormular}-owner-telefon`}
              type="tel"
              {...register("owner_telefon")}
              placeholder="0721 234 567"
              aria-invalid={Boolean(errors.owner_telefon)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-owner-telefon-eroare`} mesaj={errors.owner_telefon?.message} />
          </div>
        </div>
      </fieldset>

      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Abonament</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${idFormular}-plan`}
              className="text-foreground block text-sm font-medium"
            >
              Plan *
            </label>
            <select id={`${idFormular}-plan`} {...register("plan")} className={claseCamp}>
              {PLANURI.map((plan) => (
                <option key={plan} value={plan}>
                  {ETICHETE_PLAN[plan]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor={`${idFormular}-locuri`}
              className="text-foreground block text-sm font-medium"
            >
              Număr de locuri *
            </label>
            <input
              id={`${idFormular}-locuri`}
              type="number"
              min={1}
              max={1000}
              {...register("seats_limit")}
              aria-invalid={Boolean(errors.seats_limit)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-locuri-eroare`} mesaj={errors.seats_limit?.message} />
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          Planul și numărul de locuri pot fi modificate doar din panoul de platformă.
        </p>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
        >
          {isSubmitting ? "Se înrolează…" : "Înrolează organizația"}
        </button>
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {isSubmitting ? "Se salvează datele…" : ""}
        </p>
      </div>
    </form>
  );
}

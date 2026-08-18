// src/app/(platform)/super-admin/organizatii/_components/formular-organizatie-noua.tsx
"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  creeazaOrganizatieSchema,
  FORME_JURIDICE,
  JUDETE,
  PLANURI,
  type CreeazaOrganizatieInput,
} from "@/schemas/organization";
import { creeazaOrganizatie } from "./../actions";

const ETICHETE_PLAN: Record<(typeof PLANURI)[number], string> = {
  trial: "Perioadă de probă",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

/** Payload-ul acțiunii ajunge tipat `unknown` la client, deci îl îngustăm explicit înainte de navigare. */
function areIdOrganizatie(valoare: unknown): valoare is Readonly<{ id: string }> {
  return (
    typeof valoare === "object" &&
    valoare !== null &&
    "id" in valoare &&
    typeof valoare.id === "string"
  );
}

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

export function FormularOrganizatieNoua() {
  const router = useRouter();
  const idFormular = useId();
  const [eroareServer, setEroareServer] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreeazaOrganizatieInput>({
    resolver: zodResolver(creeazaOrganizatieSchema),
    defaultValues: {
      plan: "trial",
      seats_limit: 10,
      platitor_tva: false,
      forma_juridica: "SRL",
      judet: "București",
    },
  });

  const trimite = handleSubmit(async (valori) => {
    setEroareServer(null);
    const rezultat = await creeazaOrganizatie(valori);
    if (rezultat.ok) {
      router.push(
        areIdOrganizatie(rezultat.data)
          ? `/super-admin/organizatii/${rezultat.data.id}`
          : "/super-admin/organizatii",
      );
      return;
    }
    for (const [camp, mesaje] of Object.entries(rezultat.error.fieldErrors ?? {})) {
      const primul = mesaje[0];
      if (primul)
        setError(camp as keyof CreeazaOrganizatieInput, { type: "server", message: primul });
    }
    setEroareServer(rezultat.error.message);
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
        <div>
          <label
            htmlFor={`${idFormular}-adresa`}
            className="text-foreground block text-sm font-medium"
          >
            Adresă
          </label>
          <input id={`${idFormular}-adresa`} {...register("adresa")} className={claseCamp} />
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
          {isSubmitting ? "Se creează…" : "Creează organizația"}
        </button>
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {isSubmitting ? "Se salvează datele…" : ""}
        </p>
      </div>
    </form>
  );
}

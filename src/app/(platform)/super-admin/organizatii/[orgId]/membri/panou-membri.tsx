// src/app/(platform)/super-admin/organizatii/[orgId]/membri/panou-membri.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AlertCircle, Check, Copy, Loader2, Send } from "lucide-react";

import {
  DESCRIERI_ROL,
  ETICHETE_ROL,
  ROLURI_ATRIBUIBILE,
  schemaInvitatie,
  ZILE_EXPIRARE_IMPLICIT,
  ZILE_EXPIRARE_MAX,
  ZILE_EXPIRARE_MIN,
  type DateInvitatie,
  type RolAtribuibil,
} from "@/schemas/membership";

import {
  invitaMembru,
  reactiveazaMembru,
  retrimiteInvitatie,
  revocaInvitatie,
  schimbaRol,
  suspendaMembru,
} from "./actions";

const CLASA_BUTON =
  "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-background    disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground";

function Mesaj({ text, ton }: Readonly<{ text: string | null; ton: "succes" | "eroare" }>) {
  if (!text) return null;
  return (
    <p
      role={ton === "eroare" ? "alert" : "status"}
      aria-live="polite"
      className={`mt-2 inline-flex items-start gap-1 text-xs ${ton === "eroare" ? "text-danger" : "text-success"}`}
    >
      {ton === "eroare" ? (
        <AlertCircle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
      ) : (
        <Check aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
      )}
      {text}
    </p>
  );
}

function ButonConfirmare({
  eticheta,
  intrebare,
  inCurs,
  laConfirmare,
}: Readonly<{ eticheta: string; intrebare: string; inCurs: boolean; laConfirmare: () => void }>) {
  const [deschis, setDeschis] = useState(false);
  if (!deschis) {
    return (
      <button
        type="button"
        className={CLASA_BUTON}
        onClick={() => setDeschis(true)}
        disabled={inCurs}
      >
        {eticheta}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-muted-foreground text-xs">{intrebare}</span>
      <button
        type="button"
        className={CLASA_BUTON}
        disabled={inCurs}
        onClick={() => {
          setDeschis(false);
          laConfirmare();
        }}
      >
        {inCurs ? <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" /> : null}
        Da
      </button>
      <button type="button" className={CLASA_BUTON} onClick={() => setDeschis(false)}>
        Nu
      </button>
    </span>
  );
}

/** Exportat: asistentul de înrolare afișează același link pe ecranul de succes. */
export function LinkInvitatie({ link }: Readonly<{ link: string }>) {
  const [copiat, setCopiat] = useState(false);
  const [eroare, setEroare] = useState<string | null>(null);

  async function copiaza(): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      setCopiat(true);
      setEroare(null);
    } catch {
      setEroare("Copierea automată nu a funcționat. Selectează linkul și copiază-l manual.");
    }
  }

  return (
    <div className="border-border bg-background mt-3 rounded-md border p-3">
      <p className="text-foreground text-xs font-medium">
        Link de invitație (se afișează o singură dată)
      </p>
      <p className="text-muted-foreground mt-1 font-mono text-xs break-all">{link}</p>
      <button type="button" className={`${CLASA_BUTON} mt-2`} onClick={copiaza}>
        <Copy aria-hidden="true" className="h-3 w-3" />
        {copiat ? "Copiat" : "Copiază linkul"}
      </button>
      <span aria-live="polite" className="sr-only">
        {copiat ? "Linkul a fost copiat în clipboard." : ""}
      </span>
      <Mesaj text={eroare} ton="eroare" />
    </div>
  );
}

export function FormularInvitatie({ organizationId }: Readonly<{ organizationId: string }>) {
  const router = useRouter();
  const [eroare, setEroare] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const valoriInitiale: DateInvitatie = {
    organizationId,
    email: "",
    role: "employee",
    expiraInZile: ZILE_EXPIRARE_IMPLICIT,
    nume: undefined,
    prenume: undefined,
    telefon: undefined,
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DateInvitatie>({
    resolver: zodResolver(schemaInvitatie),
    defaultValues: valoriInitiale,
  });

  const rolAles = watch("role");

  const trimite = handleSubmit(async (valori) => {
    setEroare(null);
    setSucces(null);
    setLink(null);
    const rezultat = await invitaMembru(valori);
    if (!rezultat.ok) {
      setEroare(rezultat.error.message);
      return;
    }
    setSucces(rezultat.data.mesaj);
    setLink(rezultat.data.linkInvitatie);
    reset(valoriInitiale);
    router.refresh();
  });

  return (
    <form onSubmit={trimite} noValidate className="border-border bg-surface rounded-xl border p-4">
      <h2 className="text-foreground text-sm font-semibold">Invită un membru</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label htmlFor="email-invitatie" className="text-foreground block text-sm font-medium">
            Adresă de e-mail
          </label>
          <input
            id="email-invitatie"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? true : false}
            aria-describedby={errors.email ? "eroare-email" : undefined}
            className="border-border bg-background text-foreground mt-1 w-full rounded-md border px-3 py-2 text-sm"
            {...register("email")}
          />
          {errors.email ? (
            <p id="eroare-email" role="alert" className="text-danger mt-1 text-xs">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="rol-invitatie" className="text-foreground block text-sm font-medium">
            Rol
          </label>
          <select
            id="rol-invitatie"
            aria-describedby="descriere-rol"
            className="border-border bg-background text-foreground mt-1 w-full rounded-md border px-3 py-2 text-sm"
            {...register("role")}
          >
            {ROLURI_ATRIBUIBILE.map((rol) => (
              <option key={rol} value={rol}>
                {ETICHETE_ROL[rol]}
              </option>
            ))}
          </select>
          <p id="descriere-rol" className="text-muted-foreground mt-1 text-xs">
            {DESCRIERI_ROL[rolAles as RolAtribuibil]}
          </p>
        </div>

        <div>
          <label htmlFor="expirare-invitatie" className="text-foreground block text-sm font-medium">
            Valabilitate (zile)
          </label>
          <input
            id="expirare-invitatie"
            type="number"
            min={ZILE_EXPIRARE_MIN}
            max={ZILE_EXPIRARE_MAX}
            aria-invalid={errors.expiraInZile ? true : false}
            aria-describedby={errors.expiraInZile ? "eroare-expirare" : undefined}
            className="border-border bg-background text-foreground mt-1 w-full rounded-md border px-3 py-2 text-sm"
            {...register("expiraInZile", { valueAsNumber: true })}
          />
          {errors.expiraInZile ? (
            <p id="eroare-expirare" role="alert" className="text-danger mt-1 text-xs">
              {errors.expiraInZile.message}
            </p>
          ) : null}
        </div>
      </div>

      <input type="hidden" {...register("organizationId")} />

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground mt-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <Send aria-hidden="true" className="h-4 w-4" />
        )}
        Trimite invitația
      </button>

      <Mesaj text={eroare} ton="eroare" />
      <Mesaj text={succes} ton="succes" />
      {link ? <LinkInvitatie link={link} /> : null}
    </form>
  );
}

export function ActiuniMembru({
  organizationId,
  memberId,
  rol,
  status,
  esteContPropriu,
}: Readonly<{
  organizationId: string;
  memberId: string;
  rol: RolAtribuibil;
  status: "active" | "suspended" | "inactive";
  esteContPropriu: boolean;
}>) {
  const router = useRouter();
  const [inCurs, startTransition] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  function ruleaza(operatiune: () => Promise<{ ok: boolean; mesaj: string }>): void {
    setEroare(null);
    setSucces(null);
    startTransition(async () => {
      const rezultat = await operatiune();
      if (rezultat.ok) {
        setSucces(rezultat.mesaj);
        router.refresh();
      } else {
        setEroare(rezultat.mesaj);
      }
    });
  }

  if (esteContPropriu) {
    return (
      <p className="text-muted-foreground text-xs">Cont propriu — nu poate fi modificat de aici.</p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`rol-${memberId}`} className="sr-only">
          Rolul membrului
        </label>
        <select
          id={`rol-${memberId}`}
          defaultValue={rol}
          disabled={inCurs}
          className="border-border bg-background text-foreground disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md border px-2 py-1 text-xs disabled:cursor-not-allowed"
          onChange={(eveniment) => {
            const rolNou = eveniment.target.value;
            ruleaza(async () => {
              const rezultat = await schimbaRol({ organizationId, memberId, role: rolNou });
              return rezultat.ok
                ? { ok: true, mesaj: rezultat.data.mesaj }
                : { ok: false, mesaj: rezultat.error.message };
            });
          }}
        >
          {ROLURI_ATRIBUIBILE.map((valoare) => (
            <option key={valoare} value={valoare}>
              {ETICHETE_ROL[valoare]}
            </option>
          ))}
        </select>

        {status === "active" ? (
          <ButonConfirmare
            eticheta="Suspendă"
            intrebare="Suspenzi accesul?"
            inCurs={inCurs}
            laConfirmare={() =>
              ruleaza(async () => {
                const rezultat = await suspendaMembru({ organizationId, memberId });
                return rezultat.ok
                  ? { ok: true, mesaj: rezultat.data.mesaj }
                  : { ok: false, mesaj: rezultat.error.message };
              })
            }
          />
        ) : (
          <button
            type="button"
            className={CLASA_BUTON}
            disabled={inCurs}
            onClick={() =>
              ruleaza(async () => {
                const rezultat = await reactiveazaMembru({ organizationId, memberId });
                return rezultat.ok
                  ? { ok: true, mesaj: rezultat.data.mesaj }
                  : { ok: false, mesaj: rezultat.error.message };
              })
            }
          >
            Reactivează
          </button>
        )}
      </div>
      <Mesaj text={eroare} ton="eroare" />
      <Mesaj text={succes} ton="succes" />
    </div>
  );
}

export function ActiuniInvitatie({
  organizationId,
  invitationId,
}: Readonly<{ organizationId: string; invitationId: string }>) {
  const router = useRouter();
  const [inCurs, startTransition] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={CLASA_BUTON}
          disabled={inCurs}
          onClick={() => {
            setEroare(null);
            setSucces(null);
            startTransition(async () => {
              const rezultat = await retrimiteInvitatie({ organizationId, invitationId });
              if (rezultat.ok) {
                setSucces(rezultat.data.mesaj);
                setLink(rezultat.data.linkInvitatie);
                router.refresh();
              } else {
                setEroare(rezultat.error.message);
              }
            });
          }}
        >
          {inCurs ? <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" /> : null}
          Retrimite
        </button>

        <ButonConfirmare
          eticheta="Revocă"
          intrebare="Revoci invitația?"
          inCurs={inCurs}
          laConfirmare={() => {
            setEroare(null);
            setSucces(null);
            setLink(null);
            startTransition(async () => {
              const rezultat = await revocaInvitatie({ organizationId, invitationId });
              if (rezultat.ok) {
                setSucces(rezultat.data.mesaj);
                router.refresh();
              } else {
                setEroare(rezultat.error.message);
              }
            });
          }}
        />
      </div>
      <Mesaj text={eroare} ton="eroare" />
      <Mesaj text={succes} ton="succes" />
      {link ? <LinkInvitatie link={link} /> : null}
    </div>
  );
}

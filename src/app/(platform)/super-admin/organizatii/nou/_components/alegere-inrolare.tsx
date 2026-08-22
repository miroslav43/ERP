"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { ArrowRight, ClipboardList, Mail, UserCheck } from "lucide-react";

import { LinkInvitatie } from "../../[orgId]/membri/panou-membri";
import { creeazaOrganizatieMinima } from "../actions";
import { AsistentOrganizatieNoua } from "./asistent-organizatie-noua";

/** Sugestie de identificator din denumire — se poate schimba din fișa firmei. */
function sugereazaSlug(firma: string): string {
  return firma
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 40);
}

type Rezultat = Readonly<{
  id: string;
  name: string;
  invitatie:
    | Readonly<{ trimisa: true; prinEmail: boolean; linkInvitatie: string }>
    | Readonly<{ trimisa: false; eroare: string }>;
}>;

type ValoriInitiale = Readonly<{
  name?: string;
  slug?: string;
  email_contact?: string;
  telefon_contact?: string;
}>;

/**
 * Primul ecran al înrolării: cine completează datele firmei.
 *
 * Până acum, super-adminul trecea prin toți cei 7 pași înainte ca firma să
 * existe — adică i se cereau capitalul social, IBAN-ul și responsabilul SSM,
 * date pe care le știe firma, nu platforma. Înrolarea se bloca pe un telefon.
 */
export function AlegereInrolare({ valoriInitiale }: { valoriInitiale?: ValoriInitiale }) {
  const id = useId();
  const [mod, setMod] = useState<"alegere" | "asistent">("alegere");
  const [nume, setNume] = useState(valoriInitiale?.name ?? "");
  const [cui, setCui] = useState("");
  const [emailAdmin, setEmailAdmin] = useState(valoriInitiale?.email_contact ?? "");
  const [eroare, setEroare] = useState<string | null>(null);
  const [campuri, setCampuri] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [rezultat, setRezultat] = useState<Rezultat | null>(null);
  const [inCurs, porneste] = useTransition();

  if (mod === "asistent") {
    // Valorile deja tastate se transmit mai departe: nimeni nu retastează
    // denumirea firmei doar pentru că s-a răzgândit ce drum ia.
    const initiale = {
      ...valoriInitiale,
      ...(nume ? { name: nume, slug: sugereazaSlug(nume) } : {}),
    };
    return <AsistentOrganizatieNoua valoriInitiale={initiale} />;
  }

  if (rezultat !== null) {
    return (
      <div className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-6">
        <h2 className="text-foreground text-lg font-semibold">„{rezultat.name}” a fost creată</h2>
        {rezultat.invitatie.trimisa ? (
          <>
            <p className="text-muted-foreground text-sm">
              {rezultat.invitatie.prinEmail
                ? "Invitația a plecat pe e-mail. Administratorul completează datele firmei la prima intrare — până atunci firma rămâne „În așteptare”."
                : "Invitația a fost creată, dar e-mailul nu a plecat. Trimite manual linkul de mai jos; nu mai poate fi recuperat după ce părăsești pagina."}
            </p>
            {rezultat.invitatie.prinEmail ? null : (
              <LinkInvitatie link={rezultat.invitatie.linkInvitatie} />
            )}
          </>
        ) : (
          <p className="text-danger text-sm">
            Firma s-a creat, dar invitația nu a putut fi trimisă ({rezultat.invitatie.eroare}).
            Trimite-o din ecranul de membri.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/super-admin/organizatii/${rezultat.id}`}
            className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-semibold"
          >
            Deschide fișa firmei
          </Link>
          <Link
            href="/super-admin/organizatii"
            className="border-border text-foreground hover:bg-background rounded-md border px-4 py-2 text-sm font-semibold"
          >
            Înapoi la listă
          </Link>
        </div>
      </div>
    );
  }

  const predaAdministratorului = () => {
    setEroare(null);
    setCampuri({});
    porneste(async () => {
      const raspuns = await creeazaOrganizatieMinima({
        name: nume,
        cui,
        slug: sugereazaSlug(nume),
        admin_email: emailAdmin,
      });
      if (raspuns.ok) {
        setRezultat(raspuns.data as Rezultat);
        return;
      }
      setCampuri(raspuns.error.fieldErrors ?? {});
      setEroare(raspuns.error.message);
    });
  };

  const eroareCamp = (camp: string): string | undefined => campuri[camp]?.[0];
  const clasaCamp =
    "border-border bg-background text-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";

  return (
    <div className="flex flex-col gap-6">
      <div className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-6">
        <h2 className="text-foreground text-base font-semibold">Cine e clientul</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-nume`} className="text-foreground text-sm font-medium">
              Denumire firmă
            </label>
            <input
              id={`${id}-nume`}
              value={nume}
              onChange={(e) => setNume(e.target.value)}
              className={clasaCamp}
              autoComplete="organization"
            />
            {eroareCamp("name") ? (
              <span className="text-danger text-xs">{eroareCamp("name")}</span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-cui`} className="text-foreground text-sm font-medium">
              CUI
            </label>
            <input
              id={`${id}-cui`}
              value={cui}
              onChange={(e) => setCui(e.target.value)}
              className={clasaCamp}
              inputMode="numeric"
            />
            {eroareCamp("cui") ? (
              <span className="text-danger text-xs">{eroareCamp("cui")}</span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-email`} className="text-foreground text-sm font-medium">
            E-mailul administratorului
          </label>
          <input
            id={`${id}-email`}
            type="email"
            value={emailAdmin}
            onChange={(e) => setEmailAdmin(e.target.value)}
            className={clasaCamp}
            autoComplete="email"
          />
          <span className="text-muted-foreground text-xs">
            Primește invitația și devine administratorul firmei.
          </span>
          {eroareCamp("admin_email") ? (
            <span className="text-danger text-xs">{eroareCamp("admin_email")}</span>
          ) : null}
        </div>
      </div>

      {eroare !== null ? (
        <p
          role="alert"
          aria-live="assertive"
          className="border-border bg-surface text-danger rounded-md border px-4 py-3 text-sm"
        >
          {eroare}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-foreground text-base font-semibold">
          Cine completează restul datelor firmei
        </h2>

        <button
          type="button"
          onClick={predaAdministratorului}
          disabled={inCurs}
          className="border-border bg-surface hover:border-primary focus-visible:ring-ring flex items-start gap-4 rounded-lg border p-5 text-start transition focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
        >
          <UserCheck aria-hidden="true" className="text-primary mt-0.5 size-5 shrink-0" />
          <span className="flex flex-col gap-1">
            <span className="text-foreground text-sm font-semibold">
              {inCurs ? "Se creează firma…" : "Le completează administratorul"}
            </span>
            <span className="text-muted-foreground text-sm">
              Firma se creează acum, iar invitația pleacă pe e-mail. Adresa, reprezentantul legal,
              datele financiare și SSM le completează el la prima intrare — le știe mai bine.
            </span>
          </span>
          <Mail aria-hidden="true" className="text-muted-foreground ms-auto size-4 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setMod("asistent")}
          className="border-border bg-surface hover:border-primary focus-visible:ring-ring flex items-start gap-4 rounded-lg border p-5 text-start transition focus-visible:ring-2 focus-visible:outline-none"
        >
          <ClipboardList aria-hidden="true" className="text-primary mt-0.5 size-5 shrink-0" />
          <span className="flex flex-col gap-1">
            <span className="text-foreground text-sm font-semibold">
              Completez eu datele firmei
            </span>
            <span className="text-muted-foreground text-sm">
              Cei 7 pași, ca până acum. Util când ai actele firmei în față și vrei să o predai gata
              configurată.
            </span>
          </span>
          <ArrowRight
            aria-hidden="true"
            className="text-muted-foreground ms-auto size-4 shrink-0"
          />
        </button>
      </div>
    </div>
  );
}

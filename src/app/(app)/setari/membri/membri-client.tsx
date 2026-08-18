// src/app/(app)/setari/membri/membri-client.tsx
"use client";

import { useState, useTransition } from "react";
import { Copy, MailPlus, ShieldAlert } from "lucide-react";

import { clientEnv } from "@/config/env";
import type { ActionResult } from "@/lib/actions/types";

import {
  invitaMembru,
  revocaInvitatia,
  schimbaRolulMembrului,
  seteazaStareaMembrului,
} from "./actions";
import type { InvitatieCreata } from "./actions";

export type RandMembru = Readonly<{
  id: string;
  email: string;
  role: string;
  status: string;
  jobTitle: string | null;
  esteEu: boolean;
}>;

export type RandInvitatie = Readonly<{
  id: string;
  email: string;
  role: string;
  expiraLa: string;
}>;

const ROLURI: readonly Readonly<{
  valoare: "org_admin" | "manager" | "hr" | "employee";
  eticheta: string;
}>[] = [
  { valoare: "org_admin", eticheta: "Administrator" },
  { valoare: "manager", eticheta: "Manager" },
  { valoare: "hr", eticheta: "Resurse umane" },
  { valoare: "employee", eticheta: "Angajat" },
];

const ETICHETE_STARE: Readonly<Record<string, string>> = {
  active: "Activ",
  suspended: "Suspendat",
  inactive: "Dezactivat",
};

function etichetaRol(rol: string): string {
  return ROLURI.find((element) => element.valoare === rol)?.eticheta ?? rol;
}

type Mesaj = Readonly<{ text: string; esteEroare: boolean }>;

/**
 * Acțiunea întoarce tokenul în clar, nu linkul: aceeași formă ca în șablonul de
 * e-mail (`lib/email/templates/invitatie.ts`), ca ambele căi să ducă la aceeași
 * adresă. Slash-ul final din `NEXT_PUBLIC_APP_URL` se taie ca să nu iasă „//”.
 */
function linkDinToken(token: string): string {
  const bazaUrl = clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return `${bazaUrl}/invitatie/${encodeURIComponent(token)}`;
}

export function PanouMembri({
  membri,
  invitatii,
}: Readonly<{ membri: readonly RandMembru[]; invitatii: readonly RandInvitatie[] }>) {
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"org_admin" | "manager" | "hr" | "employee">("employee");
  const [mesaj, setMesaj] = useState<Mesaj | null>(null);
  const [linkInvitatie, setLinkInvitatie] = useState<string | null>(null);
  const [inCurs, startTransition] = useTransition();

  function invita(eveniment: React.FormEvent<HTMLFormElement>): void {
    eveniment.preventDefault();
    startTransition(async () => {
      // Tipul rezultatului se fixează explicit: forma datelor e contractul
      // acțiunii (`InvitatieCreata`), nu ceva dedus la fiecare loc de apel.
      const rezultat: ActionResult<InvitatieCreata> = await invitaMembru({ email, role: rol });
      if (!rezultat.ok) {
        setLinkInvitatie(null);
        setMesaj({ text: rezultat.error.message, esteEroare: true });
        return;
      }
      setEmail("");
      setLinkInvitatie(linkDinToken(rezultat.data.token));
      setMesaj({
        text: rezultat.data.emailTrimis
          ? `Invitația a fost trimisă către ${rezultat.data.email}.`
          : `Invitația a fost creată, dar e-mailul nu a putut fi trimis. Copiați linkul de mai jos.`,
        esteEroare: !rezultat.data.emailTrimis,
      });
    });
  }

  function ruleaza(
    promisiune: Promise<{ ok: boolean; error?: { message: string } }>,
    succes: string,
  ): void {
    startTransition(async () => {
      const rezultat = await promisiune;
      setMesaj(
        rezultat.ok
          ? { text: succes, esteEroare: false }
          : { text: rezultat.error?.message ?? "Operațiunea a eșuat.", esteEroare: true },
      );
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="titlu-invita"
        className="border-border bg-surface rounded-lg border p-4"
      >
        <h2 id="titlu-invita" className="text-foreground text-sm font-medium">
          Invitați un coleg
        </h2>
        <form onSubmit={invita} className="mt-3 flex flex-wrap items-end gap-3" noValidate>
          <div className="flex min-w-56 flex-1 flex-col gap-1">
            <label htmlFor="invita-email" className="text-muted-foreground text-sm">
              Adresă de e-mail
            </label>
            <input
              id="invita-email"
              type="email"
              required
              value={email}
              onChange={(eveniment) => setEmail(eveniment.target.value)}
              className="border-border bg-background text-foreground h-9 rounded-md border px-3 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="invita-rol" className="text-muted-foreground text-sm">
              Rol
            </label>
            <select
              id="invita-rol"
              value={rol}
              onChange={(eveniment) =>
                setRol(eveniment.target.value as "org_admin" | "manager" | "hr" | "employee")
              }
              className="border-border bg-background text-foreground h-9 rounded-md border px-2 text-sm"
            >
              {ROLURI.map((element) => (
                <option key={element.valoare} value={element.valoare}>
                  {element.eticheta}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={inCurs}
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
          >
            <MailPlus aria-hidden="true" className="h-4 w-4" />
            {inCurs ? "Se trimite…" : "Trimite invitația"}
          </button>
        </form>

        <p
          role="status"
          aria-live="polite"
          className={`mt-3 text-sm ${mesaj?.esteEroare === true ? "text-danger" : "text-success"}`}
        >
          {mesaj?.text ?? ""}
        </p>

        {linkInvitatie !== null ? (
          <div className="mt-2 flex items-center gap-2">
            <code className="bg-background text-muted-foreground min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">
              {linkInvitatie}
            </code>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(linkInvitatie)}
              className="border-border text-foreground inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs"
            >
              <Copy aria-hidden="true" className="h-3.5 w-3.5" />
              Copiază linkul
            </button>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="titlu-membri">
        <h2 id="titlu-membri" className="text-foreground mb-2 text-sm font-medium">
          Membri ({membri.length})
        </h2>
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">Membrii organizației curente</caption>
            <thead className="bg-surface text-muted-foreground text-left">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Persoană
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Rol
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Stare
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody>
              {membri.map((membru) => (
                <tr key={membru.id} className="border-border border-t">
                  <td className="px-3 py-2">
                    <span className="text-foreground block">{membru.email}</span>
                    {membru.jobTitle !== null ? (
                      <span className="text-muted-foreground text-xs">{membru.jobTitle}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {membru.esteEu ? (
                      <span className="text-muted-foreground">
                        {etichetaRol(membru.role)} (dvs.)
                      </span>
                    ) : (
                      <>
                        <label htmlFor={`rol-${membru.id}`} className="sr-only">
                          Rolul pentru {membru.email}
                        </label>
                        <select
                          id={`rol-${membru.id}`}
                          defaultValue={membru.role}
                          disabled={inCurs}
                          onChange={(eveniment) =>
                            ruleaza(
                              schimbaRolulMembrului({
                                memberId: membru.id,
                                role: eveniment.target.value,
                              }),
                              "Rolul a fost actualizat.",
                            )
                          }
                          className="border-border bg-background h-8 rounded-md border px-2 text-sm"
                        >
                          {ROLURI.map((element) => (
                            <option key={element.valoare} value={element.valoare}>
                              {element.eticheta}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {ETICHETE_STARE[membru.status] ?? membru.status}
                  </td>
                  <td className="px-3 py-2">
                    {membru.esteEu ? (
                      <span className="text-muted-foreground text-xs">—</span>
                    ) : (
                      <button
                        type="button"
                        disabled={inCurs}
                        onClick={() =>
                          ruleaza(
                            seteazaStareaMembrului({
                              memberId: membru.id,
                              status: membru.status === "active" ? "inactive" : "active",
                            }),
                            membru.status === "active"
                              ? "Membrul a fost dezactivat."
                              : "Membrul a fost reactivat.",
                          )
                        }
                        className="border-border text-foreground hover:bg-surface rounded-md border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
                      >
                        {membru.status === "active" ? "Dezactivează" : "Reactivează"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="titlu-invitatii">
        <h2 id="titlu-invitatii" className="text-foreground mb-2 text-sm font-medium">
          Invitații în așteptare ({invitatii.length})
        </h2>
        {invitatii.length === 0 ? (
          <p className="border-border text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm">
            <ShieldAlert aria-hidden="true" className="h-4 w-4" />
            Nicio invitație în așteptare. Folosiți formularul de mai sus pentru a invita un coleg.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invitatii.map((invitatie) => (
              <li
                key={invitatie.id}
                className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="text-foreground">{invitatie.email}</span>
                <span className="text-muted-foreground">{etichetaRol(invitatie.role)}</span>
                <span className="text-muted-foreground">expiră la {invitatie.expiraLa}</span>
                <button
                  type="button"
                  disabled={inCurs}
                  onClick={() =>
                    ruleaza(
                      revocaInvitatia({ invitationId: invitatie.id }),
                      "Invitația a fost revocată.",
                    )
                  }
                  className="border-border text-danger ml-auto rounded-md border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
                >
                  Revocă
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

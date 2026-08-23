// src/app/(app)/setari/membri/membri-client.tsx
"use client";

import { useState, useTransition } from "react";
import { Copy, MailPlus, ShieldAlert } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { arataToast } from "@/components/ui/toast";
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
  /** `null` când profilul n-are încă numele completat — atunci rămâne e-mailul. */
  nume: string | null;
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
      const text = rezultat.ok ? succes : (rezultat.error?.message ?? "Operațiunea a eșuat.");
      setMesaj({ text, esteEroare: !rezultat.ok });
      // Mesajul din secțiunea de invitații stă la ~30 de rânduri de tabel
      // distanță de butonul apăsat: pe o listă de 20 de membri, confirmarea și
      // refuzul apar în afara ecranului. Toastul e singurul care ajunge acolo
      // unde se uită omul.
      arataToast({ fel: rezultat.ok ? "reusita" : "eroare", text });
    });
  }

  /**
   * Schimbarea rolului se comite pe `onChange`, fără buton de confirmare.
   * Atât timp cât rămâne așa, REFUZUL trebuie să dea înapoi și controlul:
   * `<select>`-ul e necontrolat, deci după un refuz al serverului (ultimul
   * administrator, membru inexistent, drept lipsă) rămânea afișat rolul RESPINS
   * — ecranul spunea „Manager”, baza păstra „Administrator”, iar singurul semn
   * al dezacordului era un mesaj aflat în afara ecranului. Aici valoarea revine
   * la ce are baza, `membru.role`.
   */
  function schimbaRol(membru: RandMembru, control: HTMLSelectElement): void {
    const rolCerut = control.value;
    const rolAnterior = membru.role;
    if (rolCerut === rolAnterior) return;
    startTransition(async () => {
      const rezultat = await schimbaRolulMembrului({ memberId: membru.id, role: rolCerut });
      const numePersoana = membru.nume ?? membru.email;
      if (rezultat.ok) {
        const text = `Rolul lui ${numePersoana} este acum ${etichetaRol(rolCerut)}.`;
        setMesaj({ text, esteEroare: false });
        arataToast({ fel: "reusita", text });
        return;
      }
      control.value = rolAnterior;
      const text = `${rezultat.error?.message ?? "Rolul nu a putut fi schimbat."} ${numePersoana} rămâne ${etichetaRol(rolAnterior)}.`;
      setMesaj({ text, esteEroare: true });
      arataToast({ fel: "eroare", text });
    });
  }

  /**
   * Nicio coloană nu e `sortabil`: lista de membri se citește întreagă, fără
   * cursor — o organizație are zeci de membri, nu mii.
   *
   * Selectorul de rol și butonul de dezactivare stau pe `insigna`, nu pe
   * `meta`: pe telefon, `meta` e un rând mărunt de text separat prin „·”, iar o
   * comandă îngropată acolo nu se mai vede ca o comandă. Ca `insigna` ajung pe
   * rândul de sus al cardului, lângă persoana pe care o privesc.
   */
  const coloaneMembri: readonly Coloana<RandMembru>[] = [
    {
      cheie: "persoana",
      antet: "Persoană",
      peTelefon: "titlu",
      celula: (membru) => (
        <>
          <span className="text-foreground block">{membru.nume ?? membru.email}</span>
          {membru.nume === null ? null : (
            <span className="text-muted-foreground text-nota block">{membru.email}</span>
          )}
          {membru.jobTitle === null ? null : (
            <span className="text-muted-foreground text-nota">{membru.jobTitle}</span>
          )}
        </>
      ),
    },
    {
      cheie: "rol",
      antet: "Rol",
      peTelefon: "insigna",
      celula: (membru) =>
        membru.esteEu ? (
          <span className="text-muted-foreground">{etichetaRol(membru.role)} (dvs.)</span>
        ) : (
          <>
            <label htmlFor={`rol-${membru.id}`} className="sr-only">
              Rolul pentru {membru.nume ?? membru.email}
            </label>
            <select
              id={`rol-${membru.id}`}
              defaultValue={membru.role}
              disabled={inCurs}
              onChange={(eveniment) => schimbaRol(membru, eveniment.currentTarget)}
              className="border-border bg-background rounded-control text-corp h-8 border px-2"
            >
              {ROLURI.map((element) => (
                <option key={element.valoare} value={element.valoare}>
                  {element.eticheta}
                </option>
              ))}
            </select>
          </>
        ),
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "meta",
      celula: (membru) => (
        <span className="text-muted-foreground">
          {ETICHETE_STARE[membru.status] ?? membru.status}
        </span>
      ),
    },
    {
      cheie: "actiuni",
      antet: "Acțiuni",
      latime: "ingusta",
      peTelefon: "insigna",
      celula: (membru) =>
        membru.esteEu ? (
          <span className="text-muted-foreground text-nota">—</span>
        ) : (
          <Buton
            varianta="secundar"
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
          >
            {membru.status === "active" ? "Dezactivează" : "Reactivează"}
          </Buton>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="titlu-invita"
        className="border-border bg-surface rounded-panou border p-4"
      >
        <h2 id="titlu-invita" className="text-foreground text-corp font-medium">
          Invitați un coleg
        </h2>
        <form onSubmit={invita} className="mt-3 flex flex-wrap items-end gap-3" noValidate>
          <div className="flex min-w-56 flex-1 flex-col gap-1">
            <label htmlFor="invita-email" className="text-muted-foreground text-corp">
              Adresă de e-mail
            </label>
            <input
              id="invita-email"
              type="email"
              required
              value={email}
              onChange={(eveniment) => setEmail(eveniment.target.value)}
              className="border-border bg-background text-foreground rounded-control text-corp h-9 border px-3"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="invita-rol" className="text-muted-foreground text-corp">
              Rol
            </label>
            <select
              id="invita-rol"
              value={rol}
              onChange={(eveniment) =>
                setRol(eveniment.target.value as "org_admin" | "manager" | "hr" | "employee")
              }
              className="border-border bg-background text-foreground rounded-control text-corp h-9 border px-2"
            >
              {ROLURI.map((element) => (
                <option key={element.valoare} value={element.valoare}>
                  {element.eticheta}
                </option>
              ))}
            </select>
          </div>
          <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se trimite…">
            <MailPlus aria-hidden="true" className="h-4 w-4" />
            Trimite invitația
          </Buton>
        </form>

        <p
          role="status"
          aria-live="polite"
          className={`text-corp mt-3 ${mesaj?.esteEroare === true ? "text-danger" : "text-success"}`}
        >
          {mesaj?.text ?? ""}
        </p>

        {linkInvitatie !== null ? (
          <div className="mt-2 flex items-center gap-2">
            <code className="bg-background text-muted-foreground text-nota min-w-0 flex-1 truncate rounded px-2 py-1">
              {linkInvitatie}
            </code>
            <Buton
              varianta="secundar"
              onClick={() => void navigator.clipboard.writeText(linkInvitatie)}
            >
              <Copy aria-hidden="true" className="h-3.5 w-3.5" />
              Copiază linkul
            </Buton>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="titlu-membri">
        <h2 id="titlu-membri" className="text-foreground text-corp mb-2 font-medium">
          Membri ({membri.length})
        </h2>
        <Tabel
          caption="Membrii organizației curente"
          coloane={coloaneMembri}
          randuri={membri}
          cheieRand={(membru) => membru.id}
          densitate="compact"
          gol={
            <StareGoala
              fel="initiala"
              pictograma={ShieldAlert}
              titlu="Niciun membru"
              descriere="Folosiți formularul de mai sus pentru a invita primul coleg."
              compact
            />
          }
        />
      </section>

      <section aria-labelledby="titlu-invitatii">
        <h2 id="titlu-invitatii" className="text-foreground text-corp mb-2 font-medium">
          Invitații în așteptare ({invitatii.length})
        </h2>
        {invitatii.length === 0 ? (
          <p className="border-border text-muted-foreground rounded-panou text-corp flex items-center gap-2 border border-dashed px-4 py-6">
            <ShieldAlert aria-hidden="true" className="h-4 w-4" />
            Nicio invitație în așteptare. Folosiți formularul de mai sus pentru a invita un coleg.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invitatii.map((invitatie) => (
              <li
                key={invitatie.id}
                className="border-border bg-surface rounded-panou text-corp flex flex-wrap items-center gap-3 border px-3 py-2"
              >
                <span className="text-foreground">{invitatie.email}</span>
                <span className="text-muted-foreground">{etichetaRol(invitatie.role)}</span>
                <span className="text-muted-foreground">expiră la {invitatie.expiraLa}</span>
                <Buton
                  varianta="distructiv"
                  disabled={inCurs}
                  className="ml-auto"
                  onClick={() =>
                    ruleaza(
                      revocaInvitatia({ invitationId: invitatie.id }),
                      "Invitația a fost revocată.",
                    )
                  }
                >
                  Revocă
                </Buton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

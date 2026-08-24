// src/app/(app)/ticketing/[id]/actiuni-tichet.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import type { StatusTichet } from "@/domain/ticketing/stari";
import { PRIORITATI, type Prioritate } from "@/domain/ticketing/prioritate";
import { ETICHETE_PRIORITATE, ETICHETE_STATUS } from "../etichete";
import { MACROURI } from "@/domain/ticketing/macrouri";
import {
  aplicaMacro,
  asigneaza,
  comenteaza,
  decideTichet,
  schimbaStatusul,
  suprascriePrioritatea,
} from "../actions";

function Mesaj({ text }: Readonly<{ text: string | null }>) {
  if (text === null) return null;
  return (
    <p role="alert" className="text-danger text-corp mt-2">
      {text}
    </p>
  );
}

/** Decizia pe o cerere: aprobare fără motiv, respingere cu motiv obligatoriu. */
export function DecizieCerere({ ticketId }: Readonly<{ ticketId: string }>) {
  const router = useRouter();
  const [motiv, setMotiv] = useState("");
  const [respinge, setRespinge] = useState(false);
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  const decide = (aprobat: boolean) => {
    setEroare(null);
    porneste(async () => {
      const raspuns = await decideTichet({
        ticket_id: ticketId,
        aprobat,
        ...(motiv.trim() === "" ? {} : { motiv: motiv.trim() }),
      });
      if (raspuns.ok) {
        router.refresh();
        return;
      }
      setEroare(raspuns.error.message);
    });
  };

  return (
    <div className="border-border bg-surface rounded-panou space-y-3 border p-4">
      <p className="text-foreground text-corp font-medium">Cererea așteaptă decizia ta</p>

      {respinge ? (
        <>
          <label htmlFor="motiv-respingere" className="text-foreground text-corp block">
            Motivul respingerii *
          </label>
          <textarea
            id="motiv-respingere"
            value={motiv}
            onChange={(e) => setMotiv(e.target.value)}
            rows={3}
            className="border-border bg-background rounded-control text-corp w-full border px-3 py-2"
          />
          <div className="flex gap-2">
            <Buton varianta="secundar" disabled={inCurs} onClick={() => decide(false)}>
              Confirmă respingerea
            </Buton>
            <Buton varianta="secundar" onClick={() => setRespinge(false)}>
              Renunță
            </Buton>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <Buton varianta="primar" disabled={inCurs} onClick={() => decide(true)}>
            Aprobă
          </Buton>
          <Buton varianta="secundar" onClick={() => setRespinge(true)}>
            Respinge
          </Buton>
        </div>
      )}

      <Mesaj text={eroare} />
    </div>
  );
}

/**
 * Butoanele de schimbare a stării. Lista vine de la server, calculată cu
 * `tranzitiiOferite` — ce nu e permis nu se afișează, iar baza verifică oricum.
 */
export function SchimbaStatus({
  ticketId,
  optiuni,
}: Readonly<{ ticketId: string; optiuni: readonly StatusTichet[] }>) {
  const router = useRouter();
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  if (optiuni.length === 0) return null;

  const schimba = (status: StatusTichet) => {
    setEroare(null);
    porneste(async () => {
      const raspuns = await schimbaStatusul({ ticket_id: ticketId, status });
      if (raspuns.ok) {
        router.refresh();
        return;
      }
      setEroare(raspuns.error.message);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {optiuni.map((status) => (
          <Buton key={status} varianta="secundar" disabled={inCurs} onClick={() => schimba(status)}>
            {ETICHETE_STATUS[status]}
          </Buton>
        ))}
      </div>
      <Mesaj text={eroare} />
    </div>
  );
}

/** Comentariu public sau notă internă. Comutatorul apare doar cui are dreptul. */
export function FormularComentariu({
  ticketId,
  poateNotaInterna,
}: Readonly<{ ticketId: string; poateNotaInterna: boolean }>) {
  const router = useRouter();
  const [continut, setContinut] = useState("");
  const [intern, setIntern] = useState(false);
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  const trimite = () => {
    setEroare(null);
    porneste(async () => {
      const raspuns = await comenteaza({ ticket_id: ticketId, continut, intern });
      if (raspuns.ok) {
        setContinut("");
        setIntern(false);
        router.refresh();
        return;
      }
      setEroare(raspuns.error.message);
    });
  };

  return (
    <div className="space-y-2">
      <label htmlFor="comentariu-nou" className="text-foreground text-corp block font-medium">
        Adaugă un răspuns
      </label>
      <textarea
        id="comentariu-nou"
        value={continut}
        onChange={(e) => setContinut(e.target.value)}
        rows={3}
        className="border-border bg-background rounded-control text-corp w-full border px-3 py-2"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Buton
          varianta="primar"
          disabled={continut.trim() === ""}
          inCurs={inCurs}
          textInCurs="Se trimite…"
          onClick={trimite}
        >
          Trimite
        </Buton>
        {poateNotaInterna && (
          <label className="text-muted-foreground text-corp flex items-center gap-2">
            <input
              type="checkbox"
              checked={intern}
              onChange={(e) => setIntern(e.target.checked)}
              className="size-4"
            />
            Notă internă — solicitantul nu o vede
          </label>
        )}
      </div>
      <Mesaj text={eroare} />
    </div>
  );
}

/**
 * Repartizarea tichetului.
 *
 * ── ACȚIUNEA EXISTA, ECRANUL NU ───────────────────────────────────────────────
 * `ticketing.assign` e scrisă complet în `actions.ts` — cu filtru de tenant, cu
 * `.select().maybeSingle()` peste refuzul tăcut al politicii, cu intrare de
 * audit — și nu o chema NIMENI. Coada arăta cine e asignat abia de azi, iar
 * repartizarea nu se putea face din aplicație deloc: un operator lua un tichet
 * anunțând-o pe alt canal, iar coada rămânea nerepartizată la infinit.
 *
 * Nu e un selector de colegi, ci „îl iau eu" / „îl las": pentru asta ar trebui
 * lista angajaților, iar cine are `tickets:update = all` nu are neapărat și
 * `employees:read = all` — selectul ar fi ieșit gol pentru unii, fără nicio
 * explicație. Repartizarea către altcineva rămâne de făcut, cu un `<Combobox>`
 * alimentat de o citire proprie.
 */
export function Repartizare({
  ticketId,
  propriaFisaId,
  asignatId,
  numeAsignat,
}: Readonly<{
  ticketId: string;
  propriaFisaId: string | null;
  asignatId: string | null;
  numeAsignat: string | null;
}>) {
  const router = useRouter();
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  const repartizeaza = (catre: string | null) => {
    setEroare(null);
    porneste(async () => {
      const raspuns = await asigneaza({ ticket_id: ticketId, asignat_employee_id: catre });
      if (raspuns.ok) {
        router.refresh();
        return;
      }
      setEroare(raspuns.error.message);
    });
  };

  const alMeu = propriaFisaId !== null && asignatId === propriaFisaId;

  return (
    <div className="space-y-2">
      <p className="text-foreground text-corp font-medium">Repartizare</p>
      <p className="text-muted-foreground text-corp">
        {asignatId === null
          ? "Tichetul nu e repartizat nimănui."
          : `Repartizat lui ${numeAsignat ?? "un coleg"}.`}
      </p>
      <div className="flex flex-wrap gap-2">
        {propriaFisaId === null ? (
          <p className="text-muted-foreground text-corp">
            Contul dumneavoastră nu are fișă de angajat în această organizație, deci nu vi se poate
            repartiza un tichet.
          </p>
        ) : alMeu ? (
          <Buton varianta="secundar" disabled={inCurs} onClick={() => repartizeaza(null)}>
            Renunță la tichet
          </Buton>
        ) : (
          <Buton varianta="secundar" disabled={inCurs} onClick={() => repartizeaza(propriaFisaId)}>
            {asignatId === null ? "Ia tichetul" : "Preia tichetul"}
          </Buton>
        )}
        {asignatId !== null && !alMeu ? (
          <Buton varianta="secundar" disabled={inCurs} onClick={() => repartizeaza(null)}>
            Scoate repartizarea
          </Buton>
        ) : null}
      </div>
      <Mesaj text={eroare} />
    </div>
  );
}

/**
 * Suprascrierea priorității calculate.
 *
 * A doua acțiune fără punct de intrare: prioritatea o calculează
 * `internal.tickets_calculeaza_prioritatea` din tip, din „mă blochează" și din
 * numărul de duplicate, iar `ticketing.priority` e singurul fel în care un om o
 * poate contrazice. Motivul e obligatoriu în schemă (minimum 3 caractere) și
 * ajunge în `ticket_history`, nu doar în `audit_logs`: cine deschide fișa peste
 * o lună trebuie să vadă DE CE tichetul e critic, fără să ceară un auditor.
 */
export function PrioritateManuala({
  ticketId,
  prioritateCurenta,
  manuala,
  motivCurent,
}: Readonly<{
  ticketId: string;
  prioritateCurenta: Prioritate;
  manuala: boolean;
  motivCurent: string | null;
}>) {
  const router = useRouter();
  const id = useId();
  const [deschis, setDeschis] = useState(false);
  const [prioritate, setPrioritate] = useState<Prioritate>(prioritateCurenta);
  const [motiv, setMotiv] = useState("");
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  const trimite = () => {
    setEroare(null);
    porneste(async () => {
      const raspuns = await suprascriePrioritatea({
        ticket_id: ticketId,
        prioritate,
        motiv: motiv.trim(),
      });
      if (raspuns.ok) {
        setDeschis(false);
        setMotiv("");
        router.refresh();
        return;
      }
      setEroare(raspuns.error.message);
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-foreground text-corp font-medium">Prioritate</p>
      <p className="text-muted-foreground text-corp">
        {manuala
          ? `Stabilită manual: ${ETICHETE_PRIORITATE[prioritateCurenta]}.`
          : `Calculată automat: ${ETICHETE_PRIORITATE[prioritateCurenta]}.`}
        {motivCurent === null ? "" : ` Motiv: ${motivCurent}`}
      </p>

      {deschis ? (
        <div className="space-y-2">
          <label htmlFor={`${id}-prioritate`} className="text-foreground text-corp block">
            Prioritate nouă
          </label>
          <select
            id={`${id}-prioritate`}
            value={prioritate}
            onChange={(e) => setPrioritate(e.target.value as Prioritate)}
            className="border-border bg-background rounded-control text-corp w-full border px-3 py-2"
          >
            {PRIORITATI.map((valoare) => (
              <option key={valoare} value={valoare}>
                {ETICHETE_PRIORITATE[valoare]}
              </option>
            ))}
          </select>

          <label htmlFor={`${id}-motiv`} className="text-foreground text-corp block">
            De ce o schimbi *
          </label>
          <textarea
            id={`${id}-motiv`}
            value={motiv}
            onChange={(e) => setMotiv(e.target.value)}
            rows={2}
            className="border-border bg-background rounded-control text-corp w-full border px-3 py-2"
          />

          <div className="flex flex-wrap gap-2">
            <Buton
              varianta="primar"
              disabled={motiv.trim().length < 3}
              inCurs={inCurs}
              textInCurs="Se salvează…"
              onClick={trimite}
            >
              Salvează prioritatea
            </Buton>
            <Buton varianta="secundar" onClick={() => setDeschis(false)}>
              Renunță
            </Buton>
          </div>
        </div>
      ) : (
        <Buton varianta="secundar" onClick={() => setDeschis(true)}>
          Schimbă prioritatea
        </Buton>
      )}

      <Mesaj text={eroare} />
    </div>
  );
}

/**
 * Răspunsurile predefinite. Un click scrie textul standard și mută starea —
 * fără să oblige pe cineva să reformuleze a suta oară „am nevoie de detalii”.
 */
export function Macrouri({ ticketId }: Readonly<{ ticketId: string }>) {
  const router = useRouter();
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  const aplica = (cod: string) => {
    setEroare(null);
    porneste(async () => {
      const raspuns = await aplicaMacro({ ticket_id: ticketId, cod });
      if (raspuns.ok) {
        router.refresh();
        return;
      }
      setEroare(raspuns.error.message);
    });
  };

  return (
    <div className="border-border bg-surface rounded-panou space-y-2 border p-4">
      <p className="text-foreground text-corp font-medium">Răspunsuri rapide</p>
      <div className="flex flex-wrap gap-2">
        {MACROURI.map((macro) => (
          <Buton
            key={macro.cod}
            varianta="secundar"
            disabled={inCurs}
            onClick={() => aplica(macro.cod)}
            title={macro.text}
          >
            {macro.eticheta}
          </Buton>
        ))}
      </div>
      <Mesaj text={eroare} />
    </div>
  );
}

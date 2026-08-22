// src/app/(app)/ticketing/[id]/actiuni-tichet.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { StatusTichet } from "@/domain/ticketing/stari";
import { ETICHETE_STATUS } from "../etichete";
import { MACROURI } from "@/domain/ticketing/macrouri";
import { aplicaMacro, comenteaza, decideTichet, schimbaStatusul } from "../actions";

const CLASA_BUTON =
  "rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface disabled:opacity-60";

function Mesaj({ text }: Readonly<{ text: string | null }>) {
  if (text === null) return null;
  return (
    <p role="alert" className="text-danger mt-2 text-sm">
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
    <div className="border-border bg-surface space-y-3 rounded-lg border p-4">
      <p className="text-foreground text-sm font-medium">Cererea așteaptă decizia ta</p>

      {respinge ? (
        <>
          <label htmlFor="motiv-respingere" className="text-foreground block text-sm">
            Motivul respingerii *
          </label>
          <textarea
            id="motiv-respingere"
            value={motiv}
            onChange={(e) => setMotiv(e.target.value)}
            rows={3}
            className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={inCurs}
              onClick={() => decide(false)}
              className={CLASA_BUTON}
            >
              Confirmă respingerea
            </button>
            <button type="button" onClick={() => setRespinge(false)} className={CLASA_BUTON}>
              Renunță
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={inCurs}
            onClick={() => decide(true)}
            className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            Aprobă
          </button>
          <button type="button" onClick={() => setRespinge(true)} className={CLASA_BUTON}>
            Respinge
          </button>
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
          <button
            key={status}
            type="button"
            disabled={inCurs}
            onClick={() => schimba(status)}
            className={CLASA_BUTON}
          >
            {ETICHETE_STATUS[status]}
          </button>
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
      <label htmlFor="comentariu-nou" className="text-foreground block text-sm font-medium">
        Adaugă un răspuns
      </label>
      <textarea
        id="comentariu-nou"
        value={continut}
        onChange={(e) => setContinut(e.target.value)}
        rows={3}
        className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={inCurs || continut.trim() === ""}
          onClick={trimite}
          className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
        >
          {inCurs ? "Se trimite…" : "Trimite"}
        </button>
        {poateNotaInterna && (
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
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
    <div className="border-border bg-surface space-y-2 rounded-lg border p-4">
      <p className="text-foreground text-sm font-medium">Răspunsuri rapide</p>
      <div className="flex flex-wrap gap-2">
        {MACROURI.map((macro) => (
          <button
            key={macro.cod}
            type="button"
            disabled={inCurs}
            onClick={() => aplica(macro.cod)}
            title={macro.text}
            className={CLASA_BUTON}
          >
            {macro.eticheta}
          </button>
        ))}
      </div>
      <Mesaj text={eroare} />
    </div>
  );
}

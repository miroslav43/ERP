// src/app/(app)/reges/coada-client.tsx
"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Buton } from "@/components/ui/buton";
import { anuleazaMesajul, pregatesteTransmiterea, transmiteMesajul } from "./actiuni-api";

type Mesaj = Readonly<{ fel: "eroare" | "succes"; text: string }>;

function Anunt({ mesaj }: { readonly mesaj: Mesaj | null }) {
  return (
    <p
      aria-live="polite"
      className={
        mesaj?.fel === "eroare" ? "text-danger text-nota" : "text-muted-foreground text-nota"
      }
    >
      {mesaj?.text}
    </p>
  );
}

/** „Pregătește” traduce un eveniment din registru în mesajele API care-l acoperă. */
export function ButonPregateste(props: { readonly evenimentId: string }) {
  const router = useRouter();
  const [mesaj, setMesaj] = useState<Mesaj | null>(null);
  const [inCurs, startTransition] = useTransition();

  function apasa() {
    setMesaj(null);
    startTransition(async () => {
      const rezultat = await pregatesteTransmiterea({ evenimentId: props.evenimentId });
      if (rezultat.ok) {
        setMesaj({
          fel: "succes",
          text:
            rezultat.data.mesaje === 0
              ? "Mesajele erau deja pregătite."
              : `S-au pregătit ${rezultat.data.mesaje} mesaje.`,
        });
        router.refresh();
      } else {
        setMesaj({ fel: "eroare", text: rezultat.error.message });
      }
    });
  }

  return (
    <div className="space-y-1">
      <Buton varianta="secundar" onClick={apasa} disabled={inCurs}>
        {inCurs ? "Se pregătește…" : "Pregătește pentru REGES"}
      </Buton>
      <Anunt mesaj={mesaj} />
    </div>
  );
}

/**
 * Trimiterea unui mesaj de salariat.
 *
 * Butonul apare DOAR pe mesajele de tip `salariat`: contractele pleacă din
 * ciclul de reconciliere, care nu are nevoie de CNP. Aici, dimpotrivă, apăsarea
 * declanșează citirea CNP-ului sub identitatea operatorului, iar citirea se
 * scrie în jurnalul de audit pe numele lui.
 */
export function ButonTransmite(props: {
  readonly mesajId: string;
  readonly numeAngajat: string;
  readonly transmisibil: boolean;
}) {
  const router = useRouter();
  const [confirma, setConfirma] = useState(false);
  const [mesaj, setMesaj] = useState<Mesaj | null>(null);
  const [inCurs, startTransition] = useTransition();

  function trimite() {
    setMesaj(null);
    startTransition(async () => {
      const rezultat = await transmiteMesajul({ mesajId: props.mesajId });
      if (rezultat.ok) {
        setMesaj({ fel: "succes", text: rezultat.data.mesaj });
        setConfirma(false);
        router.refresh();
      } else {
        setMesaj({ fel: "eroare", text: rezultat.error.message });
      }
    });
  }

  if (!props.transmisibil) {
    return (
      <span className="text-muted-foreground text-nota">Așteaptă identificatorul salariatului</span>
    );
  }

  return (
    <div className="space-y-1">
      {confirma ? (
        <div className="bg-surface rounded-control space-y-2 p-3">
          <p className="text-foreground text-nota">
            Fișa lui {props.numeAngajat} pleacă la Inspecția Muncii. O corecție ulterioară rămâne
            vizibilă în istoricul lor.
          </p>
          <div className="flex gap-2">
            <Buton varianta="primar" onClick={trimite} disabled={inCurs}>
              {inCurs ? "Se trimite…" : "Transmite acum"}
            </Buton>
            <Buton varianta="secundar" onClick={() => setConfirma(false)} disabled={inCurs}>
              Renunță
            </Buton>
          </div>
        </div>
      ) : (
        <Buton varianta="primar" onClick={() => setConfirma(true)} aria-expanded={confirma}>
          Transmite
        </Buton>
      )}
      <Anunt mesaj={mesaj} />
    </div>
  );
}

export function ButonAnuleazaMesaj(props: { readonly mesajId: string }) {
  const router = useRouter();
  const idMotiv = useId();
  const [deschis, setDeschis] = useState(false);
  const [mesaj, setMesaj] = useState<Mesaj | null>(null);
  const [inCurs, startTransition] = useTransition();

  function trimite(formular: FormData) {
    const motiv = String(formular.get("motiv") ?? "");
    setMesaj(null);
    startTransition(async () => {
      const rezultat = await anuleazaMesajul({ mesajId: props.mesajId, motiv });
      if (rezultat.ok) {
        setDeschis(false);
        router.refresh();
      } else {
        setMesaj({ fel: "eroare", text: rezultat.error.message });
      }
    });
  }

  return (
    <div className="space-y-1">
      <Buton varianta="secundar" onClick={() => setDeschis((v) => !v)} aria-expanded={deschis}>
        Anulează
      </Buton>
      {deschis ? (
        <form action={trimite} className="bg-surface rounded-control space-y-2 p-3">
          <label htmlFor={idMotiv} className="text-foreground text-nota block font-medium">
            De ce anulați
          </label>
          <input
            id={idMotiv}
            name="motiv"
            type="text"
            maxLength={300}
            required
            className="border-border bg-background rounded-control w-full border p-2"
          />
          <Buton type="submit" varianta="primar" disabled={inCurs}>
            {inCurs ? "Se anulează…" : "Confirmă anularea"}
          </Buton>
        </form>
      ) : null}
      <Anunt mesaj={mesaj} />
    </div>
  );
}

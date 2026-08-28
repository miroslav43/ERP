// src/app/(app)/reges/propuneri/raspuns-propunere.tsx
"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Buton } from "@/components/ui/buton";
import { raspundePropunerii } from "../actiuni-api";

export function RaspunsPropunere(props: {
  readonly propunereId: string;
  readonly descriere: string;
}) {
  const router = useRouter();
  const idObservatii = useId();
  const [deschis, setDeschis] = useState<"acceptata" | "respinsa" | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [inCurs, startTransition] = useTransition();

  function trimite(formular: FormData) {
    const raspuns = deschis;
    if (raspuns === null) return;
    const observatii = String(formular.get("observatii") ?? "");
    setMesaj(null);
    startTransition(async () => {
      const rezultat = await raspundePropunerii({
        propunereId: props.propunereId,
        raspuns,
        ...(observatii === "" ? {} : { observatii }),
      });
      if (rezultat.ok) {
        setDeschis(null);
        router.refresh();
      } else {
        setMesaj(rezultat.error.message);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Buton
          varianta="primar"
          onClick={() => setDeschis((v) => (v === "acceptata" ? null : "acceptata"))}
          aria-expanded={deschis === "acceptata"}
          disabled={inCurs}
        >
          Acceptă
        </Buton>
        <Buton
          varianta="secundar"
          onClick={() => setDeschis((v) => (v === "respinsa" ? null : "respinsa"))}
          aria-expanded={deschis === "respinsa"}
          disabled={inCurs}
        >
          Respinge
        </Buton>
      </div>

      {deschis !== null ? (
        <form action={trimite} className="bg-surface rounded-control space-y-2 p-3">
          <p className="text-muted-foreground text-nota">
            {deschis === "acceptata" ? "Acceptați" : "Respingeți"} {props.descriere}. Răspunsul
            pleacă imediat la Inspecția Muncii și nu se mai poate retrage din aplicație.
          </p>
          <div>
            <label htmlFor={idObservatii} className="text-foreground text-nota block font-medium">
              Observații (opțional)
            </label>
            <textarea
              id={idObservatii}
              name="observatii"
              maxLength={500}
              rows={2}
              className="border-border bg-background rounded-control mt-1 w-full border p-2"
            />
          </div>
          <Buton type="submit" varianta="primar" disabled={inCurs}>
            {inCurs ? "Se trimite…" : "Confirmă"}
          </Buton>
        </form>
      ) : null}

      <p aria-live="polite" className="text-danger text-nota">
        {mesaj}
      </p>
    </div>
  );
}
